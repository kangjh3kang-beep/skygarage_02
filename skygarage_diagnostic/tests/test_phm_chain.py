"""
SkyGarage 하네스 PHM 커널 데몬 테스트 벤치
Harness PHM Chain Kernel - Fault Injection Test Bench

테스트 시나리오:
  1. 정상 임피던스 모니터링 - 임계치 이하 정상 동작
  2. 임피던스 폭증 폴트 인젝션 (2.8Ω 강제 주입)
  3. 4단계 안전 체인 타이밍 검증 (t_delay < 100ms)
  4. 단선(Open Circuit) 폴트 감지
  5. GPR RUL 예측 정확도 검증
  6. 거버넌스 레지스트리[660] 로그 무결성
  7. 원자적 인터록 순서 보장
  8. 에지 자율 분산 분기 상태 검증
  9. 멀티노드 동시 센싱
  10. 백그라운드 모니터링 스레드 안전성
"""

import threading
import time

import pytest

from skygarage_diagnostic.harness.phm_chain import (
    INTERLOCK_DEADLINE_MS,
    OPEN_CIRCUIT_THRESHOLD_OHM,
    PATENT_BACKUP_BATTERY_A,
    PATENT_BACKUP_BATTERY_B,
    PATENT_BATTERY_RELAY,
    PATENT_CHARGING_DOCK,
    PATENT_EMERGENCY_BRAKE,
    PATENT_GOVERNANCE_MDM,
    PATENT_INTERLOCK_FLAG,
    PATENT_MOTOR_STO,
    RESISTANCE_SAFETY_THRESHOLD_OHM,
    FaultEvent,
    FaultType,
    GaussianProcessRUL,
    GovernanceLogEntry,
    HarnessFaultException,
    HarnessState,
    ImpedanceSample,
    ImpedanceTracker,
    InterlockRecord,
    InterlockStage,
    PHMKernelDaemon,
    SafetyChainExecutor,
)


# ─────────────────────────────────────────────
# 헬퍼 함수
# ─────────────────────────────────────────────

def make_sample(
    node_id: str = "HRN_NODE_01",
    resistance: float = 0.3,
    voltage_drop: float = 15.0,
    current: float = 50.0,
    timestamp_ms: float = 1000.0,
) -> ImpedanceSample:
    return ImpedanceSample(
        node_id=node_id,
        resistance_ohm=resistance,
        voltage_drop_mv=voltage_drop,
        current_ma=current,
        timestamp_ms=timestamp_ms,
    )


def make_degradation_series(
    node_id: str = "HRN_NODE_01",
    start_r: float = 0.2,
    end_r: float = 1.0,
    n_samples: int = 20,
    start_time_ms: float = 0.0,
    interval_ms: float = 3600000.0,
) -> list[ImpedanceSample]:
    """시간에 따라 선형적으로 저항이 증가하는 열화 시계열"""
    samples = []
    for i in range(n_samples):
        r = start_r + (end_r - start_r) * (i / max(n_samples - 1, 1))
        ts = start_time_ms + i * interval_ms
        samples.append(make_sample(node_id=node_id, resistance=r, timestamp_ms=ts))
    return samples


# ─────────────────────────────────────────────
# 1. 정상 임피던스 모니터링
# ─────────────────────────────────────────────

class TestNormalMonitoring:

    def test_nominal_samples_no_fault(self):
        """안전 임계치 이하 샘플은 폴트를 발생시키지 않음"""
        daemon = PHMKernelDaemon(atr_id="ATR_TEST_01")
        sample = make_sample(resistance=0.5)
        fault = daemon.ingest_sample(sample)
        assert fault is None
        assert daemon.state == HarnessState.NOMINAL

    def test_degraded_state_on_approaching_threshold(self):
        """임계치 80% 초과 시 DEGRADED 상태 전이"""
        daemon = PHMKernelDaemon()
        threshold_80_pct = RESISTANCE_SAFETY_THRESHOLD_OHM * 0.8 + 0.01
        sample = make_sample(resistance=threshold_80_pct)
        daemon.ingest_sample(sample)
        assert daemon.state == HarnessState.DEGRADED

    def test_multiple_nodes_tracked(self):
        """다중 노드 동시 추적"""
        daemon = PHMKernelDaemon()
        for i in range(5):
            s = make_sample(node_id=f"NODE_{i:02d}", resistance=0.2 + i * 0.1)
            daemon.ingest_sample(s)
        assert len(daemon.tracker.get_all_node_ids()) == 5


