import { Outlet, useNavigate, useLocation } from 'react-router-dom';
import Box from '@mui/material/Box';
import BottomNavigation from '@mui/material/BottomNavigation';
import BottomNavigationAction from '@mui/material/BottomNavigationAction';
import HomeIcon from '@mui/icons-material/Home';
import AccountBalanceWalletIcon from '@mui/icons-material/AccountBalanceWallet';
import NfcIcon from '@mui/icons-material/Nfc';
import MapIcon from '@mui/icons-material/Map';
import PersonIcon from '@mui/icons-material/Person';
import AppBar from '@mui/material/AppBar';
import Toolbar from '@mui/material/Toolbar';
import Typography from '@mui/material/Typography';
import Chip from '@mui/material/Chip';
import Badge from '@mui/material/Badge';
import IconButton from '@mui/material/IconButton';
import NotificationsIcon from '@mui/icons-material/Notifications';
import { useSgpAuth } from './contexts/SgpAuthContext';
import SgpLoginPage from './pages/SgpLoginPage';
import MobileOnlyGate from './components/MobileOnlyGate';
import PwaInstallPrompt from './components/PwaInstallPrompt';

const tabs = [
  { label: '홈', icon: <HomeIcon />, path: '/app' },
  { label: '지갑', icon: <AccountBalanceWalletIcon />, path: '/app/wallet' },
  { label: '결제', icon: <NfcIcon />, path: '/app/pay' },
  { label: '내차위치', icon: <MapIcon />, path: '/app/map' },
  { label: '내정보', icon: <PersonIcon />, path: '/app/profile' },
];

function isMobileDevice(): boolean {
  if (typeof window === 'undefined') return true;
  const ua = navigator.userAgent.toLowerCase();
  return /android|iphone|ipad|ipod|webos|blackberry|windows phone/.test(ua)
    || window.innerWidth <= 768;
}

export default function SgpLayout() {
  const { isAuthenticated, loading, wallet } = useSgpAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const isMobile = isMobileDevice();

  if (!isMobile) {
    return <MobileOnlyGate />;
  }

  if (loading) {
    return (
      <Box sx={{
        minHeight: '100dvh', bgcolor: '#0d1b2a',
        display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
      }}>
        <Box component="img" src="/logo01.png" alt="SGP" sx={{ width: 48, height: 48, mb: 2, borderRadius: '12px', opacity: 0.8 }} />
        <Box sx={{
          width: 32, height: 32, borderRadius: '50%',
          border: '3px solid rgba(0,212,170,0.2)',
          borderTopColor: '#00d4aa',
          animation: 'spin 0.8s linear infinite',
          '@keyframes spin': { to: { transform: 'rotate(360deg)' } },
        }} />
      </Box>
    );
  }

  if (!isAuthenticated) {
    return <SgpLoginPage />;
  }

  const currentTab = tabs.findIndex(t => t.path === location.pathname);

  return (
    <Box sx={{ minHeight: '100dvh', bgcolor: '#0d1b2a', display: 'flex', flexDirection: 'column' }}>
      {/* App Bar */}
      <AppBar position="sticky" elevation={0} sx={{ bgcolor: '#0d1b2a', borderBottom: '1px solid rgba(255,255,255,0.06)' }}>
        <Toolbar sx={{ minHeight: '52px !important', px: 2 }}>
          <Box component="img" src="/logo01.png" alt="SGP" sx={{ width: 26, height: 26, mr: 1, borderRadius: '6px' }} />
          <Typography variant="subtitle2" sx={{ fontWeight: 800, color: '#fff', letterSpacing: '-0.3px' }}>
            SGP
          </Typography>
          <Box sx={{ flex: 1 }} />
          {wallet && (
            <Chip
              icon={<AccountBalanceWalletIcon sx={{ fontSize: 13, color: '#00d4aa !important' }} />}
              label={`${wallet.balance.toLocaleString()}C`}
              size="small"
              onClick={() => navigate('/app/wallet')}
              sx={{
                bgcolor: 'rgba(0,212,170,0.08)',
                color: '#00d4aa',
                fontWeight: 700,
                fontSize: '0.72rem',
                height: 26,
                border: '1px solid rgba(0,212,170,0.2)',
                cursor: 'pointer',
                '&:hover': { bgcolor: 'rgba(0,212,170,0.15)' },
              }}
            />
          )}
          <IconButton size="small" sx={{ ml: 1, color: 'rgba(255,255,255,0.6)' }}>
            <Badge variant="dot" sx={{ '& .MuiBadge-badge': { bgcolor: '#ff5252', width: 6, height: 6, minWidth: 6 } }}>
              <NotificationsIcon sx={{ fontSize: 20 }} />
            </Badge>
          </IconButton>
        </Toolbar>
      </AppBar>

      {/* Content */}
      <Box sx={{ flex: 1, overflow: 'auto', pb: '68px', WebkitOverflowScrolling: 'touch' }}>
        <Outlet />
      </Box>

      {/* Bottom Navigation */}
      <BottomNavigation
        value={currentTab >= 0 ? currentTab : 0}
        onChange={(_, idx) => navigate(tabs[idx].path)}
        sx={{
          position: 'fixed',
          bottom: 0,
          left: 0,
          right: 0,
          bgcolor: 'rgba(13,27,42,0.97)',
          borderTop: '1px solid rgba(255,255,255,0.06)',
          height: 60,
          backdropFilter: 'blur(10px)',
          '& .MuiBottomNavigationAction-root': {
            color: 'rgba(255,255,255,0.35)',
            minWidth: 0,
            py: 0.5,
            transition: 'color 0.2s ease',
            '& .MuiBottomNavigationAction-label': { fontSize: '0.62rem', mt: 0.3 },
            '&.Mui-selected': {
              color: '#00d4aa',
              '& .MuiBottomNavigationAction-label': { fontSize: '0.64rem', fontWeight: 700 },
            },
          },
        }}
      >
        {tabs.map(tab => (
          <BottomNavigationAction
            key={tab.path}
            label={tab.label}
            icon={tab.path === '/app/pay' ? (
              <Box sx={{
                width: 40, height: 40, borderRadius: '50%',
                bgcolor: currentTab === 2 ? '#00d4aa' : 'rgba(0,212,170,0.15)',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                mt: -1, boxShadow: currentTab === 2 ? '0 4px 12px rgba(0,212,170,0.3)' : 'none',
                transition: 'all 0.2s ease',
              }}>
                <NfcIcon sx={{ fontSize: 20, color: currentTab === 2 ? '#0d1b2a' : '#00d4aa' }} />
              </Box>
            ) : tab.icon}
          />
        ))}
      </BottomNavigation>

      {/* PWA Install Prompt */}
      <PwaInstallPrompt />
    </Box>
  );
}
