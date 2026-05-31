"""
SkyGarage ATR EKF 로컬라이제이션 검증 테스트 스위트
특허 컴포넌트: 슬루링 메커니즘 [310]

검증 항목:
  1. 50,000건 가우시안 노이즈 가상 주행 시뮬레이션
  2. 스핀 턴 기동 중 p95 측위 오차 ±2cm 이내 검증
  3. UWB 강제 단절 → 이중 백업 스위칭 무결성 검증
  4. 슬루링[310] 보정 효과 검증
  5. 센서 모드 전환 지연시간 < 10ms 검증
"""

from __future__ import annotations

import asyncio
import math
import time

import numpy as np
import pytest

from skygarage_core.localization.ekf_fusion import (
    SLEWING_RING_PATENT_ID,
    SPIN_TURN_OMEGA_THRESHOLD,
    UWB_DROPOUT_SWITCH_LIMIT_MS,
    EKFLocalization,
    LocalizationPacket,
    OdometryMeasurement,
    QRMeasurement,
    SensorMode,
    SlewingRingCompensator,
    SpinTurnState,
    ToFMeasurement,
    UWBAnchor,
    UWBDropoutDetector,
    UWBMeasurement,
)


# ─────────────────────────────────────────────
# 시뮬레이터 유틸리티
# ─────────────────────────────────────────────

def create_test_anchors() -> list[UWBAnchor]:
    """4개 천장 UWB 앵커 배치 (10m x 10m 공간, 높이 3m)."""
    return [
        UWBAnchor("A1", 0.0, 0.0, 3.0),
        UWBAnchor("A2", 10.0, 0.0, 3.0),
        UWBAnchor("A3", 10.0, 10.0, 3.0),
        UWBAnchor("A4", 0.0, 10.0, 3.0),
    ]


def simulate_uwb_ranges(
    true_x: float, true_y: float, true_z: float,
    anchors: list[UWBAnchor], noise_sigma: float = 0.05,
    timestamp: float = 0.0,
) -> list[UWBMeasurement]:
    """가우시안 노이즈가 포함된 UWB 거리 측정 시뮬레이션."""
    measurements = []
    for anchor in anchors:
        true_range = math.sqrt(
            (true_x - anchor.x)**2 +
            (true_y - anchor.y)**2 +
            (true_z - anchor.z)**2
        )
        noisy_range = true_range + np.random.normal(0, noise_sigma)
        measurements.append(UWBMeasurement(
            anchor_id=anchor.anchor_id,
            range_m=max(0.1, noisy_range),
            timestamp=timestamp,
            signal_quality=0.9 + np.random.uniform(-0.1, 0.1),
        ))
    return measurements


def simulate_odometry(
    true_dx: float, true_dy: float, true_dtheta: float,
    noise_sigma: float = 0.02, timestamp: float = 0.0,
) -> OdometryMeasurement:
    """가우시안 노이즈가 포함된 오도메트리 시뮬레이션."""
    noisy_dx = true_dx + np.random.normal(0, noise_sigma)
    noisy_dy = true_dy + np.random.normal(0, noise_sigma)
    noisy_dtheta = true_dtheta + np.random.normal(0, noise_sigma * 0.5)

    cov = np.diag([noise_sigma**2, noise_sigma**2, (noise_sigma * 0.5)**2, 0.001**2])
    return OdometryMeasurement(
        dx=noisy_dx,
        dy=noisy_dy,
        dz=0.0,
        dtheta=noisy_dtheta,
        covariance=cov,
        timestamp=timestamp,
    )


