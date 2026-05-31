"""
SkyGarage 관리자 컨텍스트 스위처 테스트 벤치
Admin Context Switcher - Hierarchical Security Test Suite

테스트 시나리오:
  1. HQ_ADMIN 통합관리자 서울지사 단지 가상 세션 접근
  2. 스코프 전환 타이밍 검증 (t_render < 15ms)
  3. Dual-Signature 감사 로그 무결성
  4. COMPLEX_ADMIN 비인가 권한 상승(Privilege Escalation) 차단
  5. 낙관적 락(Optimistic Locking) 동시 수정 충돌
  6. 반복 에스컬레이션 시 세션 블로킹
  7. 계층별 접근 제어 (Region → Complex → Building)
  8. 임퍼스네이션 세션 라이프사이클
  9. CUD 트랜잭션 감사 로그 분리 기록
  10. 미들웨어 데코레이터 패턴 검증
"""

import threading
import time

import pytest

from skygarage_arch.security.context_switcher import (
    GOVERNANCE_REGISTRY_ID,
    SCOPE_SWITCH_DEADLINE_MS,
    AdminIdentity,
    AdminRole,
    AuditAction,
    ContextSwitcher,
    DualSignatureAuditLog,
    ImpersonationSession,
    OptimisticLockConflict,
    OptimisticLockManager,
    PrivilegeEscalationError,
    ScopedSessionCache,
    ScopeTarget,
    ScopeValidator,
    SwitchResult,
    require_scope,
)


# ─────────────────────────────────────────────
# 헬퍼: 관리자 ID 팩토리
# ─────────────────────────────────────────────

def hq_admin(user_id: str = "HQ_ADMIN_001") -> AdminIdentity:
    return AdminIdentity(
        user_id=user_id,
        role=AdminRole.HQ_ADMIN,
        home_region_id="GLOBAL",
    )


def region_admin(
    user_id: str = "REGION_ADMIN_SEOUL",
    region: str = "REGION_SEOUL",
) -> AdminIdentity:
    return AdminIdentity(
        user_id=user_id,
        role=AdminRole.REGION_ADMIN,
        home_region_id=region,
    )


def complex_admin(
    user_id: str = "COMPLEX_ADMIN_GN001",
    region: str = "REGION_SEOUL",
    complex_id: str = "CPX_GANGNAM_001",
) -> AdminIdentity:
    return AdminIdentity(
        user_id=user_id,
        role=AdminRole.COMPLEX_ADMIN,
        home_region_id=region,
        home_complex_id=complex_id,
    )


def building_admin(
    user_id: str = "BLDG_ADMIN_A",
    region: str = "REGION_SEOUL",
    complex_id: str = "CPX_GANGNAM_001",
    building_id: str = "BLD_A",
) -> AdminIdentity:
    return AdminIdentity(
        user_id=user_id,
        role=AdminRole.BUILDING_ADMIN,
        home_region_id=region,
        home_complex_id=complex_id,
        home_building_id=building_id,
    )


SEOUL_GANGNAM = ScopeTarget(
    region_id="REGION_SEOUL",
    complex_id="CPX_GANGNAM_001",
    building_id="BLD_A",
)

BUSAN_HAEUNDAE = ScopeTarget(
    region_id="REGION_BUSAN",
    complex_id="CPX_HAEUNDAE_001",
    building_id="BLD_101",
)


# ─────────────────────────────────────────────
# 1. HQ_ADMIN 서울지사 단지 가상 세션 접근
# ─────────────────────────────────────────────

class TestHQAdminContextSwitch:

    def test_hq_admin_can_access_any_scope(self):
        """통합관리자(HQ_ADMIN)는 전국 모든 스코프에 접근 가능"""
        switcher = ContextSwitcher()
        admin = hq_admin()

        result, session = switcher.switch_admin_context(admin, SEOUL_GANGNAM)
        assert result == SwitchResult.SUCCESS
        assert session is not None
        assert session.is_active
        assert session.target_scope == SEOUL_GANGNAM

    def test_hq_admin_busan_access(self):
        """통합관리자가 부산 해운대 단지에 접근"""
        switcher = ContextSwitcher()
        admin = hq_admin()

        result, session = switcher.switch_admin_context(admin, BUSAN_HAEUNDAE)
        assert result == SwitchResult.SUCCESS
        assert session.target_scope.complex_id == "CPX_HAEUNDAE_001"

    def test_hq_admin_receives_auth_token(self):
        """HQ_ADMIN 접근 시 세션 ID(토큰) 교부"""
        switcher = ContextSwitcher()
        admin = hq_admin()

        result, session = switcher.switch_admin_context(admin, SEOUL_GANGNAM)
        assert result == SwitchResult.SUCCESS
        assert len(session.session_id) > 0

        cached = switcher.get_active_session(session.session_id)
        assert cached is not None
        assert cached.session_id == session.session_id


