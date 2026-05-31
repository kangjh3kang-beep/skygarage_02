"""
SkyGarage 클리어링 엔진 테스트 벤치
Clearing Engine - Billing, Coupon Validation & Security Injection Tests

테스트 시나리오:
  1. LPR JSON 파싱 및 차량 분류
  2. 입주민 정기 차량 무료 정산
  3. 비회원 과금 및 모바일 지갑 바인딩
  4. 가상 상가 할인 QR 쿠폰 50건 연속 검증
  5. 쿠폰 서명 위변조 차단
  6. 쿠폰 만료/중복 사용 차단
  7. B2B 크레딧 정산 및 익월 이관
  8. 인시던트 등급 분류 (P0~P3)
  9. MDM 마스터 코드 ISO 표준 생성
  10. 보안 우회 공격 인젝션 카오스 테스트
"""

import json
import time

import pytest

from skygarage_integration.billing.clearing_engine import (
    ATR_SERVICE_FEE_RATE,
    BASE_RATE_TABLE,
    PATENT_GOVERNANCE_MDM,
    B2BCreditAccount,
    B2BCreditSettlement,
    BillingPipeline,
    ClearingEngine,
    CouponPayload,
    CouponStatus,
    IncidentGovernanceEngine,
    IncidentSeverity,
    LPRGatewayInterface,
    LPRPacket,
    MDMMasterCodeGenerator,
    MembershipType,
    SecurityBoundary,
    SettlementStatus,
    VehicleCategory,
    VehicleSession,
)


# ─────────────────────────────────────────────
# 헬퍼 함수
# ─────────────────────────────────────────────

def make_lpr_json(
    plate: str = "12가3456",
    category_code: str = "01",
    captured_at_ms: float = 1000000.0,
    gateway_id: str = "GW_EAST_01",
) -> str:
    return json.dumps({
        "plate_number": plate,
        "category_code": category_code,
        "resolution_w": 1280,
        "resolution_h": 1024,
        "recognition_delay_sec": 0.18,
        "confidence": 0.97,
        "gateway_id": gateway_id,
        "captured_at_ms": captured_at_ms,
    })


def make_valid_coupon(
    billing: BillingPipeline,
    coupon_id: str = "CPN_001",
    store_id: str = "STORE_A",
    discount_amount: int = 2000,
    discount_rate: float = 0.0,
    valid_from: float = 0.0,
    valid_until: float = 9999999999999.0,
) -> CouponPayload:
    sig = billing.generate_coupon_signature(coupon_id, store_id, discount_amount)
    return CouponPayload(
        coupon_id=coupon_id,
        store_id=store_id,
        discount_amount_krw=discount_amount,
        discount_rate_pct=discount_rate,
        valid_from_ms=valid_from,
        valid_until_ms=valid_until,
        signature=sig,
    )


# ─────────────────────────────────────────────
# 1. LPR JSON 파싱 및 차량 분류
# ─────────────────────────────────────────────

class TestLPRParsing:

    def test_valid_json_parsed(self):
        """정상 LPR JSON 파싱"""
        lpr = LPRGatewayInterface()
        packet = lpr.parse_lpr_json(make_lpr_json())
        assert packet is not None
        assert packet.plate_number == "12가3456"
        assert packet.category_code == "01"
        assert packet.resolution_w == 1280
        assert packet.resolution_h == 1024

    def test_invalid_json_returns_none(self):
        """잘못된 JSON은 None 반환"""
        lpr = LPRGatewayInterface()
        assert lpr.parse_lpr_json("not json") is None
        assert lpr.parse_lpr_json("") is None
        assert lpr.parse_lpr_json("{}") is None

    def test_resident_vehicle_classified(self):
        """등록 입주민 차량 분류"""
        lpr = LPRGatewayInterface()
        lpr.register_resident_vehicle("12가3456", "TENANT_001")
        packet = lpr.parse_lpr_json(make_lpr_json())
        membership, tenant_id = lpr.classify_vehicle(packet)
        assert membership == MembershipType.RESIDENT_REGISTERED
        assert tenant_id == "TENANT_001"

    def test_non_member_vehicle_classified(self):
        """미등록 비회원 차량 분류"""
        lpr = LPRGatewayInterface()
        packet = lpr.parse_lpr_json(make_lpr_json(plate="99나9999"))
        membership, _ = lpr.classify_vehicle(packet)
        assert membership == MembershipType.NON_MEMBER_COMMERCIAL

    def test_category_code_resolved(self):
        """규격 코드 해석"""
        lpr = LPRGatewayInterface()
        assert lpr.resolve_category("01") == VehicleCategory.SEDAN
        assert lpr.resolve_category("02") == VehicleCategory.SUV_LARGE
        assert lpr.resolve_category("03") == VehicleCategory.CARGO
        assert lpr.resolve_category("05") == VehicleCategory.HYBRID
        assert lpr.resolve_category("99") == VehicleCategory.UNKNOWN


