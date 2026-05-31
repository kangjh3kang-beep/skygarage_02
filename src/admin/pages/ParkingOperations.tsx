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
import Skeleton from '@mui/material/Skeleton';
import Chip from '@mui/material/Chip';
import MenuItem from '@mui/material/MenuItem';
import TextField from '@mui/material/TextField';
import Tabs from '@mui/material/Tabs';
import Tab from '@mui/material/Tab';
import Button from '@mui/material/Button';
import LinearProgress from '@mui/material/LinearProgress';
import Tooltip from '@mui/material/Tooltip';
import AccessibleIcon from '@mui/icons-material/Accessible';
import { supabase } from '../../lib/supabase';
import { useNavigate } from 'react-router-dom';
import { useDocumentTitle } from '../../hooks/useDocumentTitle';
import { useToast } from '../contexts/ToastContext';
import { useAuditLog } from '../../hooks/useAuditLog';
import { useTenant } from '../contexts/TenantContext';

interface ParkingSession {
  id: string;
  complex_id: string;
  vehicle_number: string;
  slot_id: string;
  entry_at: string;
  exit_at: string | null;
  status: string;
  fee: number;
  floor: number;
  is_ev: boolean;
  operating_mode?: string;
  priority_score?: number;
  is_priority_dispatch?: boolean;
}

interface ModeDistribution {
  direct: number;
  valet: number;
  tower: number;
  hybrid: number;
}

const MODE_LABELS: Record<string, { label: string; color: 'primary' | 'secondary' | 'warning' | 'success' }> = {
  direct: { label: '직접 주차', color: 'primary' },
  valet: { label: '발렛', color: 'secondary' },
  tower: { label: '주차 타워', color: 'warning' },
  hybrid: { label: '하이브리드', color: 'success' },
};