# ─────────────────────────────────────────────
# 2. 스코프 전환 타이밍 검증 (t < 15ms)
# ─────────────────────────────────────────────

class TestSwitchTiming:

    def test_context_switch_under_15ms(self):
        """스코프 전환 15ms 이내 완료"""
        switcher = ContextSwitcher()
        admin = hq_admin()

        start = time.perf_counter_ns()
        result, session = switcher.switch_admin_context(admin, SEOUL_GANGNAM)
        elapsed_ms = (time.perf_counter_ns() - start) / 1_000_000

        assert result == SwitchResult.SUCCESS
        assert elapsed_ms < SCOPE_SWITCH_DEADLINE_MS, (
            f"Switch took {elapsed_ms:.2f}ms, exceeds {SCOPE_SWITCH_DEADLINE_MS}ms"
        )

    def test_100_consecutive_switches_all_under_15ms(self):
        """100회 연속 스코프 전환 모두 15ms 이내"""
        switcher = ContextSwitcher()
        admin = hq_admin()
        scopes = [
            ScopeTarget(region_id=f"REGION_{i}", complex_id=f"CPX_{i}")
            for i in range(100)
        ]

        for scope in scopes:
            start = time.perf_counter_ns()
            result, _ = switcher.switch_admin_context(admin, scope)
            elapsed_ms = (time.perf_counter_ns() - start) / 1_000_000
            assert result == SwitchResult.SUCCESS
            assert elapsed_ms < SCOPE_SWITCH_DEADLINE_MS


# ─────────────────────────────────────────────
# 3. Dual-Signature 감사 로그 무결성
# ─────────────────────────────────────────────

class TestDualSignatureAudit:

    def test_impersonation_generates_audit_log(self):
        """임퍼스네이션 시작 시 감사 로그 생성"""
        switcher = ContextSwitcher()
        admin = hq_admin("HQ_ADMIN_001")
        switcher.switch_admin_context(admin, SEOUL_GANGNAM)

        entries = switcher.audit.get_entries_by_operator("HQ_ADMIN_001")
        assert len(entries) >= 1
        entry = entries[0]
        assert entry.operator_id == "HQ_ADMIN_001"
        assert entry.operator_role == "HQ_ADMIN"
        assert entry.action == AuditAction.IMPERSONATION_START
        assert entry.governance_registry == GOVERNANCE_REGISTRY_ID

    def test_dual_signatures_present(self):
        """Dual-Signature (운영자 + 시스템) 모두 존재"""
        switcher = ContextSwitcher()
        admin = hq_admin()
        switcher.switch_admin_context(admin, SEOUL_GANGNAM)

        entry = switcher.audit.all_entries[0]
        assert len(entry.signature_operator) == 32
        assert len(entry.signature_system) == 32
        assert entry.signature_operator != entry.signature_system

    def test_signature_integrity_verifiable(self):
        """서명 무결성 검증 통과"""
        switcher = ContextSwitcher(signing_key="test_key_123")
        admin = hq_admin()
        switcher.switch_admin_context(admin, SEOUL_GANGNAM)

        entry = switcher.audit.all_entries[0]
        assert switcher.audit.verify_signature_integrity(entry)

    def test_cud_operations_logged_with_dual_signature(self):
        """CUD 트랜잭션 시 OPERATOR/TARGET 분리 기록"""
        switcher = ContextSwitcher()
        admin = hq_admin("HQ_ADMIN_001")
        _, session = switcher.switch_admin_context(admin, SEOUL_GANGNAM)

        log_entry = switcher.record_cud_operation(
            session_id=session.session_id,
            action=AuditAction.DATA_UPDATE,
            resource_id="INTERLOCK_SETTING_001",
            detail="FORCE_RELEASE_INTERLOCK",
        )

        assert log_entry is not None
        assert log_entry.operator_id == "HQ_ADMIN_001"
        assert log_entry.target_tenant == "CPX_GANGNAM_001"
        assert log_entry.action == AuditAction.DATA_UPDATE
        assert log_entry.resource_id == "INTERLOCK_SETTING_001"


