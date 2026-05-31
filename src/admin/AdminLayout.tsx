import { useState, useEffect } from 'react';
import { useLocation, useNavigate, Outlet } from 'react-router-dom';
import Box from '@mui/material/Box';
import Drawer from '@mui/material/Drawer';
import AppBar from '@mui/material/AppBar';
import Toolbar from '@mui/material/Toolbar';
import Typography from '@mui/material/Typography';
import IconButton from '@mui/material/IconButton';
import List from '@mui/material/List';
import ListItemButton from '@mui/material/ListItemButton';
import ListItemIcon from '@mui/material/ListItemIcon';
import ListItemText from '@mui/material/ListItemText';
import Collapse from '@mui/material/Collapse';
import Divider from '@mui/material/Divider';
import Chip from '@mui/material/Chip';
import Avatar from '@mui/material/Avatar';
import Tooltip from '@mui/material/Tooltip';
import Menu from '@mui/material/Menu';
import MenuItem from '@mui/material/MenuItem';
import MenuIcon from '@mui/icons-material/Menu';
import DashboardIcon from '@mui/icons-material/Dashboard';
import SmartToyIcon from '@mui/icons-material/SmartToy';
import ElevatorIcon from '@mui/icons-material/Elevator';
import SettingsInputAntennaIcon from '@mui/icons-material/SettingsInputAntenna';
import DirectionsCarIcon from '@mui/icons-material/DirectionsCar';
import BatteryChargingFullIcon from '@mui/icons-material/BatteryChargingFull';
import AccountBalanceIcon from '@mui/icons-material/AccountBalance';
import SettingsIcon from '@mui/icons-material/Settings';
import PeopleIcon from '@mui/icons-material/People';
import BuildIcon from '@mui/icons-material/Build';
import SecurityIcon from '@mui/icons-material/Security';
import AnalyticsIcon from '@mui/icons-material/Analytics';
import ApartmentIcon from '@mui/icons-material/Apartment';
import NotificationsIcon from '@mui/icons-material/Notifications';
import SupportAgentIcon from '@mui/icons-material/SupportAgent';
import HandshakeIcon from '@mui/icons-material/Handshake';
import ReceiptLongIcon from '@mui/icons-material/ReceiptLong';
import HomeIcon from '@mui/icons-material/Home';
import LogoutIcon from '@mui/icons-material/Logout';
import DarkModeIcon from '@mui/icons-material/DarkMode';
import LightModeIcon from '@mui/icons-material/LightMode';
import ExpandLessIcon from '@mui/icons-material/ExpandLess';
import ExpandMoreIcon from '@mui/icons-material/ExpandMore';
import { useAuth } from './contexts/AuthContext';
import { useAdminTheme } from './contexts/ThemeContext';
import { useTenant } from './contexts/TenantContext';

const DRAWER_WIDTH = 260;

interface MenuGroup {
  label: string;
  items: { label: string; path: string; icon: React.ReactNode }[];
}

const menuGroups: MenuGroup[] = [
  {
    label: '개요',
    items: [
      { label: '대시보드', path: '/admin', icon: <DashboardIcon /> },
      { label: '단지 관리', path: '/admin/complexes', icon: <ApartmentIcon /> },
    ],
  },
  {
    label: '운영 관리',
    items: [
      { label: '주차 운영', path: '/admin/parking', icon: <DirectionsCarIcon /> },
      { label: 'ATR 로봇', path: '/admin/atr', icon: <SmartToyIcon /> },
      { label: '차량 엘리베이터', path: '/admin/elevators', icon: <ElevatorIcon /> },
      { label: '하드웨어 연동', path: '/admin/hardware', icon: <SettingsInputAntennaIcon /> },
      { label: '에너지/V2G', path: '/admin/energy', icon: <BatteryChargingFullIcon /> },
      { label: '정비', path: '/admin/maintenance', icon: <BuildIcon /> },
    ],
  },
  {
    label: '비즈니스',
    items: [
      { label: '사용자', path: '/admin/residents', icon: <PeopleIcon /> },
      { label: '정산 관리', path: '/admin/settlement', icon: <AccountBalanceIcon /> },
      { label: '청구/인보이스', path: '/admin/billing', icon: <ReceiptLongIcon /> },
      { label: '계약/파트너', path: '/admin/contracts', icon: <HandshakeIcon /> },
      { label: 'CRM', path: '/admin/crm', icon: <SupportAgentIcon /> },
    ],
  },
  {
    label: '분석/보안',
    items: [
      { label: '분석', path: '/admin/analytics', icon: <AnalyticsIcon /> },
      { label: '보안 감사', path: '/admin/security', icon: <SecurityIcon /> },
      { label: '알림', path: '/admin/alerts', icon: <NotificationsIcon /> },
    ],
  },
  {
    label: '설정',
    items: [
      { label: '설정', path: '/admin/settings', icon: <SettingsIcon /> },
    ],
  },
];

