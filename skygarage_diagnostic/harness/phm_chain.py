"""
SkyGarage 하네스 예지보전(PHM) 커널 데몬
Harness Prognostics & Health Management Chain Kernel

특허 컴포넌트 참조:
  [132] 인터록 즉시 트리거 플래그 - 비상 제어 플래그
  [270] 비상 전기 기계식 브레이크 - 최종 물리 정지
  [271] 주행 구동 모터 STO(Safe Torque Off) - 토크 물리 차단
  [272] 안전 릴레이 회로 차단 - 고전압 배터리/도크 릴레이 드롭아웃
  [660] 거버넌스 레지스트리 - 중앙 정책 데이터베이스 장애 로그 기록
  [710] 충전 도크 연결 릴레이
  [720] 에지 백업 배터리 모듈 A
  [721] 에지 백업 배터리 모듈 B

서브시스템 구성:
  1. ImpedanceTracker - 하네스 마디별 저항/임피던스 실시간 비동기 센싱
  2. GaussianProcessRUL - GPR 기반 잔여수명(RUL) 및 고장확률밀도 연산
  3. SafetyChainExecutor - 4단계 원자적 하드웨어 안전 인터록 시퀀스
  4. PHMKernelDaemon - 통합 예지보전 데몬 (백그라운드 스레드 구동)

설계 사상:
  - 완전 무인 자동화: 인간 수동 개입 불가
  - 비상 대피는 ATR 에지 백업 배터리[720][721] 잔여 전력 활용 자율 분산 분기
  - 중앙 관제 서버 패킷 대기 없이 에지에서 직접 하드웨어 차단
"""

from __future__ import annotations

import math
import threading
import time
import uuid
from collections import deque
from dataclasses import dataclass, field
from enum import Enum
from typing import Callable, Optional


# ─────────────────────────────────────────────
# 특허 컴포넌트 식별 부호
# ─────────────────────────────────────────────

PATENT_INTERLOCK_FLAG = "[132]"
PATENT_EMERGENCY_BRAKE = "[270]"
PATENT_MOTOR_STO = "[271]"
PATENT_BATTERY_RELAY = "[272]"
PATENT_GOVERNANCE_MDM = "[660]"
PATENT_CHARGING_DOCK = "[710]"
PATENT_BACKUP_BATTERY_A = "[720]"
PATENT_BACKUP_BATTERY_B = "[721]"

# 안전 임계치 상수
RESISTANCE_SAFETY_THRESHOLD_OHM = 1.5
RESISTANCE_CRITICAL_THRESHOLD_OHM = 2.5
OPEN_CIRCUIT_THRESHOLD_OHM = 100.0
INTERLOCK_DEADLINE_MS = 100.0


# ─────────────────────────────────────────────
# 열거형
# ─────────────────────────────────────────────

class HarnessState(Enum):
    NOMINAL = "nominal"
    DEGRADED = "degraded"
    CRITICAL = "critical"
    FAULT = "fault"
    EMERGENCY_STOP = "emergency_stop"


class InterlockStage(Enum):
    IDLE = "idle"
    STAGE_1_FLAG = "stage_1_interlock_flag_132"
    STAGE_2_STO = "stage_2_motor_sto_271"
    STAGE_3_RELAY = "stage_3_battery_relay_272"
    STAGE_4_BRAKE = "stage_4_emergency_brake_270"
    COMPLETED = "completed"


class FaultType(Enum):
    IMPEDANCE_EXCEEDED = "impedance_exceeded"
    OPEN_CIRCUIT = "open_circuit"
    VOLTAGE_DROP_ANOMALY = "voltage_drop_anomaly"
    EMI_NOISE_FAULT = "emi_noise_fault"
    CONNECTOR_FATIGUE = "connector_fatigue"


# ─────────────────────────────────────────────
# 데이터 클래스
# ─────────────────────────────────────────────

@dataclass(frozen=True)
class ImpedanceSample:
    node_id: str
    resistance_ohm: float
    voltage_drop_mv: float
    current_ma: float
    timestamp_ms: float
    temperature_c: float = 25.0


