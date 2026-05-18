import { useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import Box from '@mui/material/Box';
import Card from '@mui/material/Card';
import CardContent from '@mui/material/CardContent';
import Typography from '@mui/material/Typography';
import Chip from '@mui/material/Chip';
import LinearProgress from '@mui/material/LinearProgress';
import IconButton from '@mui/material/IconButton';
import Skeleton from '@mui/material/Skeleton';
import DirectionsCarIcon from '@mui/icons-material/DirectionsCar';
import EvStationIcon from '@mui/icons-material/EvStation';
import PeopleAltIcon from '@mui/icons-material/PeopleAlt';
import AccessTimeIcon from '@mui/icons-material/AccessTime';
import ChevronRightIcon from '@mui/icons-material/ChevronRight';
import LocalParkingIcon from '@mui/icons-material/LocalParking';
import { useParkingAuth } from '../../contexts/ParkingAuthContext';
import { useActiveParking } from '../../hooks/useActiveParking';
import { useEvCharging } from '../../hooks/useEvCharging';
import { useVisitors } from '../../hooks/useVisitors';
import { useHousehold } from '../../hooks/useHousehold';

export default function ResidentDashboard() {
  const navigate = useNavigate();
  const { household } = useParkingAuth();
  const { myVehicleSessions, visitorSessions, loading: parkingLoading } = useActiveParking();
  const { activeSessions: evActive, loading: evLoading } = useEvCharging();
  const { activeVisitors, loading: visitorsLoading } = useVisitors();
  const { availableSpots, loading: hhLoading } = useHousehold();

  const loading = parkingLoading || evLoading || visitorsLoading || hhLoading;

  const freeHoursUsed = household?.free_parking_hours_used ?? 0;
  const freeHoursTotal = household?.free_parking_hours_monthly ?? 4;
  const freeHoursPct = useMemo(() => Math.min((freeHoursUsed / freeHoursTotal) * 100, 100), [freeHoursUsed, freeHoursTotal]);

  if (loading) {
    return (
      <Box sx={{ p: 2 }}>
        {[1, 2, 3, 4].map(i => (
          <Skeleton key={i} variant="rounded" height={100} sx={{ mb: 2, borderRadius: 3 }} />
        ))}
      </Box>
    );
  }

  return (
    <Box sx={{ p: 2, maxWidth: 600, mx: 'auto' }}>
      <Typography variant="body2" sx={{ color: 'text.secondary', mb: 0.5 }}>
        {household?.building}동 {household?.unit_number}호
      </Typography>
      <Typography variant="h5" sx={{ fontWeight: 800, mb: 2.5, color: 'text.primary' }}>
        안녕하세요!
      </Typography>

      {/* My Vehicles Status */}
      <Card
        sx={{ mb: 2, cursor: 'pointer', transition: 'transform 0.15s', '&:hover': { transform: 'translateY(-2px)' } }}
        onClick={() => navigate('/app/parking')}
      >
        <CardContent sx={{ display: 'flex', alignItems: 'center', gap: 2, py: 2, '&:last-child': { pb: 2 } }}>
          <Box sx={{ width: 48, height: 48, borderRadius: 2, bgcolor: 'primary.main', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <DirectionsCarIcon sx={{ color: '#000', fontSize: 24 }} />
          </Box>
          <Box sx={{ flex: 1 }}>
            <Typography variant="subtitle2" sx={{ color: 'text.secondary' }}>내 차량</Typography>
            <Typography variant="h6" sx={{ fontWeight: 700 }}>
              {myVehicleSessions.length}대 주차 중
            </Typography>
          </Box>
          <IconButton size="small"><ChevronRightIcon /></IconButton>
        </CardContent>
      </Card>

      {/* Parking Spots */}
      <Card
        sx={{ mb: 2, cursor: 'pointer', transition: 'transform 0.15s', '&:hover': { transform: 'translateY(-2px)' } }}
        onClick={() => navigate('/app/parking')}
      >
        <CardContent sx={{ display: 'flex', alignItems: 'center', gap: 2, py: 2, '&:last-child': { pb: 2 } }}>
          <Box sx={{ width: 48, height: 48, borderRadius: 2, bgcolor: 'success.main', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <LocalParkingIcon sx={{ color: '#fff', fontSize: 24 }} />
          </Box>
          <Box sx={{ flex: 1 }}>
            <Typography variant="subtitle2" sx={{ color: 'text.secondary' }}>잔여 주차면</Typography>
            <Typography variant="h6" sx={{ fontWeight: 700 }}>
              {availableSpots} / {household?.allocated_spots ?? 0}면
            </Typography>
          </Box>
          <Chip
            label={household?.direct_entry_enabled ? '세대직입 ON' : '세대직입 OFF'}
            size="small"
            color={household?.direct_entry_enabled ? 'success' : 'default'}
          />
        </CardContent>
      </Card>

      {/* Visitor Status */}
      <Card
        sx={{ mb: 2, cursor: 'pointer', transition: 'transform 0.15s', '&:hover': { transform: 'translateY(-2px)' } }}
        onClick={() => navigate('/app/visitors')}
      >
        <CardContent sx={{ display: 'flex', alignItems: 'center', gap: 2, py: 2, '&:last-child': { pb: 2 } }}>
          <Box sx={{ width: 48, height: 48, borderRadius: 2, bgcolor: 'info.main', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <PeopleAltIcon sx={{ color: '#fff', fontSize: 24 }} />
          </Box>
          <Box sx={{ flex: 1 }}>
            <Typography variant="subtitle2" sx={{ color: 'text.secondary' }}>방문 차량</Typography>
            <Typography variant="h6" sx={{ fontWeight: 700 }}>
              {visitorSessions.length}대 주차 중
            </Typography>
            {activeVisitors.length > 0 && (
              <Typography variant="caption" sx={{ color: 'text.secondary' }}>
                사전등록 {activeVisitors.length}건 대기
              </Typography>
            )}
          </Box>
          <IconButton size="small"><ChevronRightIcon /></IconButton>
        </CardContent>
      </Card>

      {/* EV Charging */}
      <Card
        sx={{ mb: 2, cursor: 'pointer', transition: 'transform 0.15s', '&:hover': { transform: 'translateY(-2px)' } }}
        onClick={() => navigate('/app/ev')}
      >
        <CardContent sx={{ py: 2, '&:last-child': { pb: 2 } }}>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
            <Box sx={{ width: 48, height: 48, borderRadius: 2, bgcolor: 'warning.main', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <EvStationIcon sx={{ color: '#000', fontSize: 24 }} />
            </Box>
            <Box sx={{ flex: 1 }}>
              <Typography variant="subtitle2" sx={{ color: 'text.secondary' }}>전기차 충전</Typography>
              <Typography variant="h6" sx={{ fontWeight: 700 }}>
                {evActive.length > 0 ? `${evActive.length}건 충전 중` : '충전 없음'}
              </Typography>
            </Box>
            <IconButton size="small"><ChevronRightIcon /></IconButton>
          </Box>
          {evActive.length > 0 && (
            <Box sx={{ mt: 1.5 }}>
              <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 0.5 }}>
                <Typography variant="caption" sx={{ color: 'text.secondary' }}>충전 진행률</Typography>
                <Typography variant="caption" sx={{ fontWeight: 700 }}>{evActive[0].charge_current_pct}%</Typography>
              </Box>
              <LinearProgress
                variant="determinate"
                value={evActive[0].charge_current_pct}
                sx={{ height: 8, borderRadius: 4 }}
              />
            </Box>
          )}
        </CardContent>
      </Card>

      {/* Free Parking Hours */}
      <Card sx={{ mb: 2 }}>
        <CardContent sx={{ py: 2, '&:last-child': { pb: 2 } }}>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 2, mb: 1.5 }}>
            <Box sx={{ width: 48, height: 48, borderRadius: 2, bgcolor: 'secondary.main', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <AccessTimeIcon sx={{ color: '#000', fontSize: 24 }} />
            </Box>
            <Box sx={{ flex: 1 }}>
              <Typography variant="subtitle2" sx={{ color: 'text.secondary' }}>방문자 무료주차 시간</Typography>
              <Typography variant="h6" sx={{ fontWeight: 700 }}>
                {freeHoursUsed}h / {freeHoursTotal}h 사용
              </Typography>
            </Box>
          </Box>
          <LinearProgress
            variant="determinate"
            value={freeHoursPct}
            color={freeHoursPct > 80 ? 'error' : 'primary'}
            sx={{ height: 8, borderRadius: 4 }}
          />
          {freeHoursPct > 80 && (
            <Typography variant="caption" sx={{ color: 'error.main', mt: 0.5, display: 'block' }}>
              무료 주차 시간이 거의 소진되었습니다.
            </Typography>
          )}
        </CardContent>
      </Card>
    </Box>
  );
}
