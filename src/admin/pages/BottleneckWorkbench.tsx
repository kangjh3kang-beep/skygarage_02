import { useState, useEffect } from 'react';
import Box from '@mui/material/Box';
import Typography from '@mui/material/Typography';
import Paper from '@mui/material/Paper';
import Grid from '@mui/material/Grid';
import Chip from '@mui/material/Chip';
import LinearProgress from '@mui/material/LinearProgress';
import Button from '@mui/material/Button';
import Alert from '@mui/material/Alert';
import Card from '@mui/material/Card';
import CardContent from '@mui/material/CardContent';
import Divider from '@mui/material/Divider';
import Table from '@mui/material/Table';
import TableBody from '@mui/material/TableBody';
import TableCell from '@mui/material/TableCell';
import TableContainer from '@mui/material/TableContainer';
import TableHead from '@mui/material/TableHead';
import TableRow from '@mui/material/TableRow';
import ElevatorIcon from '@mui/icons-material/Elevator';
import SpeedIcon from '@mui/icons-material/Speed';
import WarningAmberIcon from '@mui/icons-material/WarningAmber';
import TrendingUpIcon from '@mui/icons-material/TrendingUp';
import PlayArrowIcon from '@mui/icons-material/PlayArrow';
import TimelineIcon from '@mui/icons-material/Timeline';
import { useDocumentTitle } from '../../hooks/useDocumentTitle';

interface BottleneckMetric {
  resource: string;
  utilization: number;
  queueDepth: number;
  p95WaitMs: number;
  status: 'normal' | 'warning' | 'critical';
}

interface SimulationResult {
  scenario: string;
  p95Minutes: number;
  slaMet: boolean;
  improvement: string;
}

