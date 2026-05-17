import { useCallback } from 'react';
import { supabase } from '../lib/supabase';

export function useAuditLog() {
  const logAction = useCallback(
    async (action: string, table_name: string, record_id?: string, details?: Record<string, unknown>) => {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session?.user) return;
      await supabase.from('security_audit_logs').insert({
        user_id: session.user.id,
        action,
        table_name,
        record_id: record_id || null,
        details: details || {},
      });
    },
    []
  );

  return { logAction };
}
