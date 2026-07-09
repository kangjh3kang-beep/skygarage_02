import { supabase } from '../../lib/supabase';
import type { RealtimeEvent, QueuedRequest } from '../types';

const OFFLINE_QUEUE_KEY = 'sgp_offline_queue';
const PROCESSED_EVENTS_KEY = 'sgp_processed_events';
const MAX_DEDUP_CACHE = 500;

// ─── Sequence & Dedup (§6.1) ───
const seqWatermarks = new Map<string, number>();
const processedEventIds = new Set<string>(loadProcessedEvents());

function loadProcessedEvents(): string[] {
  try {
    const stored = localStorage.getItem(PROCESSED_EVENTS_KEY);
    return stored ? JSON.parse(stored) : [];
  } catch { return []; }
}

function persistProcessedEvents() {
  const arr = Array.from(processedEventIds).slice(-MAX_DEDUP_CACHE);
  localStorage.setItem(PROCESSED_EVENTS_KEY, JSON.stringify(arr));
}

export function shouldProcessEvent(topic: string, event: RealtimeEvent): boolean {
  if (processedEventIds.has(event.eventId)) return false;

  const currentSeq = seqWatermarks.get(topic) ?? 0;
  if (event.seq <= currentSeq) return false;

  seqWatermarks.set(topic, event.seq);
  processedEventIds.add(event.eventId);
  if (processedEventIds.size > MAX_DEDUP_CACHE) {
    const first = processedEventIds.values().next().value;
    if (first) processedEventIds.delete(first);
  }
  persistProcessedEvents();
  return true;
}

// ─── Offline Queue (§1.2-5) ───
export function getOfflineQueue(): QueuedRequest[] {
  try {
    const stored = localStorage.getItem(OFFLINE_QUEUE_KEY);
    return stored ? JSON.parse(stored) : [];
  } catch { return []; }
}

export function enqueueOfflineRequest(request: Omit<QueuedRequest, 'id' | 'status'>): QueuedRequest {
  const item: QueuedRequest = {
    ...request,
    id: crypto.randomUUID(),
    status: 'pending',
  };
  const queue = getOfflineQueue();
  queue.push(item);
  localStorage.setItem(OFFLINE_QUEUE_KEY, JSON.stringify(queue));
  return item;
}

export function removeFromQueue(id: string) {
  const queue = getOfflineQueue().filter(q => q.id !== id);
  localStorage.setItem(OFFLINE_QUEUE_KEY, JSON.stringify(queue));
}

export function clearExpiredFromQueue(): QueuedRequest[] {
  const now = new Date().toISOString();
  const queue = getOfflineQueue();
  const expired = queue.filter(q => q.expiresAt < now);
  const valid = queue.filter(q => q.expiresAt >= now);
  localStorage.setItem(OFFLINE_QUEUE_KEY, JSON.stringify(valid));
  return expired;
}

// ─── Flush Queue on Reconnect (§SB-8) ───
export async function flushOfflineQueue(
  onConfirmNeeded: (items: QueuedRequest[]) => Promise<QueuedRequest[]>
): Promise<{ sent: number; expired: number }> {
  const expired = clearExpiredFromQueue();
  const pending = getOfflineQueue().filter(q => q.status === 'pending');

  if (pending.length === 0) return { sent: 0, expired: expired.length };

  const confirmed = await onConfirmNeeded(pending);
  let sent = 0;

  for (const item of confirmed) {
    try {
      const { error } = await supabase.functions.invoke('mission-request', {
        body: { ...item.body, idempotencyKey: item.idempotencyKey },
      });
      if (!error) {
        removeFromQueue(item.id);
        sent++;
      }
    } catch {
      // Keep in queue for next attempt
    }
  }

  return { sent, expired: expired.length };
}

// ─── Connection State ───
export type ConnectionState = 'connected' | 'disconnected' | 'reconnecting';

let connectionState: ConnectionState = 'connected';
const connectionListeners = new Set<(state: ConnectionState) => void>();

export function getConnectionState(): ConnectionState {
  return connectionState;
}

export function onConnectionChange(listener: (state: ConnectionState) => void) {
  connectionListeners.add(listener);
  return () => { connectionListeners.delete(listener); };
}

function setConnectionState(state: ConnectionState) {
  connectionState = state;
  connectionListeners.forEach(fn => fn(state));
}

// ─── Online/Offline Detection ───
if (typeof window !== 'undefined') {
  window.addEventListener('online', () => setConnectionState('connected'));
  window.addEventListener('offline', () => setConnectionState('disconnected'));
}

// ─── Realtime Subscription Manager (§4.4 Single WS Multiplex) ───
type EventHandler = (event: RealtimeEvent) => void;
const topicHandlers = new Map<string, Set<EventHandler>>();
let realtimeChannel: ReturnType<typeof supabase.channel> | null = null;

export function subscribeToTopic(topic: string, handler: EventHandler): () => void {
  if (!topicHandlers.has(topic)) {
    topicHandlers.set(topic, new Set());
  }
  topicHandlers.get(topic)!.add(handler);

  ensureChannelConnected();

  return () => {
    const handlers = topicHandlers.get(topic);
    if (handlers) {
      handlers.delete(handler);
      if (handlers.size === 0) {
        topicHandlers.delete(topic);
      }
    }
  };
}

function ensureChannelConnected() {
  if (realtimeChannel) return;

  realtimeChannel = supabase
    .channel('sgp-realtime')
    .on('broadcast', { event: 'domain_event' }, (payload) => {
      const event = payload.payload as RealtimeEvent;
      const topic = (event.payload?.topic as string) ?? event.envelope;

      if (!shouldProcessEvent(topic, event)) return;

      const handlers = topicHandlers.get(topic);
      handlers?.forEach(fn => fn(event));

      const allHandlers = topicHandlers.get('*');
      allHandlers?.forEach(fn => fn(event));
    })
    .subscribe((status) => {
      if (status === 'SUBSCRIBED') {
        setConnectionState('connected');
      } else if (status === 'CLOSED' || status === 'CHANNEL_ERROR') {
        setConnectionState('disconnected');
      }
    });
}

export function disconnectRealtime() {
  if (realtimeChannel) {
    supabase.removeChannel(realtimeChannel);
    realtimeChannel = null;
  }
}

// ─── Idempotency Key Generator ───
export function generateIdempotencyKey(prefix: string): string {
  return `${prefix}-${crypto.randomUUID()}`;
}
