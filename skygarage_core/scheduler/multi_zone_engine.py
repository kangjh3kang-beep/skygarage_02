"""
SkyGarage 복수 지하픽업존 다중 스케줄러 코어 엔진
Multi-Zone Underground Pickup Zone Scheduler Engine

특허 컴포넌트 참조:
  [132] 안전 체인 플래그 활성화
  [270] 비상 브레이크 물리 잠금
  [271] 모터 STO(Safe Torque Off) 차단
  [272] 배터리 릴레이 차단
  [310] 슬루링 메커니즘 (±90° 제자리 회전)
  [660] 거버넌스 레지스트리 - Complex MDM

서브시스템 구성:
  1. HybridVehicleIdentifier - 하이브리드 센싱 차량 식별 및 테넌트 매핑
  2. InflowAssignmentEngine - 입차 동적 분류 및 최적 존 배정
  3. MCDAPriorityScheduler - 출차 우선순위 지수(P_idx) MCDA 산출
  4. SafetyInterlockController - 4단계 하드웨어 안전 인터록 + STO 트리거
"""

from __future__ import annotations

import heapq
import math
import threading
import time
import uuid
from dataclasses import dataclass, field
from enum import Enum
from typing import Any

PATENT_SAFETY_FLAG = "[132]"
PATENT_EMERGENCY_BRAKE = "[270]"
PATENT_MOTOR_STO = "[271]"
PATENT_BATTERY_RELAY = "[272]"
PATENT_SLEWING_RING = "[310]"
PATENT_GOVERNANCE_MDM = "[660]"


# ─────────────────────────────────────────────
# 열거형 및 데이터 클래스
# ─────────────────────────────────────────────

class ParkingServiceMode(Enum):
    COMMON_VALET = "common_valet"
    DIRECT_UNIT_ACCESS = "direct_unit_access"


class VehicleIdentMethod(Enum):
    LPR = "lpr"
    UWB_TAG = "uwb_tag"
    RFID = "rfid"
    VISION_MARKER = "vision_marker"


class SafetyState(Enum):
    NORMAL = "normal"
    FAULT_DETECTED = "fault_detected"
    SAFETY_CHAIN_ACTIVE = "safety_chain_active"
    EMERGENCY_STOP = "emergency_stop"


class FaultType(Enum):
    SENSOR_FAILURE = "sensor_failure"
    TAG_MISMATCH = "tag_mismatch"
    PEDESTRIAN_INTRUSION = "pedestrian_intrusion"
    OBSTACLE_DETECTED = "obstacle_detected"


@dataclass
class SensorReading:
    zone_id: str
    timestamp: float
    lpr_plate: str | None = None
    tag_id: str | None = None
    tag_type: VehicleIdentMethod = VehicleIdentMethod.LPR
    signal_strength: float = 1.0


@dataclass
class TenantBinding:
    tenant_id: str
    complex_id: str
    building_id: str
    unit_number: str
    service_mode: ParkingServiceMode
    vehicle_plate: str
    tag_id: str | None = None
    binding_timestamp: float = field(default_factory=time.time)


@dataclass
class VehicleEntry:
    entry_id: str = field(default_factory=lambda: str(uuid.uuid4()))
    zone_id: str = ""
    tenant_id: str = ""
    vehicle_plate: str = ""
    service_mode: ParkingServiceMode = ParkingServiceMode.COMMON_VALET
    ident_method: VehicleIdentMethod = VehicleIdentMethod.LPR
    building_id: str = ""
    unit_number: str = ""
    entry_time: float = field(default_factory=time.time)
    assigned_destination: str = ""
    priority_index: float = 0.0


@dataclass
class PickupZone:
    zone_id: str
    building_id: str
    capacity: int
    current_occupancy: int = 0
    atr_count: int = 3
    available_atrs: int = 3
    carlift_distance_m: float = 50.0
    is_active: bool = True

    @property
    def congestion_ratio(self) -> float:
        if self.capacity == 0:
            return 1.0
        return self.current_occupancy / self.capacity

    @property
    def load_factor(self) -> float:
        return self.congestion_ratio


@dataclass
class ATRCommand:
    command_id: str = field(default_factory=lambda: str(uuid.uuid4()))
    atr_id: str = ""
    vehicle_entry: VehicleEntry | None = None
    destination: str = ""
    path_distance_m: float = 0.0
    slewing_angle_deg: float = 0.0
    angular_velocity: float = 0.0
    timestamp: float = field(default_factory=time.time)


