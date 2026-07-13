import { useState, useEffect, useCallback } from 'react';
import Box from '@mui/material/Box';
import Container from '@mui/material/Container';
import Grid from '@mui/material/Grid';
import Typography from '@mui/material/Typography';
import Card from '@mui/material/Card';
import CardContent from '@mui/material/CardContent';
import Chip from '@mui/material/Chip';
import LinearProgress from '@mui/material/LinearProgress';
import Table from '@mui/material/Table';
import TableBody from '@mui/material/TableBody';
import TableCell from '@mui/material/TableCell';
import TableContainer from '@mui/material/TableContainer';
import TableHead from '@mui/material/TableHead';
import TableRow from '@mui/material/TableRow';
import Paper from '@mui/material/Paper';
import Button from '@mui/material/Button';
import Switch from '@mui/material/Switch';
import FormControlLabel from '@mui/material/FormControlLabel';
import IconButton from '@mui/material/IconButton';
import Dialog from '@mui/material/Dialog';
import DialogTitle from '@mui/material/DialogTitle';
import DialogContent from '@mui/material/DialogContent';
import DialogActions from '@mui/material/DialogActions';
import TextField from '@mui/material/TextField';
import Select from '@mui/material/Select';
import MenuItem from '@mui/material/MenuItem';
import FormControl from '@mui/material/FormControl';
import InputLabel from '@mui/material/InputLabel';
import BoltIcon from '@mui/icons-material/Bolt';
import BatteryChargingFullIcon from '@mui/icons-material/BatteryChargingFull';
import TrendingUpIcon from '@mui/icons-material/TrendingUp';
import EvStationIcon from '@mui/icons-material/EvStation';
import Co2Icon from '@mui/icons-material/Co2';
import SolarPowerIcon from '@mui/icons-material/SolarPower';
import ScheduleIcon from '@mui/icons-material/Schedule';
import AddIcon from '@mui/icons-material/Add';
import EditIcon from '@mui/icons-material/Edit';
import DeleteIcon from '@mui/icons-material/Delete';
import RefreshIcon from '@mui/icons-material/Refresh';
import AutoAwesomeIcon from '@mui/icons-material/AutoAwesome';
import List from '@mui/material/List';
import ListItemButton from '@mui/material/ListItemButton';
import ListItemText from '@mui/material/ListItemText';
import { useTheme } from '@mui/material/styles';
import { useNavigate } from 'react-router-dom';
import { supabase } from '../../lib/supabase';
import { useDocumentTitle } from '../../hooks/useDocumentTitle';
import { useTenant } from '../contexts/TenantContext';
import { useToast } from '../contexts/ToastContext';

interface EVSchedule {
  id: string;
  complex_id: string;
  vehicle_id: string;
  plate: string;
  battery_level: number;
  action: string;
  scheduled_time: string;
  energy_kwh: number;
  status: string;
  priority: number;
}

interface PeakHour {
  hour: number;
  demand: number;
  solar: number;
  v2g: number;
}

const EMPTY_FORM = { vehicle_id: '', plate: '', battery_level: 50, action: 'idle', energy_kwh: 10, priority: 0 };

