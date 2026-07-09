import { useEffect, useState, useCallback } from 'react';
import Box from '@mui/material/Box';
import Card from '@mui/material/Card';
import CardContent from '@mui/material/CardContent';
import Typography from '@mui/material/Typography';
import Table from '@mui/material/Table';
import TableBody from '@mui/material/TableBody';
import TableCell from '@mui/material/TableCell';
import TableContainer from '@mui/material/TableContainer';
import TableHead from '@mui/material/TableHead';
import TableRow from '@mui/material/TableRow';
import Chip from '@mui/material/Chip';
import Button from '@mui/material/Button';
import Grid from '@mui/material/Grid';
import LinearProgress from '@mui/material/LinearProgress';
import { supabase } from '../../lib/supabase';
import { useToast } from '../contexts/ToastContext';
import { useDocumentTitle } from '../../hooks/useDocumentTitle';
import { useAuditLog } from '../../hooks/useAuditLog';

interface Mission {
  id: string;
  type: string;
  status: string;
  vehicle_plate: string;
  eta_minutes: number;
  created_at: string;
  updated_at: string;
}

interface SafetyEvent {
  id: string;
  mission_id: string;
  decision: string;
  reason_code: string;
  created_at: string;
}

const PIPELINE_STAGES = [
  'REQUESTED', 'AUTH', 'SMOOTHING', 'ALLOCATING', 'DT_VERIFY', 'SAFETY_GATE', 'IN_TRANSIT', 'DOCKING', 'COMPLETED',
];

const STATUS_TO_STAGE: Record<string, string> = {
  REQUESTED: 'REQUESTED',
  AUTH_CHECKING: 'AUTH',
  SMOOTHING: 'SMOOTHING',
  ALLOCATING: 'ALLOCATING',
  ALLOCATED: 'ALLOCATING',
  DT_VERIFYING: 'DT_VERIFY',
  SAFETY_GATING: 'SAFETY_GATE',
  APPROVED: 'SAFETY_GATE',
  IN_TRANSIT: 'IN_TRANSIT',
  ALIGNING: 'DOCKING',
  DOCKING: 'DOCKING',
  AT_PICKUP: 'DOCKING',
  COMPLETED: 'COMPLETED',
  CANCELLED: 'COMPLETED',
  FAILED: 'COMPLETED',
  SAFETY_REJECTED: 'SAFETY_GATE',
};

const getStatusColor = (status: string) => {
  if (['COMPLETED', 'AT_PICKUP'].includes(status)) return '#10b981';
  if (['FAILED', 'CANCELLED', 'SAFETY_REJECTED'].includes(status)) return '#ef4444';
  if (['IN_TRANSIT', 'DOCKING', 'ALIGNING'].includes(status)) return '#f59e0b';
  return '#00d4ff';
};

