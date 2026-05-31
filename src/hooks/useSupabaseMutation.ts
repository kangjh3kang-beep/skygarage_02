import { useState, useCallback } from 'react';
import { supabase } from '../lib/supabase';

type MutationType = 'insert' | 'update' | 'delete';

interface MutationOptions {
  table: string;
  type: MutationType;
  onSuccess?: (data: unknown) => void;
  onError?: (error: string) => void;
}

interface MutationResult {
  mutate: (payload: Record<string, unknown>, id?: string) => Promise<boolean>;
  loading: boolean;
  error: string | null;
}

export function useSupabaseMutation(options: MutationOptions): MutationResult {
  const { table, type, onSuccess, onError } = options;
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const mutate = useCallback(async (payload: Record<string, unknown>, id?: string): Promise<boolean> => {
    setLoading(true);
    setError(null);

    let result;

    switch (type) {
      case 'insert':
        result = await supabase.from(table).insert(payload).select();
        break;
      case 'update':
        if (!id) { setError('ID required for update'); setLoading(false); return false; }
        result = await supabase.from(table).update(payload).eq('id', id).select();
        break;
      case 'delete':
        if (!id) { setError('ID required for delete'); setLoading(false); return false; }
        result = await supabase.from(table).delete().eq('id', id);
        break;
    }

    if (result.error) {
      const msg = result.error.message;
      setError(msg);
      onError?.(msg);
      setLoading(false);
      return false;
    }

    onSuccess?.(result.data);
    setLoading(false);
    return true;
  }, [table, type, onSuccess, onError]);

  return { mutate, loading, error };
}
