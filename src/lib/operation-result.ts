export function requireResult<T>(result: { data: T; error: unknown }): T {
  if (result.error) throw result.error;
  return result.data;
}

export function operationError(error: unknown): string {
  const code = error && typeof error === 'object' && 'code' in error ? String(error.code) : '';
  if (code === '42501' || code === 'PGRST301') return '권한 또는 인증 상태를 확인할 수 없습니다. 다시 로그인하거나 담당자에게 문의해 주세요.';
  return '처리 결과를 확인하지 못했습니다. 연결 상태를 확인하고 다시 조회해 주세요.';
}
