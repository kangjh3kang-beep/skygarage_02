"""
세대 게이트[120] 안전 제어 드라이버 단위 테스트
Unit Gate Safety Control Driver - Unit Tests

테스트 시나리오:
  1. 정상 개방 (모든 조건 충족)
  2. 정책 ALLOW_FLAG 미스매치
  3. 물리 SAFE_BIT 미스매치
  4. 레이저 커튼 침범 감지
  5. ToF 센서 동적 물체(침입자) 감지
  6. 정책 채널 타임아웃 (패킷 손실)
  7. 물리 채널 타임아웃 (센서 노드 단선)
  8. 채널 미수신 상태 (신호 없음)
  9. 하드 락 이후 재요청 차단
  10. 하드 락 물리 리셋
  11. 진리표 불변성 검증
  12. 이중 채널 동시 수신 스레드 안전성
"""

import threading
import time

import pytest

from skygarage_core.actuator.unit_gate_control import (
    CHANNEL_TIMEOUT_MS,
    PATENT_UNIT_GATE,
    RELAY_VOLTAGE_ACTIVE,
    RELAY_VOLTAGE_INACTIVE,
    ApprovalToken,
    ChannelStatus,
    DualChannelReceiver,
    FaultReason,
    GateActuatorController,
    GateFaultEvent,
    GateSafetyViolation,
    GateState,
    PhysicalSignal,
    PolicySignal,
    SafetyTruthTable,
    UnitGateSafetyDriver,
)


# ─────────────────────────────────────────────
# 헬퍼 함수
# ─────────────────────────────────────────────

def make_valid_policy(ts: float = 100.0) -> PolicySignal:
    return PolicySignal(allow_flag=True, timestamp_ms=ts)


def make_valid_physical(ts: float = 100.0) -> PhysicalSignal:
    return PhysicalSignal(
        safe_bit=True,
        laser_curtain_clear=True,
        tof_static=True,
        timestamp_ms=ts,
        sensor_node_id="TOF_001",
    )


def make_driver_with_signals(
    allow_flag: bool = True,
    safe_bit: bool = True,
    laser_clear: bool = True,
    tof_static: bool = True,
    signal_ts: float = 100.0,
) -> UnitGateSafetyDriver:
    driver = UnitGateSafetyDriver()
    driver.inject_policy_signal(allow_flag, signal_ts)
    driver.inject_physical_signal(safe_bit, laser_clear, tof_static, signal_ts)
    return driver


# ─────────────────────────────────────────────
# 1. 정상 개방 시나리오
# ─────────────────────────────────────────────

class TestNormalOperation:

    def test_gate_opens_when_all_conditions_met(self):
        """모든 안전 조건 충족 시 24V 릴레이 활성화"""
        driver = make_driver_with_signals()
        voltage = driver.request_gate_open(current_time_ms=110.0)
        assert voltage == RELAY_VOLTAGE_ACTIVE
        assert driver.actuator.state == GateState.UNLOCKED
        assert not driver.actuator.is_hard_locked

    def test_gate_close_returns_zero_voltage(self):
        """게이트 닫기 시 0V 반환"""
        driver = make_driver_with_signals()
        driver.request_gate_open(current_time_ms=110.0)
        voltage = driver.request_gate_close()
        assert voltage == RELAY_VOLTAGE_INACTIVE
        assert driver.actuator.state == GateState.LOCKED


# ─────────────────────────────────────────────
# 2. 센서 미스매치 시나리오
# ─────────────────────────────────────────────

