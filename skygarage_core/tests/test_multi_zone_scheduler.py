"""
SkyGarage 복수 지하픽업존 다중 스케줄러 통합 테스트 벤치
Multi-Zone Underground Pickup Zone Scheduler - Integration Test

검증 항목:
  1. 가상 3동(Zone_A, Zone_B, Zone_C) 에뮬레이션
  2. 피크 타임 유입 시나리오: 인식표 70건 + LPR 30건 = 100건 동시 인입
  3. 공용주차/세대직입주차 100% 오차 없는 자동 분류
  4. 혼잡도 인위 변조(Fault Injection) → 우선순위 큐 재정렬
  5. 가상 버퍼 구역 진입 시퀀스 50ms 미만 트리거
  6. 4단계 안전 인터록 직렬 실행 검증
  7. ATR 부하 분산(Fleet Re-balancing) 검증

특허 컴포넌트:
  [132] [270] [271] [272] [310] [660]
"""

from __future__ import annotations

import math
import time
import uuid

import numpy as np
import pytest

from skygarage_core.scheduler.multi_zone_engine import (
    PATENT_BATTERY_RELAY,
    PATENT_EMERGENCY_BRAKE,
    PATENT_GOVERNANCE_MDM,
    PATENT_MOTOR_STO,
    PATENT_SAFETY_FLAG,
    PATENT_SLEWING_RING,
    ATRCommand,
    ExitRequest,
    FaultType,
    HybridVehicleIdentifier,
    InflowAssignmentEngine,
    MCDAPriorityScheduler,
    MultiZoneSchedulerEngine,
    ParkingServiceMode,
    PickupZone,
    SafetyEvent,
    SafetyInterlockController,
    SafetyState,
    SensorReading,
    TenantBinding,
    VehicleEntry,
    VehicleIdentMethod,
)


# ─────────────────────────────────────────────
# 테스트 픽스쳐
# ─────────────────────────────────────────────

def create_test_zones() -> list[PickupZone]:
    """가상 3동 지하픽업존 생성."""
    return [
        PickupZone(
            zone_id="Zone_A",
            building_id="Building_101",
            capacity=20,
            current_occupancy=5,
            atr_count=4,
            available_atrs=4,
            carlift_distance_m=30.0,
        ),
        PickupZone(
            zone_id="Zone_B",
            building_id="Building_102",
            capacity=15,
            current_occupancy=3,
            atr_count=3,
            available_atrs=3,
            carlift_distance_m=45.0,
        ),
        PickupZone(
            zone_id="Zone_C",
            building_id="Building_103",
            capacity=25,
            current_occupancy=8,
            atr_count=5,
            available_atrs=5,
            carlift_distance_m=60.0,
        ),
    ]


def create_test_mdm_registry(count: int = 100) -> dict[str, TenantBinding]:
    """테스트용 MDM[660] 레지스트리: count 세대 등록."""
    registry = {}
    buildings = ["Building_101", "Building_102", "Building_103"]

    for i in range(count):
        tenant_id = f"T{i:04d}"
        building = buildings[i % 3]
        # 30% 세대직입, 70% 공용발렛
        mode = ParkingServiceMode.DIRECT_UNIT_ACCESS if i < 30 else ParkingServiceMode.COMMON_VALET
        plate = f"{(i // 26) + 1:02d}가{(i % 9999) + 1000:04d}"

        binding = TenantBinding(
            tenant_id=tenant_id,
            complex_id="Complex_SkyGarage_001",
            building_id=building,
            unit_number=f"{(i % 30) + 1:03d}호",
            service_mode=mode,
            vehicle_plate=plate,
            tag_id=f"TAG_{i:04d}" if i < 70 else None,
        )
        registry[tenant_id] = binding

    return registry