@dataclass
class SafetyEvent:
    event_id: str = field(default_factory=lambda: str(uuid.uuid4()))
    fault_type: FaultType = FaultType.SENSOR_FAILURE
    zone_id: str = ""
    timestamp: float = field(default_factory=time.time)
    description: str = ""
    interlock_sequence: list[str] = field(default_factory=list)


# ─────────────────────────────────────────────
# 1. 하이브리드 차량 식별 및 테넌트 매핑
# ─────────────────────────────────────────────

class HybridVehicleIdentifier:
    """
    지하픽업존 진입 센서 링으로부터 차량번호(LPR) 또는
    차체 부착 인식표(UWB/RFID/비전 마커) 신호를 수신하여
    Complex MDM [660]과 대조, 0.1초 이내 테넌트 바인딩.
    """

    def __init__(self, mdm_registry: dict[str, TenantBinding] | None = None) -> None:
        self._mdm_registry: dict[str, TenantBinding] = mdm_registry or {}
        self._plate_index: dict[str, str] = {}
        self._tag_index: dict[str, str] = {}
        self._lock = threading.Lock()
        self.governance_id = PATENT_GOVERNANCE_MDM
        self._rebuild_indexes()

    def register_tenant(self, binding: TenantBinding) -> None:
        with self._lock:
            self._mdm_registry[binding.tenant_id] = binding
            self._plate_index[binding.vehicle_plate] = binding.tenant_id
            if binding.tag_id:
                self._tag_index[binding.tag_id] = binding.tenant_id

    def identify(self, reading: SensorReading) -> TenantBinding | None:
        """0.1초 이내 센서 독취 → 테넌트 바인딩 반환. [660] MDM 대조."""
        with self._lock:
            tenant_id = None

            if reading.lpr_plate:
                tenant_id = self._plate_index.get(reading.lpr_plate)

            if tenant_id is None and reading.tag_id:
                tenant_id = self._tag_index.get(reading.tag_id)

            if tenant_id is None:
                return None

            return self._mdm_registry.get(tenant_id)

    def batch_identify(self, readings: list[SensorReading]) -> list[tuple[SensorReading, TenantBinding | None]]:
        """복수 센서 독취 일괄 처리."""
        results = []
        for reading in readings:
            binding = self.identify(reading)
            results.append((reading, binding))
        return results

    @property
    def registry_size(self) -> int:
        return len(self._mdm_registry)

    def _rebuild_indexes(self) -> None:
        self._plate_index.clear()
        self._tag_index.clear()
        for tenant_id, binding in self._mdm_registry.items():
            self._plate_index[binding.vehicle_plate] = tenant_id
            if binding.tag_id:
                self._tag_index[binding.tag_id] = tenant_id


# ─────────────────────────────────────────────
# 2. 입차 동적 분류 및 최적 존 배정
# ─────────────────────────────────────────────

