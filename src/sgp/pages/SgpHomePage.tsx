import { useState, useEffect, useCallback } from 'react';
import Box from '@mui/material/Box';
import Typography from '@mui/material/Typography';
import Card from '@mui/material/Card';
import CardContent from '@mui/material/CardContent';
import CardActionArea from '@mui/material/CardActionArea';
import Button from '@mui/material/Button';
import Chip from '@mui/material/Chip';
import Skeleton from '@mui/material/Skeleton';
import Alert from '@mui/material/Alert';
import IconButton from '@mui/material/IconButton';
import LocalParkingIcon from '@mui/icons-material/LocalParking';
import DirectionsCarIcon from '@mui/icons-material/DirectionsCar';
import AddLocationIcon from '@mui/icons-material/AddLocation';
import AccessTimeIcon from '@mui/icons-material/AccessTime';
import SignalWifiOffIcon from '@mui/icons-material/SignalWifiOff';
import ApartmentIcon from '@mui/icons-material/Apartment';
import BusinessIcon from '@mui/icons-material/Business';
import StorefrontIcon from '@mui/icons-material/Storefront';
import ArrowForwardIosIcon from '@mui/icons-material/ArrowForwardIos';
import { useNavigate } from 'react-router-dom';
import { useSgpAuth } from '../contexts/SgpAuthContext';
import { getPlaces } from '../services/placeService';
import { subscribeToTopic, getConnectionState, onConnectionChange } from '../services/realtimeSdk';
import type { Place, PlaceType, RealtimeEvent } from '../types';

const TYPE_ICONS: Record<PlaceType, React.ReactNode> = {
  HOME_UNIT: <ApartmentIcon />,
  OFFICE: <BusinessIcon />,
  PARTNER: <StorefrontIcon />,
  VISITOR_TARGET: <LocalParkingIcon />,
};

const TYPE_LABELS: Record<PlaceType, string> = {
  HOME_UNIT: '거주',
  OFFICE: '사무실',
  PARTNER: '제휴',
  VISITOR_TARGET: '방문',
};