# ─────────────────────────────────────────────
# 2. 입주민 정기 차량 무료 정산
# ─────────────────────────────────────────────

class TestResidentFreeParking:

    def test_resident_pays_zero(self):
        """입주민 정기 차량은 0원 정산"""
        engine = ClearingEngine()
        engine.lpr.register_resident_vehicle("12가3456", "TENANT_001")

        session = engine.process_entry(make_lpr_json(captured_at_ms=1000.0))
        assert session is not None
        assert session.membership == MembershipType.RESIDENT_REGISTERED

        result = engine.process_exit(session.session_id, exit_time_ms=7200000.0)
        assert result.final_fee_krw == 0
        assert result.settlement_status == SettlementStatus.COMPLETED


# ─────────────────────────────────────────────
# 3. 비회원 과금 및 모바일 지갑
# ─────────────────────────────────────────────

class TestNonMemberBilling:

    def test_mobile_wallet_bound_on_entry(self):
        """비회원 진입 시 모바일 지갑 자동 바인딩"""
        engine = ClearingEngine()
        session = engine.process_entry(
            make_lpr_json(plate="99나9999", captured_at_ms=0.0)
        )
        assert session.mobile_wallet_token.startswith("WALLET:")

    def test_base_fee_calculated_correctly(self):
        """기본 요금 정확 산출 (1시간 승용)"""
        billing = BillingPipeline()
        fee = billing.calculate_base_fee(VehicleCategory.SEDAN, 60.0)
        # 60분 / 10분 = 6 단위 * 500원 = 3000원
        assert fee == 3000

    def test_atr_service_fee_applied(self):
        """ATR 수수료 5% 가산"""
        billing = BillingPipeline()
        atr_fee = billing.calculate_atr_service_fee(3000)
        assert atr_fee == 150

    def test_suv_higher_rate(self):
        """대형 SUV 할증 요금"""
        billing = BillingPipeline()
        sedan_fee = billing.calculate_base_fee(VehicleCategory.SEDAN, 60.0)
        suv_fee = billing.calculate_base_fee(VehicleCategory.SUV_LARGE, 60.0)
        assert suv_fee > sedan_fee


# ─────────────────────────────────────────────
# 4. 가상 상가 할인 QR 쿠폰 50건 연속 검증
# ─────────────────────────────────────────────

