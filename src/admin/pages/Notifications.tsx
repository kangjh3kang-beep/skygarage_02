import { useState, useEffect, useCallback } from 'react';
import Box from '@mui/material/Box';
import Card from '@mui/material/Card';
import CardContent from '@mui/material/CardContent';
import Grid from '@mui/material/Grid';
import Typography from '@mui/material/Typography';
import Table from '@mui/material/Table';
import TableBody from '@mui/material/TableBody';
import TableCell from '@mui/material/TableCell';
import TableContainer from '@mui/material/TableContainer';
import TableHead from '@mui/material/TableHead';
import TableRow from '@mui/material/TableRow';
import CircularProgress from '@mui/material/CircularProgress';
import Chip from '@mui/material/Chip';
import TextField from '@mui/material/TextField';
import MenuItem from '@mui/material/MenuItem';
import Button from '@mui/material/Button';
import IconButton from '@mui/material/IconButton';
import Tooltip from '@mui/material/Tooltip';
import NotificationsIcon from '@mui/icons-material/Notifications';
import NotificationsActiveIcon from '@mui/icons-material/NotificationsActive';
import MarkEmailReadIcon from '@mui/icons-material/MarkEmailRead';
import MarkEmailUnreadIcon from '@mui/icons-material/MarkEmailUnread';
import DoneAllIcon from '@mui/icons-material/DoneAll';
import { supabase } from '../../lib/supabase';
import { useNavigate } from 'react-router-dom';
import { useDocumentTitle } from '../../hooks/useDocumentTitle';
import { useToast } from '../contexts/ToastContext';

interface Notification {
  id: string;
  type: string;
  title: string;
  message: string;
  inquiry_id: string | null;
  read: boolean;
  created_at: string;
}

const typeColors: Record<string, 'primary' | 'success' | 'error' | 'warning' | 'info' | 'default'> = {
  info: 'info',
  warning: 'warning',
  error: 'error',
  success: 'success',
  inquiry: 'primary',
};

const typeLabels: Record<string, string> = {
  info: '정보',
  warning: '경고',
  error: '오류',
  success: '성공',
  inquiry: '문의',
};

