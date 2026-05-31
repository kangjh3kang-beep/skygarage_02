import { Outlet, useNavigate, useLocation } from 'react-router-dom';
import Box from '@mui/material/Box';
import BottomNavigation from '@mui/material/BottomNavigation';
import BottomNavigationAction from '@mui/material/BottomNavigationAction';
import HomeIcon from '@mui/icons-material/Home';
import AccountBalanceWalletIcon from '@mui/icons-material/AccountBalanceWallet';
import LocalParkingIcon from '@mui/icons-material/LocalParking';
import NfcIcon from '@mui/icons-material/Nfc';
import PersonIcon from '@mui/icons-material/Person';
import AppBar from '@mui/material/AppBar';
import Toolbar from '@mui/material/Toolbar';
import Typography from '@mui/material/Typography';
import IconButton from '@mui/material/IconButton';
import Chip from '@mui/material/Chip';
import { useSgpAuth } from './contexts/SgpAuthContext';
import SgpLoginPage from './pages/SgpLoginPage';

const tabs = [
  { label: '홈', icon: <HomeIcon />, path: '/app' },
  { label: '지갑', icon: <AccountBalanceWalletIcon />, path: '/app/wallet' },
  { label: '결제', icon: <NfcIcon />, path: '/app/pay' },
  { label: '주차', icon: <LocalParkingIcon />, path: '/app/parking' },
  { label: '내정보', icon: <PersonIcon />, path: '/app/profile' },
];

export default function SgpLayout() {
  const { isAuthenticated, loading, wallet } = useSgpAuth();
  const navigate = useNavigate();
  const location = useLocation();

  if (loading) {
    return (
      <Box sx={{ minHeight: '100vh', bgcolor: '#0d1b2a', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <Typography sx={{ color: 'rgba(255,255,255,0.5)' }}>로딩중...</Typography>
      </Box>
    );
  }

  if (!isAuthenticated) {
    return <SgpLoginPage />;
  }

  const currentTab = tabs.findIndex(t => t.path === location.pathname) || 0;

  return (
    <Box sx={{ minHeight: '100vh', bgcolor: '#0d1b2a', display: 'flex', flexDirection: 'column' }}>
      <AppBar position="sticky" elevation={0} sx={{ bgcolor: '#0d1b2a', borderBottom: '1px solid rgba(255,255,255,0.08)' }}>
        <Toolbar sx={{ minHeight: '56px !important', px: 2 }}>
          <Box component="img" src="/logo01.png" alt="SGP" sx={{ width: 28, height: 28, mr: 1 }} />
          <Typography variant="subtitle1" sx={{ fontWeight: 700, color: '#fff', flex: 1 }}>
            SGP App
          </Typography>
          {wallet && (
            <Chip
              icon={<AccountBalanceWalletIcon sx={{ fontSize: 14, color: '#00d4aa !important' }} />}
              label={`${wallet.balance.toLocaleString()} C`}
              size="small"
              sx={{
                bgcolor: 'rgba(0,212,170,0.1)',
                color: '#00d4aa',
                fontWeight: 700,
                fontSize: '0.75rem',
                border: '1px solid rgba(0,212,170,0.3)',
              }}
            />
          )}
          <IconButton size="small" sx={{ ml: 1, color: 'rgba(255,255,255,0.7)' }}>
            <NfcIcon sx={{ fontSize: 20 }} />
          </IconButton>
        </Toolbar>
      </AppBar>

      <Box sx={{ flex: 1, overflow: 'auto', pb: '72px' }}>
        <Outlet />
      </Box>

      <BottomNavigation
        value={currentTab >= 0 ? currentTab : 0}
        onChange={(_, idx) => navigate(tabs[idx].path)}
        sx={{
          position: 'fixed',
          bottom: 0,
          left: 0,
          right: 0,
          bgcolor: '#0d1b2a',
          borderTop: '1px solid rgba(255,255,255,0.08)',
          height: 64,
          '& .MuiBottomNavigationAction-root': {
            color: 'rgba(255,255,255,0.4)',
            minWidth: 0,
            '&.Mui-selected': { color: '#00d4aa' },
          },
        }}
      >
        {tabs.map(tab => (
          <BottomNavigationAction key={tab.path} label={tab.label} icon={tab.icon} />
        ))}
      </BottomNavigation>
    </Box>
  );
}