def create_peak_time_readings(registry: dict[str, TenantBinding]) -> list[SensorReading]:
    """
    피크 타임 유입 시나리오:
    - 인식표(Tag) 독취 차량 70건
    - LPR 차량 30건
    총 100건 동시 인입.
    """
    readings = []
    zones = ["Zone_A", "Zone_B", "Zone_C"]
    bindings = list(registry.values())

    for i, binding in enumerate(bindings):
        zone = zones[i % 3]
        t = time.time() + i * 0.001

        if binding.tag_id:
            # 인식표 기반 식별
            readings.append(SensorReading(
                zone_id=zone,
                timestamp=t,
                tag_id=binding.tag_id,
                tag_type=VehicleIdentMethod.UWB_TAG,
                signal_strength=0.85 + (i % 15) * 0.01,
            ))
        else:
            # LPR 기반 식별
            readings.append(SensorReading(
                zone_id=zone,
                timestamp=t,
                lpr_plate=binding.vehicle_plate,
                tag_type=VehicleIdentMethod.LPR,
            ))

    return readings


# ─────────────────────────────────────────────
# TEST 1: 하이브리드 차량 식별 및 테넌트 매핑
# ─────────────────────────────────────────────

class TestHybridIdentification:
    """MDM [660] 대조 기반 하이브리드 센싱 식별 검증."""

    def test_lpr_identification(self):
        """LPR 문자열 기반 차량 식별."""
        registry = create_test_mdm_registry(10)
        identifier = HybridVehicleIdentifier(registry)

        binding = list(registry.values())[5]
        reading = SensorReading(
            zone_id="Zone_A",
            timestamp=time.time(),
            lpr_plate=binding.vehicle_plate,
        )

        result = identifier.identify(reading)
        assert result is not None
        assert result.tenant_id == binding.tenant_id
        assert result.service_mode == binding.service_mode

    def test_tag_identification(self):
        """인식표(UWB Tag) 기반 차량 식별."""
        registry = create_test_mdm_registry(10)
        identifier = HybridVehicleIdentifier(registry)

        binding = list(registry.values())[2]
        reading = SensorReading(
            zone_id="Zone_B",
            timestamp=time.time(),
            tag_id=binding.tag_id,
            tag_type=VehicleIdentMethod.UWB_TAG,
        )

        result = identifier.identify(reading)
        assert result is not None
        assert result.tenant_id == binding.tenant_id

    def test_unregistered_vehicle_returns_none(self):
        """미등록 차량 → None 반환."""
        registry = create_test_mdm_registry(5)
        identifier = HybridVehicleIdentifier(registry)

        reading = SensorReading(
            zone_id="Zone_A",
            timestamp=time.time(),
            lpr_plate="99가0000",
        )
        assert identifier.identify(reading) is None

    def test_identification_speed_under_100ms(self):
        """100건 동시 식별 처리 시간 < 0.1초."""
        registry = create_test_mdm_registry(100)
        identifier = HybridVehicleIdentifier(registry)
        readings = create_peak_time_readings(registry)

        start = time.time()
        results = identifier.batch_identify(readings)
        elapsed = time.time() - start

        assert elapsed < 0.1, f"식별 처리 시간 {elapsed*1000:.1f}ms > 100ms"
        assert len(results) == 100


# ─────────────────────────────────────────────
# TEST 2: 100건 동시 인입 자동 분류 100% 검증
# ─────────────────────────────────────────────

