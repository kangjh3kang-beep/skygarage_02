import { useState, useEffect, useCallback, useMemo } from 'react';
import Box from '@mui/material/Box';
import Card from '@mui/material/Card';
import CardContent from '@mui/material/CardContent';
import Grid from '@mui/material/Grid';
import Typography from '@mui/material/Typography';
import Button from '@mui/material/Button';
import Chip from '@mui/material/Chip';
import LinearProgress from '@mui/material/LinearProgress';
import CircularProgress from '@mui/material/CircularProgress';
import Alert from '@mui/material/Alert';
import Divider from '@mui/material/Divider';
import SmartToyIcon from '@mui/icons-material/SmartToy';
import InsightsIcon from '@mui/icons-material/Insights';
import AutoFixHighIcon from '@mui/icons-material/AutoFixHigh';
import WarningAmberIcon from '@mui/icons-material/WarningAmber';
import CheckCircleIcon from '@mui/icons-material/CheckCircle';
import BuildIcon from '@mui/icons-material/Build';
import DirectionsCarIcon from '@mui/icons-material/DirectionsCar';
import ApartmentIcon from '@mui/icons-material/Apartment';
import LocalParkingIcon from '@mui/icons-material/LocalParking';
import SyncIcon from '@mui/icons-material/Sync';
import TimelineIcon from '@mui/icons-material/Timeline';
import { supabase } from '../../lib/supabase';
import { useNavigate } from 'react-router-dom';
import { useDocumentTitle } from '../../hooks/useDocumentTitle';
import { useToast } from '../contexts/ToastContext';

interface DataQualityMetric {
  entity: string;
  label: string;
  total: number;
  avgCompleteness: number;
  lowQualityCount: number;
}

interface ModeDistribution {
  mode: string;
  count: number;
}

interface StoredRecommendation {
  id: string;
  entity_type: string;
  type: string;
  priority: string;
  title: string;
  description: string;
  status: string;
  metadata: Record<string, unknown>;
  created_at: string;
}

interface Escalation {
  id: string;
  source_tier: string;
  target_tier: string;
  reason: string;
  status: string;
  created_at: string;
}