class TestCoupon50Batch:

    def test_50_coupons_validated_and_applied(self):
        """50건 연속 쿠폰 주입 시 정산 정확도 무결성 검증"""
        engine = ClearingEngine()
        current_time = 5000000.0

        total_discount_applied = 0
        total_base_fees = 0

        for i in range(50):
            # 비회원 차량 진입
            plate = f"{i:02d}나{i:04d}"
            session = engine.process_entry(
                make_lpr_json(
                    plate=plate,
                    category_code="01",
                    captured_at_ms=current_time,
                )
            )
            assert session is not None

            # 쿠폰 생성 (각 2000원 할인)
            coupon = make_valid_coupon(
                engine.billing,
                coupon_id=f"CPN_{i:03d}",
                store_id=f"STORE_{i % 5}",
                discount_amount=2000,
                valid_from=0.0,
                valid_until=9999999999999.0,
            )

            # 출차 (1시간 주차)
            exit_time = current_time + 3600000.0
            result = engine.process_exit(
                session.session_id,
                exit_time_ms=exit_time,
                coupons=[coupon],
            )

            assert result.settlement_status == SettlementStatus.COMPLETED
            assert result.discount_krw == 2000
            assert result.base_fee_krw == 3000  # 6 units * 500

            expected_final = 3000 - 2000 + int((3000 - 2000) * ATR_SERVICE_FEE_RATE)
            assert result.final_fee_krw == expected_final

            total_discount_applied += result.discount_krw
            total_base_fees += result.base_fee_krw

        # 50건 배치 전체 무결성
        assert total_discount_applied == 50 * 2000
        assert total_base_fees == 50 * 3000

    def test_50_rate_coupons_percentage_applied(self):
        """50건 비율형 쿠폰(30%) 정산 정확도"""
        engine = ClearingEngine()
        current_time = 1000000.0

        for i in range(50):
            plate = f"{i:02d}다{i:04d}"
            session = engine.process_entry(
                make_lpr_json(plate=plate, captured_at_ms=current_time)
            )

            coupon = CouponPayload(
                coupon_id=f"RATE_{i:03d}",
                store_id="STORE_PCT",
                discount_amount_krw=0,
                discount_rate_pct=30.0,
                valid_from_ms=0.0,
                valid_until_ms=9999999999999.0,
                signature=engine.billing.generate_coupon_signature(
                    f"RATE_{i:03d}", "STORE_PCT", 0
                ),
            )

            exit_time = current_time + 3600000.0
            result = engine.process_exit(
                session.session_id, exit_time_ms=exit_time, coupons=[coupon]
            )

            # 3000 * 30% = 900원 할인
            assert result.discount_krw == 900
            assert result.base_fee_krw == 3000


# ─────────────────────────────────────────────
# 5. 쿠폰 서명 위변조 차단
# ─────────────────────────────────────────────

class TestCouponSecurity:

    def test_forged_signature_rejected(self):
        """위조 서명 쿠폰 차단"""
        billing = BillingPipeline()
        forged = CouponPayload(
            coupon_id="FORGED_001",
            store_id="FAKE_STORE",
            discount_amount_krw=50000,
            discount_rate_pct=0.0,
            valid_from_ms=0.0,
            valid_until_ms=9999999999999.0,
            signature="deadbeefdeadbeefdeadbeef",
        )
        status = billing.validate_coupon(forged, 1000000.0)
        assert status == CouponStatus.INVALID_SIGNATURE

    def test_expired_coupon_rejected(self):
        """만료 쿠폰 차단"""
        billing = BillingPipeline()
        coupon = make_valid_coupon(
            billing,
            coupon_id="EXP_001",
            valid_from=100.0,
            valid_until=500.0,
        )
        status = billing.validate_coupon(coupon, 1000.0)
        assert status == CouponStatus.EXPIRED

    def test_duplicate_coupon_rejected(self):
        """중복 사용 쿠폰 차단"""
        billing = BillingPipeline()
        coupon = make_valid_coupon(billing, coupon_id="DUP_001")
        status1 = billing.validate_coupon(coupon, 1000.0)
        assert status1 == CouponStatus.VALID

        status2 = billing.validate_coupon(coupon, 2000.0)
        assert status2 == CouponStatus.ALREADY_USED


# ─────────────────────────────────────────────
# 6. B2B 크레딧 정산
# ─────────────────────────────────────────────

