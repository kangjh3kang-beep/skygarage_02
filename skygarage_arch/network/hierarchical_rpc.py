"""
SkyGarage Hierarchical RPC Streaming Pipeline
Patent Component [660] - Unified Governance Registry Policy Engine

3-Tier Distributed Network Topology:
  NOC Hub (광역 클러스터) <- Complex Edge (단지 마스터) <- Building Edge (동별 게이트웨이)

gRPC-style bidirectional streaming with:
  - Integrity hash chain for tamper-proof event reporting
  - Vector clock algorithm for conflict-free distributed merge
  - E2E encryption for external packet transit
  - Autonomous caching mode on network split
"""

from __future__ import annotations

import asyncio
import hashlib
import hmac
import json
import os
import time
import uuid
from dataclasses import dataclass, field
from enum import Enum
from typing import Any, Callable, Coroutine

# Patent Component [660] Governance Registry Identifier
GOVERNANCE_REGISTRY_ID = "[660]"


class GovernanceViolation(Exception):
    """Raised when Governance Registry [660] policy is violated."""

    def __init__(self, message: str, client_id: str | None = None):
        self.governance_id = GOVERNANCE_REGISTRY_ID
        self.client_id = client_id
        super().__init__(f"{GOVERNANCE_REGISTRY_ID} Policy Violation: {message}")


class NetworkSplitError(Exception):
    """Raised when downstream edge node is unreachable."""
    pass


class TierLevel(Enum):
    NOC_HUB = "noc_hub"
    COMPLEX_EDGE = "complex_edge"
    BUILDING_EDGE = "building_edge"


class SyncStatus(Enum):
    LIVE = "live"
    CACHED = "cached"
    RESYNCING = "resyncing"


@dataclass
class VectorClock:
    """Vector clock for conflict-free distributed event ordering."""

    clocks: dict[str, int] = field(default_factory=dict)

    def increment(self, node_id: str) -> None:
        self.clocks[node_id] = self.clocks.get(node_id, 0) + 1

    def merge(self, other: "VectorClock") -> "VectorClock":
        merged = VectorClock(clocks={**self.clocks})
        for node_id, ts in other.clocks.items():
            merged.clocks[node_id] = max(merged.clocks.get(node_id, 0), ts)
        return merged

    def is_concurrent_with(self, other: "VectorClock") -> bool:
        self_ge = all(
            self.clocks.get(k, 0) >= v for k, v in other.clocks.items()
        )
        other_ge = all(
            other.clocks.get(k, 0) >= v for k, v in self.clocks.items()
        )
        return not self_ge and not other_ge

    def happens_before(self, other: "VectorClock") -> bool:
        return all(
            self.clocks.get(k, 0) <= other.clocks.get(k, 0)
            for k in set(self.clocks) | set(other.clocks)
        ) and self.clocks != other.clocks

    def serialize(self) -> dict[str, int]:
        return dict(self.clocks)

    @classmethod
    def deserialize(cls, data: dict[str, int]) -> "VectorClock":
        return cls(clocks=dict(data))


@dataclass
class HashChainBlock:
    """Immutable block in the integrity hash chain."""

    index: int
    timestamp: float
    payload_hash: str
    previous_hash: str
    block_hash: str
    governance_id: str = GOVERNANCE_REGISTRY_ID

    @classmethod
    def create(cls, index: int, payload: bytes, previous_hash: str) -> "HashChainBlock":
        timestamp = time.time()
        payload_hash = hashlib.sha256(payload).hexdigest()
        raw = f"{index}:{timestamp}:{payload_hash}:{previous_hash}".encode()
        block_hash = hashlib.sha256(raw).hexdigest()
        return cls(
            index=index,
            timestamp=timestamp,
            payload_hash=payload_hash,
            previous_hash=previous_hash,
            block_hash=block_hash,
        )


class IntegrityHashChain:
    """Tamper-proof hash chain for event reporting to NOC."""

    def __init__(self) -> None:
        genesis = HashChainBlock(
            index=0,
            timestamp=time.time(),
            payload_hash="0" * 64,
            previous_hash="0" * 64,
            block_hash=hashlib.sha256(b"genesis_[660]").hexdigest(),
        )
        self._chain: list[HashChainBlock] = [genesis]

    @property
    def latest_hash(self) -> str:
        return self._chain[-1].block_hash

    @property
    def length(self) -> int:
        return len(self._chain)

    def append(self, payload: bytes) -> HashChainBlock:
        block = HashChainBlock.create(
            index=len(self._chain),
            payload=payload,
            previous_hash=self.latest_hash,
        )
        self._chain.append(block)
        return block

    def verify_integrity(self) -> bool:
        for i in range(1, len(self._chain)):
            if self._chain[i].previous_hash != self._chain[i - 1].block_hash:
                return False
        return True