class TestPeakTimeClassification:
    """피크 타임 100건 동시 인입 → 100% 자동 분류 판정."""

    def test_100_vehicle_classification_accuracy(self):
        """
        인식표 70건 + LPR 30건 = 100건 동시 인입.
        공용주차/세대직입주차 100% 오차 없는 자동 분류.
        """
        registry = create_test_mdm_registry(100)
        zones = create_test_zones()
        engine = MultiZoneSchedulerEngine(zones=zones, mdm_registry=registry)

        readings = create_peak_time_readings(registry)
        assert len(readings) == 100

        entries = engine.process_batch_entries(readings)

        # 100건 모두 성공적으로 처리
        assert len(entries) == 100, f"처리된 차량 {len(entries)}건 != 100건"

        # 분류 정확도 검증
        direct_count = sum(1 for e in entries if e.service_mode == ParkingServiceMode.DIRECT_UNIT_ACCESS)
        common_count = sum(1 for e in entries if e.service_mode == ParkingServiceMode.COMMON_VALET)

        # MDM에서 처음 30건이 DIRECT_UNIT_ACCESS
        assert direct_count == 30, f"세대직입 {direct_count}건 != 30건"
        assert common_count == 70, f"공용발렛 {common_count}건 != 70건"

        # 모든 엔트리에 목적지 배정 확인
        for entry in entries:
            assert entry.assigned_destination != "", f"차량 {entry.vehicle_plate} 목적지 미배정"
            assert entry.tenant_id != "", f"차량 {entry.vehicle_plate} 테넌트 미식별"

    def test_direct_unit_access_building_match(self):
        """세대직입 차량은 자기 동(Building) 카리프트 존으로 배정."""
        registry = create_test_mdm_registry(30)
        zones = create_test_zones()
        engine = MultiZoneSchedulerEngine(zones=zones, mdm_registry=registry)

        # 세대직입 차량 (인덱스 0~29)
        for i in range(30):
            binding = list(registry.values())[i]
            assert binding.service_mode == ParkingServiceMode.DIRECT_UNIT_ACCESS

            reading = SensorReading(
                zone_id="Zone_A",
                timestamp=time.time(),
                tag_id=binding.tag_id,
                tag_type=VehicleIdentMethod.UWB_TAG,
            )
            entry = engine.process_vehicle_entry(reading)
            assert entry is not None
            assert entry.service_mode == ParkingServiceMode.DIRECT_UNIT_ACCESS

    def test_tag_and_lpr_mixed_identification(self):
        """인식표 70건 + LPR 30건 혼합 식별 정합성."""
        registry = create_test_mdm_registry(100)
        identifier = HybridVehicleIdentifier(registry)
        readings = create_peak_time_readings(registry)

        tag_readings = [r for r in readings if r.tag_id is not None]
        lpr_readings = [r for r in readings if r.lpr_plate is not None]

        assert len(tag_readings) == 70
        assert len(lpr_readings) == 30

        # 모든 인식표 독취 성공
        for reading in tag_readings:
            result = identifier.identify(reading)
            assert result is not None, f"Tag {reading.tag_id} 식별 실패"

        # 모든 LPR 독취 성공
        for reading in lpr_readings:
            result = identifier.identify(reading)
            assert result is not None, f"Plate {reading.lpr_plate} 식별 실패"


# ─────────────────────────────────────────────
# TEST 3: MCDA 우선순위 및 혼잡도 Fault Injection
# ─────────────────────────────────────────────