export default function V2GEnergyTrading() {
  useDocumentTitle('V2G Energy Trading');
  const navigate = useNavigate();
  const theme = useTheme();
  const { selectedComplex } = useTenant();
  const { showToast } = useToast();
  const [v2gEnabled, setV2gEnabled] = useState(true);
  const [evSchedules, setEvSchedules] = useState<EVSchedule[]>([]);
  const [peakHours, setPeakHours] = useState<PeakHour[]>([]);
  const [totalSavings, setTotalSavings] = useState(0);
  const [carbonSaved, setCarbonSaved] = useState(0);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<EVSchedule | null>(null);
  const [form, setForm] = useState(EMPTY_FORM);
  const [aiRecs, setAiRecs] = useState<{ id: string; title: string; priority: string; type: string }[]>([]);
  const [generatingRecs, setGeneratingRecs] = useState(false);

  const fetchData = useCallback(async () => {
    let scheduleQuery = supabase.from('ev_charging_schedules').select('*').order('scheduled_time');
    let metricsQuery = supabase.from('energy_metrics').select('*').order('date', { ascending: false }).limit(30);

    if (selectedComplex) {
      scheduleQuery = scheduleQuery.eq('complex_id', selectedComplex);
      metricsQuery = metricsQuery.eq('complex_id', selectedComplex);
    }

    const recsQuery = supabase.from('ai_recommendations').select('id, title, priority, type')
      .in('status', ['pending', 'acknowledged'])
      .eq('entity_type', 'energy')
      .order('created_at', { ascending: false }).limit(5);

    const [schedulesRes, metricsRes, recsRes] = await Promise.all([scheduleQuery, metricsQuery, recsQuery]);

    if (schedulesRes.data) setEvSchedules(schedulesRes.data);
    if (recsRes.data) setAiRecs(recsRes.data);

    if (metricsRes.data) {
      const savings = metricsRes.data.reduce((sum, m) => sum + (m.cost_savings_krw || 0), 0);
      const carbon = metricsRes.data.reduce((sum, m) => sum + (m.carbon_saved_kg || 0), 0);
      setTotalSavings(savings);
      setCarbonSaved(carbon);

      const hours: PeakHour[] = [];
      for (let h = 6; h <= 23; h++) {
        const metricsForHour = metricsRes.data.filter((_, idx) => idx % 18 === (h - 6));
        const avgDemand = metricsForHour.length > 0
          ? metricsForHour.reduce((s, m) => s + (m.grid_import_kwh || 80), 0) / metricsForHour.length
          : 80;
        const avgSolar = h >= 9 && h <= 17
          ? (metricsForHour.length > 0 ? metricsForHour.reduce((s, m) => s + (m.solar_generation_kwh || 20), 0) / metricsForHour.length : 20)
          : 0;
        const avgV2g = h >= 17 && h <= 21
          ? (metricsForHour.length > 0 ? metricsForHour.reduce((s, m) => s + (m.ev_charging_kwh || 10), 0) / metricsForHour.length : 10)
          : 0;
        hours.push({ hour: h, demand: avgDemand, solar: avgSolar, v2g: avgV2g });
      }
      setPeakHours(hours);
    }
  }, [selectedComplex]);

  useEffect(() => { fetchData(); }, [fetchData]);

  const handleSave = async () => {
    const payload = {
      ...form,
      complex_id: selectedComplex || null,
      scheduled_time: new Date(Date.now() + form.priority * 3600000).toISOString(),
      status: 'scheduled',
    };
    if (editing) {
      await supabase.from('ev_charging_schedules').update(payload).eq('id', editing.id);
    } else {
      await supabase.from('ev_charging_schedules').insert(payload);
    }
    setDialogOpen(false);
    setEditing(null);
    setForm(EMPTY_FORM);
    fetchData();
  };

  const handleDelete = async (id: string) => {
    await supabase.from('ev_charging_schedules').delete().eq('id', id);
    fetchData();
  };

  const handleOptimize = async () => {
    const active = evSchedules.filter(e => e.status !== 'completed');
    for (const schedule of active) {
      const optimalAction = schedule.battery_level > 70 ? 'discharging' : schedule.battery_level < 30 ? 'charging' : 'idle';
      await supabase.from('ev_charging_schedules').update({ action: optimalAction, priority: schedule.battery_level > 70 ? 2 : 1 }).eq('id', schedule.id);
    }
    fetchData();
  };

  const handleGenerateRecs = async () => {
    setGeneratingRecs(true);
    try {
      const url = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/workflow-engine?action=generate-recommendations`;
      const res = await fetch(url, {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${import.meta.env.VITE_SUPABASE_ANON_KEY}`, 'Content-Type': 'application/json' },
      });
      const data = await res.json();
      showToast(`AI 권장사항 ${data.count || 0}건 생성 완료`, 'success');
      fetchData();
    } catch {
      showToast('AI 분석 실패', 'error');
    } finally {
      setGeneratingRecs(false);
    }
  };

  const openEdit = (ev: EVSchedule) => {
    setEditing(ev);
    setForm({ vehicle_id: ev.vehicle_id, plate: ev.plate, battery_level: ev.battery_level, action: ev.action, energy_kwh: Number(ev.energy_kwh), priority: ev.priority });
    setDialogOpen(true);
  };

  const chargingCount = evSchedules.filter(e => e.action === 'charging').length;
  const dischargingCount = evSchedules.filter(e => e.action === 'discharging').length;
  const totalV2GEnergy = evSchedules.filter(e => e.action === 'discharging').reduce((sum, e) => sum + Number(e.energy_kwh), 0);
  const peakDemand = Math.max(...peakHours.map(h => h.demand), 0);
  const peakHourItem = peakHours.find(h => h.demand === peakDemand);

  return (
    <Container maxWidth="xl" sx={{ py: 3 }}>
      <Box sx={{ mb: 3, display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 2 }}>
        <Box>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5, mb: 0.5 }}>
            <BoltIcon sx={{ color: theme.palette.warning.main, fontSize: 28 }} />
            <Typography variant="h5" sx={{ fontWeight: 700 }}>V2G Energy Trading</Typography>
            <Chip label={v2gEnabled ? 'Active' : 'Paused'} size="small" color={v2gEnabled ? 'success' : 'default'} />
          </Box>
          <Typography variant="body2" color="text.secondary">
            Vehicle-to-Grid 양방향 에너지 거래 및 최적화
          </Typography>
        </Box>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, flexWrap: 'wrap' }}>
          <Button variant="outlined" size="small" onClick={() => navigate('/admin/energy')}>에너지</Button>
          <Button variant="outlined" size="small" onClick={() => navigate('/admin/esg')}>ESG</Button>
          <Button variant="outlined" size="small" onClick={() => navigate('/admin/parking')}>주차 운영</Button>
          <Button variant="outlined" size="small" onClick={() => navigate('/admin/ai-management')}>AI 관리</Button>
          <Button variant="outlined" size="small" onClick={() => navigate('/admin/workflows')}>워크플로우</Button>
          <Button variant="outlined" size="small" onClick={handleGenerateRecs} disabled={generatingRecs}>
            {generatingRecs ? 'AI 분석중...' : 'AI 분석 실행'}
          </Button>
          <FormControlLabel
            control={<Switch checked={v2gEnabled} onChange={(e) => setV2gEnabled(e.target.checked)} color="success" />}
            label="V2G 자동 실행"
          />
          <IconButton size="small" onClick={fetchData}><RefreshIcon /></IconButton>
        </Box>
      </Box>

      <Grid container spacing={2} sx={{ mb: 3 }}>
        <Grid size={{ xs: 6, md: 2 }}>
          <Card><CardContent sx={{ textAlign: 'center', py: 2 }}>
            <EvStationIcon sx={{ fontSize: 28, color: theme.palette.info.main, mb: 0.5 }} />
            <Typography variant="h5" sx={{ fontWeight: 700 }}>{chargingCount}</Typography>
            <Typography variant="caption" color="text.secondary">충전중</Typography>
          </CardContent></Card>
        </Grid>
        <Grid size={{ xs: 6, md: 2 }}>
          <Card><CardContent sx={{ textAlign: 'center', py: 2 }}>
            <BatteryChargingFullIcon sx={{ fontSize: 28, color: theme.palette.success.main, mb: 0.5 }} />
            <Typography variant="h5" sx={{ fontWeight: 700 }}>{dischargingCount}</Typography>
            <Typography variant="caption" color="text.secondary">방전중 (V2G)</Typography>
          </CardContent></Card>
        </Grid>
        <Grid size={{ xs: 6, md: 2 }}>
          <Card><CardContent sx={{ textAlign: 'center', py: 2 }}>
            <BoltIcon sx={{ fontSize: 28, color: theme.palette.warning.main, mb: 0.5 }} />
            <Typography variant="h5" sx={{ fontWeight: 700 }}>{totalV2GEnergy}</Typography>
            <Typography variant="caption" color="text.secondary">V2G 에너지 (kWh)</Typography>
          </CardContent></Card>
        </Grid>
        <Grid size={{ xs: 6, md: 2 }}>
          <Card><CardContent sx={{ textAlign: 'center', py: 2 }}>
            <TrendingUpIcon sx={{ fontSize: 28, color: theme.palette.success.main, mb: 0.5 }} />
            <Typography variant="h5" sx={{ fontWeight: 700 }}>{(totalSavings / 10000).toFixed(0)}</Typography>
            <Typography variant="caption" color="text.secondary">절감 (만원)</Typography>
          </CardContent></Card>
        </Grid>
        <Grid size={{ xs: 6, md: 2 }}>
          <Card><CardContent sx={{ textAlign: 'center', py: 2 }}>
            <Co2Icon sx={{ fontSize: 28, color: theme.palette.success.main, mb: 0.5 }} />
            <Typography variant="h5" sx={{ fontWeight: 700 }}>{carbonSaved.toFixed(0)}</Typography>
            <Typography variant="caption" color="text.secondary">CO2 절감 (kg)</Typography>
          </CardContent></Card>
        </Grid>
        <Grid size={{ xs: 6, md: 2 }}>
          <Card><CardContent sx={{ textAlign: 'center', py: 2 }}>
            <SolarPowerIcon sx={{ fontSize: 28, color: theme.palette.warning.main, mb: 0.5 }} />
            <Typography variant="h5" sx={{ fontWeight: 700 }}>{peakHourItem?.hour || '-'}시</Typography>
            <Typography variant="caption" color="text.secondary">피크 시간대</Typography>
          </CardContent></Card>
        </Grid>
      </Grid>

      {aiRecs.length > 0 && (
        <Card sx={{ mb: 3 }}>
          <CardContent sx={{ p: 2 }}>
            <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 1 }}>
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                <AutoAwesomeIcon sx={{ fontSize: 18, color: theme.palette.success.main }} />
                <Typography variant="subtitle2" sx={{ fontWeight: 700 }}>AI 에너지 최적화 권장사항</Typography>
              </Box>
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

      <Grid container spacing={2}>
        <Grid size={{ xs: 12, md: 5 }}>
          <Card sx={{ height: '100%' }}>
            <CardContent>
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 2 }}>
                <ScheduleIcon sx={{ fontSize: 20, color: theme.palette.warning.main }} />
                <Typography variant="subtitle1" sx={{ fontWeight: 600 }}>시간대별 에너지 현황</Typography>
              </Box>
              <Box sx={{ display: 'flex', flexDirection: 'column', gap: 0.5 }}>
                {peakHours.map(h => (
                  <Box key={h.hour} sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                    <Typography variant="caption" sx={{ minWidth: 32, textAlign: 'right' }}>{h.hour}시</Typography>
                    <Box sx={{ flex: 1, display: 'flex', height: 14, borderRadius: 0.5, overflow: 'hidden', bgcolor: 'action.hover' }}>
                      <Box sx={{ width: `${(h.demand / 150) * 100}%`, bgcolor: 'error.main', opacity: 0.7 }} />
                      <Box sx={{ width: `${(h.solar / 150) * 100}%`, bgcolor: 'warning.main', opacity: 0.7 }} />
                      <Box sx={{ width: `${(h.v2g / 150) * 100}%`, bgcolor: 'success.main', opacity: 0.7 }} />
                    </Box>
                    <Typography variant="caption" sx={{ minWidth: 50, fontSize: '0.65rem' }}>{h.demand.toFixed(0)}kW</Typography>
                  </Box>
                ))}
              </Box>
              <Box sx={{ display: 'flex', gap: 2, mt: 2 }}>
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
                  <Box sx={{ width: 12, height: 12, bgcolor: 'error.main', borderRadius: 0.5, opacity: 0.7 }} />
                  <Typography variant="caption">수요</Typography>
                </Box>
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
                  <Box sx={{ width: 12, height: 12, bgcolor: 'warning.main', borderRadius: 0.5, opacity: 0.7 }} />
                  <Typography variant="caption">솔라</Typography>
                </Box>
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
                  <Box sx={{ width: 12, height: 12, bgcolor: 'success.main', borderRadius: 0.5, opacity: 0.7 }} />
                  <Typography variant="caption">V2G</Typography>
                </Box>
              </Box>
            </CardContent>
          </Card>
        </Grid>

        <Grid size={{ xs: 12, md: 7 }}>
          <Card>
            <CardContent>
              <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 2 }}>
                <Typography variant="subtitle1" sx={{ fontWeight: 600 }}>EV 충방전 스케줄</Typography>
                <Box sx={{ display: 'flex', gap: 1 }}>
                  <Button size="small" variant="outlined" onClick={handleOptimize}>스케줄 최적화</Button>
                  <Button size="small" variant="contained" startIcon={<AddIcon />} onClick={() => { setEditing(null); setForm(EMPTY_FORM); setDialogOpen(true); }}>추가</Button>
                </Box>
              </Box>
              <TableContainer component={Paper} elevation={0} sx={{ bgcolor: 'transparent' }}>
                <Table size="small">
                  <TableHead>
                    <TableRow>
                      <TableCell>차량</TableCell>
                      <TableCell>차량번호</TableCell>
                      <TableCell align="center">배터리</TableCell>
                      <TableCell align="center">동작</TableCell>
                      <TableCell align="center">상태</TableCell>
                      <TableCell align="right">에너지</TableCell>
                      <TableCell align="center">관리</TableCell>
                    </TableRow>
                  </TableHead>
                  <TableBody>
                    {evSchedules.map(ev => (
                      <TableRow key={ev.id} hover>
                        <TableCell><Typography variant="body2" sx={{ fontWeight: 500 }}>{ev.vehicle_id}</Typography></TableCell>
                        <TableCell><Typography variant="caption" sx={{ fontFamily: 'monospace' }}>{ev.plate}</Typography></TableCell>
                        <TableCell align="center">
                          <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5, justifyContent: 'center' }}>
                            <LinearProgress variant="determinate" value={ev.battery_level} sx={{ width: 40, borderRadius: 1, height: 6 }}
                              color={ev.battery_level > 60 ? 'success' : ev.battery_level > 30 ? 'warning' : 'error'} />
                            <Typography variant="caption">{ev.battery_level}%</Typography>
                          </Box>
                        </TableCell>
                        <TableCell align="center">
                          <Chip label={ev.action === 'charging' ? '충전' : ev.action === 'discharging' ? '방전' : '대기'} size="small"
                            color={ev.action === 'charging' ? 'info' : ev.action === 'discharging' ? 'success' : 'default'} />
                        </TableCell>
                        <TableCell align="center">
                          <Chip label={ev.status === 'active' ? '진행' : ev.status === 'scheduled' ? '예정' : '완료'} size="small" variant="outlined"
                            color={ev.status === 'active' ? 'success' : ev.status === 'scheduled' ? 'info' : 'default'} />
                        </TableCell>
                        <TableCell align="right">
                          <Typography variant="body2" sx={{ fontWeight: 500 }}>{ev.action === 'discharging' ? '-' : '+'}{ev.energy_kwh} kWh</Typography>
                        </TableCell>
                        <TableCell align="center">
                          <IconButton size="small" onClick={() => openEdit(ev)}><EditIcon fontSize="small" /></IconButton>
                          <IconButton size="small" color="error" onClick={() => handleDelete(ev.id)}><DeleteIcon fontSize="small" /></IconButton>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </TableContainer>
            </CardContent>
          </Card>
        </Grid>
      </Grid>

      <Dialog open={dialogOpen} onClose={() => setDialogOpen(false)} maxWidth="sm" fullWidth>
        <DialogTitle>{editing ? 'EV 스케줄 수정' : 'EV 스케줄 추가'}</DialogTitle>
        <DialogContent sx={{ display: 'flex', flexDirection: 'column', gap: 2, pt: '16px !important' }}>
          <TextField label="차량 ID" value={form.vehicle_id} onChange={e => setForm({ ...form, vehicle_id: e.target.value })} size="small" />
          <TextField label="차량번호" value={form.plate} onChange={e => setForm({ ...form, plate: e.target.value })} size="small" />
          <TextField label="배터리 잔량 (%)" type="number" value={form.battery_level} onChange={e => setForm({ ...form, battery_level: Number(e.target.value) })} size="small" />
          <FormControl size="small">
            <InputLabel>동작</InputLabel>
            <Select value={form.action} label="동작" onChange={e => setForm({ ...form, action: e.target.value })}>
              <MenuItem value="charging">충전</MenuItem>
              <MenuItem value="discharging">방전 (V2G)</MenuItem>
              <MenuItem value="idle">대기</MenuItem>
            </Select>
          </FormControl>
          <TextField label="에너지 (kWh)" type="number" value={form.energy_kwh} onChange={e => setForm({ ...form, energy_kwh: Number(e.target.value) })} size="small" />
          <TextField label="우선순위" type="number" value={form.priority} onChange={e => setForm({ ...form, priority: Number(e.target.value) })} size="small" />
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setDialogOpen(false)}>취소</Button>
          <Button variant="contained" onClick={handleSave} disabled={!form.vehicle_id || !form.plate}>저장</Button>
        </DialogActions>
      </Dialog>
    </Container>
  );
}