# ─────────────────────────────────────────────
# 2. 임피던스 폭증 폴트 인젝션 (2.8Ω)
# ─────────────────────────────────────────────

class TestImpedanceFaultInjection:

    def test_28_ohm_triggers_fault(self):
        """2.8Ω 강제 주입 시 즉각 폴트 발생"""
        daemon = PHMKernelDaemon()
        sample = make_sample(resistance=2.8, timestamp_ms=5000.0)
        fault = daemon.ingest_sample(sample)

        assert fault is not None
        assert fault.fault_type == FaultType.IMPEDANCE_EXCEEDED
        assert fault.measured_resistance_ohm == 2.8
        assert fault.threshold_ohm == RESISTANCE_SAFETY_THRESHOLD_OHM

    def test_28_ohm_triggers_emergency_stop(self):
        """2.8Ω 폴트 시 시스템 상태 EMERGENCY_STOP 전이"""
        daemon = PHMKernelDaemon()
        sample = make_sample(resistance=2.8, timestamp_ms=5000.0)
        daemon.ingest_sample(sample)
        assert daemon.state == HarnessState.EMERGENCY_STOP

    def test_28_ohm_triggers_full_interlock_chain(self):
        """2.8Ω 폴트 시 4단계 안전 체인 완전 실행"""
        daemon = PHMKernelDaemon()
        sample = make_sample(resistance=2.8, timestamp_ms=5000.0)
        daemon.ingest_sample(sample)

        assert daemon.safety_chain.interlock_active
        assert daemon.safety_chain.current_stage == InterlockStage.COMPLETED
        assert len(daemon.safety_chain.records) == 4

    def test_threshold_exact_does_not_trigger(self):
        """정확히 임계치(1.5Ω)는 폴트를 트리거하지 않음"""
        daemon = PHMKernelDaemon()
        sample = make_sample(resistance=RESISTANCE_SAFETY_THRESHOLD_OHM)
        fault = daemon.ingest_sample(sample)
        assert fault is None

    def test_just_above_threshold_triggers(self):
        """임계치 초과(1.501Ω) 시 즉각 폴트"""
        daemon = PHMKernelDaemon()
        sample = make_sample(resistance=RESISTANCE_SAFETY_THRESHOLD_OHM + 0.001)
        fault = daemon.ingest_sample(sample)
        assert fault is not None
        assert fault.fault_type == FaultType.IMPEDANCE_EXCEEDED


# ─────────────────────────────────────────────
# 3. 4단계 안전 체인 타이밍 검증 (t_delay < 100ms)
# ─────────────────────────────────────────────

class TestInterlockTiming:

    def test_full_chain_completes_under_100ms(self):
        """결함 발생 → [270] 브레이크 완료까지 t_delay < 100ms"""
        daemon = PHMKernelDaemon()

        start_ns = time.perf_counter_ns()
        sample = make_sample(resistance=2.8, timestamp_ms=5000.0)
        daemon.ingest_sample(sample)
        end_ns = time.perf_counter_ns()

        elapsed_ms = (end_ns - start_ns) / 1_000_000
        assert elapsed_ms < INTERLOCK_DEADLINE_MS, (
            f"Interlock chain took {elapsed_ms:.2f}ms, exceeds {INTERLOCK_DEADLINE_MS}ms deadline"
        )

    def test_chain_internal_timing_under_100ms(self):
        """SafetyChainExecutor 내부 측정 total_duration_ms < 100ms"""
        daemon = PHMKernelDaemon()
        sample = make_sample(resistance=2.8, timestamp_ms=5000.0)
        daemon.ingest_sample(sample)

        assert daemon.safety_chain.total_duration_ms < INTERLOCK_DEADLINE_MS

    def test_stages_execute_in_order(self):
        """4단계가 정확한 순서(132→271→272→270)로 실행됨"""
        daemon = PHMKernelDaemon()
        sample = make_sample(resistance=2.8, timestamp_ms=5000.0)
        daemon.ingest_sample(sample)

        records = daemon.safety_chain.records
        assert records[0].stage == InterlockStage.STAGE_1_FLAG
        assert records[1].stage == InterlockStage.STAGE_2_STO
        assert records[2].stage == InterlockStage.STAGE_3_RELAY
        assert records[3].stage == InterlockStage.STAGE_4_BRAKE

    def test_all_stages_succeed(self):
        """모든 4단계가 성공적으로 완료됨"""
        daemon = PHMKernelDaemon()
        sample = make_sample(resistance=2.8, timestamp_ms=5000.0)
        daemon.ingest_sample(sample)

        for record in daemon.safety_chain.records:
            assert record.success is True


