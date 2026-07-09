import { useState, useEffect, useCallback } from 'react';
import Box from '@mui/material/Box';
import Card from '@mui/material/Card';
import Grid from '@mui/material/Grid';
import Typography from '@mui/material/Typography';
import LinearProgress from '@mui/material/LinearProgress';
import Button from '@mui/material/Button';
import Switch from '@mui/material/Switch';
import FormControlLabel from '@mui/material/FormControlLabel';
import Alert from '@mui/material/Alert';
import Chip from '@mui/material/Chip';
import CircularProgress from '@mui/material/CircularProgress';
import { supabase } from '../../lib/supabase';
import { useDocumentTitle } from '../../hooks/useDocumentTitle';
import { useToast } from '../contexts/ToastContext';
import { useAuditLog } from '../../hooks/useAuditLog';

interface ElevatorMetrics {
  id: string;
  name: string;
  utilization: number;
  queueDepth: number;
  status: string;
}

const K2_THRESHOLD = 85;

export default function BottleneckWorkbench() {
  useDocumentTitle('병목 워크벤치');
  const { showToast } = useToast();
  const { logAction } = useAuditLog();

  const [kpiData, setKpiData] = useState({ elevatorUtilization: 0, queueDepth: 0, p95WaitTime: 0, prePullCount: 0 });
  const [elevators, setElevators] = useState<ElevatorMetrics[]>([]);
  const [prePullEnabled, setPrePullEnabled] = useState(true);
  const [simulationLoading, setSimulationLoading] = useState(false);

  const loadKPIData = useCallback(async () => {
    const { data, error } = await supabase
      .from('system_metrics')
      .select('*')
      .in('metric_type', ['elevator_utilization', 'queue_depth', 'p95_wait_time', 'pre_pull_count'])
      .order('recorded_at', { ascending: false })
      .limit(4);

    if (error) return;

    const metrics: Record<string, number> = {};
    data?.forEach((m: any) => { metrics[m.metric_type] = m.metric_value; });

    setKpiData({
      elevatorUtilization: metrics.elevator_utilization || 0,
      queueDepth: metrics.queue_depth || 0,
      p95WaitTime: metrics.p95_wait_time || 0,
      prePullCount: metrics.pre_pull_count || 0,
    });
  }, []);

  const loadElevatorMetrics = useCallback(async () => {
    const { data, error } = await supabase
      .from('elevators')
      .select('id, name, utilization_percent, queue_depth, status')
      .order('utilization_percent', { ascending: false });

    if (error) return;

    setElevators((data || []).map((e: any) => ({
      id: e.id,
      name: e.name || e.elevator_code || 'EV',
      utilization: e.utilization_percent || 0,
      queueDepth: e.queue_depth || 0,
      status: e.status || 'operational',
    })));
  }, []);

  useEffect(() => {
    loadKPIData();
    loadElevatorMetrics();
  }, [loadKPIData, loadElevatorMetrics]);

  useEffect(() => {
    const ch = supabase
      .channel('bottleneck_metrics')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'system_metrics' }, () => loadKPIData())
      .on('postgres_changes', { event: '*', schema: 'public', table: 'elevators' }, () => loadElevatorMetrics())
      .subscribe();

    return () => { supabase.removeChannel(ch); };
  }, [loadKPIData, loadElevatorMetrics]);

  const getUtilizationColor = (utilization: number) => {
    if (utilization > K2_THRESHOLD) return '#ff5252';
    if (utilization >= 60) return '#ffc107';
    return '#00e676';
  };

  const handlePrePullToggle = (enabled: boolean) => {
    setPrePullEnabled(enabled);
    logAction('UPDATE', 'system_metrics', undefined, { pre_pull_enabled: enabled });
    showToast(`Pre-pull ${enabled ? '활성화' : '비활성화'}됨`, 'success');
  };

  const handleSimulation = async () => {
    setSimulationLoading(true);
    try {
      const { error } = await supabase.functions.invoke('priority-dispatch', {
        body: { action: 'simulate_peak' },
      });
      if (error) throw error;
      logAction('CREATE', 'system_metrics', undefined, { simulation: 'peak' });
      showToast('피크 시나리오 시뮬레이션 완료', 'success');
      setTimeout(loadKPIData, 1000);
    } catch {
      showToast('시뮬레이션 실패', 'error');
    } finally {
      setSimulationLoading(false);
    }
  };

  const topBottleneck = elevators[0];
  const hasThresholdViolation = kpiData.elevatorUtilization > K2_THRESHOLD;

  return (
    <Box sx={{ p: 3 }}>
      <Typography variant="h5" sx={{ color: '#00d4ff', mb: 3, fontWeight: 'bold' }}>병목 워크벤치</Typography>

      <Grid container spacing={2} sx={{ mb: 3 }}>
        {[
          { label: '엘리베이터 이용률', value: kpiData.elevatorUtilization, unit: '%' },
          { label: '큐 깊이', value: kpiData.queueDepth, unit: '호출' },
          { label: 'P95 대기시간', value: kpiData.p95WaitTime, unit: '초' },
          { label: 'Pre-pull 적용 건', value: kpiData.prePullCount, unit: '건' },
        ].map((kpi, idx) => (
          <Grid key={idx} size={{ xs: 12, sm: 6, md: 3 }}>
            <Card sx={{ p: 2, bgcolor: '#111827', border: '1px solid #1e293b' }}>
              <Typography sx={{ color: '#9ca3af', fontSize: '0.875rem', mb: 1 }}>{kpi.label}</Typography>
              <Typography sx={{ color: '#00d4ff', fontSize: '2rem', fontWeight: 'bold' }}>
                {kpi.value}<span style={{ fontSize: '1rem', marginLeft: '4px' }}>{kpi.unit}</span>
              </Typography>
            </Card>
          </Grid>
        ))}
      </Grid>

      {hasThresholdViolation && (
        <Alert severity="warning" sx={{ mb: 3, bgcolor: '#1e1810', borderColor: '#ffc107', color: '#ffc107' }}>
          K2 안전 한계치(85%) 초과: {kpiData.elevatorUtilization}% - 즉시 조치 필요
        </Alert>
      )}

      <Card sx={{ p: 3, bgcolor: '#111827', mb: 3, border: '1px solid #1e293b' }}>
        <Typography sx={{ color: '#00d4ff', mb: 2, fontWeight: 'bold' }}>자원 이용률</Typography>
        {elevators.map(elev => (
          <Box key={elev.id} sx={{ mb: 2, p: 2, bgcolor: '#0a0a0f', borderRadius: 1 }}>
            <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 1 }}>
              <Typography sx={{ color: '#e5e7eb', fontWeight: 'bold' }}>{elev.name}</Typography>
              <Chip label={`큐: ${elev.queueDepth}`} size="small" sx={{ bgcolor: '#1e293b', color: '#9ca3af' }} />
            </Box>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
              <Box sx={{ flex: 1 }}>
                <LinearProgress
                  variant="determinate"
                  value={Math.min(elev.utilization, 100)}
                  sx={{
                    height: 8, borderRadius: 4, bgcolor: '#1e293b',
                    '& .MuiLinearProgress-bar': {
                      bgcolor: getUtilizationColor(elev.utilization),
                      boxShadow: elev.utilization > K2_THRESHOLD ? '0 0 8px rgba(255, 82, 82, 0.6)' : 'none',
                    },
                  }}
                />
              </Box>
              <Typography sx={{ color: '#9ca3af', minWidth: 40, textAlign: 'right' }}>{elev.utilization}%</Typography>
            </Box>
          </Box>
        ))}
      </Card>

      {topBottleneck && (
        <Card sx={{ p: 3, bgcolor: '#111827', mb: 3, border: '2px solid #c9a84c' }}>
          <Typography sx={{ color: '#c9a84c', mb: 2, fontWeight: 'bold' }}>주요 병목 지점</Typography>
          <Box sx={{ p: 2, bgcolor: '#0a0a0f', borderRadius: 1 }}>
            <Typography sx={{ color: '#e5e7eb', fontSize: '1.25rem', fontWeight: 'bold' }}>{topBottleneck.name}</Typography>
            <Typography sx={{ color: '#9ca3af', mt: 1 }}>
              이용률: {topBottleneck.utilization}% | 큐: {topBottleneck.queueDepth}
            </Typography>
            <Typography sx={{ color: '#ffc107', mt: 2, fontSize: '0.875rem' }}>즉시 추가 자원 할당 권장</Typography>
          </Box>
        </Card>
      )}

      <Grid container spacing={2}>
        <Grid size={{ xs: 12, sm: 6 }}>
          <Card sx={{ p: 3, bgcolor: '#111827', border: '1px solid #1e293b' }}>
            <FormControlLabel
              control={
                <Switch
                  checked={prePullEnabled}
                  onChange={(e) => handlePrePullToggle(e.target.checked)}
                  sx={{ '& .MuiSwitch-switchBase.Mui-checked': { color: '#00d4ff' }, '& .MuiSwitch-switchBase.Mui-checked + .MuiSwitch-track': { bgcolor: '#00d4ff' } }}
                />
              }
              label={<Typography sx={{ color: '#e5e7eb' }}>Pre-pull 평활화</Typography>}
            />
          </Card>
        </Grid>
        <Grid size={{ xs: 12, sm: 6 }}>
          <Button
            fullWidth
            variant="contained"
            onClick={handleSimulation}
            disabled={simulationLoading}
            sx={{ p: 2, bgcolor: '#00d4ff', color: '#0a0a0f', fontWeight: 'bold', '&:hover': { bgcolor: '#00b8d4' } }}
          >
            {simulationLoading ? <CircularProgress size={20} sx={{ color: '#0a0a0f' }} /> : '피크 시나리오 시뮬레이션'}
          </Button>
        </Grid>
      </Grid>
    </Box>
  );
}
