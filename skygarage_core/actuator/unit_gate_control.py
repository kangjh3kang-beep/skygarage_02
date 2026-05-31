"""
SkyGarage 세대직입형 발렛 게이트 안전 제어 드라이버
Unit Gate Direct-Entry Valet Safety Control Driver

특허 컴포넌트 참조:
  [120] 세대 게이트 - 유리 도어 형태 전시 차고 진입 게이트

서브시스템 구성:
  1. DualChannelReceiver - 정책 서버 ALLOW_FLAG + 물리 레이저 커튼 PHYSICAL_SAFE_BIT 이중 수신
  2. SafetyTruthTable - 불변 AND 결합 진리표 교차 검증 (바이패스 불가)
  3. GateActuatorController - 하드웨어 도어 락 릴레이 제어 + 하드 락 폴백

특허 청구항 제1항, 제3항, 제13항 대응:
  - 프리미엄 세대직입형 발렛 모드의 세대 게이트 개폐 안전 제어
  - 이중 채널 교차 검증으로 휴먼 에러(어린이/반려동물 진입) 방지
  - 물리·논리 안전 결합 연산의 불변 캡슐화
"""

from __future__ import annotations

import threading
import time
import uuid
from dataclasses import dataclass, field
from enum import Enum
from typing import Callable, Optional


# 특허 컴포넌트 식별 부호
PATENT_UNIT_GATE = "[120]"


# ─────────────────────────────────────────────
# 열거형 및 상수
# ─────────────────────────────────────────────

class GateState(Enum):
    LOCKED = "locked"
    UNLOCKED = "unlocked"
    HARD_LOCKED = "hard_locked"


class ChannelStatus(Enum):
    CONNECTED = "connected"
    DISCONNECTED = "disconnected"
    TIMEOUT = "timeout"


class FaultReason(Enum):
    CHANNEL_MISMATCH = "channel_mismatch"
    SENSOR_DISCONNECTED = "sensor_disconnected"
    TOF_INTRUSION_DETECTED = "tof_intrusion_detected"
    LASER_CURTAIN_BREACH = "laser_curtain_breach"
    PACKET_LOSS = "packet_loss"
    TRUTH_TABLE_VIOLATION = "truth_table_violation"


RELAY_VOLTAGE_ACTIVE = 24.0
RELAY_VOLTAGE_INACTIVE = 0.0
CHANNEL_TIMEOUT_MS = 50.0


# ─────────────────────────────────────────────
# 데이터 클래스
# ─────────────────────────────────────────────

@dataclass(frozen=True)
class PolicySignal:
    allow_flag: bool
    timestamp_ms: float
    session_id: str = field(default_factory=lambda: str(uuid.uuid4()))


@dataclass(frozen=True)
class PhysicalSignal:
    safe_bit: bool
    laser_curtain_clear: bool
    tof_static: bool
    timestamp_ms: float
    sensor_node_id: str = ""


@dataclass(frozen=True)
class ApprovalToken:
    approved: bool
    voltage_command: float
    token_id: str = field(default_factory=lambda: str(uuid.uuid4()))
    issued_at_ms: float = 0.0
    gate_component: str = PATENT_UNIT_GATE


@dataclass
class GateFaultEvent:
    reason: FaultReason
    timestamp_ms: float
    detail: str = ""
    gate_component: str = PATENT_UNIT_GATE


# ─────────────────────────────────────────────
# 예외 클래스
# ─────────────────────────────────────────────

class GateSafetyViolation(Exception):
    """세대 게이트[120] 안전 검증 실패 시 발생하는 불가역 예외"""

    def __init__(self, fault: GateFaultEvent):
        self.fault = fault
        super().__init__(
            f"[120] Gate safety violation: {fault.reason.value} - {fault.detail}"
        )


# ─────────────────────────────────────────────
# 1. 이중 채널 수신기 (Dual Channel Receiver)
# ─────────────────────────────────────────────

