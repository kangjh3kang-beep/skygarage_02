import { useCallback, useEffect, useState } from 'react';
import Box from '@mui/material/Box';
import Card from '@mui/material/Card';
import CardContent from '@mui/material/CardContent';
import Chip from '@mui/material/Chip';
import Grid from '@mui/material/Grid';
import Table from '@mui/material/Table';
import TableBody from '@mui/material/TableBody';
import TableCell from '@mui/material/TableCell';
import TableContainer from '@mui/material/TableContainer';
import TableHead from '@mui/material/TableHead';
import TableRow from '@mui/material/TableRow';
import Typography from '@mui/material/Typography';
import Alert from '@mui/material/Alert';
import { supabase } from '../../lib/supabase';
import { useDocumentTitle } from '../../hooks/useDocumentTitle';

interface AnomalyDetection {
  id: string;
  detected_at: string;
  severity: 'P0' | 'P1' | 'P2' | 'P3';
  category: string;
  description: string;
  status: string;
}

interface AIOpsAction {
  id: string;
  created_at: string;
  autonomy_level: string;
  action_type: string;
  description: string;
  status: string;
  model_version: string;
}

interface AIModel {
  id: string;
  model_name: string;
  version: string;
  accuracy: number;
  last_trained: string;
}

const AUTONOMY_LEVELS: Record<string, { label: string; description: string }> = {
  L0: { label: '관찰 및 알림', description: 'Observe & Alert' },
  L1: { label: '비중단 조치', description: 'Non-disruptive actions' },
  L2: { label: '물리적 영향', description: 'Physical impact' },
  L3: { label: '물리적 개입', description: 'Physical intervention' },
};

const SEVERITY_COLORS: Record<string, 'error' | 'warning' | 'info' | 'success'> = {
  P0: 'error',
  P1: 'warning',
  P2: 'info',
  P3: 'success',
};

const CATEGORY_LABELS: Record<string, string> = {
  thermal: '열 이상',
  queue_explosion: '큐 폭주',
  sensor_drift: '센서 드리프트',
  pattern_anomaly: '패턴 이상',
  security_threat: '보안 위협',
};

const STATUS_LABELS: Record<string, string> = {
  proposed: '제안',
  approved: '승인',
  applied: '적용',
  rejected: '거절',
  failed: '실패',
  active: '활성',
  resolved: '해결',
};

const STATUS_COLORS: Record<string, 'default' | 'warning' | 'primary' | 'success' | 'error'> = {
  proposed: 'warning',
  approved: 'primary',
  applied: 'success',
  rejected: 'error',
  failed: 'error',
  active: 'error',
  resolved: 'success',
};

