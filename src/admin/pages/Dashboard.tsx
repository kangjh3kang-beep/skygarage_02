import { useState, useEffect, useCallback } from 'react';
import Box from '@mui/material/Box';
import Grid from '@mui/material/Grid';
import Card from '@mui/material/Card';
import CardContent from '@mui/material/CardContent';
import Typography from '@mui/material/Typography';
import Chip from '@mui/material/Chip';
import LinearProgress from '@mui/material/LinearProgress';
import List from '@mui/material/List';
import ListItemButton from '@mui/material/ListItemButton';
import ListItemIcon from '@mui/material/ListItemIcon';
import ListItemText from '@mui/material/ListItemText';
import Skeleton from '@mui/material/Skeleton';
import Button from '@mui/material/Button';
import ApartmentIcon from '@mui/icons-material/Apartment';
import PeopleIcon from '@mui/icons-material/People';
import LocalParkingIcon from '@mui/icons-material/LocalParking';
import BoltIcon from '@mui/icons-material/Bolt';
import TrendingUpIcon from '@mui/icons-material/TrendingUp';
import BuildIcon from '@mui/icons-material/Build';
import WarningAmberIcon from '@mui/icons-material/WarningAmber';
import CheckCircleIcon from '@mui/icons-material/CheckCircle';
import ScheduleIcon from '@mui/icons-material/Schedule';
import DescriptionIcon from '@mui/icons-material/Description';
import SupportAgentIcon from '@mui/icons-material/SupportAgent';
import InboxIcon from '@mui/icons-material/Inbox';
import ImageIcon from '@mui/icons-material/Image';
import SecurityIcon from '@mui/icons-material/Security';
import HandshakeIcon from '@mui/icons-material/Handshake';
import MonitorHeartIcon from '@mui/icons-material/MonitorHeart';
import EnergySavingsLeafIcon from '@mui/icons-material/EnergySavingsLeaf';
import PrecisionManufacturingIcon from '@mui/icons-material/PrecisionManufacturing';
import ElevatorIcon from '@mui/icons-material/Elevator';
import StorageIcon from '@mui/icons-material/Storage';
import AccessibleIcon from '@mui/icons-material/Accessible';
import ArrowForwardIcon from '@mui/icons-material/ArrowForward';
import { supabase } from '../../lib/supabase';
import { useDocumentTitle } from '../../hooks/useDocumentTitle';
import { useTenant } from '../contexts/TenantContext';
import { useAuth } from '../contexts/AuthContext';
import { useNavigate } from 'react-router-dom';
import EngagementWidget from '../components/EngagementWidget';
import Sparkline from '../components/Sparkline';

interface SystemHealth {
  atrTotal: number;
  atrOperational: number;
  elevatorTotal: number;
  elevatorOperational: number;
  parkingTotal: number;
}

interface DQMetrics {
  avgScore: number;
  totalComplexes: number;
  highQuality: number;
  lowQuality: number;
  avgCompleteness: number;
}

function buildDailyCountSpark(rows: { [key: string]: string | null }[], dateField: string, days: number): number[] {
  const counts: number[] = Array(days).fill(0);
  const now = new Date();
  for (const row of rows) {
    const val = row[dateField];
    if (!val) continue;
    const date = new Date(val);
    const daysAgo = Math.floor((now.getTime() - date.getTime()) / 86400000);
    if (daysAgo >= 0 && daysAgo < days) counts[days - 1 - daysAgo]++;
  }
  return counts;
}