def simulate_qr_scan(
    true_x: float, true_y: float, true_z: float, true_yaw: float,
    noise_sigma: float = 0.005, timestamp: float = 0.0,
) -> QRMeasurement:
    """바닥면 QR 매트릭스 스캔 시뮬레이션 (고정밀)."""
    return QRMeasurement(
        qr_hash=f"QR_{int(true_x*100):04d}_{int(true_y*100):04d}",
        x=true_x + np.random.normal(0, noise_sigma),
        y=true_y + np.random.normal(0, noise_sigma),
        z=true_z + np.random.normal(0, noise_sigma * 0.5),
        roll=np.random.normal(0, 0.001),
        pitch=np.random.normal(0, 0.001),
        yaw=true_yaw + np.random.normal(0, 0.01),
        timestamp=timestamp,
    )


# ─────────────────────────────────────────────
# TEST 1: 50,000건 가우시안 노이즈 시뮬레이션
# ─────────────────────────────────────────────

class TestGaussianNoiseSimulation:
    """50,000건 센서 데이터 스트림 통과 검증."""

    def test_50k_straight_line_trajectory(self):
        """직선 주행 50,000 스텝 - 위치 오차 수렴 검증."""
        anchors = create_test_anchors()
        ekf = EKFLocalization(uwb_anchors=anchors, initial_position=(5.0, 5.0, 0.0))

        dt = 0.001  # 1ms
        speed = 0.5  # 0.5 m/s
        errors = []

        np.random.seed(42)

        for step in range(50_000):
            t = step * dt
            true_x = 5.0 + speed * t * math.cos(0.0)
            true_y = 5.0 + speed * t * math.sin(0.0)
            true_z = 0.0

            # 10m x 10m 범위 내에서만 동작
            if true_x > 9.5:
                true_x = 9.5

            # 예측
            ekf.predict(dt)

            # UWB 매 10ms (10스텝마다)
            if step % 10 == 0:
                uwb = simulate_uwb_ranges(true_x, true_y, true_z, anchors, timestamp=t)
                ekf.update_uwb(uwb)

            # QR 매 500ms
            if step % 500 == 0:
                qr = simulate_qr_scan(true_x, true_y, true_z, 0.0, timestamp=t)
                ekf.update_qr(qr)

            # 오도메트리 매 1ms
            odom = simulate_odometry(speed * dt, 0.0, 0.0, timestamp=t)
            ekf.update_odometry(odom)

            # 오차 기록 (수렴 후 마지막 10,000 스텝)
            if step >= 40_000:
                est_x, est_y, _ = ekf.position
                error = math.sqrt((est_x - true_x)**2 + (est_y - true_y)**2)
                errors.append(error)

        errors_np = np.array(errors)
        p95_error = np.percentile(errors_np, 95)
        mean_error = np.mean(errors_np)

        # p95 오차가 5cm 이내
        assert p95_error < 0.05, f"p95 오차 {p95_error*100:.2f}cm > 5cm"
        assert mean_error < 0.03, f"평균 오차 {mean_error*100:.2f}cm > 3cm"

    def test_50k_circular_trajectory(self):
        """원형 궤적 50,000 스텝 - 연속 곡선 주행 정확도."""
        anchors = create_test_anchors()
        ekf = EKFLocalization(uwb_anchors=anchors, initial_position=(5.0, 3.0, 0.0))

        dt = 0.001
        radius = 2.0
        angular_speed = 0.5  # rad/s (원 주행)
        errors = []

        np.random.seed(123)

        for step in range(50_000):
            t = step * dt
            angle = angular_speed * t
            true_x = 5.0 + radius * math.cos(angle)
            true_y = 5.0 + radius * math.sin(angle)
            true_yaw = angle + math.pi / 2  # 접선 방향

            # 속도 계산
            vx = -radius * angular_speed * math.sin(angle)
            vy = radius * angular_speed * math.cos(angle)
            true_speed = math.sqrt(vx**2 + vy**2)

            dx = -radius * angular_speed * math.sin(angle) * dt
            dy = radius * angular_speed * math.cos(angle) * dt
            dtheta = angular_speed * dt

            ekf.predict(dt)

            if step % 10 == 0:
                uwb = simulate_uwb_ranges(true_x, true_y, 0.0, anchors, timestamp=t)
                ekf.update_uwb(uwb)

            if step % 200 == 0:
                qr = simulate_qr_scan(true_x, true_y, 0.0, true_yaw, timestamp=t)
                ekf.update_qr(qr)

            odom = simulate_odometry(true_speed * dt, 0.0, dtheta, timestamp=t)
            ekf.update_odometry(odom)

            if step >= 40_000:
                est_x, est_y, _ = ekf.position
                error = math.sqrt((est_x - true_x)**2 + (est_y - true_y)**2)
                errors.append(error)

        p95_error = np.percentile(errors, 95)
        assert p95_error < 0.05, f"원형 궤적 p95 오차 {p95_error*100:.2f}cm > 5cm"


