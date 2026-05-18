import { useState, useEffect, useCallback } from 'react';
import { supabase } from '../../lib/supabase';
import { useParkingAuth } from '../contexts/ParkingAuthContext';
import type { ActiveParking } from '../types';

export function useActiveParking() {
  const { household } = useParkingAuth();
  const [sessions, setSessions] = useState<ActiveParking[]>([]);
  const [loading, setLoading] = useState(true);

  const fetch = useCallback(async () => {
    if (!household) return;
    setLoading(true);
    const { data } = await supabase
      .from('active_parking')
      .select('*')
      .eq('household_id', household.id)
      .is('exit_time', null)
      .order('entry_time', { ascending: false });
    setSessions(data ?? []);
    setLoading(false);
  }, [household]);

  useEffect(() => { fetch(); }, [fetch]);

  useEffect(() => {
    if (!household) return;
    const channel = supabase
      .channel('active_parking_changes')
      .on('postgres_changes', {
        event: '*',
        schema: 'public',
        table: 'active_parking',
        filter: `household_id=eq.${household.id}`,
      }, () => {
        fetch();
      })
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, [household, fetch]);

  const myVehicleSessions = sessions.filter(s => !s.is_visitor);
  const visitorSessions = sessions.filter(s => s.is_visitor);

  return { sessions, myVehicleSessions, visitorSessions, loading, refetch: fetch };
}
