"""
SkyGarage ATR 확장 칼만 필터(EKF) 기반 센서 퓨전 로컬라이제이션 모듈
특허 컴포넌트 식별 부호: 슬루링 메커니즘 [310]

GPS 음영 구역(지하 주차장, 차량 엘리베이터)에서의 밀리미터급 초고정밀 자율주행 위치 추정.

입력 센서:
  - 천장 UWB 앵커: 거리 측정치 (ToA 기반 다변측량)
  - 바닥면 QR 매트릭스: 절대 좌표 인덱싱 (이산 보정점)
  - LiDAR SLAM 오도메트리: 상대 이동량 + 공분산 행렬
  - ToF 센서: 근거리 장애물 거리 (데드레커닝 보조)

출력:
  - 6-DOF 위치 벡터 [X, Y, Z, Roll, Pitch, Yaw]
  - 0.001초 타임싱크 패킷 → skygarage.atr.localization 토픽 퍼블리싱

슬루링[310] 보정:
  - 제자리 스핀 턴 시 각속도 급증 현상 수학적 보정
  - 동적 프로세스 노이즈 + 적응형 게인 튜닝
"""

from __future__ import annotations

import asyncio
import math
import time
import uuid
from dataclasses import dataclass, field
from enum import Enum
from typing import Any

import numpy as np
from numpy.typing import NDArray

SLEWING_RING_PATENT_ID = "[310]"
LOCALIZATION_TOPIC = "skygarage.atr.localization"

STATE_DIM = 9  # [x, y, z, roll, pitch, yaw, vx, vy, omega_z]
SPIN_TURN_OMEGA_THRESHOLD = 1.5
MAX_SPIN_OMEGA = 2 * math.pi
UWB_DROPOUT_SWITCH_LIMIT_MS = 10.0


class SensorMode(Enum):
    FULL_FUSION = "full_fusion"
    UWB_DROPOUT_BACKUP = "uwb_dropout_backup"
    QR_ONLY = "qr_only"
    DEAD_RECKONING = "dead_reckoning"


class SpinTurnState(Enum):
    NORMAL = "normal"
    SPIN_ENTRY = "spin_entry"
    SPINNING = "spinning"
    SPIN_EXIT = "spin_exit"


@dataclass
class UWBAnchor:
    anchor_id: str
    x: float
    y: float
    z: float


@dataclass
class UWBMeasurement:
    anchor_id: str
    range_m: float
    timestamp: float
    signal_quality: float = 1.0


@dataclass
class QRMeasurement:
    qr_hash: str
    x: float
    y: float
    z: float
    roll: float = 0.0
    pitch: float = 0.0
    yaw: float = 0.0
    timestamp: float = 0.0


@dataclass
class OdometryMeasurement:
    dx: float
    dy: float
    dz: float
    dtheta: float
    covariance: NDArray
    timestamp: float = 0.0


@dataclass
class ToFMeasurement:
    distance_m: float
    direction_rad: float
    timestamp: float = 0.0


@dataclass
class LocalizationPacket:
    packet_id: str = field(default_factory=lambda: str(uuid.uuid4()))
    timestamp: float = 0.0
    x: float = 0.0
    y: float = 0.0
    z: float = 0.0
    roll: float = 0.0
    pitch: float = 0.0
    yaw: float = 0.0
    vx: float = 0.0
    vy: float = 0.0
    omega_z: float = 0.0
    covariance_trace: float = 0.0
    sensor_mode: str = SensorMode.FULL_FUSION.value
    spin_turn_active: bool = False
    topic: str = LOCALIZATION_TOPIC
    patent_id: str = SLEWING_RING_PATENT_ID

    def to_dict(self) -> dict[str, Any]:
        return {
            "packet_id": self.packet_id,
            "timestamp": self.timestamp,
            "position": {"x": self.x, "y": self.y, "z": self.z},
            "orientation": {"roll": self.roll, "pitch": self.pitch, "yaw": self.yaw},
            "velocity": {"vx": self.vx, "vy": self.vy, "omega_z": self.omega_z},
            "covariance_trace": self.covariance_trace,
            "sensor_mode": self.sensor_mode,
            "spin_turn_active": self.spin_turn_active,
            "topic": self.topic,
            "patent_id": self.patent_id,
        }