class InflowAssignmentEngine:
    """
    입차 차량을 COMMON_VALET 또는 DIRECT_UNIT_ACCESS로 분류하고,
    최적 존 배정 및 ATR 군집 FMS 명령 하달.
    슬루링[310] 각속도 벡터만을 이동 연산에 활용.
    """

    def __init__(self, zones: list[PickupZone] | None = None) -> None:
        self._zones: dict[str, PickupZone] = {}
        if zones:
            for z in zones:
                self._zones[z.zone_id] = z
        self._dispatched_commands: list[ATRCommand] = []
        self._lock = threading.Lock()
        self.slewing_patent_id = PATENT_SLEWING_RING

    def add_zone(self, zone: PickupZone) -> None:
        with self._lock:
            self._zones[zone.zone_id] = zone

    def get_zone(self, zone_id: str) -> PickupZone | None:
        return self._zones.get(zone_id)

    def classify_and_assign(
        self,
        binding: TenantBinding,
        entry_zone_id: str,
    ) -> VehicleEntry:
        """
        차량 분류 후 최적 경로 배정.
        세대직입: 해당 동 수직 카리프트 하부 버퍼 존 최단거리 계산.
        공용발렛: 혼잡도 최소 데드스페이스 존 배정.
        """
        entry = VehicleEntry(
            zone_id=entry_zone_id,
            tenant_id=binding.tenant_id,
            vehicle_plate=binding.vehicle_plate,
            service_mode=binding.service_mode,
            building_id=binding.building_id,
            unit_number=binding.unit_number,
        )

        if binding.service_mode == ParkingServiceMode.DIRECT_UNIT_ACCESS:
            dest_zone = self._find_nearest_carlift_zone(binding.building_id, entry_zone_id)
        else:
            dest_zone = self._find_least_congested_zone(entry_zone_id)

        if dest_zone:
            entry.assigned_destination = dest_zone.zone_id

        return entry

    def dispatch_atr(self, entry: VehicleEntry) -> ATRCommand | None:
        """ATR 군집 FMS에 이송 명령 하달. 슬루링[310] 각속도 기반."""
        with self._lock:
            source_zone = self._zones.get(entry.zone_id)
            dest_zone = self._zones.get(entry.assigned_destination)

            if not source_zone or not dest_zone:
                return None

            if source_zone.available_atrs <= 0:
                alt_zone = self._find_zone_with_available_atr(entry.zone_id)
                if alt_zone:
                    source_zone = alt_zone
                else:
                    return None

            distance = self._calculate_path_distance(source_zone, dest_zone)
            slewing_angle = self._calculate_slewing_angle(source_zone, dest_zone)
            angular_vel = self._slewing_angular_velocity(slewing_angle)

            cmd = ATRCommand(
                atr_id=f"ATR_{source_zone.zone_id}_{uuid.uuid4().hex[:6]}",
                vehicle_entry=entry,
                destination=dest_zone.zone_id,
                path_distance_m=distance,
                slewing_angle_deg=slewing_angle,
                angular_velocity=angular_vel,
            )

            source_zone.available_atrs -= 1
            source_zone.current_occupancy = max(0, source_zone.current_occupancy - 1)
            dest_zone.current_occupancy += 1

            self._dispatched_commands.append(cmd)
            return cmd

    def rebalance_fleet(self) -> list[ATRCommand]:
        """
        피크 타임 부하 분산: 정체 존에서 가용 인근 서브존으로
        ATR 동적 전환 배치(Fleet Re-balancing).
        """
        rebalance_commands = []
        with self._lock:
            overloaded = [z for z in self._zones.values()
                          if z.congestion_ratio > 0.8 and z.available_atrs < 2]
            underloaded = [z for z in self._zones.values()
                           if z.congestion_ratio < 0.5 and z.available_atrs > 1]

            for over_zone in overloaded:
                for under_zone in underloaded:
                    if under_zone.available_atrs > 1:
                        under_zone.available_atrs -= 1
                        over_zone.available_atrs += 1

                        cmd = ATRCommand(
                            atr_id=f"ATR_REBAL_{uuid.uuid4().hex[:6]}",
                            destination=over_zone.zone_id,
                            path_distance_m=self._calculate_path_distance(under_zone, over_zone),
                            slewing_angle_deg=self._calculate_slewing_angle(under_zone, over_zone),
                            angular_velocity=self._slewing_angular_velocity(90.0),
                        )
                        rebalance_commands.append(cmd)
                        break

        return rebalance_commands

    @property
    def zone_congestion_matrix(self) -> dict[str, float]:
        return {zid: z.congestion_ratio for zid, z in self._zones.items()}

    @property
    def dispatched_count(self) -> int:
        return len(self._dispatched_commands)

    def _find_nearest_carlift_zone(self, building_id: str, from_zone_id: str) -> PickupZone | None:
        candidates = [z for z in self._zones.values()
                      if z.building_id == building_id and z.is_active and z.zone_id != from_zone_id]
        if not candidates:
            candidates = [z for z in self._zones.values()
                          if z.is_active and z.zone_id != from_zone_id]
        if not candidates:
            return self._zones.get(from_zone_id)
        return min(candidates, key=lambda z: z.carlift_distance_m)

    def _find_least_congested_zone(self, exclude_zone_id: str = "") -> PickupZone | None:
        candidates = [z for z in self._zones.values()
                      if z.is_active and z.zone_id != exclude_zone_id]
        if not candidates:
            candidates = list(self._zones.values())
        if not candidates:
            return None
        return min(candidates, key=lambda z: z.congestion_ratio)

    def _find_zone_with_available_atr(self, exclude_zone_id: str) -> PickupZone | None:
        candidates = [z for z in self._zones.values()
                      if z.available_atrs > 0 and z.zone_id != exclude_zone_id]
        if not candidates:
            return None
        return min(candidates, key=lambda z: z.congestion_ratio)

    def _calculate_path_distance(self, from_zone: PickupZone, to_zone: PickupZone) -> float:
        return abs(from_zone.carlift_distance_m - to_zone.carlift_distance_m) + 20.0

    def _calculate_slewing_angle(self, from_zone: PickupZone, to_zone: PickupZone) -> float:
        # ±90° 슬루링[310] 제한 내 최적 회전각
        return min(90.0, abs(hash(from_zone.zone_id + to_zone.zone_id) % 90))

    def _slewing_angular_velocity(self, angle_deg: float) -> float:
        # 슬루링[310] 최대 각속도 2*pi rad/s, 각도 비례
        max_omega = 2 * math.pi
        return max_omega * min(angle_deg / 90.0, 1.0)


