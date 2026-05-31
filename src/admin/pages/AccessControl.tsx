import { useState, useEffect, useCallback, useMemo } from 'react';
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
import LoginIcon from '@mui/icons-material/Login';
import LogoutIcon from '@mui/icons-material/Logout';
import BlockIcon from '@mui/icons-material/Block';
import DirectionsCarIcon from '@mui/icons-material/DirectionsCar';
import Button from '@mui/material/Button';
import { supabase } from '../../lib/supabase';
import { useNavigate } from 'react-router-dom';
import { useDocumentTitle } from '../../hooks/useDocumentTitle';
import { useAuditLog } from '../../hooks/useAuditLog';

interface AccessLog {
  id: string;
  complex_id: string;
  resident_id: string | null;
  card_id: string | null;
  plate_number: string | null;
  gate_id: string | null;
  direction: 'entry' | 'exit';
  auth_method: string | null;
  status: 'granted' | 'denied';
  deny_reason: string | null;
  timestamp: string;
  created_at: string;
}

const directionLabels: Record<string, string> = { entry: '입차', exit: '출차' };
const statusLabels: Record<string, string> = { granted: '허용', denied: '거부' };
const authMethodLabels: Record<string, string> = {
  card: 'RF카드',
  plate: '차량번호',
  remote: '원격개방',
  manual: '수동개방',
  qr: 'QR코드',
};

