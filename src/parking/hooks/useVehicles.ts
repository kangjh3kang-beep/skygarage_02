import { useState, useEffect, useCallback } from 'react';
import { supabase } from '../../lib/supabase';
import { useParkingAuth } from '../contexts/ParkingAuthContext';
import type { UserVehicle } from '../types';

export function useVehicles() {
  const { user, household } = useParkingAuth();
  const [vehicles, setVehicles] = useState<UserVehicle[]>([]);
  const [loading, setLoading] = useState(true);

  const fetch = useCallback(async () => {
    if (!user) return;
    setLoading(true);
    const { data } = await supabase
      .from('user_vehicles')
      .select('*')
      .eq('user_id', user.id)
      .order('is_primary', { ascending: false });
    setVehicles(data ?? []);
    setLoading(false);
  }, [user]);

  useEffect(() => { fetch(); }, [fetch]);

  const addVehicle = async (vehicle: Partial<UserVehicle>) => {
    if (!user || !household) return null;
    const { data, error } = await supabase
      .from('user_vehicles')
      .insert({
        ...vehicle,
        user_id: user.id,
        household_id: household.id,
      })
      .select()
      .maybeSingle();
    if (!error && data) {
      setVehicles(prev => [...prev, data]);
    }
    return { data, error };
  };

  const updateVehicle = async (id: string, updates: Partial<UserVehicle>) => {
    const { error } = await supabase
      .from('user_vehicles')
      .update({ ...updates, updated_at: new Date().toISOString() })
      .eq('id', id);
    if (!error) {
      setVehicles(prev => prev.map(v => v.id === id ? { ...v, ...updates } : v));
    }
    return { error };
  };

  const deleteVehicle = async (id: string) => {
    const { error } = await supabase
      .from('user_vehicles')
      .delete()
      .eq('id', id);
    if (!error) {
      setVehicles(prev => prev.filter(v => v.id !== id));
    }
    return { error };
  };

  return { vehicles, loading, addVehicle, updateVehicle, deleteVehicle, refetch: fetch };
}
