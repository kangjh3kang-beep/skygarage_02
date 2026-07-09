import { useState, useEffect } from 'react';
import {
  Box, Paper, Typography, Grid, Chip, Button, Card, CardContent,
  Table, TableBody, TableCell, TableContainer, TableHead, TableRow,
  LinearProgress, Tabs, Tab, Alert, IconButton, Tooltip,
} from '@mui/material';
import PublishIcon from '@mui/icons-material/Publish';
import SyncIcon from '@mui/icons-material/Sync';
import TrendingUpIcon from '@mui/icons-material/TrendingUp';
import CheckCircleIcon from '@mui/icons-material/CheckCircle';
import WarningIcon from '@mui/icons-material/Warning';
import { getPolicyEvents, getSiteMetrics } from '../services/policySync';
import { useTenant } from '../contexts/TenantContext';

interface PolicyEvent {
  id: string;
  site_id: string;
  action: string;
  payload: Record<string, unknown>;
  created_at: string;
}

export default function ComplexControl() {
  const { complexes } = useTenant();
  const [tab, setTab] = useState(0);
  const [policyEvents, setPolicyEvents] = useState<PolicyEvent[]>([]);
  const [metrics, setMetrics] = useState<Record<string, unknown>[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadData();
  }, []);

  async function loadData() {
    setLoading(true);
    const [events, siteMetrics] = await Promise.all([
      getPolicyEvents(),
      getSiteMetrics('PLATFORM'),
    ]);
    setPolicyEvents(events as PolicyEvent[]);
    setMetrics(siteMetrics);
    setLoading(false);
  }

  const siteStats = complexes.map(c => ({
    id: c.id,
    name: c.name,
    code: c.code,
    policyVersion: '2.1.0',
    syncStatus: Math.random() > 0.2 ? 'synced' : 'pending',
    elevatorUtil: Math.round(Math.random() * 40 + 50),
    missionsToday: Math.round(Math.random() * 80 + 20),
  }));

  return (
    <Box>
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 3 }}>
        <Typography variant="h5" sx={{ fontWeight: 700 }}>단지 제어 센터</Typography>
        <Box sx={{ display: 'flex', gap: 1 }}>
          <Button variant="outlined" startIcon={<SyncIcon />} onClick={loadData}>새로고침</Button>
          <Button variant="contained" startIcon={<PublishIcon />}>정책 배포</Button>
        </Box>
      </Box>

      <Tabs value={tab} onChange={(_, v) => setTab(v)} sx={{ mb: 3 }}>
        <Tab label="단지 현황" />
        <Tab label="정책 이벤트" />
        <Tab label="벤치마크" />
      </Tabs>

      {loading && <LinearProgress sx={{ mb: 2 }} />}

      {tab === 0 && (
        <Grid container spacing={2}>
          <Grid size={{ xs: 12 }}>
            <Alert severity="info" sx={{ mb: 2 }}>
              {complexes.length}개 단지 운영 중 | 정책 버전 v2.1.0 | K2 임계값 85%
            </Alert>
          </Grid>
          {siteStats.map(site => (
            <Grid size={{ xs: 12, md: 6, lg: 4 }} key={site.id}>
              <Card variant="outlined">
                <CardContent>
                  <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 1 }}>
                    <Typography sx={{ fontWeight: 600 }}>{site.name}</Typography>
                    <Chip
                      size="small"
                      label={site.syncStatus === 'synced' ? '동기화됨' : '대기 중'}
                      color={site.syncStatus === 'synced' ? 'success' : 'warning'}
                      icon={site.syncStatus === 'synced' ? <CheckCircleIcon /> : <WarningIcon />}
                    />
                  </Box>
                  <Typography variant="body2" color="text.secondary" sx={{ mb: 1 }}>
                    코드: {site.code} | 정책: v{site.policyVersion}
                  </Typography>
                  <Box sx={{ mb: 1 }}>
                    <Box sx={{ display: 'flex', justifyContent: 'space-between' }}>
                      <Typography variant="caption">엘리베이터 사용률</Typography>
                      <Typography variant="caption" sx={{ fontWeight: 600 }}>
                        {site.elevatorUtil}%
                      </Typography>
                    </Box>
                    <LinearProgress
                      variant="determinate"
                      value={site.elevatorUtil}
                      color={site.elevatorUtil > 85 ? 'error' : site.elevatorUtil > 70 ? 'warning' : 'primary'}
                      sx={{ height: 6, borderRadius: 3 }}
                    />
                  </Box>
                  <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <Typography variant="caption" color="text.secondary">
                      금일 미션: {site.missionsToday}건
                    </Typography>
                    <Tooltip title="상세 보기">
                      <IconButton size="small"><TrendingUpIcon fontSize="small" /></IconButton>
                    </Tooltip>
                  </Box>
                </CardContent>
              </Card>
            </Grid>
          ))}
        </Grid>
      )}

      {tab === 1 && (
        <TableContainer component={Paper} variant="outlined">
          <Table size="small">
            <TableHead>
              <TableRow>
                <TableCell>시간</TableCell>
                <TableCell>액션</TableCell>
                <TableCell>사이트</TableCell>
                <TableCell>상세</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {policyEvents.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={4} align="center">정책 이벤트 없음</TableCell>
                </TableRow>
              ) : (
                policyEvents.map(evt => (
                  <TableRow key={evt.id}>
                    <TableCell>{new Date(evt.created_at).toLocaleString('ko-KR')}</TableCell>
                    <TableCell>
                      <Chip
                        size="small"
                        label={evt.action}
                        color={evt.action.includes('Rejected') ? 'error' : evt.action.includes('Applied') ? 'success' : 'default'}
                      />
                    </TableCell>
                    <TableCell>{evt.site_id}</TableCell>
                    <TableCell sx={{ maxWidth: 200, overflow: 'hidden', textOverflow: 'ellipsis' }}>
                      {JSON.stringify(evt.payload).slice(0, 60)}
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </TableContainer>
      )}

      {tab === 2 && (
        <Paper variant="outlined" sx={{ p: 3 }}>
          <Typography variant="h6" sx={{ mb: 2, fontWeight: 600 }}>단지 간 벤치마크</Typography>
          <Grid container spacing={2}>
            {['평균 이송 시간', '엘리베이터 대기', 'P95 응답', '미션 성공률'].map((metric, i) => (
              <Grid size={{ xs: 12, sm: 6, md: 3 }} key={metric}>
                <Card variant="outlined" sx={{ textAlign: 'center', p: 2 }}>
                  <Typography variant="caption" color="text.secondary">{metric}</Typography>
                  <Typography variant="h4" sx={{ fontWeight: 700, color: 'primary.main' }}>
                    {[3.2, 45, 12, 97.8][i]}{['분', '초', '초', '%'][i]}
                  </Typography>
                </Card>
              </Grid>
            ))}
          </Grid>
          {metrics.length > 0 && (
            <Box sx={{ mt: 3 }}>
              <Typography variant="subtitle2" sx={{ mb: 1 }}>최근 텔레메트리</Typography>
              {metrics.slice(0, 5).map((m, i) => (
                <Typography key={i} variant="body2" color="text.secondary">
                  {JSON.stringify(m).slice(0, 80)}...
                </Typography>
              ))}
            </Box>
          )}
        </Paper>
      )}
    </Box>
  );
}