class TestChannelMismatch:

    def test_policy_flag_false_triggers_hard_lock(self):
        """ALLOW_FLAG=False 시 하드 락 + 0V 보장"""
        driver = make_driver_with_signals(allow_flag=False)
        with pytest.raises(GateSafetyViolation) as exc_info:
            driver.request_gate_open(current_time_ms=110.0)

        assert exc_info.value.fault.reason == FaultReason.CHANNEL_MISMATCH
        assert driver.actuator.is_hard_locked
        assert driver.actuator.current_voltage == RELAY_VOLTAGE_INACTIVE
        assert driver.actuator.state == GateState.HARD_LOCKED

    def test_physical_safe_bit_false_triggers_hard_lock(self):
        """PHYSICAL_SAFE_BIT=False 시 하드 락 + 0V 보장"""
        driver = make_driver_with_signals(safe_bit=False)
        with pytest.raises(GateSafetyViolation) as exc_info:
            driver.request_gate_open(current_time_ms=110.0)

        assert exc_info.value.fault.reason == FaultReason.CHANNEL_MISMATCH
        assert driver.actuator.is_hard_locked
        assert driver.actuator.current_voltage == RELAY_VOLTAGE_INACTIVE

    def test_both_flags_false_triggers_hard_lock(self):
        """양쪽 모두 False 시 레이저 커튼 위반이 먼저 감지됨"""
        driver = make_driver_with_signals(
            allow_flag=False, safe_bit=False, laser_clear=False,
        )
        with pytest.raises(GateSafetyViolation) as exc_info:
            driver.request_gate_open(current_time_ms=110.0)

        assert driver.actuator.is_hard_locked
        assert driver.actuator.current_voltage == RELAY_VOLTAGE_INACTIVE


# ─────────────────────────────────────────────
# 3. 침입자 동적 이벤트 시나리오
# ─────────────────────────────────────────────

class TestIntrusionDetection:

    def test_tof_dynamic_object_triggers_hard_lock(self):
        """ToF 센서가 동적 물체(어린이/반려동물) 감지 시 즉시 하드 락"""
        driver = make_driver_with_signals(tof_static=False)
        with pytest.raises(GateSafetyViolation) as exc_info:
            driver.request_gate_open(current_time_ms=110.0)

        assert exc_info.value.fault.reason == FaultReason.TOF_INTRUSION_DETECTED
        assert driver.actuator.is_hard_locked
        assert driver.actuator.current_voltage == RELAY_VOLTAGE_INACTIVE
        assert "dynamic object" in exc_info.value.fault.detail

    def test_laser_curtain_breach_triggers_hard_lock(self):
        """레이저 커튼 침범 시 즉시 하드 락"""
        driver = make_driver_with_signals(laser_clear=False)
        with pytest.raises(GateSafetyViolation) as exc_info:
            driver.request_gate_open(current_time_ms=110.0)

        assert exc_info.value.fault.reason == FaultReason.LASER_CURTAIN_BREACH
        assert driver.actuator.is_hard_locked
        assert driver.actuator.current_voltage == RELAY_VOLTAGE_INACTIVE


# ─────────────────────────────────────────────
# 4. 채널 타임아웃 / 패킷 손실 시나리오
# ─────────────────────────────────────────────

class TestChannelTimeout:

    def test_policy_signal_stale_triggers_fault(self):
        """정책 신호가 CHANNEL_TIMEOUT_MS 초과 시 패킷 손실 감지"""
        driver = make_driver_with_signals(signal_ts=10.0)
        with pytest.raises(GateSafetyViolation) as exc_info:
            driver.request_gate_open(current_time_ms=10.0 + CHANNEL_TIMEOUT_MS + 1.0)

        assert exc_info.value.fault.reason == FaultReason.PACKET_LOSS
        assert driver.actuator.is_hard_locked

    def test_physical_signal_stale_triggers_fault(self):
        """물리 신호가 타임아웃 초과 시 센서 단선 감지"""
        driver = UnitGateSafetyDriver()
        driver.inject_policy_signal(True, 200.0)
        driver.inject_physical_signal(True, True, True, 10.0)

        with pytest.raises(GateSafetyViolation) as exc_info:
            driver.request_gate_open(current_time_ms=200.0)

        assert exc_info.value.fault.reason == FaultReason.SENSOR_DISCONNECTED
        assert driver.actuator.is_hard_locked


