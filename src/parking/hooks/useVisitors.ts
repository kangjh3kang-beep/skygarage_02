import { useState, useEffect, useCallback } from 'react';
import { supabase } from '../../lib/supabase';
import { useParkingAuth } from '../contexts/ParkingAuthContext';
import type { VisitorRegistration } from '../types';

export function useVisitors() {
  const { user, household } = useParkingAuth();
  const [visitors, setVisitors] = useState<VisitorRegistration[]>([]);
  const [loading, setLoading] = useState(true);

  const fetch = useCallback(async () => {
    if (!user) {
      setVisitors([]);
      setLoading(false);
      return;
    }
    setLoading(true);
    const { data } = await supabase
      .from('visitor_registrations')
      .select('*')
      .eq('registered_by', user.id)
      .order('created_at', { ascending: false });
    setVisitors(data ?? []);
    setLoading(false);
  }, [user]);

  useEffect(() => { fetch(); }, [fetch]);

  const registerVisitor = async (reg: Partial<VisitorRegistration>) => {
    if (!user || !household) return null;
    const { data, error } = await supabase
      .from('visitor_registrations')
      .insert({
        ...reg,
        registered_by: user.id,
        household_id: household.id,
      })
      .select()
      .maybeSingle();
    if (!error && data) {
      setVisitors(prev => [data, ...prev]);
    }
    return { data, error };
  };

  const updateVisitor = async (id: string, updates: Partial<VisitorRegistration>) => {
    const { error } = await supabase
      .from('visitor_registrations')
      .update({ ...updates, updated_at: new Date().toISOString() })
      .eq('id', id);
    if (!error) {
      setVisitors(prev => prev.map(v => v.id === id ? { ...v, ...updates } : v));
    }
    return { error };
  };

  const cancelVisitor = async (id: string) => {
    return updateVisitor(id, { status: 'cancelled' });
  };

  const activeVisitors = visitors.filter(v => v.status === 'active' || v.status === 'pending');

  return { visitors, activeVisitors, loading, registerVisitor, updateVisitor, cancelVisitor, refetch: fetch };
}
