import { useState } from 'react';
import Box from '@mui/material/Box';
import Typography from '@mui/material/Typography';
import Button from '@mui/material/Button';
import Card from '@mui/material/Card';
import CardContent from '@mui/material/CardContent';
import Alert from '@mui/material/Alert';
import CircularProgress from '@mui/material/CircularProgress';
import CheckCircleIcon from '@mui/icons-material/CheckCircle';
import DirectionsCarIcon from '@mui/icons-material/DirectionsCar';
import SignalWifiOffIcon from '@mui/icons-material/SignalWifiOff';
import { useLocation, useNavigate } from 'react-router-dom';
import { useSgpAuth } from '../contexts/SgpAuthContext';
import { requestMission } from '../services/missionService';
import { getConnectionState } from '../services/realtimeSdk';
import type { Place, MissionType } from '../types';

export default function SgpMissionRequest() {
  const { user } = useSgpAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const { place, type } = (location.state ?? {}) as { place?: Place; type?: MissionType };
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);
  const [queued, setQueued] = useState(false);
  const [error, setError] = useState('');

  const isOffline = getConnectionState() === 'disconnected';

  const typeLabels: Record<MissionType, string> = {
    DIRECT_UNIT_EXIT: '세대직입 출차',
    DIRECT_UNIT_ENTRY: '세대직입 입차',
    AUTO_VALET_CHECKIN: '발렛 체크인',
    AUTO_VALET_EXIT: '발렛 출차',
    SCHEDULED: '사전 예약',
  };

  async function handleRequest() {
    if (!user || !place || !type) return;
    setLoading(true);
    setError('');

    const result = await requestMission(
      user.id,
      place.siteId,
      place.id,
      'default-vehicle',
      type
    );

    setLoading(false);

    if (result.success) {
      if (result.queued) {
        setQueued(true);
      } else {
        setSuccess(true);
        setTimeout(() => navigate('/app/missions'), 2000);
      }
    } else {
      setError(result.error ?? '요청에 실패했습니다.');
    }
  }

  if (!place || !type) {
    return (
      <Box sx={{ px: 2, pt: 4 }}>
        <Alert severity="error" sx={{ borderRadius: 2 }}>잘못된 접근입니다.</Alert>
        <Button onClick={() => navigate('/app')} sx={{ mt: 2, color: '#00d4aa' }}>홈으로</Button>
      </Box>
    );
  }

  if (success) {
    return (
      <Box sx={{ px: 2, pt: 8, textAlign: 'center' }}>
        <CheckCircleIcon sx={{ fontSize: 64, color: '#00d4aa', mb: 2 }} />
        <Typography variant="h6" sx={{ color: '#fff', fontWeight: 700, mb: 1 }}>요청 접수 완료</Typography>
        <Typography variant="body2" sx={{ color: 'rgba(255,255,255,0.5)' }}>
          미션 상태에서 진행 상황을 확인하세요.
        </Typography>
      </Box>
    );
  }

  if (queued) {
    return (
      <Box sx={{ px: 2, pt: 8, textAlign: 'center' }}>
        <SignalWifiOffIcon sx={{ fontSize: 64, color: '#ffb74d', mb: 2 }} />
        <Typography variant="h6" sx={{ color: '#fff', fontWeight: 700, mb: 1 }}>오프라인 대기열에 저장됨</Typography>
        <Typography variant="body2" sx={{ color: 'rgba(255,255,255,0.5)', mb: 3 }}>
          네트워크 연결 시 자동으로 전송됩니다. 전송 전 재확인을 요청합니다.
        </Typography>
        <Button onClick={() => navigate('/app')} sx={{ color: '#00d4aa' }}>홈으로</Button>
      </Box>
    );
  }

  return (
    <Box sx={{ px: 2, pt: 3, pb: 10 }}>
      <Typography variant="h6" sx={{ color: '#fff', fontWeight: 700, mb: 3 }}>
        {typeLabels[type]}
      </Typography>

      {isOffline && (
        <Alert severity="warning" icon={<SignalWifiOffIcon />} sx={{ mb: 2, borderRadius: 2 }}>
          오프라인 상태입니다. 요청은 대기열에 저장됩니다.
        </Alert>
      )}

      <Card sx={{ bgcolor: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 3, mb: 3 }}>
        <CardContent>
          <Typography variant="subtitle2" sx={{ color: '#fff', fontWeight: 600 }}>{place.label}</Typography>
          <Typography variant="caption" sx={{ color: 'rgba(255,255,255,0.4)' }}>{place.siteName}</Typography>
          {place.etaMinutes !== undefined && (
            <Typography variant="body2" sx={{ color: '#00d4aa', mt: 1 }}>
              예상 소요: ~{place.etaMinutes}분
            </Typography>
          )}
        </CardContent>
      </Card>

      {error && <Alert severity="error" sx={{ mb: 2, borderRadius: 2 }}>{error}</Alert>}

      <Button
        fullWidth
        variant="contained"
        startIcon={loading ? <CircularProgress size={20} color="inherit" /> : <DirectionsCarIcon />}
        onClick={handleRequest}
        disabled={loading}
        sx={{
          bgcolor: '#00d4aa', color: '#0d1b2a', fontWeight: 700,
          borderRadius: 3, py: 1.5, fontSize: '1rem',
          '&:hover': { bgcolor: '#00b894' },
        }}
      >
        {loading ? '요청 중...' : `${typeLabels[type]} 요청`}
      </Button>

      <Button
        fullWidth
        onClick={() => navigate(-1)}
        sx={{ mt: 1.5, color: 'rgba(255,255,255,0.5)', textTransform: 'none' }}
      >
        취소
      </Button>
    </Box>
  );
}
