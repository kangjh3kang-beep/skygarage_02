# Platform foundation and site template generator

Status: 2026-10-18. This release enables resident accounts, requests, protected administrator review, and sandbox site generation. It does not certify hardware operations or a complete franchise platform.

## Surfaces and domain transition

| Surface | Target | Current transition behavior |
| --- | --- | --- |
| Corporate marketing | https://www.skygarage.net/ | Keep landing page and existing content |
| Resident application | https://skygarage.app/app | App host root redirects to /app; requires custom domain and TLS verification |
| Platform administration | https://www.skygarage.net/admin | Database role and MFA required; ops.skygarage.net is a proposed later host |
| Site administration | /admin/sites/:siteId (planned) | Server-verified site role, not a client-selected tenant, must determine access |

The marketing App link remains /app until VITE_OFFICIAL_APP_ORIGIN is set to exactly https://skygarage.app after DNS/TLS validation. Do not set it while the domain is unverified. Cross-origin browser sessions and installed PWAs do not transfer automatically. Do not pass access or refresh tokens through URLs. Redirect legacy application links only after validating deep links, MFA, registration, allowed origins and recovery on the new domain.

The current shared build is a transition, not isolated deployment infrastructure. Separate marketing, app, and administration build/deployment boundaries are a later gate. DNS host separation alone is not tenant isolation.

## Implemented data flow

1. Server-verified resident registration creates the Auth identity and resident profile. PASS is an inactive provider boundary until a contracted provider is integrated and verified.
2. A resident submits a request through `sgp_submit_service_request`. Ownership, verified account, input bounds, idempotency and rate limits are checked by the database.
3. A DB-appointed super administrator at MFA level aal2 reviews the request. Closed records are immutable to browser clients. The user sees the saved response through RLS-protected reads.
4. A super administrator previews a standard site configuration and calls `platform_generate_site`. The server creates a new sandbox site, immutable blueprint and private audit event in one transaction.
5. The same request ID and payload return the same site. A changed payload with the same ID fails. The client cannot select ready status, copy credentials or inject role grants.

Requests currently go to central operations, without site assignment. A completed response does not create membership, grant access, register a vehicle or start a mission. Those are separate, audited commands in a future phase.

## Template generator T1

Standard version: `residence-foundation/1.0.0`. Types: apartment, officetel, mixed. Inputs: name 2–120 characters, households 1–10,000, parking spaces 0–20,000. Integers only; database validates again. Capacity is configuration, not commissioned physical capacity.

Generated settings: DOELV brand, manual membership approval, resident profile and request modules, sandbox state. Hardware, payments and access grants are disabled. Members, vehicles, users, roles, device credentials, contracts, payment accounts and personal data are never cloned.

Only DB super_admin + aal2 may generate or read blueprints. Browser update/delete/insert grants are absent; all generation passes the exact RPC. One creator is limited to 20 generations per hour, serialized by advisory lock. An ID is allocated afresh for each site. Database superusers retain maintenance authority; append-only application audit does not mean tamper-proof against DB owners.

## Planned template lifecycle and contracts

- Catalog: draft → validated → independently approved → published → deprecated. Immutable version and digest; an amendment always creates a new version.
- Site release: draft → sandbox → site acceptance → ready → suspended → retired. The generator supports only sandbox; no ready transition API exists in this release.
- Override precedence: global approved template → regional policy → site override. Safety, permissions, legal consent and credential rules cannot be weakened by an override.
- Upgrade: diff and dry-run → two-person review → sandbox contract tests → pilot site → observed rollout. Existing sites stay pinned; no silent mass migration.
- Rollback restores a prior compatible configuration reference. It never rewinds financial ledgers, audit logs, member consent or physical missions.
- Provisioning saga: persist intent + outbox atomically; idempotent steps for namespace, site roles, modules, adapters and routes; retries with bounded backoff, dead-letter queue and operator intervention. External calls never run inside long DB transactions.
- Hardware secrets live in a dedicated secret store and are referenced by IDs. No tokens or executable scripts in templates. Adapter endpoints require explicit allowlists and SSRF protection.

## Integrated franchise pipeline to build next

Marketing lead → qualified case → reviewed contract → organization/site creation → scoped administrator invitation → resident application and approval → verified vehicle → mission request → MOS decision → device adapter → independent safety controller → actual device acknowledgement → reconciled status → audit and feedback.

Each event needs event_id, tenant/site scope, aggregate ID and version, occurred_at, schema_version, correlation_id and causation_id. A producer outbox and consumer inbox prevent loss and duplicate effects. Order is per aggregate; stale or replayed messages cannot reopen terminal states. WebSocket/Realtime messages are notifications, not an authorization source. After reconnect, read authoritative state before enabling actions.

The marketing inquiry insert still uses the legacy `inquiries` table; its end-to-end pipeline is not accepted in this release. Replace it with a server-validated, abuse-controlled intake with consent version and receipt, then central case management. Do not open legacy table grants wholesale.

## Acceptance gates

| Gate | Required evidence | Present status |
| --- | --- | --- |
| G0 baseline | Catalog versions, reproducible inventory, owners, risk register | Reviewed sources; full external catalog/oracles still needed |
| G1 resident foundation | Build, UI/mobile, signup/login recovery, request persistence, RLS, MFA | Automated checks and transactional DB evidence; owner/device UAT outstanding |
| T1 sandbox generator | Input validation, role/MFA, idempotency, rollback, no privilege/PII clone | Implemented; transactional DB tests passed |
| G2 domain/lead flow | DNS/TLS, every route, cross-origin login, lead receipt and admin visibility | Pending domain administration and intake implementation |
| T2 site operations | Scoped site roles, member/vehicle approval, template version review/diff | Planned, no operational acceptance |
| G3 MOS/adapter contracts | Signed schemas, compatibility, replay/timeout/stale safety tests | Hardware providers and contracts required |
| G4 physical acceptance | Independent interlock, E-stop, power/network loss, witnessed HIL/site tests | No registered devices; not accepted |
| G5 pilot franchise | Restore drill, reconciled billing, incident response, first/second site pilot | Not accepted |

A gate passes only when every mandatory test has evidence against a pinned version, critical/high defects are closed, and its required owner signs. A mock, skipped test or unverified dependency never counts as passed. Keep original requirement denominators and explicit scope changes; do not report a total completion percentage from a subset of new tests.

## Verification and limitations

- Build: TypeScript + Vite.
- Node tests cover SMS proof, provider errors, roles, disabled legacy commands, template input and domains.
- Rollback DB tests cover cross-user/site isolation, forged metadata, MFA review, request idempotency/closed-state rules, immutable template generation and audit; fixtures do not remain.
- Browser UI tests use fixtures for authenticated screen states; this is visual/navigation evidence only, not live authentication proof.
- Live HTTP checks cover the eight disabled legacy functions and anonymous template rejection.
- Full resident account/MFA acceptance on Android/iOS and real domain install/uninstall remain required. A production synthetic-verified-user test was not performed.

Supabase Advisor reports an expected authenticated SECURITY DEFINER warning for the narrow generator RPC. Review rationale: no direct table grants, explicit auth.uid + DB role + aal2, empty search_path, typed parameters, bounds, immutable server-generated output and audit. This is not a blanket exception for future definers. Legacy RLS-with-no-policy notices reflect intentionally closed tables.