export default function Notifications() {
  useDocumentTitle('알림 관리');
  const { showToast } = useToast();
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [typeFilter, setTypeFilter] = useState('all');
  const [readFilter, setReadFilter] = useState('all');

  const loadData = useCallback(async () => {
    let query = supabase
      .from('admin_notifications')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(500);
    if (typeFilter !== 'all') query = query.eq('type', typeFilter);
    if (readFilter === 'read') query = query.eq('read', true);
    if (readFilter === 'unread') query = query.eq('read', false);
    const { data, error } = await query;
    if (error) {
      showToast('알림을 불러오는 데 실패했습니다.', 'error');
    }
    if (data) setNotifications(data);
    setLoading(false);
  }, [typeFilter, readFilter, showToast]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  useEffect(() => {
    const channel = supabase
      .channel('admin-notifications-rt')
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'admin_notifications' },
        () => {
          loadData();
        }
      )
      .on(
        'postgres_changes',
        { event: 'UPDATE', schema: 'public', table: 'admin_notifications' },
        () => {
          loadData();
        }
      )
      .subscribe();
    return () => {
      supabase.removeChannel(channel);
    };
  }, [loadData]);

  const toggleRead = async (notification: Notification) => {
    const newRead = !notification.read;
    const { error } = await supabase
      .from('admin_notifications')
      .update({ read: newRead })
      .eq('id', notification.id);
    if (error) {
      showToast('상태 변경에 실패했습니다.', 'error');
      return;
    }
    setNotifications(prev =>
      prev.map(n => (n.id === notification.id ? { ...n, read: newRead } : n))
    );
    showToast(newRead ? '읽음으로 표시했습니다.' : '미읽음으로 표시했습니다.');
  };

  const markAllAsRead = async () => {
    const unreadIds = notifications.filter(n => !n.read).map(n => n.id);
    if (unreadIds.length === 0) {
      showToast('미읽음 알림이 없습니다.', 'info');
      return;
    }
    const { error } = await supabase
      .from('admin_notifications')
      .update({ read: true })
      .in('id', unreadIds);
    if (error) {
      showToast('일괄 읽음 처리에 실패했습니다.', 'error');
      return;
    }
    setNotifications(prev => prev.map(n => ({ ...n, read: true })));
    showToast(`${unreadIds.length}건의 알림을 읽음으로 표시했습니다.`);
  };

  const types = [...new Set(notifications.map(n => n.type).filter(Boolean))];
  const unreadCount = notifications.filter(n => !n.read).length;
  const todayCount = notifications.filter(
    n => n.created_at && new Date(n.created_at).toDateString() === new Date().toDateString()
  ).length;

  if (loading) {
    return (
      <Box sx={{ display: 'flex', justifyContent: 'center', py: 10 }}>
        <CircularProgress />
      </Box>
    );
  }

  return (
    <Box>
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 3, flexWrap: 'wrap', gap: 1 }}>
        <Typography variant="h1" sx={{ mb: 0 }}>알림 관리</Typography>
        <Box sx={{ display: 'flex', gap: 1 }}>
          <Button variant="outlined" size="small" onClick={() => navigate('/admin/alerts')}>알림 센터</Button>
          <Button variant="outlined" size="small" onClick={() => navigate('/admin/tickets')}>지원 티켓</Button>
          <Button
            variant="contained"
            startIcon={<DoneAllIcon />}
            onClick={markAllAsRead}
            disabled={unreadCount === 0}
          >
            모두 읽음 처리
          </Button>
        </Box>
      </Box>

      <Grid container spacing={2} sx={{ mb: 3 }}>
        <Grid size={{ xs: 6, md: 3 }}>
          <Card>
            <CardContent sx={{ textAlign: 'center' }}>
              <NotificationsIcon color="primary" />
              <Typography variant="caption" color="text.secondary">전체 알림</Typography>
              <Typography variant="h2">{notifications.length}</Typography>
            </CardContent>
          </Card>
        </Grid>
        <Grid size={{ xs: 6, md: 3 }}>
          <Card>
            <CardContent sx={{ textAlign: 'center' }}>
              <NotificationsActiveIcon color="error" />
              <Typography variant="caption" color="text.secondary">미읽음</Typography>
              <Typography variant="h2" color="error">{unreadCount}</Typography>
            </CardContent>
          </Card>
        </Grid>
        <Grid size={{ xs: 6, md: 3 }}>
          <Card>
            <CardContent sx={{ textAlign: 'center' }}>
              <MarkEmailReadIcon color="success" />
              <Typography variant="caption" color="text.secondary">읽음</Typography>
              <Typography variant="h2" color="success.main">{notifications.length - unreadCount}</Typography>
            </CardContent>
          </Card>
        </Grid>
        <Grid size={{ xs: 6, md: 3 }}>
          <Card>
            <CardContent sx={{ textAlign: 'center' }}>
              <NotificationsIcon color="info" />
              <Typography variant="caption" color="text.secondary">오늘 알림</Typography>
              <Typography variant="h2">{todayCount}</Typography>
            </CardContent>
          </Card>
        </Grid>
      </Grid>

      <Box sx={{ display: 'flex', gap: 2, mb: 2, flexWrap: 'wrap' }}>
        <TextField
          select
          size="small"
          label="유형"
          value={typeFilter}
          onChange={e => setTypeFilter(e.target.value)}
          sx={{ width: 160 }}
        >
          <MenuItem value="all">전체 유형</MenuItem>
          {types.map(t => (
            <MenuItem key={t} value={t}>{typeLabels[t] || t}</MenuItem>
          ))}
        </TextField>
        <TextField
          select
          size="small"
          label="읽음 상태"
          value={readFilter}
          onChange={e => setReadFilter(e.target.value)}
          sx={{ width: 160 }}
        >
          <MenuItem value="all">전체</MenuItem>
          <MenuItem value="read">읽음</MenuItem>
          <MenuItem value="unread">미읽음</MenuItem>
        </TextField>
      </Box>

      <Card>
        <TableContainer>
          <Table size="small">
            <TableHead>
              <TableRow>
                <TableCell>상태</TableCell>
                <TableCell>유형</TableCell>
                <TableCell>제목</TableCell>
                <TableCell>내용</TableCell>
                <TableCell>문의 ID</TableCell>
                <TableCell>시간</TableCell>
                <TableCell align="center">작업</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {notifications.map(n => (
                <TableRow
                  key={n.id}
                  hover
                  sx={{
                    bgcolor: n.read ? 'transparent' : 'action.hover',
                    opacity: n.read ? 0.75 : 1,
                  }}
                >
                  <TableCell>
                    <Chip
                      label={n.read ? '읽음' : '미읽음'}
                      size="small"
                      color={n.read ? 'default' : 'primary'}
                      variant={n.read ? 'outlined' : 'filled'}
                    />
                  </TableCell>
                  <TableCell>
                    <Chip
                      label={typeLabels[n.type] || n.type}
                      size="small"
                      color={typeColors[n.type] || 'default'}
                    />
                  </TableCell>
                  <TableCell>
                    <Typography variant="body2" sx={{ fontWeight: n.read ? 400 : 700 }}>
                      {n.title}
                    </Typography>
                  </TableCell>
                  <TableCell>
                    <Typography
                      variant="caption"
                      sx={{
                        maxWidth: 300,
                        display: 'block',
                        overflow: 'hidden',
                        textOverflow: 'ellipsis',
                        whiteSpace: 'nowrap',
                      }}
                    >
                      {n.message || '-'}
                    </Typography>
                  </TableCell>
                  <TableCell>
                    {n.inquiry_id ? (
                      <Typography
                        variant="caption"
                        onClick={() => navigate(`/admin/inquiries/${n.inquiry_id}`)}
                        sx={{ fontFamily: 'monospace', color: 'primary.main', cursor: 'pointer', '&:hover': { textDecoration: 'underline' } }}
                      >
                        {n.inquiry_id.substring(0, 8)}...
                      </Typography>
                    ) : (
                      <Typography variant="caption" sx={{ fontFamily: 'monospace' }}>-</Typography>
                    )}
                  </TableCell>
                  <TableCell>
                    <Typography variant="caption">
                      {n.created_at ? new Date(n.created_at).toLocaleString('ko-KR') : '-'}
                    </Typography>
                  </TableCell>
                  <TableCell align="center">
                    <Tooltip title={n.read ? '미읽음으로 표시' : '읽음으로 표시'}>
                      <IconButton size="small" onClick={() => toggleRead(n)}>
                        {n.read ? <MarkEmailUnreadIcon fontSize="small" /> : <MarkEmailReadIcon fontSize="small" />}
                      </IconButton>
                    </Tooltip>
                  </TableCell>
                </TableRow>
              ))}
              {notifications.length === 0 && (
                <TableRow>
                  <TableCell colSpan={7} align="center">
                    <Typography variant="body2" color="text.secondary" sx={{ py: 4 }}>
                      알림이 없습니다.
                    </Typography>
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </TableContainer>
      </Card>
    </Box>
  );
}
