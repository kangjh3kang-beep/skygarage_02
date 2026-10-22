# 기업 문의 관리자 계약 v1 — #23 / #25

기반: PR #30 `e3407de96259c7ac0cf5c21e8637525e40604be5`. 작성 Codex, 교차 검토 Claude. 이 계약은 코드 구현 대상이며 운영 DB에 적용되지 않았다.

## 범위와 권한

- 기존 `inquiries`의 text ID·고객 입력·레거시 메모/이력을 보존한다. `sgp_service_requests`와 합치거나 가짜 회원을 만들지 않는다.
- 모든 관리자 RPC는 `auth.uid()`, JWT `aal2`, 현재 `user_roles.role = super_admin`을 매번 확인한다. 사용자 수정 가능한 metadata는 쓰지 않는다. 현장 operator/viewer는 무소속 기업 문의에 접근하지 않는다. 담당자는 현재 super_admin 계정만 배정할 수 있다.
- 기존 익명/로그인 공개 폼의 6개 입력 열 INSERT는 유지한다. 조회·갱신·삭제와 관리자 열 INSERT는 차단한다. 공개 접수의 동의 증빙·재시도 RPC·남용 방지는 별도 후속 계약이며 이번 v1에 구현되었다고 표시하지 않는다.
- 관리자 경로 게이트는 유지한다. 실제 운영 권한 함수는 조회 승인 거부로 대조하지 못했다. 배포 전 권한 차이 검토가 필요하다.

## RPC

`platform_inquiry_list(p_status text = 'all', p_after text = null)` → `{rows, next_cursor}`. 50개씩 ID 오름차순의 불투명 커서. rows는 id/company/name/project_type/status/assigned_to/revision/created_at/updated_at/reply_saved_at/delivery_status. 연락처·본문은 상세에서만 조회한다. status는 all 또는 접수대기/검토중/보류/답변완료.

`platform_inquiry_detail(p_id text)` → `{inquiry, events}`. inquiry는 기존 열과 revision(초기 1), assigned_to, reply_saved_at, delivery_status. events는 최근 100건(시간·id 내림차순), 이전 이력은 아래 RPC로 순회한다. 기존 admin_notes/status_history는 출처 확인 불가 레거시 기록으로 별도 표시한다.

`platform_inquiry_events(p_id text, p_before bigint = null)` → `{rows,next_cursor}`. 단조 증가 event ID 역순 50개. 각 event는 id/inquiry_id/actor_id/action/data/revision/created_at. 연락처·고객 본문·답변 원문을 감사 이벤트에 복제하지 않는다. note의 data에는 검증된 메모 본문이 저장된다.

`platform_inquiry_command(p_request_id uuid, p_action text, p_payload jsonb)` → `{id,revision,status,assigned_to,reply_saved_at,delivery_status}`. payload 공통 필수: `id` string, `expected_revision` 양의 정수. 허용하지 않은 키와 잘못된 JSON 타입은 거부한다.

| action | 추가 payload | 동작 |
|---|---|---|
| assign | assigned_to: uuid 또는 null | 현재 super_admin 배정/해제 |
| note | body: 1–2000자 | 서버 actor/시각을 가진 메모 이벤트 추가 |
| save_reply | body: 1–5000자 | 답변 초안 저장, 발송하지 않음 |
| start_review | reason: 1–500자 | 접수대기 → 검토중 |
| hold | reason: 1–500자 | 접수대기/검토중 → 보류 |
| resume | reason: 1–500자 | 보류 → 검토중 |
| complete | reason: 1–500자 | 검토중 → 답변완료, 비어 있지 않은 답변 필요 |
| reopen | reason: 1–500자 | 답변완료 → 검토중 |

완료된 문의의 save_reply는 거부하고 reopen 후 편집한다. 배정과 메모는 모든 상태에서 가능하다. `답변완료`는 내부 처리 완료이며 외부 전달 성공이 아니다. 새 답변 `delivery_status=not_sent`, 과거 replied_at/답변 존재 시 `legacy_unknown`; 전달 성공을 쓰는 명령은 없다. UI는 반드시 “답변 저장됨 · 미발송” 또는 “이전 발송 여부 미확인”으로 구분한다.

동일 actor/request_id/action/payload 재시도는 같은 결과만 반환하고 이력·revision을 중복 추가하지 않는다. 동일 키의 다른 내용은 idempotency_conflict. 권한 회수 후에는 재시도도 거부한다. 다른 actor의 키는 별개다. 문의 행 잠금과 expected_revision으로 오래된 수정은 version_conflict로 거부한다. 성공한 변경·이력·중복 방지 영수증은 한 트랜잭션이다. 목록/상세/이력 조회도 개인정보 본문 없이 별도 접근 감사에 기록한다.

## 오류와 UI 규칙

- 42501: authentication_required / mfa_required / inquiry_access_denied / permission denied.
- 22023: invalid_inquiry_command / invalid_inquiry_filter / invalid_inquiry_cursor / invalid_assignee / invalid_body / invalid_reason.
- P0001: inquiry_unavailable / version_conflict / idempotency_conflict / invalid_transition / reply_required.
- 폼 입력은 오류·timeout에 보존한다. 명령 재시도는 동일 UUID·동일 payload, 충돌 후 새로 조회·검토한 수정은 새 UUID. DB 내부 오류를 고객에게 그대로 보여주지 않는다.
- 목록 응답은 전체 건수가 아니다. next_cursor가 null일 때까지 순회한다. 실제 발송 버튼·삭제·게이트 개방은 이번 범위 밖이다.

## 배포 순서와 검증

1. 폐기 DB에서 원본 마이그레이션과 운영에서 관찰된 추가 정책/열 권한을 fixture로 재현한다. 실제 운영 정책과 동일하다는 보장은 하지 않는다.
2. 테스트에서 일반 회원/anon/aal1/권한 회수·직접 우회·메모/상태/배정·재시도·동시성·트랜잭션 롤백·페이지 경계를 검증한다.
3. PR #30 병합 후 최신 main 통합, 운영 정책 diff 승인, 백업, SQL migration 적용, RPC 연결 UI 통합 시험 순서로 진행한다. 오래된 관리자 direct CRUD는 migration 후 거부되므로 경로 게이트 유지가 전제다.
4. 실패 시 권한을 느슨하게 복구하지 않는다. 관리자 게이트를 닫고 forward fix한다. 기존 데이터/감사는 삭제하지 않는다.
5. 합성 SQL 검사는 hosted JWT/REST/MFA, 실제 계정, 외부 전달, 보존 정책의 운영 인수를 대체하지 않는다.

참고: [Supabase DB 함수 권한](https://supabase.com/docs/guides/database/functions), [RLS](https://supabase.com/docs/guides/database/postgres/row-level-security). 함수는 private의 명시적 인증 검사와 빈 search_path, public invoker wrapper, 한정 EXECUTE 권한을 사용한다.