export default function ParkingOperations() {
  useDocumentTitle('주차 운영');
  const { showToast } = useToast();
  const { logAction } = useAuditLog();
  const { complexes } = useTenant();
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [sessions, setSessions] = useState<ParkingSession[]>([]);
  const [tab, setTab] = useState(0);
  const [complexFilter, setComplexFilter] = useState('all');
  const [modeFilter, setModeFilter] = useState('all');
  const [modeDistribution, setModeDistribution] = useState<ModeDistribution>({ direct: 0, valet: 0, tower: 0, hybrid: 0 });

  const loadData = useCallback(async () => {
    let query = supabase.from('parking_sessions').select('*').order('entry_at', { ascending: false }).limit(200);
    if (complexFilter !== 'all') query = query.eq('complex_id', complexFilter);
    if (modeFilter !== 'all') query = query.eq('operating_mode', modeFilter);
    const { data } = await query;
    if (data) {
      setSessions(data);
      const dist: ModeDistribution = { direct: 0, valet: 0, tower: 0, hybrid: 0 };
      for (const s of data) {
        const mode = (s.operating_mode || 'direct') as keyof ModeDistribution;
        if (mode in dist) dist[mode]++;
      }
      setModeDistribution(dist);
    }
    setLoading(false);
  }, [complexFilter, modeFilter]);

  useEffect(() => { loadData(); }, [loadData]);

  useEffect(() => {
    const channel = supabase.channel('parking-rt')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'parking_sessions' }, () => { loadData(); })
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [loadData]);

  const handleForceExit = useCallback(async (session: ParkingSession) => {
    const { error } = await supabase.from('parking_sessions').update({ exit_at: new Date().toISOString(), status: 'completed' }).eq('id', session.id);
    if (error) { showToast('강제 출차 실패', 'error'); return; }
    logAction('UPDATE', 'parking_sessions', session.id, { action: 'force_exit' });
    showToast('강제 출차 처리 완료', 'success');
    loadData();
  }, [showToast, logAction, loadData]);

  const active = sessions.filter(s => !s.exit_at);
  const completed = sessions.filter(s => !!s.exit_at);
  const prioritySessions = active.filter(s => s.is_priority_dispatch);
  const displayed = tab === 0 ? active : completed;
  const totalModes = modeDistribution.direct + modeDistribution.valet + modeDistribution.tower + modeDistribution.hybrid;

  if (loading) return (
    <Box>
      <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 3 }}>
        <Skeleton variant="text" width={160} height={36} />
        <Box sx={{ display: 'flex', gap: 1 }}>
          <Skeleton variant="rectangular" width={80} height={32} sx={{ borderRadius: 1 }} />
          <Skeleton variant="rectangular" width={80} height={32} sx={{ borderRadius: 1 }} />
        </Box>
      </Box>
      <Grid container spacing={2} sx={{ mb: 3 }}>
        {[1, 2, 3, 4].map(i => <Grid size={{ xs: 6, md: 3 }} key={i}><Skeleton variant="rectangular" height={72} sx={{ borderRadius: 1 }} /></Grid>)}
      </Grid>
      <Skeleton variant="rectangular" height={300} sx={{ borderRadius: 1 }} />
    </Box>
  );

  return (
    <Box>
      <Box sx={{ mb: 3, display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 1 }}>
        <Typography variant="h1">주차 운영</Typography>
        <Box sx={{ display: 'flex', gap: 1, flexWrap: 'wrap' }}>
          <Button variant="outlined" size="small" onClick={() => navigate('/admin/ai-management')}>AI 관리</Button>
          <Button variant="outlined" size="small" onClick={() => navigate('/admin/workflows')}>워크플로우</Button>
          <Button variant="outlined" size="small" onClick={() => navigate('/admin/complexes')}>단지 관리</Button>
          <Button variant="outlined" size="small" onClick={() => navigate('/admin/residents')}>사용자</Button>
          <Button variant="outlined" size="small" onClick={() => navigate('/admin/energy')}>에너지</Button>
          <Button variant="contained" size="small" color="warning" startIcon={<AccessibleIcon />} onClick={() => navigate('/admin/priority-dispatch')}>우선배차</Button>
        </Box>
      </Box>

      <Grid container spacing={2} sx={{ mb: 3 }}>
        <Grid size={{ xs: 6, md: 3 }}>
          <Card><CardContent sx={{ textAlign: 'center' }}>
            <Typography variant="caption" color="text.secondary">현재 주차중</Typography>
            <Typography variant="h2" color="primary">{active.length}</Typography>
          </CardContent></Card>
        </Grid>
        <Grid size={{ xs: 6, md: 3 }}>
          <Card><CardContent sx={{ textAlign: 'center' }}>
            <Typography variant="caption" color="text.secondary">오늘 완료</Typography>
            <Typography variant="h2">{completed.filter(s => s.exit_at && new Date(s.exit_at).toDateString() === new Date().toDateString()).length}</Typography>
          </CardContent></Card>
        </Grid>
        <Grid size={{ xs: 6, md: 3 }}>
          <Card><CardContent sx={{ textAlign: 'center' }}>
            <Typography variant="caption" color="text.secondary">EV 충전중</Typography>
            <Typography variant="h2" color="success.main">{active.filter(s => s.is_ev).length}</Typography>
          </CardContent></Card>
        </Grid>
        <Grid size={{ xs: 6, md: 3 }}>
          <Card sx={{ border: prioritySessions.length > 0 ? 2 : 0, borderColor: 'warning.main' }}>
            <CardContent sx={{ textAlign: 'center' }}>
              <Typography variant="caption" color="text.secondary">우선배차 대기</Typography>
              <Typography variant="h2" color="warning.main">{prioritySessions.length}</Typography>
            </CardContent>
          </Card>
        </Grid>
      </Grid>

      {/* Operating Mode Distribution */}
      <Card sx={{ mb: 3 }}>
        <CardContent sx={{ p: 2.5 }}>
          <Typography variant="subtitle2" sx={{ mb: 2 }}>운영 모드 분포</Typography>
          <Grid container spacing={2}>
            {(Object.entries(MODE_LABELS) as [string, { label: string; color: 'primary' | 'secondary' | 'warning' | 'success' }][]).map(([mode, config]) => {
              const count = modeDistribution[mode as keyof ModeDistribution];
              const pct = totalModes > 0 ? Math.round((count / totalModes) * 100) : 0;
              return (
                <Grid size={{ xs: 6, md: 3 }} key={mode}>
                  <Box sx={{ p: 1.5, border: 1, borderColor: 'divider', borderRadius: 1.5 }}>
                    <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 0.5 }}>
                      <Chip label={config.label} size="small" color={config.color} variant="outlined" />
                      <Typography variant="caption" sx={{ fontWeight: 700 }}>{count}건</Typography>
                    </Box>
                    <LinearProgress
                      variant="determinate"
                      value={pct}
                      color={config.color}
                      sx={{ height: 6, borderRadius: 1 }}
                    />
                    <Typography variant="caption" color="text.secondary" sx={{ mt: 0.5, display: 'block' }}>{pct}%</Typography>
                  </Box>
                </Grid>
              );
            })}
          </Grid>
        </CardContent>
      </Card>

      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2, flexWrap: 'wrap', gap: 1 }}>
        <Tabs value={tab} onChange={(_, v) => setTab(v)}>
          <Tab label={`주차중 (${active.length})`} />
          <Tab label={`완료 (${completed.length})`} />
        </Tabs>
        <Box sx={{ display: 'flex', gap: 1 }}>
          <TextField select size="small" value={modeFilter} onChange={e => setModeFilter(e.target.value)} sx={{ width: 140 }}>
            <MenuItem value="all">전체 모드</MenuItem>
            <MenuItem value="direct">직접 주차</MenuItem>
            <MenuItem value="valet">발렛</MenuItem>
            <MenuItem value="tower">주차 타워</MenuItem>
            <MenuItem value="hybrid">하이브리드</MenuItem>
          </TextField>
          <TextField select size="small" value={complexFilter} onChange={e => setComplexFilter(e.target.value)} sx={{ width: 200 }}>
            <MenuItem value="all">전체 단지</MenuItem>
            {complexes.map(c => <MenuItem key={c.id} value={c.id}>{c.name}</MenuItem>)}
          </TextField>
        </Box>
      </Box>

      <Card>
        <TableContainer>
          <Table size="small">
            <TableHead><TableRow>
              <TableCell>차량번호</TableCell>
              <TableCell>우선</TableCell>
              <TableCell>운영 모드</TableCell>
              <TableCell>주차면</TableCell>
              <TableCell>입차시간</TableCell>
              <TableCell>출차시간</TableCell>
              <TableCell>상태</TableCell>
              <TableCell>요금</TableCell>
              {tab === 0 && <TableCell align="center">관리</TableCell>}
            </TableRow></TableHead>
            <TableBody>
              {displayed.map(s => {
                const mode = s.operating_mode || 'direct';
                const modeConfig = MODE_LABELS[mode] || MODE_LABELS.direct;
                return (
                  <TableRow key={s.id} hover sx={s.is_priority_dispatch ? { bgcolor: 'rgba(237, 108, 2, 0.04)' } : undefined}>
                    <TableCell><Typography variant="body2" sx={{ fontWeight: 600 }}>{s.vehicle_number}</Typography></TableCell>
                    <TableCell>
                      {s.is_priority_dispatch ? (
                        <Tooltip title={`우선점수: ${s.priority_score}`}>
                          <Chip icon={<AccessibleIcon />} label={s.priority_score} size="small" color="warning" sx={{ height: 22 }} />
                        </Tooltip>
                      ) : '-'}
                    </TableCell>
                    <TableCell><Chip label={modeConfig.label} size="small" color={modeConfig.color} variant="outlined" /></TableCell>
                    <TableCell>{s.slot_id || '-'}</TableCell>
                    <TableCell><Typography variant="caption">{s.entry_at ? new Date(s.entry_at).toLocaleString('ko-KR') : '-'}</Typography></TableCell>
                    <TableCell><Typography variant="caption">{s.exit_at ? new Date(s.exit_at).toLocaleString('ko-KR') : '-'}</Typography></TableCell>
                    <TableCell><Chip label={s.status || 'active'} size="small" color={s.status === 'active' ? 'success' : 'default'} /></TableCell>
                    <TableCell>{s.fee ? `${s.fee.toLocaleString()}원` : '-'}</TableCell>
                    {tab === 0 && (
                      <TableCell align="center">
                        <Chip label="강제출차" size="small" color="warning" onClick={() => handleForceExit(s)} sx={{ cursor: 'pointer' }} />
                      </TableCell>
                    )}
                  </TableRow>
                );
              })}
              {displayed.length === 0 && (
                <TableRow><TableCell colSpan={9} align="center"><Typography variant="body2" color="text.secondary" sx={{ py: 4 }}>데이터가 없습니다.</Typography></TableCell></TableRow>
              )}
            </TableBody>
          </Table>
        </TableContainer>
      </Card>
    </Box>
  );
}
