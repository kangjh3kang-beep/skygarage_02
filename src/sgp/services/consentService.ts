import { supabase } from '../../lib/supabase';
import type { ConsentCategory, ConsentRecord } from '../types';

export const CONSENT_DESCRIPTIONS: Record<ConsentCategory, { title: string; description: string; required: boolean }> = {
  location: { title: '위치 정보', description: '주변 주차장 검색 및 길찾기를 위해 위치 정보를 수집합니다.', required: false },
  vehicle_pii: { title: '차량 정보', description: '차량 번호 인식 및 입출차 관리를 위해 차량 정보를 수집합니다.', required: true },
  marketing: { title: '마케팅', description: '이벤트 및 혜택 정보를 수신합니다.', required: false },
  third_party: { title: '제3자 제공', description: '제휴 주차장 예약 시 해당 업체에 정보를 제공합니다.', required: false },
  analytics: { title: '서비스 분석', description: '서비스 개선을 위한 이용 패턴을 분석합니다.', required: false },
};

export async function getConsents(userId: string): Promise<ConsentRecord[]> {
  const { data } = await supabase
    .from('sgp_consents')
    .select('*')
    .eq('user_id', userId);

  return (data ?? []).map(c => ({
    id: c.id,
    userId: c.user_id,
    category: c.category as ConsentCategory,
    granted: c.granted,
    grantedAt: c.granted_at,
    revokedAt: c.revoked_at,
    version: c.version,
  }));
}

export async function grantConsent(
  userId: string,
  category: ConsentCategory,
  version: string = '1.0'
): Promise<boolean> {
  const { error } = await supabase
    .from('sgp_consents')
    .upsert({
      user_id: userId,
      category,
      granted: true,
      granted_at: new Date().toISOString(),
      revoked_at: null,
      version,
    }, { onConflict: 'user_id,category' });

  if (!error) {
    await supabase.from('domain_events').insert({
      site_id: 'PLATFORM',
      envelope: 'AuditEvent',
      subtype: 'policy',
      action: 'ConsentGranted',
      payload: { userId, category, version },
      idempotency_key: `consent-grant-${userId}-${category}-${Date.now()}`,
      created_at: new Date().toISOString(),
    });
  }
  return !error;
}

export async function revokeConsent(userId: string, category: ConsentCategory): Promise<boolean> {
  const { error } = await supabase
    .from('sgp_consents')
    .update({ granted: false, revoked_at: new Date().toISOString() })
    .eq('user_id', userId)
    .eq('category', category);

  if (!error) {
    await supabase.from('domain_events').insert({
      site_id: 'PLATFORM',
      envelope: 'AuditEvent',
      subtype: 'policy',
      action: 'ConsentRevoked',
      payload: { userId, category },
      idempotency_key: `consent-revoke-${userId}-${category}-${Date.now()}`,
      created_at: new Date().toISOString(),
    });
  }
  return !error;
}

export function isConsentGranted(consents: ConsentRecord[], category: ConsentCategory): boolean {
  const record = consents.find(c => c.category === category);
  return record?.granted ?? false;
}
