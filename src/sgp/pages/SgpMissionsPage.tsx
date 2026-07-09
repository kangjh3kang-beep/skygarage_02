import { useState, useEffect } from 'react';
import Box from '@mui/material/Box';
import Typography from '@mui/material/Typography';
import Card from '@mui/material/Card';
import CardContent from '@mui/material/CardContent';
import Button from '@mui/material/Button';
import Chip from '@mui/material/Chip';
import Alert from '@mui/material/Alert';
import Skeleton from '@mui/material/Skeleton';
import LinearProgress from '@mui/material/LinearProgress';
import DirectionsCarIcon from '@mui/icons-material/DirectionsCar';
import AccessTimeIcon from '@mui/icons-material/AccessTime';
import CancelIcon from '@mui/icons-material/Cancel';
import CheckCircleIcon from '@mui/icons-material/CheckCircle';
import ErrorIcon from '@mui/icons-material/Error';
import { useSgpAuth } from '../contexts/SgpAuthContext';
import { getMissions, cancelMission, MISSION_STATUS_LABELS, TERMINAL_STATUSES } from '../services/missionService';
import { subscribeToTopic } from '../services/realtimeSdk';
import type { Mission, UserMissionStatus, RealtimeEvent } from '../types';

const STATUS_COLORS: Partial<Record<UserMissionStatus, string>> = {
  REQUESTED: '#64748b',
  QUEUED: '#f59e0b',
  ALLOCATING: '#3b82f6',
  IN_TRANSIT: '#0ea5e9',
  AT_PICKUP: '#84cc16',
  COMPLETED: '#22c55e',
  CANCELLED: '#6b7280',
  FAILED: '#ef4444',
  SAFETY_REJECTED: '#ef4444',
};