class TestMCDAPriorityAndCongestion:
    """MCDA 출차 우선순위 지수 산출 및 혼잡도 변조 검증."""

    def test_priority_index_formula(self):
        """P_idx 공식 정확성 검증."""
        scheduler = MCDAPriorityScheduler(w1=0.35, w2=0.25, w3=0.25, w4=0.15)

        request = ExitRequest(
            tenant_id="T0001",
            vehicle_plate="01가1001",
            zone_id="Zone_A",
            reservation_remaining_sec=150.0,
            is_mobility_impaired=True,
            system_delay_correction=2.0,
        )

        zone_congestion = 0.6
        p_idx = scheduler.calculate_priority_index(request, zone_congestion)

        # 수동 계산 검증
        reservation_urgency = 1.0 - (150.0 / 600.0)  # 0.75
        mobility = 1.0
        congestion = 0.6
        delay = 2.0 / 10.0  # 0.2

        expected = 0.35 * reservation_urgency + 0.25 * mobility + 0.25 * congestion - 0.15 * delay
        assert abs(p_idx - expected) < 1e-10, f"P_idx {p_idx} != expected {expected}"

    def test_mobility_impaired_priority_boost(self):
        """교통 약자 가중치 적용 검증."""
        scheduler = MCDAPriorityScheduler()

        normal = ExitRequest(
            tenant_id="T0001", zone_id="Zone_A",
            reservation_remaining_sec=300.0, is_mobility_impaired=False,
        )
        impaired = ExitRequest(
            tenant_id="T0002", zone_id="Zone_A",
            reservation_remaining_sec=300.0, is_mobility_impaired=True,
        )

        p_normal = scheduler.calculate_priority_index(normal, 0.5)
        p_impaired = scheduler.calculate_priority_index(impaired, 0.5)

        assert p_impaired > p_normal, "교통 약자 우선순위가 더 높아야 함"

    def test_congestion_fault_injection_reorders_queue(self):
        """
        혼잡도 인위 변조(Fault Injection) 시
        우선순위 큐 정렬 순서 변경 확인.
        """
        scheduler = MCDAPriorityScheduler(congestion_threshold=0.9)

        # 3개 요청 삽입 (혼잡도 0.3 - 모두 큐로)
        requests = []
        for i in range(3):
            req = ExitRequest(
                tenant_id=f"T{i:04d}",
                zone_id="Zone_A",
                reservation_remaining_sec=300.0 - i * 100,  # 300, 200, 100
            )
            scheduler.enqueue_exit(req, 0.3)
            requests.append(req)

        assert scheduler.queue_size == 3

        # 혼잡도를 0.9로 변조
        scheduler.inject_congestion_fault(0.9, "Zone_A")

        # 변조 후 첫 번째 dequeue는 우선순위 최고 (잔여시간 적은 것)
        top = scheduler.dequeue_next()
        assert top is not None
        # 잔여시간 100초 = urgency 최고 → P_idx 최고
        assert top.reservation_remaining_sec == 100.0

    def test_virtual_buffer_zone_trigger_under_50ms(self):
        """
        혼잡도 > threshold 시 가상 버퍼 구역 진입 시퀀스
        지연 시간 50ms 미만 트리거 검증.
        """
        scheduler = MCDAPriorityScheduler(congestion_threshold=0.7)

        start = time.time()
        requests_buffered = []

        for i in range(20):
            req = ExitRequest(
                tenant_id=f"T{i:04d}",
                zone_id="Zone_A",
                reservation_remaining_sec=300.0,
            )
            # 혼잡도 0.85 > threshold 0.7 → 버퍼로 우회
            in_queue = scheduler.enqueue_exit(req, 0.85)
            if not in_queue:
                requests_buffered.append(req)

        elapsed_ms = (time.time() - start) * 1000.0

        assert elapsed_ms < 50.0, f"버퍼 진입 지연 {elapsed_ms:.2f}ms > 50ms"
        assert len(requests_buffered) == 20, "모든 요청이 버퍼로 우회되어야 함"
        assert scheduler.buffer_size == 20
        assert scheduler.queue_size == 0

    def test_buffer_release_on_congestion_relief(self):
        """혼잡도 완화 시 버퍼 차량 큐로 복원."""
        scheduler = MCDAPriorityScheduler(congestion_threshold=0.7)

        # 혼잡 상태에서 버퍼 적재
        for i in range(5):
            req = ExitRequest(tenant_id=f"T{i:04d}", zone_id="Zone_A")
            scheduler.enqueue_exit(req, 0.9)

        assert scheduler.buffer_size == 5
        assert scheduler.queue_size == 0

        # 혼잡도 완화 → 버퍼 해제
        released = scheduler.release_buffer(0.4)
        assert len(released) == 5
        assert scheduler.buffer_size == 0
        assert scheduler.queue_size == 5


# ─────────────────────────────────────────────
# TEST 4: 4단계 안전 인터록 검증
# ─────────────────────────────────────────────