export default function Dashboard() {
  useDocumentTitle('Dashboard');
  const { scope, scopeLevel } = useTenant();
  const { role } = useAuth();
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [stats, setStats] = useState({ complexes: 0, residents: 0, activeSessions: 0, energyToday: 0 });
  const [systemHealth, setSystemHealth] = useState<SystemHealth>({ atrTotal: 0, atrOperational: 0, elevatorTotal: 0, elevatorOperational: 0, parkingTotal: 0 });
  const [recentAlerts, setRecentAlerts] = useState<{ id: string; title: string; severity: string; created_at: string }[]>([]);
  const [recentTickets, setRecentTickets] = useState<{ id: string; subject: string; status: string; created_at: string }[]>([]);
  const [dqMetrics, setDqMetrics] = useState<DQMetrics>({ avgScore: 0, totalComplexes: 0, highQuality: 0, lowQuality: 0, avgCompleteness: 0 });
  const [sparkData, setSparkData] = useState<Record<string, number[]>>({});
  const [aiRecommendations, setAiRecommendations] = useState<{ id: string; title: string; priority: string; type: string; status: string }[]>([]);
  const [atrModes, setAtrModes] = useState<{ autonomous: number; semi_autonomous: number; manual: number }>({ autonomous: 0, semi_autonomous: 0, manual: 0 });
  const [priorityDispatch, setPriorityDispatch] = useState({ activePriority: 0, totalProfiles: 0, verified: 0, avgWait: 0 });

  const isGlobal = role === 'super_admin' && scopeLevel === 'global';
  const scopeComplexId = scope.complex?.id || null;

  const loadData = useCallback(async () => {
    setLoading(true);
    try {
    let cQuery = supabase.from('complexes').select('id', { count: 'exact', head: true });
    let rQuery = supabase.from('resident_accounts').select('id', { count: 'exact', head: true });
    let sQuery = supabase.from('parking_sessions').select('id', { count: 'exact', head: true }).is('exit_at', null);
    let eQuery = supabase.from('energy_metrics').select('solar_generation_kwh').order('date', { ascending: false }).limit(10);
    let alertQuery = supabase.from('system_alerts').select('id, title, severity, created_at').order('created_at', { ascending: false }).limit(5);
    let ticketQuery = supabase.from('support_tickets').select('id, subject, status, created_at').order('created_at', { ascending: false }).limit(5);
    let atrQuery = supabase.from('atr_units').select('id, status, operating_mode');
    let elevQuery = supabase.from('elevators').select('id, status');
    let complexSlotsQuery = supabase.from('complexes').select('total_parking_slots');
    let dqQuery = supabase.from('complexes').select('data_quality_score, completeness_ratio');

    if (!isGlobal && scopeComplexId) {
      cQuery = cQuery.eq('id', scopeComplexId);
      rQuery = rQuery.eq('complex_id', scopeComplexId);
      sQuery = sQuery.eq('complex_id', scopeComplexId);
      eQuery = eQuery.eq('complex_id', scopeComplexId);
      alertQuery = alertQuery.eq('complex_id', scopeComplexId);
      ticketQuery = ticketQuery.eq('complex_id', scopeComplexId);
      atrQuery = atrQuery.eq('complex_id', scopeComplexId);
      elevQuery = elevQuery.eq('complex_id', scopeComplexId);
      complexSlotsQuery = complexSlotsQuery.eq('id', scopeComplexId);
      dqQuery = dqQuery.eq('id', scopeComplexId);
    }

    const [cRes, rRes, sRes, eRes, alertRes, ticketRes, atrRes, elevRes, complexSlotsRes, dqRes] = await Promise.all([
      cQuery, rQuery, sQuery, eQuery, alertQuery, ticketQuery, atrQuery, elevQuery, complexSlotsQuery, dqQuery,
    ]);

    setStats({
      complexes: cRes.count || 0,
      residents: rRes.count || 0,
      activeSessions: sRes.count || 0,
      energyToday: eRes.data?.reduce((s, r) => s + (r.solar_generation_kwh || 0), 0) || 0,
    });

    const atrs = atrRes.data || [];
    const elevs = elevRes.data || [];
    const totalSlots = complexSlotsRes.data?.reduce((s, c) => s + (c.total_parking_slots || 0), 0) || 0;

    setSystemHealth({
      atrTotal: atrs.length,
      atrOperational: atrs.filter(a => ['idle', 'transporting', 'charging'].includes(a.status)).length,
      elevatorTotal: elevs.length,
      elevatorOperational: elevs.filter(e => ['operational', 'occupied'].includes(e.status)).length,
      parkingTotal: totalSlots,
    });

    const modes = { autonomous: 0, semi_autonomous: 0, manual: 0 };
    for (const a of atrs) {
      const m = (a as { operating_mode?: string }).operating_mode || 'manual';
      if (m === 'autonomous') modes.autonomous++;
      else if (m === 'semi_autonomous') modes.semi_autonomous++;
      else modes.manual++;
    }
    setAtrModes(modes);

    if (alertRes.data) setRecentAlerts(alertRes.data);
    if (ticketRes.data) setRecentTickets(ticketRes.data);

    const dqData = dqRes.data || [];
    if (dqData.length > 0) {
      const avgScore = Math.round(dqData.reduce((s, d) => s + (d.data_quality_score || 0), 0) / dqData.length);
      const avgComp = Math.round((dqData.reduce((s, d) => s + (d.completeness_ratio || 0), 0) / dqData.length) * 100);
      setDqMetrics({
        avgScore,
        totalComplexes: dqData.length,
        highQuality: dqData.filter(d => (d.data_quality_score || 0) >= 80).length,
        lowQuality: dqData.filter(d => (d.data_quality_score || 0) < 50).length,
        avgCompleteness: avgComp,
      });
    }

    const energyData = eRes.data || [];
    const energySpark = energyData.map(r => r.solar_generation_kwh || 0).reverse();

    let parkingHistoryQuery = supabase
      .from('parking_sessions')
      .select('entry_at')
      .order('entry_at', { ascending: false })
      .limit(50);
    if (!isGlobal && scopeComplexId) parkingHistoryQuery = parkingHistoryQuery.eq('complex_id', scopeComplexId);
    const { data: parkingHistory } = await parkingHistoryQuery;

    const parkingSpark = buildDailyCountSpark(parkingHistory || [], 'entry_at', 7);

    setSparkData({
      energy: energySpark.length >= 2 ? energySpark : [],
      parking: parkingSpark,
    });

    let aiQuery = supabase
      .from('ai_recommendations')
      .select('id, title, priority, type, status')
      .in('status', ['pending', 'acknowledged'])
      .order('created_at', { ascending: false })
      .limit(5);
    if (!isGlobal && scopeComplexId) aiQuery = aiQuery.eq('complex_id', scopeComplexId);
    const { data: aiRecs } = await aiQuery;
    if (aiRecs) setAiRecommendations(aiRecs);

    let priorityQuery = supabase.from('parking_sessions').select('id', { count: 'exact', head: true }).eq('is_priority_dispatch', true).is('exit_at', null);
    let profilesQuery = supabase.from('resident_accessibility_profiles').select('id, verified, active').eq('active', true);
    if (!isGlobal && scopeComplexId) {
      priorityQuery = priorityQuery.eq('complex_id', scopeComplexId);
      profilesQuery = profilesQuery.eq('complex_id', scopeComplexId);
    }

    const [prioritySessionsRes, profilesRes] = await Promise.all([priorityQuery, profilesQuery]);
    const profs = profilesRes.data || [];
    setPriorityDispatch({
      activePriority: prioritySessionsRes.count || 0,
      totalProfiles: profs.length,
      verified: profs.filter(p => p.verified).length,
      avgWait: 0,
    });
    } catch (err) {
      console.error('Dashboard load error:', err);
    } finally {
      setLoading(false);
    }
  }, [isGlobal, scopeComplexId]);

  useEffect(() => { loadData(); }, [loadData]);

  useEffect(() => {
    const channel = supabase.channel('dashboard-realtime')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'parking_sessions' }, () => { loadData(); })
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'system_alerts' }, () => { loadData(); })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'atr_units' }, () => { loadData(); })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'elevators' }, () => { loadData(); })
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [loadData]);

  if (loading) {
    return (
      <Box>
        <Skeleton variant="text" width={240} height={36} sx={{ mb: 3 }} />
        <Grid container spacing={2.5}>
          {[1, 2, 3, 4].map(i => (
            <Grid size={{ xs: 6, md: 3 }} key={i}>
              <Skeleton variant="rectangular" height={120} sx={{ borderRadius: 2.5 }} />
            </Grid>
          ))}
        </Grid>
        <Grid container spacing={2.5} sx={{ mt: 1.5 }}>
          {[1, 2, 3].map(i => (
            <Grid size={{ xs: 12, md: 4 }} key={i}>
              <Skeleton variant="rectangular" height={220} sx={{ borderRadius: 2.5 }} />
            </Grid>
          ))}
        </Grid>
      </Box>
    );
  }

  const kpis = [
    { label: '단지', value: stats.complexes, unit: '개', icon: <ApartmentIcon />, color: 'primary.main', path: '/admin/complexes', sparkKey: '' },
    { label: '사용자', value: stats.residents, unit: '명', icon: <PeopleIcon />, color: 'success.main', path: '/admin/residents', sparkKey: '' },
    { label: '주차 중', value: stats.activeSessions, unit: '대', icon: <LocalParkingIcon />, color: 'warning.main', path: '/admin/parking', sparkKey: 'parking' },
    { label: '발전량', value: stats.energyToday.toFixed(0), unit: 'kWh', icon: <BoltIcon />, color: 'secondary.main', path: '/admin/energy', sparkKey: 'energy' },
  ];

  const atrUptimePct = systemHealth.atrTotal > 0
    ? Math.round((systemHealth.atrOperational / systemHealth.atrTotal) * 100)
    : null;

  const elevUptimePct = systemHealth.elevatorTotal > 0
    ? Math.round((systemHealth.elevatorOperational / systemHealth.elevatorTotal) * 100)
    : null;

  const parkingUsagePct = systemHealth.parkingTotal > 0
    ? Math.min(Math.round((stats.activeSessions / systemHealth.parkingTotal) * 100), 100)
    : stats.complexes > 0
      ? Math.min(Math.round((stats.activeSessions / (stats.complexes * 50)) * 100), 100)
      : 0;

  const severityColor = (s: string) => {
    if (s === 'critical') return 'error';
    if (s === 'warning') return 'warning';
    return 'info';
  };

  const statusColor = (s: string) => {
    if (s === 'open') return 'error';
    if (s === 'in_progress') return 'warning';
    return 'success';
  };

  const statusLabel = (s: string) => {
    if (s === 'open') return '미처리';
    if (s === 'in_progress') return '진행중';
    if (s === 'resolved' || s === 'closed') return '완료';
    return s;
  };

  return (
    <Box>
      {/* Header */}
      <Box sx={{ mb: 3.5, display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 1 }}>
        <Box>
          <Typography variant="h1" sx={{ mb: 0.25 }}>Dashboard</Typography>
          <Typography variant="body2" color="text.secondary">시스템 현황을 한눈에 확인하세요</Typography>
        </Box>
        <Box sx={{ display: 'flex', gap: 1 }}>
          <Chip
            label="Live"
            size="small"
            color="success"
            variant="outlined"
            sx={{ fontSize: '0.65rem', fontWeight: 700, height: 24, '& .MuiChip-label': { px: 1 } }}
          />
        </Box>
      </Box>

      {/* KPI Cards */}
      <Grid container spacing={2}>
        {kpis.map(kpi => {
          const spark = kpi.sparkKey ? sparkData[kpi.sparkKey] : undefined;
          return (
            <Grid size={{ xs: 6, md: 3 }} key={kpi.label}>
              <Card
                sx={{ cursor: 'pointer', transition: 'all 0.2s ease', '&:hover': { borderColor: 'primary.main', transform: 'translateY(-2px)' } }}
                onClick={() => navigate(kpi.path)}
              >
                <CardContent sx={{ p: 2.5, '&:last-child': { pb: 2.5 } }}>
                  <Box sx={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', mb: 2 }}>
                    <Typography variant="body2" color="text.secondary" sx={{ fontWeight: 500 }}>
                      {kpi.label}
                    </Typography>
                    <Box sx={{ color: kpi.color, opacity: 0.8, '& .MuiSvgIcon-root': { fontSize: 20 } }}>{kpi.icon}</Box>
                  </Box>
                  <Box sx={{ display: 'flex', alignItems: 'baseline', gap: 0.5 }}>
                    <Typography sx={{ fontSize: '1.75rem', fontWeight: 700, lineHeight: 1, letterSpacing: '-0.02em' }}>
                      {kpi.value}
                    </Typography>
                    <Typography variant="body2" color="text.secondary">
                      {kpi.unit}
                    </Typography>
                  </Box>
                  {spark && spark.length >= 2 && (
                    <Box sx={{ mt: 1.5 }}>
                      <Sparkline data={spark} width={120} height={24} color={kpi.color.replace('.main', '') === 'warning' ? '#ed6c02' : kpi.color.replace('.main', '') === 'secondary' ? '#0891b2' : '#0ea5e9'} />
                    </Box>
                  )}
                </CardContent>
              </Card>
            </Grid>
          );
        })}
      </Grid>

      {/* Engagement Widget */}
      <Grid container spacing={2} sx={{ mt: 0.5 }}>
        <Grid size={{ xs: 12, md: 5, lg: 4 }}>
          <EngagementWidget />
        </Grid>
      </Grid>

      {/* System Status + Recent Alerts + Recent Tickets */}
      <Grid container spacing={2} sx={{ mt: 0.5 }}>
        {/* System Health */}
        <Grid size={{ xs: 12, md: 4 }}>
          <Card sx={{ height: '100%' }}>
            <CardContent sx={{ p: 2.5 }}>
              <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 2.5 }}>
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                  <Box sx={{ width: 6, height: 6, borderRadius: '50%', bgcolor: 'success.main', animation: 'pulse 2s infinite', '@keyframes pulse': { '0%, 100%': { opacity: 1 }, '50%': { opacity: 0.5 } } }} />
                  <Typography variant="subtitle2">시스템 상태</Typography>
                </Box>
              </Box>
              <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2.5 }}>
                {/* ATR */}
                <Box>
                  <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 0.75 }}>
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.75 }}>
                      <PrecisionManufacturingIcon sx={{ fontSize: 15, color: 'text.secondary' }} />
                      <Typography variant="body2" color="text.secondary" sx={{ fontSize: '0.78rem' }}>ATR 로봇</Typography>
                    </Box>
                    {atrUptimePct !== null ? (
                      <Typography variant="caption" color={atrUptimePct >= 90 ? 'success.main' : atrUptimePct >= 70 ? 'warning.main' : 'error.main'} sx={{ fontWeight: 600 }}>
                        {systemHealth.atrOperational}/{systemHealth.atrTotal} ({atrUptimePct}%)
                      </Typography>
                    ) : (
                      <Typography variant="caption" color="text.secondary">-</Typography>
                    )}
                  </Box>
                  <LinearProgress
                    variant="determinate"
                    value={atrUptimePct ?? 0}
                    color={atrUptimePct !== null && atrUptimePct >= 90 ? 'success' : atrUptimePct !== null && atrUptimePct >= 70 ? 'warning' : 'error'}
                    sx={{ borderRadius: 2, height: 5, bgcolor: 'action.hover' }}
                  />
                </Box>

                {/* Elevators */}
                <Box>
                  <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 0.75 }}>
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.75 }}>
                      <ElevatorIcon sx={{ fontSize: 15, color: 'text.secondary' }} />
                      <Typography variant="body2" color="text.secondary" sx={{ fontSize: '0.78rem' }}>엘리베이터</Typography>
                    </Box>
                    {elevUptimePct !== null ? (
                      <Typography variant="caption" color={elevUptimePct >= 90 ? 'primary' : elevUptimePct >= 70 ? 'warning.main' : 'error.main'} sx={{ fontWeight: 600 }}>
                        {systemHealth.elevatorOperational}/{systemHealth.elevatorTotal} ({elevUptimePct}%)
                      </Typography>
                    ) : (
                      <Typography variant="caption" color="text.secondary">-</Typography>
                    )}
                  </Box>
                  <LinearProgress
                    variant="determinate"
                    value={elevUptimePct ?? 0}
                    color="primary"
                    sx={{ borderRadius: 2, height: 5, bgcolor: 'action.hover' }}
                  />
                </Box>

                {/* Parking */}
                <Box>
                  <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 0.75 }}>
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.75 }}>
                      <LocalParkingIcon sx={{ fontSize: 15, color: 'text.secondary' }} />
                      <Typography variant="body2" color="text.secondary" sx={{ fontSize: '0.78rem' }}>주차장 사용률</Typography>
                    </Box>
                    <Typography variant="caption" color="warning.main" sx={{ fontWeight: 600 }}>
                      {stats.activeSessions}{systemHealth.parkingTotal > 0 ? `/${systemHealth.parkingTotal}` : ''} ({parkingUsagePct}%)
                    </Typography>
                  </Box>
                  <LinearProgress
                    variant="determinate"
                    value={parkingUsagePct}
                    color="warning"
                    sx={{ borderRadius: 2, height: 5, bgcolor: 'action.hover' }}
                  />
                </Box>

                {/* ATR Operating Modes */}
                {systemHealth.atrTotal > 0 && (
                  <Box>
                    <Typography variant="caption" color="text.secondary" sx={{ mb: 1, display: 'block', fontSize: '0.72rem' }}>운영 모드 분포</Typography>
                    <Box sx={{ display: 'flex', gap: 0.75 }}>
                      {[
                        { key: 'autonomous', label: '자율', color: 'success.main' },
                        { key: 'semi_autonomous', label: '반자율', color: 'warning.main' },
                        { key: 'manual', label: '수동', color: 'text.secondary' },
                      ].map(m => (
                        <Box key={m.key} sx={{ flex: 1, textAlign: 'center', py: 0.75, px: 0.5, borderRadius: 1.5, bgcolor: 'action.hover' }}>
                          <Typography sx={{ fontSize: '0.875rem', color: m.color, fontWeight: 700, lineHeight: 1.2 }}>{atrModes[m.key as keyof typeof atrModes]}</Typography>
                          <Typography variant="caption" sx={{ fontSize: '0.6rem', color: 'text.secondary' }}>{m.label}</Typography>
                        </Box>
                      ))}
                    </Box>
                  </Box>
                )}
              </Box>
            </CardContent>
          </Card>
        </Grid>

        {/* Recent Alerts */}
        <Grid size={{ xs: 12, md: 4 }}>
          <Card sx={{ height: '100%' }}>
            <CardContent sx={{ p: 2.5 }}>
              <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 2 }}>
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                  <WarningAmberIcon sx={{ fontSize: 18, color: 'warning.main' }} />
                  <Typography variant="subtitle2">최근 알림</Typography>
                </Box>
                {recentAlerts.length > 0 && (
                  <Chip label={recentAlerts.length} size="small" color="warning" variant="outlined" sx={{ height: 20, fontSize: '0.65rem', fontWeight: 600 }} />
                )}
              </Box>
              {recentAlerts.length === 0 ? (
                <Box sx={{ display: 'flex', flexDirection: 'column', alignItems: 'center', py: 4, gap: 1 }}>
                  <CheckCircleIcon sx={{ fontSize: 28, color: 'success.main', opacity: 0.6 }} />
                  <Typography variant="body2" color="text.secondary">현재 알림이 없습니다</Typography>
                </Box>
              ) : (
                <List disablePadding dense>
                  {recentAlerts.slice(0, 4).map(alert => (
                    <ListItemButton
                      key={alert.id}
                      onClick={() => navigate('/admin/alerts')}
                      sx={{ borderRadius: 1.5, px: 1.5, py: 0.75, mb: 0.5 }}
                    >
                      <ListItemIcon sx={{ minWidth: 28 }}>
                        <WarningAmberIcon sx={{ fontSize: 15, color: `${severityColor(alert.severity)}.main` }} />
                      </ListItemIcon>
                      <ListItemText
                        primary={alert.title}
                        secondary={new Date(alert.created_at).toLocaleDateString('ko-KR')}
                        slotProps={{
                          primary: { sx: { fontSize: '0.78rem', fontWeight: 600, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' } },
                          secondary: { sx: { fontSize: '0.65rem' } },
                        }}
                      />
                    </ListItemButton>
                  ))}
                </List>
              )}
            </CardContent>
          </Card>
        </Grid>

        {/* Recent Tickets */}
        <Grid size={{ xs: 12, md: 4 }}>
          <Card sx={{ height: '100%' }}>
            <CardContent sx={{ p: 2.5 }}>
              <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 2 }}>
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                  <BuildIcon sx={{ fontSize: 18, color: 'primary.main' }} />
                  <Typography variant="subtitle2">지원 티켓</Typography>
                </Box>
                {recentTickets.length > 0 && (
                  <Chip label={recentTickets.length} size="small" color="primary" variant="outlined" sx={{ height: 20, fontSize: '0.65rem', fontWeight: 600 }} />
                )}
              </Box>
              {recentTickets.length === 0 ? (
                <Box sx={{ display: 'flex', flexDirection: 'column', alignItems: 'center', py: 4, gap: 1 }}>
                  <CheckCircleIcon sx={{ fontSize: 28, color: 'success.main', opacity: 0.6 }} />
                  <Typography variant="body2" color="text.secondary">현재 티켓이 없습니다</Typography>
                </Box>
              ) : (
                <List disablePadding dense>
                  {recentTickets.slice(0, 4).map(ticket => (
                    <ListItemButton
                      key={ticket.id}
                      onClick={() => navigate('/admin/tickets')}
                      sx={{ borderRadius: 1.5, px: 1.5, py: 0.75, mb: 0.5 }}
                    >
                      <ListItemIcon sx={{ minWidth: 28 }}>
                        <ScheduleIcon sx={{ fontSize: 15, color: `${statusColor(ticket.status)}.main` }} />
                      </ListItemIcon>
                      <ListItemText
                        primary={ticket.subject}
                        slotProps={{ primary: { sx: { fontSize: '0.78rem', fontWeight: 600 } } }}
                      />
                      <Chip
                        label={statusLabel(ticket.status)}
                        size="small"
                        color={statusColor(ticket.status)}
                        variant="outlined"
                        sx={{ fontSize: '0.6rem', height: 20 }}
                      />
                    </ListItemButton>
                  ))}
                </List>
              )}
            </CardContent>
          </Card>
        </Grid>
      </Grid>

      {/* AI Recommendations */}
      {aiRecommendations.length > 0 && (
        <Grid container spacing={2} sx={{ mt: 0.5 }}>
          <Grid size={{ xs: 12 }}>
            <Card>
              <CardContent sx={{ p: 2.5 }}>
                <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 2 }}>
                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                    <PrecisionManufacturingIcon sx={{ fontSize: 18, color: 'primary.main' }} />
                    <Typography variant="subtitle2">AI 권장사항</Typography>
                    <Chip label={`${aiRecommendations.length}건`} size="small" color="primary" variant="outlined" sx={{ fontSize: '0.65rem', height: 20, fontWeight: 600 }} />
                  </Box>
                  <Button
                    variant="text"
                    size="small"
                    endIcon={<ArrowForwardIcon sx={{ fontSize: 14 }} />}
                    onClick={() => navigate('/admin/ai-management')}
                    sx={{ fontSize: '0.75rem' }}
                  >
                    전체 보기
                  </Button>
                </Box>
                <List disablePadding dense>
                  {aiRecommendations.map(rec => (
                    <ListItemButton
                      key={rec.id}
                      onClick={() => navigate('/admin/ai-management')}
                      sx={{ borderRadius: 1.5, px: 1.5, py: 0.75, mb: 0.5 }}
                    >
                      <ListItemText
                        primary={rec.title}
                        slotProps={{ primary: { sx: { fontSize: '0.78rem', fontWeight: 600 } } }}
                      />
                      <Chip
                        label={rec.priority}
                        size="small"
                        color={rec.priority === 'high' ? 'error' : rec.priority === 'medium' ? 'warning' : 'default'}
                        variant="outlined"
                        sx={{ fontSize: '0.6rem', height: 20 }}
                      />
                    </ListItemButton>
                  ))}
                </List>
              </CardContent>
            </Card>
          </Grid>
        </Grid>
      )}

      {/* Data Quality + Priority Dispatch */}
      <Grid container spacing={2} sx={{ mt: 0.5 }}>
        {/* Data Quality Metrics */}
        {dqMetrics.totalComplexes > 0 && (
          <Grid size={{ xs: 12, md: 6 }}>
            <Card sx={{ height: '100%' }}>
              <CardContent sx={{ p: 2.5 }}>
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 2.5 }}>
                  <StorageIcon sx={{ fontSize: 18, color: 'primary.main' }} />
                  <Typography variant="subtitle2">데이터 품질 (MDM)</Typography>
                  <Chip label={`${dqMetrics.totalComplexes}개`} size="small" variant="outlined" sx={{ fontSize: '0.6rem', height: 18 }} />
                </Box>
                <Grid container spacing={1.5}>
                  {[
                    { label: 'DQ 스코어', value: `${dqMetrics.avgScore}%`, color: dqMetrics.avgScore >= 80 ? 'success.main' : dqMetrics.avgScore >= 50 ? 'warning.main' : 'error.main' },
                    { label: '완성도', value: `${dqMetrics.avgCompleteness}%`, color: 'text.primary' },
                    { label: '우수', value: String(dqMetrics.highQuality), color: 'success.main' },
                    { label: '개선 필요', value: String(dqMetrics.lowQuality), color: dqMetrics.lowQuality > 0 ? 'error.main' : 'text.primary' },
                  ].map(item => (
                    <Grid size={{ xs: 6 }} key={item.label}>
                      <Box sx={{ p: 1.5, borderRadius: 2, bgcolor: 'action.hover', textAlign: 'center' }}>
                        <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mb: 0.5, fontSize: '0.68rem' }}>{item.label}</Typography>
                        <Typography sx={{ fontSize: '1.25rem', fontWeight: 700, color: item.color, lineHeight: 1 }}>{item.value}</Typography>
                      </Box>
                    </Grid>
                  ))}
                </Grid>
              </CardContent>
            </Card>
          </Grid>
        )}

        {/* Priority Dispatch Widget */}
        <Grid size={{ xs: 12, md: dqMetrics.totalComplexes > 0 ? 6 : 12 }}>
          <Card
            sx={{ height: '100%', cursor: 'pointer', transition: 'all 0.2s ease', '&:hover': { borderColor: 'warning.main' } }}
            onClick={() => navigate('/admin/priority-dispatch')}
          >
            <CardContent sx={{ p: 2.5 }}>
              <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 2.5 }}>
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                  <AccessibleIcon sx={{ fontSize: 18, color: 'warning.main' }} />
                  <Typography variant="subtitle2">교통약자 우선배차</Typography>
                </Box>
                <Button
                  variant="text"
                  size="small"
                  endIcon={<ArrowForwardIcon sx={{ fontSize: 14 }} />}
                  onClick={(e) => { e.stopPropagation(); navigate('/admin/priority-dispatch'); }}
                  sx={{ fontSize: '0.75rem' }}
                >
                  관리
                </Button>
              </Box>
              <Grid container spacing={1.5}>
                {[
                  { label: '배차 대기', value: String(priorityDispatch.activePriority), color: 'warning.main' },
                  { label: '등록 프로필', value: String(priorityDispatch.totalProfiles), color: 'text.primary' },
                  { label: '인증 완료', value: String(priorityDispatch.verified), color: 'success.main' },
                  { label: '인증율', value: `${priorityDispatch.totalProfiles > 0 ? Math.round((priorityDispatch.verified / priorityDispatch.totalProfiles) * 100) : 0}%`, color: 'text.primary' },
                ].map(item => (
                  <Grid size={{ xs: 6, sm: 3 }} key={item.label}>
                    <Box sx={{ p: 1.5, borderRadius: 2, bgcolor: 'action.hover', textAlign: 'center' }}>
                      <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mb: 0.5, fontSize: '0.68rem' }}>{item.label}</Typography>
                      <Typography sx={{ fontSize: '1.25rem', fontWeight: 700, color: item.color, lineHeight: 1 }}>{item.value}</Typography>
                    </Box>
                  </Grid>
                ))}
              </Grid>
            </CardContent>
          </Card>
        </Grid>
      </Grid>

      {/* Quick Navigation */}
      <Grid container spacing={2} sx={{ mt: 0.5 }}>
        <Grid size={{ xs: 12 }}>
          <Card>
            <CardContent sx={{ p: 2.5 }}>
              <Typography variant="subtitle2" sx={{ mb: 2 }}>빠른 이동</Typography>
              <Grid container spacing={1}>
                {[
                  { label: '단지 관리', path: '/admin/complexes', icon: <ApartmentIcon sx={{ fontSize: 18 }} /> },
                  { label: '정비 관리', path: '/admin/maintenance', icon: <BuildIcon sx={{ fontSize: 18 }} /> },
                  { label: 'NOC', path: '/admin/noc', icon: <MonitorHeartIcon sx={{ fontSize: 18 }} /> },
                  { label: '보안 감사', path: '/admin/security', icon: <SecurityIcon sx={{ fontSize: 18 }} /> },
                  { label: '계약', path: '/admin/contracts', icon: <DescriptionIcon sx={{ fontSize: 18 }} /> },
                  { label: 'CRM', path: '/admin/crm', icon: <SupportAgentIcon sx={{ fontSize: 18 }} /> },
                  { label: '문의', path: '/admin/inquiries', icon: <InboxIcon sx={{ fontSize: 18 }} /> },
                  { label: '이미지', path: '/admin/images', icon: <ImageIcon sx={{ fontSize: 18 }} /> },
                  { label: '파트너', path: '/admin/partners', icon: <HandshakeIcon sx={{ fontSize: 18 }} /> },
                  { label: 'ESG', path: '/admin/esg', icon: <EnergySavingsLeafIcon sx={{ fontSize: 18 }} /> },
                  { label: '알림', path: '/admin/alerts', icon: <WarningAmberIcon sx={{ fontSize: 18 }} /> },
                  { label: '분석', path: '/admin/analytics', icon: <TrendingUpIcon sx={{ fontSize: 18 }} /> },
                ].map(item => (
                  <Grid size={{ xs: 4, sm: 3, md: 2 }} key={item.path}>
                    <Box
                      onClick={() => navigate(item.path)}
                      sx={{
                        display: 'flex',
                        flexDirection: 'column',
                        alignItems: 'center',
                        gap: 0.75,
                        p: 1.5,
                        borderRadius: 2,
                        cursor: 'pointer',
                        transition: 'all 0.15s ease',
                        '&:hover': { bgcolor: 'action.hover', transform: 'translateY(-1px)' },
                      }}
                    >
                      <Box sx={{ color: 'text.secondary', transition: 'color 0.15s', '.MuiBox-root:hover > &': { color: 'primary.main' } }}>{item.icon}</Box>
                      <Typography variant="caption" sx={{ fontWeight: 500, fontSize: '0.7rem', textAlign: 'center' }}>{item.label}</Typography>
                    </Box>
                  </Grid>
                ))}
              </Grid>
            </CardContent>
          </Card>
        </Grid>
      </Grid>
    </Box>
  );
}