# ─────────────────────────────────────────────
# 5. 채널 미수신 시나리오
# ─────────────────────────────────────────────

class TestNoSignal:

    def test_no_policy_signal_triggers_hard_lock(self):
        """정책 채널 미수신 시 즉시 하드 락"""
        driver = UnitGateSafetyDriver()
        driver.inject_physical_signal(True, True, True, 100.0)

        with pytest.raises(GateSafetyViolation) as exc_info:
            driver.request_gate_open(current_time_ms=110.0)

        assert exc_info.value.fault.reason == FaultReason.SENSOR_DISCONNECTED
        assert driver.actuator.is_hard_locked

    def test_no_physical_signal_triggers_hard_lock(self):
        """물리 채널 미수신 시 즉시 하드 락"""
        driver = UnitGateSafetyDriver()
        driver.inject_policy_signal(True, 100.0)

        with pytest.raises(GateSafetyViolation) as exc_info:
            driver.request_gate_open(current_time_ms=110.0)

        assert exc_info.value.fault.reason == FaultReason.SENSOR_DISCONNECTED
        assert driver.actuator.is_hard_locked


# ─────────────────────────────────────────────
# 6. 하드 락 영구성 검증
# ─────────────────────────────────────────────

class TestHardLockPersistence:

    def test_hard_lock_blocks_subsequent_valid_requests(self):
        """하드 락 이후 유효한 조건에서도 0V 유지"""
        driver = make_driver_with_signals(tof_static=False)
        with pytest.raises(GateSafetyViolation):
            driver.request_gate_open(current_time_ms=110.0)

        # 모든 조건 정상으로 재설정
        driver.inject_policy_signal(True, 200.0)
        driver.inject_physical_signal(True, True, True, 200.0)

        # 하드 락 상태이므로 여전히 예외 발생하지 않지만 0V 반환
        # (채널은 정상이나 액추에이터가 하드 락)
        token = ApprovalToken(
            approved=True, voltage_command=RELAY_VOLTAGE_ACTIVE, issued_at_ms=210.0
        )
        voltage = driver.actuator.activate_relay(token)
        assert voltage == RELAY_VOLTAGE_INACTIVE
        assert driver.actuator.state == GateState.HARD_LOCKED

    def test_software_cannot_reset_hard_lock(self):
        """소프트웨어만으로는 하드 락 해제 불가"""
        driver = make_driver_with_signals(laser_clear=False)
        with pytest.raises(GateSafetyViolation):
            driver.request_gate_open(current_time_ms=110.0)

        result = driver.actuator.attempt_manual_reset(physical_key_present=False)
        assert result is False
        assert driver.actuator.is_hard_locked

    def test_physical_key_resets_hard_lock(self):
        """물리 키로만 하드 락 해제 가능"""
        driver = make_driver_with_signals(laser_clear=False)
        with pytest.raises(GateSafetyViolation):
            driver.request_gate_open(current_time_ms=110.0)

        result = driver.actuator.attempt_manual_reset(physical_key_present=True)
        assert result is True
        assert not driver.actuator.is_hard_locked
        assert driver.actuator.state == GateState.LOCKED


# ─────────────────────────────────────────────
# 7. 진리표 불변성 검증
# ─────────────────────────────────────────────

class TestTruthTableImmutability:

    def test_cannot_modify_truth_table_attributes(self):
        """진리표 객체의 속성 변경 불가"""
        tt = SafetyTruthTable()
        with pytest.raises(AttributeError):
            tt.bypass = True  # type: ignore

    def test_cannot_delete_truth_table_attributes(self):
        """진리표 객체의 속성 삭제 불가"""
        tt = SafetyTruthTable()
        with pytest.raises(AttributeError):
            del tt._patent_component  # type: ignore

    def test_truth_table_has_patent_component(self):
        """진리표에 특허 컴포넌트[120] 식별 부호 포함"""
        tt = SafetyTruthTable()
        assert object.__getattribute__(tt, "_patent_component") == PATENT_UNIT_GATE


