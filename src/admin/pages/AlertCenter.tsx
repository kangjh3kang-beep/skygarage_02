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
import ErrorIcon from '@mui/icons-material/Error';
import WarningIcon from '@mui/icons-material/Warning';
import CheckCircleIcon from '@mui/icons-material/CheckCircle';
import NotificationsActiveIcon from '@mui/icons-material/NotificationsActive';
import VisibilityIcon from '@mui/icons-material/Visibility';
import DoneIcon from '@mui/icons-material/Done';
import { supabase } from '../../lib/supabase';
import { useDocumentTitle } from '../../hooks/useDocumentTitle';
import { useToast } from '../contexts/ToastContext';
import { useAuditLog } from '../../hooks/useAuditLog';
import { useNavigate } from 'react-router-dom';

interface SystemAlert {
  id: string;
  complex_id: string | null;
  category: string;
  severity: 'info' | 'warning' | 'error' | 'critical';
  title: string;
  description: string | null;
  source: string | null;
  status: 'active' | 'acknowledged' | 'resolved';
  assigned_to: string | null;
  resolved_at: string | null;
  created_at: string;
}

const severityColors: Record<string, 'info' | 'warning' | 'error'> = {
  critical: 'error',
  error: 'error',
  warning: 'warning',
  info: 'info',
};

const severityLabels: Record<string, string> = {
  critical: '심각',
  error: '오류',
  warning: '경고',
  info: '정보',
};

const statusLabels: Record<string, string> = {
  active: '활성',
  acknowledged: '확인됨',
  resolved: '해결됨',
};

const statusColors: Record<string, 'error' | 'warning' | 'success' | 'default'> = {
  active: 'error',
  acknowledged: 'warning',
  resolved: 'success',
};

