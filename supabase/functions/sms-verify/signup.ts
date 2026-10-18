import type { SupabaseClient } from "npm:@supabase/supabase-js@2.49.1";

export type SignupResult = { status: number; body: { error?: string; code?: string; registered?: boolean } };
const failure = (status: number, error: string, code?: string): SignupResult => ({ status, body: { error, ...(code ? { code } : {}) } });

export async function registerResident(client: SupabaseClient, raw: unknown): Promise<SignupResult> {
  if (!raw || typeof raw !== 'object') return failure(400, '가입 정보를 확인해주세요.');
  const b = raw as Record<string, unknown>;
  const phone = typeof b.phone === 'string' ? b.phone.replace(/\D/g, '') : '';
  const password = typeof b.password === 'string' ? b.password : '';
  const name = typeof b.display_name === 'string' ? b.display_name.trim() : '';
  const address = typeof b.address === 'string' ? b.address.trim() : '';
  const detail = typeof b.address_detail === 'string' ? b.address_detail.trim() : '';
  if (!/^010\d{8}$/.test(phone) || password.length < 6 || password.length > 128 || !name || name.length > 80 || !address || address.length > 300 || detail.length > 300 ||
      typeof b.verification_id !== 'string' || !/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(b.verification_id) ||
      typeof b.code !== 'string' || !/^\d{6}$/.test(b.code) || typeof b.birth_date !== 'string' || !/^\d{6}$/.test(b.birth_date) ||
      typeof b.gender_code !== 'string' || !/^[1-8]$/.test(b.gender_code)) {
    return failure(400, '전화번호, 이름, 생년월일, 성별, 비밀번호와 주소를 확인해주세요.');
  }
  // Atomic claim prevents parallel/replayed requests from reusing one SMS proof.
  const { data: proof, error: proofError } = await client.rpc('sgp_claim_signup', { p_id: b.verification_id, p_code: b.code, p_phone: phone });
  if (proofError) return failure(503, '가입 인증을 확인하지 못했습니다. 잠시 후 다시 시도해주세요.');
  if (!proof?.phone || proof.error) return failure(403, '문자 인증이 만료되었거나 이미 사용되었습니다. 다시 인증해주세요.', 'verification_required');

  const { data, error } = await client.auth.admin.createUser({
    email: `${phone}@sgp.skygarage.app`, password, email_confirm: true,
    user_metadata: { display_name: name },
  });
  if (error || !data.user) {
    if (error?.code === 'email_exists' || error?.code === 'user_already_exists') return failure(409, '이미 가입된 전화번호입니다. 로그인해주세요.', 'already_registered');
    return failure(400, '계정을 만들지 못했습니다. 비밀번호 조건을 확인하고 문자 인증부터 다시 진행해주세요.', 'verification_required');
  }
  // Profile and zero-balance wallet commit together in a single DB transaction.
  const { error: profileError } = await client.rpc('sgp_finish_signup', {
    p_user_id: data.user.id, p_verification_id: b.verification_id, p_name: name,
    p_birth: b.birth_date, p_gender: b.gender_code, p_address: address, p_detail: detail,
  });
  if (profileError) {
    // Only the account created by this request is eligible for compensation.
    const { error: cleanupError } = await client.auth.admin.deleteUser(data.user.id);
    return cleanupError
      ? failure(503, '계정 등록을 완료하지 못했습니다. 관리자에게 문의해주세요.', 'registration_incomplete')
      : failure(503, '가입 정보를 저장하지 못했습니다. 문자 인증부터 다시 진행해주세요.', 'verification_required');
  }
  return { status: 201, body: { registered: true } };
}