export default function SgpHomePage() {
  const { user, wallet } = useSgpAuth();
  const navigate = useNavigate();
  const [places, setPlaces] = useState<Place[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [connectionStatus, setConnectionStatus] = useState(getConnectionState());

  useEffect(() => {
    return onConnectionChange(setConnectionStatus);
  }, []);

  useEffect(() => {
    if (!user) return;
    loadPlaces();
  }, [user]);

  useEffect(() => {
    if (!user || places.length === 0) return;

    const unsub = subscribeToTopic('availability', (event: RealtimeEvent) => {
      if (event.action === 'AvailabilityChanged' || event.action === 'PlaceEtaEstimate') {
        const siteId = event.payload.siteId as string;
        setPlaces(prev => prev.map(p => {
          if (p.siteId !== siteId) return p;
          return {
            ...p,
            availableSpots: (event.payload.available as number) ?? p.availableSpots,
            etaMinutes: (event.payload.etaMinutes as number) ?? p.etaMinutes,
            etaAsOf: event.timestamp,
            etaValidFor: (event.payload.validFor as number) ?? 300,
          };
        }));
      }
    });

    return unsub;
  }, [user, places.length]);

  const loadPlaces = useCallback(async () => {
    if (!user) return;
    setLoading(true);
    setError('');
    try {
      const data = await getPlaces(user.id);
      setPlaces(data);
    } catch {
      setError('장소를 불러올 수 없습니다.');
    }
    setLoading(false);
  }, [user]);

  const greetingTime = () => {
    const h = new Date().getHours();
    if (h < 6) return '새벽';
    if (h < 12) return '좋은 아침';
    if (h < 18) return '좋은 오후';
    return '좋은 저녁';
  };

  const handleQuickAction = (place: Place) => {
    if (place.capabilities.includes('DIRECT_UNIT')) {
      navigate('/app/mission/request', { state: { place, type: 'DIRECT_UNIT_EXIT' } });
    } else if (place.capabilities.includes('AUTO_VALET')) {
      navigate('/app/mission/request', { state: { place, type: 'AUTO_VALET_EXIT' } });
    } else {
      navigate(`/app/places/${place.id}`);
    }
  };

  // ─── Zero-state (§4.2) ───
  if (!loading && places.length === 0) {
    return (
      <Box sx={{ px: 2, pt: 4, pb: 10 }}>
        <Typography variant="h6" sx={{ color: '#fff', fontWeight: 700, mb: 1 }}>
          {greetingTime()}, {user?.display_name ?? ''}
        </Typography>
        <Box sx={{ mt: 6, textAlign: 'center' }}>
          <AddLocationIcon sx={{ fontSize: 64, color: 'rgba(0,212,170,0.4)', mb: 2 }} />
          <Typography variant="h6" sx={{ color: '#fff', fontWeight: 700, mb: 1 }}>
            첫 장소를 등록해보세요
          </Typography>
          <Typography variant="body2" sx={{ color: 'rgba(255,255,255,0.5)', mb: 3, px: 2 }}>
            거주 단지, 사무실, 또는 제휴 주차장을 추가하면 원탭으로 출차/입차를 요청할 수 있습니다.
          </Typography>
          <Button
            variant="contained"
            startIcon={<AddLocationIcon />}
            onClick={() => navigate('/app/places/add')}
            sx={{
              bgcolor: '#00d4aa', color: '#0d1b2a', fontWeight: 700,
              borderRadius: 3, px: 4, py: 1.2,
              '&:hover': { bgcolor: '#00b894' },
            }}
          >
            장소 추가
          </Button>
        </Box>
      </Box>
    );
  }

  // ─── Loading state ───
  if (loading) {
    return (
      <Box sx={{ px: 2, pt: 4 }}>
        <Skeleton variant="text" width={200} sx={{ bgcolor: 'rgba(255,255,255,0.1)' }} />
        <Skeleton variant="rounded" height={120} sx={{ mt: 2, bgcolor: 'rgba(255,255,255,0.05)', borderRadius: 3 }} />
        <Skeleton variant="rounded" height={120} sx={{ mt: 2, bgcolor: 'rgba(255,255,255,0.05)', borderRadius: 3 }} />
      </Box>
    );
  }

  // ─── Error state ───
  if (error) {
    return (
      <Box sx={{ px: 2, pt: 4 }}>
        <Alert severity="error" sx={{ borderRadius: 2 }}>{error}</Alert>
        <Button onClick={loadPlaces} sx={{ mt: 2, color: '#00d4aa' }}>다시 시도</Button>
      </Box>
    );
  }

  const grouped = {
    HOME_UNIT: places.filter(p => p.type === 'HOME_UNIT'),
    OFFICE: places.filter(p => p.type === 'OFFICE'),
    PARTNER: places.filter(p => p.type === 'PARTNER'),
    VISITOR_TARGET: places.filter(p => p.type === 'VISITOR_TARGET'),
  };

  return (
    <Box sx={{ px: 2, pt: 3, pb: 10 }}>
      {/* Connection Warning */}
      {connectionStatus !== 'connected' && (
        <Alert
          severity="warning"
          icon={<SignalWifiOffIcon />}
          sx={{ mb: 2, borderRadius: 2, bgcolor: 'rgba(255,152,0,0.1)', color: '#ffb74d' }}
        >
          {connectionStatus === 'disconnected' ? '오프라인 - 마지막 데이터 표시 중' : '재연결 중...'}
        </Alert>
      )}

      {/* Header */}
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2.5 }}>
        <Box>
          <Typography variant="body2" sx={{ color: 'rgba(255,255,255,0.5)' }}>
            {greetingTime()}
          </Typography>
          <Typography variant="h6" sx={{ color: '#fff', fontWeight: 700 }}>
            {user?.display_name ?? 'Sky Garage'}
          </Typography>
        </Box>
        {wallet && (
          <Chip
            label={`${wallet.balance.toLocaleString()}C`}
            size="small"
            onClick={() => navigate('/app/wallet')}
            sx={{
              bgcolor: 'rgba(0,212,170,0.1)', color: '#00d4aa', fontWeight: 700,
              border: '1px solid rgba(0,212,170,0.2)',
            }}
          />
        )}
      </Box>

      {/* Favorites Cards */}
      {Object.entries(grouped).map(([type, items]) => {
        if (items.length === 0) return null;
        return (
          <Box key={type} sx={{ mb: 3 }}>
            <Typography variant="caption" sx={{ color: 'rgba(255,255,255,0.4)', fontWeight: 600, letterSpacing: 1, textTransform: 'uppercase', mb: 1, display: 'block' }}>
              {TYPE_LABELS[type as PlaceType]}
            </Typography>
            {items.map(place => (
              <Card
                key={place.id}
                sx={{
                  bgcolor: 'rgba(255,255,255,0.04)',
                  border: '1px solid rgba(255,255,255,0.08)',
                  borderRadius: 3,
                  mb: 1.5,
                  overflow: 'visible',
                }}
              >
                <CardActionArea onClick={() => handleQuickAction(place)} sx={{ p: 0 }}>
                  <CardContent sx={{ p: 2, '&:last-child': { pb: 2 } }}>
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5 }}>
                      <Box sx={{
                        width: 40, height: 40, borderRadius: 2,
                        bgcolor: 'rgba(0,212,170,0.1)',
                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                        color: '#00d4aa',
                      }}>
                        {TYPE_ICONS[place.type]}
                      </Box>
                      <Box sx={{ flex: 1 }}>
                        <Typography variant="subtitle2" sx={{ color: '#fff', fontWeight: 600 }}>
                          {place.label}
                        </Typography>
                        <Typography variant="caption" sx={{ color: 'rgba(255,255,255,0.4)' }}>
                          {place.siteName}
                        </Typography>
                      </Box>
                      <Box sx={{ textAlign: 'right' }}>
                        {place.availableSpots !== undefined && (
                          <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
                            <LocalParkingIcon sx={{ fontSize: 14, color: place.availableSpots > 5 ? '#00d4aa' : '#ff5252' }} />
                            <Typography variant="caption" sx={{ color: place.availableSpots > 5 ? '#00d4aa' : '#ff5252', fontWeight: 600 }}>
                              {place.availableSpots}면
                            </Typography>
                          </Box>
                        )}
                        {place.etaMinutes !== undefined && (
                          <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.3 }}>
                            <AccessTimeIcon sx={{ fontSize: 12, color: 'rgba(255,255,255,0.4)' }} />
                            <Typography variant="caption" sx={{
                              color: connectionStatus !== 'connected' ? 'rgba(255,255,255,0.3)' : 'rgba(255,255,255,0.6)',
                              fontStyle: connectionStatus !== 'connected' ? 'italic' : 'normal',
                            }}>
                              ~{place.etaMinutes}분
                            </Typography>
                          </Box>
                        )}
                      </Box>
                      <IconButton size="small" sx={{ color: 'rgba(255,255,255,0.3)' }}>
                        <ArrowForwardIosIcon sx={{ fontSize: 14 }} />
                      </IconButton>
                    </Box>
                    {/* Quick Action */}
                    {place.grant === 'active' && place.capabilities.includes('DIRECT_UNIT') && (
                      <Box sx={{ mt: 1.5, display: 'flex', gap: 1 }}>
                        <Button
                          size="small"
                          variant="contained"
                          startIcon={<DirectionsCarIcon sx={{ fontSize: 16 }} />}
                          onClick={(e) => { e.stopPropagation(); navigate('/app/mission/request', { state: { place, type: 'DIRECT_UNIT_EXIT' } }); }}
                          sx={{
                            bgcolor: '#00d4aa', color: '#0d1b2a', fontWeight: 700,
                            borderRadius: 2, fontSize: '0.72rem', py: 0.5, px: 1.5,
                            textTransform: 'none',
                            '&:hover': { bgcolor: '#00b894' },
                          }}
                        >
                          출차
                        </Button>
                        <Button
                          size="small"
                          variant="outlined"
                          onClick={(e) => { e.stopPropagation(); navigate('/app/mission/request', { state: { place, type: 'DIRECT_UNIT_ENTRY' } }); }}
                          sx={{
                            color: '#00d4aa', borderColor: 'rgba(0,212,170,0.3)',
                            borderRadius: 2, fontSize: '0.72rem', py: 0.5, px: 1.5,
                            textTransform: 'none',
                          }}
                        >
                          입차
                        </Button>
                      </Box>
                    )}
                  </CardContent>
                </CardActionArea>
              </Card>
            ))}
          </Box>
        );
      })}

      {/* Add Place FAB */}
      <Box sx={{ textAlign: 'center', mt: 2 }}>
        <Button
          startIcon={<AddLocationIcon />}
          onClick={() => navigate('/app/places/add')}
          sx={{ color: 'rgba(255,255,255,0.5)', textTransform: 'none', fontSize: '0.82rem' }}
        >
          장소 추가
        </Button>
      </Box>
    </Box>
  );
}
