import { useState, useEffect, useCallback } from 'react';
import { supabase } from '../../lib/supabase';
import type { TrackingNotification } from '../types';
import { notificationService } from '../services/trackingService';

export function useNotifications() {
  const [notifications, setNotifications] = useState<TrackingNotification[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [loading, setLoading] = useState(true);

  const loadNotifications = useCallback(async () => {
    try {
      const data = await notificationService.getAll();
      setNotifications(data);
      setUnreadCount(data.filter(n => !n.read).length);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { loadNotifications(); }, [loadNotifications]);

  useEffect(() => {
    const channel = supabase
      .channel('notifications-rt')
      .on('postgres_changes', {
        event: 'INSERT',
        schema: 'public',
        table: 'tracking_notifications',
      }, () => { loadNotifications(); })
      .on('postgres_changes', {
        event: 'INSERT',
        schema: 'public',
        table: 'system_alerts',
        filter: 'type=eq.priority_dispatch_sla',
      }, (payload) => {
        const alert = payload.new as { title: string; message: string };
        notificationService.create({
          type: 'delay',
          title: alert.title,
          message: alert.message,
        });
      })
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, [loadNotifications]);

  const markAsRead = useCallback(async (id: string) => {
    await notificationService.markAsRead(id);
    setNotifications(prev => prev.map(n => n.id === id ? { ...n, read: true } : n));
    setUnreadCount(prev => Math.max(0, prev - 1));
  }, []);

  const markAllAsRead = useCallback(async () => {
    await notificationService.markAllAsRead();
    setNotifications(prev => prev.map(n => ({ ...n, read: true })));
    setUnreadCount(0);
  }, []);

  return { notifications, unreadCount, loading, markAsRead, markAllAsRead, refresh: loadNotifications };
}
