# Platform verification harness

## Scope and interpretation

The harness inventories every declared React route, its source and transitive local imports (including parent layouts), referenced tables/RPCs/Edge Functions, static navigation targets and interactive controls. Static HTML utility pages are recorded separately. A declared route, a rendered page, a permitted API, and an accepted operational workflow are different evidence types.

`/admin/validation` exposes the inventory, availability filters, links to finance/ERP and governance, and deterministic command-failure scenarios. Local scenario exports explicitly identify themselves as models and never grant operational readiness.

The original 36 requirements and their acceptance gates remain unchanged. Finance/ERP expansion needs additional explicit acceptance cases. This release does not claim full user payments, field hardware commissioning, autonomous AI operation, or bank reconciliation.

## Reproducible checks

```sh
npm ci
npm run inventory
npm run test:contracts
npm run test:ui
npm run test:database
npm run test:finance
npm run test:erp
npm run build
```

Native PostgreSQL tests require a non-root environment and exercise concurrency. For a root-only sandbox, use `test:database:wasm`, `test:finance:wasm` and `test:erp:wasm`; these do not establish native concurrent execution. CI retains the PostgreSQL 17 gates and adds inventory freshness and UI harness checks. `npm run test:harness` runs the local WASM variant.

The UI harness uses real React components in jsdom, a disposable synthetic transport, and no external network. It renders all paths in empty/healthy, permission-error and populated states. A route behind an existing commissioning barrier is recorded as a barrier, not a successful operational module. A login screen is authentication gating, not acceptance of the page behind it. Unknown URLs must have a visible fallback. A synthetic transport is not hosted Supabase Auth/REST or browser-engine acceptance.

The separate finance journey connects real React controls to the actual finance/ERP SQL in disposable PostgreSQL/WASM. It creates a synthetic facility and tariff, issues test coins, quotes and pays, checks gross/commission/net in SQL, exports source journals, rejects self-approval in the UI, changes to an independent synthetic actor, posts the ERP import and renders reports. Synthetic Auth claims and the RPC transport remain fixtures. No production database, customer balance, provider account or device is modified.

Generated runtime evidence is written to ignored `artifacts/ui-harness.json` and `artifacts/finance-ui-journey.json`. Failed runs must not be presented as passed evidence. The static `src/lib/page-inventory.json` is committed and checked against current source; regenerate it after changing routes, imports or actions.

## Corrections included

- Finance and own ERP now pass the parent admin availability gate. Their APIs still enforce headquarters MFA and sandbox-only behavior.
- Authenticator onboarding explains the app, QR enrollment, code entry and recovery route. A verification response without confirmed AAL2 does not open the admin screen.
- The legacy fleet client PIN is removed. Tracking and fleet access use the existing database-role/MFA boundary. Demo seeding into the connected database is removed.
- Failed workflow saves keep the dialog and do not issue a success audit. Uncommissioned execution and multi-table browser deletion remain unavailable.
- Query failures in monitoring and tracking views surface explicit errors. They are not converted into healthy zero counts. Notification mutations do not optimistically succeed on server errors.
- Legacy resident PII unmasking no longer treats six entered digits as authentication. A scoped, audited server endpoint is required before unmasking is available.
- Parking navigation targets the correct routes, and unimplemented payment actions are identified as unavailable.
- Stale deployment wording in the implementation plan is reconciled without relabeling deployment as field acceptance.

## Feedback and growth loops

1. Pin requirement, route, version and environment before testing.
2. Reproduce a failure and attach its evidence to a governance improvement task.
3. Correct the implementation; rerun the failing case and affected contracts.
4. Require independent review and valid evidence before promoting a site/module.
5. Measure an agreed operating indicator, evaluate an improvement in isolation, release narrowly, and compare against the baseline. Regressions or expired evidence block promotion.

The harness is a release tool, not a background self-improving service. Actual evidence uploads, reviewer decisions, pilot metrics and hardware records must come from real executions and responsible operators.

## Comparable-platform review

Official product material reviewed on 2026-10-20 KST:

- [Parkable](https://parkable.com/parking-management-system): centralized parking administration, permits/tenants/access and reporting suggest a consistent site context and visible operating state. This release adds a central page/connection validation view; full tenant workflows still require their server contracts.
- [Get My Parking](https://www.getmyparking.com/product.php): facility discovery, reservations, payments, partner portals and integrations suggest a continuous customer-to-operator journey. This release connects the finance/ERP entry points and tests their internal accounting journey. Reservations, QR payment, visitor permits, partner self-service and EV billing remain proposed modules until authority, provider and hardware contracts are defined.
- [ERPNext immutable ledger](https://docs.frappe.io/erpnext/immutable-ledger-in-erpnext): retain source transactions and correct posted accounting through reversals. Existing ERP contracts continue to test this behavior.
- [Supabase MFA](https://supabase.com/docs/guides/auth/auth-mfa/totp) and [explicit Data API grants](https://supabase.com/changelog/45329-breaking-change-tables-not-exposed-to-data-and-graphql-api-automatically): verify assurance and server permissions explicitly. Missing privileges are not repaired by granting broad access.

Do not import advertising performance claims as SkyGarage acceptance targets. Additional capabilities need a measurable hypothesis, scoped implementation, regression tests, independent approval and rollback criteria.

## Remaining operational gates

General-member wallet/payment APIs and trusted parking sessions; unified site/facility/seller/cost-center IDs; site operator settlement permissions; full membership/vehicle/visitor lifecycle; gateway identity and manufacturer adapters; actual HIL/SAT and independent safety circuits; model gateway/RAG evaluation; real backup restoration; pilot and multi-site measurements; and, after provider selection, signed durable webhook processing and bank reconciliation.

Browser-engine layout checks and real MFA sessions are also separate gates. jsdom and SQL fixtures do not substitute for them.
