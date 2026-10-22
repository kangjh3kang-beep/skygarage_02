# Feedback and growth loop foundation Implementation Plan

> **For agentic workers:** Execute inline with superpowers:executing-plans. Claude performs scoped discovery and cross-review. Complete one task with evidence before taking the next.

**Goal:** Activate GitHub-based collaboration, reproducible software gates, and failure-to-retest evidence while retaining all operational acceptance requirements.
**Architecture:** Reuse the existing Platform contracts workflow and 36-requirement catalog. Track work in issues #20–27, maintain common agent guidance, and add a lint regression gate. Separate software observations from human and field acceptance.
**Tech Stack:** React, TypeScript, Node 24.22.1 LTS, ESLint, GitHub Actions, disposable PostgreSQL.
**Spec:** docs/collaboration/COORDINATION.md; docs/INTEGRATED-PLATFORM-PLAN.md; GitHub issue #27.

## Global constraints

- Preserve the original 36 requirements; no fake operational completion or production fixture data.
- Claude owns inquiry UX discovery and agreed client edits; Codex owns shared files, server contracts and integration.
- Record all changes against base/head SHA; do not modify production DB during foundation work.
- Node version is 24.22.1, verified against the official release index and SHA-256 archive.

## Review focus

- Existing lint debt must not conceal a new diagnostic, removed files, or configuration suppression.
- A passing CI check must not be treated as actual account/device/field acceptance.
- Stale commit results must not close an issue about a newer failure.
- The same GitHub identity cannot count as two independent approvers.
- Existing inquiry data and access gates remain intact until contracts and tests justify a change.

### Task 1: Shared coordination

Files: AGENTS.md, CLAUDE.md, docs/collaboration/COORDINATION.md, .github templates, docs/collaboration/WORK-STATUS.md.
- [x] Add shared guidance and actual issue/role mapping.
- [x] Validate references and ownership. Documentation has no artificial unit tests.
- [x] Commit the independently reviewable coordination change.

### Task 2: Reproducible lint regression gate

Files: scripts/lint-baseline.mjs, tests/lint-baseline.test.mjs, docs/verification/lint-baseline.json, .nvmrc, package.json, .github/workflows/platform-contracts.yml.
Interfaces: compareSnapshots(current, baseline) returns new/increased diagnostics and resolved counts. Fingerprints include repository-relative path, rule, severity and message; line numbers are excluded so harmless movement does not invent regressions. Gate documents that identical-fingerprint replacement is not a new-defect detector.
- [x] Write tests for new/increased diagnostics, new files, removed files, warning/error separation and moved lines. Observe failure.
- [x] Implement deterministic comparison and local lint gate with explicit nonzero exit on regression.
- [x] Freeze existing diagnostics as debt. Never auto-update baseline in CI. Detect configuration changes for explicit review; do not weaken rules.
- [x] Pin Node 24.22.1, run the gate in CI, upload reports and summarize software scope.
- [ ] Verify exact-head CI after final commit; local contracts 140, UI 25, Python 167, build/inventory/lint gate passed.

### Task 3: Working feedback and growth records

Files: docs/collaboration/WORK-STATUS.md, docs/collaboration/FEEDBACK-LOG.md, docs/contracts/corporate-inquiries.md, scripts/ci-feedback.mjs, tests/ci-feedback.test.mjs, .github/workflows/ci-feedback.yml.
- [x] Implement current-main failure/recovery issue updates, ignoring stale or unrelated runs; verify with failing then passing tests.
- [x] Publish issue links, initial measurements, responsibilities and ordered dependencies.
- [x] Record Claude's actual response and Codex's verification; publish a concise handoff on the relevant issue.
- [x] Write the inquiry contract from checked source and review. Open questions must remain explicit and block only dependent implementation.
- [x] Record every failure, fix, retest and reviewer outcome. Do not declare current operational acceptance counts without querying actual evidence.

### Task 4: Review and integrate

- [x] Obtain fresh review of the whole branch and Claude's scoped UX review.
- [x] Fix substantive findings with a reproducing test; rerun affected suites.
- [ ] Final exact-head CI and ready-for-review status for published, attached PR #30.
- [ ] Main integration and next implementation stage follow verified CI, approved release scope and repository policy. Current automatic issue workflow is not active until main integration.