# ─────────────────────────────────────────────
# 4. COMPLEX_ADMIN 비인가 권한 상승 차단
# ─────────────────────────────────────────────

class TestPrivilegeEscalation:

    def test_complex_admin_cannot_access_other_complex(self):
        """단지관리자가 타 단지 접근 시 즉각 차단"""
        switcher = ContextSwitcher()
        admin = complex_admin(
            user_id="COMPLEX_ADMIN_GN001",
            complex_id="CPX_GANGNAM_001",
        )

        result, session = switcher.switch_admin_context(admin, BUSAN_HAEUNDAE)
        assert result == SwitchResult.DENIED_OUT_OF_SCOPE
        assert session is None

    def test_escalation_generates_alert_event(self):
        """권한 상승 시도 시 시스템 알림 이벤트 발생"""
        switcher = ContextSwitcher()
        admin = complex_admin(user_id="ATTACKER_001")

        switcher.switch_admin_context(admin, BUSAN_HAEUNDAE)

        alerts = switcher.alert_events
        assert len(alerts) == 1
        assert alerts[0]["type"] == "PRIVILEGE_ESCALATION_ATTEMPT"
        assert alerts[0]["user_id"] == "ATTACKER_001"
        assert alerts[0]["governance"] == GOVERNANCE_REGISTRY_ID

    def test_escalation_logged_as_blocked(self):
        """권한 상승 차단이 감사 로그에 기록"""
        switcher = ContextSwitcher()
        admin = complex_admin(user_id="ATTACKER_002")

        switcher.switch_admin_context(admin, BUSAN_HAEUNDAE)

        blocked_entries = switcher.audit.get_entries_by_action(
            AuditAction.PRIVILEGE_ESCALATION_BLOCKED
        )
        assert len(blocked_entries) == 1
        assert blocked_entries[0].operator_id == "ATTACKER_002"

    def test_region_admin_cannot_access_other_region(self):
        """지역관리자가 타 지역 접근 시 차단"""
        switcher = ContextSwitcher()
        admin = region_admin(user_id="REGION_SEOUL_ADMIN", region="REGION_SEOUL")

        result, _ = switcher.switch_admin_context(admin, BUSAN_HAEUNDAE)
        assert result == SwitchResult.DENIED_OUT_OF_SCOPE

    def test_building_admin_cannot_access_other_building(self):
        """건물관리자가 타 건물 접근 시 차단"""
        switcher = ContextSwitcher()
        admin = building_admin(user_id="BLDG_A_ADMIN", building_id="BLD_A")

        target = ScopeTarget(
            region_id="REGION_SEOUL",
            complex_id="CPX_GANGNAM_001",
            building_id="BLD_B",
        )
        result, _ = switcher.switch_admin_context(admin, target)
        assert result == SwitchResult.DENIED_OUT_OF_SCOPE


# ─────────────────────────────────────────────
# 5. 낙관적 락 동시 수정 충돌
# ─────────────────────────────────────────────

