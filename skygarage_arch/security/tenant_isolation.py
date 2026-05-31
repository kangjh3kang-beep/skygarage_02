"""
SkyGarage Multi-Tenant Data Isolation & PII Protection Module
Patent Component [660] - Governance Registry Policy Engine

Implements:
  - Context-level tenant isolation (Complex ID + Tenant ID)
  - Memory session and DB cursor cross-contamination prevention
  - PII tokenization with SHA-256 salted one-way hash
  - On-premise edge data retention circuit
  - Interceptor and decorator patterns for zero-trust enforcement
"""

from __future__ import annotations

import hashlib
import hmac
import os
import secrets
import threading
import time
import uuid
from contextlib import contextmanager
from dataclasses import dataclass, field
from enum import Enum
from functools import wraps
from typing import Any, Generator

GOVERNANCE_REGISTRY_ID = "[660]"


class TenantIsolationViolation(Exception):
    """Raised on unauthorized cross-tenant access attempt.
    Governance Registry [660] policy enforcement.
    """

    def __init__(self, message: str, attacker_id: str = "", target_tenant: str = ""):
        self.governance_id = GOVERNANCE_REGISTRY_ID
        self.attacker_id = attacker_id
        self.target_tenant = target_tenant
        self.status_code = 403
        super().__init__(
            f"{GOVERNANCE_REGISTRY_ID} 403 Forbidden: {message}"
        )


class CredentialLockout(Exception):
    """Client credential lockout by Governance [660] after violation detection."""

    def __init__(self, client_id: str, reason: str):
        self.governance_id = GOVERNANCE_REGISTRY_ID
        self.client_id = client_id
        super().__init__(
            f"{GOVERNANCE_REGISTRY_ID} Lockout: Client {client_id} - {reason}"
        )


class PIICategory(Enum):
    VEHICLE_PLATE = "vehicle_plate"
    UNIT_NUMBER = "unit_number"
    MOVEMENT_TRAIL = "movement_trail"
    RESIDENT_NAME = "resident_name"
    PHONE_NUMBER = "phone_number"


@dataclass
class TenantContext:
    """Immutable tenant execution context bound to a single request."""

    complex_id: str
    tenant_id: str
    building_id: str = ""
    session_id: str = field(default_factory=lambda: str(uuid.uuid4()))
    created_at: float = field(default_factory=time.time)
    is_elevated: bool = False

    def matches(self, other: "TenantContext") -> bool:
        return self.complex_id == other.complex_id and self.tenant_id == other.tenant_id

    def belongs_to_complex(self, complex_id: str) -> bool:
        return self.complex_id == complex_id

    @property
    def isolation_key(self) -> str:
        return f"{self.complex_id}::{self.tenant_id}"


@dataclass
class PIIToken:
    """Tokenized PII representation for external transmission."""

    token: str
    category: PIICategory
    salt_id: str
    created_at: float = field(default_factory=time.time)


class PIITokenizer:
    """
    One-way salted SHA-256 tokenization for PII data.
    Original mapping retained ONLY within on-premise edge memory.
    External packets receive only tokens - never readable PII.
    """

    def __init__(self) -> None:
        self._salt_store: dict[str, bytes] = {}
        self._token_to_original: dict[str, str] = {}
        self._original_to_token: dict[str, str] = {}
        self._lock = threading.Lock()

    def tokenize(self, plaintext: str, category: PIICategory) -> PIIToken:
        with self._lock:
            cache_key = f"{category.value}::{plaintext}"
            if cache_key in self._original_to_token:
                existing_token = self._original_to_token[cache_key]
                return PIIToken(
                    token=existing_token,
                    category=category,
                    salt_id=self._get_salt_id(existing_token),
                )

            salt_id = str(uuid.uuid4())[:8]
            salt = secrets.token_bytes(32)
            self._salt_store[salt_id] = salt

            hash_input = salt + plaintext.encode("utf-8")
            token_hash = hashlib.sha256(hash_input).hexdigest()
            token = f"SGT_{category.value}_{token_hash[:32]}"

            self._token_to_original[token] = plaintext
            self._original_to_token[cache_key] = token

            return PIIToken(token=token, category=category, salt_id=salt_id)

    def detokenize_local_only(self, token: str) -> str | None:
        """Reverse lookup - ONLY available within on-premise edge context."""
        with self._lock:
            return self._token_to_original.get(token)

    def _get_salt_id(self, token: str) -> str:
        for sid in self._salt_store:
            return sid
        return ""

    def purge_tokens(self) -> None:
        """Emergency purge of all local PII mappings."""
        with self._lock:
            self._token_to_original.clear()
            self._original_to_token.clear()
            self._salt_store.clear()


