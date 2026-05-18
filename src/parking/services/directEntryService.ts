import { supabase } from '../../lib/supabase';
import type { DirectEntryDecision, Household, ParkingSpot } from '../types';

export async function evaluateDirectEntry(
  householdId: string,
  _visitorPlate: string
): Promise<DirectEntryDecision> {
  const { data: household } = await supabase
    .from('households')
    .select('*')
    .eq('id', householdId)
    .maybeSingle();

  if (!household) {
    return {
      allowed: false,
      reason: '세대 정보를 찾을 수 없습니다.',
      entry_type: 'general',
      available_spots: 0,
    };
  }

  const hh = household as Household;

  if (!hh.is_sky_garage_unit) {
    return {
      allowed: false,
      reason: '일반 세대입니다. 방문 주차장으로 안내됩니다.',
      entry_type: 'general',
      available_spots: 0,
    };
  }

  if (!hh.direct_entry_enabled) {
    return {
      allowed: false,
      reason: '세대직입이 비활성화되어 있습니다. 자율주차 전용면으로 발렛 처리됩니다.',
      entry_type: 'valet',
      available_spots: 0,
    };
  }

  const { data: spots } = await supabase
    .from('parking_spots')
    .select('*')
    .eq('household_id', householdId)
    .eq('is_occupied', false);

  const availableSpots = (spots as ParkingSpot[] | null)?.length ?? 0;

  if (availableSpots === 0) {
    return {
      allowed: false,
      reason: '잔여 주차면이 없습니다. 자율주차 전용면으로 발렛 처리됩니다.',
      entry_type: 'valet',
      available_spots: 0,
    };
  }

  return {
    allowed: true,
    reason: `세대직입 승인. 잔여 주차면 ${availableSpots}면.`,
    entry_type: 'direct_entry',
    available_spots: availableSpots,
  };
}

export async function processVisitorEntry(
  householdId: string,
  visitorRegistrationId: string,
  plate: string,
  decision: DirectEntryDecision
) {
  const { data: session } = await supabase
    .from('active_parking')
    .insert({
      vehicle_plate: plate,
      household_id: householdId,
      visitor_registration_id: visitorRegistrationId,
      is_visitor: true,
      entry_method: decision.entry_type,
      status: decision.entry_type === 'direct_entry' ? 'in_transit' : 'parked',
    })
    .select()
    .maybeSingle();

  if (session && decision.entry_type !== 'general') {
    const { data: atr } = await supabase
      .from('atr_units')
      .select('*')
      .eq('status', 'idle')
      .limit(1)
      .maybeSingle();

    if (atr) {
      await supabase.from('atr_units').update({ status: 'assigned' }).eq('id', atr.id);
      await supabase.from('atr_dispatch_log').insert({
        atr_unit_id: atr.id,
        parking_session_id: session.id,
        dispatch_type: decision.entry_type === 'direct_entry' ? 'direct_entry' : 'valet_to_spot',
        origin_spot: '대기면',
        destination_spot: decision.entry_type === 'direct_entry' ? '세대 지정면' : '자율주차 전용면',
        status: 'dispatched',
      });
    }
  }

  await supabase
    .from('visitor_registrations')
    .update({ status: 'active', entry_type: decision.entry_type })
    .eq('id', visitorRegistrationId);

  return session;
}