# ─────────────────────────────────────────────
# 8. 스레드 안전성 검증
# ─────────────────────────────────────────────

class TestThreadSafety:

    def test_concurrent_signal_injection(self):
        """동시 다발적 신호 주입 시 데이터 무결성 유지"""
        driver = UnitGateSafetyDriver()
        errors: list[Exception] = []

        def inject_policy():
            try:
                for i in range(100):
                    driver.inject_policy_signal(True, float(i))
            except Exception as e:
                errors.append(e)

        def inject_physical():
            try:
                for i in range(100):
                    driver.inject_physical_signal(True, True, True, float(i))
            except Exception as e:
                errors.append(e)

        t1 = threading.Thread(target=inject_policy)
        t2 = threading.Thread(target=inject_physical)
        t1.start()
        t2.start()
        t1.join()
        t2.join()

        assert len(errors) == 0
        assert driver.receiver.policy_channel_status == ChannelStatus.CONNECTED
        assert driver.receiver.physical_channel_status == ChannelStatus.CONNECTED


# ─────────────────────────────────────────────
# 9. 통합 시나리오
# ─────────────────────────────────────────────

class TestIntegratedScenario:

    def test_full_open_close_cycle(self):
        """완전한 개폐 사이클: 열기 → 닫기 → 재열기"""
        driver = make_driver_with_signals(signal_ts=100.0)

        v1 = driver.request_gate_open(current_time_ms=110.0)
        assert v1 == RELAY_VOLTAGE_ACTIVE

        v2 = driver.request_gate_close()
        assert v2 == RELAY_VOLTAGE_INACTIVE

        # 새 신호 주입 후 재개방
        driver.inject_policy_signal(True, 200.0)
        driver.inject_physical_signal(True, True, True, 200.0)
        v3 = driver.request_gate_open(current_time_ms=210.0)
        assert v3 == RELAY_VOLTAGE_ACTIVE
        assert driver.actuator.relay_activation_count == 2

    def test_intrusion_during_open_sequence(self):
        """개방 시퀀스 중 침입자 감지 시 즉시 하드 락"""
        driver = make_driver_with_signals(signal_ts=100.0)

        # 첫 번째 개방 성공
        v1 = driver.request_gate_open(current_time_ms=110.0)
        assert v1 == RELAY_VOLTAGE_ACTIVE

        driver.request_gate_close()

        # 침입자 감지된 신호
        driver.inject_policy_signal(True, 200.0)
        driver.inject_physical_signal(True, True, False, 200.0)  # tof_static=False

        with pytest.raises(GateSafetyViolation):
            driver.request_gate_open(current_time_ms=210.0)

        assert driver.actuator.is_hard_locked
        assert driver.actuator.current_voltage == RELAY_VOLTAGE_INACTIVE
        assert len(driver.actuator.fault_log) == 1


# ─────────────────────────────────────────────
# 10. 특허 컴포넌트 식별 검증
# ─────────────────────────────────────────────

class TestPatentComponentIdentification:

    def test_all_classes_carry_patent_id(self):
        """모든 주요 클래스에 특허 컴포넌트[120] 식별 부호가 포함됨"""
        driver = UnitGateSafetyDriver()
        assert driver._patent_component == PATENT_UNIT_GATE
        assert driver.actuator._patent_component == PATENT_UNIT_GATE
        assert driver.receiver._patent_component == PATENT_UNIT_GATE
        assert object.__getattribute__(
            driver.truth_table, "_patent_component"
        ) == PATENT_UNIT_GATE

    def test_fault_events_carry_patent_id(self):
        """장애 이벤트에 특허 컴포넌트[120] 식별 부호 포함"""
        driver = make_driver_with_signals(tof_static=False)
        with pytest.raises(GateSafetyViolation) as exc_info:
            driver.request_gate_open(current_time_ms=110.0)

        assert exc_info.value.fault.gate_component == PATENT_UNIT_GATE
        assert "[120]" in str(exc_info.value)