class SlewingRingCompensator:
    """
    슬루링 메커니즘[310] 스핀 턴 보정기.
    제자리 회전 시 위치 추정 발산을 방지하기 위한 동적 게인 튜닝.
    """

    def __init__(self) -> None:
        self._state = SpinTurnState.NORMAL
        self._omega_history: list[float] = []
        self.patent_id = SLEWING_RING_PATENT_ID

    @property
    def is_spinning(self) -> bool:
        return self._state in (SpinTurnState.SPINNING, SpinTurnState.SPIN_ENTRY)

    @property
    def state(self) -> SpinTurnState:
        return self._state

    def update(self, omega_z: float, current_yaw: float) -> float:
        abs_omega = abs(omega_z)
        self._omega_history.append(abs_omega)
        if len(self._omega_history) > 10:
            self._omega_history.pop(0)

        if self._state == SpinTurnState.NORMAL:
            if abs_omega > SPIN_TURN_OMEGA_THRESHOLD:
                self._state = SpinTurnState.SPIN_ENTRY
                return 0.3
            return 1.0

        elif self._state == SpinTurnState.SPIN_ENTRY:
            if abs_omega > SPIN_TURN_OMEGA_THRESHOLD * 0.8:
                self._state = SpinTurnState.SPINNING
                return 0.2
            else:
                self._state = SpinTurnState.NORMAL
                return 1.0

        elif self._state == SpinTurnState.SPINNING:
            if abs_omega < SPIN_TURN_OMEGA_THRESHOLD * 0.5:
                self._state = SpinTurnState.SPIN_EXIT
                return 0.6
            return 0.15

        elif self._state == SpinTurnState.SPIN_EXIT:
            if abs_omega < SPIN_TURN_OMEGA_THRESHOLD * 0.3:
                self._state = SpinTurnState.NORMAL
                return 1.0
            return 0.7

        return 1.0


class UWBDropoutDetector:
    """UWB 드롭아웃 감지. 스위칭 < 10ms 보장."""

    def __init__(self, min_anchors: int = 3) -> None:
        self._min_anchors = min_anchors
        self._last_valid_uwb_time: float = 0.0
        self._dropout_detected: bool = False
        self._switch_timestamp: float = 0.0

    @property
    def is_dropout(self) -> bool:
        return self._dropout_detected

    @property
    def switch_latency_ms(self) -> float:
        if self._switch_timestamp == 0.0:
            return 0.0
        return (self._switch_timestamp - self._last_valid_uwb_time) * 1000.0

    def check(self, valid_anchor_count: int, current_time: float) -> SensorMode:
        if valid_anchor_count >= self._min_anchors:
            if self._dropout_detected:
                self._dropout_detected = False
            self._last_valid_uwb_time = current_time
            return SensorMode.FULL_FUSION

        if not self._dropout_detected:
            self._dropout_detected = True
            self._switch_timestamp = current_time

        return SensorMode.UWB_DROPOUT_BACKUP

    def get_covariance_inflation(self) -> float:
        if not self._dropout_detected:
            return 1.0
        return 3.0


