import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import Box from '@mui/material/Box';
import Card from '@mui/material/Card';
import CardContent from '@mui/material/CardContent';
import Typography from '@mui/material/Typography';
import TextField from '@mui/material/TextField';
import Button from '@mui/material/Button';
import Alert from '@mui/material/Alert';
import Divider from '@mui/material/Divider';
import CircularProgress from '@mui/material/CircularProgress';
import List from '@mui/material/List';
import ListItemButton from '@mui/material/ListItemButton';
import ListItemText from '@mui/material/ListItemText';
import ListItemIcon from '@mui/material/ListItemIcon';
import Chip from '@mui/material/Chip';
import ApartmentIcon from '@mui/icons-material/Apartment';
import MyLocationIcon from '@mui/icons-material/MyLocation';
import CheckCircleIcon from '@mui/icons-material/CheckCircle';
import ArrowBackIcon from '@mui/icons-material/ArrowBack';
import DirectionsCarIcon from '@mui/icons-material/DirectionsCar';
import { supabase } from '../../lib/supabase';
import { useParkingAuth, type Complex } from '../contexts/ParkingAuthContext';

function getDistanceKm(lat1: number, lng1: number, lat2: number, lng2: number): number {
  const R = 6371;
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLng = (lng2 - lng1) * Math.PI / 180;
  const a = Math.sin(dLat / 2) ** 2 + Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) * Math.sin(dLng / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

export default function LoginPage() {
  const navigate = useNavigate();
  const { signIn, user, selectComplex } = useParkingAuth();
  const [step, setStep] = useState<'complex' | 'login'>('complex');
  const [complexes, setComplexes] = useState<Complex[]>([]);
  const [selectedComplex, setSelectedComplex] = useState<Complex | null>(null);
  const [loadingComplexes, setLoadingComplexes] = useState(true);
  const [geoLoading, setGeoLoading] = useState(false);
  const [geoError, setGeoError] = useState('');
  const [nearestComplex, setNearestComplex] = useState<Complex | null>(null);

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loginLoading, setLoginLoading] = useState(false);

  useEffect(() => {
    supabase
      .from('complexes')
      .select('id, name, code, address, region, status, lat, lng')
      .in('status', ['active', 'poc'])
      .order('name')
      .then(({ data }) => {
        setComplexes(data ?? []);
        setLoadingComplexes(false);
      });
  }, []);

  const handleGeoDetect = () => {
    if (!navigator.geolocation) {
      setGeoError('이 기기에서는 위치 서비스를 사용할 수 없습니다.');
      return;
    }
    setGeoLoading(true);
    setGeoError('');
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        const { latitude, longitude } = pos.coords;
        let closest: Complex | null = null;
        let minDist = Infinity;
        for (const c of complexes) {
          if (c.lat == null || c.lng == null) continue;
          const d = getDistanceKm(latitude, longitude, c.lat, c.lng);
          if (d < minDist) {
            minDist = d;
            closest = c;
          }
        }
        if (closest && minDist < 5) {
          setNearestComplex(closest);
          setSelectedComplex(closest);
        } else if (closest) {
          setGeoError(`가장 가까운 단지(${closest.name})가 ${minDist.toFixed(1)}km 거리에 있습니다. 단지를 직접 선택해주세요.`);
        } else {
          setGeoError('주변에 등록된 단지가 없습니다.');
        }
        setGeoLoading(false);
      },
      () => {
        setGeoError('위치 정보를 가져올 수 없습니다. 단지를 직접 선택해주세요.');
        setGeoLoading(false);
      },
      { enableHighAccuracy: true, timeout: 10000 }
    );
  };

  const handleSelectComplex = async (c: Complex) => {
    setSelectedComplex(c);
    if (user) {
      await selectComplex(c.id);
    } else {
      setStep('login');
    }
  };

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email || !password || !selectedComplex) return;
    setLoginLoading(true);
    setError('');
    const { error: err } = await signIn(email, password, selectedComplex.id);
    if (err) {
      setError(err);
      setLoginLoading(false);
    }
  };

  return (
    <Box sx={{ minHeight: '100vh', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', p: 2, bgcolor: 'background.default' }}>
      {/* Home link */}
      <Box sx={{ position: 'absolute', top: 16, left: 16 }}>
        <Button
          size="small"
          startIcon={<ArrowBackIcon />}
          onClick={() => navigate('/')}
          sx={{ color: 'text.secondary', fontSize: '0.75rem' }}
        >
          메인
        </Button>
      </Box>

      <Card sx={{ width: '100%', maxWidth: 420, border: '1px solid', borderColor: 'divider' }}>
        <CardContent sx={{ p: 3 }}>
          {/* Header */}
          <Box sx={{ textAlign: 'center', mb: 3 }}>
            <DirectionsCarIcon sx={{ fontSize: 40, color: 'primary.main', mb: 0.5 }} />
            <Typography variant="h5" sx={{ fontWeight: 800, letterSpacing: -0.5 }}>SkyGarage</Typography>
            <Typography variant="caption" sx={{ color: 'text.secondary' }}>스마트 주차 관리 시스템</Typography>
          </Box>

          {/* Step 1: Complex Selection */}
          {step === 'complex' && (
            <Box>
              {user && (
                <Alert severity="info" sx={{ mb: 2, fontSize: '0.75rem' }}>
                  {user.email}(으)로 로그인되어 있습니다. 단지를 선택해 주세요.
                </Alert>
              )}
              <Typography variant="body2" sx={{ fontWeight: 700, mb: 1.5 }}>
                단지를 선택하세요
              </Typography>

              {/* Geolocation button */}
              <Button
                fullWidth
                variant="outlined"
                startIcon={geoLoading ? <CircularProgress size={16} /> : <MyLocationIcon />}
                onClick={handleGeoDetect}
                disabled={geoLoading || loadingComplexes}
                sx={{ mb: 2, py: 1.2, fontWeight: 600, borderColor: 'divider', color: 'text.primary' }}
              >
                {geoLoading ? '위치 확인 중...' : '현재 위치로 단지 찾기'}
              </Button>

              {geoError && <Alert severity="info" sx={{ mb: 2, fontSize: '0.75rem' }}>{geoError}</Alert>}

              {nearestComplex && (
                <Alert severity="success" sx={{ mb: 2, fontSize: '0.75rem' }}>
                  현재 위치 기반 단지: <strong>{nearestComplex.name}</strong>
                </Alert>
              )}

              {/* Complex List */}
              {loadingComplexes ? (
                <Box sx={{ display: 'flex', justifyContent: 'center', py: 4 }}>
                  <CircularProgress size={28} />
                </Box>
              ) : (
                <List disablePadding sx={{ maxHeight: 280, overflow: 'auto' }}>
                  {complexes.map(c => (
                    <ListItemButton
                      key={c.id}
                      onClick={() => handleSelectComplex(c)}
                      selected={selectedComplex?.id === c.id}
                      sx={{
                        borderRadius: 1.5, mb: 0.5, py: 1.2,
                        border: '1px solid',
                        borderColor: selectedComplex?.id === c.id ? 'primary.main' : 'divider',
                        '&.Mui-selected': { bgcolor: 'action.hover' },
                      }}
                    >
                      <ListItemIcon sx={{ minWidth: 36 }}>
                        <ApartmentIcon sx={{ fontSize: 20, color: selectedComplex?.id === c.id ? 'primary.main' : 'text.secondary' }} />
                      </ListItemIcon>
                      <ListItemText
                        primary={c.name}
                        secondary={c.address}
                        slotProps={{
                          primary: { sx: { fontWeight: 600, fontSize: '0.85rem' } },
                          secondary: { sx: { fontSize: '0.7rem', mt: 0.2 } },
                        }}
                      />
                      {selectedComplex?.id === c.id && <CheckCircleIcon sx={{ color: 'primary.main', fontSize: 20 }} />}
                      {c.status === 'poc' && <Chip label="POC" size="small" sx={{ fontSize: '0.6rem', height: 18, ml: 0.5 }} />}
                    </ListItemButton>
                  ))}
                </List>
              )}

              {selectedComplex && !user && (
                <Button
                  fullWidth
                  variant="contained"
                  onClick={() => setStep('login')}
                  sx={{ mt: 2, py: 1.2, fontWeight: 700 }}
                >
                  다음
                </Button>
              )}
            </Box>
          )}

          {/* Step 2: Login */}
          {step === 'login' && selectedComplex && (
            <Box>
              {/* Selected complex indicator */}
              <Box
                sx={{
                  display: 'flex', alignItems: 'center', gap: 1.5, mb: 2.5, p: 1.5,
                  bgcolor: 'action.hover', borderRadius: 1.5, cursor: 'pointer',
                }}
                onClick={() => setStep('complex')}
              >
                <ApartmentIcon sx={{ color: 'primary.main', fontSize: 20 }} />
                <Box sx={{ flex: 1 }}>
                  <Typography variant="body2" sx={{ fontWeight: 700, fontSize: '0.8rem' }}>{selectedComplex.name}</Typography>
                  <Typography variant="caption" sx={{ color: 'text.secondary', fontSize: '0.65rem' }}>{selectedComplex.address}</Typography>
                </Box>
                <Typography variant="caption" sx={{ color: 'primary.main', fontWeight: 600, fontSize: '0.7rem' }}>변경</Typography>
              </Box>

              <form onSubmit={handleLogin}>
                <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                  <TextField
                    label="이메일"
                    type="email"
                    value={email}
                    onChange={e => setEmail(e.target.value)}
                    fullWidth
                    autoFocus
                    size="small"
                  />
                  <TextField
                    label="비밀번호"
                    type="password"
                    value={password}
                    onChange={e => setPassword(e.target.value)}
                    fullWidth
                    size="small"
                  />
                  {error && <Alert severity="error" sx={{ fontSize: '0.75rem' }}>{error}</Alert>}
                  <Button
                    type="submit"
                    variant="contained"
                    fullWidth
                    disabled={loginLoading || !email || !password}
                    sx={{ py: 1.2, fontWeight: 700 }}
                  >
                    {loginLoading ? <CircularProgress size={22} /> : '로그인'}
                  </Button>
                </Box>
              </form>

              <Button
                size="small"
                startIcon={<ArrowBackIcon />}
                onClick={() => setStep('complex')}
                sx={{ mt: 1.5, color: 'text.secondary', fontSize: '0.75rem' }}
              >
                단지 다시 선택
              </Button>
            </Box>
          )}

          <Divider sx={{ my: 2.5 }} />

          <Button
            fullWidth
            variant="outlined"
            onClick={() => navigate('/visitor')}
            sx={{ py: 1, fontWeight: 600, borderColor: 'divider', color: 'text.primary' }}
          >
            방문자 서비스 이용
          </Button>
        </CardContent>
      </Card>
    </Box>
  );
}