@dataclass
class RPCMessage:
    """Structured RPC message for inter-tier communication."""

    message_id: str = field(default_factory=lambda: str(uuid.uuid4()))
    source_tier: TierLevel = TierLevel.BUILDING_EDGE
    target_tier: TierLevel = TierLevel.COMPLEX_EDGE
    complex_id: str = ""
    building_id: str = ""
    method: str = ""
    payload: dict[str, Any] = field(default_factory=dict)
    vector_clock: VectorClock = field(default_factory=VectorClock)
    timestamp: float = field(default_factory=time.time)
    encrypted: bool = False
    integrity_hash: str = ""

    def serialize(self) -> bytes:
        data = {
            "message_id": self.message_id,
            "source_tier": self.source_tier.value,
            "target_tier": self.target_tier.value,
            "complex_id": self.complex_id,
            "building_id": self.building_id,
            "method": self.method,
            "payload": self.payload,
            "vector_clock": self.vector_clock.serialize(),
            "timestamp": self.timestamp,
            "integrity_hash": self.integrity_hash,
        }
        return json.dumps(data, ensure_ascii=False).encode("utf-8")

    @classmethod
    def deserialize(cls, raw: bytes) -> "RPCMessage":
        data = json.loads(raw.decode("utf-8"))
        return cls(
            message_id=data["message_id"],
            source_tier=TierLevel(data["source_tier"]),
            target_tier=TierLevel(data["target_tier"]),
            complex_id=data["complex_id"],
            building_id=data.get("building_id", ""),
            method=data["method"],
            payload=data["payload"],
            vector_clock=VectorClock.deserialize(data["vector_clock"]),
            timestamp=data["timestamp"],
            integrity_hash=data.get("integrity_hash", ""),
        )


