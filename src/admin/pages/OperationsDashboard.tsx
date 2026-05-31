import { useState, useEffect, useMemo, useCallback } from 'react';
import Box from '@mui/material/Box';
import Grid from '@mui/material/Grid';
import Card from '@mui/material/Card';
import CardContent from '@mui/material/CardContent';
import Typography from '@mui/material/Typography';
import Chip from '@mui/material/Chip';
import CircularProgress from '@mui/material/CircularProgress';
import LinearProgress from '@mui/material/LinearProgress';
import ToggleButton from '@mui/material/ToggleButton';
import ToggleButtonGroup from '@mui/material/ToggleButtonGroup';
import LocalParkingIcon from '@mui/icons-material/LocalParking';
import DirectionsCarIcon from '@mui/icons-material/DirectionsCar';
import EvStationIcon from '@mui/icons-material/EvStation';
import AccessTimeIcon from '@mui/icons-material/AccessTime';
import TrendingUpIcon from '@mui/icons-material/TrendingUp';
import SolarPowerIcon from '@mui/icons-material/SolarPower';
import BoltIcon from '@mui/icons-material/Bolt';
import Co2Icon from '@mui/icons-material/Co2';
import PrecisionManufacturingIcon from '@mui/icons-material/PrecisionManufacturing';
import BuildIcon from '@mui/icons-material/Build';
import SupportAgentIcon from '@mui/icons-material/SupportAgent';
import AutoAwesomeIcon from '@mui/icons-material/AutoAwesome';
import Button from '@mui/material/Button';
import { supabase } from '../../lib/supabase';
import { useTenant } from '../contexts/TenantContext';
import { useDocumentTitle } from '../../hooks/useDocumentTitle';
import { useNavigate } from 'react-router-dom';

interface ParkingSession {
  id: string;
  complex_id: string;
  vehicle_number: string;
  slot_id: string;
  status: string;
  entry_at: string;
  parked_at: string | null;
  exit_at: string | null;
  duration_minutes: number;
  fee: number;
  is_ev: boolean;
  ev_charged_kwh: number;
}

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
  carbon_saved_kg: number;
  cost_savings_krw: number;
}

interface Complex {
  id: string;
  name: string;
  total_parking_slots: number;
}

type PeriodKey = 'today' | '7d' | '30d';

