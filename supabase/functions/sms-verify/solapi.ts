/** SOLAPI adapter. Credentials remain in Supabase Edge Function secrets. */
export interface SmsConfig { apiKey: string; apiSecret: string; sender: string }
export type SmsResult = { success: true; messageId: string; provider: 'solapi' } | { success: false; error: string; provider: 'solapi' };

export function generateCode(): string {
  const value = new Uint32Array(1);
  do { crypto.getRandomValues(value); } while (value[0] >= 4294000000);
  return String(value[0] % 1000000).padStart(6, '0');
}

export async function createAuthorization(config: SmsConfig, date: string, salt: string): Promise<string> {
  const encoder = new TextEncoder();
  const key = await crypto.subtle.importKey('raw', encoder.encode(config.apiSecret), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']);
  const signature = await crypto.subtle.sign('HMAC', key, encoder.encode(date + salt));
  const hex = Array.from(new Uint8Array(signature), b => b.toString(16).padStart(2, '0')).join('');
  return `HMAC-SHA256 apiKey=${config.apiKey}, date=${date}, salt=${salt}, signature=${hex}`;
}

export async function sendSolapi(config: SmsConfig, phone: string, message: string, request: typeof fetch = fetch): Promise<SmsResult> {
  const fail = (error: string): SmsResult => ({ success: false, error, provider: 'solapi' });
  const sender = config.sender.replace(/\D/g, '');
  if (!config.apiKey || !config.apiSecret || !sender) return fail('문자 발송 설정이 필요합니다. 관리자에게 문의해주세요.');
  if (!/^\d{8,11}$/.test(sender) || !/^010\d{8}$/.test(phone)) return fail('발신번호 또는 휴대전화번호를 확인해주세요.');
  const salt = Array.from(crypto.getRandomValues(new Uint8Array(16)), b => b.toString(16).padStart(2, '0')).join('');
  const date = new Date().toISOString();
  try {
    const response = await request('https://api.solapi.com/messages/v4/send-many/detail', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: await createAuthorization(config, date, salt) },
      body: JSON.stringify({ messages: [{ to: phone, from: sender, text: message, type: 'SMS' }], showMessageList: true, allowDuplicates: false }),
      signal: AbortSignal.timeout(10000),
    });
    const result = await response.json();
    if (!response.ok) {
      // Never expose provider responses, phone numbers, credentials or OTPs to logs or clients.
      if (response.status === 401 || response.status === 403) return fail('문자 서비스 인증 설정을 확인해주세요.');
      if (response.status === 429) return fail('문자 요청이 많습니다. 잠시 후 다시 시도해주세요.');
      return fail('문자 발송 요청에 실패했습니다. 관리자에게 문의해주세요.');
    }
    const count = result?.groupInfo?.count;
    const accepted = result?.messageList?.find((item: { statusCode?: string | number; messageId?: string }) => String(item.statusCode) === '2000' && item.messageId);
    if (count?.registeredSuccess === 1 && count?.registeredFailed === 0 && accepted) {
      return { success: true, messageId: String(accepted.messageId), provider: 'solapi' };
    }
    const failedCode = String(result?.failedMessageList?.[0]?.statusCode || '');
    if (failedCode === '3040') return fail('SOLAPI에 인증된 발신번호가 필요합니다. 관리자에게 문의해주세요.');
    return fail('문자 발송이 접수되지 않았습니다. 발신번호 인증과 잔액을 확인해주세요.');
  } catch {
    // No automatic retry: an interrupted request may already have been accepted and charged.
    return fail('문자 서비스 응답을 확인하지 못했습니다. 문자를 확인한 후 잠시 뒤 다시 시도해주세요.');
  }
}

/** Read-only credential probe. Never returns balance or account details. */
export async function checkSolapiAuthentication(config: SmsConfig, request: typeof fetch = fetch): Promise<boolean> {
  if (!config.apiKey || !config.apiSecret) return false;
  const salt = Array.from(crypto.getRandomValues(new Uint8Array(16)), b => b.toString(16).padStart(2, '0')).join('');
  try {
    const response = await request('https://api.solapi.com/cash/v1/balance', {
      headers: { Authorization: await createAuthorization(config, new Date().toISOString(), salt) },
      signal: AbortSignal.timeout(10000),
    });
    const data = await response.json();
    return response.ok && typeof data?.balance === 'number';
  } catch { return false; }
}
