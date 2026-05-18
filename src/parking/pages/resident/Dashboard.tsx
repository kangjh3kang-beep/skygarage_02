import { useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import Box from '@mui/material/Box';
import Card from '@mui/material/Card';
import CardContent from '@mui/material/CardContent';
import Typography from '@mui/material/Typography';
import Chip from '@mui/material/Chip';
import LinearProgress from '@mui/material/LinearProgress';
import Skeleton from '@mui/material/Skeleton';
import Button from '@mui/material/Button';
import DirectionsCarIcon from '@mui/icons-material/DirectionsCar';
import EvStationIcon from '@mui/icons-material/EvStation';
import PeopleAltIcon from '@mui/icons-material/PeopleAlt';
import AccessTimeIcon from '@mui/icons-material/AccessTime';
import LocalParkingIcon from '@mui/icons-material/LocalParking';
import ChevronRightIcon from '@mui/icons-material/ChevronRight';
import ApartmentIcon from '@mui/icons-material/Apartment';
import { useParkingAuth } from '../../contexts/ParkingAuthContext';
import { useActiveParking } from '../../hooks/useActiveParking';
import { useEvCharging } from '../../hooks/useEvCharging';
import { useVisitors } from '../../hooks/useVisitors';
import { useHousehold } from '../../hooks/useHousehold';

function DashboardCard({ icon, iconBg, title, value, subtitle, onClick, chip }: {
  icon: React.ReactNode;
  iconBg: string;
  title: string;
  value: string;
  subtitle?: string;
  onClick?: () => void;
  chip?: { label: string; color: 'success' | 'default' | 'warning' | 'error' };
}) {
  return (
    <Card
      sx={{
        mb: 1.5,
        cursor: onClick ? 'pointer' : 'default',
        transition: 'all 0.2s ease',
        border: '1px solid',
        borderColor: 'divider',
        '&:hover': onClick ? {
          transform: 'translateY(-1px)',
          boxShadow: '0 4px 12px rgba(0,0,0,0.15)',
          borderColor: 'primary.main',
        } : {},
      }}
      onClick={onClick}
    >
      <CardContent sx={{ display: 'flex', alignItems: 'center', gap: 2, py: 2, '&:last-child': { pb: 2 } }}>
        <Box sx={{
          width: 44, height: 44, borderRadius: '12px', bgcolor: iconBg,
          display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0,
        }}>
          {icon}
        </Box>
        <Box sx={{ flex: 1, minWidth: 0 }}>
          <Typography variant="caption" sx={{ color: 'text.secondary', fontWeight: 500, letterSpacing: 0.3 }}>
            {title}
          </Typography>
          <Typography variant="body1" sx={{ fontWeight: 700, lineHeight: 1.3 }}>
            {value}
          </Typography>
          {subtitle && (
            <Typography variant="caption" sx={{ color: 'text.secondary', fontSize: '0.7rem' }}>
              {subtitle}
            </Typography>
          )}
        </Box>
        {chip && <Chip label={chip.label} size="small" color={chip.color} sx={{ fontWeight: 600, fontSize: '0.7rem' }} />}
        {onClick && <ChevronRightIcon sx={{ color: 'text.disabled', fontSize: 20 }} />}
      </CardContent>
    </Card>
  );
}

function OnboardingView() {
  const { user } = useParkingAuth();
  return (
    <Box sx={{ p: 3, maxWidth: 480, mx: 'auto', textAlign: 'center', mt: 4 }}>
      <Box sx={{
        width: 80, height: 80, borderRadius: '50%', bgcolor: 'primary.main',
        display: 'flex', alignItems: 'center', justifyContent: 'center', mx: 'auto', mb: 3,
      }}>
        <ApartmentIcon sx={{ fontSize: 40, color: '#000' }} />
      </Box>
      <Typography variant="h5" sx={{ fontWeight: 800, mb: 1 }}>
        환영합니다!
      </Typography>
      <Typography variant="body2" sx={{ color: 'text.secondary', mb: 4, lineHeight: 1.6 }}>
        SkyGarage 스마트 주차 서비스를 이용하려면<br />
        세대 등록이 필요합니다.
      </Typography>
      <Card sx={{ border: '1px solid', borderColor: 'divider', textAlign: 'left' }}>
        <CardContent sx={{ p: 3 }}>
          <Typography variant="subtitle2" sx={{ fontWeight: 700, mb: 2, color: 'primary.main' }}>
            등록 안내
          </Typography>
          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1.5 }}>
            <Box sx={{ display: 'flex', gap: 1.5, alignItems: 'flex-start' }}>
              <Box sx={{ width: 22, height: 22, borderRadius: '50%', bgcolor: 'action.hover', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, mt: 0.2 }}>
                <Typography variant="caption" sx={{ fontWeight: 700, fontSize: '0.65rem' }}>1</Typography>
              </Box>
              <Typography variant="body2" sx={{ color: 'text.secondary', lineHeight: 1.5 }}>
                관리실에 입주자 등록을 요청하세요
              </Typography>
            </Box>
            <Box sx={{ display: 'flex', gap: 1.5, alignItems: 'flex-start' }}>
              <Box sx={{ width: 22, height: 22, borderRadius: '50%', bgcolor: 'action.hover', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, mt: 0.2 }}>
                <Typography variant="caption" sx={{ fontWeight: 700, fontSize: '0.65rem' }}>2</Typography>
              </Box>
              <Typography variant="body2" sx={{ color: 'text.secondary', lineHeight: 1.5 }}>
                세대 배정이 완료되면 자동으로 서비스가 활성화됩니다
              </Typography>
            </Box>
            <Box sx={{ display: 'flex', gap: 1.5, alignItems: 'flex-start' }}>
              <Box sx={{ width: 22, height: 22, borderRadius: '50%', bgcolor: 'action.hover', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, mt: 0.2 }}>
                <Typography variant="caption" sx={{ fontWeight: 700, fontSize: '0.65rem' }}>3</Typography>
              </Box>
              <Typography variant="body2" sx={{ color: 'text.secondary', lineHeight: 1.5 }}>
                차량 등록 후 모든 주차 기능을 이용하실 수 있습니다
              </Typography>
            </Box>
          </Box>
        </CardContent>
      </Card>
      <Typography variant="caption" sx={{ color: 'text.disabled', mt: 3, display: 'block' }}>
        계정: {user?.email}
      </Typography>
    </Box>
  );
}

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
      <Box sx={{ p: 2.5 }}>
        {[1, 2, 3, 4].map(i => (
          <Skeleton key={i} variant="rounded" height={76} sx={{ mb: 1.5, borderRadius: 2 }} />
        ))}
      </Box>
    );
  }

  if (!household) {
    return <OnboardingView />;
  }

  return (
    <Box sx={{ p: 2.5, maxWidth: 520, mx: 'auto' }}>
      {/* Header greeting */}
      <Box sx={{ mb: 3 }}>
        <Typography variant="caption" sx={{ color: 'text.secondary', fontWeight: 500, letterSpacing: 0.5 }}>
          {household.building}동 {household.unit_number}호
        </Typography>
        <Typography variant="h5" sx={{ fontWeight: 800, mt: 0.3, letterSpacing: -0.5 }}>
          안녕하세요!
        </Typography>
      </Box>

      {/* Quick status cards */}
      <DashboardCard
        icon={<DirectionsCarIcon sx={{ color: '#000', fontSize: 22 }} />}
        iconBg="#F5C542"
        title="내 차량"
        value={`${myVehicleSessions.length}대 주차 중`}
        onClick={() => navigate('/app/parking')}
      />

      <DashboardCard
        icon={<LocalParkingIcon sx={{ color: '#fff', fontSize: 22 }} />}
        iconBg="#2e7d32"
        title="잔여 주차면"
        value={`${availableSpots} / ${household.allocated_spots}면`}
        onClick={() => navigate('/app/parking')}
        chip={{
          label: household.direct_entry_enabled ? '세대직입 ON' : '세대직입 OFF',
          color: household.direct_entry_enabled ? 'success' : 'default',
        }}
      />

      <DashboardCard
        icon={<PeopleAltIcon sx={{ color: '#fff', fontSize: 22 }} />}
        iconBg="#0288d1"
        title="방문 차량"
        value={`${visitorSessions.length}대 주차 중`}
        subtitle={activeVisitors.length > 0 ? `사전등록 ${activeVisitors.length}건 대기` : undefined}
        onClick={() => navigate('/app/visitors')}
      />

      {/* EV Charging with progress */}
      <Card
        sx={{
          mb: 1.5,
          cursor: 'pointer',
          transition: 'all 0.2s ease',
          border: '1px solid',
          borderColor: 'divider',
          '&:hover': {
            transform: 'translateY(-1px)',
            boxShadow: '0 4px 12px rgba(0,0,0,0.15)',
            borderColor: 'primary.main',
          },
        }}
        onClick={() => navigate('/app/ev')}
      >
        <CardContent sx={{ py: 2, '&:last-child': { pb: 2 } }}>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
            <Box sx={{
              width: 44, height: 44, borderRadius: '12px', bgcolor: '#ed6c02',
              display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0,
            }}>
              <EvStationIcon sx={{ color: '#000', fontSize: 22 }} />
            </Box>
            <Box sx={{ flex: 1 }}>
              <Typography variant="caption" sx={{ color: 'text.secondary', fontWeight: 500, letterSpacing: 0.3 }}>
                전기차 충전
              </Typography>
              <Typography variant="body1" sx={{ fontWeight: 700 }}>
                {evActive.length > 0 ? `${evActive.length}건 충전 중` : '충전 없음'}
              </Typography>
            </Box>
            <ChevronRightIcon sx={{ color: 'text.disabled', fontSize: 20 }} />
          </Box>
          {evActive.length > 0 && (
            <Box sx={{ mt: 1.5, pl: 7 }}>
              <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 0.5 }}>
                <Typography variant="caption" sx={{ color: 'text.secondary' }}>충전 진행률</Typography>
                <Typography variant="caption" sx={{ fontWeight: 700 }}>{evActive[0].charge_current_pct}%</Typography>
              </Box>
              <LinearProgress
                variant="determinate"
                value={evActive[0].charge_current_pct}
                sx={{ height: 6, borderRadius: 3 }}
              />
            </Box>
          )}
        </CardContent>
      </Card>

      {/* Free Parking Hours */}
      <Card sx={{ mb: 1.5, border: '1px solid', borderColor: 'divider' }}>
        <CardContent sx={{ py: 2, '&:last-child': { pb: 2 } }}>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 2, mb: 1.5 }}>
            <Box sx={{
              width: 44, height: 44, borderRadius: '12px', bgcolor: '#7b1fa2',
              display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0,
            }}>
              <AccessTimeIcon sx={{ color: '#fff', fontSize: 22 }} />
            </Box>
            <Box sx={{ flex: 1 }}>
              <Typography variant="caption" sx={{ color: 'text.secondary', fontWeight: 500, letterSpacing: 0.3 }}>
                방문자 무료주차
              </Typography>
              <Typography variant="body1" sx={{ fontWeight: 700 }}>
                {freeHoursUsed}h / {freeHoursTotal}h 사용
              </Typography>
            </Box>
          </Box>
          <Box sx={{ pl: 7 }}>
            <LinearProgress
              variant="determinate"
              value={freeHoursPct}
              color={freeHoursPct > 80 ? 'error' : 'primary'}
              sx={{ height: 6, borderRadius: 3 }}
            />
            {freeHoursPct > 80 && (
              <Typography variant="caption" sx={{ color: 'error.main', mt: 0.5, display: 'block' }}>
                무료 주차 시간이 거의 소진되었습니다.
              </Typography>
            )}
          </Box>
        </CardContent>
      </Card>

      {/* Quick action */}
      <Button
        variant="outlined"
        fullWidth
        onClick={() => navigate('/app/visitors')}
        sx={{ mt: 2, py: 1.2, fontWeight: 600, borderColor: 'divider', color: 'text.primary' }}
        startIcon={<PeopleAltIcon />}
      >
        방문자 사전 등록하기
      </Button>
    </Box>
  );
}