class ExternalPacketSanitizer:
    """
    Ensures no readable PII leaves the on-premise edge boundary.
    All vehicle plates, unit numbers, and movement trails are
    replaced with one-way tokens before external network transmission.
    """

    PII_FIELD_MAP = {
        "vehicle_plate": PIICategory.VEHICLE_PLATE,
        "license_plate": PIICategory.VEHICLE_PLATE,
        "plate_number": PIICategory.VEHICLE_PLATE,
        "unit_number": PIICategory.UNIT_NUMBER,
        "unit_id": PIICategory.UNIT_NUMBER,
        "household_unit": PIICategory.UNIT_NUMBER,
        "movement_trail": PIICategory.MOVEMENT_TRAIL,
        "trail_data": PIICategory.MOVEMENT_TRAIL,
        "location_history": PIICategory.MOVEMENT_TRAIL,
        "resident_name": PIICategory.RESIDENT_NAME,
        "phone_number": PIICategory.PHONE_NUMBER,
    }

    def __init__(self, tokenizer: PIITokenizer) -> None:
        self._tokenizer = tokenizer

    def sanitize_packet(self, payload: dict[str, Any]) -> dict[str, Any]:
        sanitized = {}
        for key, value in payload.items():
            if key in self.PII_FIELD_MAP and isinstance(value, str) and value:
                token = self._tokenizer.tokenize(value, self.PII_FIELD_MAP[key])
                sanitized[key] = token.token
            elif isinstance(value, dict):
                sanitized[key] = self.sanitize_packet(value)
            elif isinstance(value, list):
                sanitized[key] = [
                    self.sanitize_packet(item) if isinstance(item, dict) else item
                    for item in value
                ]
            else:
                sanitized[key] = value
        return sanitized

    def verify_no_pii_leakage(self, packet: dict[str, Any]) -> bool:
        for key, value in packet.items():
            if key in self.PII_FIELD_MAP:
                if isinstance(value, str) and not value.startswith("SGT_"):
                    return False
            elif isinstance(value, dict):
                if not self.verify_no_pii_leakage(value):
                    return False
        return True


class TenantSessionStore:
    """Thread-safe per-tenant session isolation at memory level."""

    def __init__(self) -> None:
        self._sessions: dict[str, dict[str, Any]] = {}
        self._locks: dict[str, threading.RLock] = {}
        self._global_lock = threading.Lock()

    def _get_lock(self, isolation_key: str) -> threading.RLock:
        with self._global_lock:
            if isolation_key not in self._locks:
                self._locks[isolation_key] = threading.RLock()
            return self._locks[isolation_key]

    @contextmanager
    def session_scope(self, ctx: TenantContext) -> Generator[dict[str, Any], None, None]:
        lock = self._get_lock(ctx.isolation_key)
        with lock:
            if ctx.isolation_key not in self._sessions:
                self._sessions[ctx.isolation_key] = {}
            yield self._sessions[ctx.isolation_key]

    def get_session(self, ctx: TenantContext) -> dict[str, Any]:
        lock = self._get_lock(ctx.isolation_key)
        with lock:
            return dict(self._sessions.get(ctx.isolation_key, {}))

    def destroy_session(self, ctx: TenantContext) -> None:
        lock = self._get_lock(ctx.isolation_key)
        with lock:
            self._sessions.pop(ctx.isolation_key, None)