class TestB2BCreditSettlement:

    def test_within_credit_limit(self):
        """크레딧 한도 내 정산"""
        b2b = B2BCreditSettlement()
        b2b.register_company("COMP_A", "Alpha Corp", 100000)
        status = b2b.charge_parking("COMP_A", 5000, "SESSION_001")
        assert status == SettlementStatus.COMPLETED
        assert b2b.get_account("COMP_A").used_credit == 5000

    def test_exceeds_credit_deferred(self):
        """크레딧 초과 시 익월 이관"""
        b2b = B2BCreditSettlement()
        b2b.register_company("COMP_B", "Beta Corp", 10000)
        b2b.charge_parking("COMP_B", 8000, "SESSION_001")
        status = b2b.charge_parking("COMP_B", 5000, "SESSION_002")
        assert status == SettlementStatus.DEFERRED_NEXT_MONTH

        deferred = b2b.get_monthly_deferred_total("COMP_B")
        assert deferred == 3000  # 8000 + 5000 - 10000 limit

    def test_expense_hash_chain_integrity(self):
        """지출 증빙 해시 체인 무결성"""
        b2b = B2BCreditSettlement()
        b2b.register_company("COMP_C", "Gamma Corp", 500000)
        for i in range(10):
            b2b.charge_parking("COMP_C", 1000, f"SESSION_{i}")
        assert b2b.verify_expense_hash_chain("COMP_C")
        assert len(b2b.get_account("COMP_C").expense_hash_chain) == 10


# ─────────────────────────────────────────────
# 7. 인시던트 등급 분류 (P0~P3)
# ─────────────────────────────────────────────

class TestIncidentGovernance:

    def test_p0_emergency_action(self):
        """P0 인시던트: 비상 정지 + 소방 연동"""
        gov = IncidentGovernanceEngine()
        ticket = gov.raise_incident(
            IncidentSeverity.P0_SAFETY, "Vehicle collision detected"
        )
        assert "EMERGENCY_STOP_ALL" in ticket.auto_action
        assert "FIRE_DEPT_LINK" in ticket.auto_action
        assert ticket.governance_registry == PATENT_GOVERNANCE_MDM

    def test_p1_fleet_halt(self):
        """P1 인시던트: ATR 전체 정지"""
        gov = IncidentGovernanceEngine()
        ticket = gov.raise_incident(
            IncidentSeverity.P1_SYSTEM_HALT, "System-wide failure"
        )
        assert "ATR_FLEET_HALT" in ticket.auto_action

    def test_p2_resource_isolation(self):
        """P2 인시던트: 리프팅 자원 격리"""
        gov = IncidentGovernanceEngine()
        ticket = gov.raise_incident(
            IncidentSeverity.P2_SLA_RISK, "SLA breach imminent"
        )
        assert "LIFTING_RESOURCE_ISOLATION" in ticket.auto_action

    def test_p3_degraded_mode(self):
        """P3 인시던트: 일반 기능 저하"""
        gov = IncidentGovernanceEngine()
        ticket = gov.raise_incident(
            IncidentSeverity.P3_DEGRADED, "Minor sensor lag"
        )
        assert "DEGRADED_MODE_LOG" in ticket.auto_action


# ─────────────────────────────────────────────
# 8. MDM 마스터 코드 ISO 표준 생성
# ─────────────────────────────────────────────

class TestMDMMasterCode:

    def test_code_format_valid(self):
        """마스터 코드 형식 검증: KR-SKG-HASH-SEQUENCE"""
        mdm = MDMMasterCodeGenerator()
        code = mdm.generate(address="Seoul-Gangnam", date_str="20260531")
        parts = code.split("-")
        assert parts[0] == "KR"
        assert parts[1] == "SKG"
        assert len(parts[2]) == 8
        assert len(parts[3]) == 6

    def test_codes_are_unique(self):
        """생성 코드 고유성"""
        mdm = MDMMasterCodeGenerator()
        codes = set()
        for i in range(100):
            code = mdm.generate(address=f"addr_{i}", date_str="20260531")
            codes.add(code)
        assert len(codes) == 100


# ─────────────────────────────────────────────
# 9. 보안 우회 공격 인젝션 카오스 테스트
# ─────────────────────────────────────────────