export default function OperationsDashboard() {
  useDocumentTitle('운영 현황');
  const navigate = useNavigate();
  const { selectedComplex: tenantComplex } = useTenant();
  const [loading, setLoading] = useState(true);
  const [sessions, setSessions] = useState<ParkingSession[]>([]);
  const [energy, setEnergy] = useState<EnergyMetric[]>([]);
  const [complexes, setComplexes] = useState<Complex[]>([]);
  const [period, setPeriod] = useState<PeriodKey>('today');

  const [subsystems, setSubsystems] = useState({ atrOnline: 0, atrTotal: 0, maintenanceOpen: 0, ticketsOpen: 0, aiRecs: 0 });

  const loadData = useCallback(async () => {
    let sessionQuery = supabase.from('parking_sessions').select('*').order('entry_at', { ascending: false });
    let energyQuery = supabase.from('energy_metrics').select('*').order('date', { ascending: false }).limit(56);
    if (tenantComplex) {
      sessionQuery = sessionQuery.eq('complex_id', tenantComplex.id);
      energyQuery = energyQuery.eq('complex_id', tenantComplex.id);
    }
    const [sRes, eRes, cRes, atrRes, mntRes, tktRes, aiRes] = await Promise.all([
      sessionQuery,
      energyQuery,
      supabase.from('complexes').select('id, name, total_parking_slots'),
      supabase.from('atr_units').select('id, status'),
      supabase.from('maintenance_logs').select('id', { count: 'exact', head: true }).in('status', ['scheduled', 'in_progress']),
      supabase.from('support_tickets').select('id', { count: 'exact', head: true }).in('status', ['open', 'in_progress']),
      supabase.from('ai_recommendations').select('id', { count: 'exact', head: true }).in('status', ['pending', 'acknowledged']),
    ]);
    if (sRes.data) setSessions(sRes.data);
    if (eRes.data) setEnergy(eRes.data);
    if (cRes.data) setComplexes(cRes.data);
    const atrs = atrRes.data || [];
    setSubsystems({
      atrOnline: atrs.filter(a => ['idle', 'transporting', 'charging'].includes(a.status)).length,
      atrTotal: atrs.length,
      maintenanceOpen: mntRes.count || 0,
      ticketsOpen: tktRes.count || 0,
      aiRecs: aiRes.count || 0,
    });
    setLoading(false);
  }, [tenantComplex]);

  useEffect(() => { loadData(); }, [loadData]);

  useEffect(() => {
    const channel = supabase.channel('operations-realtime')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'parking_sessions' }, () => { loadData(); })
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'energy_metrics' }, () => { loadData(); })
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [loadData]);

  const periodDays = period === 'today' ? 1 : period === '7d' ? 7 : 30;

  const periodSessions = useMemo(() => {
    const cutoff = new Date();
    cutoff.setDate(cutoff.getDate() - periodDays);
    const cutoffStr = cutoff.toISOString().slice(0, 10);
    if (period === 'today') {
      const todayStr = new Date().toISOString().slice(0, 10);
      return sessions.filter((s) => s.entry_at.slice(0, 10) === todayStr);
    }
    return sessions.filter((s) => s.entry_at.slice(0, 10) >= cutoffStr);
  }, [sessions, period, periodDays]);

  const periodEnergy = useMemo(() => {
    if (period === 'today') {
      const todayStr = new Date().toISOString().slice(0, 10);
      return energy.filter((e) => e.date === todayStr);
    }
    const cutoff = new Date();
    cutoff.setDate(cutoff.getDate() - periodDays);
    const cutoffStr = cutoff.toISOString().slice(0, 10);
    return energy.filter((e) => e.date >= cutoffStr);
  }, [energy, period, periodDays]);

  if (loading) {
    return (
      <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', minHeight: 300 }}>
        <CircularProgress sx={{ color: 'primary.main' }} />
      </Box>
    );
  }

  const currentlyParked = sessions.filter((s) => s.status === 'parked').length;
  const totalSlots = complexes.reduce((sum, c) => sum + c.total_parking_slots, 0);
  const occupancyRate = totalSlots > 0 ? Math.round((currentlyParked / totalSlots) * 100) : 0;
  const completedSessions = periodSessions.filter((s) => s.status === 'completed');
  const periodRevenue = completedSessions.reduce((sum, s) => sum + Number(s.fee), 0);
  const avgDuration = completedSessions.length > 0
    ? Math.round(completedSessions.reduce((sum, s) => sum + s.duration_minutes, 0) / completedSessions.length)
    : 0;
  const evSessions = periodSessions.filter((s) => s.is_ev);
  const totalEvCharged = evSessions.reduce((sum, s) => sum + Number(s.ev_charged_kwh), 0);

  const totalSolar = periodEnergy.reduce((sum, e) => sum + Number(e.solar_generation_kwh), 0);
  const totalRegen = periodEnergy.reduce((sum, e) => sum + Number(e.regen_recovery_kwh), 0);
  const totalCarbon = periodEnergy.reduce((sum, e) => sum + Number(e.carbon_saved_kg), 0);
  const totalSavings = periodEnergy.reduce((sum, e) => sum + Number(e.cost_savings_krw), 0);

  const last7Energy = energy.filter((e) => {
    const d = new Date(e.date);
    return d >= new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
  });
  const getComplexName = (id: string) => complexes.find((c) => c.id === id)?.name || '-';
  const periodLabel = period === 'today' ? '금일' : period === '7d' ? '7일' : '30일';

  return (
    <Box>
      <Box sx={{ mb: 3, display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: 1 }}>
        <Box>
          <Typography variant="h1" sx={{ mb: 0.5 }}>운영 대시보드</Typography>
          <Typography variant="body2" sx={{ color: 'text.secondary' }}>
            실시간 주차 운영 현황, 에너지 관리, 수익 분석
          </Typography>
        </Box>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, flexWrap: 'wrap' }}>
          <Button variant="outlined" size="small" onClick={() => navigate('/admin/parking')}>주차 운영</Button>
          <Button variant="outlined" size="small" onClick={() => navigate('/admin/energy')}>에너지</Button>
          <Button variant="outlined" size="small" onClick={() => navigate('/admin/revenue')}>수익</Button>
          <Button variant="outlined" size="small" onClick={() => navigate('/admin/ai-management')}>AI 관리</Button>
          <Button variant="outlined" size="small" onClick={() => navigate('/admin/workflows')}>워크플로우</Button>
          <Button variant="outlined" size="small" onClick={() => navigate('/admin/noc')}>NOC</Button>
          <Button variant="outlined" size="small" onClick={() => navigate('/admin/observability')}>관측성</Button>
          <ToggleButtonGroup size="small" value={period} exclusive onChange={(_, v) => v && setPeriod(v)}>
            <ToggleButton value="today" sx={{ px: 1.5, fontSize: '0.75rem' }}>오늘</ToggleButton>
            <ToggleButton value="7d" sx={{ px: 1.5, fontSize: '0.75rem' }}>7일</ToggleButton>
            <ToggleButton value="30d" sx={{ px: 1.5, fontSize: '0.75rem' }}>30일</ToggleButton>
          </ToggleButtonGroup>
        </Box>
      </Box>

      {/* Primary KPIs */}
      <Grid container spacing={2} sx={{ mb: 3 }}>
        {[
          { label: '현재 주차중', value: `${currentlyParked}`, unit: `/ ${totalSlots}면`, color: 'primary.main', icon: <LocalParkingIcon sx={{ fontSize: 20 }} /> },
          { label: `${periodLabel} 입출고`, value: periodSessions.length.toString(), unit: '건', color: 'success.main', icon: <DirectionsCarIcon sx={{ fontSize: 20 }} /> },
          { label: '평균 주차시간', value: `${avgDuration}`, unit: '분', color: 'secondary.main', icon: <AccessTimeIcon sx={{ fontSize: 20 }} /> },
          { label: `${periodLabel} 매출`, value: periodRevenue.toLocaleString(), unit: '원', color: 'info.main', icon: <TrendingUpIcon sx={{ fontSize: 20 }} /> },
        ].map((s) => (
          <Grid size={{ xs: 6, lg: 3 }} key={s.label}>
            <Card>
              <CardContent sx={{ p: '16px 20px !important' }}>
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5 }}>
                  <Box sx={{ color: s.color }}>{s.icon}</Box>
                  <Box>
                    <Typography variant="caption" sx={{ color: 'text.secondary' }}>{s.label}</Typography>
                    <Typography sx={{ fontSize: '1.25rem', fontWeight: 800, color: 'text.primary' }}>
                      {s.value}
                      <Typography component="span" variant="caption" sx={{ color: 'text.secondary', fontWeight: 400 }}> {s.unit}</Typography>
                    </Typography>
                  </Box>
                </Box>
              </CardContent>
            </Card>
          </Grid>
        ))}
      </Grid>

      {/* Cross-subsystem health */}
      <Card sx={{ mb: 3 }}>
        <CardContent sx={{ p: '16px 24px !important' }}>
          <Typography variant="h3" sx={{ mb: 2 }}>서브시스템 통합 현황</Typography>
          <Grid container spacing={2}>
            <Grid size={{ xs: 6, md: 3 }}>
              <Box
                onClick={() => navigate('/admin/atr')}
                sx={{ p: 1.5, borderRadius: 2, cursor: 'pointer', bgcolor: 'rgba(0,212,255,0.04)', border: '1px solid rgba(0,212,255,0.15)', '&:hover': { bgcolor: 'rgba(0,212,255,0.08)' } }}
              >
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 0.5 }}>
                  <PrecisionManufacturingIcon sx={{ fontSize: 18, color: 'primary.main' }} />
                  <Typography variant="caption" sx={{ color: 'text.secondary' }}>ATR 차량</Typography>
                </Box>
                <Typography sx={{ fontSize: '1.1rem', fontWeight: 700 }}>
                  {subsystems.atrOnline} <Typography component="span" variant="caption" sx={{ color: 'text.secondary' }}>/ {subsystems.atrTotal} 온라인</Typography>
                </Typography>
                <LinearProgress
                  variant="determinate"
                  value={subsystems.atrTotal > 0 ? (subsystems.atrOnline / subsystems.atrTotal) * 100 : 0}
                  sx={{ mt: 1, height: 4, borderRadius: 2, bgcolor: 'rgba(255,255,255,0.06)', '& .MuiLinearProgress-bar': { bgcolor: 'primary.main' } }}
                />
              </Box>
            </Grid>
            <Grid size={{ xs: 6, md: 3 }}>
              <Box
                onClick={() => navigate('/admin/maintenance')}
                sx={{ p: 1.5, borderRadius: 2, cursor: 'pointer', bgcolor: 'rgba(255,167,38,0.04)', border: '1px solid rgba(255,167,38,0.15)', '&:hover': { bgcolor: 'rgba(255,167,38,0.08)' } }}
              >
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 0.5 }}>
                  <BuildIcon sx={{ fontSize: 18, color: 'warning.main' }} />
                  <Typography variant="caption" sx={{ color: 'text.secondary' }}>정비 미완료</Typography>
                </Box>
                <Typography sx={{ fontSize: '1.1rem', fontWeight: 700, color: subsystems.maintenanceOpen > 5 ? 'warning.main' : 'text.primary' }}>
                  {subsystems.maintenanceOpen} <Typography component="span" variant="caption" sx={{ color: 'text.secondary' }}>건</Typography>
                </Typography>
              </Box>
            </Grid>
            <Grid size={{ xs: 6, md: 3 }}>
              <Box
                onClick={() => navigate('/admin/tickets')}
                sx={{ p: 1.5, borderRadius: 2, cursor: 'pointer', bgcolor: 'rgba(239,83,80,0.04)', border: '1px solid rgba(239,83,80,0.15)', '&:hover': { bgcolor: 'rgba(239,83,80,0.08)' } }}
              >
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 0.5 }}>
                  <SupportAgentIcon sx={{ fontSize: 18, color: 'error.main' }} />
                  <Typography variant="caption" sx={{ color: 'text.secondary' }}>미해결 티켓</Typography>
                </Box>
                <Typography sx={{ fontSize: '1.1rem', fontWeight: 700, color: subsystems.ticketsOpen > 3 ? 'error.main' : 'text.primary' }}>
                  {subsystems.ticketsOpen} <Typography component="span" variant="caption" sx={{ color: 'text.secondary' }}>건</Typography>
                </Typography>
              </Box>
            </Grid>
            <Grid size={{ xs: 6, md: 3 }}>
              <Box
                onClick={() => navigate('/admin/ai-management')}
                sx={{ p: 1.5, borderRadius: 2, cursor: 'pointer', bgcolor: 'rgba(0,230,118,0.04)', border: '1px solid rgba(0,230,118,0.15)', '&:hover': { bgcolor: 'rgba(0,230,118,0.08)' } }}
              >
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 0.5 }}>
                  <AutoAwesomeIcon sx={{ fontSize: 18, color: 'success.main' }} />
                  <Typography variant="caption" sx={{ color: 'text.secondary' }}>AI 권장사항</Typography>
                </Box>
                <Typography sx={{ fontSize: '1.1rem', fontWeight: 700 }}>
                  {subsystems.aiRecs} <Typography component="span" variant="caption" sx={{ color: 'text.secondary' }}>대기중</Typography>
                </Typography>
              </Box>
            </Grid>
          </Grid>
        </CardContent>
      </Card>

      <Grid container spacing={2.5}>
        {/* Occupancy by complex */}
        <Grid size={{ xs: 12, lg: 7 }}>
          <Card>
            <CardContent sx={{ p: '20px 24px !important' }}>
              <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2.5 }}>
                <Typography variant="h3">단지별 점유율</Typography>
                <Chip
                  label={`전체 ${occupancyRate}%`}
                  size="small"
                  sx={{ bgcolor: 'rgba(0,212,255,0.12)', color: 'primary.main', fontWeight: 700, fontSize: '0.75rem' }}
                />
              </Box>
              {complexes.map((complex) => {
                const parked = sessions.filter((s) => s.complex_id === complex.id && s.status === 'parked').length;
                const pct = complex.total_parking_slots > 0 ? Math.round((parked / complex.total_parking_slots) * 100) : 0;
                const barColor = pct > 85 ? 'error.main' : pct > 60 ? 'warning.main' : 'success.main';
                return (
                  <Box key={complex.id} sx={{ mb: 2.5 }}>
                    <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 0.75 }}>
                      <Typography
                        variant="subtitle2"
                        onClick={() => navigate('/admin/complexes')}
                        sx={{ color: 'text.primary', fontWeight: 600, cursor: 'pointer', '&:hover': { color: 'primary.main' } }}
                      >{complex.name}</Typography>
                      <Typography variant="caption" sx={{ color: 'text.secondary' }}>
                        {parked} / {complex.total_parking_slots}면 ({pct}%)
                      </Typography>
                    </Box>
                    <LinearProgress
                      variant="determinate"
                      value={pct}
                      sx={{
                        height: 8,
                        borderRadius: 4,
                        bgcolor: 'rgba(255,255,255,0.06)',
                        '& .MuiLinearProgress-bar': { bgcolor: barColor, borderRadius: 4 },
                      }}
                    />
                  </Box>
                );
              })}
            </CardContent>
          </Card>

          {/* Energy chart */}
          <Card sx={{ mt: 2.5 }}>
            <CardContent sx={{ p: '20px 24px !important' }}>
              <Typography variant="h3" sx={{ mb: 2.5 }}>에너지 소비 추이 (7일)</Typography>
              <Box sx={{ display: 'flex', alignItems: 'flex-end', gap: 1, height: 160, px: 1 }}>
                {(() => {
                  const days: Record<string, { consumption: number; solar: number; regen: number }> = {};
                  for (let i = 6; i >= 0; i--) {
                    const d = new Date();
                    d.setDate(d.getDate() - i);
                    const key = d.toISOString().slice(0, 10);
                    days[key] = { consumption: 0, solar: 0, regen: 0 };
                  }
                  last7Energy.forEach((e) => {
                    if (days[e.date]) {
                      days[e.date].consumption += Number(e.total_consumption_kwh);
                      days[e.date].solar += Number(e.solar_generation_kwh);
                      days[e.date].regen += Number(e.regen_recovery_kwh);
                    }
                  });
                  const maxVal = Math.max(...Object.values(days).map((d) => d.consumption), 1);
                  return Object.entries(days).map(([date, data]) => (
                    <Box key={date} sx={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 0.5 }}>
                      <Typography variant="caption" sx={{ color: 'text.secondary', fontSize: '0.6rem' }}>
                        {data.consumption > 0 ? `${Math.round(data.consumption)}` : ''}
                      </Typography>
                      <Box sx={{ width: '100%', display: 'flex', flexDirection: 'column', gap: '2px' }}>
                        <Box
                          sx={{
                            width: '100%',
                            bgcolor: 'primary.main',
                            borderRadius: '3px 3px 0 0',
                            height: `${(data.consumption / maxVal) * 120}px`,
                            minHeight: data.consumption > 0 ? 4 : 2,
                            opacity: data.consumption > 0 ? 0.8 : 0.2,
                          }}
                        />
                        <Box
                          sx={{
                            width: '100%',
                            bgcolor: 'success.main',
                            borderRadius: '0 0 3px 3px',
                            height: `${((data.solar + data.regen) / maxVal) * 120}px`,
                            minHeight: 2,
                            opacity: 0.7,
                          }}
                        />
                      </Box>
                      <Typography variant="caption" sx={{ color: 'text.secondary', fontSize: '0.6rem' }}>
                        {date.slice(5)}
                      </Typography>
                    </Box>
                  ));
                })()}
              </Box>
              <Box sx={{ display: 'flex', gap: 3, mt: 2, justifyContent: 'center' }}>
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.75 }}>
                  <Box sx={{ width: 10, height: 10, borderRadius: '2px', bgcolor: 'primary.main', opacity: 0.8 }} />
                  <Typography variant="caption" sx={{ color: 'text.secondary' }}>소비</Typography>
                </Box>
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.75 }}>
                  <Box sx={{ width: 10, height: 10, borderRadius: '2px', bgcolor: 'success.main', opacity: 0.7 }} />
                  <Typography variant="caption" sx={{ color: 'text.secondary' }}>자체 생산 (태양광+회생)</Typography>
                </Box>
              </Box>
            </CardContent>
          </Card>
        </Grid>

        {/* Right column */}
        <Grid size={{ xs: 12, lg: 5 }}>
          {/* Energy KPIs */}
          <Card sx={{ mb: 2.5 }}>
            <CardContent sx={{ p: '20px 24px !important' }}>
              <Typography variant="h3" sx={{ mb: 2 }}>{periodLabel} 에너지 현황</Typography>
              <Grid container spacing={2}>
                {[
                  { label: '태양광 발전', value: `${totalSolar.toFixed(0)} kWh`, icon: <SolarPowerIcon sx={{ fontSize: 18 }} />, color: 'warning.main' },
                  { label: '회생 에너지', value: `${totalRegen.toFixed(0)} kWh`, icon: <BoltIcon sx={{ fontSize: 18 }} />, color: 'success.main' },
                  { label: 'EV 충전', value: `${totalEvCharged.toFixed(0)} kWh`, icon: <EvStationIcon sx={{ fontSize: 18 }} />, color: 'primary.main' },
                  { label: 'CO2 절감', value: `${totalCarbon.toFixed(0)} kg`, icon: <Co2Icon sx={{ fontSize: 18 }} />, color: 'success.light' },
                ].map((item) => (
                  <Grid size={6} key={item.label}>
                    <Box sx={{ p: 1.5, borderRadius: 2, bgcolor: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.06)' }}>
                      <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.75, mb: 0.5 }}>
                        <Box sx={{ color: item.color }}>{item.icon}</Box>
                        <Typography variant="caption" sx={{ color: 'text.secondary' }}>{item.label}</Typography>
                      </Box>
                      <Typography sx={{ fontSize: '1rem', fontWeight: 700, color: 'text.primary' }}>{item.value}</Typography>
                    </Box>
                  </Grid>
                ))}
              </Grid>
              <Box sx={{ mt: 2, p: 1.5, borderRadius: 2, bgcolor: 'rgba(0,230,118,0.05)', border: '1px solid rgba(0,230,118,0.15)' }}>
                <Typography variant="caption" sx={{ color: 'success.main', fontWeight: 600 }}>
                  {periodLabel} 절감 비용
                </Typography>
                <Typography sx={{ fontSize: '1.25rem', fontWeight: 800, color: 'success.main' }}>
                  {totalSavings.toLocaleString()} <Typography component="span" variant="caption" sx={{ color: 'text.secondary' }}>원</Typography>
                </Typography>
              </Box>
            </CardContent>
          </Card>

          {/* Recent parking activity */}
          <Card>
            <CardContent sx={{ p: '20px 24px !important' }}>
              <Typography variant="h3" sx={{ mb: 2 }}>최근 입출고</Typography>
              <Box sx={{ display: 'flex', flexDirection: 'column', gap: 0.5 }}>
                {sessions.slice(0, 8).map((session) => (
                  <Box
                    key={session.id}
                    sx={{ display: 'flex', alignItems: 'center', gap: 1.5, py: 1, px: 1, borderRadius: 1.5, '&:hover': { bgcolor: 'rgba(255,255,255,0.02)' } }}
                  >
                    <Box sx={{
                      width: 32, height: 32, borderRadius: 1.5,
                      bgcolor: session.status === 'parked' ? 'rgba(0,212,255,0.1)' : 'rgba(0,230,118,0.1)',
                      border: `1px solid ${session.status === 'parked' ? 'rgba(0,212,255,0.3)' : 'rgba(0,230,118,0.3)'}`,
                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                    }}>
                      {session.is_ev
                        ? <EvStationIcon sx={{ fontSize: 16, color: session.status === 'parked' ? 'primary.main' : 'success.main' }} />
                        : <DirectionsCarIcon sx={{ fontSize: 16, color: session.status === 'parked' ? 'primary.main' : 'success.main' }} />
                      }
                    </Box>
                    <Box sx={{ flex: 1, minWidth: 0 }}>
                      <Typography sx={{ fontSize: '0.8125rem', fontWeight: 600, color: 'text.primary' }}>
                        {session.vehicle_number}
                      </Typography>
                      <Typography
                        variant="caption"
                        onClick={(e) => { e.stopPropagation(); navigate('/admin/complexes'); }}
                        sx={{ color: 'primary.main', cursor: 'pointer', '&:hover': { textDecoration: 'underline' } }}
                      >
                        {getComplexName(session.complex_id)}
                      </Typography>
                      <Typography variant="caption" sx={{ color: 'text.secondary' }}> / {session.slot_id}</Typography>
                    </Box>
                    <Box sx={{ textAlign: 'right', flexShrink: 0 }}>
                      <Chip
                        label={session.status === 'parked' ? '주차중' : session.status === 'completed' ? '출차' : '처리중'}
                        size="small"
                        sx={{
                          height: 20,
                          fontSize: '0.65rem',
                          fontWeight: 700,
                          bgcolor: session.status === 'parked' ? 'rgba(0,212,255,0.12)' : 'rgba(0,230,118,0.12)',
                          color: session.status === 'parked' ? 'primary.main' : 'success.main',
                        }}
                      />
                      <Typography variant="caption" sx={{ display: 'block', color: 'text.secondary', mt: 0.25, fontSize: '0.65rem' }}>
                        {new Date(session.entry_at).toLocaleString('ko-KR', { hour: '2-digit', minute: '2-digit' })}
                      </Typography>
                    </Box>
                  </Box>
                ))}
              </Box>
            </CardContent>
          </Card>
        </Grid>
      </Grid>
    </Box>
  );
}
