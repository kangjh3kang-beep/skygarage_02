export type LiveAuthReport = {
  schema_version: 1; id: string; release_sha: string; status: 'running' | 'passed' | 'failed' | 'expired';
  site_a: string; site_b: string; scope_a: string; scope_b: string;
  checks: { id: string; passed: boolean }[]; error_code: string | null; test_accounts: number;
  database_cleanup: boolean; auth_cleanup: boolean; created_at: string; finished_at: string | null;
  environment: 'staging'; kind: 'live_auth_automated'; acceptance_granted: false; human_reviewed: false; hardware_verified: false;
};
const uuid = (v: unknown) => typeof v === 'string' && /^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/.test(v);
export function parseLiveAuthReport(value: unknown): LiveAuthReport | null {
  if (value === null) return null;
  if (!value || typeof value !== 'object') throw new Error('invalid_live_auth_report');
  const v = value as LiveAuthReport;
  if (v.schema_version !== 1 || !uuid(v.id) || !uuid(v.site_a) || !uuid(v.site_b) || !uuid(v.scope_a) || !uuid(v.scope_b) || !/^[a-f0-9]{40}$/.test(v.release_sha) ||
    !['running', 'passed', 'failed', 'expired'].includes(v.status) || v.environment !== 'staging' || v.kind !== 'live_auth_automated' || v.acceptance_granted !== false || v.human_reviewed !== false || v.hardware_verified !== false ||
    !Array.isArray(v.checks) || v.checks.length > 60 || v.checks.some(c => !c || !/^[a-z0-9_]{2,80}$/.test(c.id) || typeof c.passed !== 'boolean') || new Set(v.checks.map(c => c.id)).size !== v.checks.length ||
    !Number.isInteger(v.test_accounts) || v.test_accounts < 0 || v.test_accounts > 3 || typeof v.database_cleanup !== 'boolean' || typeof v.auth_cleanup !== 'boolean' || !Number.isFinite(Date.parse(v.created_at)) ||
    !(v.finished_at === null || Number.isFinite(Date.parse(v.finished_at))) || !(v.error_code === null || ['execution_failed', 'assertion_failed', 'auth_cleanup_failed', 'execution_expired'].includes(v.error_code)) ||
    (v.status === 'passed' && (v.error_code !== null || !v.database_cleanup || !v.auth_cleanup || v.test_accounts !== 3 || v.checks.length < 15 || v.checks.some(c => !c.passed) || !v.finished_at))) throw new Error('invalid_live_auth_report');
  return v;
}
const labels: Record<string, string> = {
  distinct_auth_identities: '세 계정의 인증 정보 분리', writer_directory_is_scoped: '담당자에게 배정 현장만 표시', cross_tenant_scope_denied: '다른 조직의 현장 접근 거부',
  member_site_rls: '일반회원 현장 조회 범위', unverified_member_request_denied: '문자인증 미완료 회원의 요청 등록 거부', member_cannot_read_operator_role: '일반회원에게 다른 운영자의 권한 정보 숨김',
  evidence_retry_is_idempotent: '증거 재시도의 중복 방지', self_review_rejected_with_review_permission: '검수 권한이 있어도 자기 승인 거부', different_account_review_persisted: '다른 계정의 검수 기록',
  expired_submission_rejected: '만료 증거 등록 거부', expired_review_rejected: '등록 후 만료된 증거의 승인 거부', failure_creates_defect: '실패 증거의 결함 생성', failed_evidence_cannot_be_approved: '실패 증거 승인 거부',
  failure_retest_review_close: '실패 → 수정 → 재시험 → 별도 계정 검수 → 종료', test_does_not_grant_acceptance: '시험 결과로 현장 인수율이 올라가지 않음', missing_acceptance_blocks_site_promotion: '미인수 현장의 단계 승격 거부',
  logout_and_real_relogin: '로그아웃 후 실제 재로그인', relogin_needs_mfa_again: '재로그인 시 2단계 인증 요구', relogin_existing_factor_verifies: '기존 인증 수단으로 재인증',
  revocation_denies_existing_session_read: '권한 회수 후 기존 세션의 조회 거부', revocation_denies_existing_session_write: '권한 회수 후 기존 세션의 쓰기 거부', revocation_removes_site_from_directory: '회수된 현장을 목록에서 제거',
};
export function liveAuthCheckLabel(id: string): string {
  if (labels[id]) return labels[id];
  const match = /^(writer|reviewer|member)_(real_password_login|aal1_denied|wrong_totp_rejected|real_totp_aal2)$/.exec(id);
  if (!match) return '시험 실행 중 오류 · 결과 확인 필요';
  return `${{ writer: '담당자', reviewer: '검수자', member: '일반회원' }[match[1]]} · ${{ real_password_login: '실제 비밀번호 로그인', aal1_denied: '추가 인증 전 관리 API 거부', wrong_totp_rejected: '잘못된 인증번호 거부', real_totp_aal2: '실제 TOTP 인증과 AAL2 확인' }[match[2]]}`;
}