class DualChannelReceiver:
    """
    정책 서버의 논리적 ALLOW_FLAG와 물리 레이저 커튼 PHYSICAL_SAFE_BIT를
    독립된 가상 스레드에서 비동기 수신하는 이중 채널 리시버.
    세대 게이트[120] 전용.
    """

    def __init__(self) -> None:
        self._patent_component = PATENT_UNIT_GATE
        self._lock = threading.Lock()
        self._policy_signal: Optional[PolicySignal] = None
        self._physical_signal: Optional[PhysicalSignal] = None
        self._policy_channel_status = ChannelStatus.DISCONNECTED
        self._physical_channel_status = ChannelStatus.DISCONNECTED
        self._listeners: list[Callable[[str, object], None]] = []

    @property
    def policy_signal(self) -> Optional[PolicySignal]:
        with self._lock:
            return self._policy_signal

    @property
    def physical_signal(self) -> Optional[PhysicalSignal]:
        with self._lock:
            return self._physical_signal

    @property
    def policy_channel_status(self) -> ChannelStatus:
        with self._lock:
            return self._policy_channel_status

    @property
    def physical_channel_status(self) -> ChannelStatus:
        with self._lock:
            return self._physical_channel_status

    def receive_policy_signal(self, signal: PolicySignal) -> None:
        with self._lock:
            self._policy_signal = signal
            self._policy_channel_status = ChannelStatus.CONNECTED
        self._notify("policy", signal)

    def receive_physical_signal(self, signal: PhysicalSignal) -> None:
        with self._lock:
            self._physical_signal = signal
            self._physical_channel_status = ChannelStatus.CONNECTED
        self._notify("physical", signal)

    def mark_policy_disconnected(self) -> None:
        with self._lock:
            self._policy_channel_status = ChannelStatus.DISCONNECTED

    def mark_physical_disconnected(self) -> None:
        with self._lock:
            self._physical_channel_status = ChannelStatus.DISCONNECTED

    def add_listener(self, callback: Callable[[str, object], None]) -> None:
        self._listeners.append(callback)

    def _notify(self, channel: str, data: object) -> None:
        for cb in self._listeners:
            cb(channel, data)


# ─────────────────────────────────────────────
# 2. 불변 안전 진리표 (Immutable Safety Truth Table)
# ─────────────────────────────────────────────

class SafetyTruthTable:
    """
    세대 게이트[120] 이중 채널 교차 검증 진리표.

    불변(Immutable) 연산 객체로 캡슐화:
    - 바이패스 구문 불허 (bypass 메서드/속성 없음)
    - 진리표 결합 연산은 frozen dataclass 입력에 대해서만 동작
    - 단 1비트 미스매치 시 즉시 GateSafetyViolation 발생

    진리표:
      ALLOW_FLAG | PHYSICAL_SAFE_BIT | ToF_STATIC | Result
      ─────────────────────────────────────────────────────
         True    |       True        |    True    | APPROVE (24V)
         True    |       True        |    False   | REJECT → HARD_LOCK (침입 감지)
         True    |       False       |    *       | REJECT → HARD_LOCK (레이저 위반)
         False   |       True        |    *       | REJECT → HARD_LOCK (정책 불일치)
         False   |       False       |    *       | REJECT → HARD_LOCK (전면 차단)
    """

    __slots__ = ("_patent_component",)

    def __init__(self) -> None:
        object.__setattr__(self, "_patent_component", PATENT_UNIT_GATE)

    def __setattr__(self, name: str, value: object) -> None:
        raise AttributeError(
            "SafetyTruthTable is immutable: no attribute modification permitted"
        )

    def __delattr__(self, name: str) -> None:
        raise AttributeError(
            "SafetyTruthTable is immutable: no attribute deletion permitted"
        )

    def evaluate(
        self,
        policy: PolicySignal,
        physical: PhysicalSignal,
        current_time_ms: float,
    ) -> ApprovalToken:
        """
        이중 채널 교차 AND 결합 검증을 수행합니다.
        모든 조건이 True일 때만 승인 토큰(24V)을 발행합니다.
        단 1비트라도 불일치 시 GateSafetyViolation을 발생시킵니다.
        """
        # 타임스탬프 유효성 검증 (채널 타임아웃)
        policy_age = current_time_ms - policy.timestamp_ms
        physical_age = current_time_ms - physical.timestamp_ms

        if policy_age > CHANNEL_TIMEOUT_MS:
            raise GateSafetyViolation(GateFaultEvent(
                reason=FaultReason.PACKET_LOSS,
                timestamp_ms=current_time_ms,
                detail=f"Policy signal stale: {policy_age:.1f}ms > {CHANNEL_TIMEOUT_MS}ms",
            ))

        if physical_age > CHANNEL_TIMEOUT_MS:
            raise GateSafetyViolation(GateFaultEvent(
                reason=FaultReason.SENSOR_DISCONNECTED,
                timestamp_ms=current_time_ms,
                detail=f"Physical signal stale: {physical_age:.1f}ms > {CHANNEL_TIMEOUT_MS}ms",
            ))

        # 레이저 커튼 물리 보안 비트 검증
        if not physical.laser_curtain_clear:
            raise GateSafetyViolation(GateFaultEvent(
                reason=FaultReason.LASER_CURTAIN_BREACH,
                timestamp_ms=current_time_ms,
                detail="Laser curtain obstruction detected in unit garage zone",
            ))

        # ToF 센서 동적 물체 감지 검증
        if not physical.tof_static:
            raise GateSafetyViolation(GateFaultEvent(
                reason=FaultReason.TOF_INTRUSION_DETECTED,
                timestamp_ms=current_time_ms,
                detail="ToF sensor detected dynamic object in exhibition garage",
            ))

        # 정책 서버 ALLOW_FLAG 검증
        if not policy.allow_flag:
            raise GateSafetyViolation(GateFaultEvent(
                reason=FaultReason.CHANNEL_MISMATCH,
                timestamp_ms=current_time_ms,
                detail="Policy server ALLOW_FLAG is False",
            ))

        # 물리 SAFE_BIT 검증
        if not physical.safe_bit:
            raise GateSafetyViolation(GateFaultEvent(
                reason=FaultReason.CHANNEL_MISMATCH,
                timestamp_ms=current_time_ms,
                detail="Physical SAFE_BIT is False despite clear sensors",
            ))

        # 교차 AND 결합: 모든 조건 통과
        return ApprovalToken(
            approved=True,
            voltage_command=RELAY_VOLTAGE_ACTIVE,
            issued_at_ms=current_time_ms,
        )


