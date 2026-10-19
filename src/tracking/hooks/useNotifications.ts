import { useState, useEffect, useCallback, useRef } from 'react';
import type { TrackingNotification } from '../types';
import { notificationService } from '../services/trackingService';

export function useNotifications() {
  const [notifications, setNotifications] = useState<TrackingNotification[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const loadNotifications = useCallback(async () => {
    try {
      setError(null);
      const data = await notificationService.getAll();
      setNotifications(data);
      setUnreadCount(data.filter(n => !n.read).length);
    } catch { setError('알림 정보를 조회하지 못했습니다. 연결과 권한을 확인해 주세요.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadNotifications();
    intervalRef.current = setInterval(loadNotifications, 10000);
    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
    };
  }, [loadNotifications]);

  const markAsRead = useCallback(async (id: string) => {
    try {
    await notificationService.markAsRead(id);
    setNotifications(prev => prev.map(n => n.id === id ? { ...n, read: true } : n));
    setUnreadCount(prev => Math.max(0, prev - 1));
    return true;
    } catch { setError('알림 처리에 실패했습니다. 다시 조회해 주세요.'); return false; }
  }, []);

  const markAllAsRead = useCallback(async () => {
    try {
    await notificationService.markAllAsRead();
    setNotifications(prev => prev.map(n => ({ ...n, read: true })));
    setUnreadCount(0);
    return true;
    } catch { setError('알림 처리에 실패했습니다. 다시 조회해 주세요.'); return false; }
  }, []);

  return { notifications, unreadCount, loading, error, markAsRead, markAllAsRead, refresh: loadNotifications };
}
