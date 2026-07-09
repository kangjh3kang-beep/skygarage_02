import { supabase } from '../../lib/supabase';
import type { RealtimeEvent, QueuedRequest } from '../types';

type EventHandler = (event: RealtimeEvent) => void;

let channel: ReturnType<typeof supabase.channel> | null = null;
let lastSeq = 0;
const handlers = new Map<string, Set<EventHandler>>();
const offlineQueue: QueuedRequest[] = [];
let isOnline = navigator.onLine;

window.addEventListener('online', () => {
  isOnline = true;
  flushQueue();
});
window.addEventListener('offline', () => { isOnline = false; });

function flushQueue() {
  while (offlineQueue.length > 0) {
    const req = offlineQueue[0];
    if (new Date(req.expiresAt) < new Date()) {
      offlineQueue.shift();
      continue;
    }
    supabase.functions.invoke('sgp-queue', { body: req.body }).then(({ error }) => {
      if (!error) offlineQueue.shift();
    });
    break;
  }
}

export function subscribe(table: string, handler: EventHandler) {
  if (!handlers.has(table)) handlers.set(table, new Set());
  handlers.get(table)!.add(handler);

  if (!channel) {
    channel = supabase.channel('sgp-realtime')
      .on('postgres_changes', { event: '*', schema: 'public', table: '*' }, (payload) => {
        const event: RealtimeEvent = {
          eventId: crypto.randomUUID(),
          seq: ++lastSeq,
          envelope: payload.eventType,
          payload: payload.new as Record<string, unknown>,
          timestamp: new Date().toISOString(),
        };
        const tableHandlers = handlers.get(payload.table);
        if (tableHandlers) tableHandlers.forEach(h => h(event));
      })
      .subscribe();
  }

  return () => {
    const set = handlers.get(table);
    if (set) {
      set.delete(handler);
      if (set.size === 0) handlers.delete(table);
    }
    if (handlers.size === 0 && channel) {
      supabase.removeChannel(channel);
      channel = null;
    }
  };
}

export function enqueue(body: Record<string, unknown>, ttlMinutes = 30): string {
  const id = crypto.randomUUID();
  const request: QueuedRequest = {
    id,
    idempotencyKey: id,
    body,
    expiresAt: new Date(Date.now() + ttlMinutes * 60000).toISOString(),
    status: 'pending',
  };

  if (isOnline) {
    supabase.functions.invoke('sgp-queue', { body }).catch(() => {
      offlineQueue.push(request);
    });
  } else {
    offlineQueue.push(request);
  }
  return id;
}

export function getQueueLength(): number {
  return offlineQueue.length;
}

export function getLastSeq(): number {
  return lastSeq;
}