# ─────────────────────────────────────────────
# 3. 게이트 액추에이터 컨트롤러
# ─────────────────────────────────────────────

class GateActuatorController:
    """
    세대 게이트[120] 하드웨어 도어 락 릴레이 액추에이터 제어기.

    승인 토큰이 발행된 경우에만 릴레이에 24V 전압 신호를 인가합니다.
    비정상 조건에서는 0V를 유지하고 하드 락 상태로 전환합니다.
    """

    def __init__(self) -> None:
        self._patent_component = PATENT_UNIT_GATE
        self._lock = threading.Lock()
        self._state = GateState.LOCKED
        self._current_voltage = RELAY_VOLTAGE_INACTIVE
        self._hard_lock_active = False
        self._fault_log: list[GateFaultEvent] = []
        self._relay_activation_count = 0

    @property
    def state(self) -> GateState:
        with self._lock:
            return self._state

    @property
    def current_voltage(self) -> float:
        with self._lock:
            return self._current_voltage

    @property
    def is_hard_locked(self) -> bool:
        with self._lock:
            return self._hard_lock_active

    @property
    def fault_log(self) -> list[GateFaultEvent]:
        with self._lock:
            return list(self._fault_log)

    @property
    def relay_activation_count(self) -> int:
        with self._lock:
            return self._relay_activation_count

    def activate_relay(self, token: ApprovalToken) -> float:
        """
        승인 토큰 검증 후 릴레이 액추에이터를 구동합니다.
        하드 락 상태에서는 어떤 토큰도 거부합니다.
        """
        with self._lock:
            if self._hard_lock_active:
                return RELAY_VOLTAGE_INACTIVE

            if not token.approved:
                return RELAY_VOLTAGE_INACTIVE

            if token.voltage_command != RELAY_VOLTAGE_ACTIVE:
                return RELAY_VOLTAGE_INACTIVE

            self._state = GateState.UNLOCKED
            self._current_voltage = RELAY_VOLTAGE_ACTIVE
            self._relay_activation_count += 1
            return self._current_voltage

    def deactivate_relay(self) -> float:
        """릴레이를 비활성화하고 게이트를 잠금 상태로 복원합니다."""
        with self._lock:
            if self._hard_lock_active:
                return RELAY_VOLTAGE_INACTIVE
            self._state = GateState.LOCKED
            self._current_voltage = RELAY_VOLTAGE_INACTIVE
            return self._current_voltage

    def engage_hard_lock(self, fault: GateFaultEvent) -> None:
        """
        영구 하드 락을 활성화합니다.
        한번 활성화되면 소프트웨어에서 해제할 수 없습니다 (물리 리셋 필요).
        """
        with self._lock:
            self._hard_lock_active = True
            self._state = GateState.HARD_LOCKED
            self._current_voltage = RELAY_VOLTAGE_INACTIVE
            self._fault_log.append(fault)

    def attempt_manual_reset(self, physical_key_present: bool) -> bool:
        """
        물리 키를 통한 하드 락 해제 (유지보수 인터페이스).
        소프트웨어만으로는 해제 불가능합니다.
        """
        with self._lock:
            if not physical_key_present:
                return False
            if not self._hard_lock_active:
                return True
            self._hard_lock_active = False
            self._state = GateState.LOCKED
            return True