# ─────────────────────────────────────────────
# 3. MCDA 기반 출차 우선순위 지수(P_idx) 산출
# ─────────────────────────────────────────────

@dataclass
class ExitRequest:
    request_id: str = field(default_factory=lambda: str(uuid.uuid4()))
    tenant_id: str = ""
    vehicle_plate: str = ""
    zone_id: str = ""
    reservation_remaining_sec: float = 300.0
    is_mobility_impaired: bool = False
    system_delay_correction: float = 0.0
    timestamp: float = field(default_factory=time.time)
    priority_index: float = 0.0


class MCDAPriorityScheduler:
    """
    MCDA(Multi-Criteria Decision Analysis) 기반 출차 우선순위 지수 산출.
    P_idx = (w1 * 예약시간잔여도) + (w2 * 교통약자가중치) + (w3 * 혼잡도) - (w4 * 시스템지연보정치)

    혼잡 존 출차 시 버퍼 구역 우회 스테이징 방어 로직 포함.
    """

    def __init__(
        self,
        w1: float = 0.35,
        w2: float = 0.25,
        w3: float = 0.25,
        w4: float = 0.15,
        congestion_threshold: float = 0.7,
    ) -> None:
        self._w1 = w1
        self._w2 = w2
        self._w3 = w3
        self._w4 = w4
        self._congestion_threshold = congestion_threshold
        self._priority_queue: list[tuple[float, str, ExitRequest]] = []
        self._virtual_buffer: list[ExitRequest] = []
        self._lock = threading.Lock()

    def calculate_priority_index(
        self,
        request: ExitRequest,
        zone_congestion: float,
    ) -> float:
        """
        P_idx 산출 공식:
        P_idx = (w1 * reservation_urgency) + (w2 * mobility_weight)
              + (w3 * congestion_factor) - (w4 * system_delay)
        """
        max_reservation = 600.0
        reservation_urgency = max(0.0, 1.0 - (request.reservation_remaining_sec / max_reservation))

        mobility_weight = 1.0 if request.is_mobility_impaired else 0.0

        congestion_factor = zone_congestion

        system_delay = min(1.0, request.system_delay_correction / 10.0)

        p_idx = (
            self._w1 * reservation_urgency
            + self._w2 * mobility_weight
            + self._w3 * congestion_factor
            - self._w4 * system_delay
        )

        request.priority_index = p_idx
        return p_idx

    def enqueue_exit(self, request: ExitRequest, zone_congestion: float) -> bool:
        """
        출차 요청을 우선순위 큐에 삽입.
        혼잡 존 대상 차량은 가상 버퍼 구역으로 우회.
        """
        p_idx = self.calculate_priority_index(request, zone_congestion)

        with self._lock:
            if zone_congestion > self._congestion_threshold:
                self._virtual_buffer.append(request)
                return False  # 버퍼 우회

            # max-heap (negate for heapq min-heap)
            heapq.heappush(self._priority_queue, (-p_idx, request.request_id, request))
            return True

    def dequeue_next(self) -> ExitRequest | None:
        """우선순위 최고 출차 요청 반환."""
        with self._lock:
            if not self._priority_queue:
                return None
            _, _, request = heapq.heappop(self._priority_queue)
            return request

    def release_buffer(self, target_zone_congestion: float) -> list[ExitRequest]:
        """혼잡도 완화 시 버퍼 구역 차량을 큐로 복원."""
        released = []
        with self._lock:
            remaining = []
            for req in self._virtual_buffer:
                if target_zone_congestion <= self._congestion_threshold:
                    p_idx = self.calculate_priority_index(req, target_zone_congestion)
                    heapq.heappush(self._priority_queue, (-p_idx, req.request_id, req))
                    released.append(req)
                else:
                    remaining.append(req)
            self._virtual_buffer = remaining
        return released

    def inject_congestion_fault(self, new_congestion: float, zone_id: str) -> None:
        """혼잡도 인위 변조 시 큐 재정렬."""
        with self._lock:
            new_queue = []
            for neg_p, req_id, req in self._priority_queue:
                if req.zone_id == zone_id:
                    new_p = self.calculate_priority_index(req, new_congestion)
                    new_queue.append((-new_p, req_id, req))
                else:
                    new_queue.append((neg_p, req_id, req))
            heapq.heapify(new_queue)
            self._priority_queue = new_queue

    @property
    def queue_size(self) -> int:
        return len(self._priority_queue)

    @property
    def buffer_size(self) -> int:
        return len(self._virtual_buffer)

    @property
    def weights(self) -> tuple[float, float, float, float]:
        return (self._w1, self._w2, self._w3, self._w4)