@dataclass(frozen=True)
class RULPrediction:
    node_id: str
    rul_hours: float
    failure_probability: float
    confidence_interval_low: float
    confidence_interval_high: float
    predicted_at_ms: float


@dataclass
class FaultEvent:
    fault_id: str = field(default_factory=lambda: str(uuid.uuid4()))
    fault_type: FaultType = FaultType.IMPEDANCE_EXCEEDED
    node_id: str = ""
    measured_resistance_ohm: float = 0.0
    threshold_ohm: float = RESISTANCE_SAFETY_THRESHOLD_OHM
    timestamp_ms: float = 0.0
    detail: str = ""


@dataclass
class InterlockRecord:
    stage: InterlockStage = InterlockStage.IDLE
    patent_component: str = ""
    executed_at_ms: float = 0.0
    success: bool = False
    detail: str = ""


@dataclass
class GovernanceLogEntry:
    """중앙 정책 데이터베이스[660] 기록용 장애 로그"""
    log_id: str = field(default_factory=lambda: str(uuid.uuid4()))
    fault_event: Optional[FaultEvent] = None
    interlock_records: list[InterlockRecord] = field(default_factory=list)
    total_interlock_duration_ms: float = 0.0
    atr_id: str = ""
    governance_registry: str = PATENT_GOVERNANCE_MDM
    recorded_at_ms: float = 0.0
    autonomous_evacuation_mode: str = "edge_battery_distributed_branch"


# ─────────────────────────────────────────────
# 예외 클래스
# ─────────────────────────────────────────────

class HarnessFaultException(Exception):
    def __init__(self, fault: FaultEvent):
        self.fault = fault
        super().__init__(
            f"Harness fault [{fault.fault_type.value}] at node {fault.node_id}: "
            f"{fault.measured_resistance_ohm:.3f}Ω > {fault.threshold_ohm}Ω"
        )


# ─────────────────────────────────────────────
# 1. 가우시안 프로세스 회귀 RUL 예측기
# ─────────────────────────────────────────────