export default function BottleneckWorkbench() {
  useDocumentTitle('병목 워크벤치');
  const [metrics, setMetrics] = useState<BottleneckMetric[]>([]);
  const [simRunning, setSimRunning] = useState(false);
  const [simResults, setSimResults] = useState<SimulationResult[]>([]);
  const [safetyGuardActive, setSafetyGuardActive] = useState(false);

  const K2_THRESHOLD = 85;

  useEffect(() => {
    setMetrics([
      { resource: '차량 엘리베이터 A', utilization: 88, queueDepth: 4, p95WaitMs: 420000, status: 'critical' },
      { resource: '차량 엘리베이터 B', utilization: 72, queueDepth: 2, p95WaitMs: 210000, status: 'warning' },
      { resource: 'ATR-01 (2F)', utilization: 45, queueDepth: 0, p95WaitMs: 60000, status: 'normal' },
      { resource: 'ATR-02 (B1)', utilization: 52, queueDepth: 1, p95WaitMs: 90000, status: 'normal' },
      { resource: '랜딩버퍼 (B1)', utilization: 63, queueDepth: 1, p95WaitMs: 120000, status: 'normal' },
    ]);

    const hasOverThreshold = true;
    setSafetyGuardActive(hasOverThreshold);
  }, []);

  const runSimulation = () => {
    setSimRunning(true);
    setTimeout(() => {
      setSimResults([
        { scenario: 'S0 베이스라인 (EV2, ATR6, 스무딩 off)', p95Minutes: 12.5, slaMet: false, improvement: '-' },
        { scenario: 'S1 ATR 증차 (EV2, ATR10)', p95Minutes: 12.1, slaMet: false, improvement: '3.2%' },
        { scenario: 'S2 EV+1 (EV3)', p95Minutes: 5.8, slaMet: true, improvement: '53.6%' },
        { scenario: 'S3 스무딩 단독 (EV2, prepull)', p95Minutes: 10.8, slaMet: false, improvement: '13.6%' },
        { scenario: 'S4 랜딩버퍼 사이클 단축 (180→150s)', p95Minutes: 8.7, slaMet: true, improvement: '30.4%' },
        { scenario: 'S5 통합 (EV3+스무딩+버퍼)', p95Minutes: 4.2, slaMet: true, improvement: '66.4%' },
      ]);
      setSimRunning(false);
    }, 2000);
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'critical': return 'error';
      case 'warning': return 'warning';
      default: return 'success';
    }
  };

  return (
    <Box>
      <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 3 }}>
        <Box>
          <Typography variant="h5" sx={{ fontWeight: 700 }}>병목 워크벤치</Typography>
          <Typography variant="body2" color="text.secondary">
            엘리베이터 가동률 기반 병목 감지 및 해소 시뮬레이션
          </Typography>
        </Box>
        <Button
          variant="contained"
          startIcon={<PlayArrowIcon />}
          onClick={runSimulation}
          disabled={simRunning}
        >
          {simRunning ? '시뮬레이션 실행 중...' : '당일 시뮬레이션'}
        </Button>
      </Box>

      {safetyGuardActive && (
        <Alert severity="warning" sx={{ mb: 2 }} icon={<WarningAmberIcon />}>
          가동률이 임계값(K2={K2_THRESHOLD}%)을 초과했습니다. 용량 레버(엘리베이터 증설, 랜딩버퍼 사이클 단축)를 우선 적용하세요.
          스무딩 단독 적용은 차단됩니다.
        </Alert>
      )}

      <Grid container spacing={2} sx={{ mb: 3 }}>
        <Grid size={{ xs: 12, md: 3 }}>
          <Card sx={{ borderLeft: '4px solid', borderColor: 'error.main' }}>
            <CardContent sx={{ py: 2 }}>
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 1 }}>
                <ElevatorIcon color="error" fontSize="small" />
                <Typography variant="caption" color="text.secondary">최상위 병목</Typography>
              </Box>
              <Typography variant="h6" sx={{ fontWeight: 700 }}>차량 엘리베이터</Typography>
              <Typography variant="body2" color="error.main">가동률 88% (임계 초과)</Typography>
            </CardContent>
          </Card>
        </Grid>
        <Grid size={{ xs: 12, md: 3 }}>
          <Card>
            <CardContent sx={{ py: 2 }}>
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 1 }}>
                <SpeedIcon fontSize="small" color="primary" />
                <Typography variant="caption" color="text.secondary">대기열 깊이</Typography>
              </Box>
              <Typography variant="h6" sx={{ fontWeight: 700 }}>6대</Typography>
              <Typography variant="body2" color="text.secondary">현재 대기 차량</Typography>
            </CardContent>
          </Card>
        </Grid>
        <Grid size={{ xs: 12, md: 3 }}>
          <Card>
            <CardContent sx={{ py: 2 }}>
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 1 }}>
                <TimelineIcon fontSize="small" color="primary" />
                <Typography variant="caption" color="text.secondary">P95 대기시간</Typography>
              </Box>
              <Typography variant="h6" sx={{ fontWeight: 700 }}>7.0분</Typography>
              <Typography variant="body2" color="text.secondary">SLA 목표: 10분</Typography>
            </CardContent>
          </Card>
        </Grid>
        <Grid size={{ xs: 12, md: 3 }}>
          <Card>
            <CardContent sx={{ py: 2 }}>
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 1 }}>
                <TrendingUpIcon fontSize="small" color="success" />
                <Typography variant="caption" color="text.secondary">Pre-Pull 적용</Typography>
              </Box>
              <Typography variant="h6" sx={{ fontWeight: 700 }}>12건</Typography>
              <Typography variant="body2" color="text.secondary">금일 스무딩 적용</Typography>
            </CardContent>
          </Card>
        </Grid>
      </Grid>

      <Paper sx={{ p: 3, mb: 3 }}>
        <Typography variant="subtitle1" sx={{ fontWeight: 600, mb: 2 }}>자원별 가동률</Typography>
        {metrics.map((m) => (
          <Box key={m.resource} sx={{ mb: 2 }}>
            <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 0.5 }}>
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                <Typography variant="body2" sx={{ fontWeight: 500 }}>{m.resource}</Typography>
                <Chip
                  label={m.status === 'critical' ? '병목' : m.status === 'warning' ? '주의' : '정상'}
                  size="small"
                  color={getStatusColor(m.status) as 'error' | 'warning' | 'success'}
                  sx={{ height: 20, fontSize: '0.7rem' }}
                />
              </Box>
              <Typography variant="body2" color="text.secondary">
                {m.utilization}% | 대기 {m.queueDepth}대 | P95 {(m.p95WaitMs / 60000).toFixed(1)}분
              </Typography>
            </Box>
            <LinearProgress
              variant="determinate"
              value={m.utilization}
              color={m.utilization > K2_THRESHOLD ? 'error' : m.utilization > 70 ? 'warning' : 'primary'}
              sx={{ height: 8, borderRadius: 1 }}
            />
          </Box>
        ))}
        <Divider sx={{ my: 2 }} />
        <Typography variant="caption" color="text.secondary">
          K2 임계값: {K2_THRESHOLD}% (사이트 설정). 초과 시 용량 레버 우선 적용 필요.
        </Typography>
      </Paper>

      {simResults.length > 0 && (
        <Paper sx={{ p: 3 }}>
          <Typography variant="subtitle1" sx={{ fontWeight: 600, mb: 2 }}>시뮬레이션 결과</Typography>
          <TableContainer>
            <Table size="small">
              <TableHead>
                <TableRow>
                  <TableCell>시나리오</TableCell>
                  <TableCell align="right">P95 (분)</TableCell>
                  <TableCell align="center">SLA 충족</TableCell>
                  <TableCell align="right">개선율</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {simResults.map((r) => (
                  <TableRow key={r.scenario} sx={{ bgcolor: r.slaMet ? 'success.50' : undefined }}>
                    <TableCell>
                      <Typography variant="body2">{r.scenario}</Typography>
                    </TableCell>
                    <TableCell align="right">
                      <Typography variant="body2" sx={{ fontWeight: 600 }} color={r.slaMet ? 'success.main' : 'error.main'}>
                        {r.p95Minutes}
                      </Typography>
                    </TableCell>
                    <TableCell align="center">
                      <Chip
                        label={r.slaMet ? '충족' : '미달'}
                        size="small"
                        color={r.slaMet ? 'success' : 'error'}
                        sx={{ height: 20, fontSize: '0.7rem' }}
                      />
                    </TableCell>
                    <TableCell align="right">{r.improvement}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </TableContainer>
          <Box sx={{ mt: 2, p: 2, bgcolor: 'info.50', borderRadius: 1 }}>
            <Typography variant="body2" sx={{ fontWeight: 600 }} color="info.main">
              분석 결론: 병목 = 차량엘리베이터 (ATR 증차 효과 미미)
            </Typography>
            <Typography variant="caption" color="text.secondary">
              권장 조합: EV 증설 + 랜딩버퍼 사이클 단축 + Pre-Pull 스무딩 (S5 통합 시 P95 4.2분, SLA 충족)
            </Typography>
          </Box>
        </Paper>
      )}

      {simRunning && <LinearProgress sx={{ mt: 2 }} />}
    </Box>
  );
}