const roleLabels: Record<string, string> = {
  super_admin: 'Super Admin',
  admin: 'Admin',
  manager: 'Manager',
  operator: 'Operator',
  viewer: 'Viewer',
};

export default function AdminLayout() {
  const [mobileOpen, setMobileOpen] = useState(false);
  const [openGroups, setOpenGroups] = useState<Record<string, boolean>>({});
  const [anchorEl, setAnchorEl] = useState<null | HTMLElement>(null);
  const location = useLocation();
  const navigate = useNavigate();
  const { user, role, signOut } = useAuth();
  const { mode, toggleMode } = useAdminTheme();
  const { isImpersonating } = useTenant();

  const displayName = user?.email?.split('@')[0] || 'User';
  const initials = displayName.slice(0, 2).toUpperCase();

  // Auto-expand the group containing the active route
  useEffect(() => {
    const activeGroup = menuGroups.find(g => g.items.some(i => location.pathname === i.path));
    if (activeGroup) {
      setOpenGroups(prev => ({ ...prev, [activeGroup.label]: true }));
    }
  }, [location.pathname]);

  const toggleGroup = (label: string) => {
    setOpenGroups(prev => ({ ...prev, [label]: !prev[label] }));
  };

  const currentTitle = menuGroups
    .flatMap(g => g.items)
    .find(i => i.path === location.pathname)?.label || 'Admin';

  const handleSignOut = async () => {
    setAnchorEl(null);
    await signOut();
  };

  const drawerContent = (
    <Box sx={{ height: '100%', display: 'flex', flexDirection: 'column' }}>
      <Box sx={{ p: 2, display: 'flex', alignItems: 'center', gap: 1.5 }}>
        <Box sx={{ width: 34, height: 34, borderRadius: 1, bgcolor: 'primary.main', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <Typography variant="caption" sx={{ fontWeight: 800, color: '#fff', fontSize: '0.7rem' }}>SG</Typography>
        </Box>
        <Box>
          <Typography variant="subtitle2" sx={{ fontWeight: 700, lineHeight: 1.2 }}>SkyGarage</Typography>
          <Typography variant="caption" color="text.secondary" sx={{ fontSize: '0.6rem' }}>Palatria Admin</Typography>
        </Box>
      </Box>
      <Divider />
      <Box sx={{ flex: 1, overflow: 'auto', px: 1, py: 1 }}>
        {menuGroups.map(group => (
          <Box key={group.label} sx={{ mb: 0.5 }}>
            <ListItemButton
              onClick={() => toggleGroup(group.label)}
              sx={{ borderRadius: 1, height: 32, px: 1.5 }}
            >
              <ListItemText
                primary={group.label}
                slotProps={{ primary: { sx: { fontSize: '0.7rem', fontWeight: 700, color: 'text.secondary', textTransform: 'uppercase', letterSpacing: '0.05em' } } }}
              />
              {openGroups[group.label] ? <ExpandLessIcon sx={{ fontSize: 16, color: 'text.secondary' }} /> : <ExpandMoreIcon sx={{ fontSize: 16, color: 'text.secondary' }} />}
            </ListItemButton>
            <Collapse in={openGroups[group.label]} timeout="auto">
              <List disablePadding>
                {group.items.map(item => {
                  const active = location.pathname === item.path;
                  return (
                    <ListItemButton
                      key={item.path}
                      selected={active}
                      onClick={() => { navigate(item.path); setMobileOpen(false); }}
                      sx={{
                        borderRadius: 1,
                        mb: 0.25,
                        height: 36,
                        pl: 2,
                        '&.Mui-selected': { bgcolor: 'primary.main', color: '#fff', '& .MuiListItemIcon-root': { color: '#fff' } },
                        '&.Mui-selected:hover': { bgcolor: 'primary.dark' },
                      }}
                    >
                      <ListItemIcon sx={{ minWidth: 32, color: active ? '#fff' : 'text.secondary', '& .MuiSvgIcon-root': { fontSize: 18 } }}>
                        {item.icon}
                      </ListItemIcon>
                      <ListItemText primary={item.label} slotProps={{ primary: { sx: { fontSize: '0.8rem', fontWeight: active ? 700 : 500 } } }} />
                    </ListItemButton>
                  );
                })}
              </List>
            </Collapse>
          </Box>
        ))}
      </Box>
      <Divider />
      <Box sx={{ p: 1.5, display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <Chip label="v2.0" size="small" variant="outlined" sx={{ fontSize: '0.6rem', height: 20 }} />
        {role && <Chip label={roleLabels[role] || role} size="small" color="primary" sx={{ fontSize: '0.6rem', height: 20 }} />}
      </Box>
    </Box>
  );

  return (
    <Box sx={{ display: 'flex', minHeight: '100vh' }}>
      {isImpersonating && (
        <Box sx={{ position: 'fixed', top: 0, left: 0, right: 0, height: 3, bgcolor: 'warning.main', zIndex: 9999 }} />
      )}
      <Drawer
        variant="permanent"
        sx={{
          display: { xs: 'none', lg: 'block' },
          '& .MuiDrawer-paper': { width: DRAWER_WIDTH, bgcolor: 'background.paper', borderRight: '1px solid', borderColor: 'divider' },
        }}
      >
        {drawerContent}
      </Drawer>
      <Drawer
        variant="temporary"
        open={mobileOpen}
        onClose={() => setMobileOpen(false)}
        sx={{
          display: { xs: 'block', lg: 'none' },
          '& .MuiDrawer-paper': { width: DRAWER_WIDTH, bgcolor: 'background.paper' },
        }}
      >
        {drawerContent}
      </Drawer>

      <Box sx={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column' }}>
        <AppBar position="sticky" elevation={0} sx={{ bgcolor: 'background.paper', borderBottom: '1px solid', borderColor: 'divider' }}>
          <Toolbar sx={{ minHeight: { xs: 52, sm: 56 }, gap: 1, px: { xs: 1.5, sm: 2.5 } }}>
            <IconButton edge="start" onClick={() => setMobileOpen(true)} sx={{ display: { lg: 'none' }, mr: 0.5, color: 'text.secondary' }}>
              <MenuIcon />
            </IconButton>
            <Typography variant="subtitle1" sx={{ fontWeight: 700, color: 'text.primary', flex: 1 }}>
              {currentTitle}
            </Typography>

            <Tooltip title={mode === 'dark' ? '라이트 모드' : '다크 모드'}>
              <IconButton size="small" onClick={toggleMode} sx={{ color: 'text.secondary' }}>
                {mode === 'dark' ? <LightModeIcon sx={{ fontSize: 18 }} /> : <DarkModeIcon sx={{ fontSize: 18 }} />}
              </IconButton>
            </Tooltip>

            <Tooltip title="홈페이지">
              <IconButton size="small" onClick={() => navigate('/')} sx={{ color: 'text.secondary' }}>
                <HomeIcon sx={{ fontSize: 18 }} />
              </IconButton>
            </Tooltip>

            <Tooltip title={user?.email || '사용자'}>
              <Avatar
                onClick={(e) => setAnchorEl(e.currentTarget)}
                sx={{
                  width: 30, height: 30, fontSize: '0.7rem', fontWeight: 700,
                  background: 'linear-gradient(135deg, #0ea5e9 0%, #06b6d4 100%)',
                  color: '#fff', cursor: 'pointer',
                }}
              >
                {initials}
              </Avatar>
            </Tooltip>

            <Menu anchorEl={anchorEl} open={Boolean(anchorEl)} onClose={() => setAnchorEl(null)}
              slotProps={{ paper: { sx: { mt: 1, minWidth: 180 } } }}>
              <Box sx={{ px: 2, py: 1 }}>
                <Typography variant="body2" sx={{ fontWeight: 700 }}>{displayName}</Typography>
                <Typography variant="caption" color="text.secondary">{user?.email}</Typography>
              </Box>
              <Divider />
              <MenuItem onClick={handleSignOut} sx={{ color: 'error.main', gap: 1 }}>
                <LogoutIcon fontSize="small" />
                로그아웃
              </MenuItem>
            </Menu>
          </Toolbar>
        </AppBar>

        <Box component="main" sx={{ flex: 1, p: { xs: 2, sm: 2.5, md: 3 }, overflow: 'auto', minWidth: 0 }}>
          <Outlet />
        </Box>
      </Box>
    </Box>
  );
}