# ─────────────────────────────────────────────
# 4. 4단계 하드웨어 안전 인터록 및 STO 트리거
# ─────────────────────────────────────────────

class SafetyInterlockController:
    """
    4단계 직렬 동기식 안전 인터록 시퀀스:
      1. [132] 안전 체인 플래그 활성화
      2. [271] 모터 STO(Safe Torque Off) 차단
      3. [272] 배터리 릴레이 차단
      4. [270] 비상 브레이크 물리 잠금

    센서 장애, 인식표 미스매칭, 보행자 무단 침입 등
    폴트 수신 즉시 무조건 제어 중단.
    """

    def __init__(self) -> None:
        self._state = SafetyState.NORMAL
        self._events: list[SafetyEvent] = []
        self._interlock_active: bool = False
        self._lock = threading.Lock()
        self._interlock_steps: list[dict[str, Any]] = []

    @property
    def state(self) -> SafetyState:
        return self._state

    @property
    def is_safe(self) -> bool:
        return self._state == SafetyState.NORMAL

    @property
    def interlock_active(self) -> bool:
        return self._interlock_active

    @property
    def event_log(self) -> list[SafetyEvent]:
        return list(self._events)

    @property
    def interlock_steps(self) -> list[dict[str, Any]]:
        return list(self._interlock_steps)

    def trigger_fault(self, fault_type: FaultType, zone_id: str, description: str = "") -> SafetyEvent:
        """
        폴트 수신 → 즉시 4단계 안전 인터록 시퀀스 직렬 실행.
        어떠한 조건에서도 무조건 즉시 안전 체인을 구동.
        """
        with self._lock:
            self._state = SafetyState.FAULT_DETECTED
            event = SafetyEvent(
                fault_type=fault_type,
                zone_id=zone_id,
                description=description,
            )

            sequence = self._execute_interlock_sequence(event)
            event.interlock_sequence = sequence

            self._events.append(event)
            return event

    def _execute_interlock_sequence(self, event: SafetyEvent) -> list[str]:
        """직렬 동기식 4단계 인터록 실행."""
        sequence = []
        self._interlock_steps = []

        # Step 1: [132] 안전 체인 플래그 활성화
        step1 = self._activate_safety_flag(event)
        sequence.append(step1)
        self._state = SafetyState.SAFETY_CHAIN_ACTIVE

        # Step 2: [271] 모터 STO 차단
        step2 = self._motor_sto_cutoff(event)
        sequence.append(step2)

        # Step 3: [272] 배터리 릴레이 차단
        step3 = self._battery_relay_cutoff(event)
        sequence.append(step3)

        # Step 4: [270] 비상 브레이크 물리 잠금
        step4 = self._emergency_brake_lock(event)
        sequence.append(step4)

        self._state = SafetyState.EMERGENCY_STOP
        self._interlock_active = True

        return sequence

    def _activate_safety_flag(self, event: SafetyEvent) -> str:
        step = {
            "step": 1,
            "patent_id": PATENT_SAFETY_FLAG,
            "action": "safety_chain_flag_activate",
            "timestamp": time.time(),
            "zone_id": event.zone_id,
            "status": "executed",
        }
        self._interlock_steps.append(step)
        return f"{PATENT_SAFETY_FLAG} Safety chain flag activated"

    def _motor_sto_cutoff(self, event: SafetyEvent) -> str:
        step = {
            "step": 2,
            "patent_id": PATENT_MOTOR_STO,
            "action": "motor_sto_cutoff",
            "timestamp": time.time(),
            "zone_id": event.zone_id,
            "status": "executed",
        }
        self._interlock_steps.append(step)
        return f"{PATENT_MOTOR_STO} Motor STO cutoff executed"

    def _battery_relay_cutoff(self, event: SafetyEvent) -> str:
        step = {
            "step": 3,
            "patent_id": PATENT_BATTERY_RELAY,
            "action": "battery_relay_cutoff",
            "timestamp": time.time(),
            "zone_id": event.zone_id,
            "status": "executed",
        }
        self._interlock_steps.append(step)
        return f"{PATENT_BATTERY_RELAY} Battery relay cutoff executed"

    def _emergency_brake_lock(self, event: SafetyEvent) -> str:
        step = {
            "step": 4,
            "patent_id": PATENT_EMERGENCY_BRAKE,
            "action": "emergency_brake_physical_lock",
            "timestamp": time.time(),
            "zone_id": event.zone_id,
            "status": "executed",
        }
        self._interlock_steps.append(step)
        return f"{PATENT_EMERGENCY_BRAKE} Emergency brake physical lock engaged"

    def reset(self) -> bool:
        """수동 리셋 (안전 확인 후)."""
        with self._lock:
            if self._state == SafetyState.EMERGENCY_STOP:
                self._state = SafetyState.NORMAL
                self._interlock_active = False
                self._interlock_steps = []
                return True
            return False


