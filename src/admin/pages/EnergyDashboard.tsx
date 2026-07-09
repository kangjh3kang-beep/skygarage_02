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
import LinearProgress from '@mui/material/LinearProgress';
import Button from '@mui/material/Button';
import BoltIcon from '@mui/icons-material/Bolt';
import List from '@mui/material/List';
import ListItemButton from '@mui/material/ListItemButton';
import ListItemText from '@mui/material/ListItemText';
import { supabase } from '../../lib/supabase';
import { useNavigate } from 'react-router-dom';
import { useDocumentTitle } from '../../hooks/useDocumentTitle';
import { useToast } from '../contexts/ToastContext';
import { useAuditLog } from '../../hooks/useAuditLog';

interface EnergyMetric {
  id: string;
  complex_id: string;
  date: string;
  total_consumption_kwh: number;
  solar_generation_kwh: number;
  regen_recovery_kwh: number;
  ev_charging_kwh: number;
  grid_import_kwh: number;
  grid_export_kwh: number;
  peak_demand_kw: number;
  carbon_saved_kg: number;
  cost_savings_krw: number;
  created_at: string;
}

export default function EnergyDashboard() {
  useDocumentTitle('에너지 대시보드');
  const { showToast } = useToast();
  const { logAction } = useAuditLog();
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [metrics, setMetrics] = useState<EnergyMetric[]>([]);
  const [aiRecs, setAiRecs] = useState<{ id: string; title: string; priority: string; type: string }[]>([]);

  const loadData = useCallback(async () => {
    const [metricsRes, recsRes] = await Promise.all([
      supabase.from('energy_metrics').select('*').order('date', { ascending: false }).limit(200),
      supabase.from('ai_recommendations').select('id, title, priority, type')
        .in('status', ['pending', 'acknowledged'])
        .eq('entity_type', 'energy')
        .order('created_at', { ascending: false }).limit(5),
    ]);
    if (metricsRes.data) setMetrics(metricsRes.data);
    if (recsRes.data) setAiRecs(recsRes.data);
    setLoading(false);
  }, []);

  useEffect(() => { loadData(); }, [loadData]);

  useEffect(() => {
    const channel = supabase.channel('energy-rt')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'energy_metrics' }, () => { loadData(); })
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [loadData]);

  const handleDeleteOld = useCallback(async () => {
    const cutoff = new Date();
    cutoff.setDate(cutoff.getDate() - 90);
    const { error, count } = await supabase.from('energy_metrics').delete().lt('date', cutoff.toISOString().split('T')[0]);
    if (error) { showToast('삭제 실패', 'error'); return; }
    logAction('DELETE', 'energy_metrics', undefined, { action: 'purge_old', cutoff_days: 90, count });
    showToast('90일 이전 데이터 삭제 완료', 'success');
    loadData();
  }, [showToast, logAction, loadData]);

  const totalConsumption = metrics.reduce((s, m) => s + (m.total_consumption_kwh || 0), 0);
  const totalSolar = metrics.reduce((s, m) => s + (m.solar_generation_kwh || 0), 0);
  const totalCarbonSaved = metrics.reduce((s, m) => s + (m.carbon_saved_kg || 0), 0);
  const totalCostSaved = metrics.reduce((s, m) => s + (m.cost_savings_krw || 0), 0);
  const maxConsumption = Math.max(...metrics.map(m => m.total_consumption_kwh || 0), 1);

  if (loading) return <Box sx={{ display: 'flex', justifyContent: 'center', py: 10 }}><CircularProgress /></Box>;

  return (
    <Box>
      <Box sx={{ mb: 3, display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 1 }}>
        <Typography variant="h1">에너지 대시보드</Typography>
        <Box sx={{ display: 'flex', gap: 1, flexWrap: 'wrap' }}>
          <Button variant="outlined" size="small" onClick={() => navigate('/admin/ai-management')}>AI 관리</Button>
          <Button variant="outlined" size="small" onClick={() => navigate('/admin/workflows')}>워크플로우</Button>
          <Button variant="outlined" size="small" onClick={() => navigate('/admin/observability')}>관측성</Button>
          <Button variant="outlined" size="small" onClick={() => navigate('/admin/v2g')}>V2G 관리</Button>
          <Button variant="outlined" size="small" onClick={() => navigate('/admin/esg')}>ESG</Button>
        </Box>
      </Box>
      <Grid container spacing={2} sx={{ mb: 3 }}>
        <Grid size={{ xs: 6, md: 3 }}>
          <Card><CardContent sx={{ textAlign: 'center' }}>
            <BoltIcon color="warning" />
            <Typography variant="caption" color="text.secondary">총 소비량</Typography>
            <Typography variant="h2">{totalConsumption.toLocaleString()} kWh</Typography>
          </CardContent></Card>
        </Grid>
        <Grid size={{ xs: 6, md: 3 }}>
          <Card><CardContent sx={{ textAlign: 'center' }}>
            <Typography variant="caption" color="text.secondary">태양광 발전</Typography>
            <Typography variant="h2" color="success.main">{totalSolar.toLocaleString()} kWh</Typography>
          </CardContent></Card>
        </Grid>
        <Grid size={{ xs: 6, md: 3 }}>
          <Card><CardContent sx={{ textAlign: 'center' }}>
            <Typography variant="caption" color="text.secondary">탄소 절감</Typography>
            <Typography variant="h2">{totalCarbonSaved.toLocaleString()} kg</Typography>
          </CardContent></Card>
        </Grid>
        <Grid size={{ xs: 6, md: 3 }}>
          <Card><CardContent sx={{ textAlign: 'center' }}>
            <Typography variant="caption" color="text.secondary">비용 절감</Typography>
            <Typography variant="h2">{(totalCostSaved / 10000).toFixed(0)}만원</Typography>
          </CardContent></Card>
        </Grid>
      </Grid>

      <Box sx={{ display: 'flex', justifyContent: 'flex-end', mb: 2 }}>
        <Button size="small" color="error" variant="outlined" onClick={handleDeleteOld}>90일 이전 정리</Button>
      </Box>

      <Card sx={{ mb: 3 }}>
        <CardContent>
          <Typography variant="subtitle2" sx={{ mb: 2 }}>일별 에너지 소비 추이</Typography>
          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 0.5 }}>
            {metrics.slice(0, 15).map(m => (
              <Box key={m.id} sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                <Typography variant="caption" sx={{ width: 90, flexShrink: 0 }}>{m.date}</Typography>
                <LinearProgress variant="determinate" value={(m.total_consumption_kwh / maxConsumption) * 100} sx={{ flex: 1, height: 12, borderRadius: 6 }} color={m.total_consumption_kwh / maxConsumption > 0.8 ? 'error' : 'primary'} />
                <Typography variant="caption" sx={{ width: 90, textAlign: 'right' }}>{m.total_consumption_kwh} kWh</Typography>
              </Box>
            ))}
          </Box>
        </CardContent>
      </Card>

      {aiRecs.length > 0 && (
        <Card sx={{ mb: 3 }}>
          <CardContent sx={{ p: 2 }}>
            <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 1 }}>
              <Typography variant="subtitle2">AI 에너지 최적화 권장사항</Typography>
              <Button variant="text" size="small" onClick={() => navigate('/admin/ai-management')}>전체 보기</Button>
            </Box>
            <List disablePadding dense>
              {aiRecs.map(rec => (
                <ListItemButton key={rec.id} onClick={() => navigate('/admin/ai-management')} sx={{ borderRadius: 1, py: 0.5 }}>
                  <ListItemText primary={rec.title} slotProps={{ primary: { sx: { fontSize: '0.8rem', fontWeight: 500 } } }} />
                  <Chip label={rec.priority} size="small" color={rec.priority === 'high' ? 'error' : rec.priority === 'medium' ? 'warning' : 'default'} variant="outlined" sx={{ fontSize: '0.65rem', height: 20 }} />
                </ListItemButton>
              ))}
            </List>
          </CardContent>
        </Card>
      )}

      <Card>
        <TableContainer>
          <Table size="small">
            <TableHead><TableRow>
              <TableCell>날짜</TableCell>
              <TableCell align="right">총소비(kWh)</TableCell>
              <TableCell align="right">태양광(kWh)</TableCell>
              <TableCell align="right">EV충전(kWh)</TableCell>
              <TableCell align="right">피크(kW)</TableCell>
              <TableCell align="right">탄소절감(kg)</TableCell>
            </TableRow></TableHead>
            <TableBody>
              {metrics.map(m => (
                <TableRow key={m.id} hover>
                  <TableCell><Chip label={m.date} size="small" variant="outlined" /></TableCell>
                  <TableCell align="right"><Typography variant="body2" sx={{ fontWeight: 600 }}>{m.total_consumption_kwh?.toLocaleString()}</Typography></TableCell>
                  <TableCell align="right">{m.solar_generation_kwh?.toLocaleString()}</TableCell>
                  <TableCell align="right">{m.ev_charging_kwh?.toLocaleString()}</TableCell>
                  <TableCell align="right">{m.peak_demand_kw?.toLocaleString()}</TableCell>
                  <TableCell align="right">{m.carbon_saved_kg?.toLocaleString()}</TableCell>
                </TableRow>
              ))}
              {metrics.length === 0 && (
                <TableRow><TableCell colSpan={6} align="center"><Typography variant="body2" color="text.secondary" sx={{ py: 4 }}>데이터가 없습니다.</Typography></TableCell></TableRow>
              )}
            </TableBody>
          </Table>
        </TableContainer>
      </Card>
    </Box>
  );
}
