"""
SkyGarage Architecture Verification Test Suite
Patent Component [660] - Governance Registry

Tests:
  1. 5-complex concurrent packet stress test
  2. Chaos penetration test - unauthorized cross-tenant access
  3. Network split autonomous caching and vector clock resync
  4. PII tokenization and leakage prevention
  5. Hash chain integrity verification under load
"""

import asyncio
import threading
from concurrent.futures import ThreadPoolExecutor

import pytest

from skygarage_arch.network.hierarchical_rpc import (
    GOVERNANCE_REGISTRY_ID,
    EdgeNodeCache,
    GovernanceViolation,
    HashChainBlock,
    HierarchicalRPCPipeline,
    IntegrityHashChain,
    NetworkSplitError,
    RPCMessage,
    ResyncMerger,
    SyncStatus,
    TierLevel,
    VectorClock,
)
from skygarage_arch.security.tenant_isolation import (
    CredentialLockout,
    DatabaseCursorIsolator,
    OnPremiseDataRetentionCircuit,
    PIICategory,
    PIITokenizer,
    TenantContext,
    TenantIsolationInterceptor,
    TenantIsolationViolation,
    TenantSessionStore,
    async_tenant_isolated,
    tenant_isolated,
)

COMPLEX_IDS = [f"Complex_{i:03d}" for i in range(1, 6)]


# ============================================================
# TEST 1: 5-Complex Concurrent Packet Stress Test
# ============================================================


class TestConcurrentPacketStress:
    """Simulates 5 complexes simultaneously sending high-frequency events."""

    @pytest.fixture
    def pipeline_topology(self):
        noc = HierarchicalRPCPipeline("NOC_001", TierLevel.NOC_HUB)
        complexes = []
        buildings = []

        for cid in COMPLEX_IDS:
            complex_edge = HierarchicalRPCPipeline(cid, TierLevel.COMPLEX_EDGE)
            complex_edge.connect_upstream(noc)
            complexes.append(complex_edge)

            for b in range(1, 4):
                building = HierarchicalRPCPipeline(
                    f"{cid}_B{b:02d}", TierLevel.BUILDING_EDGE
                )
                building.connect_upstream(complex_edge)
                buildings.append(building)

        return noc, complexes, buildings

    @pytest.mark.asyncio
    async def test_concurrent_multi_complex_event_streaming(self, pipeline_topology):
        """5 complexes each send 100 events concurrently to NOC."""
        noc, complexes, buildings = pipeline_topology
        received_at_noc: list[RPCMessage] = []

        async def noc_handler(msg: RPCMessage) -> RPCMessage | None:
            received_at_noc.append(msg)
            return None

        noc.register_handler("parking_event", noc_handler)

        for complex_edge in complexes:
            async def complex_relay(msg: RPCMessage) -> RPCMessage | None:
                return None
            complex_edge.register_handler("parking_event", complex_relay)

        tasks = []
        for building in buildings:
            for i in range(100):
                msg = RPCMessage(
                    source_tier=TierLevel.BUILDING_EDGE,
                    target_tier=TierLevel.NOC_HUB,
                    complex_id=building.node_id.split("_B")[0],
                    building_id=building.node_id,
                    method="parking_event",
                    payload={"event_type": "vehicle_entry", "seq": i},
                )
                tasks.append(building.send_upstream(msg))

        await asyncio.gather(*tasks)

        assert len(received_at_noc) == len(buildings) * 100
        assert noc.verify_chain_integrity()

    @pytest.mark.asyncio
    async def test_hash_chain_integrity_under_load(self, pipeline_topology):
        """All messages maintain hash chain integrity at each tier."""
        _, complexes, buildings = pipeline_topology

        for complex_edge in complexes:
            async def handler(msg: RPCMessage) -> RPCMessage | None:
                return None
            complex_edge.register_handler("sensor_data", handler)

        for building in buildings[:5]:
            for i in range(50):
                msg = RPCMessage(
                    source_tier=TierLevel.BUILDING_EDGE,
                    target_tier=TierLevel.COMPLEX_EDGE,
                    complex_id=building.node_id.split("_B")[0],
                    method="sensor_data",
                    payload={"temp": 22.5, "seq": i},
                )
                await building.send_upstream(msg)

        for building in buildings[:5]:
            assert building.verify_chain_integrity()
        for c in complexes:
            assert c.verify_chain_integrity()

    @pytest.mark.asyncio
    async def test_vector_clock_ordering_across_complexes(self):
        """Vector clocks correctly order events from different nodes."""
        vc1 = VectorClock()
        vc2 = VectorClock()

        vc1.increment("Complex_001_B01")
        vc1.increment("Complex_001_B01")
        vc2.increment("Complex_002_B01")

        assert vc1.is_concurrent_with(vc2)

        merged = vc1.merge(vc2)
        assert merged.clocks["Complex_001_B01"] == 2
        assert merged.clocks["Complex_002_B01"] == 1