class GaussianProcessRUL:
    """
    가우시안 프로세스 회귀(GPR) 기반 하네스 잔여수명(RUL) 연산.

    커넥터 노드의 시계열 저항 프로파일로부터:
    - RUL(잔여 시간) 예측
    - 고장 확률 밀도 함수 추정
    - 신뢰 구간(95%) 산출

    GPR 커널: RBF + White Noise (간소화 근사 구현)
    """

    def __init__(
        self,
        length_scale: float = 1.0,
        signal_variance: float = 1.0,
        noise_variance: float = 0.01,
        failure_threshold_ohm: float = RESISTANCE_SAFETY_THRESHOLD_OHM,
    ) -> None:
        self._length_scale = length_scale
        self._signal_variance = signal_variance
        self._noise_variance = noise_variance
        self._failure_threshold = failure_threshold_ohm
        self._history: dict[str, deque[ImpedanceSample]] = {}
        self._max_history = 200

    def ingest(self, sample: ImpedanceSample) -> None:
        if sample.node_id not in self._history:
            self._history[sample.node_id] = deque(maxlen=self._max_history)
        self._history[sample.node_id].append(sample)

    def predict_rul(self, node_id: str, current_time_ms: float) -> RULPrediction:
        history = self._history.get(node_id)
        if not history or len(history) < 2:
            return RULPrediction(
                node_id=node_id,
                rul_hours=float("inf"),
                failure_probability=0.0,
                confidence_interval_low=0.0,
                confidence_interval_high=float("inf"),
                predicted_at_ms=current_time_ms,
            )

        samples = list(history)
        n = len(samples)

        # 시계열 저항 변화율 추정 (선형 추세 + GPR 보정)
        t_vals = [(s.timestamp_ms - samples[0].timestamp_ms) / 3600000.0
                  for s in samples]
        r_vals = [s.resistance_ohm for s in samples]

        # 선형 회귀로 추세 추출
        t_mean = sum(t_vals) / n
        r_mean = sum(r_vals) / n
        numerator = sum((t - t_mean) * (r - r_mean) for t, r in zip(t_vals, r_vals))
        denominator = sum((t - t_mean) ** 2 for t in t_vals)

        if denominator < 1e-12:
            slope = 0.0
        else:
            slope = numerator / denominator

        current_r = r_vals[-1]
        remaining_margin = self._failure_threshold - current_r

        # RUL 추정: 현재 추세 기반
        if slope <= 0:
            rul_hours = float("inf")
            failure_prob = 0.0
        else:
            rul_hours = max(0.0, remaining_margin / slope)
            # GPR 기반 불확실성 (RBF 커널 분산 근사)
            residuals = [r - (r_mean + slope * (t - t_mean))
                         for t, r in zip(t_vals, r_vals)]
            variance = sum(res ** 2 for res in residuals) / max(n - 2, 1)
            std_dev = math.sqrt(variance + self._noise_variance)

            # 고장 확률: 현재 저항이 임계치에 얼마나 가까운지
            if remaining_margin <= 0:
                failure_prob = 1.0
            else:
                z_score = remaining_margin / max(std_dev, 1e-9)
                failure_prob = max(0.0, min(1.0, 1.0 - 0.5 * (1 + math.erf(
                    z_score / math.sqrt(2)
                ))))

        # 95% 신뢰 구간
        if slope > 0:
            residuals_sq = sum(
                (r - (r_mean + slope * (t - t_mean))) ** 2
                for t, r in zip(t_vals, r_vals)
            ) / max(n - 2, 1)
            rul_std = math.sqrt(residuals_sq) / max(slope, 1e-9)
            ci_low = max(0.0, rul_hours - 1.96 * rul_std)
            ci_high = rul_hours + 1.96 * rul_std
        else:
            ci_low = 0.0
            ci_high = float("inf")

        return RULPrediction(
            node_id=node_id,
            rul_hours=rul_hours,
            failure_probability=failure_prob,
            confidence_interval_low=ci_low,
            confidence_interval_high=ci_high,
            predicted_at_ms=current_time_ms,
        )

    def get_node_history_length(self, node_id: str) -> int:
        return len(self._history.get(node_id, []))

    def get_latest_resistance(self, node_id: str) -> float:
        history = self._history.get(node_id)
        if not history:
            return 0.0
        return history[-1].resistance_ohm


# ─────────────────────────────────────────────
# 2. 4단계 원자적 하드웨어 안전 인터록 시퀀스
# ─────────────────────────────────────────────

