import { useState, useEffect, useCallback } from 'react';
import { supabase } from '../../lib/supabase';
import { useParkingAuth } from '../contexts/ParkingAuthContext';
import type { EvChargingSession } from '../types';

export function useEvCharging() {
  const { household } = useParkingAuth();
  const [sessions, setSessions] = useState<EvChargingSession[]>([]);
  const [loading, setLoading] = useState(true);

  const fetch = useCallback(async () => {
    if (!household) {
      setSessions([]);
      setLoading(false);
      return;
    }
    setLoading(true);
    const { data } = await supabase
      .from('ev_charging_sessions')
      .select('*')
      .eq('household_id', household.id)
      .order('requested_at', { ascending: false });
    setSessions(data ?? []);
    setLoading(false);
  }, [household]);

  useEffect(() => { fetch(); }, [fetch]);

  useEffect(() => {
    if (!household) return;
    const channel = supabase
      .channel('ev_charging_changes')
      .on('postgres_changes', {
        event: '*',
        schema: 'public',
        table: 'ev_charging_sessions',
        filter: `household_id=eq.${household.id}`,
      }, () => { fetch(); })
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, [household, fetch]);

  const requestCharging = async (vehicleId: string, parkingSessionId: string, autoCharge: boolean) => {
    if (!household) return null;
    const { data, error } = await supabase
      .from('ev_charging_sessions')
      .insert({
        vehicle_id: vehicleId,
        parking_session_id: parkingSessionId,
        household_id: household.id,
        auto_charge_enabled: autoCharge,
        status: 'requested',
      })
      .select()
      .maybeSingle();
    if (!error && data) {
      setSessions(prev => [data, ...prev]);
    }
    return { data, error };
  };

  const activeSessions = sessions.filter(s => s.status === 'requested' || s.status === 'charging');
  const completedSessions = sessions.filter(s => s.status === 'completed');

  return { sessions, activeSessions, completedSessions, loading, requestCharging, refetch: fetch };
}