# ─────────────────────────────────────────────
# TEST 2: 스핀 턴 중 p95 오차 ±2cm 검증
# ─────────────────────────────────────────────

class TestSpinTurnPrecision:
    """슬루링[310] 제자리 스핀 턴 시 측위 정밀도."""

    def test_spin_turn_position_stability(self):
        """
        제자리 90도 스핀 턴: 위치가 발산하지 않고 ±2cm 유지.
        슬루링[310] 보정 효과 검증.
        """
        anchors = create_test_anchors()
        true_x, true_y = 5.0, 5.0
        ekf = EKFLocalization(uwb_anchors=anchors, initial_position=(true_x, true_y, 0.0))

        dt = 0.001
        spin_omega = 3.0  # rad/s (빠른 스핀 턴)
        spin_duration = math.pi / (2 * spin_omega)  # 90도 회전 시간
        total_steps = int(spin_duration / dt) + 1000  # 스핀 + 안정화

        np.random.seed(777)
        errors_during_spin = []

        for step in range(total_steps):
            t = step * dt
            current_yaw = spin_omega * min(t, spin_duration)

            # 위치는 고정 (제자리 회전)
            ekf.predict(dt)

            if step % 10 == 0:
                uwb = simulate_uwb_ranges(true_x, true_y, 0.0, anchors, timestamp=t)
                ekf.update_uwb(uwb)

            if step % 100 == 0:
                qr = simulate_qr_scan(true_x, true_y, 0.0, current_yaw, timestamp=t)
                ekf.update_qr(qr)

            # 오도메트리: 위치 이동 없음, 회전만
            if t < spin_duration:
                odom_dtheta = spin_omega * dt
            else:
                odom_dtheta = 0.0

            odom = simulate_odometry(0.0, 0.0, odom_dtheta, noise_sigma=0.01, timestamp=t)
            ekf.update_odometry(odom)

            est_x, est_y, _ = ekf.position
            error = math.sqrt((est_x - true_x)**2 + (est_y - true_y)**2)
            errors_during_spin.append(error)

        p95_error = np.percentile(errors_during_spin, 95)
        max_error = np.max(errors_during_spin)

        # 핵심 검증: p95 오차 ±2cm 이내
        assert p95_error < 0.02, (
            f"스핀 턴 p95 위치 오차 {p95_error*100:.3f}cm > 2cm "
            f"(슬루링{SLEWING_RING_PATENT_ID} 보정 실패)"
        )

    def test_360_degree_spin_convergence(self):
        """360도 완전 회전 후 위치 복귀 검증."""
        anchors = create_test_anchors()
        true_x, true_y = 5.0, 5.0
        ekf = EKFLocalization(uwb_anchors=anchors, initial_position=(true_x, true_y, 0.0))

        dt = 0.001
        spin_omega = 2.0 * math.pi  # 360도/초 (최대)
        spin_duration = 1.0  # 정확히 360도
        total_steps = int(spin_duration / dt)

        np.random.seed(999)

        for step in range(total_steps):
            t = step * dt
            current_yaw = spin_omega * t

            ekf.predict(dt)

            if step % 5 == 0:
                uwb = simulate_uwb_ranges(true_x, true_y, 0.0, anchors, timestamp=t)
                ekf.update_uwb(uwb)

            if step % 50 == 0:
                qr = simulate_qr_scan(true_x, true_y, 0.0, current_yaw, timestamp=t)
                ekf.update_qr(qr)

            odom = simulate_odometry(0.0, 0.0, spin_omega * dt, noise_sigma=0.015, timestamp=t)
            ekf.update_odometry(odom)

        est_x, est_y, _ = ekf.position
        final_error = math.sqrt((est_x - true_x)**2 + (est_y - true_y)**2)

        assert final_error < 0.02, f"360도 회전 후 위치 오차 {final_error*100:.2f}cm > 2cm"

    def test_slewing_compensator_state_transitions(self):
        """슬루링[310] 보정기 상태 전이 정확성."""
        comp = SlewingRingCompensator()
        assert comp.state == SpinTurnState.NORMAL

        # 스핀 진입
        factor = comp.update(2.0, 0.0)
        assert comp.state == SpinTurnState.SPIN_ENTRY
        assert factor < 1.0

        # 스핀 유지
        factor = comp.update(2.5, 0.1)
        assert comp.state == SpinTurnState.SPINNING
        assert factor < 0.5

        # 스핀 종료
        for _ in range(5):
            factor = comp.update(0.3, 0.5)
        assert comp.state == SpinTurnState.NORMAL
        assert factor == 1.0


