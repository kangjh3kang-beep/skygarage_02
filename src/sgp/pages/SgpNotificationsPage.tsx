import { useState, useEffect } from 'react';
import Box from '@mui/material/Box';
import Typography from '@mui/material/Typography';
import Card from '@mui/material/Card';
import CardContent from '@mui/material/CardContent';
import CircularProgress from '@mui/material/CircularProgress';
import Button from '@mui/material/Button';
import Chip from '@mui/material/Chip';
import NotificationsIcon from '@mui/icons-material/Notifications';
import CheckIcon from '@mui/icons-material/Check';
import { useSgpAuth } from '../contexts/SgpAuthContext';
import { supabase } from '../../lib/supabase';
import type { AppNotification } from '../types';

const SEVERITY_COLORS: Record<string, string> = {
  info: '#00d4aa',
  success: '#4caf50',
  warning: '#ffc107',
  error: '#ff5252',
};

export default function SgpNotificationsPage() {
  const { user } = useSgpAuth();
  const [notifications, setNotifications] = useState<AppNotification[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!user) return;
    loadData();
  }, [user]);

  async function loadData() {
    setLoading(true);
    setError(null);
    try {
      const { data, error: fetchError } = await supabase
        .from('sgp_notifications')
        .select('*')
        .eq('user_id', user!.id)
        .order('created_at', { ascending: false })
        .limit(50);
      if (fetchError) throw new Error(fetchError.message);
      setNotifications((data || []).map(row => ({
        id: row.id,
        userId: row.user_id,
        title: row.title,
        body: row.body,
        severity: row.severity,
        read: row.read,
        createdAt: row.created_at,
      })));
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setLoading(false);
    }
  }

  async function markAllRead() {
    if (!user) return;
    await supabase
      .from('sgp_notifications')
      .update({ read: true })
      .eq('user_id', user.id)
      .eq('read', false);
    await loadData();
  }

  async function markRead(id: string) {
    await supabase.from('sgp_notifications').update({ read: true }).eq('id', id);
    setNotifications(prev => prev.map(n => n.id === id ? { ...n, read: true } : n));
  }

  if (loading) {
    return (
      <Box sx={{ display: 'flex', justifyContent: 'center', py: 8 }}>
        <CircularProgress sx={{ color: '#00d4aa' }} />
      </Box>
    );
  }

  if (error) {
    return (
      <Box sx={{ p: 3, textAlign: 'center' }}>
        <Typography color="error" variant="body2" sx={{ mb: 2 }}>{error}</Typography>
        <Button onClick={loadData} size="small" sx={{ color: '#00d4aa' }}>다시 시도</Button>
      </Box>
    );
  }

  const unreadCount = notifications.filter(n => !n.read).length;

  return (
    <Box sx={{ p: 2 }}>
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2 }}>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
          <Typography variant="subtitle1" sx={{ color: '#fff', fontWeight: 700 }}>알림</Typography>
          {unreadCount > 0 && (
            <Chip label={unreadCount} size="small" sx={{ bgcolor: '#00d4aa', color: '#0d1b2a', fontWeight: 700, height: 20, fontSize: '0.7rem' }} />
          )}
        </Box>
        {unreadCount > 0 && (
          <Button size="small" startIcon={<CheckIcon />} onClick={markAllRead} sx={{ color: 'rgba(255,255,255,0.5)', fontSize: '0.75rem' }}>
            모두 읽음
          </Button>
        )}
      </Box>

      {notifications.length === 0 ? (
        <Box sx={{ textAlign: 'center', py: 6 }}>
          <NotificationsIcon sx={{ fontSize: 48, color: 'rgba(255,255,255,0.2)', mb: 1 }} />
          <Typography variant="body2" sx={{ color: 'rgba(255,255,255,0.4)' }}>알림이 없습니다</Typography>
        </Box>
      ) : (
        notifications.map(n => (
          <Card
            key={n.id}
            onClick={() => !n.read && markRead(n.id)}
            sx={{
              mb: 1,
              bgcolor: n.read ? 'rgba(255,255,255,0.02)' : 'rgba(0,212,170,0.04)',
              borderRadius: 2,
              border: n.read ? 'none' : '1px solid rgba(0,212,170,0.15)',
              cursor: n.read ? 'default' : 'pointer',
            }}
          >
            <CardContent sx={{ p: 2, '&:last-child': { pb: 2 } }}>
              <Box sx={{ display: 'flex', alignItems: 'flex-start', gap: 1.5 }}>
                <Box sx={{ width: 6, height: 6, borderRadius: '50%', bgcolor: n.read ? 'transparent' : SEVERITY_COLORS[n.severity], mt: 0.8, flexShrink: 0 }} />
                <Box sx={{ flex: 1 }}>
                  <Typography variant="body2" sx={{ color: '#fff', fontWeight: n.read ? 400 : 600, mb: 0.3 }}>{n.title}</Typography>
                  <Typography variant="caption" sx={{ color: 'rgba(255,255,255,0.5)', display: 'block', mb: 0.5 }}>{n.body}</Typography>
                  <Typography variant="caption" sx={{ color: 'rgba(255,255,255,0.3)' }}>
                    {new Date(n.createdAt).toLocaleDateString('ko-KR', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })}
                  </Typography>
                </Box>
              </Box>
            </CardContent>
          </Card>
        ))
      )}
    </Box>
  );
}
