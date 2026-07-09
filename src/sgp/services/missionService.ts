import { supabase } from '../../lib/supabase';
import type { Mission, MissionType, UserMissionStatus } from '../types';
import { generateIdempotencyKey, enqueueOfflineRequest, getConnectionState } from './realtimeSdk';

const MISSION_TTL_MINUTES = 10;

export async function requestMission(
  userId: string,
  siteId: string,
  placeId: string,
  vehicleId: string,
  type: MissionType
): Promise<{ success: boolean; mission?: Mission; error?: string; queued?: boolean }> {
  const idempotencyKey = generateIdempotencyKey(`mission-${type}`);
  const requestedAt = new Date().toISOString();
  const expiresAt = new Date(Date.now() + MISSION_TTL_MINUTES * 60 * 1000).toISOString();

  const body = { userId, siteId, placeId, vehicleId, type, idempotencyKey, requestedAt };

  if (getConnectionState() === 'disconnected') {
    enqueueOfflineRequest({
      idempotencyKey,
      requestedAt,
      expiresAt,
      endpoint: '/missions',
      method: 'POST',
      body,
    });
    return {
      success: true,
      queued: true,
      mission: {
        id: idempotencyKey,
        userId, siteId, placeId, vehicleId, type,
        status: 'REQUESTED',
        requestedAt,
        idempotencyKey,
      },
    };
  }

  const { data, error } = await supabase
    .from('domain_events')
    .insert({
      site_id: siteId,
      envelope: 'MissionEvent',
      subtype: 'lifecycle',
      action: 'MissionRequested',
      payload: body,
      idempotency_key: idempotencyKey,
      created_at: requestedAt,
    })
    .select()
    .single();

  if (error) return { success: false, error: error.message };

  return {
    success: true,
    mission: {
      id: data.id,
      userId, siteId, placeId, vehicleId, type,
      status: 'REQUESTED',
      requestedAt,
      idempotencyKey,
    },
  };
}

export async function cancelMission(
  missionId: string,
  userId: string
): Promise<{ success: boolean; error?: string }> {
  const { data: mission } = await supabase
    .from('domain_events')
    .select('payload')
    .eq('id', missionId)
    .maybeSingle();

  if (!mission) return { success: false, error: '미션을 찾을 수 없습니다.' };

  const payload = mission.payload as Record<string, unknown>;
  const status = (payload.status as UserMissionStatus) ?? 'REQUESTED';
  const cancelableStatuses: UserMissionStatus[] = ['REQUESTED', 'QUEUED'];

  if (!cancelableStatuses.includes(status)) {
    return { success: false, error: '이송이 시작된 미션은 취소할 수 없습니다.' };
  }

  await supabase.from('domain_events').insert({
    site_id: payload.siteId as string,
    envelope: 'MissionEvent',
    subtype: 'lifecycle',
    action: 'MissionCancelled',
    payload: { missionId, userId, cancelledAt: new Date().toISOString() },
    idempotency_key: `cancel-${missionId}-${Date.now()}`,
    created_at: new Date().toISOString(),
  });

  return { success: true };
}

export async function getMissions(userId: string, limit = 20): Promise<Mission[]> {
  const { data } = await supabase
    .from('domain_events')
    .select('*')
    .eq('envelope', 'MissionEvent')
    .eq('subtype', 'lifecycle')
    .eq('action', 'MissionRequested')
    .order('created_at', { ascending: false })
    .limit(limit);

  return (data ?? [])
    .filter(d => (d.payload as Record<string, unknown>)?.userId === userId)
    .map(d => {
      const p = d.payload as Record<string, unknown>;
      return {
        id: d.id,
        userId: p.userId as string,
        siteId: p.siteId as string,
        placeId: p.placeId as string,
        vehicleId: p.vehicleId as string,
        type: p.type as MissionType,
        status: (p.status as UserMissionStatus) ?? 'REQUESTED',
        requestedAt: p.requestedAt as string,
        idempotencyKey: p.idempotencyKey as string,
      };
    });
}

export async function scheduleMission(
  userId: string,
  siteId: string,
  placeId: string,
  vehicleId: string,
  scheduledAt: string
): Promise<{ success: boolean; error?: string }> {
  const idempotencyKey = generateIdempotencyKey('schedule');

  const { error } = await supabase.from('domain_events').insert({
    site_id: siteId,
    envelope: 'MissionEvent',
    subtype: 'lifecycle',
    action: 'MissionScheduled',
    payload: { userId, siteId, placeId, vehicleId, scheduledAt, idempotencyKey },
    idempotency_key: idempotencyKey,
    created_at: new Date().toISOString(),
  });

  if (error) return { success: false, error: error.message };
  return { success: true };
}

export const MISSION_STATUS_LABELS: Record<UserMissionStatus, string> = {
  REQUESTED: '요청됨',
  QUEUED: '대기 중',
  ALLOCATING: '배차 중',
  IN_TRANSIT: '이송 중',
  ALIGNING: '정렬 중',
  DOCKING: '도킹 중',
  AT_PICKUP: '픽업 대기',
  COMPLETED: '완료',
  CANCELLED: '취소됨',
  FAILED: '실패',
  SAFETY_REJECTED: '안전 거절',
  ROLLED_BACK: '롤백',
};

export const TERMINAL_STATUSES: UserMissionStatus[] = [
  'COMPLETED', 'CANCELLED', 'FAILED', 'SAFETY_REJECTED', 'ROLLED_BACK',
];