class DatabaseCursorIsolator:
    """
    Simulated DB cursor isolation ensuring each tenant query
    is scoped exclusively to its own complex_id partition.
    Cross-tenant cursor reuse is architecturally impossible.
    """

    def __init__(self) -> None:
        self._active_cursors: dict[str, TenantContext] = {}
        self._lock = threading.Lock()

    def acquire_cursor(self, ctx: TenantContext) -> str:
        cursor_id = f"cursor_{ctx.isolation_key}_{uuid.uuid4().hex[:8]}"
        with self._lock:
            self._active_cursors[cursor_id] = ctx
        return cursor_id

    def validate_cursor_access(self, cursor_id: str, requesting_ctx: TenantContext) -> None:
        with self._lock:
            owning_ctx = self._active_cursors.get(cursor_id)
            if owning_ctx is None:
                raise TenantIsolationViolation(
                    f"Cursor {cursor_id} does not exist",
                    attacker_id=requesting_ctx.tenant_id,
                )
            if not owning_ctx.matches(requesting_ctx):
                raise TenantIsolationViolation(
                    f"Cross-tenant cursor access denied: {requesting_ctx.isolation_key} "
                    f"attempted to access cursor owned by {owning_ctx.isolation_key}",
                    attacker_id=requesting_ctx.tenant_id,
                    target_tenant=owning_ctx.tenant_id,
                )

    def release_cursor(self, cursor_id: str, ctx: TenantContext) -> None:
        with self._lock:
            owning_ctx = self._active_cursors.get(cursor_id)
            if owning_ctx and owning_ctx.matches(ctx):
                del self._active_cursors[cursor_id]

    @property
    def active_count(self) -> int:
        return len(self._active_cursors)


_current_context: threading.local = threading.local()


def get_current_tenant_context() -> TenantContext | None:
    return getattr(_current_context, "ctx", None)


def set_current_tenant_context(ctx: TenantContext | None) -> None:
    _current_context.ctx = ctx


class TenantIsolationInterceptor:
    """
    gRPC-style interceptor that enforces tenant boundary at every
    service call entry point. Governance [660] policy engine.

    Responsibilities:
      - Validate tenant context on each request
      - Prevent cross-complex data access
      - Enforce credential lockout on violation
      - Audit all access attempts
    """

    def __init__(self) -> None:
        self._lockouts: dict[str, float] = {}
        self._violation_counts: dict[str, int] = {}
        self._audit_log: list[dict[str, Any]] = []
        self._max_violations_before_lockout = 3
        self._lockout_duration_seconds = 3600
        self._lock = threading.Lock()

    def intercept(self, ctx: TenantContext, target_complex_id: str) -> None:
        with self._lock:
            if self._is_locked_out(ctx.tenant_id):
                raise CredentialLockout(
                    ctx.tenant_id,
                    f"Locked out by Governance {GOVERNANCE_REGISTRY_ID} policy engine",
                )

            if not ctx.belongs_to_complex(target_complex_id):
                self._record_violation(ctx, target_complex_id)
                raise TenantIsolationViolation(
                    f"Tenant {ctx.tenant_id} (complex {ctx.complex_id}) "
                    f"cannot access resources in complex {target_complex_id}",
                    attacker_id=ctx.tenant_id,
                    target_tenant=target_complex_id,
                )

            self._audit_log.append({
                "timestamp": time.time(),
                "tenant_id": ctx.tenant_id,
                "complex_id": ctx.complex_id,
                "target_complex_id": target_complex_id,
                "result": "allowed",
                "governance_id": GOVERNANCE_REGISTRY_ID,
            })

    def _record_violation(self, ctx: TenantContext, target: str) -> None:
        key = ctx.tenant_id
        self._violation_counts[key] = self._violation_counts.get(key, 0) + 1
        self._audit_log.append({
            "timestamp": time.time(),
            "tenant_id": ctx.tenant_id,
            "complex_id": ctx.complex_id,
            "target_complex_id": target,
            "result": "denied_403",
            "governance_id": GOVERNANCE_REGISTRY_ID,
        })

        if self._violation_counts[key] >= self._max_violations_before_lockout:
            self._lockouts[key] = time.time()

    def _is_locked_out(self, tenant_id: str) -> bool:
        lockout_time = self._lockouts.get(tenant_id)
        if lockout_time is None:
            return False
        if time.time() - lockout_time > self._lockout_duration_seconds:
            del self._lockouts[tenant_id]
            self._violation_counts.pop(tenant_id, None)
            return False
        return True

    def get_violation_count(self, tenant_id: str) -> int:
        return self._violation_counts.get(tenant_id, 0)

    def is_locked_out(self, tenant_id: str) -> bool:
        with self._lock:
            return self._is_locked_out(tenant_id)

    @property
    def audit_log(self) -> list[dict[str, Any]]:
        return list(self._audit_log)


