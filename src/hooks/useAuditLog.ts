import { useCallback } from 'react';
import { supabase } from '../admin/lib/supabase';
import { useAuth } from '../admin/contexts/AuthContext';

export interface UseAuditLogResult {
  logAction: (action: string, details?: Record<string, unknown>) => Promise<void>;
}

export function useAuditLog(): UseAuditLogResult {
  const { user } = useAuth();

  const logAction = useCallback(
    async (action: string, details?: Record<string, unknown>) => {
      if (!user) {
        console.warn('Cannot log audit action without authenticated user');
        return;
      }

      try {
        const { error } = await supabase.from('security_audit_logs').insert({
          user_id: user.id,
          action,
          details: details || null,
          timestamp: new Date().toISOString(),
        });

        if (error) {
          console.error('Failed to log audit action:', error);
        }
      } catch (err) {
        console.error('Error logging audit action:', err);
      }
    },
    [user]
  );

  return { logAction };
}
