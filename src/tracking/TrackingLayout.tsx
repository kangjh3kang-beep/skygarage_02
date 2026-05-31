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
import DashboardIcon from '@mui/icons-material/Dashboard';
import MapIcon from '@mui/icons-material/Map';
import AddCircleIcon from '@mui/icons-material/AddCircle';
import NotificationsIcon from '@mui/icons-material/Notifications';
import PersonIcon from '@mui/icons-material/Person';
import AdminPanelSettingsIcon from '@mui/icons-material/AdminPanelSettings';
import ArrowBackIcon from '@mui/icons-material/ArrowBack';
import HomeIcon from '@mui/icons-material/Home';
import DarkModeIcon from '@mui/icons-material/DarkMode';
import LightModeIcon from '@mui/icons-material/LightMode';
import { useNotifications } from './hooks/useNotifications';
import TrackingErrorBoundary from './components/common/ErrorBoundary';
import ConnectionStatus from './components/common/ConnectionStatus';
import ToastProvider from './components/common/ToastProvider';

interface TrackingLayoutProps {
  darkMode: boolean;
  onToggleDarkMode: () => void;
}

export default function TrackingLayout({ darkMode, onToggleDarkMode }: TrackingLayoutProps) {
  const navigate = useNavigate();
  const location = useLocation();
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down('md'));
  const { unreadCount } = useNotifications();

  const navItems = [
    { label: '홈', icon: <DashboardIcon />, path: '/tracking' },
    { label: '지도', icon: <MapIcon />, path: '/tracking/map' },
    { label: '예약', icon: <AddCircleIcon />, path: '/tracking/booking' },
    { label: '알림', icon: <Badge badgeContent={unreadCount} color="error"><NotificationsIcon /></Badge>, path: '/tracking/notifications' },
    { label: '마이', icon: <PersonIcon />, path: '/tracking/mypage' },
  ];

  const getActiveNavIdx = () => {
    const exact = navItems.findIndex(item => location.pathname === item.path);
    if (exact >= 0) return exact;
    if (location.pathname.startsWith('/tracking/track/')) return 1;
    if (location.pathname.startsWith('/tracking/fleet')) return 0;
    return 0;
  };
  const currentNavIdx = getActiveNavIdx();
  const [navValue, setNavValue] = useState(currentNavIdx);

  useEffect(() => { setNavValue(currentNavIdx); }, [currentNavIdx]);

  const isSubpage = location.pathname.includes('/track/') || location.pathname.includes('/fleet');

  return (
    <TrackingErrorBoundary>
      <ToastProvider>
      <Box sx={{ display: 'flex', flexDirection: 'column', minHeight: '100vh' }}>
        <ConnectionStatus />
        <AppBar position="sticky" elevation={0} sx={{ bgcolor: 'background.paper', borderBottom: 1, borderColor: 'divider' }}>
          <Toolbar sx={{ minHeight: { xs: 56 } }}>
            {isSubpage && (
              <IconButton onClick={() => navigate(-1)} sx={{ mr: 1 }}>
                <ArrowBackIcon />
              </IconButton>
            )}
            <Typography variant="h6" sx={{ fontWeight: 800, flex: 1, color: 'text.primary', fontSize: '1.1rem' }}>
              SkyGarage Valet
            </Typography>
            <IconButton onClick={() => navigate('/')} sx={{ mr: 0.5, color: 'text.secondary' }}>
              <HomeIcon />
            </IconButton>
            <IconButton onClick={onToggleDarkMode} sx={{ mr: 0.5 }}>
              {darkMode ? <LightModeIcon /> : <DarkModeIcon />}
            </IconButton>
            <IconButton onClick={() => navigate('/tracking/fleet')} sx={{ color: 'text.secondary' }}>
              <AdminPanelSettingsIcon />
            </IconButton>
          </Toolbar>
        </AppBar>

        <Box sx={{ flex: 1, pb: isMobile ? 8 : 0, overflow: 'auto' }}>
          <Outlet />
        </Box>

        {isMobile && (
          <BottomNavigation
            value={navValue}
            onChange={(_, val) => { setNavValue(val); navigate(navItems[val].path); }}
            showLabels
            sx={{ position: 'fixed', bottom: 0, left: 0, right: 0, borderTop: 1, borderColor: 'divider', zIndex: 1100 }}
          >
            {navItems.map(item => (
              <BottomNavigationAction key={item.path} label={item.label} icon={item.icon} />
            ))}
          </BottomNavigation>
        )}
      </Box>
      </ToastProvider>
    </TrackingErrorBoundary>
  );
}
