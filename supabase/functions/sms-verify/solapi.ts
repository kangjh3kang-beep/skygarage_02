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

export interface SenderResolution { sender?: string; activeCount: number; error?: string }
/** Resolve only provider-approved senders; never guess when multiple are available. */
export async function resolveSolapiSender(config: SmsConfig, request: typeof fetch = fetch): Promise<SenderResolution> {
  if (!config.apiKey || !config.apiSecret) return { activeCount: 0, error: '문자 서비스 API 키 설정이 필요합니다.' };
  const configured = config.sender.replace(/\D/g, '');
  const salt = Array.from(crypto.getRandomValues(new Uint8Array(16)), b => b.toString(16).padStart(2, '0')).join('');
  try {
    const response = await request('https://api.solapi.com/senderid/v1/numbers/active', {
      headers: { Authorization: await createAuthorization(config, new Date().toISOString(), salt) },
      signal: AbortSignal.timeout(10000),
    });
    const data: unknown = await response.json();
    if (!response.ok) {
      const code = typeof (data as {errorCode?: unknown})?.errorCode === 'string' && /^[A-Za-z0-9_]{1,64}$/.test((data as {errorCode: string}).errorCode)
        ? (data as {errorCode: string}).errorCode : 'ProviderError';
      return { activeCount: 0, error: `SOLAPI 발신번호 조회 실패 (HTTP ${response.status}, ${code}). 관리자에게 문의해주세요.` };
    }
    if (!Array.isArray(data)) return { activeCount: 0, error: 'SOLAPI 발신번호 목록 응답을 확인하지 못했습니다. 관리자에게 문의해주세요.' };
    // Live API also returns string[]; the /active endpoint guarantees these are approved.
    // Retain support for the object[] format described in the SOLAPI reference.
    const active: string[] = [...new Set(data.flatMap(item => {
      if (typeof item === 'string') return [item];
      if (item?.status === 'ACTIVE' && typeof item?.phoneNumber === 'string') return [item.phoneNumber];
      return [];
    }).map(phone => phone.replace(/\D/g, '')).filter(phone => /^\d{8,11}$/.test(phone)))];
    if (/^\d{8,11}$/.test(configured)) {
      return active.includes(configured) ? { sender: configured, activeCount: active.length }
        : { activeCount: active.length, error: '설정된 발신번호가 SOLAPI에서 인증되지 않았습니다. 발신번호 설정을 확인해주세요.' };
    }
    if (active.length === 1) return { sender: active[0], activeCount: 1 };
    return { activeCount: active.length, error: active.length === 0
      ? 'SOLAPI에 등록·인증된 발신번호가 없습니다. 발신번호 인증을 완료해주세요.'
      : '인증된 발신번호가 여러 개입니다. 관리자가 사용할 발신번호를 지정해야 합니다.' };
  } catch { return { activeCount: 0, error: '발신번호 확인에 실패했습니다. 잠시 후 다시 시도해주세요.' }; }
}

/** Never combine a key from one provider variable pair with another pair's secret. */
export function readSmsConfig(read: (name: string) => string | undefined): SmsConfig {
  const value = (name: string) => (read(name) || '').trim();
  const key = value('SOLAPI_API_KEY'), secret = value('SOLAPI_API_SECRET');
  const useSolapi = Boolean(key || secret);
  return {
    apiKey: useSolapi ? key : value('COOLSMS_API_KEY'),
    apiSecret: useSolapi ? secret : value('COOLSMS_API_SECRET'),
    sender: value('SOLAPI_SENDER') || value('COOLSMS_SENDER'),
  };
}
