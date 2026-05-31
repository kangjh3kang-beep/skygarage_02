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
import MonitorHeartIcon from '@mui/icons-material/MonitorHeart';
import Button from '@mui/material/Button';
import { supabase } from '../../lib/supabase';
import { useNavigate } from 'react-router-dom';
import { useDocumentTitle } from '../../hooks/useDocumentTitle';
import { useAuditLog } from '../../hooks/useAuditLog';

interface ObservabilityMetric {
  id: string;
  metric_name: string;
  tier: string;
  source: string;
  complex_id: string;
  value: number;
  unit: string;
  labels: Record<string, unknown>;
  recorded_at: string;
}

export default function ObservabilityDashboard() {
  useDocumentTitle('관측성 대시보드');
  const { logAction } = useAuditLog();
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [metrics, setMetrics] = useState<ObservabilityMetric[]>([]);
  const [search, setSearch] = useState('');
  const [tierFilter, setTierFilter] = useState('all');
  const [sourceFilter, setSourceFilter] = useState('all');
  const [metricNameFilter, setMetricNameFilter] = useState('all');

  const loadData = useCallback(async () => {
    let query = supabase
      .from('observability_metrics')
      .select('*')
      .order('recorded_at', { ascending: false })
      .limit(200);
    if (tierFilter !== 'all') query = query.eq('tier', tierFilter);
    if (sourceFilter !== 'all') query = query.eq('source', sourceFilter);
    if (metricNameFilter !== 'all') query = query.eq('metric_name', metricNameFilter);
    const { data } = await query;
    if (data) setMetrics(data);
    setLoading(false);
  }, [tierFilter, sourceFilter, metricNameFilter]);

  useEffect(() => { loadData(); }, [loadData]);

  useEffect(() => {
    const channel = supabase.channel('observability-rt')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'observability_metrics' }, () => { loadData(); })
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [loadData]);

  // Log that the admin viewed the observability dashboard
  useEffect(() => {
    logAction('VIEW', 'observability_metrics', undefined, { page: 'ObservabilityDashboard' });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const collectMetrics = async () => {
    const apiUrl = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/workflow-engine?action=collect-metrics`;
    await fetch(apiUrl, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${import.meta.env.VITE_SUPABASE_ANON_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({}),
    });
    loadData();
  };

  const tiers = [...new Set(metrics.map(m => m.tier).filter(Boolean))];
  const sources = [...new Set(metrics.map(m => m.source).filter(Boolean))];
  const metricNames = [...new Set(metrics.map(m => m.metric_name).filter(Boolean))];

  const filtered = metrics.filter(m =>
    !search ||
    m.metric_name?.toLowerCase().includes(search.toLowerCase()) ||
    m.source?.toLowerCase().includes(search.toLowerCase())
  );

  const todayCount = metrics.filter(
    m => m.recorded_at && new Date(m.recorded_at).toDateString() === new Date().toDateString()
  ).length;
  const uniqueSources = sources.length;
  const avgValue = metrics.length > 0
    ? (metrics.reduce((sum, m) => sum + (m.value || 0), 0) / metrics.length)
    : 0;

  if (loading) return <Box sx={{ display: 'flex', justifyContent: 'center', py: 10 }}><CircularProgress /></Box>;

  return (
    <Box>
      <Box sx={{ mb: 3, display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 1 }}>
        <Typography variant="h1">관측성 대시보드</Typography>
        <Box sx={{ display: 'flex', gap: 1, flexWrap: 'wrap' }}>
          <Button variant="contained" size="small" startIcon={<MonitorHeartIcon />} onClick={collectMetrics}>메트릭 수집</Button>
          <Button variant="outlined" size="small" onClick={() => navigate('/admin/ai-management')}>AI 관리</Button>
          <Button variant="outlined" size="small" onClick={() => navigate('/admin/workflows')}>워크플로우</Button>
          <Button variant="outlined" size="small" onClick={() => navigate('/admin/noc')}>NOC</Button>
          <Button variant="outlined" size="small" onClick={() => navigate('/admin/alerts')}>알림 센터</Button>
        </Box>
      </Box>

      <Grid container spacing={2} sx={{ mb: 3 }}>
        <Grid size={{ xs: 6, md: 3 }}>
          <Card><CardContent sx={{ textAlign: 'center' }}>
            <MonitorHeartIcon color="primary" />
            <Typography variant="caption" color="text.secondary">전체 메트릭</Typography>
            <Typography variant="h2">{metrics.length}</Typography>
          </CardContent></Card>
        </Grid>
        <Grid size={{ xs: 6, md: 3 }}>
          <Card><CardContent sx={{ textAlign: 'center' }}>
            <Typography variant="caption" color="text.secondary">고유 소스</Typography>
            <Typography variant="h2">{uniqueSources}</Typography>
          </CardContent></Card>
        </Grid>
        <Grid size={{ xs: 6, md: 3 }}>
          <Card><CardContent sx={{ textAlign: 'center' }}>
            <Typography variant="caption" color="text.secondary">오늘 메트릭</Typography>
            <Typography variant="h2">{todayCount}</Typography>
          </CardContent></Card>
        </Grid>
        <Grid size={{ xs: 6, md: 3 }}>
          <Card><CardContent sx={{ textAlign: 'center' }}>
            <Typography variant="caption" color="text.secondary">평균 값</Typography>
            <Typography variant="h2">{avgValue.toFixed(2)}</Typography>
          </CardContent></Card>
        </Grid>
      </Grid>

      <Box sx={{ display: 'flex', gap: 2, mb: 2, flexWrap: 'wrap' }}>
        <TextField
          size="small"
          placeholder="검색 (메트릭명, 소스)"
          value={search}
          onChange={e => setSearch(e.target.value)}
          sx={{ width: 280 }}
          slotProps={{ input: { startAdornment: <InputAdornment position="start"><SearchIcon fontSize="small" /></InputAdornment> } }}
        />
        <TextField select size="small" value={tierFilter} onChange={e => setTierFilter(e.target.value)} sx={{ width: 160 }}>
          <MenuItem value="all">전체 계층</MenuItem>
          {tiers.map(t => <MenuItem key={t} value={t}>{t}</MenuItem>)}
        </TextField>
        <TextField select size="small" value={sourceFilter} onChange={e => setSourceFilter(e.target.value)} sx={{ width: 180 }}>
          <MenuItem value="all">전체 소스</MenuItem>
          {sources.map(s => <MenuItem key={s} value={s}>{s}</MenuItem>)}
        </TextField>
        <TextField select size="small" value={metricNameFilter} onChange={e => setMetricNameFilter(e.target.value)} sx={{ width: 200 }}>
          <MenuItem value="all">전체 메트릭</MenuItem>
          {metricNames.map(n => <MenuItem key={n} value={n}>{n}</MenuItem>)}
        </TextField>
      </Box>

      <Card>
        <TableContainer>
          <Table size="small">
            <TableHead>
              <TableRow>
                <TableCell>메트릭명</TableCell>
                <TableCell>계층</TableCell>
                <TableCell>소스</TableCell>
                <TableCell align="right">값</TableCell>
                <TableCell>단위</TableCell>
                <TableCell>라벨</TableCell>
                <TableCell>기록 시간</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {filtered.map(m => (
                <TableRow key={m.id} hover>
                  <TableCell>
                    <Chip label={m.metric_name} size="small" variant="outlined" />
                  </TableCell>
                  <TableCell>
                    <Typography variant="caption">{m.tier || '-'}</Typography>
                  </TableCell>
                  <TableCell>
                    <Typography variant="caption" sx={{ fontFamily: 'monospace' }}>{m.source || '-'}</Typography>
                  </TableCell>
                  <TableCell align="right">
                    <Typography variant="body2" sx={{ fontWeight: 600 }}>{m.value?.toLocaleString()}</Typography>
                  </TableCell>
                  <TableCell>
                    <Typography variant="caption">{m.unit || '-'}</Typography>
                  </TableCell>
                  <TableCell>
                    <Typography variant="caption" sx={{ maxWidth: 200, display: 'block', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', fontFamily: 'monospace' }}>
                      {m.labels ? JSON.stringify(m.labels) : '-'}
                    </Typography>
                  </TableCell>
                  <TableCell>
                    <Typography variant="caption">{m.recorded_at ? new Date(m.recorded_at).toLocaleString('ko-KR') : '-'}</Typography>
                  </TableCell>
                </TableRow>
              ))}
              {filtered.length === 0 && (
                <TableRow>
                  <TableCell colSpan={7} align="center">
                    <Typography variant="body2" color="text.secondary" sx={{ py: 4 }}>메트릭이 없습니다.</Typography>
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