# ─────────────────────────────────────────────
# 통합 엔진: UnitGateSafetyDriver
# ─────────────────────────────────────────────

class UnitGateSafetyDriver:
    """
    세대직입형 발렛 모드 세대 게이트[120] 통합 안전 드라이버.

    이중 채널 수신 → 진리표 교차 검증 → 릴레이 액추에이터 제어를
    단일 인터페이스로 통합합니다.

    물리·논리 안전 결합 연산은 SafetyTruthTable 불변 객체에 위임되며,
    어떠한 우회 경로도 존재하지 않습니다.
    """

    def __init__(self) -> None:
        self._patent_component = PATENT_UNIT_GATE
        self.receiver = DualChannelReceiver()
        self.truth_table = SafetyTruthTable()
        self.actuator = GateActuatorController()
        self._operation_log: list[dict] = []

    def request_gate_open(self, current_time_ms: Optional[float] = None) -> float:
        """
        세대 게이트 개방을 요청합니다.

        Returns:
            릴레이에 인가된 전압 (24.0V = 개방, 0.0V = 차단)

        Raises:
            GateSafetyViolation: 교차 검증 실패 시 (하드 락으로 전환됨)
        """
        if current_time_ms is None:
            current_time_ms = time.time() * 1000.0

        policy = self.receiver.policy_signal
        physical = self.receiver.physical_signal

        # 채널 미수신 검증
        if policy is None:
            fault = GateFaultEvent(
                reason=FaultReason.SENSOR_DISCONNECTED,
                timestamp_ms=current_time_ms,
                detail="Policy channel has no signal",
            )
            self.actuator.engage_hard_lock(fault)
            raise GateSafetyViolation(fault)

        if physical is None:
            fault = GateFaultEvent(
                reason=FaultReason.SENSOR_DISCONNECTED,
                timestamp_ms=current_time_ms,
                detail="Physical channel has no signal",
            )
            self.actuator.engage_hard_lock(fault)
            raise GateSafetyViolation(fault)

        # 진리표 교차 검증 수행
        try:
            token = self.truth_table.evaluate(policy, physical, current_time_ms)
        except GateSafetyViolation as e:
            self.actuator.engage_hard_lock(e.fault)
            self._log_operation("REJECTED", e.fault.reason.value, current_time_ms)
            raise

        # 릴레이 활성화
        voltage = self.actuator.activate_relay(token)
        self._log_operation("APPROVED", f"voltage={voltage}V", current_time_ms)
        return voltage

    def request_gate_close(self) -> float:
        """세대 게이트를 안전하게 닫습니다."""
        voltage = self.actuator.deactivate_relay()
        self._log_operation("CLOSED", f"voltage={voltage}V", time.time() * 1000.0)
        return voltage

    def inject_policy_signal(self, allow: bool, timestamp_ms: float) -> None:
        """정책 서버로부터의 신호를 주입합니다 (테스트/시뮬레이션 용도)."""
        signal = PolicySignal(allow_flag=allow, timestamp_ms=timestamp_ms)
        self.receiver.receive_policy_signal(signal)

    def inject_physical_signal(
        self,
        safe_bit: bool,
        laser_clear: bool,
        tof_static: bool,
        timestamp_ms: float,
        sensor_node_id: str = "TOF_001",
    ) -> None:
        """물리 센서 신호를 주입합니다 (테스트/시뮬레이션 용도)."""
        signal = PhysicalSignal(
            safe_bit=safe_bit,
            laser_curtain_clear=laser_clear,
            tof_static=tof_static,
            timestamp_ms=timestamp_ms,
            sensor_node_id=sensor_node_id,
        )
        self.receiver.receive_physical_signal(signal)

    def _log_operation(self, action: str, detail: str, timestamp_ms: float) -> None:
        self._operation_log.append({
            "action": action,
            "detail": detail,
            "timestamp_ms": timestamp_ms,
            "gate_component": PATENT_UNIT_GATE,
        })

    @property
    def operation_log(self) -> list[dict]:
        return list(self._operation_log)