# ─────────────────────────────────────────────
# 4. 단선(Open Circuit) 폴트 감지
# ─────────────────────────────────────────────

class TestOpenCircuitDetection:

    def test_open_circuit_detected(self):
        """100Ω 이상 단선 감지"""
        daemon = PHMKernelDaemon()
        sample = make_sample(resistance=150.0, timestamp_ms=3000.0)
        fault = daemon.ingest_sample(sample)

        assert fault is not None
        assert fault.fault_type == FaultType.OPEN_CIRCUIT
        assert "open circuit" in fault.detail.lower()

    def test_open_circuit_triggers_interlock(self):
        """단선 시 즉각 안전 체인 구동"""
        daemon = PHMKernelDaemon()
        sample = make_sample(resistance=200.0, timestamp_ms=3000.0)
        daemon.ingest_sample(sample)

        assert daemon.state == HarnessState.EMERGENCY_STOP
        assert daemon.safety_chain.interlock_active


# ─────────────────────────────────────────────
# 5. GPR RUL 예측 검증
# ─────────────────────────────────────────────

class TestGPRRulPrediction:

    def test_rul_decreases_with_degradation(self):
        """열화가 진행됨에 따라 RUL이 감소"""
        gpr = GaussianProcessRUL()
        series = make_degradation_series(
            start_r=0.2, end_r=1.2, n_samples=20, interval_ms=3600000.0
        )
        for s in series:
            gpr.ingest(s)

        prediction = gpr.predict_rul("HRN_NODE_01", series[-1].timestamp_ms + 1000)
        assert prediction.rul_hours < float("inf")
        assert prediction.rul_hours > 0

    def test_failure_probability_increases_near_threshold(self):
        """임계치 근접 시 고장 확률 상승"""
        gpr = GaussianProcessRUL()
        series = make_degradation_series(
            start_r=0.5, end_r=1.4, n_samples=30, interval_ms=3600000.0
        )
        for s in series:
            gpr.ingest(s)

        prediction = gpr.predict_rul("HRN_NODE_01", series[-1].timestamp_ms + 1000)
        assert prediction.failure_probability > 0.0

    def test_healthy_node_has_low_failure_probability(self):
        """정상 노드의 고장 확률은 낮음"""
        gpr = GaussianProcessRUL()
        series = make_degradation_series(
            start_r=0.1, end_r=0.3, n_samples=20, interval_ms=3600000.0
        )
        for s in series:
            gpr.ingest(s)

        prediction = gpr.predict_rul("HRN_NODE_01", series[-1].timestamp_ms + 1000)
        assert prediction.failure_probability < 0.1

    def test_insufficient_data_returns_infinite_rul(self):
        """데이터 부족 시 무한대 RUL 반환"""
        gpr = GaussianProcessRUL()
        prediction = gpr.predict_rul("NONEXISTENT", 1000.0)
        assert prediction.rul_hours == float("inf")
        assert prediction.failure_probability == 0.0


# ─────────────────────────────────────────────
# 6. 거버넌스 레지스트리[660] 로그 무결성
# ─────────────────────────────────────────────

