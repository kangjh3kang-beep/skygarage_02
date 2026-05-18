import { useState, useEffect, useCallback } from 'react';
import { supabase } from '../../lib/supabase';
import { useParkingAuth } from '../contexts/ParkingAuthContext';
import type { Household, ParkingSpot } from '../types';

export function useHousehold() {
  const { user } = useParkingAuth();
  const [household, setHousehold] = useState<Household | null>(null);
  const [spots, setSpots] = useState<ParkingSpot[]>([]);
  const [loading, setLoading] = useState(true);

  const fetch = useCallback(async () => {
    if (!user) {
      setHousehold(null);
      setSpots([]);
      setLoading(false);
      return;
    }
    setLoading(true);
    const { data: hh } = await supabase
      .from('households')
      .select('*')
      .eq('user_id', user.id)
      .maybeSingle();
    setHousehold(hh);

    if (hh) {
      const { data: sp } = await supabase
        .from('parking_spots')
        .select('*')
        .eq('household_id', hh.id);
      setSpots(sp ?? []);
    }
    setLoading(false);
  }, [user]);

  useEffect(() => { fetch(); }, [fetch]);

  const toggleDirectEntry = async (enabled: boolean) => {
    if (!household) return;
    await supabase
      .from('households')
      .update({ direct_entry_enabled: enabled, updated_at: new Date().toISOString() })
      .eq('id', household.id);
    setHousehold(prev => prev ? { ...prev, direct_entry_enabled: enabled } : null);
  };

  const availableSpots = spots.filter(s => !s.is_occupied && s.household_id === household?.id).length;

  return { household, spots, availableSpots, loading, toggleDirectEntry, refetch: fetch };
}
