import { useState } from 'react';
import Box from '@mui/material/Box';
import Grid from '@mui/material/Grid';
import Typography from '@mui/material/Typography';
import Card from '@mui/material/Card';
import CardContent from '@mui/material/CardContent';
import Chip from '@mui/material/Chip';
import Button from '@mui/material/Button';
import Skeleton from '@mui/material/Skeleton';
import LocalTaxiIcon from '@mui/icons-material/LocalTaxi';
import RouteIcon from '@mui/icons-material/Route';
import BookmarkIcon from '@mui/icons-material/Bookmark';
import NotificationsActiveIcon from '@mui/icons-material/NotificationsActive';
import { useNavigate } from 'react-router-dom';
import { useVehicleTracking } from '../../hooks/useVehicleTracking';
import { useBooking } from '../../hooks/useBooking';
import { useNotifications } from '../../hooks/useNotifications';
import TrackingMap from '../../components/Map/TrackingMap';

export default function TrackingDashboard() {
  const navigate = useNavigate();
  const { vehicles, loading: vLoading } = useVehicleTracking();
  const { bookings, loading: bLoading } = useBooking();
  const { unreadCount } = useNotifications();
  const [selectedId, setSelectedId] = useState<string>();

  const availableCount = vehicles.filter(v => v.status === 'available').length;
  const transitCount = vehicles.filter(v => v.status === 'in_transit').length;
  const activeBookings = bookings.filter(b => b.status === 'in_progress' || b.status === 'confirmed');

  if (vLoading || bLoading) {
    return (
      <Box sx={{ p: 3 }}>
        <Skeleton variant="text" width={200} height={40} sx={{ mb: 2 }} />
        <Grid container spacing={2}>
          {[1, 2, 3, 4].map(i => <Grid size={{ xs: 6, md: 3 }} key={i}><Skeleton variant="rectangular" height={100} sx={{ borderRadius: 2 }} /></Grid>)}
        </Grid>
        <Skeleton variant="rectangular" height={400} sx={{ borderRadius: 2, mt: 3 }} />
      </Box>
    );
  }

  return (
    <Box sx={{ p: { xs: 2, md: 3 } }}>
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 3 }}>
        <Typography variant="h5" sx={{ fontWeight: 800 }}>실시간 차량 추적</Typography>
        <Button variant="contained" onClick={() => navigate('/tracking/booking')}>새 예약</Button>
      </Box>

      {/* Summary Cards */}
      <Grid container spacing={2} sx={{ mb: 3 }}>
        <Grid size={{ xs: 6, md: 3 }}>
          <Card sx={{ cursor: 'pointer' }} onClick={() => navigate('/tracking/map')}>
            <CardContent sx={{ textAlign: 'center', py: 2 }}>
              <LocalTaxiIcon sx={{ fontSize: 32, color: 'success.main', mb: 0.5 }} />
              <Typography variant="h4" sx={{ fontWeight: 800 }}>{availableCount}</Typography>
              <Typography variant="caption" color="text.secondary">대기 차량</Typography>
            </CardContent>
          </Card>
        </Grid>
        <Grid size={{ xs: 6, md: 3 }}>
          <Card>
            <CardContent sx={{ textAlign: 'center', py: 2 }}>
              <RouteIcon sx={{ fontSize: 32, color: 'info.main', mb: 0.5 }} />
              <Typography variant="h4" sx={{ fontWeight: 800 }}>{transitCount}</Typography>
              <Typography variant="caption" color="text.secondary">운행중</Typography>
            </CardContent>
          </Card>
        </Grid>
        <Grid size={{ xs: 6, md: 3 }}>
          <Card sx={{ cursor: 'pointer' }} onClick={() => navigate('/tracking/mypage')}>
            <CardContent sx={{ textAlign: 'center', py: 2 }}>
              <BookmarkIcon sx={{ fontSize: 32, color: 'warning.main', mb: 0.5 }} />
              <Typography variant="h4" sx={{ fontWeight: 800 }}>{activeBookings.length}</Typography>
              <Typography variant="caption" color="text.secondary">진행중 예약</Typography>
            </CardContent>
          </Card>
        </Grid>
        <Grid size={{ xs: 6, md: 3 }}>
          <Card sx={{ cursor: 'pointer' }} onClick={() => navigate('/tracking/notifications')}>
            <CardContent sx={{ textAlign: 'center', py: 2 }}>
              <NotificationsActiveIcon sx={{ fontSize: 32, color: unreadCount > 0 ? 'error.main' : 'text.secondary', mb: 0.5 }} />
              <Typography variant="h4" sx={{ fontWeight: 800 }}>{unreadCount}</Typography>
              <Typography variant="caption" color="text.secondary">알림</Typography>
            </CardContent>
          </Card>
        </Grid>
      </Grid>

      {/* Map */}
      <Card sx={{ mb: 3 }}>
        <CardContent sx={{ p: 0, '&:last-child': { pb: 0 } }}>
          <TrackingMap
            vehicles={vehicles}
            selectedVehicleId={selectedId}
            onVehicleClick={(v) => setSelectedId(v.id)}
            height={400}
          />
        </CardContent>
      </Card>

      {/* Active Bookings */}
      <Box>
        <Typography variant="subtitle1" sx={{ fontWeight: 700, mb: 1.5 }}>진행중인 예약</Typography>
        {activeBookings.length > 0 ? (
          <Grid container spacing={2}>
            {activeBookings.map(b => (
              <Grid size={{ xs: 12, md: 6 }} key={b.id}>
                <Card
                  sx={{ cursor: 'pointer', transition: 'border-color 0.2s', '&:hover': { borderColor: 'primary.main' } }}
                  onClick={() => navigate(`/tracking/track/${b.vehicle_id}`)}
                >
                  <CardContent sx={{ p: 2 }}>
                    <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 1 }}>
                      <Typography variant="body2" sx={{ fontWeight: 700 }}>{b.pickup_name} → {b.dropoff_name}</Typography>
                      <Chip label={b.status === 'in_progress' ? '이동중' : '확정'} size="small" color={b.status === 'in_progress' ? 'info' : 'success'} />
                    </Box>
                    <Typography variant="caption" color="text.secondary">
                      {new Date(b.scheduled_at).toLocaleString('ko-KR')}
                    </Typography>
                  </CardContent>
                </Card>
              </Grid>
            ))}
          </Grid>
        ) : (
          <Card sx={{ border: '1px dashed', borderColor: 'divider' }}>
            <CardContent sx={{ textAlign: 'center', py: 4 }}>
              <BookmarkIcon sx={{ fontSize: 40, color: 'text.disabled', mb: 1 }} />
              <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
                현재 진행중인 예약이 없습니다.
              </Typography>
              <Button variant="outlined" size="small" onClick={() => navigate('/tracking/booking')}>
                새 예약 만들기
              </Button>
            </CardContent>
          </Card>
        )}
      </Box>

      {/* Empty Vehicle State */}
      {vehicles.length === 0 && (
        <Card sx={{ mt: 3, border: '1px dashed', borderColor: 'divider' }}>
          <CardContent sx={{ textAlign: 'center', py: 4 }}>
            <LocalTaxiIcon sx={{ fontSize: 40, color: 'text.disabled', mb: 1 }} />
            <Typography variant="body2" color="text.secondary" sx={{ mb: 1 }}>
              등록된 차량이 없습니다.
            </Typography>
            <Typography variant="caption" color="text.secondary">
              관리 화면에서 차량을 추가하거나 데모 모드를 실행하세요.
            </Typography>
            <Box sx={{ mt: 2 }}>
              <Button variant="outlined" size="small" onClick={() => navigate('/tracking/fleet')}>
                차량 관리
              </Button>
            </Box>
          </CardContent>
        </Card>
      )}
    </Box>
  );
}
