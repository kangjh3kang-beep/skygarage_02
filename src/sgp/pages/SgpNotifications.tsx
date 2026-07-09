import { useState, useEffect } from 'react';
import Box from '@mui/material/Box';
import Typography from '@mui/material/Typography';
import Card from '@mui/material/Card';
import CardContent from '@mui/material/CardContent';
import Chip from '@mui/material/Chip';
import IconButton from '@mui/material/IconButton';
import CheckIcon from '@mui/icons-material/Check';
import WarningIcon from '@mui/icons-material/Warning';
import InfoIcon from '@mui/icons-material/Info';
import ErrorIcon from '@mui/icons-material/Error';
import { useSgpAuth } from '../contexts/SgpAuthContext';
import { supabase } from '../../lib/supabase';
import type { AppNotification, NotificationSeverity } from '../types';

const SEVERITY_ICONS: Record<NotificationSeverity, React.ReactNode> = {
  info: <InfoIcon sx={{ fontSize: 18, color: '#3b82f6' }} />,
  warning: <WarningIcon sx={{ fontSize: 18, color: '#f59e0b' }} />,
  critical: <ErrorIcon sx={{ fontSize: 18, color: '#ef4444' }} />,
};

export default function SgpNotifications() {
  const { user } = useSgpAuth();
  const [notifications, setNotifications] = useState<AppNotification[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user) return;
    loadNotifications();
  }, [user]);

  async function loadNotifications() {
    if (!user) return;
    const { data } = await supabase
      .from('domain_events')
      .select('*')
      .eq('envelope', 'AuditEvent')
      .eq('subtype', 'alert')
      .order('created_at', { ascending: false })
      .limit(30);

    const mapped: AppNotification[] = (data ?? []).map(d => ({
      id: d.id,
      userId: user.id,
      title: (d.payload as Record<string, unknown>)?.title as string ?? d.action,
      body: (d.payload as Record<string, unknown>)?.body as string ?? '',
      severity: ((d.payload as Record<string, unknown>)?.severity as NotificationSeverity) ?? 'info',
      category: 'system',
      read: false,
      createdAt: d.created_at,
    }));

    setNotifications(mapped);
    setLoading(false);
  }

  async function markRead(id: string) {
    setNotifications(prev => prev.map(n => n.id === id ? { ...n, read: true } : n));
  }

  if (loading) {
    return (
      <Box sx={{ px: 2, pt: 3 }}>
        <Typography variant="h6" sx={{ color: '#fff', fontWeight: 700, mb: 2 }}>알림</Typography>
        <Typography variant="body2" sx={{ color: 'rgba(255,255,255,0.4)' }}>불러오는 중...</Typography>
      </Box>
    );
  }

  return (
    <Box sx={{ px: 2, pt: 3, pb: 10 }}>
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2 }}>
        <Typography variant="h6" sx={{ color: '#fff', fontWeight: 700 }}>알림</Typography>
        <Chip
          label={`${notifications.filter(n => !n.read).length}개 미읽음`}
          size="small"
          sx={{ bgcolor: 'rgba(0,212,170,0.1)', color: '#00d4aa', fontWeight: 600 }}
        />
      </Box>

      {notifications.length === 0 && (
        <Box sx={{ textAlign: 'center', mt: 6 }}>
          <InfoIcon sx={{ fontSize: 48, color: 'rgba(255,255,255,0.2)', mb: 1 }} />
          <Typography variant="body2" sx={{ color: 'rgba(255,255,255,0.4)' }}>
            알림이 없습니다.
          </Typography>
        </Box>
      )}

      {notifications.map(n => (
        <Card
          key={n.id}
          sx={{
            bgcolor: n.read ? 'rgba(255,255,255,0.02)' : 'rgba(255,255,255,0.05)',
            border: `1px solid ${n.read ? 'rgba(255,255,255,0.05)' : 'rgba(0,212,170,0.15)'}`,
            borderRadius: 2, mb: 1,
          }}
        >
          <CardContent sx={{ py: 1.5, px: 2, '&:last-child': { pb: 1.5 }, display: 'flex', alignItems: 'flex-start', gap: 1.5 }}>
            {SEVERITY_ICONS[n.severity]}
            <Box sx={{ flex: 1 }}>
              <Typography variant="subtitle2" sx={{ color: '#fff', fontWeight: n.read ? 400 : 600, fontSize: '0.82rem' }}>
                {n.title}
              </Typography>
              {n.body && (
                <Typography variant="caption" sx={{ color: 'rgba(255,255,255,0.4)' }}>
                  {n.body}
                </Typography>
              )}
              <Typography variant="caption" sx={{ color: 'rgba(255,255,255,0.25)', display: 'block', mt: 0.5 }}>
                {new Date(n.createdAt).toLocaleString('ko-KR')}
              </Typography>
            </Box>
            {!n.read && (
              <IconButton size="small" onClick={() => markRead(n.id)} sx={{ color: 'rgba(255,255,255,0.3)' }}>
                <CheckIcon sx={{ fontSize: 16 }} />
              </IconButton>
            )}
          </CardContent>
        </Card>
      ))}
    </Box>
  );
}