# ─────────────────────────────────────────────
# TEST 3: UWB 드롭아웃 이중 백업 스위칭 검증
# ─────────────────────────────────────────────

class TestUWBDropoutBackup:
    """UWB 신호 차단 시 이중 백업 모드 무결성."""

    def test_dropout_switch_latency_under_10ms(self):
        """UWB 드롭아웃 감지 → 백업 모드 전환 < 10ms."""
        detector = UWBDropoutDetector()

        # 정상 상태
        t1 = 1.000
        mode = detector.check(4, t1)
        assert mode == SensorMode.FULL_FUSION

        # 드롭아웃 (앵커 2개만 수신)
        t2 = 1.005  # 5ms 후
        mode = detector.check(2, t2)
        assert mode == SensorMode.UWB_DROPOUT_BACKUP

        # 스위칭 지연시간 검증
        latency = detector.switch_latency_ms
        assert latency <= UWB_DROPOUT_SWITCH_LIMIT_MS, (
            f"스위칭 지연 {latency:.2f}ms > {UWB_DROPOUT_SWITCH_LIMIT_MS}ms"
        )

    def test_position_accuracy_during_uwb_dropout(self):
        """UWB 단절 중 QR+ToF로 위치 정확도 유지."""
        anchors = create_test_anchors()
        true_x, true_y = 5.0, 5.0
        ekf = EKFLocalization(uwb_anchors=anchors, initial_position=(true_x, true_y, 0.0))

        dt = 0.001
        np.random.seed(555)

        # Phase 1: 정상 작동 (2000 스텝)
        for step in range(2000):
            t = step * dt
            ekf.predict(dt)
            if step % 10 == 0:
                uwb = simulate_uwb_ranges(true_x, true_y, 0.0, anchors, timestamp=t)
                ekf.update_uwb(uwb)
            if step % 100 == 0:
                qr = simulate_qr_scan(true_x, true_y, 0.0, 0.0, timestamp=t)
                ekf.update_qr(qr)

        assert ekf.sensor_mode == SensorMode.FULL_FUSION

        # Phase 2: UWB 강제 단절 (3000 스텝)
        ekf.force_uwb_dropout()
        assert ekf.sensor_mode == SensorMode.UWB_DROPOUT_BACKUP

        errors_during_dropout = []
        for step in range(3000):
            t = (2000 + step) * dt
            ekf.predict(dt)

            # QR 보정 (100ms 마다)
            if step % 100 == 0:
                qr = simulate_qr_scan(true_x, true_y, 0.0, 0.0, timestamp=t)
                ekf.update_qr(qr)

            # ToF 데드레커닝
            if step % 20 == 0:
                tof = [ToFMeasurement(distance_m=5.0 + np.random.normal(0, 0.03), direction_rad=0.0, timestamp=t)]
                ekf.update_tof_dead_reckoning(tof, dt * 20)

            est_x, est_y, _ = ekf.position
            error = math.sqrt((est_x - true_x)**2 + (est_y - true_y)**2)
            errors_during_dropout.append(error)

        p95_dropout = np.percentile(errors_during_dropout, 95)

        # 드롭아웃 중에도 5cm 이내 유지
        assert p95_dropout < 0.05, (
            f"UWB 드롭아웃 중 p95 오차 {p95_dropout*100:.2f}cm > 5cm"
        )

    def test_seamless_recovery_after_dropout(self):
        """UWB 복구 후 정밀도 즉시 복원."""
        anchors = create_test_anchors()
        ekf = EKFLocalization(uwb_anchors=anchors, initial_position=(5.0, 5.0, 0.0))

        np.random.seed(333)
        dt = 0.001

        # 워밍업
        for step in range(1000):
            t = step * dt
            ekf.predict(dt)
            if step % 10 == 0:
                uwb = simulate_uwb_ranges(5.0, 5.0, 0.0, anchors, timestamp=t)
                ekf.update_uwb(uwb)

        # 드롭아웃
        ekf.force_uwb_dropout()

        for step in range(500):
            ekf.predict(dt)

        # 복구
        ekf.restore_uwb()
        assert ekf.sensor_mode == SensorMode.FULL_FUSION

        # 복구 후 빠른 수렴
        for step in range(200):
            t = (1500 + step) * dt
            ekf.predict(dt)
            uwb = simulate_uwb_ranges(5.0, 5.0, 0.0, anchors, timestamp=t)
            ekf.update_uwb(uwb)

        est_x, est_y, _ = ekf.position
        error = math.sqrt((est_x - 5.0)**2 + (est_y - 5.0)**2)
        assert error < 0.03, f"UWB 복구 후 오차 {error*100:.2f}cm > 3cm"