export default function AIOpsMonitoring() {
  useDocumentTitle('AIOps 모니터링');

  const [anomalies, setAnomalies] = useState<AnomalyDetection[]>([]);
  const [actions, setActions] = useState<AIOpsAction[]>([]);
  const [models, setModels] = useState<AIModel[]>([]);
  const [currentAutonomy] = useState<'L0' | 'L1' | 'L2' | 'L3'>('L0');

  const loadAnomalies = useCallback(async () => {
    const { data, error } = await supabase
      .from('ai_anomaly_detections')
      .select('*')
      .order('detected_at', { ascending: false });
    if (!error) setAnomalies(data || []);
  }, []);

  const loadActions = useCallback(async () => {
    const { data, error } = await supabase
      .from('ai_ops_actions')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(20);
    if (!error) setActions(data || []);
  }, []);

  const loadModels = useCallback(async () => {
    const { data, error } = await supabase
      .from('ai_models')
      .select('*')
      .order('version', { ascending: false });
    if (!error) setModels(data || []);
  }, []);

  useEffect(() => {
    loadAnomalies();
    loadActions();
    loadModels();

    const ch = supabase
      .channel('aiops_changes')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'ai_anomaly_detections' }, () => loadAnomalies())
      .on('postgres_changes', { event: '*', schema: 'public', table: 'ai_ops_actions' }, () => loadActions())
      .subscribe();

    return () => { supabase.removeChannel(ch); };
  }, [loadAnomalies, loadActions, loadModels]);

  const activeAnomalies = anomalies.filter(a => a.status === 'active').length;

  return (
    <Box sx={{ p: 3 }}>
      <Alert
        severity="warning"
        sx={{ mb: 3, bgcolor: '#1a1a2e', color: '#c9a84c', borderLeft: '4px solid #c9a84c' }}
      >
        AI는 안전게이트를 우회할 수 없습니다 (AI cannot bypass safety gate)
      </Alert>

      <Card sx={{ mb: 3, bgcolor: '#111827', border: '1px solid #00d4ff' }}>
        <CardContent>
          <Grid container spacing={2} sx={{ alignItems: 'center' }}>
            <Grid size={{ xs: 12, sm: 4 }}>
              <Typography variant="h6" sx={{ color: '#00d4ff', fontWeight: 600 }}>
                현재 자동화 수준
              </Typography>
              <Typography variant="h4" sx={{ color: '#c9a84c', fontWeight: 700, mt: 1 }}>
                {currentAutonomy}
              </Typography>
            </Grid>
            <Grid size={{ xs: 12, sm: 8 }}>
              <Typography variant="body2" sx={{ color: '#fff', mb: 1 }}>
                <strong>{AUTONOMY_LEVELS[currentAutonomy].label}</strong>
              </Typography>
              <Typography variant="caption" sx={{ color: '#aaa' }}>
                {AUTONOMY_LEVELS[currentAutonomy].description}
              </Typography>
            </Grid>
          </Grid>
        </CardContent>
      </Card>

      <Card sx={{ mb: 3, bgcolor: '#111827' }}>
        <CardContent>
          <Typography variant="h6" sx={{ color: '#00d4ff', fontWeight: 600, mb: 2 }}>
            이상 탐지 ({activeAnomalies}개 활성)
          </Typography>
          {anomalies.length === 0 ? (
            <Typography sx={{ color: '#aaa', textAlign: 'center', py: 3 }}>감지된 이상 없음</Typography>
          ) : (
            <Grid container spacing={2}>
              {anomalies.map(anomaly => (
                <Grid size={{ xs: 12, sm: 6, md: 4 }} key={anomaly.id}>
                  <Box sx={{ p: 2, bgcolor: '#0a0a0f', borderRadius: 1, border: `1px solid ${anomaly.status === 'active' ? '#ff6b6b' : '#4ade80'}` }}>
                    <Box sx={{ display: 'flex', gap: 1, mb: 1, flexWrap: 'wrap' }}>
                      <Chip label={anomaly.severity} size="small" color={SEVERITY_COLORS[anomaly.severity]} />
                      <Chip label={CATEGORY_LABELS[anomaly.category] || anomaly.category} size="small" variant="outlined" sx={{ color: '#aaa', borderColor: '#444' }} />
                      <Chip label={STATUS_LABELS[anomaly.status] || anomaly.status} size="small" color={STATUS_COLORS[anomaly.status] || 'default'} />
                    </Box>
                    <Typography variant="body2" sx={{ color: '#fff', mb: 1 }}>{anomaly.description}</Typography>
                    <Typography variant="caption" sx={{ color: '#888' }}>
                      {new Date(anomaly.detected_at).toLocaleString('ko-KR')}
                    </Typography>
                  </Box>
                </Grid>
              ))}
            </Grid>
          )}
        </CardContent>
      </Card>

      <Card sx={{ mb: 3, bgcolor: '#111827' }}>
        <CardContent>
          <Typography variant="h6" sx={{ color: '#00d4ff', fontWeight: 600, mb: 2 }}>자동 치유 조치</Typography>
          <TableContainer>
            <Table>
              <TableHead>
                <TableRow sx={{ borderBottom: '2px solid #00d4ff' }}>
                  <TableCell sx={{ color: '#00d4ff', fontWeight: 600 }}>시간</TableCell>
                  <TableCell sx={{ color: '#00d4ff', fontWeight: 600 }}>레벨</TableCell>
                  <TableCell sx={{ color: '#00d4ff', fontWeight: 600 }}>조치 유형</TableCell>
                  <TableCell sx={{ color: '#00d4ff', fontWeight: 600 }}>설명</TableCell>
                  <TableCell sx={{ color: '#00d4ff', fontWeight: 600 }}>상태</TableCell>
                  <TableCell sx={{ color: '#00d4ff', fontWeight: 600 }}>모델 버전</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {actions.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={6} sx={{ color: '#aaa', textAlign: 'center', py: 3 }}>기록 없음</TableCell>
                  </TableRow>
                ) : (
                  actions.map(action => (
                    <TableRow key={action.id} sx={{ '&:hover': { bgcolor: '#1a1a2e' } }}>
                      <TableCell sx={{ color: '#fff', fontSize: '0.85rem' }}>
                        {new Date(action.created_at).toLocaleTimeString('ko-KR')}
                      </TableCell>
                      <TableCell sx={{ color: '#c9a84c', fontWeight: 600 }}>{action.autonomy_level}</TableCell>
                      <TableCell sx={{ color: '#fff' }}>{action.action_type}</TableCell>
                      <TableCell sx={{ color: '#aaa', maxWidth: 250 }}>{action.description}</TableCell>
                      <TableCell>
                        <Chip label={STATUS_LABELS[action.status] || action.status} size="small" color={STATUS_COLORS[action.status] || 'default'} />
                      </TableCell>
                      <TableCell sx={{ color: '#888' }}>{action.model_version}</TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </TableContainer>
        </CardContent>
      </Card>

      <Card sx={{ bgcolor: '#111827' }}>
        <CardContent>
          <Typography variant="h6" sx={{ color: '#00d4ff', fontWeight: 600, mb: 2 }}>배포된 AI 모델</Typography>
          {models.length === 0 ? (
            <Typography sx={{ color: '#aaa', textAlign: 'center', py: 3 }}>배포된 모델 없음</Typography>
          ) : (
            <Grid container spacing={2}>
              {models.map(model => (
                <Grid size={{ xs: 12, sm: 6, md: 4 }} key={model.id}>
                  <Box sx={{ p: 2, bgcolor: '#0a0a0f', border: '1px solid #444', borderRadius: 1 }}>
                    <Typography variant="subtitle2" sx={{ color: '#00d4ff', fontWeight: 600, mb: 1 }}>
                      {model.model_name}
                    </Typography>
                    <Typography variant="caption" sx={{ color: '#aaa' }}>
                      버전: <span style={{ color: '#c9a84c' }}>{model.version}</span>
                    </Typography>
                    <br />
                    <Typography variant="caption" sx={{ color: '#aaa' }}>
                      정확도: <span style={{ color: '#4ade80' }}>{(model.accuracy * 100).toFixed(1)}%</span>
                    </Typography>
                    <br />
                    <Typography variant="caption" sx={{ color: '#888' }}>
                      마지막 학습: {new Date(model.last_trained).toLocaleDateString('ko-KR')}
                    </Typography>
                  </Box>
                </Grid>
              ))}
            </Grid>
          )}
        </CardContent>
      </Card>
    </Box>
  );
}
