import { useState, useEffect, useMemo, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import Box from '@mui/material/Box';
import Grid from '@mui/material/Grid';
import Card from '@mui/material/Card';
import CardContent from '@mui/material/CardContent';
import Typography from '@mui/material/Typography';
import Chip from '@mui/material/Chip';
import CircularProgress from '@mui/material/CircularProgress';
import Divider from '@mui/material/Divider';
import ToggleButton from '@mui/material/ToggleButton';
import ToggleButtonGroup from '@mui/material/ToggleButtonGroup';
import IconButton from '@mui/material/IconButton';
import AccountBalanceWalletIcon from '@mui/icons-material/AccountBalanceWallet';
import TrendingUpIcon from '@mui/icons-material/TrendingUp';
import SubscriptionsIcon from '@mui/icons-material/Subscriptions';
import BoltIcon from '@mui/icons-material/Bolt';
import DownloadIcon from '@mui/icons-material/Download';
import ReceiptLongIcon from '@mui/icons-material/ReceiptLong';
import Button from '@mui/material/Button';
import { supabase } from '../../lib/supabase';
import { useTenant } from '../contexts/TenantContext';
import { useDocumentTitle } from '../../hooks/useDocumentTitle';

interface RevenueReport {
  id: string;
  complex_id: string;
  month: string;
  subscription_revenue: number;
  parking_revenue: number;
  ev_charging_revenue: number;
  v2g_revenue: number;
  total_revenue: number;
  total_sessions: number;
  active_subscribers: number;
  occupancy_rate: number;
}

interface Complex {
  id: string;
  name: string;
}

type PeriodKey = '3m' | '6m' | '12m';

export default function RevenueBilling() {
  useDocumentTitle('수익/빌링');
  const navigate = useNavigate();
  const { selectedComplex: tenantComplex } = useTenant();
  const [loading, setLoading] = useState(true);
  const [reports, setReports] = useState<RevenueReport[]>([]);
  const [complexes, setComplexes] = useState<Complex[]>([]);
  const [period, setPeriod] = useState<PeriodKey>('6m');

  const periodMonths = period === '3m' ? 3 : period === '6m' ? 6 : 12;

  const filteredReports = useMemo(() => {
    const cutoff = new Date();
    cutoff.setMonth(cutoff.getMonth() - periodMonths);
    const cutoffStr = cutoff.toISOString().slice(0, 7);
    return reports.filter((r) => r.month >= cutoffStr);
  }, [reports, periodMonths]);

  const handleExportCsv = () => {
    const headers = ['월', '단지', '구독수익', '주차수익', 'EV충전수익', 'V2G수익', '총매출', '세션수', '구독자', '점유율(%)'];
    const rows = filteredReports.map((r) => [
      r.month,
      complexes.find((c) => c.id === r.complex_id)?.name || r.complex_id,
      r.subscription_revenue,
      r.parking_revenue,
      r.ev_charging_revenue,
      r.v2g_revenue,
      r.total_revenue,
      r.total_sessions,
      r.active_subscribers,
      r.occupancy_rate,
    ]);
    const csv = '\uFEFF' + [headers, ...rows].map((r) => r.join(',')).join('\n');
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = `revenue_${period}_${new Date().toISOString().slice(0, 10)}.csv`;
    link.click();
  };

  const loadData = useCallback(async () => {
    let revenueQuery = supabase.from('revenue_reports').select('*').order('month', { ascending: false });
    if (tenantComplex) revenueQuery = revenueQuery.eq('complex_id', tenantComplex.id);
    const [rRes, cRes] = await Promise.all([
      revenueQuery,
      supabase.from('complexes').select('id, name'),
    ]);
    if (rRes.data) setReports(rRes.data);
    if (cRes.data) setComplexes(cRes.data);
    setLoading(false);
  }, [tenantComplex]);

  useEffect(() => { loadData(); }, [loadData]);

  useEffect(() => {
    const channel = supabase.channel('revenue-realtime')
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'revenue_reports' }, () => { loadData(); })
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [loadData]);

  if (loading) {
    return (
      <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', minHeight: 300 }}>
        <CircularProgress sx={{ color: 'primary.main' }} />
      </Box>
    );
  }

  const currentMonth = new Date().toISOString().slice(0, 7);
  const currentReports = filteredReports.filter((r) => r.month.startsWith(currentMonth));
  const totalRevenue = currentReports.reduce((s, r) => s + Number(r.total_revenue), 0);
  const totalSubscription = currentReports.reduce((s, r) => s + Number(r.subscription_revenue), 0);
  const totalParking = currentReports.reduce((s, r) => s + Number(r.parking_revenue), 0);
  const totalEv = currentReports.reduce((s, r) => s + Number(r.ev_charging_revenue), 0);
  const totalV2g = currentReports.reduce((s, r) => s + Number(r.v2g_revenue), 0);

  // Monthly trend
  const months: string[] = [];
  for (let i = periodMonths - 1; i >= 0; i--) {
    const d = new Date();
    d.setMonth(d.getMonth() - i);
    months.push(d.toISOString().slice(0, 7));
  }

  const monthlyTotals = months.map((m) => {
    const monthReports = filteredReports.filter((r) => r.month.startsWith(m));
    return {
      month: m,
      total: monthReports.reduce((s, r) => s + Number(r.total_revenue), 0),
      subscription: monthReports.reduce((s, r) => s + Number(r.subscription_revenue), 0),
      parking: monthReports.reduce((s, r) => s + Number(r.parking_revenue), 0),
    };
  });
  const maxMonthly = Math.max(...monthlyTotals.map((m) => m.total), 1);

  const revenueStreams = [
    { label: '구독료', value: totalSubscription, color: '#00d4ff' },
    { label: '주차요금', value: totalParking, color: '#c9a84c' },
    { label: 'EV 충전', value: totalEv, color: '#00e676' },
    { label: 'V2G 판매', value: totalV2g, color: '#3b82f6' },
  ];
  const totalStreams = revenueStreams.reduce((s, r) => s + r.value, 0);

  return (
    <Box>
      <Box sx={{ mb: 3, display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
        <Box>
          <Typography variant="h1" sx={{ mb: 0.5 }}>수익 / 빌링</Typography>
          <Typography variant="body2" sx={{ color: 'text.secondary' }}>
            월별 매출 현황, 수익원 분석, 단지별 빌링 리포트
          </Typography>
        </Box>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
          <ToggleButtonGroup size="small" value={period} exclusive onChange={(_, v) => v && setPeriod(v)}>
            <ToggleButton value="3m" sx={{ px: 1.5, fontSize: '0.75rem' }}>3개월</ToggleButton>
            <ToggleButton value="6m" sx={{ px: 1.5, fontSize: '0.75rem' }}>6개월</ToggleButton>
            <ToggleButton value="12m" sx={{ px: 1.5, fontSize: '0.75rem' }}>12개월</ToggleButton>
          </ToggleButtonGroup>
          <Button size="small" variant="outlined" startIcon={<ReceiptLongIcon />} onClick={() => navigate('/admin/billing')}>
            인보이스
          </Button>
          <IconButton size="small" onClick={handleExportCsv} sx={{ color: 'text.secondary' }} title="CSV 다운로드">
            <DownloadIcon sx={{ fontSize: 18 }} />
          </IconButton>
        </Box>
      </Box>

      {/* KPI */}
      <Grid container spacing={2} sx={{ mb: 3 }}>
        {[
          { label: '금월 총 매출', value: (totalRevenue / 10000).toFixed(0), unit: '만원', color: 'secondary.main', icon: <AccountBalanceWalletIcon sx={{ fontSize: 20 }} /> },
          { label: '구독 수익', value: (totalSubscription / 10000).toFixed(0), unit: '만원', color: 'primary.main', icon: <SubscriptionsIcon sx={{ fontSize: 20 }} /> },
          { label: '주차 + EV', value: ((totalParking + totalEv) / 10000).toFixed(0), unit: '만원', color: 'success.main', icon: <TrendingUpIcon sx={{ fontSize: 20 }} /> },
          { label: 'V2G 수익', value: (totalV2g / 10000).toFixed(0), unit: '만원', color: 'info.main', icon: <BoltIcon sx={{ fontSize: 20 }} /> },
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

      <Grid container spacing={2.5}>
        {/* Revenue trend chart */}
        <Grid size={{ xs: 12, lg: 7 }}>
          <Card>
            <CardContent sx={{ p: '20px 24px !important' }}>
              <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2.5 }}>
                <Typography variant="h3">월별 매출 추이 ({periodMonths}개월)</Typography>
                <Chip
                  icon={<TrendingUpIcon sx={{ fontSize: 14 }} />}
                  label={`${(totalRevenue / 10000).toFixed(0)}만`}
                  size="small"
                  sx={{ bgcolor: 'rgba(201,168,76,0.12)', color: 'secondary.main', fontWeight: 700, fontSize: '0.7rem' }}
                />
              </Box>
              <Box sx={{ display: 'flex', alignItems: 'flex-end', gap: 1.5, height: 180, px: 1 }}>
                {monthlyTotals.map((m) => (
                  <Box key={m.month} sx={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 0.5 }}>
                    <Typography variant="caption" sx={{ color: 'text.secondary', fontSize: '0.6rem' }}>
                      {m.total > 0 ? `${(m.total / 10000).toFixed(0)}만` : ''}
                    </Typography>
                    <Box sx={{ width: '100%', display: 'flex', flexDirection: 'column', gap: '2px' }}>
                      <Box
                        sx={{
                          width: '100%',
                          bgcolor: 'primary.main',
                          borderRadius: '3px 3px 0 0',
                          height: `${(m.subscription / maxMonthly) * 140}px`,
                          minHeight: 2,
                          opacity: 0.8,
                        }}
                      />
                      <Box
                        sx={{
                          width: '100%',
                          bgcolor: 'secondary.main',
                          borderRadius: '0 0 3px 3px',
                          height: `${(m.parking / maxMonthly) * 140}px`,
                          minHeight: 2,
                          opacity: 0.8,
                        }}
                      />
                    </Box>
                    <Typography variant="caption" sx={{ color: 'text.secondary', fontSize: '0.65rem' }}>
                      {m.month.slice(5)}월
                    </Typography>
                  </Box>
                ))}
              </Box>
              <Box sx={{ display: 'flex', gap: 3, mt: 2, justifyContent: 'center' }}>
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.75 }}>
                  <Box sx={{ width: 10, height: 10, borderRadius: '2px', bgcolor: 'primary.main', opacity: 0.8 }} />
                  <Typography variant="caption" sx={{ color: 'text.secondary' }}>구독</Typography>
                </Box>
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.75 }}>
                  <Box sx={{ width: 10, height: 10, borderRadius: '2px', bgcolor: 'secondary.main', opacity: 0.8 }} />
                  <Typography variant="caption" sx={{ color: 'text.secondary' }}>주차요금</Typography>
                </Box>
              </Box>
            </CardContent>
          </Card>

          {/* Per-complex this month */}
          <Card sx={{ mt: 2.5 }}>
            <CardContent sx={{ p: '20px 24px !important' }}>
              <Typography variant="h3" sx={{ mb: 2 }}>단지별 금월 매출</Typography>
              {complexes.map((complex) => {
                const cReports = currentReports.filter((r) => r.complex_id === complex.id);
                const cRevenue = cReports.reduce((s, r) => s + Number(r.total_revenue), 0);
                const cSessions = cReports.reduce((s, r) => s + r.total_sessions, 0);
                const cOccupancy = cReports.length > 0
                  ? Math.round(cReports.reduce((s, r) => s + Number(r.occupancy_rate), 0) / cReports.length)
                  : 0;
                const pct = totalRevenue > 0 ? Math.round((cRevenue / totalRevenue) * 100) : 0;
                return (
                  <Box key={complex.id} sx={{ mb: 2.5 }}>
                    <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 0.5 }}>
                      <Typography
                        variant="subtitle2"
                        onClick={() => navigate('/admin/complexes')}
                        sx={{ color: 'text.primary', fontWeight: 600, cursor: 'pointer', '&:hover': { color: 'primary.main' } }}
                      >{complex.name}</Typography>
                      <Typography variant="caption" sx={{ color: 'secondary.main', fontWeight: 700 }}>
                        {(cRevenue / 10000).toFixed(0)}만원
                      </Typography>
                    </Box>
                    <Box sx={{ height: 8, bgcolor: 'rgba(255,255,255,0.06)', borderRadius: 4, overflow: 'hidden', mb: 0.5 }}>
                      <Box sx={{ height: '100%', width: `${pct}%`, bgcolor: 'secondary.main', borderRadius: 4 }} />
                    </Box>
                    <Box sx={{ display: 'flex', gap: 2 }}>
                      <Typography variant="caption" sx={{ color: 'text.secondary' }}>세션 {cSessions}건</Typography>
                      <Typography variant="caption" sx={{ color: 'text.secondary' }}>점유율 {cOccupancy}%</Typography>
                    </Box>
                  </Box>
                );
              })}
            </CardContent>
          </Card>
        </Grid>

        {/* Revenue breakdown */}
        <Grid size={{ xs: 12, lg: 5 }}>
          <Card sx={{ mb: 2.5 }}>
            <CardContent sx={{ p: '20px 24px !important' }}>
              <Typography variant="h3" sx={{ mb: 2 }}>수익원 비중 (금월)</Typography>
              {revenueStreams.map((stream) => {
                const pct = totalStreams > 0 ? Math.round((stream.value / totalStreams) * 100) : 0;
                return (
                  <Box key={stream.label} sx={{ mb: 2 }}>
                    <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 0.5 }}>
                      <Typography variant="subtitle2" sx={{ color: 'text.primary', fontWeight: 600 }}>
                        {stream.label}
                      </Typography>
                      <Box sx={{ display: 'flex', gap: 1 }}>
                        <Typography variant="caption" sx={{ color: stream.color, fontWeight: 700 }}>
                          {(stream.value / 10000).toFixed(0)}만
                        </Typography>
                        <Typography variant="caption" sx={{ color: 'text.secondary' }}>{pct}%</Typography>
                      </Box>
                    </Box>
                    <Box sx={{ height: 8, bgcolor: 'rgba(255,255,255,0.06)', borderRadius: 4, overflow: 'hidden' }}>
                      <Box sx={{ height: '100%', width: `${pct}%`, bgcolor: stream.color, borderRadius: 4 }} />
                    </Box>
                  </Box>
                );
              })}

              <Divider sx={{ my: 2 }} />
              <Box sx={{ display: 'flex', justifyContent: 'space-between' }}>
                <Typography variant="subtitle2" sx={{ fontWeight: 700, color: 'text.primary' }}>합계</Typography>
                <Typography sx={{ fontSize: '1.125rem', fontWeight: 800, color: 'secondary.main' }}>
                  {(totalStreams / 10000).toFixed(0)}만원
                </Typography>
              </Box>
            </CardContent>
          </Card>

          {/* Monthly comparison */}
          <Card>
            <CardContent sx={{ p: '20px 24px !important' }}>
              <Typography variant="h3" sx={{ mb: 2 }}>월간 성장</Typography>
              {(() => {
                const prev = monthlyTotals.length >= 2 ? monthlyTotals[monthlyTotals.length - 2] : null;
                const curr = monthlyTotals[monthlyTotals.length - 1];
                if (!prev || !curr) return null;
                const growth = prev.total > 0 ? Math.round(((curr.total - prev.total) / prev.total) * 100) : 0;
                const isPositive = growth >= 0;
                return (
                  <Box>
                    <Box sx={{ textAlign: 'center', p: 2, borderRadius: 2, bgcolor: isPositive ? 'rgba(0,230,118,0.05)' : 'rgba(255,82,82,0.05)', border: `1px solid ${isPositive ? 'rgba(0,230,118,0.2)' : 'rgba(255,82,82,0.2)'}` }}>
                      <Typography sx={{ fontSize: '2rem', fontWeight: 800, color: isPositive ? 'success.main' : 'error.main' }}>
                        {isPositive ? '+' : ''}{growth}%
                      </Typography>
                      <Typography variant="caption" sx={{ color: 'text.secondary' }}>
                        전월 대비 매출 {isPositive ? '증가' : '감소'}
                      </Typography>
                    </Box>
                    <Box sx={{ mt: 2, display: 'flex', justifyContent: 'space-between' }}>
                      <Box sx={{ textAlign: 'center' }}>
                        <Typography variant="caption" sx={{ color: 'text.secondary' }}>전월</Typography>
                        <Typography sx={{ fontSize: '0.9375rem', fontWeight: 700, color: 'text.primary' }}>
                          {(prev.total / 10000).toFixed(0)}만
                        </Typography>
                      </Box>
                      <Box sx={{ textAlign: 'center' }}>
                        <Typography variant="caption" sx={{ color: 'text.secondary' }}>금월</Typography>
                        <Typography sx={{ fontSize: '0.9375rem', fontWeight: 700, color: 'secondary.main' }}>
                          {(curr.total / 10000).toFixed(0)}만
                        </Typography>
                      </Box>
                    </Box>
                  </Box>
                );
              })()}
            </CardContent>
          </Card>
        </Grid>
      </Grid>
    </Box>
  );
}