export default function AlertCenter() {
  useDocumentTitle('알림 센터');
  const { showToast } = useToast();
  const { logAction } = useAuditLog();
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [alerts, setAlerts] = useState<SystemAlert[]>([]);
  const [severityFilter, setSeverityFilter] = useState('all');
  const [statusFilter, setStatusFilter] = useState('all');
  const [categoryFilter, setCategoryFilter] = useState('all');

  const loadData = useCallback(async () => {
    let query = supabase
      .from('system_alerts')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(500);
    if (severityFilter !== 'all') query = query.eq('severity', severityFilter);
    if (statusFilter !== 'all') query = query.eq('status', statusFilter);
    if (categoryFilter !== 'all') query = query.eq('category', categoryFilter);
    const { data, error } = await query;
    if (error) {
      showToast('알림을 불러오는 데 실패했습니다.', 'error');
    }
    if (data) setAlerts(data);
    setLoading(false);
  }, [severityFilter, statusFilter, categoryFilter, showToast]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  useEffect(() => {
    const channel = supabase
      .channel('system-alerts-rt')
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'system_alerts' },
        () => {
          loadData();
        }
      )
      .on(
        'postgres_changes',
        { event: 'UPDATE', schema: 'public', table: 'system_alerts' },
        () => {
          loadData();
        }
      )
      .subscribe();
    return () => {
      supabase.removeChannel(channel);
    };
  }, [loadData]);

  useEffect(() => {
    logAction('VIEW', 'system_alerts', undefined, { page: 'AlertCenter' });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const updateStatus = async (alert: SystemAlert, newStatus: 'acknowledged' | 'resolved') => {
    const updatePayload: Record<string, unknown> = { status: newStatus };
    if (newStatus === 'resolved') {
      updatePayload.resolved_at = new Date().toISOString();
    }
    const { error } = await supabase
      .from('system_alerts')
      .update(updatePayload)
      .eq('id', alert.id);
    if (error) {
      showToast('상태 변경에 실패했습니다.', 'error');
      return;
    }
    setAlerts(prev =>
      prev.map(a =>
        a.id === alert.id
          ? { ...a, status: newStatus, resolved_at: newStatus === 'resolved' ? new Date().toISOString() : a.resolved_at }
          : a
      )
    );
    logAction('UPDATE', 'system_alerts', alert.id, { status: newStatus });
    showToast(
      newStatus === 'acknowledged'
        ? '알림을 확인 처리했습니다.'
        : '알림을 해결 처리했습니다.',
      'success'
    );
  };

  const categories = [...new Set(alerts.map(a => a.category).filter(Boolean))];
  const activeCount = alerts.filter(a => a.status === 'active').length;
  const criticalCount = alerts.filter(a => a.severity === 'critical' && a.status !== 'resolved').length;
  const warningCount = alerts.filter(a => a.severity === 'warning' && a.status !== 'resolved').length;
  const resolvedTodayCount = alerts.filter(
    a =>
      a.status === 'resolved' &&
      a.resolved_at &&
      new Date(a.resolved_at).toDateString() === new Date().toDateString()
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
      <Box sx={{ mb: 3, display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 1 }}>
        <Typography variant="h1">알림 센터</Typography>
        <Box sx={{ display: 'flex', gap: 1 }}>
          <Button variant="outlined" size="small" onClick={() => navigate('/admin/maintenance')}>정비 관리</Button>
          <Button variant="outlined" size="small" onClick={() => navigate('/admin/noc')}>NOC</Button>
          <Button variant="outlined" size="small" onClick={() => navigate('/admin/tickets')}>지원 티켓</Button>
        </Box>
      </Box>

      <Grid container spacing={2} sx={{ mb: 3 }}>
        <Grid size={{ xs: 6, md: 3 }}>
          <Card>
            <CardContent sx={{ textAlign: 'center' }}>
              <NotificationsActiveIcon color="error" />
              <Typography variant="caption" color="text.secondary">활성 알림</Typography>
              <Typography variant="h2" color="error">{activeCount}</Typography>
            </CardContent>
          </Card>
        </Grid>
        <Grid size={{ xs: 6, md: 3 }}>
          <Card>
            <CardContent sx={{ textAlign: 'center' }}>
              <ErrorIcon color="error" />
              <Typography variant="caption" color="text.secondary">심각 알림</Typography>
              <Typography variant="h2" color="error">{criticalCount}</Typography>
            </CardContent>
          </Card>
        </Grid>
        <Grid size={{ xs: 6, md: 3 }}>
          <Card>
            <CardContent sx={{ textAlign: 'center' }}>
              <WarningIcon color="warning" />
              <Typography variant="caption" color="text.secondary">경고 알림</Typography>
              <Typography variant="h2" color="warning.main">{warningCount}</Typography>
            </CardContent>
          </Card>
        </Grid>
        <Grid size={{ xs: 6, md: 3 }}>
          <Card>
            <CardContent sx={{ textAlign: 'center' }}>
              <CheckCircleIcon color="success" />
              <Typography variant="caption" color="text.secondary">오늘 해결</Typography>
              <Typography variant="h2" color="success.main">{resolvedTodayCount}</Typography>
            </CardContent>
          </Card>
        </Grid>
      </Grid>

      <Box sx={{ display: 'flex', gap: 2, mb: 2, flexWrap: 'wrap' }}>
        <TextField
          select
          size="small"
          label="심각도"
          value={severityFilter}
          onChange={e => setSeverityFilter(e.target.value)}
          sx={{ width: 160 }}
        >
          <MenuItem value="all">전체 심각도</MenuItem>
          <MenuItem value="critical">심각</MenuItem>
          <MenuItem value="error">오류</MenuItem>
          <MenuItem value="warning">경고</MenuItem>
          <MenuItem value="info">정보</MenuItem>
        </TextField>
        <TextField
          select
          size="small"
          label="상태"
          value={statusFilter}
          onChange={e => setStatusFilter(e.target.value)}
          sx={{ width: 160 }}
        >
          <MenuItem value="all">전체 상태</MenuItem>
          <MenuItem value="active">활성</MenuItem>
          <MenuItem value="acknowledged">확인됨</MenuItem>
          <MenuItem value="resolved">해결됨</MenuItem>
        </TextField>
        <TextField
          select
          size="small"
          label="카테고리"
          value={categoryFilter}
          onChange={e => setCategoryFilter(e.target.value)}
          sx={{ width: 180 }}
        >
          <MenuItem value="all">전체 카테고리</MenuItem>
          {categories.map(c => (
            <MenuItem key={c} value={c}>{c}</MenuItem>
          ))}
        </TextField>
      </Box>

      <Card>
        <TableContainer>
          <Table size="small">
            <TableHead>
              <TableRow>
                <TableCell>심각도</TableCell>
                <TableCell>상태</TableCell>
                <TableCell>카테고리</TableCell>
                <TableCell>제목</TableCell>
                <TableCell>설명</TableCell>
                <TableCell>출처</TableCell>
                <TableCell>시간</TableCell>
                <TableCell align="center">작업</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {alerts.map(a => (
                <TableRow
                  key={a.id}
                  hover
                  sx={{
                    opacity: a.status === 'resolved' ? 0.6 : 1,
                  }}
                >
                  <TableCell>
                    <Chip
                      label={severityLabels[a.severity] || a.severity}
                      size="small"
                      color={severityColors[a.severity] || 'default'}
                    />
                  </TableCell>
                  <TableCell>
                    <Chip
                      label={statusLabels[a.status] || a.status}
                      size="small"
                      color={statusColors[a.status] || 'default'}
                      variant={a.status === 'resolved' ? 'outlined' : 'filled'}
                    />
                  </TableCell>
                  <TableCell>
                    <Typography variant="caption">{a.category || '-'}</Typography>
                  </TableCell>
                  <TableCell>
                    <Typography
                      variant="body2"
                      sx={{ fontWeight: a.status === 'active' ? 700 : 400 }}
                    >
                      {a.title}
                    </Typography>
                  </TableCell>
                  <TableCell>
                    <Typography
                      variant="caption"
                      sx={{
                        maxWidth: 280,
                        display: 'block',
                        overflow: 'hidden',
                        textOverflow: 'ellipsis',
                        whiteSpace: 'nowrap',
                      }}
                    >
                      {a.description || '-'}
                    </Typography>
                  </TableCell>
                  <TableCell>
                    <Typography variant="caption" sx={{ fontFamily: 'monospace' }}>
                      {a.source || '-'}
                    </Typography>
                  </TableCell>
                  <TableCell>
                    <Typography variant="caption">
                      {a.created_at ? new Date(a.created_at).toLocaleString('ko-KR') : '-'}
                    </Typography>
                  </TableCell>
                  <TableCell align="center">
                    <Box sx={{ display: 'flex', gap: 0.5, justifyContent: 'center' }}>
                      {a.status === 'active' && (
                        <Tooltip title="확인 처리">
                          <IconButton size="small" onClick={() => updateStatus(a, 'acknowledged')}>
                            <VisibilityIcon fontSize="small" />
                          </IconButton>
                        </Tooltip>
                      )}
                      {a.status !== 'resolved' && (
                        <Tooltip title="해결 처리">
                          <IconButton size="small" onClick={() => updateStatus(a, 'resolved')}>
                            <DoneIcon fontSize="small" />
                          </IconButton>
                        </Tooltip>
                      )}
                    </Box>
                  </TableCell>
                </TableRow>
              ))}
              {alerts.length === 0 && (
                <TableRow>
                  <TableCell colSpan={8} align="center">
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