export default function MissionPipeline() {
  useDocumentTitle('미션 파이프라인');
  const { showToast } = useToast();
  const { logAction } = useAuditLog();

  const [missions, setMissions] = useState<Mission[]>([]);
  const [safetyEvents, setSafetyEvents] = useState<SafetyEvent[]>([]);
  const [stageCounts, setStageCounts] = useState<Record<string, number>>({});
  const [summaryStats, setSummaryStats] = useState({ active: 0, queued: 0, completedToday: 0, rejected: 0 });
  const [loading, setLoading] = useState(true);

  const loadMissions = useCallback(async () => {
    try {
      const { data, error } = await supabase
        .from('sgp_missions')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(100);

      if (error) throw error;
      setMissions(data || []);

      const counts: Record<string, number> = {};
      PIPELINE_STAGES.forEach(stage => (counts[stage] = 0));

      const today = new Date();
      today.setHours(0, 0, 0, 0);

      let active = 0, queued = 0, completedToday = 0, rejected = 0;

      data?.forEach(mission => {
        const stage = STATUS_TO_STAGE[mission.status] || 'REQUESTED';
        counts[stage]++;

        if (!['COMPLETED', 'CANCELLED', 'FAILED'].includes(mission.status)) active++;
        if (['REQUESTED', 'AUTH_CHECKING'].includes(mission.status)) queued++;
        if (mission.status === 'COMPLETED' && new Date(mission.updated_at) >= today) completedToday++;
        if (mission.status === 'SAFETY_REJECTED') rejected++;
      });

      setStageCounts(counts);
      setSummaryStats({ active, queued, completedToday, rejected });
    } catch (error) {
      showToast('미션 데이터 로드 실패', 'error');
    } finally {
      setLoading(false);
    }
  }, [showToast]);

  const loadSafetyEvents = useCallback(async () => {
    const { data } = await supabase
      .from('safety_events')
      .select('id, mission_id, decision, reason_code, created_at')
      .not('mission_id', 'is', null)
      .order('created_at', { ascending: false })
      .limit(10);
    setSafetyEvents(data || []);
  }, []);

  useEffect(() => {
    loadMissions();
    loadSafetyEvents();

    const ch = supabase
      .channel('missions_pipeline')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'sgp_missions' }, () => loadMissions())
      .on('postgres_changes', { event: '*', schema: 'public', table: 'safety_events' }, () => loadSafetyEvents())
      .subscribe();

    return () => { supabase.removeChannel(ch); };
  }, [loadMissions, loadSafetyEvents]);

  const handleCancelMission = async (missionId: string) => {
    const { error } = await supabase
      .from('sgp_missions')
      .update({ status: 'CANCELLED' })
      .eq('id', missionId);

    if (error) {
      showToast('미션 취소 실패', 'error');
      return;
    }
    logAction('UPDATE', 'sgp_missions', missionId, { status: 'CANCELLED' });
    showToast('미션이 취소되었습니다', 'success');
    loadMissions();
  };

  const getElapsedTime = (createdAt: string) => {
    const elapsed = Math.floor((Date.now() - new Date(createdAt).getTime()) / 60000);
    return elapsed > 0 ? `${elapsed}분` : '<1분';
  };

  return (
    <Box sx={{ p: 3 }}>
      <Grid container spacing={2} sx={{ mb: 4 }}>
        {[
          { label: '활성 미션', value: summaryStats.active, color: '#00d4ff' },
          { label: '대기 중', value: summaryStats.queued, color: '#c9a84c' },
          { label: '오늘 완료', value: summaryStats.completedToday, color: '#10b981' },
          { label: '안전 거부', value: summaryStats.rejected, color: '#ef4444' },
        ].map((stat) => (
          <Grid size={{ xs: 12, sm: 6, md: 3 }} key={stat.label}>
            <Card sx={{ bgcolor: '#111827', border: '1px solid #1f2937' }}>
              <CardContent>
                <Typography sx={{ fontSize: '0.875rem', color: '#9ca3af' }}>{stat.label}</Typography>
                <Typography sx={{ fontSize: '2rem', fontWeight: 'bold', color: stat.color, mt: 1 }}>{stat.value}</Typography>
              </CardContent>
            </Card>
          </Grid>
        ))}
      </Grid>

      <Card sx={{ bgcolor: '#111827', border: '1px solid #1f2937', mb: 4 }}>
        <CardContent>
          <Typography sx={{ mb: 2, fontWeight: 'bold' }}>파이프라인 흐름</Typography>
          <Box sx={{ display: 'flex', gap: 1, overflowX: 'auto', pb: 2 }}>
            {PIPELINE_STAGES.map((stage, idx) => (
              <Box key={stage} sx={{ display: 'flex', alignItems: 'center', minWidth: 'fit-content' }}>
                <Box sx={{ textAlign: 'center', px: 2, py: 1, bgcolor: '#1f2937', border: '1px solid #00d4ff', borderRadius: '6px', minWidth: '80px' }}>
                  <Typography sx={{ fontSize: '0.75rem', color: '#9ca3af' }}>{stage}</Typography>
                  <Typography sx={{ fontSize: '1.25rem', fontWeight: 'bold', color: '#00d4ff' }}>{stageCounts[stage] || 0}</Typography>
                </Box>
                {idx < PIPELINE_STAGES.length - 1 && <Typography sx={{ mx: 1, color: '#6b7280' }}>→</Typography>}
              </Box>
            ))}
          </Box>
        </CardContent>
      </Card>

      <Card sx={{ bgcolor: '#111827', border: '1px solid #1f2937', mb: 4 }}>
        <CardContent>
          <Typography sx={{ mb: 2, fontWeight: 'bold' }}>활성 미션</Typography>
          {loading && <LinearProgress sx={{ mb: 2 }} />}
          <TableContainer>
            <Table size="small">
              <TableHead>
                <TableRow sx={{ bgcolor: '#1f2937' }}>
                  <TableCell sx={{ color: '#9ca3af', fontSize: '0.875rem' }}>미션 ID</TableCell>
                  <TableCell sx={{ color: '#9ca3af', fontSize: '0.875rem' }}>타입</TableCell>
                  <TableCell sx={{ color: '#9ca3af', fontSize: '0.875rem' }}>상태</TableCell>
                  <TableCell sx={{ color: '#9ca3af', fontSize: '0.875rem' }}>차량</TableCell>
                  <TableCell align="right" sx={{ color: '#9ca3af', fontSize: '0.875rem' }}>ETA</TableCell>
                  <TableCell align="right" sx={{ color: '#9ca3af', fontSize: '0.875rem' }}>경과</TableCell>
                  <TableCell align="center" sx={{ color: '#9ca3af', fontSize: '0.875rem' }}>작업</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {missions
                  .filter(m => !['COMPLETED', 'CANCELLED', 'FAILED'].includes(m.status))
                  .slice(0, 20)
                  .map(mission => (
                    <TableRow key={mission.id} sx={{ '&:hover': { bgcolor: '#1f2937' } }}>
                      <TableCell sx={{ fontSize: '0.875rem', color: '#d1d5db' }}>{mission.id.substring(0, 8)}...</TableCell>
                      <TableCell sx={{ fontSize: '0.875rem', color: '#d1d5db' }}>{mission.type}</TableCell>
                      <TableCell>
                        <Chip label={mission.status} size="small" sx={{ bgcolor: getStatusColor(mission.status), color: '#000', fontSize: '0.75rem', fontWeight: 'bold' }} />
                      </TableCell>
                      <TableCell sx={{ fontSize: '0.875rem', color: '#d1d5db' }}>{mission.vehicle_plate}</TableCell>
                      <TableCell align="right" sx={{ fontSize: '0.875rem', color: '#d1d5db' }}>{mission.eta_minutes}분</TableCell>
                      <TableCell align="right" sx={{ fontSize: '0.875rem', color: '#d1d5db' }}>{getElapsedTime(mission.created_at)}</TableCell>
                      <TableCell align="center">
                        {['REQUESTED', 'AUTH_CHECKING'].includes(mission.status) && (
                          <Button size="small" variant="outlined" color="error" onClick={() => handleCancelMission(mission.id)} sx={{ fontSize: '0.75rem' }}>
                            취소
                          </Button>
                        )}
                      </TableCell>
                    </TableRow>
                  ))}
              </TableBody>
            </Table>
          </TableContainer>
        </CardContent>
      </Card>

      <Card sx={{ bgcolor: '#111827', border: '1px solid #1f2937' }}>
        <CardContent>
          <Typography sx={{ mb: 2, fontWeight: 'bold' }}>안전 게이트 로그</Typography>
          <TableContainer>
            <Table size="small">
              <TableHead>
                <TableRow sx={{ bgcolor: '#1f2937' }}>
                  <TableCell sx={{ color: '#9ca3af', fontSize: '0.875rem' }}>미션 ID</TableCell>
                  <TableCell sx={{ color: '#9ca3af', fontSize: '0.875rem' }}>판정</TableCell>
                  <TableCell sx={{ color: '#9ca3af', fontSize: '0.875rem' }}>사유 코드</TableCell>
                  <TableCell sx={{ color: '#9ca3af', fontSize: '0.875rem' }}>시간</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {safetyEvents.map(event => (
                  <TableRow key={event.id} sx={{ '&:hover': { bgcolor: '#1f2937' } }}>
                    <TableCell sx={{ fontSize: '0.875rem', color: '#d1d5db' }}>{event.mission_id?.substring(0, 8)}...</TableCell>
                    <TableCell>
                      <Chip label={event.decision} size="small" sx={{ bgcolor: event.decision === 'APPROVED' ? '#10b981' : '#ef4444', color: '#000', fontSize: '0.75rem', fontWeight: 'bold' }} />
                    </TableCell>
                    <TableCell sx={{ fontSize: '0.875rem', color: '#d1d5db' }}>{event.reason_code}</TableCell>
                    <TableCell sx={{ fontSize: '0.75rem', color: '#9ca3af' }}>{new Date(event.created_at).toLocaleTimeString('ko-KR')}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </TableContainer>
        </CardContent>
      </Card>
    </Box>
  );
}