class E2EEncryptor:
    """End-to-end encryption for external network packets.

    Uses HMAC-SHA256 for integrity verification and XOR stream cipher
    simulation for payload confidentiality (production: replace with AES-GCM).
    """

    def __init__(self, shared_secret: bytes | None = None) -> None:
        self._secret = shared_secret or os.urandom(32)

    def encrypt_payload(self, plaintext: bytes) -> tuple[bytes, str]:
        nonce = os.urandom(16)
        key_stream = hashlib.sha256(self._secret + nonce).digest()
        cipher = bytes(a ^ b for a, b in zip(plaintext, key_stream * (len(plaintext) // 32 + 1)))
        mac = hmac.HMAC(self._secret, nonce + cipher, hashlib.sha256).hexdigest()
        return nonce + cipher, mac

    def decrypt_payload(self, ciphertext: bytes, mac: str) -> bytes:
        nonce = ciphertext[:16]
        cipher = ciphertext[16:]
        expected_mac = hmac.HMAC(self._secret, nonce + cipher, hashlib.sha256).hexdigest()
        if not hmac.compare_digest(mac, expected_mac):
            raise GovernanceViolation("E2E integrity check failed - possible tampering")
        key_stream = hashlib.sha256(self._secret + nonce).digest()
        return bytes(a ^ b for a, b in zip(cipher, key_stream * (len(cipher) // 32 + 1)))

    @property
    def secret_fingerprint(self) -> str:
        return hashlib.sha256(self._secret).hexdigest()[:16]


class EdgeNodeCache:
    """Autonomous local cache for network split scenarios."""

    def __init__(self, node_id: str) -> None:
        self.node_id = node_id
        self._cache: list[RPCMessage] = []
        self._vector_clock = VectorClock()
        self._status = SyncStatus.LIVE

    @property
    def status(self) -> SyncStatus:
        return self._status

    @property
    def pending_count(self) -> int:
        return len(self._cache)

    def enter_cached_mode(self) -> None:
        self._status = SyncStatus.CACHED

    def store_locally(self, message: RPCMessage) -> None:
        self._vector_clock.increment(self.node_id)
        message.vector_clock = VectorClock(clocks={**self._vector_clock.clocks})
        self._cache.append(message)

    def drain_for_resync(self) -> list[RPCMessage]:
        self._status = SyncStatus.RESYNCING
        messages = sorted(self._cache, key=lambda m: m.timestamp)
        self._cache = []
        return messages

    def confirm_resync_complete(self) -> None:
        self._status = SyncStatus.LIVE


class ResyncMerger:
    """Vector clock based sequential merge for write conflict prevention."""

    def __init__(self) -> None:
        self._merged_clock = VectorClock()

    def merge_events(
        self, local_events: list[RPCMessage], remote_events: list[RPCMessage]
    ) -> list[RPCMessage]:
        all_events = local_events + remote_events
        ordered: list[RPCMessage] = []
        remaining = list(all_events)

        while remaining:
            candidates = [
                e for e in remaining
                if all(
                    e.vector_clock.happens_before(o.vector_clock) or e == o
                    for o in remaining
                ) or not any(
                    o.vector_clock.happens_before(e.vector_clock)
                    for o in remaining if o != e
                )
            ]
            if not candidates:
                candidates = [min(remaining, key=lambda e: e.timestamp)]
            chosen = min(candidates, key=lambda e: e.timestamp)
            ordered.append(chosen)
            remaining.remove(chosen)
            self._merged_clock = self._merged_clock.merge(chosen.vector_clock)

        return ordered


RPCHandler = Callable[[RPCMessage], Coroutine[Any, Any, RPCMessage | None]]


class HierarchicalRPCPipeline:
    """
    Core gRPC-style streaming pipeline for SkyGarage 3-tier architecture.
    Patent Component [660] - Unified Governance Registry.

    Building Edge -> Complex Edge -> NOC Hub
    with hash chain integrity, E2E encryption, and autonomous failover.
    """

    def __init__(self, node_id: str, tier: TierLevel) -> None:
        self.node_id = node_id
        self.tier = tier
        self._handlers: dict[str, RPCHandler] = {}
        self._hash_chain = IntegrityHashChain()
        self._encryptor = E2EEncryptor()
        self._cache = EdgeNodeCache(node_id)
        self._upstream: "HierarchicalRPCPipeline | None" = None
        self._downstream: list["HierarchicalRPCPipeline"] = []
        self._event_queue: asyncio.Queue[RPCMessage] = asyncio.Queue()
        self._governance_lockouts: set[str] = set()
        self._governance_registry_id = GOVERNANCE_REGISTRY_ID

    def connect_upstream(self, upstream: "HierarchicalRPCPipeline") -> None:
        self._upstream = upstream
        upstream._downstream.append(self)

    def register_handler(self, method: str, handler: RPCHandler) -> None:
        self._handlers[method] = handler

    def is_locked_out(self, client_id: str) -> bool:
        return client_id in self._governance_lockouts

    def lockout_client(self, client_id: str) -> None:
        self._governance_lockouts.add(client_id)

    async def send_upstream(self, message: RPCMessage) -> RPCMessage | None:
        if self.is_locked_out(message.complex_id):
            raise GovernanceViolation(
                f"Client {message.complex_id} locked out by {self._governance_registry_id}",
                client_id=message.complex_id,
            )

        block = self._hash_chain.append(message.serialize())
        message.integrity_hash = block.block_hash

        if self._upstream is None or self._cache.status == SyncStatus.CACHED:
            self._cache.store_locally(message)
            return None

        try:
            return await self._upstream.receive_from_downstream(message)
        except (ConnectionError, NetworkSplitError):
            self._cache.enter_cached_mode()
            self._cache.store_locally(message)
            return None

    async def receive_from_downstream(self, message: RPCMessage) -> RPCMessage | None:
        if self.is_locked_out(message.complex_id):
            raise GovernanceViolation(
                f"Client {message.complex_id} rejected by Governance {self._governance_registry_id}",
                client_id=message.complex_id,
            )

        handler = self._handlers.get(message.method)
        if handler:
            response = await handler(message)
            if response:
                return response

        if self._upstream and self.tier != TierLevel.NOC_HUB:
            block = self._hash_chain.append(message.serialize())
            message.integrity_hash = block.block_hash
            return await self._upstream.receive_from_downstream(message)

        return None

    async def resync_with_upstream(self) -> int:
        if self._upstream is None:
            return 0

        pending = self._cache.drain_for_resync()
        if not pending:
            self._cache.confirm_resync_complete()
            return 0

        merger = ResyncMerger()
        merged = merger.merge_events(pending, [])

        for msg in merged:
            block = self._hash_chain.append(msg.serialize())
            msg.integrity_hash = block.block_hash
            await self._upstream.receive_from_downstream(msg)

        self._cache.confirm_resync_complete()
        return len(merged)

    async def broadcast_downstream(self, message: RPCMessage) -> None:
        for downstream in self._downstream:
            await downstream.receive_from_upstream(message)

    async def receive_from_upstream(self, message: RPCMessage) -> None:
        handler = self._handlers.get(message.method)
        if handler:
            await handler(message)
        await self._event_queue.put(message)

    def verify_chain_integrity(self) -> bool:
        return self._hash_chain.verify_integrity()

    @property
    def chain_length(self) -> int:
        return self._hash_chain.length

    @property
    def sync_status(self) -> SyncStatus:
        return self._cache.status

    @property
    def pending_cache_count(self) -> int:
        return self._cache.pending_count