# ============================================================
# TEST 2: Chaos Penetration Test - Unauthorized Access
# ============================================================


class TestChaosPenetration:
    """
    Injects unauthorized cross-tenant access vectors and verifies
    immediate 403 + Governance [660] credential lockout.
    """

    @pytest.fixture
    def interceptor(self):
        return TenantIsolationInterceptor()

    def test_cross_complex_access_returns_403(self, interceptor):
        """Tenant from Complex_001 trying to access Complex_002 data."""
        attacker_ctx = TenantContext(
            complex_id="Complex_001",
            tenant_id="tenant_malicious_001",
            building_id="Complex_001_B01",
        )

        with pytest.raises(TenantIsolationViolation) as exc_info:
            interceptor.intercept(attacker_ctx, target_complex_id="Complex_002")

        assert exc_info.value.status_code == 403
        assert GOVERNANCE_REGISTRY_ID in str(exc_info.value)
        assert exc_info.value.attacker_id == "tenant_malicious_001"

    def test_repeated_violations_trigger_lockout(self, interceptor):
        """3 violations trigger credential lockout by [660] policy."""
        attacker_ctx = TenantContext(
            complex_id="Complex_001",
            tenant_id="tenant_attacker",
        )

        for target in ["Complex_002", "Complex_003", "Complex_004"]:
            with pytest.raises(TenantIsolationViolation):
                interceptor.intercept(attacker_ctx, target_complex_id=target)

        assert interceptor.is_locked_out("tenant_attacker")

        with pytest.raises(CredentialLockout) as exc_info:
            interceptor.intercept(attacker_ctx, target_complex_id="Complex_001")

        assert GOVERNANCE_REGISTRY_ID in str(exc_info.value)
        assert exc_info.value.client_id == "tenant_attacker"

    def test_lockout_persists_across_all_access_attempts(self, interceptor):
        """Once locked out, even legitimate access to own complex is denied."""
        ctx = TenantContext(complex_id="Complex_003", tenant_id="tenant_bad")

        for i in range(3):
            with pytest.raises(TenantIsolationViolation):
                interceptor.intercept(ctx, target_complex_id=f"Complex_00{i+1}" if i < 2 else "Complex_004")

        with pytest.raises(CredentialLockout):
            interceptor.intercept(ctx, target_complex_id="Complex_003")

    def test_legitimate_same_complex_access_allowed(self, interceptor):
        """Tenant accessing own complex resources succeeds."""
        ctx = TenantContext(
            complex_id="Complex_001",
            tenant_id="tenant_legit_001",
        )
        interceptor.intercept(ctx, target_complex_id="Complex_001")

        audit = interceptor.audit_log
        assert any(
            entry["result"] == "allowed" and entry["tenant_id"] == "tenant_legit_001"
            for entry in audit
        )

    def test_concurrent_attack_vectors_all_blocked(self, interceptor):
        """Multiple threads attempting cross-tenant access simultaneously."""
        results: list[Exception] = []
        lock = threading.Lock()

        def attack(complex_src: str, complex_tgt: str, tenant_id: str):
            ctx = TenantContext(complex_id=complex_src, tenant_id=tenant_id)
            try:
                interceptor.intercept(ctx, target_complex_id=complex_tgt)
            except (TenantIsolationViolation, CredentialLockout) as e:
                with lock:
                    results.append(e)

        with ThreadPoolExecutor(max_workers=10) as executor:
            futures = []
            for i, cid in enumerate(COMPLEX_IDS):
                target = COMPLEX_IDS[(i + 1) % 5]
                futures.append(
                    executor.submit(attack, cid, target, f"attacker_{i}")
                )
            for f in futures:
                f.result()

        assert len(results) == 5
        assert all(
            isinstance(e, TenantIsolationViolation) for e in results
        )

    def test_decorator_enforces_isolation(self, interceptor):
        """@tenant_isolated decorator blocks unauthorized access."""

        @tenant_isolated(interceptor)
        def get_parking_data(ctx: TenantContext, complex_id: str):
            return {"spots": 120, "available": 45}

        legit_ctx = TenantContext(complex_id="Complex_001", tenant_id="t1")
        result = get_parking_data(legit_ctx, "Complex_001")
        assert result["spots"] == 120

        attacker_ctx = TenantContext(complex_id="Complex_002", tenant_id="t2")
        with pytest.raises(TenantIsolationViolation):
            get_parking_data(attacker_ctx, "Complex_001")