export default function SgpMissionsPage() {
  const { user } = useSgpAuth();
  const [missions, setMissions] = useState<Mission[]>([]);
  const [loading, setLoading] = useState(true);
  const [cancelling, setCancelling] = useState<string | null>(null);

  useEffect(() => {
    if (!user) return;
    loadMissions();
  }, [user]);

  useEffect(() => {
    if (!user) return;
    const unsub = subscribeToTopic('mission', (event: RealtimeEvent) => {
      if (event.action === 'MissionStatusUpdated') {
        const missionId = event.payload.missionId as string;
        const newStatus = event.payload.status as UserMissionStatus;
        setMissions(prev => prev.map(m =>
          m.id === missionId ? { ...m, status: newStatus } : m
        ));
      }
    });
    return unsub;
  }, [user]);

  async function loadMissions() {
    if (!user) return;
    setLoading(true);
    const data = await getMissions(user.id);
    setMissions(data);
    setLoading(false);
  }

  async function handleCancel(missionId: string) {
    if (!user) return;
    setCancelling(missionId);
    const result = await cancelMission(missionId, user.id);
    if (result.success) {
      setMissions(prev => prev.map(m =>
        m.id === missionId ? { ...m, status: 'CANCELLED' } : m
      ));
    }
    setCancelling(null);
  }

  const activeMissions = missions.filter(m => !TERMINAL_STATUSES.includes(m.status));
  const pastMissions = missions.filter(m => TERMINAL_STATUSES.includes(m.status));

  if (loading) {
    return (
      <Box sx={{ px: 2, pt: 3 }}>
        <Typography variant="h6" sx={{ color: '#fff', fontWeight: 700, mb: 2 }}>미션</Typography>
        {[1, 2, 3].map(i => (
          <Skeleton key={i} variant="rounded" height={100} sx={{ mb: 1.5, bgcolor: 'rgba(255,255,255,0.05)', borderRadius: 3 }} />
        ))}
      </Box>
    );
  }

  return (
    <Box sx={{ px: 2, pt: 3, pb: 10 }}>
      <Typography variant="h6" sx={{ color: '#fff', fontWeight: 700, mb: 2 }}>미션</Typography>

      {missions.length === 0 && (
        <Box sx={{ textAlign: 'center', mt: 6 }}>
          <DirectionsCarIcon sx={{ fontSize: 48, color: 'rgba(255,255,255,0.2)', mb: 1 }} />
          <Typography variant="body2" sx={{ color: 'rgba(255,255,255,0.4)' }}>
            아직 미션 이력이 없습니다.
          </Typography>
        </Box>
      )}

      {activeMissions.length > 0 && (
        <Box sx={{ mb: 3 }}>
          <Typography variant="caption" sx={{ color: 'rgba(255,255,255,0.4)', fontWeight: 600, letterSpacing: 1, mb: 1, display: 'block' }}>
            진행 중
          </Typography>
          {activeMissions.map(mission => (
            <Card key={mission.id} sx={{ bgcolor: 'rgba(0,212,170,0.05)', border: '1px solid rgba(0,212,170,0.2)', borderRadius: 3, mb: 1.5 }}>
              <CardContent sx={{ p: 2, '&:last-child': { pb: 2 } }}>
                <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 1 }}>
                  <Chip
                    size="small"
                    label={MISSION_STATUS_LABELS[mission.status]}
                    sx={{ bgcolor: STATUS_COLORS[mission.status] + '22', color: STATUS_COLORS[mission.status], fontWeight: 600, fontSize: '0.7rem' }}
                  />
                  {mission.eta && (
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
                      <AccessTimeIcon sx={{ fontSize: 14, color: '#00d4aa' }} />
                      <Typography variant="caption" sx={{ color: '#00d4aa', fontWeight: 600 }}>
                        ~{mission.eta.value}분
                      </Typography>
                    </Box>
                  )}
                </Box>
                <LinearProgress
                  variant="determinate"
                  value={getProgressValue(mission.status)}
                  sx={{ height: 4, borderRadius: 2, bgcolor: 'rgba(255,255,255,0.1)', '& .MuiLinearProgress-bar': { bgcolor: '#00d4aa' } }}
                />
                <Box sx={{ display: 'flex', justifyContent: 'space-between', mt: 1.5, alignItems: 'center' }}>
                  <Typography variant="caption" sx={{ color: 'rgba(255,255,255,0.4)' }}>
                    {new Date(mission.requestedAt).toLocaleTimeString('ko-KR', { hour: '2-digit', minute: '2-digit' })}
                  </Typography>
                  {['REQUESTED', 'QUEUED'].includes(mission.status) && (
                    <Button
                      size="small"
                      startIcon={<CancelIcon sx={{ fontSize: 14 }} />}
                      onClick={() => handleCancel(mission.id)}
                      disabled={cancelling === mission.id}
                      sx={{ color: '#ff5252', fontSize: '0.72rem', textTransform: 'none' }}
                    >
                      취소
                    </Button>
                  )}
                </Box>
              </CardContent>
            </Card>
          ))}
        </Box>
      )}

      {pastMissions.length > 0 && (
        <Box>
          <Typography variant="caption" sx={{ color: 'rgba(255,255,255,0.4)', fontWeight: 600, letterSpacing: 1, mb: 1, display: 'block' }}>
            지난 미션
          </Typography>
          {pastMissions.map(mission => (
            <Card key={mission.id} sx={{ bgcolor: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.06)', borderRadius: 2, mb: 1 }}>
              <CardContent sx={{ py: 1.5, px: 2, '&:last-child': { pb: 1.5 } }}>
                <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                    {mission.status === 'COMPLETED' ? (
                      <CheckCircleIcon sx={{ fontSize: 18, color: '#22c55e' }} />
                    ) : (
                      <ErrorIcon sx={{ fontSize: 18, color: '#ef4444' }} />
                    )}
                    <Box>
                      <Typography variant="body2" sx={{ color: '#fff', fontWeight: 500 }}>
                        {MISSION_STATUS_LABELS[mission.status]}
                      </Typography>
                      <Typography variant="caption" sx={{ color: 'rgba(255,255,255,0.3)' }}>
                        {new Date(mission.requestedAt).toLocaleDateString('ko-KR')}
                      </Typography>
                    </Box>
                  </Box>
                  {mission.reasonCode && (
                    <Typography variant="caption" sx={{ color: 'rgba(255,255,255,0.3)', maxWidth: 120, textAlign: 'right' }}>
                      {mission.reasonCode}
                    </Typography>
                  )}
                </Box>
                {mission.status === 'SAFETY_REJECTED' && (
                  <Alert severity="info" sx={{ mt: 1, py: 0, borderRadius: 1, '& .MuiAlert-message': { fontSize: '0.7rem' } }}>
                    안전 사유로 거절됨 - 미청구
                  </Alert>
                )}
              </CardContent>
            </Card>
          ))}
        </Box>
      )}
    </Box>
  );
}

function getProgressValue(status: UserMissionStatus): number {
  const map: Partial<Record<UserMissionStatus, number>> = {
    REQUESTED: 10, QUEUED: 20, ALLOCATING: 35, IN_TRANSIT: 55, ALIGNING: 70, DOCKING: 80, AT_PICKUP: 90, COMPLETED: 100,
  };
  return map[status] ?? 0;
}