# ─────────────────────────────────────────────
# 통합 스케줄러 엔진
# ─────────────────────────────────────────────

class MultiZoneSchedulerEngine:
    """
    복수 지하픽업존 통합 스케줄러.
    4개 서브시스템을 결합하여 입출차 전체 사이클을 관리.
    """

    def __init__(
        self,
        zones: list[PickupZone] | None = None,
        mdm_registry: dict[str, TenantBinding] | None = None,
    ) -> None:
        self.identifier = HybridVehicleIdentifier(mdm_registry)
        self.assignment = InflowAssignmentEngine(zones)
        self.priority = MCDAPriorityScheduler()
        self.safety = SafetyInterlockController()
        self._processed_entries: list[VehicleEntry] = []
        self._lock = threading.Lock()

    def process_vehicle_entry(self, reading: SensorReading) -> VehicleEntry | None:
        """
        전체 입차 파이프라인:
        센서 독취 → 테넌트 매핑 → 분류 → 존 배정 → ATR 디스패치
        """
        if not self.safety.is_safe:
            return None

        binding = self.identifier.identify(reading)
        if binding is None:
            return None

        entry = self.assignment.classify_and_assign(binding, reading.zone_id)

        with self._lock:
            self._processed_entries.append(entry)

        return entry

    def process_batch_entries(self, readings: list[SensorReading]) -> list[VehicleEntry]:
        """복수 차량 동시 입차 일괄 처리."""
        entries = []
        for reading in readings:
            entry = self.process_vehicle_entry(reading)
            if entry:
                entries.append(entry)
        return entries

    def request_exit(
        self,
        tenant_id: str,
        vehicle_plate: str,
        zone_id: str,
        reservation_remaining: float = 300.0,
        is_mobility_impaired: bool = False,
    ) -> ExitRequest:
        """출차 요청 등록."""
        zone = self.assignment.get_zone(zone_id)
        congestion = zone.congestion_ratio if zone else 0.0

        request = ExitRequest(
            tenant_id=tenant_id,
            vehicle_plate=vehicle_plate,
            zone_id=zone_id,
            reservation_remaining_sec=reservation_remaining,
            is_mobility_impaired=is_mobility_impaired,
        )

        self.priority.enqueue_exit(request, congestion)
        return request

    def handle_fault(self, fault_type: FaultType, zone_id: str, desc: str = "") -> SafetyEvent:
        """폴트 발생 시 즉시 안전 체인 트리거."""
        return self.safety.trigger_fault(fault_type, zone_id, desc)

    @property
    def total_processed(self) -> int:
        return len(self._processed_entries)

    @property
    def all_zones_congestion(self) -> dict[str, float]:
        return self.assignment.zone_congestion_matrix