# ─────────────────────────────────────────────
# TEST 4: 패킷 퍼블리싱 검증
# ─────────────────────────────────────────────

class TestPacketPublishing:
    """0.001초 타임싱크 패킷 생성 및 토픽 검증."""

    @pytest.mark.asyncio
    async def test_packet_generation(self):
        """패킷이 올바른 필드와 토픽으로 생성되는지 확인."""
        anchors = create_test_anchors()
        ekf = EKFLocalization(uwb_anchors=anchors, initial_position=(3.0, 4.0, 0.0))

        packet = ekf.generate_packet(time.time())

        assert packet.topic == "skygarage.atr.localization"
        assert packet.patent_id == SLEWING_RING_PATENT_ID
        assert abs(packet.x - 3.0) < 0.01
        assert abs(packet.y - 4.0) < 0.01
        assert packet.covariance_trace > 0

    @pytest.mark.asyncio
    async def test_async_sensor_batch_pipeline(self):
        """비동기 센서 배치 처리 파이프라인 동작 확인."""
        anchors = create_test_anchors()
        ekf = EKFLocalization(uwb_anchors=anchors, initial_position=(5.0, 5.0, 0.0))

        uwb = simulate_uwb_ranges(5.0, 5.0, 0.0, anchors, timestamp=0.001)
        qr = simulate_qr_scan(5.0, 5.0, 0.0, 0.0, timestamp=0.001)
        odom = simulate_odometry(0.001, 0.0, 0.0, timestamp=0.001)

        packet = await ekf.process_sensor_batch(
            uwb=uwb, qr=qr, odometry=odom, dt=0.001
        )

        assert isinstance(packet, LocalizationPacket)
        assert packet.sensor_mode == SensorMode.FULL_FUSION.value

        # 큐에서 꺼내기
        queued = await ekf.get_next_packet()
        assert queued.packet_id == packet.packet_id