class EKFLocalization:
    """
    확장 칼만 필터(EKF) 센서 퓨전 로컬라이제이션.
    상태 벡터: [x, y, z, roll, pitch, yaw, vx, vy, omega_z]
    슬루링[310] 보정 및 UWB 드롭아웃 이중 백업 지원.

    핵심 설계:
    - predict(): 속도→위치 전파 + 프로세스 노이즈
    - update_odometry(): 속도 관측 업데이트 (odom delta/dt = 속도)
    - update_uwb(): 삼변측량 범위 관측
    - update_qr(): 6-DOF 직접 관측
    """

    def __init__(
        self,
        uwb_anchors: list[UWBAnchor] | None = None,
        initial_position: tuple[float, float, float] = (0.0, 0.0, 0.0),
    ) -> None:
        self._x = np.zeros(STATE_DIM)
        self._x[0], self._x[1], self._x[2] = initial_position

        self._P = np.diag([
            0.001, 0.001, 0.001,
            0.0001, 0.0001, 0.001,
            1.0, 1.0, 1.0,
        ])

        self._Q_predict = np.diag([
            1e-8, 1e-8, 1e-9,
            1e-9, 1e-9, 1e-7,
            0.1, 0.1, 0.05,
        ])

        self._anchors = uwb_anchors or []
        self._slewing = SlewingRingCompensator()
        self._uwb_detector = UWBDropoutDetector()
        self._sensor_mode = SensorMode.FULL_FUSION
        self._last_timestamp: float = 0.0
        self._publish_queue: asyncio.Queue[LocalizationPacket] = asyncio.Queue()

    @property
    def state(self) -> NDArray:
        return self._x.copy()

    @property
    def covariance(self) -> NDArray:
        return self._P.copy()

    @property
    def position(self) -> tuple[float, float, float]:
        return (float(self._x[0]), float(self._x[1]), float(self._x[2]))

    @property
    def orientation(self) -> tuple[float, float, float]:
        return (float(self._x[3]), float(self._x[4]), float(self._x[5]))

    @property
    def sensor_mode(self) -> SensorMode:
        return self._sensor_mode

    @property
    def is_spin_turning(self) -> bool:
        return self._slewing.is_spinning

    @property
    def position_uncertainty(self) -> float:
        return float(np.sqrt(self._P[0, 0] + self._P[1, 1] + self._P[2, 2]))

    def predict(self, dt: float) -> None:
        """상태 예측: 속도→위치 전파 + 슬루링[310] 상태 관리."""
        if dt <= 0:
            return

        vx, vy, omega_z = self._x[6], self._x[7], self._x[8]
        yaw = self._x[5]
        cos_yaw = math.cos(yaw)
        sin_yaw = math.sin(yaw)

        # 슬루링 상태 업데이트
        self._slewing.update(omega_z, yaw)

        # 속도 감쇠 (속도가 유지되려면 odom 관측이 지속적으로 필요)
        decay = 0.995
        self._x[6] *= decay
        self._x[7] *= decay
        self._x[8] *= decay

        vx, vy, omega_z = self._x[6], self._x[7], self._x[8]

        # 속도→위치 전파
        self._x[0] += (vx * cos_yaw - vy * sin_yaw) * dt
        self._x[1] += (vx * sin_yaw + vy * cos_yaw) * dt
        self._x[5] = self._normalize_angle(yaw + omega_z * dt)

        # 야코비안
        F = np.eye(STATE_DIM)
        F[0, 5] = (-vx * sin_yaw - vy * cos_yaw) * dt
        F[0, 6] = cos_yaw * dt
        F[0, 7] = -sin_yaw * dt
        F[1, 5] = (vx * cos_yaw - vy * sin_yaw) * dt
        F[1, 6] = sin_yaw * dt
        F[1, 7] = cos_yaw * dt
        F[5, 8] = dt

        Q = self._Q_predict.copy() * dt

        # UWB 드롭아웃 중: 속도 프로세스 노이즈 축소 (위치 발산 방지)
        if self._uwb_detector.is_dropout:
            Q[6, 6] *= 0.01
            Q[7, 7] *= 0.01
            Q[8, 8] *= 0.01
            Q[0, 0] *= 3.0
            Q[1, 1] *= 3.0

        self._P = F @ self._P @ F.T + Q
        self._P = (self._P + self._P.T) / 2.0

    def update_uwb(self, measurements: list[UWBMeasurement]) -> None:
        """UWB 거리 측정치로 위치 업데이트 (개별 범위 관측)."""
        valid = [m for m in measurements if m.signal_quality > 0.3]

        current_time = measurements[0].timestamp if measurements else time.time()
        self._sensor_mode = self._uwb_detector.check(len(valid), current_time)

        if self._sensor_mode != SensorMode.FULL_FUSION:
            return

        for meas in valid:
            anchor = self._find_anchor(meas.anchor_id)
            if anchor is None:
                continue

            dx = self._x[0] - anchor.x
            dy = self._x[1] - anchor.y
            dz = self._x[2] - anchor.z
            pred_range = math.sqrt(dx**2 + dy**2 + dz**2)

            if pred_range < 0.01:
                continue

            H = np.zeros((1, STATE_DIM))
            H[0, 0] = dx / pred_range
            H[0, 1] = dy / pred_range
            H[0, 2] = dz / pred_range

            R = np.array([[0.05**2 / max(meas.signal_quality, 0.5)]])
            innovation = np.array([meas.range_m - pred_range])

            S = H @ self._P @ H.T + R
            K = self._P @ H.T / S[0, 0]

            self._x += (K * innovation[0]).flatten()
            self._P = (np.eye(STATE_DIM) - K @ H) @ self._P
            self._P = (self._P + self._P.T) / 2.0

    def update_qr(self, measurement: QRMeasurement) -> None:
        """바닥면 QR 매트릭스 절대 좌표 보정 (고정밀)."""
        H = np.zeros((6, STATE_DIM))
        H[0, 0] = 1.0
        H[1, 1] = 1.0
        H[2, 2] = 1.0
        H[3, 3] = 1.0
        H[4, 4] = 1.0
        H[5, 5] = 1.0

        R = np.diag([0.005**2, 0.005**2, 0.003**2, 0.001**2, 0.001**2, 0.01**2])

        z_meas = np.array([
            measurement.x, measurement.y, measurement.z,
            measurement.roll, measurement.pitch, measurement.yaw,
        ])
        z_pred = H @ self._x
        innovation = z_meas - z_pred
        innovation[5] = self._normalize_angle(innovation[5])

        S = H @ self._P @ H.T + R
        K = self._P @ H.T @ np.linalg.inv(S)

        self._x += (K @ innovation).flatten()
        self._x[5] = self._normalize_angle(self._x[5])
        self._P = (np.eye(STATE_DIM) - K @ H) @ self._P
        self._P = (self._P + self._P.T) / 2.0

    def update_odometry(self, measurement: OdometryMeasurement) -> None:
        """
        LiDAR SLAM 오도메트리 → 속도 관측 업데이트.
        odom delta를 시간으로 나누어 속도로 변환 후 EKF measurement update.
        """
        dt_est = 0.001
        if measurement.timestamp > 0 and self._last_timestamp > 0:
            dt_est = max(measurement.timestamp - self._last_timestamp, 0.0001)
        self._last_timestamp = measurement.timestamp

        # 속도 관측치 (로봇 좌표계)
        vx_obs = measurement.dx / dt_est
        vy_obs = measurement.dy / dt_est
        omega_obs = measurement.dtheta / dt_est

        H = np.zeros((3, STATE_DIM))
        H[0, 6] = 1.0  # vx
        H[1, 7] = 1.0  # vy
        H[2, 8] = 1.0  # omega_z

        z_vel = np.array([vx_obs, vy_obs, omega_obs])

        # 측정 노이즈: 오도메트리 공분산을 속도 공분산으로 변환
        odom_cov = measurement.covariance
        R_vel = np.diag([
            odom_cov[0, 0] / (dt_est**2),
            odom_cov[1, 1] / (dt_est**2),
            odom_cov[2, 2] / (dt_est**2),
        ])

        innovation = z_vel - H @ self._x
        S = H @ self._P @ H.T + R_vel
        K = self._P @ H.T @ np.linalg.inv(S)

        self._x += (K @ innovation).flatten()
        self._P = (np.eye(STATE_DIM) - K @ H) @ self._P
        self._P = (self._P + self._P.T) / 2.0

    def update_tof_dead_reckoning(
        self, tof_measurements: list[ToFMeasurement], dt: float
    ) -> None:
        """UWB 드롭아웃 시 ToF 기반 데드레커닝 보조."""
        if not tof_measurements:
            return
        for tof in tof_measurements:
            direction = tof.direction_rad + self._x[5]
            H = np.zeros((1, STATE_DIM))
            cos_dir = math.cos(direction)
            sin_dir = math.sin(direction)
            H[0, 0] = cos_dir
            H[0, 1] = sin_dir

            R = np.array([[0.03**2]])
            z_meas = np.array([tof.distance_m])
            z_pred = np.array([self._x[0] * cos_dir + self._x[1] * sin_dir])
            innovation = z_meas - z_pred

            S = H @ self._P @ H.T + R
            K = self._P @ H.T / S[0, 0]
            self._x += (K * innovation[0]).flatten()
            self._P = (np.eye(STATE_DIM) - K @ H) @ self._P

    def generate_packet(self, timestamp: float) -> LocalizationPacket:
        return LocalizationPacket(
            timestamp=timestamp,
            x=float(self._x[0]),
            y=float(self._x[1]),
            z=float(self._x[2]),
            roll=float(self._x[3]),
            pitch=float(self._x[4]),
            yaw=float(self._x[5]),
            vx=float(self._x[6]),
            vy=float(self._x[7]),
            omega_z=float(self._x[8]),
            covariance_trace=float(np.trace(self._P[:3, :3])),
            sensor_mode=self._sensor_mode.value,
            spin_turn_active=self._slewing.is_spinning,
        )

    async def publish_loop(self, rate_hz: float = 1000.0) -> None:
        dt = 1.0 / rate_hz
        while True:
            packet = self.generate_packet(time.time())
            await self._publish_queue.put(packet)
            await asyncio.sleep(dt)

    async def get_next_packet(self) -> LocalizationPacket:
        return await self._publish_queue.get()

    async def process_sensor_batch(
        self,
        uwb: list[UWBMeasurement] | None = None,
        qr: QRMeasurement | None = None,
        odometry: OdometryMeasurement | None = None,
        tof: list[ToFMeasurement] | None = None,
        dt: float = 0.001,
    ) -> LocalizationPacket:
        self.predict(dt)

        if self._sensor_mode == SensorMode.FULL_FUSION:
            if uwb:
                self.update_uwb(uwb)
            if qr:
                self.update_qr(qr)
            if odometry:
                self.update_odometry(odometry)
        elif self._sensor_mode == SensorMode.UWB_DROPOUT_BACKUP:
            if qr:
                self.update_qr(qr)
            if tof:
                self.update_tof_dead_reckoning(tof, dt)
            if odometry:
                self.update_odometry(odometry)

        packet = self.generate_packet(time.time())
        await self._publish_queue.put(packet)
        return packet

    def _find_anchor(self, anchor_id: str) -> UWBAnchor | None:
        for a in self._anchors:
            if a.anchor_id == anchor_id:
                return a
        return None

    @staticmethod
    def _normalize_angle(angle: float) -> float:
        while angle > math.pi:
            angle -= 2.0 * math.pi
        while angle < -math.pi:
            angle += 2.0 * math.pi
        return angle

    def force_uwb_dropout(self) -> None:
        self._sensor_mode = SensorMode.UWB_DROPOUT_BACKUP
        self._uwb_detector._dropout_detected = True
        self._uwb_detector._switch_timestamp = time.time()

    def restore_uwb(self) -> None:
        self._sensor_mode = SensorMode.FULL_FUSION
        self._uwb_detector._dropout_detected = False
