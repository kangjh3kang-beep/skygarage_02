# 문의 관리자 서버 단계 실행 — #23 / #25

Spec: docs/contracts/inquiry-admin-v1.md
Base: e3407de96259c7ac0cf5c21e8637525e40604be5 (PR #30, 미병합)
Owner: Codex. Reviewer: Claude, 최종 fresh-context 검토.

## Global Constraints

supabase/sql/corporate-inquiries.sql, 새 CLI 생성 migration, tests/inquiry-admin-database.test.mjs, tests/helpers/inquiry-database.mjs, CI와 계약 문서만 수정한다. 기존 데이터/관리자 게이트 보존. 운영 DB는 변경하지 않는다. 실제 접수 동의·전달·UI 통합은 별도 단계로 명시한다.

### Task 1: 계약 고정과 실패 시험

Produces: v1 RPC 명세와 synthetic PostgreSQL fixture.
Steps: 계약 커밋. 원본 schema 적용 fixture와 동작 시험 작성. 새 RPC 부재 및 기존 일반 회원 직접 읽기 가능을 실패로 확인한다. 범위는 권한, JSON 검증, 상태, retry, revision, audit, pagination.
Validation: node --test tests/inquiry-admin-database.test.mjs; 예상 RED.

### Task 2: 서버 구현과 CI

Consumes: Task 1 v1 RPC/fixture. Produces: SQL와 동일 내용 migration, native CI.
Steps: 승인된 역할과 MFA, 제한된 공개 INSERT, private RPC, 감사·원자적 변경 구현. 실패 시험 GREEN, native PostgreSQL 동시 연결 경합 시험, 전체 contracts/build/lint 확인. migration은 CLI 생성, 운영 미적용.
Validation: npm run test:contracts; INQUIRY_NATIVE=1 node --test tests/inquiry-admin-database.test.mjs; npm run build; npm run lint:check.

### Task 3: 교차 검토와 인계

Consumes: Task 2 검증된 SQL/계약. Produces: Claude 검토, 새 PR 및 실행 근거.
Steps: Claude CLI read-only 계약/UI 검토. fresh whole-branch review. 중요 결함 RED→GREEN 수정. 새 PR 생성, GitHub #23/#25/#26/#27 상태 및 G 드라이브 기록. 실제 운영 단계는 완료로 표시하지 않는다.
Validation: 최종 SHA의 CI 결과. 병합은 사용자 승인 대기인 PR #30에 종속된 stacked PR로 제출한다.
