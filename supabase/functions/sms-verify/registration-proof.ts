import type { SupabaseClient } from "npm:@supabase/supabase-js@2.49.1";

// Phone possession and carrier-backed identity verification are distinct claims.
export type RegistrationProof =
  | { ok: true; method: 'sms_otp'; assurance: 'phone_possession'; phone: string; verifiedAt: string }
  | { ok: false; status: number; error: string; code: string };

// Future provider adapter contract. Implement only after selecting/contracting a provider.
// All arguments/results are SERVER ONLY. The UI receives an opaque attempt ID.
export interface PassIdentityAdapter {
  start(input: { attemptId: string; purpose: 'signup' | 'upgrade'; userId?: string; bindingHash: string }):
    Promise<{ providerTransactionId: string; authorizationUrl: string; expiresAt: string }>;
  verify(input: { attemptId: string; providerTransactionId: string }): Promise<{
    status: 'verified'; provider: string; verifiedAt: string; phone: string;
    verifiedName: string; birthDate: string;
    // Opaque server-owned reference to the private evidence record, never a raw CI/DI.
    evidenceId: string;
  }>;
}

export async function resolveRegistrationProof(client: SupabaseClient, input: {
  method?: unknown; verificationId: string; code: string; phone: string;
}): Promise<RegistrationProof> {
  const method = input.method ?? 'sms_otp';
  // A client cannot enable PASS or claim stronger identity assurance by sending fields.
  // No PASS adapter, public callback or enable-by-env-flag exists in this release.
  if (method === 'pass') return { ok: false, status: 501, error: 'PASS 본인확인은 아직 연결되지 않았습니다. 휴대폰 문자 인증을 이용해주세요.', code: 'identity_provider_not_configured' };
  if (method !== 'sms_otp') return { ok: false, status: 400, error: '지원하지 않는 인증 방식입니다.', code: 'unsupported_verification_method' };
  const { data, error } = await client.rpc('sgp_claim_signup', { p_id: input.verificationId, p_code: input.code, p_phone: input.phone });
  if (error) return { ok: false, status: 503, error: '가입 인증을 확인하지 못했습니다. 잠시 후 다시 시도해주세요.', code: 'verification_unavailable' };
  if (!data?.phone || !data?.verified_at || data.error) return { ok: false, status: 403, error: '문자 인증이 만료되었거나 이미 사용되었습니다. 다시 인증해주세요.', code: 'verification_required' };
  return { ok: true, method: 'sms_otp', assurance: 'phone_possession', phone: data.phone, verifiedAt: data.verified_at };
}