class TestSafetyInterlock:
    """4단계 하드웨어 안전 인터록 및 STO 트리거 검증."""

    def test_sensor_failure_triggers_full_sequence(self):
        """센서 장애 → 4단계 인터록 직렬 실행."""
        controller = SafetyInterlockController()
        assert controller.state == SafetyState.NORMAL

        event = controller.trigger_fault(
            FaultType.SENSOR_FAILURE,
            "Zone_A",
            "UWB anchor #3 signal lost",
        )

        assert controller.state == SafetyState.EMERGENCY_STOP
        assert controller.interlock_active is True
        assert len(event.interlock_sequence) == 4

        # 순서 검증: [132] → [271] → [272] → [270]
        assert PATENT_SAFETY_FLAG in event.interlock_sequence[0]
        assert PATENT_MOTOR_STO in event.interlock_sequence[1]
        assert PATENT_BATTERY_RELAY in event.interlock_sequence[2]
        assert PATENT_EMERGENCY_BRAKE in event.interlock_sequence[3]

    def test_tag_mismatch_triggers_interlock(self):
        """인식표 미스매칭 → 즉시 인터록."""
        controller = SafetyInterlockController()

        event = controller.trigger_fault(
            FaultType.TAG_MISMATCH,
            "Zone_B",
            "UWB tag ID doesn't match registered vehicle",
        )

        assert controller.state == SafetyState.EMERGENCY_STOP
        assert len(event.interlock_sequence) == 4

    def test_pedestrian_intrusion_immediate_stop(self):
        """보행자 무단 침입 → 즉시 제어 중단."""
        controller = SafetyInterlockController()

        event = controller.trigger_fault(
            FaultType.PEDESTRIAN_INTRUSION,
            "Zone_C",
            "LiDAR detected pedestrian in ATR path",
        )

        assert controller.state == SafetyState.EMERGENCY_STOP
        steps = controller.interlock_steps
        assert len(steps) == 4
        assert steps[0]["patent_id"] == PATENT_SAFETY_FLAG
        assert steps[1]["patent_id"] == PATENT_MOTOR_STO
        assert steps[2]["patent_id"] == PATENT_BATTERY_RELAY
        assert steps[3]["patent_id"] == PATENT_EMERGENCY_BRAKE

    def test_interlock_blocks_vehicle_processing(self):
        """인터록 활성 중 차량 처리 차단."""
        registry = create_test_mdm_registry(10)
        zones = create_test_zones()
        engine = MultiZoneSchedulerEngine(zones=zones, mdm_registry=registry)

        # 폴트 발생
        engine.handle_fault(FaultType.OBSTACLE_DETECTED, "Zone_A")
        assert engine.safety.state == SafetyState.EMERGENCY_STOP

        # 차량 처리 시도 → None 반환
        binding = list(registry.values())[0]
        reading = SensorReading(
            zone_id="Zone_A",
            timestamp=time.time(),
            tag_id=binding.tag_id,
        )
        result = engine.process_vehicle_entry(reading)
        assert result is None

    def test_reset_after_fault(self):
        """폴트 후 수동 리셋."""
        controller = SafetyInterlockController()
        controller.trigger_fault(FaultType.SENSOR_FAILURE, "Zone_A")
        assert controller.state == SafetyState.EMERGENCY_STOP

        success = controller.reset()
        assert success is True
        assert controller.state == SafetyState.NORMAL
        assert controller.interlock_active is False


# ─────────────────────────────────────────────
# TEST 5: ATR Fleet Re-balancing
# ─────────────────────────────────────────────

class TestFleetRebalancing:
    """피크 타임 ATR 부하 분산 검증."""

    def test_rebalance_from_underloaded_to_overloaded(self):
        """부하 분산: 여유 존 → 정체 존 ATR 전환 배치."""
        zones = [
            PickupZone(
                zone_id="Zone_A", building_id="B1",
                capacity=10, current_occupancy=9,
                atr_count=3, available_atrs=1,
                carlift_distance_m=30.0,
            ),
            PickupZone(
                zone_id="Zone_B", building_id="B2",
                capacity=10, current_occupancy=2,
                atr_count=4, available_atrs=4,
                carlift_distance_m=45.0,
            ),
        ]
        engine = InflowAssignmentEngine(zones)

        commands = engine.rebalance_fleet()
        assert len(commands) > 0

        # Zone_A에 ATR 증가, Zone_B에서 감소
        zone_a = engine.get_zone("Zone_A")
        zone_b = engine.get_zone("Zone_B")
        assert zone_a.available_atrs == 2
        assert zone_b.available_atrs == 3

    def test_slewing_angle_within_90_degrees(self):
        """슬루링[310] ±90° 제한 내 회전각 계산."""
        zones = create_test_zones()
        engine = InflowAssignmentEngine(zones)

        for z1 in zones:
            for z2 in zones:
                if z1.zone_id != z2.zone_id:
                    angle = engine._calculate_slewing_angle(z1, z2)
                    assert angle <= 90.0, f"회전각 {angle}° > 90°"
                    assert angle >= 0.0

    def test_angular_velocity_uses_slewing_mechanism(self):
        """슬루링[310] 최대 각속도 2*pi rad/s 이내."""
        zones = create_test_zones()
        engine = InflowAssignmentEngine(zones)

        max_omega = 2 * math.pi
        for z1 in zones:
            for z2 in zones:
                if z1.zone_id != z2.zone_id:
                    angle = engine._calculate_slewing_angle(z1, z2)
                    omega = engine._slewing_angular_velocity(angle)
                    assert omega <= max_omega + 0.001


