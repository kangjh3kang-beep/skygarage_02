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
      <Box sx={{ p: 2 }}>
        {[1, 2, 3].map(i => <Skeleton key={i} variant="rounded" height={120} sx={{ mb: 2, borderRadius: 3 }} />)}
      </Box>
    );
  }

  return (
    <Box sx={{ p: 2, maxWidth: 600, mx: 'auto' }}>
      {/* Direct Entry Toggle */}
      <Card sx={{ mb: 2 }}>
        <CardContent>
          <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <Box>
              <Typography variant="subtitle1" sx={{ fontWeight: 700 }}>세대직입 허용</Typography>
              <Typography variant="caption" sx={{ color: 'text.secondary' }}>
                방문 차량의 세대 내 직접 입차를 허용합니다
              </Typography>
            </Box>
            <Switch
              checked={household?.direct_entry_enabled ?? false}
              onChange={(_, checked) => handleDirectEntryToggle(checked)}
              disabled={toggling || !household?.is_sky_garage_unit}
              color="success"
            />
          </Box>
          {!household?.is_sky_garage_unit && (
            <Alert severity="info" sx={{ mt: 1.5, fontSize: '0.75rem' }}>
              스카이가라지 세대만 세대직입 설정이 가능합니다.
            </Alert>
          )}
        </CardContent>
      </Card>

      {/* Parking Spot Status */}
      <Card sx={{ mb: 2 }}>
        <CardContent>
          <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 2 }}>
            <Typography variant="subtitle1" sx={{ fontWeight: 700 }}>내 지정 주차 현황</Typography>
            <Chip
              label={`${availableSpots}면 비어있음`}
              size="small"
              color={availableSpots > 0 ? 'success' : 'error'}
            />
          </Box>
          <Box sx={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(80px, 1fr))', gap: 1 }}>
            {spots.map(spot => (
              <Box
                key={spot.id}
                sx={{
                  p: 1.5, borderRadius: 2, textAlign: 'center',
                  bgcolor: spot.is_occupied ? 'error.main' : 'success.main',
                  color: '#fff', opacity: spot.is_occupied ? 0.8 : 1,
                }}
              >
                <LocalParkingIcon sx={{ fontSize: 20, mb: 0.5 }} />
                <Typography variant="caption" sx={{ display: 'block', fontWeight: 700 }}>
                  {spot.spot_number}
                </Typography>
                <Typography variant="caption" sx={{ fontSize: '0.65rem' }}>
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
      <Card sx={{ mb: 2 }}>
        <CardContent>
          <Typography variant="subtitle1" sx={{ fontWeight: 700, mb: 1.5 }}>현재 주차 중인 내 차량</Typography>
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
                      <ListItemIcon sx={{ minWidth: 40 }}>
                        <DirectionsCarIcon color="primary" />
                      </ListItemIcon>
                      <ListItemText
                        primary={session.vehicle_plate}
                        secondary={`${vehicle?.brand ?? ''} ${vehicle?.model ?? ''} | 입차: ${new Date(session.entry_time).toLocaleTimeString('ko-KR', { hour: '2-digit', minute: '2-digit' })}`}
                        slotProps={{ primary: { sx: { fontWeight: 700, fontSize: '0.9rem' } }, secondary: { sx: { fontSize: '0.75rem' } } }}
                      />
                      <Chip label={session.status === 'parked' ? '주차 중' : '이동 중'} size="small" />
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
        sx={{ py: 1.5 }}
      >
        실시간 주차 지도 보기
      </Button>
    </Box>
  );
}