# ============================================================
# TEST 3: Network Split & Autonomous Caching
# ============================================================


class TestNetworkSplitRecovery:
    """Tests autonomous caching mode and vector clock resync."""

    @pytest.mark.asyncio
    async def test_building_edge_continues_on_network_split(self):
        """Building edge stores events locally when complex is unreachable."""
        complex_edge = HierarchicalRPCPipeline("Complex_001", TierLevel.COMPLEX_EDGE)
        building = HierarchicalRPCPipeline("Complex_001_B01", TierLevel.BUILDING_EDGE)
        building.connect_upstream(complex_edge)

        building._cache.enter_cached_mode()

        for i in range(10):
            msg = RPCMessage(
                complex_id="Complex_001",
                method="vehicle_entry",
                payload={"plate": f"ABC{i}"},
            )
            await building.send_upstream(msg)

        assert building.sync_status == SyncStatus.CACHED
        assert building.pending_cache_count == 10

    @pytest.mark.asyncio
    async def test_resync_with_vector_clock_ordering(self):
        """On reconnect, cached events merge in correct order via vector clock."""
        noc = HierarchicalRPCPipeline("NOC", TierLevel.NOC_HUB)
        complex_edge = HierarchicalRPCPipeline("Complex_001", TierLevel.COMPLEX_EDGE)
        complex_edge.connect_upstream(noc)

        received: list[RPCMessage] = []

        async def noc_handler(msg: RPCMessage) -> RPCMessage | None:
            received.append(msg)
            return None

        noc.register_handler("vehicle_entry", noc_handler)

        complex_edge._cache.enter_cached_mode()
        for i in range(5):
            msg = RPCMessage(
                complex_id="Complex_001",
                method="vehicle_entry",
                payload={"seq": i},
            )
            await complex_edge.send_upstream(msg)

        assert complex_edge.pending_cache_count == 5

        count = await complex_edge.resync_with_upstream()
        assert count == 5
        assert complex_edge.sync_status == SyncStatus.LIVE
        assert len(received) == 5

    def test_vector_clock_merge_conflict_resolution(self):
        """Vector clock correctly resolves concurrent writes."""
        merger = ResyncMerger()

        local_events = [
            RPCMessage(
                complex_id="Complex_001",
                method="update",
                payload={"field": "a"},
                vector_clock=VectorClock(clocks={"node_a": i + 1}),
                timestamp=1000.0 + i,
            )
            for i in range(3)
        ]

        remote_events = [
            RPCMessage(
                complex_id="Complex_001",
                method="update",
                payload={"field": "b"},
                vector_clock=VectorClock(clocks={"node_b": i + 1}),
                timestamp=1000.5 + i,
            )
            for i in range(3)
        ]

        merged = merger.merge_events(local_events, remote_events)
        assert len(merged) == 6
        timestamps = [m.timestamp for m in merged]
        assert timestamps == sorted(timestamps)


# ============================================================
# TEST 4: PII Tokenization & Data Retention Circuit
# ============================================================