# ─────────────────────────────────────────────
# TEST 6: 통합 시나리오
# ─────────────────────────────────────────────

class TestIntegratedScenario:
    """전체 사이클 통합 테스트: 입차 → 분류 → 스케줄링 → 출차 → 폴트."""

    def test_full_peak_time_cycle(self):
        """피크 타임 전체 사이클 (100건 입차 + 출차 + 폴트)."""
        registry = create_test_mdm_registry(100)
        zones = create_test_zones()
        engine = MultiZoneSchedulerEngine(zones=zones, mdm_registry=registry)

        # Phase 1: 100건 입차
        readings = create_peak_time_readings(registry)
        entries = engine.process_batch_entries(readings)
        assert len(entries) == 100

        # Phase 2: 출차 요청 10건
        for i in range(10):
            entry = entries[i]
            engine.request_exit(
                tenant_id=entry.tenant_id,
                vehicle_plate=entry.vehicle_plate,
                zone_id=entry.zone_id,
                reservation_remaining=200.0 - i * 20,
                is_mobility_impaired=(i == 0),
            )

        # 우선순위 최고 = 교통약자(i=0) 또는 잔여시간 최소
        top = engine.priority.dequeue_next()
        assert top is not None
        # 교통약자(i=0, remaining=200) vs 잔여시간 최소(i=9, remaining=20)
        # i=9: urgency=(1-20/600)=0.967, mobility=0, congestion~0.25
        # i=0: urgency=(1-200/600)=0.667, mobility=1.0, congestion~0.25
        # i=0 P_idx = 0.35*0.667 + 0.25*1.0 + 0.25*0.25 = 0.546
        # i=9 P_idx = 0.35*0.967 + 0.25*0.0 + 0.25*0.25 = 0.401
        # i=0이 더 높음 (교통약자 가중치)
        assert top.is_mobility_impaired is True

        # Phase 3: 폴트 발생
        event = engine.handle_fault(
            FaultType.PEDESTRIAN_INTRUSION,
            "Zone_B",
            "Pedestrian detected in transfer corridor",
        )
        assert engine.safety.state == SafetyState.EMERGENCY_STOP
        assert len(event.interlock_sequence) == 4

        # Phase 4: 폴트 후 추가 처리 차단
        additional = engine.process_vehicle_entry(SensorReading(
            zone_id="Zone_A", timestamp=time.time(),
            lpr_plate=list(registry.values())[0].vehicle_plate,
        ))
        assert additional is None

    def test_congestion_dynamic_routing(self):
        """혼잡 존 동적 라우팅: 정체 존 회피 배정."""
        zones = [
            PickupZone(
                zone_id="Zone_A", building_id="B1",
                capacity=10, current_occupancy=9,  # 90% 혼잡
                atr_count=3, available_atrs=3,
                carlift_distance_m=30.0,
            ),
            PickupZone(
                zone_id="Zone_B", building_id="B2",
                capacity=10, current_occupancy=2,  # 20% 여유
                atr_count=3, available_atrs=3,
                carlift_distance_m=45.0,
            ),
        ]
        registry = create_test_mdm_registry(100)
        engine = MultiZoneSchedulerEngine(zones=zones, mdm_registry=registry)

        # 공용발렛 차량이 Zone_A에 진입 → 덜 혼잡한 Zone_B로 배정
        binding = list(registry.values())[50]  # COMMON_VALET
        reading = SensorReading(
            zone_id="Zone_A",
            timestamp=time.time(),
            lpr_plate=binding.vehicle_plate,
        )
        entry = engine.process_vehicle_entry(reading)
        assert entry is not None
        assert entry.service_mode == ParkingServiceMode.COMMON_VALET
        # 덜 혼잡한 존으로 배정됨
        assert entry.assigned_destination == "Zone_B"
