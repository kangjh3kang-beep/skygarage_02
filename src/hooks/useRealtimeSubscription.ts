import { useEffect, useRef } from 'react';
import { supabase } from '../lib/supabase';
import type { RealtimeChannel } from '@supabase/supabase-js';

type PostgresEvent = 'INSERT' | 'UPDATE' | 'DELETE' | '*';

interface SubscriptionOptions {
  table: string;
  event?: PostgresEvent;
  filter?: string;
  schema?: string;
  enabled?: boolean;
  onInsert?: (payload: Record<string, unknown>) => void;
  onUpdate?: (payload: Record<string, unknown>) => void;
  onDelete?: (payload: Record<string, unknown>) => void;
  onChange?: () => void;
}

export function useRealtimeSubscription(options: SubscriptionOptions) {
  const {
    table,
    event = '*',
    filter,
    schema = 'public',
    enabled = true,
    onInsert,
    onUpdate,
    onDelete,
    onChange,
  } = options;

  const channelRef = useRef<RealtimeChannel | null>(null);

  useEffect(() => {
    if (!enabled) return;

    const channelName = `rt-${table}-${Date.now()}`;
    const channelConfig: Record<string, unknown> = {
      event,
      schema,
      table,
    };
    if (filter) {
      channelConfig.filter = filter;
    }

    const channel = supabase
      .channel(channelName)
      .on(
        'postgres_changes' as never,
        channelConfig as never,
        (payload: { eventType: string; new: Record<string, unknown>; old: Record<string, unknown> }) => {
          if (payload.eventType === 'INSERT' && onInsert) {
            onInsert(payload.new);
          } else if (payload.eventType === 'UPDATE' && onUpdate) {
            onUpdate(payload.new);
          } else if (payload.eventType === 'DELETE' && onDelete) {
            onDelete(payload.old);
          }
          onChange?.();
        }
      )
      .subscribe();

    channelRef.current = channel;

    return () => {
      supabase.removeChannel(channel);
      channelRef.current = null;
    };
  }, [table, event, filter, schema, enabled]);

  return channelRef;
}