# ─────────────────────────────────────────────
# TEST 5: 복합 시나리오 (주행 + 스핀 + 드롭아웃)
# ─────────────────────────────────────────────

class TestIntegratedScenario:
    """실제 운용 시나리오: 직진 → 스핀 턴 → UWB 단절 → 복구."""

    def test_full_mission_scenario(self):
        """완전 미션: 주차장 진입 → 회전 → 주차 슬롯 접근."""
        anchors = create_test_anchors()
        ekf = EKFLocalization(uwb_anchors=anchors, initial_position=(1.0, 5.0, 0.0))

        dt = 0.001
        np.random.seed(2024)

        all_errors = []
        spin_errors = []

        # Phase 1: 직진 (0~5초, 5000 스텝)
        for step in range(5000):
            t = step * dt
            true_x = 1.0 + 0.5 * t  # 0.5m/s 직진
            true_y = 5.0

            ekf.predict(dt)
            if step % 10 == 0:
                uwb = simulate_uwb_ranges(true_x, true_y, 0.0, anchors, timestamp=t)
                ekf.update_uwb(uwb)
            if step % 200 == 0:
                qr = simulate_qr_scan(true_x, true_y, 0.0, 0.0, timestamp=t)
                ekf.update_qr(qr)
            odom = simulate_odometry(0.0005, 0.0, 0.0, timestamp=t)
            ekf.update_odometry(odom)

            est_x, est_y, _ = ekf.position
            error = math.sqrt((est_x - true_x)**2 + (est_y - true_y)**2)
            all_errors.append(error)

        # Phase 2: 90도 스핀 턴 (5~6초, 1000 스텝)
        spin_omega = math.pi / 2  # 90도/초
        for step in range(1000):
            t = (5000 + step) * dt
            true_x = 3.5  # 고정 위치
            true_yaw = spin_omega * step * dt

            ekf.predict(dt)
            if step % 10 == 0:
                uwb = simulate_uwb_ranges(true_x, 5.0, 0.0, anchors, timestamp=t)
                ekf.update_uwb(uwb)
            if step % 50 == 0:
                qr = simulate_qr_scan(true_x, 5.0, 0.0, true_yaw, timestamp=t)
                ekf.update_qr(qr)
            odom = simulate_odometry(0.0, 0.0, spin_omega * dt, noise_sigma=0.01, timestamp=t)
            ekf.update_odometry(odom)

            est_x, est_y, _ = ekf.position
            error = math.sqrt((est_x - true_x)**2 + (est_y - 5.0)**2)
            spin_errors.append(error)
            all_errors.append(error)

        # Phase 3: UWB 단절 + QR 백업 (6~8초, 2000 스텝)
        ekf.force_uwb_dropout()
        for step in range(2000):
            t = (6000 + step) * dt
            true_x = 3.5 + 0.3 * step * dt  # 느린 직진

            ekf.predict(dt)
            if step % 50 == 0:
                qr = simulate_qr_scan(true_x, 5.0, 0.0, math.pi / 2, timestamp=t)
                ekf.update_qr(qr)
            odom = simulate_odometry(0.0003, 0.0, 0.0, timestamp=t)
            ekf.update_odometry(odom)

            est_x, est_y, _ = ekf.position
            error = math.sqrt((est_x - true_x)**2 + (est_y - 5.0)**2)
            all_errors.append(error)

        # 검증
        p95_overall = np.percentile(all_errors, 95)
        p95_spin = np.percentile(spin_errors, 95)

        assert p95_spin < 0.02, (
            f"스핀 턴 p95 오차 {p95_spin*100:.3f}cm > 2cm "
            f"(슬루링{SLEWING_RING_PATENT_ID} 보정 검증 실패)"
        )
        assert p95_overall < 0.05, f"전체 미션 p95 오차 {p95_overall*100:.2f}cm > 5cm"