class TestGovernanceLog:

    def test_fault_generates_governance_log(self):
        """폴트 발생 시 거버넌스 로그[660] 자동 기록"""
        daemon = PHMKernelDaemon(atr_id="ATR_007")
        sample = make_sample(resistance=2.8, timestamp_ms=5000.0)
        daemon.ingest_sample(sample)

        log = daemon.governance_log
        assert len(log) == 1

        entry = log[0]
        assert entry.governance_registry == PATENT_GOVERNANCE_MDM
        assert entry.atr_id == "ATR_007"
        assert entry.fault_event is not None
        assert entry.fault_event.measured_resistance_ohm == 2.8

    def test_governance_log_contains_all_interlock_records(self):
        """거버넌스 로그에 4단계 인터록 기록 전부 포함"""
        daemon = PHMKernelDaemon()
        sample = make_sample(resistance=2.8, timestamp_ms=5000.0)
        daemon.ingest_sample(sample)

        entry = daemon.governance_log[0]
        assert len(entry.interlock_records) == 4
        assert entry.total_interlock_duration_ms < INTERLOCK_DEADLINE_MS

    def test_governance_log_timing_integrity(self):
        """거버넌스 로그의 타이밍 무결성 검증"""
        daemon = PHMKernelDaemon()
        sample = make_sample(resistance=2.8, timestamp_ms=5000.0)
        daemon.ingest_sample(sample)

        entry = daemon.governance_log[0]
        assert entry.recorded_at_ms > 0
        assert entry.total_interlock_duration_ms >= 0
        assert entry.total_interlock_duration_ms < INTERLOCK_DEADLINE_MS

    def test_autonomous_evacuation_mode_logged(self):
        """자율 분산 분기 대피 모드 기록"""
        daemon = PHMKernelDaemon()
        sample = make_sample(resistance=2.8, timestamp_ms=5000.0)
        daemon.ingest_sample(sample)

        entry = daemon.governance_log[0]
        assert entry.autonomous_evacuation_mode == "edge_battery_distributed_branch"


# ─────────────────────────────────────────────
# 7. 인터록 특허 컴포넌트 매핑 검증
# ─────────────────────────────────────────────

class TestPatentComponentMapping:

    def test_stage_1_maps_to_132(self):
        """Stage 1 → [132] 인터록 플래그"""
        daemon = PHMKernelDaemon()
        sample = make_sample(resistance=2.8, timestamp_ms=5000.0)
        daemon.ingest_sample(sample)
        assert daemon.safety_chain.records[0].patent_component == PATENT_INTERLOCK_FLAG

    def test_stage_2_maps_to_271(self):
        """Stage 2 → [271] 모터 STO"""
        daemon = PHMKernelDaemon()
        sample = make_sample(resistance=2.8, timestamp_ms=5000.0)
        daemon.ingest_sample(sample)
        assert daemon.safety_chain.records[1].patent_component == PATENT_MOTOR_STO

    def test_stage_3_maps_to_272(self):
        """Stage 3 → [272] 배터리 릴레이"""
        daemon = PHMKernelDaemon()
        sample = make_sample(resistance=2.8, timestamp_ms=5000.0)
        daemon.ingest_sample(sample)
        record = daemon.safety_chain.records[2]
        assert record.patent_component == PATENT_BATTERY_RELAY
        assert PATENT_BACKUP_BATTERY_A in record.detail
        assert PATENT_BACKUP_BATTERY_B in record.detail
        assert PATENT_CHARGING_DOCK in record.detail

    def test_stage_4_maps_to_270(self):
        """Stage 4 → [270] 비상 브레이크"""
        daemon = PHMKernelDaemon()
        sample = make_sample(resistance=2.8, timestamp_ms=5000.0)
        daemon.ingest_sample(sample)
        assert daemon.safety_chain.records[3].patent_component == PATENT_EMERGENCY_BRAKE


# ─────────────────────────────────────────────
# 8. 에지 자율 분산 분기 상태 검증
# ─────────────────────────────────────────────