class SafetyChainExecutor:
    """
    4단계 고속 안전 체인 (Atomic Interlock Sequence).

    중앙 관제 서버 패킷 대기 없이 에지에서 직접 실행.
    비상 대피는 ATR 에지 백업 배터리[720][721] 잔여 전력으로 자율 분산 분기.

    프로토콜:
      Stage 1: [132] 인터록 플래그 메모리 최상위 Set
      Stage 2: [271] 모터 STO(Safe Torque Off) 토크 차단
      Stage 3: [272] 고전압 배터리[720][721] + 충전 도크[710] 릴레이 드롭아웃
      Stage 4: [270] 비상 전기 기계식 브레이크 락
    """

    def __init__(self) -> None:
        self._lock = threading.Lock()
        self._current_stage = InterlockStage.IDLE
        self._interlock_active = False
        self._records: list[InterlockRecord] = []
        self._total_duration_ms = 0.0

        # 하드웨어 스텁 콜백 (테스트 시 교체 가능)
        self._hw_flag_132: Callable[[], bool] = self._default_flag_132
        self._hw_sto_271: Callable[[], bool] = self._default_sto_271
        self._hw_relay_272: Callable[[], bool] = self._default_relay_272
        self._hw_brake_270: Callable[[], bool] = self._default_brake_270

    @property
    def current_stage(self) -> InterlockStage:
        return self._current_stage

    @property
    def interlock_active(self) -> bool:
        return self._interlock_active

    @property
    def records(self) -> list[InterlockRecord]:
        return list(self._records)

    @property
    def total_duration_ms(self) -> float:
        return self._total_duration_ms

    def execute_full_chain(self, fault: FaultEvent) -> list[InterlockRecord]:
        """
        4단계 안전 체인을 원자적으로 실행합니다.
        중앙 서버 대기 없이 에지에서 즉각 실행.

        Returns:
            4개 단계의 실행 기록 리스트
        """
        with self._lock:
            chain_start = time.perf_counter_ns()
            self._records = []
            self._interlock_active = True

            # Stage 1: [132] 인터록 플래그 활성화
            self._current_stage = InterlockStage.STAGE_1_FLAG
            stage1_time = time.perf_counter_ns()
            success_1 = self._hw_flag_132()
            self._records.append(InterlockRecord(
                stage=InterlockStage.STAGE_1_FLAG,
                patent_component=PATENT_INTERLOCK_FLAG,
                executed_at_ms=(stage1_time - chain_start) / 1_000_000,
                success=success_1,
                detail=f"{PATENT_INTERLOCK_FLAG} Emergency interlock flag SET in top memory",
            ))

            # Stage 2: [271] 모터 STO 토크 차단
            self._current_stage = InterlockStage.STAGE_2_STO
            stage2_time = time.perf_counter_ns()
            success_2 = self._hw_sto_271()
            self._records.append(InterlockRecord(
                stage=InterlockStage.STAGE_2_STO,
                patent_component=PATENT_MOTOR_STO,
                executed_at_ms=(stage2_time - chain_start) / 1_000_000,
                success=success_2,
                detail=f"{PATENT_MOTOR_STO} Drive motor Safe Torque Off engaged",
            ))

            # Stage 3: [272] 배터리[720][721] + 충전 도크[710] 릴레이 드롭아웃
            self._current_stage = InterlockStage.STAGE_3_RELAY
            stage3_time = time.perf_counter_ns()
            success_3 = self._hw_relay_272()
            self._records.append(InterlockRecord(
                stage=InterlockStage.STAGE_3_RELAY,
                patent_component=PATENT_BATTERY_RELAY,
                executed_at_ms=(stage3_time - chain_start) / 1_000_000,
                success=success_3,
                detail=(
                    f"{PATENT_BATTERY_RELAY} HV battery {PATENT_BACKUP_BATTERY_A}"
                    f"{PATENT_BACKUP_BATTERY_B} and dock {PATENT_CHARGING_DOCK} "
                    f"relay forced drop-out"
                ),
            ))

            # Stage 4: [270] 비상 기계식 브레이크 잠금
            self._current_stage = InterlockStage.STAGE_4_BRAKE
            stage4_time = time.perf_counter_ns()
            success_4 = self._hw_brake_270()
            chain_end = time.perf_counter_ns()
            self._records.append(InterlockRecord(
                stage=InterlockStage.STAGE_4_BRAKE,
                patent_component=PATENT_EMERGENCY_BRAKE,
                executed_at_ms=(stage4_time - chain_start) / 1_000_000,
                success=success_4,
                detail=f"{PATENT_EMERGENCY_BRAKE} Emergency mechanical brake LOCKED",
            ))

            self._current_stage = InterlockStage.COMPLETED
            self._total_duration_ms = (chain_end - chain_start) / 1_000_000

            return list(self._records)

    # 하드웨어 스텁 기본 구현 (실제 하드웨어 연동 시 교체)
    def _default_flag_132(self) -> bool:
        return True

    def _default_sto_271(self) -> bool:
        return True

    def _default_relay_272(self) -> bool:
        return True

    def _default_brake_270(self) -> bool:
        return True


# ─────────────────────────────────────────────
# 3. 임피던스 추적기 (비동기 파이프라이닝)
# ─────────────────────────────────────────────