export default function AIManagement() {
  useDocumentTitle('AI 관리');
  const navigate = useNavigate();
  const { showToast } = useToast();
  const [loading, setLoading] = useState(true);
  const [metrics, setMetrics] = useState<DataQualityMetric[]>([]);
  const [modeDistribution, setModeDistribution] = useState<ModeDistribution[]>([]);
  const [recommendations, setRecommendations] = useState<StoredRecommendation[]>([]);
  const [escalations, setEscalations] = useState<Escalation[]>([]);
  const [complexCount, setComplexCount] = useState(0);
  const [agentCount, setAgentCount] = useState(0);
  const [generating, setGenerating] = useState(false);
  const [collectingMetrics, setCollectingMetrics] = useState(false);

  const loadData = useCallback(async () => {
    const [
      residentsRes,
      atrRes,
      elevatorsRes,
      contractsRes,
      partnersRes,
      ticketsRes,
      crmRes,
      invoicesRes,
      complexRes,
      agentsRes,
      recsRes,
      escalationsRes,
    ] = await Promise.all([
      supabase.from('resident_accounts').select('completeness_score'),
      supabase.from('atr_units').select('completeness_score, operating_mode, status'),
      supabase.from('elevators').select('completeness_score, adapter_type, operational_status'),
      supabase.from('contracts').select('completeness_score, status, end_date'),
      supabase.from('partners').select('completeness_score, integration_status, sla_score'),
      supabase.from('support_tickets').select('completeness_score, status, priority, sla_due_at'),
      supabase.from('crm_leads').select('completeness_score, scoring'),
      supabase.from('billing_invoices').select('status, total'),
      supabase.from('complexes').select('id'),
      supabase.from('ai_agent_configs').select('id, active').eq('active', true),
      supabase.from('ai_recommendations').select('*').eq('status', 'pending').order('created_at', { ascending: false }).limit(20),
      supabase.from('ai_escalations').select('*').in('status', ['pending', 'accepted']).order('created_at', { ascending: false }).limit(10),
    ]);

    const buildMetric = (label: string, entity: string, data: { completeness_score?: number }[] | null): DataQualityMetric => {
      const items = data || [];
      const avg = items.length > 0 ? Math.round(items.reduce((s, i) => s + (i.completeness_score || 0), 0) / items.length) : 0;
      const lowQ = items.filter(i => (i.completeness_score || 0) < 50).length;
      return { entity, label, total: items.length, avgCompleteness: avg, lowQualityCount: lowQ };
    };

    const metricsData: DataQualityMetric[] = [
      buildMetric('입주민', 'residents', residentsRes.data),
      buildMetric('ATR 장비', 'atr', atrRes.data),
      buildMetric('엘리베이터', 'elevators', elevatorsRes.data),
      buildMetric('계약', 'contracts', contractsRes.data),
      buildMetric('파트너', 'partners', partnersRes.data),
      buildMetric('지원 티켓', 'tickets', ticketsRes.data),
      buildMetric('CRM 리드', 'crm_leads', crmRes.data),
      buildMetric('인보이스', 'invoices', invoicesRes.data as { completeness_score?: number }[] | null),
    ];
    setMetrics(metricsData);

    const atrData = atrRes.data || [];
    const modeMap = new Map<string, number>();
    atrData.forEach(a => {
      const mode = (a as { operating_mode?: string }).operating_mode || 'unset';
      modeMap.set(mode, (modeMap.get(mode) || 0) + 1);
    });
    setModeDistribution(Array.from(modeMap.entries()).map(([mode, count]) => ({ mode, count })));

    setComplexCount(complexRes.data?.length || 0);
    setAgentCount(agentsRes.data?.length || 0);
    if (recsRes.data) setRecommendations(recsRes.data as StoredRecommendation[]);
    if (escalationsRes.data) setEscalations(escalationsRes.data as Escalation[]);

    setLoading(false);
  }, []);

  useEffect(() => { loadData(); }, [loadData]);

  const handleGenerateRecommendations = async () => {
    setGenerating(true);
    const apiUrl = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/workflow-engine?action=generate-recommendations`;
    try {
      const res = await fetch(apiUrl, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${import.meta.env.VITE_SUPABASE_ANON_KEY}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({}),
      });
      if (res.ok) {
        const data = await res.json();
        showToast(`${data.count}건의 권장사항이 생성되었습니다.`, 'success');
        loadData();
      } else {
        showToast('권장사항 생성 실패', 'error');
      }
    } catch {
      showToast('네트워크 오류', 'error');
    }
    setGenerating(false);
  };

  const handleCollectMetrics = async () => {
    setCollectingMetrics(true);
    const apiUrl = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/workflow-engine?action=collect-metrics`;
    try {
      const res = await fetch(apiUrl, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${import.meta.env.VITE_SUPABASE_ANON_KEY}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({}),
      });
      if (res.ok) {
        const data = await res.json();
        showToast(`${data.count}개 메트릭이 수집되었습니다.`, 'success');
      } else {
        showToast('메트릭 수집 실패', 'error');
      }
    } catch {
      showToast('네트워크 오류', 'error');
    }
    setCollectingMetrics(false);
  };

  const handleDismissRecommendation = async (id: string) => {
    await supabase.from('ai_recommendations').update({ status: 'dismissed' }).eq('id', id);
    setRecommendations(prev => prev.filter(r => r.id !== id));
  };

  const handleAcknowledgeRecommendation = async (id: string) => {
    await supabase.from('ai_recommendations').update({ status: 'acknowledged' }).eq('id', id);
    setRecommendations(prev => prev.map(r => r.id === id ? { ...r, status: 'acknowledged' } : r));
    showToast('권장사항이 확인 처리되었습니다.', 'success');
  };

  const overallScore = useMemo(() => {
    const valid = metrics.filter(m => m.total > 0);
    if (valid.length === 0) return 0;
    return Math.round(valid.reduce((s, m) => s + m.avgCompleteness, 0) / valid.length);
  }, [metrics]);

  const modeLabels: Record<string, string> = { direct: '직접 주차', valet: '발렛 주차', tower: '주차 타워', hybrid: '하이브리드', unset: '미설정' };
  const modeColors: Record<string, string> = { direct: '#1976d2', valet: '#ed6c02', tower: '#0288d1', hybrid: '#2e7d32', unset: '#757575' };
  const priorityColors: Record<string, 'error' | 'warning' | 'info'> = { high: 'error', medium: 'warning', low: 'info' };
  const typeIcons: Record<string, React.ReactNode> = {
    optimization: <AutoFixHighIcon fontSize="small" />,
    warning: <WarningAmberIcon fontSize="small" />,
    insight: <InsightsIcon fontSize="small" />,
  };

  if (loading) return <Box sx={{ display: 'flex', justifyContent: 'center', py: 10 }}><CircularProgress /></Box>;

  return (
    <Box>
      <Box sx={{ mb: 3, display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 1 }}>
        <Typography variant="h1">AI 관리</Typography>
        <Box sx={{ display: 'flex', gap: 1 }}>
          <Button
            variant="outlined"
            size="small"
            startIcon={collectingMetrics ? <CircularProgress size={14} /> : <TimelineIcon />}
            onClick={handleCollectMetrics}
            disabled={collectingMetrics}
          >
            메트릭 수집
          </Button>
          <Button
            variant="outlined"
            size="small"
            startIcon={generating ? <CircularProgress size={14} /> : <SyncIcon />}
            onClick={handleGenerateRecommendations}
            disabled={generating}
          >
            권장사항 생성
          </Button>
          <Button variant="outlined" size="small" onClick={() => navigate('/admin/ai')}>AI Agent Chat</Button>
          <Button variant="contained" size="small" startIcon={<SmartToyIcon />} onClick={() => navigate('/admin/workflows')}>워크플로우</Button>
        </Box>
      </Box>

      {/* Top Summary */}
      <Grid container spacing={2} sx={{ mb: 3 }}>
        <Grid size={{ xs: 6, md: 3 }}>
          <Card><CardContent sx={{ textAlign: 'center' }}>
            <InsightsIcon sx={{ color: '#1976d2' }} />
            <Typography variant="caption" color="text.secondary">데이터 품질 지수</Typography>
            <Typography variant="h2" sx={{ color: overallScore >= 70 ? 'success.main' : overallScore >= 50 ? 'warning.main' : 'error.main' }}>
              {overallScore}%
            </Typography>
          </CardContent></Card>
        </Grid>
        <Grid size={{ xs: 6, md: 3 }}>
          <Card><CardContent sx={{ textAlign: 'center' }}>
            <SmartToyIcon sx={{ color: '#00e676' }} />
            <Typography variant="caption" color="text.secondary">활성 AI 에이전트</Typography>
            <Typography variant="h2">{agentCount}</Typography>
          </CardContent></Card>
        </Grid>
        <Grid size={{ xs: 6, md: 3 }}>
          <Card><CardContent sx={{ textAlign: 'center' }}>
            <ApartmentIcon sx={{ color: '#0288d1' }} />
            <Typography variant="caption" color="text.secondary">연결 단지</Typography>
            <Typography variant="h2">{complexCount}</Typography>
          </CardContent></Card>
        </Grid>
        <Grid size={{ xs: 6, md: 3 }}>
          <Card><CardContent sx={{ textAlign: 'center' }}>
            <AutoFixHighIcon sx={{ color: '#ed6c02' }} />
            <Typography variant="caption" color="text.secondary">활성 권장사항</Typography>
            <Typography variant="h2">{recommendations.length}</Typography>
          </CardContent></Card>
        </Grid>
      </Grid>

      <Grid container spacing={3}>
        {/* Data Quality Section */}
        <Grid size={{ xs: 12, md: 7 }}>
          <Card>
            <CardContent>
              <Typography variant="h6" sx={{ mb: 2, fontWeight: 700 }}>엔티티별 데이터 품질 (8개 엔티티)</Typography>
              <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                {metrics.map(m => (
                  <Box key={m.entity}>
                    <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 0.5 }}>
                      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                        <Typography variant="body2" sx={{ fontWeight: 600 }}>{m.label}</Typography>
                        <Chip label={`${m.total}건`} size="small" variant="outlined" />
                      </Box>
                      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                        {m.lowQualityCount > 0 && (
                          <Chip label={`불완전 ${m.lowQualityCount}`} size="small" color="error" variant="outlined" sx={{ fontSize: '0.625rem' }} />
                        )}
                        <Typography variant="body2" sx={{ fontWeight: 700, minWidth: 40, textAlign: 'right' }}>
                          {m.avgCompleteness}%
                        </Typography>
                      </Box>
                    </Box>
                    <LinearProgress
                      variant="determinate"
                      value={m.avgCompleteness}
                      sx={{
                        height: 8,
                        borderRadius: 4,
                        bgcolor: 'rgba(255,255,255,0.08)',
                        '& .MuiLinearProgress-bar': {
                          bgcolor: m.avgCompleteness >= 80 ? '#2e7d32' : m.avgCompleteness >= 50 ? '#ed6c02' : '#d32f2f',
                        },
                      }}
                    />
                  </Box>
                ))}
              </Box>
            </CardContent>
          </Card>

          {/* Operating Mode Distribution */}
          <Card sx={{ mt: 3 }}>
            <CardContent>
              <Typography variant="h6" sx={{ mb: 2, fontWeight: 700 }}>운영 모드 분포 (확장성)</Typography>
              <Box sx={{ display: 'flex', gap: 1.5, flexWrap: 'wrap', mb: 2 }}>
                {modeDistribution.map(md => (
                  <Card key={md.mode} variant="outlined" sx={{ px: 2, py: 1.5, minWidth: 120, textAlign: 'center' }}>
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.75, justifyContent: 'center', mb: 0.5 }}>
                      {md.mode === 'valet' ? <DirectionsCarIcon sx={{ fontSize: 16, color: modeColors[md.mode] }} /> :
                       md.mode === 'tower' ? <LocalParkingIcon sx={{ fontSize: 16, color: modeColors[md.mode] }} /> :
                       <BuildIcon sx={{ fontSize: 16, color: modeColors[md.mode] }} />}
                      <Typography variant="caption" sx={{ fontWeight: 600 }}>{modeLabels[md.mode] || md.mode}</Typography>
                    </Box>
                    <Typography variant="h6" sx={{ fontWeight: 700, color: modeColors[md.mode] || 'text.primary' }}>{md.count}</Typography>
                  </Card>
                ))}
                {modeDistribution.length === 0 && (
                  <Typography variant="body2" color="text.secondary">ATR 장비가 없습니다.</Typography>
                )}
              </Box>
              <Alert severity="info" sx={{ mt: 1 }}>
                운영 모드를 설정하면 AI가 주차 방식에 맞는 최적 스케줄링을 자동 적용합니다.
                발렛/타워 모드에서는 ATR-엘리베이터 연동 자동화가 활성화됩니다.
              </Alert>
            </CardContent>
          </Card>

          {/* Escalations */}
          {escalations.length > 0 && (
            <Card sx={{ mt: 3 }}>
              <CardContent>
                <Typography variant="h6" sx={{ mb: 2, fontWeight: 700 }}>에이전트 에스컬레이션</Typography>
                <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
                  {escalations.map(esc => (
                    <Card key={esc.id} variant="outlined" sx={{ p: 1.5 }}>
                      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                        <Box>
                          <Typography variant="body2" sx={{ fontWeight: 600 }}>
                            {esc.source_tier} → {esc.target_tier}
                          </Typography>
                          <Typography variant="caption" color="text.secondary">{esc.reason}</Typography>
                        </Box>
                        <Chip
                          label={esc.status === 'pending' ? '대기' : '처리중'}
                          size="small"
                          color={esc.status === 'pending' ? 'warning' : 'info'}
                        />
                      </Box>
                    </Card>
                  ))}
                </Box>
              </CardContent>
            </Card>
          )}
        </Grid>

        {/* AI Recommendations */}
        <Grid size={{ xs: 12, md: 5 }}>
          <Card sx={{ height: '100%' }}>
            <CardContent>
              <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2 }}>
                <Typography variant="h6" sx={{ fontWeight: 700 }}>AI 권장사항</Typography>
                <Chip label={`${recommendations.length}건`} size="small" color="primary" variant="outlined" />
              </Box>
              {recommendations.length === 0 && (
                <Box sx={{ textAlign: 'center', py: 4 }}>
                  <CheckCircleIcon sx={{ fontSize: 48, color: 'success.main', opacity: 0.5 }} />
                  <Typography variant="body2" color="text.secondary" sx={{ mt: 1 }}>
                    모든 시스템이 최적 상태입니다.
                  </Typography>
                  <Typography variant="caption" color="text.secondary">
                    "권장사항 생성" 버튼으로 최신 분석을 실행하세요.
                  </Typography>
                </Box>
              )}
              <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1.5 }}>
                {recommendations.map(rec => (
                  <Card key={rec.id} variant="outlined" sx={{ p: 1.5 }}>
                    <Box sx={{ display: 'flex', alignItems: 'flex-start', gap: 1 }}>
                      <Box sx={{ color: `${priorityColors[rec.priority] || 'info'}.main`, mt: 0.25 }}>
                        {typeIcons[rec.type] || <InsightsIcon fontSize="small" />}
                      </Box>
                      <Box sx={{ flex: 1 }}>
                        <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 0.25 }}>
                          <Typography variant="body2" sx={{ fontWeight: 600 }}>{rec.title}</Typography>
                          <Chip
                            label={rec.priority === 'high' ? '높음' : rec.priority === 'medium' ? '보통' : '낮음'}
                            size="small"
                            color={priorityColors[rec.priority] || 'info'}
                            sx={{ height: 18, fontSize: '0.6rem' }}
                          />
                        </Box>
                        <Typography variant="caption" color="text.secondary" sx={{ lineHeight: 1.5 }}>
                          {rec.description}
                        </Typography>
                        <Box sx={{ display: 'flex', gap: 0.5, mt: 1 }}>
                          <Chip
                            label="확인"
                            size="small"
                            color="primary"
                            variant="outlined"
                            onClick={() => handleAcknowledgeRecommendation(rec.id)}
                            sx={{ cursor: 'pointer', fontSize: '0.625rem', height: 20 }}
                          />
                          <Chip
                            label="무시"
                            size="small"
                            variant="outlined"
                            onClick={() => handleDismissRecommendation(rec.id)}
                            sx={{ cursor: 'pointer', fontSize: '0.625rem', height: 20 }}
                          />
                        </Box>
                      </Box>
                    </Box>
                  </Card>
                ))}
              </Box>
              <Divider sx={{ my: 2 }} />
              <Typography variant="caption" color="text.secondary">
                권장사항은 서버 사이드에서 데이터 품질, 엔티티 연동 상태, SLA 준수율, 계약 만료, 운영 모드를 분석하여 자동 생성됩니다.
              </Typography>
            </CardContent>
          </Card>
        </Grid>
      </Grid>

      {/* AI Capabilities Info */}
      <Card sx={{ mt: 3 }}>
        <CardContent>
          <Typography variant="h6" sx={{ mb: 2, fontWeight: 700 }}>AI 자동화 파이프라인</Typography>
          <Grid container spacing={2}>
            <Grid size={{ xs: 12, md: 3 }}>
              <Box sx={{ p: 2, border: 1, borderColor: 'divider', borderRadius: 2 }}>
                <Typography variant="subtitle2" sx={{ mb: 1, color: '#1976d2' }}>데이터 품질 관리</Typography>
                <Typography variant="caption" color="text.secondary" component="div" sx={{ lineHeight: 1.6, whiteSpace: 'pre-line' }}>
                  {'- 8개 엔티티 완성도 모니터링\n- 중복 엔티티 자동 탐지\n- 필드 유효성 자동 검증\n- 데이터 보완 알림'}
                </Typography>
              </Box>
            </Grid>
            <Grid size={{ xs: 12, md: 3 }}>
              <Box sx={{ p: 2, border: 1, borderColor: 'divider', borderRadius: 2 }}>
                <Typography variant="subtitle2" sx={{ mb: 1, color: '#ed6c02' }}>스마트 스케줄링</Typography>
                <Typography variant="caption" color="text.secondary" component="div" sx={{ lineHeight: 1.6, whiteSpace: 'pre-line' }}>
                  {'- ATR-엘리베이터 연동 최적화\n- 운영 모드별 자동 일정 배정\n- 피크 타임 예측 및 분산\n- 에너지 효율 최적화'}
                </Typography>
              </Box>
            </Grid>
            <Grid size={{ xs: 12, md: 3 }}>
              <Box sx={{ p: 2, border: 1, borderColor: 'divider', borderRadius: 2 }}>
                <Typography variant="subtitle2" sx={{ mb: 1, color: '#2e7d32' }}>예측 유지보수</Typography>
                <Typography variant="caption" color="text.secondary" component="div" sx={{ lineHeight: 1.6, whiteSpace: 'pre-line' }}>
                  {'- 장비 상태 기반 예측 정비\n- SLA 초과 사전 경보\n- 계약 갱신 자동 알림\n- 파트너 SLA 점수 추적'}
                </Typography>
              </Box>
            </Grid>
            <Grid size={{ xs: 12, md: 3 }}>
              <Box sx={{ p: 2, border: 1, borderColor: 'divider', borderRadius: 2 }}>
                <Typography variant="subtitle2" sx={{ mb: 1, color: '#0288d1' }}>에이전트 협업</Typography>
                <Typography variant="caption" color="text.secondary" component="div" sx={{ lineHeight: 1.6, whiteSpace: 'pre-line' }}>
                  {'- T0-T4 계층 간 에스컬레이션\n- 이벤트 버스 기반 자동 트리거\n- 워크플로우 스텝 자동 진행\n- 관측성 메트릭 실시간 수집'}
                </Typography>
              </Box>
            </Grid>
          </Grid>
        </CardContent>
      </Card>
    </Box>
  );
}
