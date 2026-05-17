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
import InputAdornment from '@mui/material/InputAdornment';
import SearchIcon from '@mui/icons-material/Search';
import SecurityIcon from '@mui/icons-material/Security';
import Button from '@mui/material/Button';
import { supabase } from '../../lib/supabase';
import { useNavigate } from 'react-router-dom';
import { useDocumentTitle } from '../../hooks/useDocumentTitle';
import { useAuditLog } from '../../hooks/useAuditLog';

interface AuditLog {
  id: string;
  user_id: string;
  action: string;
  table_name: string;
  record_id: string;
  details: Record<string, unknown>;
  created_at: string;
}

const actionColors: Record<string, 'success' | 'primary' | 'error' | 'warning' | 'default'> = { CREATE: 'success', UPDATE: 'primary', DELETE: 'error', LOGIN: 'warning' };

export default function SecurityAudit() {
  useDocumentTitle('보안 감사');
  const { logAction } = useAuditLog();
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [logs, setLogs] = useState<AuditLog[]>([]);
  const [search, setSearch] = useState('');
  const [actionFilter, setActionFilter] = useState('all');
  const [tableFilter, setTableFilter] = useState('all');

  const loadData = useCallback(async () => {
    let query = supabase.from('security_audit_logs').select('*').order('created_at', { ascending: false }).limit(300);
    if (actionFilter !== 'all') query = query.eq('action', actionFilter);
    if (tableFilter !== 'all') query = query.eq('table_name', tableFilter);
    const { data } = await query;
    if (data) setLogs(data);
    setLoading(false);
  }, [actionFilter, tableFilter]);

  useEffect(() => { loadData(); }, [loadData]);

  useEffect(() => {
    const channel = supabase.channel('audit-rt')
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'security_audit_logs' }, () => { loadData(); })
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [loadData]);

  // Log that the admin viewed the audit logs
  useEffect(() => {
    logAction('VIEW', 'security_audit_logs', undefined, { page: 'SecurityAudit' });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const actions = [...new Set(logs.map(l => l.action).filter(Boolean))];
  const tables = [...new Set(logs.map(l => l.table_name).filter(Boolean))];
  const filtered = logs.filter(l => !search || l.table_name?.includes(search) || l.record_id?.includes(search) || JSON.stringify(l.details)?.includes(search));

  const todayCount = logs.filter(l => l.created_at && new Date(l.created_at).toDateString() === new Date().toDateString()).length;
  const deleteCount = logs.filter(l => l.action === 'DELETE').length;

  if (loading) return <Box sx={{ display: 'flex', justifyContent: 'center', py: 10 }}><CircularProgress /></Box>;

  return (
    <Box>
      <Box sx={{ mb: 3, display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 1 }}>
        <Typography variant="h1">보안 감사 로그</Typography>
        <Box sx={{ display: 'flex', gap: 1 }}>
          <Button variant="outlined" size="small" onClick={() => navigate('/admin/access')}>출입 관리</Button>
          <Button variant="outlined" size="small" onClick={() => navigate('/admin/users')}>사용자 관리</Button>
          <Button variant="outlined" size="small" onClick={() => navigate('/admin/alerts')}>알림 센터</Button>
        </Box>
      </Box>
      <Grid container spacing={2} sx={{ mb: 3 }}>
        <Grid size={{ xs: 6, md: 3 }}><Card><CardContent sx={{ textAlign: 'center' }}><SecurityIcon color="primary" /><Typography variant="caption" color="text.secondary">전체 로그</Typography><Typography variant="h2">{logs.length}</Typography></CardContent></Card></Grid>
        <Grid size={{ xs: 6, md: 3 }}><Card><CardContent sx={{ textAlign: 'center' }}><Typography variant="caption" color="text.secondary">오늘 활동</Typography><Typography variant="h2">{todayCount}</Typography></CardContent></Card></Grid>
        <Grid size={{ xs: 6, md: 3 }}><Card><CardContent sx={{ textAlign: 'center' }}><Typography variant="caption" color="text.secondary">삭제 작업</Typography><Typography variant="h2" color="error">{deleteCount}</Typography></CardContent></Card></Grid>
      </Grid>

      <Box sx={{ display: 'flex', gap: 2, mb: 2, flexWrap: 'wrap' }}>
        <TextField size="small" placeholder="검색 (테이블, 레코드 ID, 상세)" value={search} onChange={e => setSearch(e.target.value)} sx={{ width: 300 }}
          slotProps={{ input: { startAdornment: <InputAdornment position="start"><SearchIcon fontSize="small" /></InputAdornment> } }} />
        <TextField select size="small" value={actionFilter} onChange={e => setActionFilter(e.target.value)} sx={{ width: 140 }}>
          <MenuItem value="all">전체 액션</MenuItem>
          {actions.map(a => <MenuItem key={a} value={a}>{a}</MenuItem>)}
        </TextField>
        <TextField select size="small" value={tableFilter} onChange={e => setTableFilter(e.target.value)} sx={{ width: 200 }}>
          <MenuItem value="all">전체 테이블</MenuItem>
          {tables.map(t => <MenuItem key={t} value={t}>{t}</MenuItem>)}
        </TextField>
      </Box>

      <Card>
        <TableContainer>
          <Table size="small">
            <TableHead><TableRow>
              <TableCell>시간</TableCell><TableCell>액션</TableCell><TableCell>테이블</TableCell>
              <TableCell>레코드 ID</TableCell><TableCell>사용자 ID</TableCell><TableCell>상세</TableCell>
            </TableRow></TableHead>
            <TableBody>
              {filtered.map(l => (
                <TableRow key={l.id} hover sx={{ bgcolor: l.action === 'DELETE' ? 'error.50' : undefined }}>
                  <TableCell><Typography variant="caption">{l.created_at ? new Date(l.created_at).toLocaleString('ko-KR') : '-'}</Typography></TableCell>
                  <TableCell><Chip label={l.action} size="small" color={actionColors[l.action] || 'default'} /></TableCell>
                  <TableCell><Typography variant="caption" sx={{ fontFamily: 'monospace' }}>{l.table_name}</Typography></TableCell>
                  <TableCell><Typography variant="caption" sx={{ fontFamily: 'monospace' }}>{l.record_id ? l.record_id.substring(0, 8) + '...' : '-'}</Typography></TableCell>
                  <TableCell><Typography variant="caption" sx={{ fontFamily: 'monospace' }}>{l.user_id ? l.user_id.substring(0, 8) + '...' : '-'}</Typography></TableCell>
                  <TableCell><Typography variant="caption" sx={{ maxWidth: 300, display: 'block', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{l.details ? JSON.stringify(l.details) : '-'}</Typography></TableCell>
                </TableRow>
              ))}
              {filtered.length === 0 && (
                <TableRow><TableCell colSpan={6} align="center"><Typography variant="body2" color="text.secondary" sx={{ py: 4 }}>로그가 없습니다.</Typography></TableCell></TableRow>
              )}
            </TableBody>
          </Table>
        </TableContainer>
      </Card>
    </Box>
  );
}
