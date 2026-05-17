import { useState, useEffect, useCallback } from 'react';
import Box from '@mui/material/Box';
import Grid from '@mui/material/Grid';
import Card from '@mui/material/Card';
import CardContent from '@mui/material/CardContent';
import Typography from '@mui/material/Typography';
import Chip from '@mui/material/Chip';
import LinearProgress from '@mui/material/LinearProgress';
import CircularProgress from '@mui/material/CircularProgress';
import ToggleButton from '@mui/material/ToggleButton';
import ToggleButtonGroup from '@mui/material/ToggleButtonGroup';
import IconButton from '@mui/material/IconButton';
import DownloadIcon from '@mui/icons-material/Download';
import PrecisionManufacturingIcon from '@mui/icons-material/PrecisionManufacturing';
import ApartmentIcon from '@mui/icons-material/Apartment';
import ElevatorIcon from '@mui/icons-material/Elevator';
import ShieldIcon from '@mui/icons-material/Shield';
import BoltIcon from '@mui/icons-material/Bolt';
import CheckCircleIcon from '@mui/icons-material/CheckCircle';
import WarningIcon from '@mui/icons-material/Warning';
import ErrorIcon from '@mui/icons-material/Error';
import FiberManualRecordIcon from '@mui/icons-material/FiberManualRecord';
import Button from '@mui/material/Button';
import { supabase } from '../../lib/supabase';
import { useTenant } from '../contexts/TenantContext';
import { useDocumentTitle } from '../../hooks/useDocumentTitle';
import { useNavigate } from 'react-router-dom';

interface Complex {
  id: string;
  name: string;
  code: string;
  status: string;
  total_units: number;
  total_parking_slots: number;
  region: string;
}

interface AtrUnit {
  id: string;
  unit_code: string;
  status: string;
  battery_level: number;
  complex_id: string;
}

interface Elevator {
  id: string;
  elevator_code: string;
  status: string;
  complex_id: string;
}

interface SafetyEvent {
  id: string;
  complex_id: string;
  event_type: string;
  severity: string;
  description: string;
  result: string;
  created_at: string;
}