class TestOptimisticLocking:

    def test_concurrent_modification_detected(self):
        """동시 수정 시 낙관적 락 충돌 감지"""
        switcher = ContextSwitcher()
        admin1 = hq_admin("HQ_ADMIN_001")
        admin2 = hq_admin("HQ_ADMIN_002")

        switcher.locks.register_resource("GATE_CONFIG_001", {"status": "open"})

        _, session1 = switcher.switch_admin_context(admin1, SEOUL_GANGNAM)
        _, session2 = switcher.switch_admin_context(admin2, SEOUL_GANGNAM)

        # Admin1 업데이트 (v1 → v2)
        switcher.update_resource_with_lock(
            session1.session_id, "GATE_CONFIG_001", 1, {"status": "locked"}
        )

        # Admin2 동일 자원 업데이트 시도 (v1 기대하지만 이미 v2)
        with pytest.raises(OptimisticLockConflict) as exc_info:
            switcher.update_resource_with_lock(
                session2.session_id, "GATE_CONFIG_001", 1, {"status": "maintenance"}
            )

        assert exc_info.value.expected_version == 1
        assert exc_info.value.actual_version == 2

    def test_sequential_updates_succeed(self):
        """순차 업데이트는 정상 처리"""
        switcher = ContextSwitcher()
        admin = hq_admin()
        switcher.locks.register_resource("RES_001", {"v": 0})

        _, session = switcher.switch_admin_context(admin, SEOUL_GANGNAM)

        r1 = switcher.update_resource_with_lock(
            session.session_id, "RES_001", 1, {"v": 1}
        )
        assert r1.version == 2

        r2 = switcher.update_resource_with_lock(
            session.session_id, "RES_001", 2, {"v": 2}
        )
        assert r2.version == 3


# ─────────────────────────────────────────────
# 6. 반복 에스컬레이션 시 세션 블로킹
# ─────────────────────────────────────────────

class TestRepeatedEscalationLockout:

    def test_3_attempts_trigger_lockout(self):
        """3회 비인가 접근 시 사용자 블로킹"""
        switcher = ContextSwitcher()
        attacker = complex_admin(user_id="PERSISTENT_ATTACKER")

        for _ in range(3):
            switcher.switch_admin_context(attacker, BUSAN_HAEUNDAE)

        assert "PERSISTENT_ATTACKER" in switcher.blocked_users

    def test_locked_user_gets_denied(self):
        """블로킹된 사용자는 모든 접근 거부"""
        switcher = ContextSwitcher()
        attacker = complex_admin(user_id="BLOCKED_USER")

        for _ in range(3):
            switcher.switch_admin_context(attacker, BUSAN_HAEUNDAE)

        own_scope = ScopeTarget(
            region_id="REGION_SEOUL", complex_id="CPX_GANGNAM_001"
        )
        result, _ = switcher.switch_admin_context(attacker, own_scope)
        assert result == SwitchResult.DENIED_LOCKOUT


# ─────────────────────────────────────────────
# 7. 계층별 접근 제어
# ─────────────────────────────────────────────

class TestHierarchicalAccess:

    def test_complex_admin_can_access_own_buildings(self):
        """단지관리자는 소속 단지 내 건물 접근 가능"""
        switcher = ContextSwitcher()
        admin = complex_admin(complex_id="CPX_GANGNAM_001")

        target = ScopeTarget(
            region_id="REGION_SEOUL",
            complex_id="CPX_GANGNAM_001",
            building_id="BLD_A",
        )
        result, session = switcher.switch_admin_context(admin, target)
        assert result == SwitchResult.SUCCESS
        assert session is not None

    def test_region_admin_can_access_own_region_complexes(self):
        """지역관리자는 소속 지역 내 단지 접근 가능"""
        switcher = ContextSwitcher()
        admin = region_admin(region="REGION_SEOUL")

        target = ScopeTarget(
            region_id="REGION_SEOUL",
            complex_id="CPX_GANGNAM_001",
        )
        result, session = switcher.switch_admin_context(admin, target)
        assert result == SwitchResult.SUCCESS

    def test_scope_depth_validation(self):
        """스코프 깊이 정상 산출"""
        global_scope = ScopeTarget()
        assert global_scope.depth == 0

        region_scope = ScopeTarget(region_id="R1")
        assert region_scope.depth == 1

        complex_scope = ScopeTarget(region_id="R1", complex_id="C1")
        assert complex_scope.depth == 2

        building_scope = ScopeTarget(region_id="R1", complex_id="C1", building_id="B1")
        assert building_scope.depth == 3


# ─────────────────────────────────────────────
# 8. 임퍼스네이션 세션 라이프사이클
# ─────────────────────────────────────────────

