import { useState, useEffect, useCallback } from 'react';
import Box from '@mui/material/Box';
import Badge from '@mui/material/Badge';
import IconButton from '@mui/material/IconButton';
import Popover from '@mui/material/Popover';
import Typography from '@mui/material/Typography';
import List from '@mui/material/List';
import ListItemButton from '@mui/material/ListItemButton';
import ListItemIcon from '@mui/material/ListItemIcon';
import ListItemText from '@mui/material/ListItemText';
import Button from '@mui/material/Button';
import Chip from '@mui/material/Chip';
import Divider from '@mui/material/Divider';
import Tooltip from '@mui/material/Tooltip';
import NotificationsIcon from '@mui/icons-material/Notifications';
import ErrorIcon from '@mui/icons-material/Error';
import WarningIcon from '@mui/icons-material/Warning';
import InfoIcon from '@mui/icons-material/Info';
import CheckCircleIcon from '@mui/icons-material/CheckCircle';
import DoneAllIcon from '@mui/icons-material/DoneAll';
import { supabase } from '../../lib/supabase';
import { useNavigate } from 'react-router-dom';

interface Notification {
  id: string;
  title: string;
  severity: string;
  source: string;
  created_at: string;
  acknowledged: boolean;
}

const severityIcons: Record<string, React.ReactNode> = {
  critical: <ErrorIcon sx={{ color: 'error.main' }} fontSize="small" />,
  high: <WarningIcon sx={{ color: 'warning.main' }} fontSize="small" />,
  medium: <InfoIcon sx={{ color: 'info.main' }} fontSize="small" />,
  low: <CheckCircleIcon sx={{ color: 'success.main' }} fontSize="small" />,
};

function timeAgo(dateStr: string): string {
  const diff = Date.now() - new Date(dateStr).getTime();
  const m = Math.floor(diff / 60000);
  if (m < 1) return '방금 전';
  if (m < 60) return `${m}분 전`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}시간 전`;
  const d = Math.floor(h / 24);
  return `${d}일 전`;
}

export default function NotificationCenter() {
  const [anchorEl, setAnchorEl] = useState<null | HTMLElement>(null);
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const navigate = useNavigate();

  const unreadCount = notifications.filter(n => !n.acknowledged).length;

  const fetchNotifications = useCallback(async () => {
    const { data } = await supabase
      .from('system_alerts')
      .select('id, title, severity, source, created_at, acknowledged')
      .order('created_at', { ascending: false })
      .limit(20);
    if (data) setNotifications(data);
  }, []);

  useEffect(() => {
    fetchNotifications();
    const channel = supabase.channel('notif-center')
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'system_alerts' }, () => {
        fetchNotifications();
      })
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [fetchNotifications]);

  const handleAcknowledge = useCallback(async (id: string) => {
    await supabase.from('system_alerts').update({ acknowledged: true }).eq('id', id);
    setNotifications(prev => prev.map(n => n.id === id ? { ...n, acknowledged: true } : n));
  }, []);

  const handleAcknowledgeAll = useCallback(async () => {
    const unread = notifications.filter(n => !n.acknowledged);
    if (unread.length === 0) return;
    await supabase.from('system_alerts').update({ acknowledged: true }).in('id', unread.map(n => n.id));
    setNotifications(prev => prev.map(n => ({ ...n, acknowledged: true })));
  }, [notifications]);

  const handleClick = (notif: Notification) => {
    handleAcknowledge(notif.id);
    setAnchorEl(null);
    navigate('/admin/alerts');
  };

  return (
    <>
      <Tooltip title="알림">
        <IconButton size="small" onClick={e => setAnchorEl(e.currentTarget)} sx={{ color: 'text.secondary' }}>
          <Badge badgeContent={unreadCount} color="error" max={99}>
            <NotificationsIcon fontSize="small" />
          </Badge>
        </IconButton>
      </Tooltip>

      <Popover
        open={Boolean(anchorEl)}
        anchorEl={anchorEl}
        onClose={() => setAnchorEl(null)}
        anchorOrigin={{ vertical: 'bottom', horizontal: 'right' }}
        transformOrigin={{ vertical: 'top', horizontal: 'right' }}
        slotProps={{ paper: { sx: { width: 360, maxHeight: 480, mt: 1, borderRadius: 2 } } }}
      >
        <Box sx={{ px: 2, py: 1.5, display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <Typography variant="subtitle1">알림</Typography>
          {unreadCount > 0 && (
            <Button size="small" startIcon={<DoneAllIcon sx={{ fontSize: 14 }} />} onClick={handleAcknowledgeAll}>
              모두 읽음
            </Button>
          )}
        </Box>
        <Divider />

        {notifications.length === 0 ? (
          <Box sx={{ py: 4, textAlign: 'center' }}>
            <Typography variant="body2" color="text.secondary">알림이 없습니다</Typography>
          </Box>
        ) : (
          <List dense sx={{ py: 0, maxHeight: 360, overflow: 'auto' }}>
            {notifications.map(notif => (
              <ListItemButton
                key={notif.id}
                onClick={() => handleClick(notif)}
                sx={{
                  opacity: notif.acknowledged ? 0.6 : 1,
                  bgcolor: notif.acknowledged ? 'transparent' : 'action.hover',
                  borderLeft: notif.acknowledged ? 'none' : '3px solid',
                  borderColor: notif.severity === 'critical' ? 'error.main' : notif.severity === 'high' ? 'warning.main' : 'info.main',
                }}
              >
                <ListItemIcon sx={{ minWidth: 32 }}>
                  {severityIcons[notif.severity] || severityIcons.medium}
                </ListItemIcon>
                <ListItemText
                  primary={notif.title}
                  secondary={timeAgo(notif.created_at)}
                  slotProps={{
                    primary: { sx: { fontSize: '0.8125rem', fontWeight: notif.acknowledged ? 400 : 600 } },
                    secondary: { sx: { fontSize: '0.6875rem' } },
                  }}
                />
                {notif.source && (
                  <Chip label={notif.source} size="small" variant="outlined" sx={{ height: 18, fontSize: '0.5625rem' }} />
                )}
              </ListItemButton>
            ))}
          </List>
        )}

        <Divider />
        <Box sx={{ p: 1, textAlign: 'center' }}>
          <Button size="small" onClick={() => { setAnchorEl(null); navigate('/admin/alerts'); }}>
            전체 보기
          </Button>
        </Box>
      </Popover>
    </>
  );
}