class TestSecurityChaosInjection:

    def test_external_admin_access_blocked(self):
        """외부 관리자 권한 접근 100% 차단"""
        security = SecurityBoundary()
        for i in range(100):
            result = security.attempt_external_access(
                accessor_id=f"ATTACKER_{i}",
                target_field="resident_plate_number",
            )
            assert result is False

        assert len(security.blocked_attempts) == 100
        assert not security.is_data_leaked()

    def test_pii_encryption_irreversible_from_outside(self):
        """PII 암호화 데이터 외부에서 복호 불가"""
        security = SecurityBoundary()
        encrypted = security.encrypt_pii("12가3456")
        assert encrypted.startswith("E2EE:")
        assert "12가3456" not in encrypted

    def test_session_data_never_contains_raw_plate(self):
        """세션 데이터에 원본 차량번호 절대 미포함"""
        engine = ClearingEngine()
        raw_plate = "서울12가3456"
        session = engine.process_entry(
            make_lpr_json(plate=raw_plate, captured_at_ms=1000.0)
        )
        assert raw_plate not in session.plate_number
        assert session.plate_number.startswith("E2EE:")

    def test_concurrent_attack_vectors_all_blocked(self):
        """동시 다발적 보안 공격 벡터 전부 차단"""
        security = SecurityBoundary()
        import threading

        errors = []
        attack_fields = [
            "resident_address", "phone_number", "unit_number",
            "vehicle_route", "entry_exit_log", "payment_info",
        ]

        def attack_wave(attacker_id: str, field: str, count: int):
            try:
                for _ in range(count):
                    result = security.attempt_external_access(attacker_id, field)
                    if result:
                        errors.append(f"LEAK: {attacker_id} accessed {field}")
            except Exception as e:
                errors.append(str(e))

        threads = [
            threading.Thread(
                target=attack_wave,
                args=(f"ATTACKER_{i}", attack_fields[i % len(attack_fields)], 50),
            )
            for i in range(12)
        ]
        for t in threads:
            t.start()
        for t in threads:
            t.join()

        assert len(errors) == 0
        assert len(security.blocked_attempts) == 600
        assert not security.is_data_leaked()

    def test_no_data_leakage_after_mass_injection(self):
        """대량 공격 인젝션 후 데이터 유출 제로 검증"""
        engine = ClearingEngine()

        # 정상 세션 생성
        for i in range(20):
            engine.process_entry(
                make_lpr_json(plate=f"차량{i:04d}", captured_at_ms=float(i * 1000))
            )

        # 공격 시도
        for i in range(200):
            result = engine.security.attempt_external_access(
                f"CHAOS_{i}", "all_sessions"
            )
            assert result is False

        # 유출 여부 최종 검증
        assert not engine.security.is_data_leaked()
        assert len(engine.security.blocked_attempts) == 200


# ─────────────────────────────────────────────
# 10. 통합 시나리오
# ─────────────────────────────────────────────

class TestIntegratedScenario:

    def test_full_entry_exit_cycle_with_coupon(self):
        """진입 → 쿠폰 → 출차 전체 사이클"""
        engine = ClearingEngine()

        session = engine.process_entry(
            make_lpr_json(plate="77라7777", captured_at_ms=0.0)
        )
        assert session.membership == MembershipType.NON_MEMBER_COMMERCIAL

        coupon = make_valid_coupon(engine.billing, coupon_id="FULL_CYCLE_001")
        result = engine.process_exit(
            session.session_id,
            exit_time_ms=3600000.0,
            coupons=[coupon],
        )

        assert result.settlement_status == SettlementStatus.COMPLETED
        assert result.discount_krw == 2000
        assert result.final_fee_krw > 0

    def test_b2b_integrated_flow(self):
        """B2B 입주사 통합 정산 플로우"""
        engine = ClearingEngine()
        engine.lpr.register_b2b_vehicle("88마8888", "COMP_DELTA")
        engine.b2b.register_company("COMP_DELTA", "Delta Inc", 50000)

        session = engine.process_entry(
            make_lpr_json(plate="88마8888", captured_at_ms=0.0)
        )
        assert session.membership == MembershipType.B2B_TENANT

        result = engine.process_exit(session.session_id, exit_time_ms=3600000.0)
        assert result.settlement_status == SettlementStatus.COMPLETED

        account = engine.b2b.get_account("COMP_DELTA")
        assert account.used_credit > 0
        assert engine.b2b.verify_expense_hash_chain("COMP_DELTA")