class TestSessionLifecycle:

    def test_session_creation_and_termination(self):
        """세션 생성 → 활용 → 종료"""
        switcher = ContextSwitcher()
        admin = hq_admin()

        _, session = switcher.switch_admin_context(admin, SEOUL_GANGNAM)
        assert switcher.active_session_count == 1

        terminated = switcher.end_impersonation(session.session_id)
        assert terminated
        assert switcher.active_session_count == 0

    def test_end_impersonation_logs_audit(self):
        """세션 종료 시 감사 로그 기록"""
        switcher = ContextSwitcher()
        admin = hq_admin()

        _, session = switcher.switch_admin_context(admin, SEOUL_GANGNAM)
        switcher.end_impersonation(session.session_id)

        end_entries = switcher.audit.get_entries_by_action(
            AuditAction.IMPERSONATION_END
        )
        assert len(end_entries) == 1

    def test_cache_invalidated_on_end(self):
        """세션 종료 시 캐시 무효화"""
        switcher = ContextSwitcher()
        admin = hq_admin()

        _, session = switcher.switch_admin_context(admin, SEOUL_GANGNAM)
        assert switcher.get_active_session(session.session_id) is not None

        switcher.end_impersonation(session.session_id)
        assert switcher.get_active_session(session.session_id) is None


# ─────────────────────────────────────────────
# 9. CUD 트랜잭션 감사 로그 분리 기록
# ─────────────────────────────────────────────

class TestCUDAuditSeparation:

    def test_create_operation_logged(self):
        """CREATE 작업 감사 로그"""
        switcher = ContextSwitcher()
        admin = hq_admin("HQ_ADMIN_001")
        _, session = switcher.switch_admin_context(admin, SEOUL_GANGNAM)

        entry = switcher.record_cud_operation(
            session.session_id,
            AuditAction.DATA_CREATE,
            resource_id="NEW_PARKING_SLOT_42",
            detail="Created new EV charging slot",
        )
        assert entry.operator_id == "HQ_ADMIN_001"
        assert entry.target_tenant == "CPX_GANGNAM_001"
        assert entry.action == AuditAction.DATA_CREATE

    def test_delete_operation_logged(self):
        """DELETE 작업 감사 로그"""
        switcher = ContextSwitcher()
        admin = hq_admin("HQ_ADMIN_001")
        _, session = switcher.switch_admin_context(admin, BUSAN_HAEUNDAE)

        entry = switcher.record_cud_operation(
            session.session_id,
            AuditAction.DATA_DELETE,
            resource_id="EXPIRED_VEHICLE_REG_99",
        )
        assert entry.target_tenant == "CPX_HAEUNDAE_001"
        assert entry.action == AuditAction.DATA_DELETE

    def test_invalid_session_returns_none(self):
        """존재하지 않는 세션의 CUD 기록은 None"""
        switcher = ContextSwitcher()
        entry = switcher.record_cud_operation(
            "FAKE_SESSION_ID",
            AuditAction.DATA_UPDATE,
        )
        assert entry is None


# ─────────────────────────────────────────────
# 10. 미들웨어 데코레이터 패턴 검증
# ─────────────────────────────────────────────

class TestRequireScopeDecorator:

    def test_decorator_allows_hq_admin(self):
        """데코레이터: HQ_ADMIN 접근 허용"""
        switcher = ContextSwitcher()

        @require_scope(switcher, min_role=AdminRole.HQ_ADMIN)
        def protected_action(identity, target_scope, session=None):
            return {"ok": True, "session_id": session.session_id}

        admin = hq_admin()
        result = protected_action(admin, SEOUL_GANGNAM)
        assert result["ok"] is True
        assert len(result["session_id"]) > 0

    def test_decorator_blocks_lower_role(self):
        """데코레이터: 하위 역할 차단"""
        switcher = ContextSwitcher()

        @require_scope(switcher, min_role=AdminRole.HQ_ADMIN)
        def hq_only_action(identity, target_scope, session=None):
            return {"ok": True}

        admin = complex_admin()
        with pytest.raises(PrivilegeEscalationError):
            hq_only_action(admin, BUSAN_HAEUNDAE)

    def test_decorator_auto_closes_session(self):
        """데코레이터: 함수 종료 시 세션 자동 해제"""
        switcher = ContextSwitcher()

        @require_scope(switcher, min_role=AdminRole.HQ_ADMIN)
        def temporary_action(identity, target_scope, session=None):
            return session.session_id

        admin = hq_admin()
        session_id = temporary_action(admin, SEOUL_GANGNAM)
        assert switcher.get_active_session(session_id) is None