class TestPIIProtection:
    """Verifies PII never leaves on-premise edge in readable form."""

    def test_vehicle_plate_tokenized(self):
        """Vehicle plates are replaced with one-way tokens."""
        circuit = OnPremiseDataRetentionCircuit("Complex_001")

        raw_packet = {
            "event_type": "vehicle_entry",
            "vehicle_plate": "12가3456",
            "timestamp": 1700000000,
        }

        sanitized = circuit.prepare_external_packet(raw_packet)

        assert sanitized["vehicle_plate"].startswith("SGT_vehicle_plate_")
        assert "12가3456" not in str(sanitized)
        assert sanitized["event_type"] == "vehicle_entry"

    def test_unit_number_tokenized(self):
        """Unit numbers (세대) are anonymized before external transit."""
        circuit = OnPremiseDataRetentionCircuit("Complex_002")

        raw = {
            "resident_id": "res_123",
            "unit_number": "101동 1502호",
            "movement_trail": "B2 -> EV3 -> 15F",
        }

        sanitized = circuit.prepare_external_packet(raw)
        assert sanitized["unit_number"].startswith("SGT_unit_number_")
        assert sanitized["movement_trail"].startswith("SGT_movement_trail_")
        assert "101동" not in str(sanitized)
        assert "B2 -> EV3" not in str(sanitized)

    def test_local_detokenization_works(self):
        """On-premise edge can reverse tokens back to original."""
        circuit = OnPremiseDataRetentionCircuit("Complex_001")

        raw = {"vehicle_plate": "서울12바3456"}
        sanitized = circuit.prepare_external_packet(raw)

        token = sanitized["vehicle_plate"]
        original = circuit.resolve_token_locally(token)
        assert original == "서울12바3456"

    def test_nested_pii_fields_sanitized(self):
        """Nested objects also have PII fields tokenized."""
        circuit = OnPremiseDataRetentionCircuit("Complex_003")

        raw = {
            "event": "parking_complete",
            "details": {
                "vehicle_plate": "경기98마7654",
                "unit_number": "203동 801호",
            },
        }

        sanitized = circuit.prepare_external_packet(raw)
        assert sanitized["details"]["vehicle_plate"].startswith("SGT_")
        assert sanitized["details"]["unit_number"].startswith("SGT_")

    def test_all_5_complexes_have_independent_token_stores(self):
        """Each complex has its own isolated tokenizer instance."""
        circuits = [OnPremiseDataRetentionCircuit(cid) for cid in COMPLEX_IDS]

        plate = "서울00가0000"
        tokens = []
        for circuit in circuits:
            sanitized = circuit.prepare_external_packet({"vehicle_plate": plate})
            tokens.append(sanitized["vehicle_plate"])

        unique_tokens = set(tokens)
        assert len(unique_tokens) == 5


# ============================================================
# TEST 5: DB Cursor Isolation & Session Boundary
# ============================================================


class TestDatabaseCursorIsolation:
    """Verifies cross-tenant cursor reuse is impossible."""

    def test_cursor_access_denied_for_other_tenant(self):
        """Tenant B cannot use Tenant A's database cursor."""
        isolator = DatabaseCursorIsolator()

        ctx_a = TenantContext(complex_id="Complex_001", tenant_id="tenant_a")
        ctx_b = TenantContext(complex_id="Complex_002", tenant_id="tenant_b")

        cursor = isolator.acquire_cursor(ctx_a)

        with pytest.raises(TenantIsolationViolation) as exc_info:
            isolator.validate_cursor_access(cursor, ctx_b)

        assert exc_info.value.status_code == 403
        assert "cross-tenant" in str(exc_info.value).lower() or "Cross-tenant" in str(exc_info.value)

    def test_session_store_isolation(self):
        """Each tenant gets isolated memory session."""
        store = TenantSessionStore()

        ctx_a = TenantContext(complex_id="Complex_001", tenant_id="t_001")
        ctx_b = TenantContext(complex_id="Complex_002", tenant_id="t_002")

        with store.session_scope(ctx_a) as session_a:
            session_a["secret"] = "data_for_a_only"

        with store.session_scope(ctx_b) as session_b:
            assert "secret" not in session_b

        session_a_data = store.get_session(ctx_a)
        assert session_a_data["secret"] == "data_for_a_only"

    def test_concurrent_cursor_isolation(self):
        """Multiple threads cannot cross cursor boundaries."""
        isolator = DatabaseCursorIsolator()
        violations: list[TenantIsolationViolation] = []
        lock = threading.Lock()

        contexts = [
            TenantContext(complex_id=cid, tenant_id=f"t_{cid}")
            for cid in COMPLEX_IDS
        ]

        cursors = [isolator.acquire_cursor(ctx) for ctx in contexts]

        def try_cross_access(my_idx: int):
            my_ctx = contexts[my_idx]
            other_cursor = cursors[(my_idx + 1) % 5]
            try:
                isolator.validate_cursor_access(other_cursor, my_ctx)
            except TenantIsolationViolation as e:
                with lock:
                    violations.append(e)

        with ThreadPoolExecutor(max_workers=5) as ex:
            futures = [ex.submit(try_cross_access, i) for i in range(5)]
            for f in futures:
                f.result()

        assert len(violations) == 5
        assert all(v.status_code == 403 for v in violations)
