import { useState, useEffect, useCallback, useRef } from 'react';
import { supabase } from '../lib/supabase';

interface QueryOptions<T> {
  table: string;
  select?: string;
  filters?: Record<string, unknown>;
  order?: { column: string; ascending?: boolean };
  limit?: number;
  enabled?: boolean;
  transform?: (data: unknown[]) => T[];
}

interface QueryResult<T> {
  data: T[];
  loading: boolean;
  error: string | null;
  refetch: () => Promise<void>;
  count: number | null;
}

export function useSupabaseQuery<T = Record<string, unknown>>(options: QueryOptions<T>): QueryResult<T> {
  const { table, select = '*', filters, order, limit, enabled = true, transform } = options;
  const [data, setData] = useState<T[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [count, setCount] = useState<number | null>(null);
  const mountedRef = useRef(true);

  const fetchData = useCallback(async () => {
    if (!enabled) { setLoading(false); return; }
    setLoading(true);
    setError(null);

    let query = supabase.from(table).select(select, { count: 'exact' });

    if (filters) {
      Object.entries(filters).forEach(([key, value]) => {
        if (value === null) {
          query = query.is(key, null);
        } else if (typeof value === 'string' && value.startsWith('neq.')) {
          query = query.neq(key, value.slice(4));
        } else {
          query = query.eq(key, value);
        }
      });
    }

    if (order) {
      query = query.order(order.column, { ascending: order.ascending ?? false });
    }

    if (limit) {
      query = query.limit(limit);
    }

    const { data: result, error: err, count: totalCount } = await query;

    if (!mountedRef.current) return;

    if (err) {
      setError(err.message);
      setLoading(false);
      return;
    }

    const processed = transform ? transform(result || []) : (result as T[]) || [];
    setData(processed);
    setCount(totalCount);
    setLoading(false);
  }, [table, select, JSON.stringify(filters), order?.column, order?.ascending, limit, enabled, transform]);

  useEffect(() => {
    mountedRef.current = true;
    fetchData();
    return () => { mountedRef.current = false; };
  }, [fetchData]);

  return { data, loading, error, refetch: fetchData, count };
}
