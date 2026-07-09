import { useState, useEffect } from 'react';
import Box from '@mui/material/Box';
import Typography from '@mui/material/Typography';
import Card from '@mui/material/Card';
import CardContent from '@mui/material/CardContent';
import Chip from '@mui/material/Chip';
import Button from '@mui/material/Button';
import CircularProgress from '@mui/material/CircularProgress';
import DirectionsCarIcon from '@mui/icons-material/DirectionsCar';
import AccessTimeIcon from '@mui/icons-material/AccessTime';
import CheckCircleIcon from '@mui/icons-material/CheckCircle';
import CancelIcon from '@mui/icons-material/Cancel';
import { useNavigate } from 'react-router-dom';
import { useSgpAuth } from '../contexts/SgpAuthContext';
import { listMissions, getActiveMission, cancelMission } from '../services/missionService';
import type { Mission } from '../types';

const STATUS_LABELS: Record<string, string> = {
  REQUESTED: '요청됨',
  QUEUED: '대기중',
  ASSIGNED: '배정됨',
  IN_PROGRESS: '진행중',
  COMPLETED: '완료',
  CANCELLED: '취소됨',
  SAFETY_REJECTED: '안전거부',
};

const STATUS_COLORS: Record<string, 'warning' | 'info' | 'success' | 'error' | 'default'> = {
  REQUESTED: 'warning',
  QUEUED: 'warning',
  ASSIGNED: 'info',
  IN_PROGRESS: 'info',
  COMPLETED: 'success',
  CANCELLED: 'default',
  SAFETY_REJECTED: 'error',
};

export default function SgpMissionsPage() {
  const { user } = useSgpAuth();
  const navigate = useNavigate();
  const [missions, setMissions] = useState<Mission[]>([]);
  const [active, setActive] = useState<Mission | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!user) return;
    loadData();
  }, [user]);

  async function loadData() {
    setLoading(true);
    setError(null);
    try {
      const [missionList, activeMission] = await Promise.all([
        listMissions(user!.id),
        getActiveMission(user!.id),
      ]);
      setMissions(missionList);
      setActive(activeMission);
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setLoading(false);
    }
  }

  async function handleCancel(missionId: string) {
    try {
      await cancelMission(missionId);
      await loadData();
    } catch (err) {
      setError((err as Error).message);
    }
  }

  if (loading) {
    return (
      <Box sx={{ display: 'flex', justifyContent: 'center', py: 8 }}>
        <CircularProgress sx={{ color: '#00d4aa' }} />
      </Box>
    );
  }

  if (error) {
    return (
      <Box sx={{ p: 3, textAlign: 'center' }}>
        <Typography color="error" variant="body2" sx={{ mb: 2 }}>{error}</Typography>
        <Button onClick={loadData} size="small" sx={{ color: '#00d4aa' }}>다시 시도</Button>
      </Box>
    );
  }

  return (
    <Box sx={{ p: 2 }}>
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2 }}>
        <Typography variant="subtitle1" sx={{ color: '#fff', fontWeight: 700 }}>내 미션</Typography>
        <Button
          variant="contained"
          size="small"
          onClick={() => navigate('/app/missions/request')}
          sx={{ bgcolor: '#00d4aa', color: '#0d1b2a', fontWeight: 700, '&:hover': { bgcolor: '#00b894' } }}
        >
          차량 호출
        </Button>
      </Box>

      {active && (
        <Card sx={{ mb: 2, border: '1px solid rgba(0,212,170,0.3)', bgcolor: 'rgba(0,212,170,0.05)', borderRadius: 2 }}>
          <CardContent sx={{ p: 2 }}>
            <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 1 }}>
              <Typography variant="body2" sx={{ color: '#00d4aa', fontWeight: 700 }}>진행중인 미션</Typography>
              <Chip label={STATUS_LABELS[active.status]} color={STATUS_COLORS[active.status]} size="small" />
            </Box>
            {active.eta && (
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5, mb: 1 }}>
                <AccessTimeIcon sx={{ fontSize: 16, color: 'rgba(255,255,255,0.5)' }} />
                <Typography variant="caption" sx={{ color: 'rgba(255,255,255,0.7)' }}>
                  예상 {active.eta.estimatedMinutes}분
                </Typography>
              </Box>
            )}
            {(active.status === 'REQUESTED' || active.status === 'QUEUED') && (
              <Button
                size="small"
                color="error"
                onClick={() => handleCancel(active.id)}
                sx={{ mt: 1 }}
              >
                취소
              </Button>
            )}
          </CardContent>
        </Card>
      )}

      {missions.length === 0 ? (
        <Box sx={{ textAlign: 'center', py: 6 }}>
          <DirectionsCarIcon sx={{ fontSize: 48, color: 'rgba(255,255,255,0.2)', mb: 1 }} />
          <Typography variant="body2" sx={{ color: 'rgba(255,255,255,0.4)' }}>미션 내역이 없습니다</Typography>
        </Box>
      ) : (
        missions.map(mission => (
          <Card key={mission.id} sx={{ mb: 1.5, bgcolor: 'rgba(255,255,255,0.03)', borderRadius: 2 }}>
            <CardContent sx={{ p: 2, '&:last-child': { pb: 2 } }}>
              <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                  {mission.status === 'COMPLETED' ? (
                    <CheckCircleIcon sx={{ fontSize: 18, color: '#4caf50' }} />
                  ) : mission.status === 'CANCELLED' ? (
                    <CancelIcon sx={{ fontSize: 18, color: 'rgba(255,255,255,0.3)' }} />
                  ) : (
                    <DirectionsCarIcon sx={{ fontSize: 18, color: '#00d4aa' }} />
                  )}
                  <Box>
                    <Typography variant="body2" sx={{ color: '#fff', fontWeight: 500 }}>
                      {mission.type.replace(/_/g, ' ')}
                    </Typography>
                    <Typography variant="caption" sx={{ color: 'rgba(255,255,255,0.4)' }}>
                      {new Date(mission.createdAt).toLocaleDateString('ko-KR', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })}
                    </Typography>
                  </Box>
                </Box>
                <Chip label={STATUS_LABELS[mission.status]} color={STATUS_COLORS[mission.status]} size="small" />
              </Box>
            </CardContent>
          </Card>
        ))
      )}
    </Box>
  );
}
