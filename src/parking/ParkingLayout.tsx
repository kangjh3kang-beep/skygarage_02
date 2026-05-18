import { useState, useEffect } from 'react';
import { Outlet, useNavigate, useLocation } from 'react-router-dom';
import Box from '@mui/material/Box';
import AppBar from '@mui/material/AppBar';
import Toolbar from '@mui/material/Toolbar';
import Typography from '@mui/material/Typography';
import IconButton from '@mui/material/IconButton';
import Badge from '@mui/material/Badge';
import BottomNavigation from '@mui/material/BottomNavigation';
import BottomNavigationAction from '@mui/material/BottomNavigationAction';
import useMediaQuery from '@mui/material/useMediaQuery';
import { useTheme } from '@mui/material/styles';
import HomeIcon from '@mui/icons-material/Home';
import DirectionsCarIcon from '@mui/icons-material/DirectionsCar';
import PeopleAltIcon from '@mui/icons-material/PeopleAlt';
import EvStationIcon from '@mui/icons-material/EvStation';
import PaymentIcon from '@mui/icons-material/Payment';
import NotificationsIcon from '@mui/icons-material/Notifications';
import SettingsIcon from '@mui/icons-material/Settings';
import ArrowBackIcon from '@mui/icons-material/ArrowBack';
import LanguageIcon from '@mui/icons-material/Language';
import { useParkingNotifications } from './hooks/useNotifications';

const NAV_ITEMS = [
  { label: '홈', icon: <HomeIcon />, path: '/app' },
  { label: '주차', icon: <DirectionsCarIcon />, path: '/app/parking' },
  { label: '방문자', icon: <PeopleAltIcon />, path: '/app/visitors' },
  { label: '충전', icon: <EvStationIcon />, path: '/app/ev' },
  { label: '결제', icon: <PaymentIcon />, path: '/app/billing' },
];

export default function ParkingLayout() {
  const navigate = useNavigate();
  const location = useLocation();
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down('md'));
  const { unreadCount } = useParkingNotifications();

  const getActiveIdx = () => {
    const idx = NAV_ITEMS.findIndex(item => location.pathname === item.path);
    if (idx >= 0) return idx;
    for (let i = NAV_ITEMS.length - 1; i >= 0; i--) {
      if (location.pathname.startsWith(NAV_ITEMS[i].path) && NAV_ITEMS[i].path !== '/app') return i;
    }
    return 0;
  };

  const [navValue, setNavValue] = useState(getActiveIdx());
  useEffect(() => { setNavValue(getActiveIdx()); }, [location.pathname]);

  const isSubpage = location.pathname !== '/app' && NAV_ITEMS.every(item => item.path !== location.pathname);

  const pageTitle = (() => {
    if (location.pathname === '/app') return 'SkyGarage';
    if (location.pathname.startsWith('/app/parking')) return '주차 관리';
    if (location.pathname.startsWith('/app/visitors')) return '방문자 관리';
    if (location.pathname.startsWith('/app/ev')) return '전기차 충전';
    if (location.pathname.startsWith('/app/billing')) return '과금 및 결제';
    if (location.pathname.startsWith('/app/notifications')) return '알림';
    if (location.pathname.startsWith('/app/settings')) return '설정';
    return 'SkyGarage';
  })();

  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', minHeight: '100vh', bgcolor: 'background.default' }}>
      <AppBar
        position="sticky"
        elevation={0}
        sx={{
          bgcolor: 'background.paper',
          borderBottom: '1px solid',
          borderColor: 'divider',
          backdropFilter: 'blur(8px)',
        }}
      >
        <Toolbar sx={{ minHeight: { xs: 56 }, px: { xs: 1.5, sm: 2 } }}>
          {isSubpage ? (
            <IconButton onClick={() => navigate(-1)} sx={{ mr: 0.5, color: 'text.primary' }} size="small">
              <ArrowBackIcon fontSize="small" />
            </IconButton>
          ) : (
            <IconButton onClick={() => navigate('/')} sx={{ mr: 0.5, color: 'text.secondary' }} size="small" title="메인 사이트">
              <LanguageIcon fontSize="small" />
            </IconButton>
          )}
          <Typography
            variant="subtitle1"
            sx={{ fontWeight: 800, flex: 1, color: 'text.primary', fontSize: '1rem', letterSpacing: -0.3 }}
          >
            {pageTitle}
          </Typography>
          <IconButton onClick={() => navigate('/app/notifications')} sx={{ color: 'text.secondary' }} size="small">
            <Badge badgeContent={unreadCount} color="error" max={9}>
              <NotificationsIcon fontSize="small" />
            </Badge>
          </IconButton>
          <IconButton onClick={() => navigate('/app/settings')} sx={{ color: 'text.secondary', ml: 0.5 }} size="small">
            <SettingsIcon fontSize="small" />
          </IconButton>
        </Toolbar>
      </AppBar>

      <Box sx={{ flex: 1, pb: isMobile ? '72px' : 0, overflow: 'auto' }}>
        <Outlet />
      </Box>

      {isMobile && (
        <BottomNavigation
          value={navValue}
          onChange={(_, val) => { setNavValue(val); navigate(NAV_ITEMS[val].path); }}
          showLabels
          sx={{
            position: 'fixed', bottom: 0, left: 0, right: 0,
            borderTop: '1px solid',
            borderColor: 'divider',
            zIndex: 1100,
            bgcolor: 'background.paper',
            height: 64,
            '& .MuiBottomNavigationAction-root': {
              minWidth: 0,
              py: 1,
              '&.Mui-selected': { color: 'primary.main' },
            },
            '& .MuiBottomNavigationAction-label': {
              fontSize: '0.65rem',
              mt: 0.3,
              '&.Mui-selected': { fontSize: '0.65rem', fontWeight: 700 },
            },
          }}
        >
          {NAV_ITEMS.map(item => (
            <BottomNavigationAction key={item.path} label={item.label} icon={item.icon} />
          ))}
        </BottomNavigation>
      )}
    </Box>
  );
}