export default function SystemOverview() {
  useDocumentTitle('시스템 현황');
  const navigate = useNavigate();
  const { selectedComplex: tenantComplex } = useTenant();
  const [loading, setLoading] = useState(true);
  const [complexes, setComplexes] = useState<Complex[]>([]);
  const [atrUnits, setAtrUnits] = useState<AtrUnit[]>([]);
  const [elevators, setElevators] = useState<Elevator[]>([]);
  const [safetyEvents, setSafetyEvents] = useState<SafetyEvent[]>([]);
  const [period, setPeriod] = useState<'today' | '7d' | '30d'>('7d');

  const loadData = useCallback(async () => {
    let atrQuery = supabase.from('atr_units').select('*');
    let elevQuery = supabase.from('elevators').select('*');
    let safetyQuery = supabase.from('safety_events').select('*').order('created_at', { ascending: false }).limit(10);
    if (tenantComplex) {
      atrQuery = atrQuery.eq('complex_id', tenantComplex.id);
      elevQuery = elevQuery.eq('complex_id', tenantComplex.id);
      safetyQuery = safetyQuery.eq('complex_id', tenantComplex.id);
    }
    const [cRes, aRes, eRes, sRes] = await Promise.all([
      supabase.from('complexes').select('*'),
      atrQuery,
      elevQuery,
      safetyQuery,
    ]);
    if (cRes.data) setComplexes(cRes.data);
    if (aRes.data) setAtrUnits(aRes.data);
    if (eRes.data) setElevators(eRes.data);
    if (sRes.data) setSafetyEvents(sRes.data);
    setLoading(false);
  }, [tenantComplex]);

  useEffect(() => { loadData(); }, [loadData]);

  useEffect(() => {
    const channel = supabase.channel('system-overview-realtime')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'atr_units' }, () => { loadData(); })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'elevators' }, () => { loadData(); })
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'safety_events' }, () => { loadData(); })
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [loadData]);

  if (loading) {
    return (
      <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', minHeight: 300 }}>
        <CircularProgress sx={{ color: '#00d4ff' }} />
      </Box>
    );
  }

  const activeComplexes = complexes.filter((c) => c.status === 'active').length;
  const totalAtrs = atrUnits.length;
  const activeAtrs = atrUnits.filter((a) => a.status === 'idle' || a.status === 'transporting').length;
  const totalElevators = elevators.length;
  const operationalElevators = elevators.filter((e) => e.status === 'operational' || e.status === 'occupied').length;
  const systemAvailability = totalAtrs > 0 ? Math.round((activeAtrs / totalAtrs) * 100) : 0;

  const filteredSafetyEvents = safetyEvents.filter((event) => {
    const eventDate = new Date(event.created_at);
    const now = new Date();
    if (period === 'today') {
      return eventDate.toDateString() === now.toDateString();
    }
    if (period === '7d') {
      const cutoff = new Date(now);
      cutoff.setDate(cutoff.getDate() - 7);
      return eventDate >= cutoff;
    }
    if (period === '30d') {
      const cutoff = new Date(now);
      cutoff.setDate(cutoff.getDate() - 30);
      return eventDate >= cutoff;
    }
    return true;
  });

  const criticalEvents = filteredSafetyEvents.filter((e) => e.severity === 'critical').length;

  const handleExportCsv = () => {
    const headers = ['단지명', '단지코드', '상태', '세대수', '주차슬롯', 'ATR 가동/전체', '엘리베이터 수', '안전이벤트(기간내)'];
    const rows = complexes.map((complex) => {
      const cAtrs = atrUnits.filter((a) => a.complex_id === complex.id);
      const cActiveAtrs = cAtrs.filter((a) => a.status !== 'offline' && a.status !== 'error').length;
      const cElevs = elevators.filter((e) => e.complex_id === complex.id);
      const cEvents = filteredSafetyEvents.filter((e) => e.complex_id === complex.id).length;
      return [
        complex.name,
        complex.code,
        complex.status,
        complex.total_units,
        complex.total_parking_slots,
        `${cActiveAtrs}/${cAtrs.length}`,
        cElevs.length,
        cEvents,
      ];
    });
    const csv = '\uFEFF' + [headers, ...rows].map((r) => r.join(',')).join('\n');
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = `system_overview_${new Date().toISOString().slice(0, 10)}.csv`;
    link.click();
  };

  const statCards = [
    { label: '운영 단지', value: `${activeComplexes}/${complexes.length}`, icon: <ApartmentIcon />, color: '#00d4ff', sub: '활성 / 전체' },
    { label: 'ATR 로봇', value: `${activeAtrs}/${totalAtrs}`, icon: <PrecisionManufacturingIcon />, color: '#00e676', sub: '가동 / 전체' },
    { label: '차량 엘레베이터', value: `${operationalElevators}/${totalElevators}`, icon: <ElevatorIcon />, color: '#c9a84c', sub: '운영 / 전체' },
    { label: '안전 가용률', value: `${systemAvailability}%`, icon: <ShieldIcon />, color: systemAvailability >= 95 ? '#00e676' : '#ffc107', sub: 'ALLOW Gate 정상' },
  ];

  return (
    <Box>
      <Box sx={{ mb: 3, display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', flexWrap: 'wrap', gap: 2 }}>
        <Box>
          <Typography variant="h1" sx={{ mb: 0.5 }}>시스템 통합 현황</Typography>
          <Typography variant="body2" sx={{ color: 'text.secondary' }}>
            SkyGarage CCU (Central Control Unit) 실시간 운영 대시보드
          </Typography>
        </Box>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, flexWrap: 'wrap' }}>
          <Button variant="outlined" size="small" onClick={() => navigate('/admin/complexes')}>단지 관리</Button>
          <Button variant="outlined" size="small" onClick={() => navigate('/admin/atr')}>ATR</Button>
          <Button variant="outlined" size="small" onClick={() => navigate('/admin/elevators')}>엘리베이터</Button>
          <ToggleButtonGroup size="small" value={period} exclusive onChange={(_, v) => v && setPeriod(v)}>
            <ToggleButton value="today" sx={{ px: 1.5, fontSize: '0.75rem' }}>금일</ToggleButton>
            <ToggleButton value="7d" sx={{ px: 1.5, fontSize: '0.75rem' }}>7일</ToggleButton>
            <ToggleButton value="30d" sx={{ px: 1.5, fontSize: '0.75rem' }}>30일</ToggleButton>
          </ToggleButtonGroup>
          <IconButton size="small" onClick={handleExportCsv} title="CSV 다운로드">
            <DownloadIcon sx={{ fontSize: 20 }} />
          </IconButton>
          <Chip
            icon={<BoltIcon sx={{ fontSize: 16 }} />}
            label="실시간 모니터링"
            size="small"
            sx={{ bgcolor: 'rgba(0,230,118,0.12)', color: '#00e676', border: '1px solid rgba(0,230,118,0.3)', fontWeight: 700 }}
          />
        </Box>
      </Box>

      {/* Stat Cards */}
      <Grid container spacing={2.5} sx={{ mb: 3 }}>
        {statCards.map((stat) => (
          <Grid size={{ xs: 12, sm: 6, lg: 3 }} key={stat.label}>
            <Card sx={{ position: 'relative', overflow: 'hidden' }}>
              <Box sx={{ position: 'absolute', top: 0, left: 0, right: 0, height: 2, bgcolor: stat.color }} />
              <CardContent sx={{ p: '20px 24px !important' }}>
                <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                  <Box>
                    <Typography sx={{ fontSize: '0.8125rem', color: 'text.secondary', mb: 0.5 }}>{stat.label}</Typography>
                    <Typography sx={{ fontSize: '1.75rem', fontWeight: 800, color: '#ffffff', lineHeight: 1.2 }}>{stat.value}</Typography>
                    <Typography sx={{ fontSize: '0.7rem', color: 'rgba(176,184,200,0.6)', mt: 0.5 }}>{stat.sub}</Typography>
                  </Box>
                  <Box sx={{ width: 44, height: 44, borderRadius: 2, bgcolor: `${stat.color}15`, border: `1px solid ${stat.color}25`, display: 'flex', alignItems: 'center', justifyContent: 'center', color: stat.color }}>
                    {stat.icon}
                  </Box>
                </Box>
              </CardContent>
            </Card>
          </Grid>
        ))}
      </Grid>

      <Grid container spacing={2.5}>
        {/* Complex Status */}
        <Grid size={{ xs: 12, lg: 7 }}>
          <Card sx={{ height: '100%' }}>
            <CardContent sx={{ p: '20px 24px !important' }}>
              <Typography variant="h3" sx={{ mb: 2.5 }}>단지별 운영 현황</Typography>
              <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                {complexes.map((complex) => {
                  const cAtrs = atrUnits.filter((a) => a.complex_id === complex.id);
                  const cActiveAtrs = cAtrs.filter((a) => a.status !== 'offline' && a.status !== 'error').length;
                  const cElevs = elevators.filter((e) => e.complex_id === complex.id);
                  const statusColor = complex.status === 'active' ? '#00e676' : complex.status === 'poc' ? '#ffc107' : '#ff5252';
                  const statusLabel = complex.status === 'active' ? '운영중' : complex.status === 'poc' ? 'PoC' : '점검';
                  return (
                    <Box key={complex.id} sx={{ p: 2, borderRadius: 2, bgcolor: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.06)' }}>
                      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 1.5 }}>
                        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5 }}>
                          <FiberManualRecordIcon sx={{ fontSize: 10, color: statusColor }} />
                          <Box>
                            <Typography
                              onClick={() => navigate('/admin/complexes')}
                              sx={{ fontSize: '0.9375rem', fontWeight: 700, color: '#ffffff', cursor: 'pointer', '&:hover': { color: 'primary.main' } }}
                            >{complex.name}</Typography>
                            <Typography sx={{ fontSize: '0.75rem', color: '#b0b8c8' }}>{complex.code} | {complex.total_units}세대</Typography>
                          </Box>
                        </Box>
                        <Chip label={statusLabel} size="small" sx={{ bgcolor: `${statusColor}18`, color: statusColor, border: `1px solid ${statusColor}40`, fontWeight: 700, fontSize: '0.7rem' }} />
                      </Box>
                      <Grid container spacing={1.5}>
                        <Grid size={{ xs: 4 }}>
                          <Typography sx={{ fontSize: '0.7rem', color: 'text.secondary' }}>ATR 가동</Typography>
                          <Typography sx={{ fontSize: '0.875rem', fontWeight: 700, color: '#00e676' }}>{cActiveAtrs}/{cAtrs.length}</Typography>
                        </Grid>
                        <Grid size={{ xs: 4 }}>
                          <Typography sx={{ fontSize: '0.7rem', color: 'text.secondary' }}>엘리베이터</Typography>
                          <Typography sx={{ fontSize: '0.875rem', fontWeight: 700, color: '#c9a84c' }}>{cElevs.length}기</Typography>
                        </Grid>
                        <Grid size={{ xs: 4 }}>
                          <Typography sx={{ fontSize: '0.7rem', color: 'text.secondary' }}>주차 슬롯</Typography>
                          <Typography sx={{ fontSize: '0.875rem', fontWeight: 700, color: '#00d4ff' }}>{complex.total_parking_slots}</Typography>
                        </Grid>
                      </Grid>
                    </Box>
                  );
                })}
              </Box>
            </CardContent>
          </Card>
        </Grid>

        {/* Safety Events + ATR Battery */}
        <Grid size={{ xs: 12, lg: 5 }}>
          <Card sx={{ mb: 2.5 }}>
            <CardContent sx={{ p: '20px 24px !important' }}>
              <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2 }}>
                <Typography variant="h3">안전 이벤트 로그</Typography>
                {criticalEvents > 0 && (
                  <Chip label={`${criticalEvents} Critical`} size="small" sx={{ bgcolor: 'rgba(255,82,82,0.15)', color: '#ff5252', fontWeight: 700, fontSize: '0.7rem' }} />
                )}
              </Box>
              <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
                {filteredSafetyEvents.slice(0, 6).map((event) => {
                  const icon = event.severity === 'critical' ? <ErrorIcon sx={{ fontSize: 14 }} /> : event.severity === 'warning' ? <WarningIcon sx={{ fontSize: 14 }} /> : <CheckCircleIcon sx={{ fontSize: 14 }} />;
                  const color = event.severity === 'critical' ? '#ff5252' : event.severity === 'warning' ? '#ffc107' : '#00e676';
                  return (
                    <Box key={event.id} sx={{ display: 'flex', gap: 1.5, py: 0.75 }}>
                      <Box sx={{ color, mt: 0.25 }}>{icon}</Box>
                      <Box sx={{ minWidth: 0, flex: 1 }}>
                        <Typography sx={{ fontSize: '0.8125rem', color: '#e0e6f0', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                          {event.description}
                        </Typography>
                        <Typography sx={{ fontSize: '0.7rem', color: 'rgba(176,184,200,0.6)' }}>
                          {new Date(event.created_at).toLocaleString('ko-KR', { month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit' })}
                        </Typography>
                      </Box>
                    </Box>
                  );
                })}
              </Box>
            </CardContent>
          </Card>

          <Card>
            <CardContent sx={{ p: '20px 24px !important' }}>
              <Typography variant="h3" sx={{ mb: 2 }}>ATR 배터리 현황</Typography>
              <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1.5 }}>
                {atrUnits.slice(0, 6).map((atr) => {
                  const battColor = atr.battery_level > 60 ? '#00e676' : atr.battery_level > 30 ? '#ffc107' : '#ff5252';
                  return (
                    <Box key={atr.id}>
                      <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 0.5 }}>
                        <Typography sx={{ fontSize: '0.8125rem', color: '#e0e6f0' }}>{atr.unit_code}</Typography>
                        <Typography sx={{ fontSize: '0.75rem', fontWeight: 700, color: battColor }}>{atr.battery_level}%</Typography>
                      </Box>
                      <LinearProgress
                        variant="determinate"
                        value={atr.battery_level}
                        sx={{ height: 6, borderRadius: 3, bgcolor: 'rgba(255,255,255,0.06)', '& .MuiLinearProgress-bar': { bgcolor: battColor, borderRadius: 3 } }}
                      />
                    </Box>
                  );
                })}
              </Box>
            </CardContent>
          </Card>
        </Grid>
      </Grid>
    </Box>
  );
}
