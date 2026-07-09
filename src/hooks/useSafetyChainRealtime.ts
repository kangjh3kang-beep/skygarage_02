import { useEffect, useState, useCallback } from 'react';
import { supabase } from '../lib/supabase';
import type { SafetyChainState } from '../domain';

export function useSafetyChainRealtime(siteId: string | null) {
  const [state, setState] = useState<SafetyChainState | null>(null);
  const [loading, setLoading] = useState(true);

  const fetchState = useCallback(async () => {
    if (!siteId) return;
    const { data } = await supabase
      .from('safety_chain_states')
      .select('*')
      .eq('site_id', siteId)
      .maybeSingle();

    if (data) {
      setState({
        siteId: data.site_id,
        stoActive: data.sto_active,
        safetyRelayEngaged: data.safety_relay_engaged,
        driveEnabled: data.drive_enabled,
        emergencyStopActive: data.emergency_stop_active,
        lastUpdated: data.updated_at,
      });
    }
    setLoading(false);
  }, [siteId]);

  useEffect(() => {
    fetchState();

    if (!siteId) return;

    const channel = supabase
      .channel(`safety-chain-${siteId}`)
      .on(
        'postgres_changes',
        { event: 'UPDATE', schema: 'public', table: 'safety_chain_states', filter: `site_id=eq.${siteId}` },
        (payload) => {
          const d = payload.new;
          setState({
            siteId: d.site_id,
            stoActive: d.sto_active,
            safetyRelayEngaged: d.safety_relay_engaged,
            driveEnabled: d.drive_enabled,
            emergencyStopActive: d.emergency_stop_active,
            lastUpdated: d.updated_at,
          });
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [siteId, fetchState]);

  return { state, loading, refetch: fetchState };
}