class TestAutonomousEvacuation:

    def test_evacuation_status_contains_battery_refs(self):
        """자율 대피 상태에 에지 배터리[720][721] 참조 포함"""
        daemon = PHMKernelDaemon(atr_id="ATR_042")
        status = daemon.get_autonomous_evacuation_status()
        assert status["battery_a"] == PATENT_BACKUP_BATTERY_A
        assert status["battery_b"] == PATENT_BACKUP_BATTERY_B
        assert status["charging_dock"] == PATENT_CHARGING_DOCK
        assert status["atr_id"] == "ATR_042"
        assert status["mode"] == "autonomous_distributed_branch"

    def test_state_after_fault_is_emergency_stop(self):
        """폴트 후 대피 상태가 emergency_stop"""
        daemon = PHMKernelDaemon()
        daemon.ingest_sample(make_sample(resistance=2.8, timestamp_ms=5000.0))
        status = daemon.get_autonomous_evacuation_status()
        assert status["state"] == "emergency_stop"


# ─────────────────────────────────────────────
# 9. 멀티노드 동시 센싱
# ─────────────────────────────────────────────

class TestMultiNodeConcurrency:

    def test_concurrent_node_ingestion(self):
        """멀티스레드 동시 센싱 시 데이터 무결성"""
        daemon = PHMKernelDaemon()
        errors: list[Exception] = []

        def ingest_node(node_id: str, count: int):
            try:
                for i in range(count):
                    s = make_sample(
                        node_id=node_id,
                        resistance=0.3 + i * 0.01,
                        timestamp_ms=float(i * 100),
                    )
                    daemon.ingest_sample(s)
            except Exception as e:
                errors.append(e)

        threads = [
            threading.Thread(target=ingest_node, args=(f"NODE_{i}", 50))
            for i in range(5)
        ]
        for t in threads:
            t.start()
        for t in threads:
            t.join()

        assert len(errors) == 0
        assert daemon.tracker.sample_count == 250
        assert len(daemon.tracker.get_all_node_ids()) == 5


# ─────────────────────────────────────────────
# 10. 통합 시나리오: 전체 라이프사이클
# ─────────────────────────────────────────────

class TestIntegratedLifecycle:

    def test_full_lifecycle_nominal_to_fault(self):
        """정상 → 열화 → 폴트 → 비상정지 전체 사이클"""
        daemon = PHMKernelDaemon(atr_id="ATR_LIFECYCLE")

        # Phase 1: 정상 동작
        for i in range(10):
            s = make_sample(resistance=0.3 + i * 0.02, timestamp_ms=float(i * 1000))
            fault = daemon.ingest_sample(s)
            assert fault is None

        assert daemon.state == HarnessState.NOMINAL

        # Phase 2: 열화 진행
        s_degraded = make_sample(resistance=1.25, timestamp_ms=20000.0)
        fault = daemon.ingest_sample(s_degraded)
        assert fault is None
        assert daemon.state == HarnessState.DEGRADED

        # Phase 3: 폴트 발생 (2.8Ω 인젝션)
        start_ns = time.perf_counter_ns()
        s_fault = make_sample(resistance=2.8, timestamp_ms=30000.0)
        fault = daemon.ingest_sample(s_fault)
        end_ns = time.perf_counter_ns()

        assert fault is not None
        assert daemon.state == HarnessState.EMERGENCY_STOP
        assert daemon.safety_chain.interlock_active

        # 타이밍 검증
        elapsed_ms = (end_ns - start_ns) / 1_000_000
        assert elapsed_ms < INTERLOCK_DEADLINE_MS

        # 거버넌스 로그 검증
        assert len(daemon.governance_log) == 1
        entry = daemon.governance_log[0]
        assert entry.atr_id == "ATR_LIFECYCLE"
        assert entry.governance_registry == PATENT_GOVERNANCE_MDM
        assert len(entry.interlock_records) == 4

    def test_multiple_faults_only_first_triggers_chain(self):
        """연속 폴트 시 첫 번째만 체인 구동 (이미 비상정지 상태)"""
        daemon = PHMKernelDaemon()

        # 첫 번째 폴트
        daemon.ingest_sample(make_sample(resistance=2.8, timestamp_ms=1000.0))
        assert daemon.state == HarnessState.EMERGENCY_STOP
        assert len(daemon.governance_log) == 1

        # 두 번째 폴트 (체인은 이미 활성)
        daemon.ingest_sample(make_sample(resistance=3.5, timestamp_ms=2000.0))
        assert len(daemon.governance_log) == 2
        assert daemon.safety_chain.current_stage == InterlockStage.COMPLETED