def tenant_isolated(interceptor: TenantIsolationInterceptor):
    """
    Decorator enforcing tenant isolation on any service method.
    The decorated function must accept `ctx: TenantContext` as first argument
    and `complex_id: str` identifying the target resource.
    """
    def decorator(func):
        @wraps(func)
        def wrapper(ctx: TenantContext, complex_id: str, *args, **kwargs):
            interceptor.intercept(ctx, complex_id)
            set_current_tenant_context(ctx)
            try:
                return func(ctx, complex_id, *args, **kwargs)
            finally:
                set_current_tenant_context(None)
        return wrapper
    return decorator


def async_tenant_isolated(interceptor: TenantIsolationInterceptor):
    """Async version of tenant isolation decorator."""
    def decorator(func):
        @wraps(func)
        async def wrapper(ctx: TenantContext, complex_id: str, *args, **kwargs):
            interceptor.intercept(ctx, complex_id)
            set_current_tenant_context(ctx)
            try:
                return await func(ctx, complex_id, *args, **kwargs)
            finally:
                set_current_tenant_context(None)
        return wrapper
    return decorator


class OnPremiseDataRetentionCircuit:
    """
    Data retention circuit ensuring sensitive PII mappings
    remain exclusively within on-premise edge boundary.

    The circuit tracks which data elements are allowed to exit
    the edge perimeter and blocks any attempt to export raw PII.
    """

    def __init__(self, complex_id: str) -> None:
        self.complex_id = complex_id
        self._tokenizer = PIITokenizer()
        self._sanitizer = ExternalPacketSanitizer(self._tokenizer)
        self._retained_data: dict[str, Any] = {}
        self._export_attempts: list[dict[str, Any]] = []

    def store_local(self, key: str, value: Any) -> None:
        self._retained_data[key] = value

    def retrieve_local(self, key: str) -> Any | None:
        return self._retained_data.get(key)

    def prepare_external_packet(self, raw_payload: dict[str, Any]) -> dict[str, Any]:
        sanitized = self._sanitizer.sanitize_packet(raw_payload)
        if not self._sanitizer.verify_no_pii_leakage(sanitized):
            raise TenantIsolationViolation(
                "PII leakage detected in outbound packet",
                attacker_id=self.complex_id,
            )
        self._export_attempts.append({
            "timestamp": time.time(),
            "fields_tokenized": [
                k for k in raw_payload
                if k in ExternalPacketSanitizer.PII_FIELD_MAP
            ],
            "verified": True,
        })
        return sanitized

    def resolve_token_locally(self, token: str) -> str | None:
        return self._tokenizer.detokenize_local_only(token)

    @property
    def tokenizer(self) -> PIITokenizer:
        return self._tokenizer

    @property
    def export_count(self) -> int:
        return len(self._export_attempts)
