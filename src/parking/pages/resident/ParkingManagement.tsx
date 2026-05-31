import { useState } from 'react';
import Box from '@mui/material/Box';
import Card from '@mui/material/Card';
import CardContent from '@mui/material/CardContent';
import Typography from '@mui/material/Typography';
import Switch from '@mui/material/Switch';
import Chip from '@mui/material/Chip';
import List from '@mui/material/List';
import ListItem from '@mui/material/ListItem';
import ListItemText from '@mui/material/ListItemText';
import ListItemIcon from '@mui/material/ListItemIcon';
import Divider from '@mui/material/Divider';
import Button from '@mui/material/Button';
import Skeleton from '@mui/material/Skeleton';
import Alert from '@mui/material/Alert';
import DirectionsCarIcon from '@mui/icons-material/DirectionsCar';
import LocalParkingIcon from '@mui/icons-material/LocalParking';
import MapIcon from '@mui/icons-material/Map';
import { useNavigate } from 'react-router-dom';
import { useHousehold } from '../../hooks/useHousehold';
import { useVehicles } from '../../hooks/useVehicles';
import { useActiveParking } from '../../hooks/useActiveParking';

export default function ParkingManagement() {
  const navigate = useNavigate();
  const { household, spots, availableSpots, loading: hhLoading, toggleDirectEntry } = useHousehold();
  const { vehicles, loading: vLoading } = useVehicles();
  const { myVehicleSessions, loading: pLoading } = useActiveParking();
  const [toggling, setToggling] = useState(false);

  const loading = hhLoading || vLoading || pLoading;

  const handleDirectEntryToggle = async (enabled: boolean) => {
    setToggling(true);
    await toggleDirectEntry(enabled);
    setToggling(false);
  };

  if (loading) {
    return (
      <Box sx={{ p: 2.5 }}>
        {[1, 2, 3].map(i => <Skeleton key={i} variant="rounded" height={100} sx={{ mb: 1.5, borderRadius: 2 }} />)}
      </Box>
    );
  }

  if (!household) {
    return (
      <Box sx={{ p: 3, textAlign: 'center', mt: 4 }}>
        <LocalParkingIcon sx={{ fontSize: 48, color: 'text.disabled', mb: 2 }} />
        <Typography variant="body1" sx={{ color: 'text.secondary' }}>
          세대 등록 후 주차 관리 기능을 이용할 수 있습니다.
        </Typography>
      </Box>
    );
  }

  return (
    <Box sx={{ p: 2.5, maxWidth: 520, mx: 'auto' }}>
      {/* Direct Entry Toggle */}
      <Card sx={{ mb: 1.5, border: '1px solid', borderColor: 'divider' }}>
        <CardContent sx={{ py: 2, '&:last-child': { pb: 2 } }}>
          <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <Box>
              <Typography variant="body1" sx={{ fontWeight: 700 }}>세대직입 허용</Typography>
              <Typography variant="caption" sx={{ color: 'text.secondary', lineHeight: 1.3, display: 'block', mt: 0.3 }}>
                방문 차량의 세대 내 직접 입차를 허용합니다
              </Typography>
            </Box>
            <Switch
              checked={household.direct_entry_enabled}
              onChange={(_, checked) => handleDirectEntryToggle(checked)}
              disabled={toggling || !household.is_sky_garage_unit}
              color="success"
            />
          </Box>
          {!household.is_sky_garage_unit && (
            <Alert severity="info" sx={{ mt: 1.5, fontSize: '0.75rem', py: 0 }}>
              스카이가라지 세대만 세대직입 설정이 가능합니다.
            </Alert>
          )}
        </CardContent>
      </Card>

      {/* Parking Spot Status */}
      <Card sx={{ mb: 1.5, border: '1px solid', borderColor: 'divider' }}>
        <CardContent sx={{ py: 2, '&:last-child': { pb: 2 } }}>
          <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 2 }}>
            <Typography variant="body1" sx={{ fontWeight: 700 }}>내 지정 주차 현황</Typography>
            <Chip
              label={`${availableSpots}면 비어있음`}
              size="small"
              color={availableSpots > 0 ? 'success' : 'error'}
              sx={{ fontWeight: 600 }}
            />
          </Box>
          <Box sx={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(72px, 1fr))', gap: 1 }}>
            {spots.map(spot => (
              <Box
                key={spot.id}
                sx={{
                  p: 1.2, borderRadius: 1.5, textAlign: 'center',
                  bgcolor: spot.is_occupied ? 'error.dark' : 'success.dark',
                  color: '#fff',
                  border: '1px solid',
                  borderColor: spot.is_occupied ? 'error.main' : 'success.main',
                }}
              >
                <LocalParkingIcon sx={{ fontSize: 18, mb: 0.3 }} />
                <Typography variant="caption" sx={{ display: 'block', fontWeight: 700, fontSize: '0.7rem' }}>
                  {spot.spot_number}
                </Typography>
                <Typography variant="caption" sx={{ fontSize: '0.6rem', opacity: 0.8 }}>
                  {spot.is_occupied ? '사용 중' : '비어있음'}
                </Typography>
              </Box>
            ))}
            {spots.length === 0 && (
              <Typography variant="body2" sx={{ color: 'text.secondary', gridColumn: '1 / -1', textAlign: 'center', py: 3 }}>
                배정된 주차면이 없습니다.
              </Typography>
            )}
          </Box>
        </CardContent>
      </Card>

      {/* My Vehicles Currently Parked */}
      <Card sx={{ mb: 1.5, border: '1px solid', borderColor: 'divider' }}>
        <CardContent sx={{ py: 2, '&:last-child': { pb: 2 } }}>
          <Typography variant="body1" sx={{ fontWeight: 700, mb: 1.5 }}>현재 주차 중인 내 차량</Typography>
          {myVehicleSessions.length === 0 ? (
            <Typography variant="body2" sx={{ color: 'text.secondary', textAlign: 'center', py: 2 }}>
              현재 주차 중인 차량이 없습니다.
            </Typography>
          ) : (
            <List disablePadding>
              {myVehicleSessions.map((session, idx) => {
                const vehicle = vehicles.find(v => v.plate_number === session.vehicle_plate);
                return (
                  <Box key={session.id}>
                    {idx > 0 && <Divider />}
                    <ListItem disablePadding sx={{ py: 1 }}>
                      <ListItemIcon sx={{ minWidth: 36 }}>
                        <DirectionsCarIcon sx={{ fontSize: 20, color: 'primary.main' }} />
                      </ListItemIcon>
                      <ListItemText
                        primary={session.vehicle_plate}
                        secondary={`${vehicle?.brand ?? ''} ${vehicle?.model ?? ''} | 입차: ${new Date(session.entry_time).toLocaleTimeString('ko-KR', { hour: '2-digit', minute: '2-digit' })}`}
                        slotProps={{ primary: { sx: { fontWeight: 700, fontSize: '0.875rem' } }, secondary: { sx: { fontSize: '0.7rem' } } }}
                      />
                      <Chip
                        label={session.status === 'parked' ? '주차 중' : '이동 중'}
                        size="small"
                        color={session.status === 'parked' ? 'success' : 'warning'}
                        sx={{ fontWeight: 600, fontSize: '0.7rem' }}
                      />
                    </ListItem>
                  </Box>
                );
              })}
            </List>
          )}
        </CardContent>
      </Card>

      {/* Map Button */}
      <Button
        fullWidth
        variant="outlined"
        startIcon={<MapIcon />}
        onClick={() => navigate('/app/parking/map')}
        sx={{ mt: 1, py: 1.2, fontWeight: 600, borderColor: 'divider', color: 'text.primary' }}
      >
        실시간 주차 지도 보기
      </Button>
    </Box>
  );
}
