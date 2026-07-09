import { useState, useEffect } from 'react';
import Box from '@mui/material/Box';
import Typography from '@mui/material/Typography';
import Button from '@mui/material/Button';
import Card from '@mui/material/Card';
import CardContent from '@mui/material/CardContent';
import Alert from '@mui/material/Alert';
import CircularProgress from '@mui/material/CircularProgress';
import MenuItem from '@mui/material/MenuItem';
import TextField from '@mui/material/TextField';
import CheckCircleIcon from '@mui/icons-material/CheckCircle';
import DirectionsCarIcon from '@mui/icons-material/DirectionsCar';
import SignalWifiOffIcon from '@mui/icons-material/SignalWifiOff';
import { useLocation, useNavigate } from 'react-router-dom';
import { useSgpAuth } from '../contexts/SgpAuthContext';
import { requestMission } from '../services/missionService';
import { getVehicles } from '../services/vehicleService';
import { getConnectionState } from '../services/realtimeSdk';
import type { Place, MissionType, Vehicle } from '../types';

export default function SgpMissionRequest() {
  const { user } = useSgpAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const { place, type } = (location.state ?? {}) as { place?: Place; type?: MissionType };
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);
  const [queued, setQueued] = useState(false);
  const [error, setError] = useState('');
  const [vehicles, setVehicles] = useState<Vehicle[]>([]);
  const [selectedVehicleId, setSelectedVehicleId] = useState('');
  const [vehiclesLoading, setVehiclesLoading] = useState(true);

  const isOffline = getConnectionState() === 'disconnected';

  const typeLabels: Record<MissionType, string> = {
    DIRECT_UNIT_EXIT: '세대직입 출차',
    DIRECT_UNIT_ENTRY: '세대직입 입차',
    AUTO_VALET_CHECKIN: '발렛 체크인',
    AUTO_VALET_EXIT: '발렛 출차',
    SCHEDULED: '사전 예약',
  };

  useEffect(() => {
    if (!user) return;
    loadVehicles();
  }, [user]);

  async function loadVehicles() {
    if (!user) return;
    const data = await getVehicles(user.id);
    setVehicles(data);
    const defaultV = data.find(v => v.isDefault);
    if (defaultV) setSelectedVehicleId(defaultV.id);
    else if (data.length > 0) setSelectedVehicleId(data[0].id);
    setVehiclesLoading(false);
  }

  async function handleRequest() {
    if (!user || !place || !type) return;
    setLoading(true);
    setError('');

    const vehicleId = selectedVehicleId || 'no-vehicle';

    const result = await requestMission(
      user.id,
      place.siteId,
      place.id,
      vehicleId,
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

      <Card sx={{ bgcolor: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 3, mb: 2 }}>
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

      {/* Vehicle Selection */}
      {vehiclesLoading ? (
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 3, py: 1 }}>
          <CircularProgress size={16} sx={{ color: 'rgba(255,255,255,0.3)' }} />
          <Typography variant="caption" sx={{ color: 'rgba(255,255,255,0.4)' }}>차량 불러오는 중...</Typography>
        </Box>
      ) : vehicles.length === 0 ? (
        <Alert severity="info" sx={{ mb: 3, borderRadius: 2 }}>
          등록된 차량이 없습니다. 내정보에서 차량을 등록해주세요.
        </Alert>
      ) : (
        <TextField
          select
          fullWidth
          size="small"
          label="차량 선택"
          value={selectedVehicleId}
          onChange={e => setSelectedVehicleId(e.target.value)}
          sx={{
            mb: 3,
            '& .MuiOutlinedInput-root': { bgcolor: 'rgba(255,255,255,0.05)', color: '#fff', borderRadius: 2 },
            '& .MuiInputLabel-root': { color: 'rgba(255,255,255,0.4)' },
            '& .MuiSelect-icon': { color: 'rgba(255,255,255,0.4)' },
          }}
        >
          {vehicles.map(v => (
            <MenuItem key={v.id} value={v.id}>
              {v.plate}{v.isDefault ? ' (기본)' : ''} - {[v.brand, v.model].filter(Boolean).join(' ') || '미입력'}
            </MenuItem>
          ))}
        </TextField>
      )}

      {error && <Alert severity="error" sx={{ mb: 2, borderRadius: 2 }}>{error}</Alert>}

      <Button
        fullWidth
        variant="contained"
        startIcon={loading ? <CircularProgress size={20} color="inherit" /> : <DirectionsCarIcon />}
        onClick={handleRequest}
        disabled={loading || (vehicles.length > 0 && !selectedVehicleId)}
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