export default function AccessControl() {
  useDocumentTitle('출입 관리');
  const { logAction } = useAuditLog();
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [logs, setLogs] = useState<AccessLog[]>([]);
  const [search, setSearch] = useState('');
  const [directionFilter, setDirectionFilter] = useState('all');
  const [statusFilter, setStatusFilter] = useState('all');
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');

  const loadData = useCallback(async () => {
    let query = supabase
      .from('access_logs')
      .select('*')
      .order('timestamp', { ascending: false })
      .limit(500);
    if (directionFilter !== 'all') query = query.eq('direction', directionFilter);
    if (statusFilter !== 'all') query = query.eq('status', statusFilter);
    if (dateFrom) query = query.gte('timestamp', `${dateFrom}T00:00:00`);
    if (dateTo) query = query.lte('timestamp', `${dateTo}T23:59:59`);
    const { data } = await query;
    if (data) setLogs(data);
    setLoading(false);
  }, [directionFilter, statusFilter, dateFrom, dateTo]);

  useEffect(() => { loadData(); }, [loadData]);

  // Real-time subscription for new access events
  useEffect(() => {
    const channel = supabase.channel('access-logs-rt')
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'access_logs' }, () => { loadData(); })
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [loadData]);

  // Log that the admin viewed the access logs
  useEffect(() => {
    logAction('VIEW', 'access_logs', undefined, { page: 'AccessControl' });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const filtered = useMemo(() =>
    logs.filter(l =>
      !search ||
      l.plate_number?.includes(search) ||
      l.card_id?.includes(search) ||
      l.gate_id?.includes(search) ||
      l.deny_reason?.includes(search)
    ),
    [logs, search]
  );

  const todayStr = new Date().toDateString();

  const todayEntries = useMemo(
    () => logs.filter(l => l.direction === 'entry' && new Date(l.timestamp).toDateString() === todayStr).length,
    [logs, todayStr]
  );

  const deniedCount = useMemo(
    () => logs.filter(l => l.status === 'denied').length,
    [logs]
  );

  const uniqueVehicles = useMemo(
    () => new Set(logs.map(l => l.plate_number).filter(Boolean)).size,
    [logs]
  );

  const todayTotal = useMemo(
    () => logs.filter(l => new Date(l.timestamp).toDateString() === todayStr).length,
    [logs, todayStr]
  );

  if (loading) return <Box sx={{ display: 'flex', justifyContent: 'center', py: 10 }}><CircularProgress /></Box>;

  return (
    <Box>
      <Box sx={{ mb: 3, display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 1 }}>
        <Typography variant="h1">출입 관리</Typography>
        <Box sx={{ display: 'flex', gap: 1 }}>
          <Button variant="outlined" size="small" onClick={() => navigate('/admin/security')}>보안 감사</Button>
          <Button variant="outlined" size="small" onClick={() => navigate('/admin/residents')}>사용자</Button>
          <Button variant="outlined" size="small" onClick={() => navigate('/admin/parking')}>주차 운영</Button>
        </Box>
      </Box>

      {/* Summary cards */}
      <Grid container spacing={2} sx={{ mb: 3 }}>
        <Grid size={{ xs: 6, md: 3 }}>
          <Card>
            <CardContent sx={{ textAlign: 'center' }}>
              <LoginIcon color="primary" />
              <Typography variant="caption" color="text.secondary">오늘 입차</Typography>
              <Typography variant="h2" color="primary">{todayEntries}</Typography>
            </CardContent>
          </Card>
        </Grid>
        <Grid size={{ xs: 6, md: 3 }}>
          <Card>
            <CardContent sx={{ textAlign: 'center' }}>
              <BlockIcon color="error" />
              <Typography variant="caption" color="text.secondary">거부 시도</Typography>
              <Typography variant="h2" color="error">{deniedCount}</Typography>
            </CardContent>
          </Card>
        </Grid>
        <Grid size={{ xs: 6, md: 3 }}>
          <Card>
            <CardContent sx={{ textAlign: 'center' }}>
              <DirectionsCarIcon color="info" />
              <Typography variant="caption" color="text.secondary">고유 차량</Typography>
              <Typography variant="h2" color="info.main">{uniqueVehicles}</Typography>
            </CardContent>
          </Card>
        </Grid>
        <Grid size={{ xs: 6, md: 3 }}>
          <Card>
            <CardContent sx={{ textAlign: 'center' }}>
              <Typography variant="caption" color="text.secondary">오늘 전체</Typography>
              <Typography variant="h2">{todayTotal}</Typography>
            </CardContent>
          </Card>
        </Grid>
      </Grid>

      {/* Filters */}
      <Box sx={{ display: 'flex', gap: 2, mb: 2, flexWrap: 'wrap' }}>
        <TextField
          size="small"
          placeholder="검색 (차량번호, 카드 ID, 게이트)"
          value={search}
          onChange={e => setSearch(e.target.value)}
          sx={{ width: 300 }}
          slotProps={{ input: { startAdornment: <InputAdornment position="start"><SearchIcon fontSize="small" /></InputAdornment> } }}
        />
        <TextField select size="small" label="출입 방향" value={directionFilter} onChange={e => setDirectionFilter(e.target.value)} sx={{ width: 140 }}>
          <MenuItem value="all">전체</MenuItem>
          <MenuItem value="entry">입차</MenuItem>
          <MenuItem value="exit">출차</MenuItem>
        </TextField>
        <TextField select size="small" label="상태" value={statusFilter} onChange={e => setStatusFilter(e.target.value)} sx={{ width: 140 }}>
          <MenuItem value="all">전체</MenuItem>
          <MenuItem value="granted">허용</MenuItem>
          <MenuItem value="denied">거부</MenuItem>
        </TextField>
        <TextField
          size="small"
          label="시작일"
          type="date"
          value={dateFrom}
          onChange={e => setDateFrom(e.target.value)}
          sx={{ width: 160 }}
          slotProps={{ inputLabel: { shrink: true } }}
        />
        <TextField
          size="small"
          label="종료일"
          type="date"
          value={dateTo}
          onChange={e => setDateTo(e.target.value)}
          sx={{ width: 160 }}
          slotProps={{ inputLabel: { shrink: true } }}
        />
      </Box>

      {/* Access log table */}
      <Card>
        <TableContainer>
          <Table size="small">
            <TableHead>
              <TableRow>
                <TableCell>시간</TableCell>
                <TableCell>출입 방향</TableCell>
                <TableCell>차량번호</TableCell>
                <TableCell>게이트</TableCell>
                <TableCell>인증방법</TableCell>
                <TableCell>상태</TableCell>
                <TableCell>거부 사유</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {filtered.map(l => (
                <TableRow key={l.id} hover sx={{ bgcolor: l.status === 'denied' ? 'error.50' : undefined }}>
                  <TableCell>
                    <Typography variant="caption">
                      {l.timestamp ? new Date(l.timestamp).toLocaleString('ko-KR') : '-'}
                    </Typography>
                  </TableCell>
                  <TableCell>
                    <Chip
                      icon={l.direction === 'entry' ? <LoginIcon fontSize="small" /> : <LogoutIcon fontSize="small" />}
                      label={directionLabels[l.direction] || l.direction}
                      size="small"
                      color={l.direction === 'entry' ? 'primary' : 'default'}
                    />
                  </TableCell>
                  <TableCell>
                    <Typography variant="body2" sx={{ fontWeight: 600 }}>
                      {l.plate_number || '-'}
                    </Typography>
                  </TableCell>
                  <TableCell>
                    <Typography variant="caption" sx={{ fontFamily: 'monospace' }}>
                      {l.gate_id || '-'}
                    </Typography>
                  </TableCell>
                  <TableCell>
                    <Typography variant="caption">
                      {l.auth_method ? (authMethodLabels[l.auth_method] || l.auth_method) : '-'}
                    </Typography>
                  </TableCell>
                  <TableCell>
                    <Chip
                      label={statusLabels[l.status] || l.status}
                      size="small"
                      color={l.status === 'granted' ? 'success' : 'error'}
                    />
                  </TableCell>
                  <TableCell>
                    <Typography variant="caption" color={l.deny_reason ? 'error' : 'text.secondary'}>
                      {l.deny_reason || '-'}
                    </Typography>
                  </TableCell>
                </TableRow>
              ))}
              {filtered.length === 0 && (
                <TableRow>
                  <TableCell colSpan={7} align="center">
                    <Typography variant="body2" color="text.secondary" sx={{ py: 4 }}>
                      출입 기록이 없습니다.
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