class ImpedanceTracker:
    """
    하네스 마디별 전압 강하량 및 전류 임피던스 센싱 피드를
    비동기 파이프라이닝하여 실시간 추적하는 모듈.

    저항값 임계치 초과 시 즉각 폴트 이벤트 발생.
    """

    def __init__(
        self,
        safety_threshold_ohm: float = RESISTANCE_SAFETY_THRESHOLD_OHM,
        critical_threshold_ohm: float = RESISTANCE_CRITICAL_THRESHOLD_OHM,
    ) -> None:
        self._safety_threshold = safety_threshold_ohm
        self._critical_threshold = critical_threshold_ohm
        self._lock = threading.Lock()
        self._latest: dict[str, ImpedanceSample] = {}
        self._fault_callbacks: list[Callable[[FaultEvent], None]] = []
        self._sample_count = 0

    @property
    def safety_threshold(self) -> float:
        return self._safety_threshold

    @property
    def sample_count(self) -> int:
        with self._lock:
            return self._sample_count

    def register_fault_callback(self, cb: Callable[[FaultEvent], None]) -> None:
        self._fault_callbacks.append(cb)

    def ingest_sample(self, sample: ImpedanceSample) -> Optional[FaultEvent]:
        """
        센서 샘플을 수신하고 임계치 검사를 수행합니다.

        Returns:
            폴트 감지 시 FaultEvent, 정상이면 None
        """
        with self._lock:
            self._latest[sample.node_id] = sample
            self._sample_count += 1

        fault = self._check_thresholds(sample)
        if fault is not None:
            for cb in self._fault_callbacks:
                cb(fault)
        return fault

    def _check_thresholds(self, sample: ImpedanceSample) -> Optional[FaultEvent]:
        if sample.resistance_ohm >= OPEN_CIRCUIT_THRESHOLD_OHM:
            return FaultEvent(
                fault_type=FaultType.OPEN_CIRCUIT,
                node_id=sample.node_id,
                measured_resistance_ohm=sample.resistance_ohm,
                threshold_ohm=OPEN_CIRCUIT_THRESHOLD_OHM,
                timestamp_ms=sample.timestamp_ms,
                detail="Harness wire open circuit detected - connector severance",
            )

        if sample.resistance_ohm > self._safety_threshold:
            return FaultEvent(
                fault_type=FaultType.IMPEDANCE_EXCEEDED,
                node_id=sample.node_id,
                measured_resistance_ohm=sample.resistance_ohm,
                threshold_ohm=self._safety_threshold,
                timestamp_ms=sample.timestamp_ms,
                detail=(
                    f"Impedance {sample.resistance_ohm:.3f}Ω exceeds safety "
                    f"threshold {self._safety_threshold}Ω"
                ),
            )

        return None

    def get_node_status(self, node_id: str) -> Optional[ImpedanceSample]:
        with self._lock:
            return self._latest.get(node_id)

    def get_all_node_ids(self) -> list[str]:
        with self._lock:
            return list(self._latest.keys())


# ─────────────────────────────────────────────
# 4. PHM 커널 데몬 (통합 엔진)
# ─────────────────────────────────────────────

class PHMKernelDaemon:
    """
    하네스 예지보전(PHM) 커널 데몬.

    비동기 임피던스 파이프라인 → GPR RUL 연산 → 4단계 안전 체인 구동을
    단일 데몬 프로세스에서 통합 관리합니다.

    완전 무인 자동화 설계:
    - 중앙 관제 서버 패킷 대기 없이 에지에서 자율 판단
    - 비상 대피는 에지 백업 배터리[720][721] 잔여 전력으로 ATR 자율 분산 분기
    - 인간 수동 개입 메커니즘 없음
    """

    def __init__(self, atr_id: str = "ATR_001") -> None:
        self._atr_id = atr_id
        self.tracker = ImpedanceTracker()
        self.gpr = GaussianProcessRUL()
        self.safety_chain = SafetyChainExecutor()

        self._state = HarnessState.NOMINAL
        self._governance_log: list[GovernanceLogEntry] = []
        self._lock = threading.Lock()
        self._monitoring_active = False
        self._monitor_thread: Optional[threading.Thread] = None

        # 폴트 콜백 등록
        self.tracker.register_fault_callback(self._on_fault_detected)

    @property
    def state(self) -> HarnessState:
        with self._lock:
            return self._state

    @property
    def governance_log(self) -> list[GovernanceLogEntry]:
        with self._lock:
            return list(self._governance_log)

    @property
    def is_monitoring(self) -> bool:
        return self._monitoring_active

    def ingest_sample(self, sample: ImpedanceSample) -> Optional[FaultEvent]:
        """
        센서 샘플을 수신하여 파이프라인으로 전달합니다.

        정상 시: GPR에 데이터 축적, 상태 업데이트
        이상 시: 4단계 안전 체인 즉각 구동
        """
        self.gpr.ingest(sample)
        fault = self.tracker.ingest_sample(sample)

        if fault is None:
            self._update_health_state(sample)

        return fault

    def get_rul_prediction(self, node_id: str) -> RULPrediction:
        """특정 노드의 RUL 예측을 반환합니다."""
        return self.gpr.predict_rul(node_id, time.time() * 1000.0)

    def start_monitoring(self, interval_ms: float = 100.0) -> None:
        """백그라운드 모니터링 스레드를 시작합니다."""
        if self._monitoring_active:
            return
        self._monitoring_active = True
        self._monitor_thread = threading.Thread(
            target=self._monitor_loop,
            args=(interval_ms,),
            daemon=True,
        )
        self._monitor_thread.start()

    def stop_monitoring(self) -> None:
        """백그라운드 모니터링을 중지합니다."""
        self._monitoring_active = False
        if self._monitor_thread is not None:
            self._monitor_thread.join(timeout=1.0)
            self._monitor_thread = None

    def _monitor_loop(self, interval_ms: float) -> None:
        while self._monitoring_active:
            # RUL 기반 예방적 경고
            for node_id in self.tracker.get_all_node_ids():
                prediction = self.gpr.predict_rul(node_id, time.time() * 1000.0)
                if prediction.failure_probability > 0.8:
                    with self._lock:
                        self._state = HarnessState.CRITICAL
            time.sleep(interval_ms / 1000.0)

    def _on_fault_detected(self, fault: FaultEvent) -> None:
        """
        폴트 감지 시 4단계 안전 체인을 즉각 실행하고
        거버넌스 레지스트리[660]에 로그를 기록합니다.
        """
        with self._lock:
            self._state = HarnessState.EMERGENCY_STOP

        records = self.safety_chain.execute_full_chain(fault)

        # 거버넌스 레지스트리[660] 장애 로그 자동 기록
        log_entry = GovernanceLogEntry(
            fault_event=fault,
            interlock_records=records,
            total_interlock_duration_ms=self.safety_chain.total_duration_ms,
            atr_id=self._atr_id,
            recorded_at_ms=time.time() * 1000.0,
        )

        with self._lock:
            self._governance_log.append(log_entry)

    def _update_health_state(self, sample: ImpedanceSample) -> None:
        """정상 범위 내 상태 등급을 업데이트합니다."""
        with self._lock:
            if self._state == HarnessState.EMERGENCY_STOP:
                return

            if sample.resistance_ohm > RESISTANCE_SAFETY_THRESHOLD_OHM * 0.8:
                self._state = HarnessState.DEGRADED
            elif sample.resistance_ohm > RESISTANCE_SAFETY_THRESHOLD_OHM * 0.5:
                self._state = HarnessState.NOMINAL
            else:
                self._state = HarnessState.NOMINAL

    def get_autonomous_evacuation_status(self) -> dict:
        """
        자율 분산 분기 대피 상태를 반환합니다.
        에지 백업 배터리[720][721] 잔여 전력 기반.
        """
        return {
            "mode": "autonomous_distributed_branch",
            "battery_a": PATENT_BACKUP_BATTERY_A,
            "battery_b": PATENT_BACKUP_BATTERY_B,
            "charging_dock": PATENT_CHARGING_DOCK,
            "atr_id": self._atr_id,
            "state": self._state.value,
        }
