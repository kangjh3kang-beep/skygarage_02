import { useState, useMemo } from 'react';
import Box from '@mui/material/Box';
import Drawer from '@mui/material/Drawer';
import List from '@mui/material/List';
import ListItemButton from '@mui/material/ListItemButton';
import ListItemIcon from '@mui/material/ListItemIcon';
import ListItemText from '@mui/material/ListItemText';
import Typography from '@mui/material/Typography';
import Divider from '@mui/material/Divider';
import Collapse from '@mui/material/Collapse';
import IconButton from '@mui/material/IconButton';
import Tooltip from '@mui/material/Tooltip';
import useMediaQuery from '@mui/material/useMediaQuery';
import { useTheme } from '@mui/material/styles';
import { useTenant, type AdminScopeLevel } from '../contexts/TenantContext';
import { useAuth } from '../contexts/AuthContext';
import DashboardIcon from '@mui/icons-material/Dashboard';
import ApartmentIcon from '@mui/icons-material/Apartment';
import PeopleIcon from '@mui/icons-material/People';
import LocalParkingIcon from '@mui/icons-material/LocalParking';
import PrecisionManufacturingIcon from '@mui/icons-material/PrecisionManufacturing';
import ElevatorIcon from '@mui/icons-material/Elevator';
import BoltIcon from '@mui/icons-material/Bolt';
import SecurityIcon from '@mui/icons-material/Security';
import DescriptionIcon from '@mui/icons-material/Description';
import SupportAgentIcon from '@mui/icons-material/SupportAgent';
import BarChartIcon from '@mui/icons-material/BarChart';
import SettingsIcon from '@mui/icons-material/Settings';
import PublicIcon from '@mui/icons-material/Public';
import SmartToyIcon from '@mui/icons-material/SmartToy';
import GroupsIcon from '@mui/icons-material/Groups';
import AdminPanelSettingsIcon from '@mui/icons-material/AdminPanelSettings';
import VpnKeyIcon from '@mui/icons-material/VpnKey';
import NotificationsIcon from '@mui/icons-material/Notifications';
import BuildIcon from '@mui/icons-material/Build';
import ConfirmationNumberIcon from '@mui/icons-material/ConfirmationNumber';
import WarningIcon from '@mui/icons-material/Warning';
import MonitorHeartIcon from '@mui/icons-material/MonitorHeart';
import EnergySavingsLeafIcon from '@mui/icons-material/EnergySavingsLeaf';
import HandshakeIcon from '@mui/icons-material/Handshake';
import ImageIcon from '@mui/icons-material/Image';
import ViewCarouselIcon from '@mui/icons-material/ViewCarousel';
import InboxIcon from '@mui/icons-material/Inbox';
import GavelIcon from '@mui/icons-material/Gavel';
import WorkspacePremiumIcon from '@mui/icons-material/WorkspacePremium';
import ExpandLessIcon from '@mui/icons-material/ExpandLess';
import ExpandMoreIcon from '@mui/icons-material/ExpandMore';
import MenuIcon from '@mui/icons-material/Menu';
import CloseIcon from '@mui/icons-material/Close';
import OpenInNewIcon from '@mui/icons-material/OpenInNew';
import AttachMoneyIcon from '@mui/icons-material/AttachMoney';
import SpeedIcon from '@mui/icons-material/Speed';
import AccessibleIcon from '@mui/icons-material/Accessible';
import ShieldIcon from '@mui/icons-material/Shield';
import AccountTreeIcon from '@mui/icons-material/AccountTree';
import HubIcon from '@mui/icons-material/Hub';
import GridViewIcon from '@mui/icons-material/GridView';
import AutoFixHighIcon from '@mui/icons-material/AutoFixHigh';
import EvStationIcon from '@mui/icons-material/EvStation';
import ListAltIcon from '@mui/icons-material/ListAlt';
import GpsFixedIcon from '@mui/icons-material/GpsFixed';
import { useNavigate, useLocation, Link } from 'react-router-dom';

const DRAWER_WIDTH = 260;

type ScopeVisibility = 'global' | 'region' | 'complex' | 'building' | 'all';

interface MenuItem {
  label: string;
  icon: React.ReactNode;
  path: string;
  minScope?: ScopeVisibility;
}

interface MenuGroup {
  label: string;
  items: MenuItem[];
  minScope?: ScopeVisibility;
}

const menuGroups: MenuGroup[] = [
  {
    label: '운영',
    items: [
      { label: 'Dashboard', icon: <DashboardIcon />, path: '/admin' },
      { label: '단지 관리', icon: <ApartmentIcon />, path: '/admin/complexes' },
      { label: '입주민', icon: <PeopleIcon />, path: '/admin/residents' },
      { label: '주차 운영', icon: <LocalParkingIcon />, path: '/admin/parking' },
      { label: '우선배차', icon: <AccessibleIcon />, path: '/admin/priority-dispatch' },
      { label: '차량 추적', icon: <GpsFixedIcon />, path: '/admin/fleet' },
      { label: 'ATR 로봇', icon: <PrecisionManufacturingIcon />, path: '/admin/atr' },
      { label: '엘리베이터', icon: <ElevatorIcon />, path: '/admin/elevators' },
      { label: '에너지/V2G', icon: <BoltIcon />, path: '/admin/energy' },
    ],
  },
  {
    label: '비즈니스',
    items: [
      { label: '계약 관리', icon: <DescriptionIcon />, path: '/admin/contracts', minScope: 'region' },
      { label: '파트너', icon: <HandshakeIcon />, path: '/admin/partners', minScope: 'region' },
      { label: '청구/인보이스', icon: <DescriptionIcon />, path: '/admin/billing' },
      { label: '매출/청구', icon: <AttachMoneyIcon />, path: '/admin/revenue', minScope: 'global' },
      { label: 'CRM', icon: <SupportAgentIcon />, path: '/admin/crm', minScope: 'region' },
      { label: '문의 관리', icon: <InboxIcon />, path: '/admin/inquiries' },
    ],
  },
  {
    label: 'IP/특허',
    items: [
      { label: '특허 관리', icon: <GavelIcon />, path: '/admin/patents', minScope: 'global' },
      { label: '라이선스', icon: <WorkspacePremiumIcon />, path: '/admin/licenses', minScope: 'global' },
    ],
    minScope: 'global',
  },
  {
    label: '지원/정비',
    items: [
      { label: '정비 관리', icon: <BuildIcon />, path: '/admin/maintenance' },
      { label: '지원 티켓', icon: <ConfirmationNumberIcon />, path: '/admin/tickets' },
      { label: '알림 센터', icon: <WarningIcon />, path: '/admin/alerts' },
      { label: '알림', icon: <NotificationsIcon />, path: '/admin/notifications' },
    ],
  },
  {
    label: '모니터링',
    items: [
      { label: 'NOC', icon: <PublicIcon />, path: '/admin/noc' },
      { label: '운영 대시보드', icon: <SpeedIcon />, path: '/admin/operations' },
      { label: '분석', icon: <BarChartIcon />, path: '/admin/analytics' },
      { label: '관측성', icon: <MonitorHeartIcon />, path: '/admin/observability' },
      { label: '이벤트 로그', icon: <ListAltIcon />, path: '/admin/events' },
      { label: '활동 로그', icon: <ListAltIcon />, path: '/admin/activity' },
      { label: 'ESG 인증', icon: <EnergySavingsLeafIcon />, path: '/admin/esg' },
      { label: '보안 감사', icon: <SecurityIcon />, path: '/admin/security' },
      { label: '출입 관리', icon: <VpnKeyIcon />, path: '/admin/access' },
    ],
  },
  {
    label: '인프라',
    items: [
      { label: '시스템 현황', icon: <ShieldIcon />, path: '/admin/system', minScope: 'region' },
      { label: '안전 정책', icon: <ShieldIcon />, path: '/admin/safety' },
      { label: 'V2G 에너지', icon: <EvStationIcon />, path: '/admin/v2g', minScope: 'region' },
      { label: '지역 허브', icon: <HubIcon />, path: '/admin/regions', minScope: 'global' },
      { label: '존 콘솔', icon: <GridViewIcon />, path: '/admin/zones' },
      { label: '워크플로', icon: <AutoFixHighIcon />, path: '/admin/workflows', minScope: 'region' },
      { label: '프로젝트', icon: <AccountTreeIcon />, path: '/admin/projects', minScope: 'region' },
    ],
  },
  {
    label: '프론트엔드',
    items: [
      { label: '이미지 관리', icon: <ImageIcon />, path: '/admin/images' },
      { label: '섹션 미디어', icon: <ViewCarouselIcon />, path: '/admin/media' },
    ],
  },
  {
    label: '시스템',
    items: [
      { label: '사용자 관리', icon: <AdminPanelSettingsIcon />, path: '/admin/users', minScope: 'region' },
      { label: '팀원 관리', icon: <GroupsIcon />, path: '/admin/team' },
      { label: 'AI Agent', icon: <SmartToyIcon />, path: '/admin/ai' },
      { label: 'AI 관리', icon: <SmartToyIcon />, path: '/admin/ai-management', minScope: 'global' },
      { label: '설정', icon: <SettingsIcon />, path: '/admin/settings' },
    ],
  },
];

interface SidebarProps {
  mobileOpen: boolean;
  onMobileClose: () => void;
}

export default function Sidebar({ mobileOpen, onMobileClose }: SidebarProps) {
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down('lg'));
  const navigate = useNavigate();
  const location = useLocation();
  const { scopeLevel } = useTenant();
  const { role } = useAuth();
  const [openGroups, setOpenGroups] = useState<Record<string, boolean>>(() => {
    const initial: Record<string, boolean> = {};
    menuGroups.forEach(g => { initial[g.label] = true; });
    return initial;
  });

  // Scope visibility filtering
  const SCOPE_HIERARCHY: AdminScopeLevel[] = ['building', 'complex', 'region', 'global'];

  const isVisibleAtScope = (minScope: ScopeVisibility | undefined, currentScope: AdminScopeLevel): boolean => {
    if (!minScope || minScope === 'all') return true;
    const minIdx = SCOPE_HIERARCHY.indexOf(minScope as AdminScopeLevel);
    const curIdx = SCOPE_HIERARCHY.indexOf(currentScope);
    // If user is at 'global' scope (highest), they see everything
    // If user is at 'building' scope (lowest), only items with no restriction or 'building'/'all' are shown
    return curIdx >= minIdx;
  };

  // Determine effective scope: use role-based scope when no impersonation active
  const effectiveScope: AdminScopeLevel = scopeLevel === 'global'
    ? (role === 'super_admin' ? 'global' : role === 'admin' ? 'region' : role === 'manager' ? 'complex' : 'building')
    : scopeLevel;

  const filteredMenuGroups = useMemo(() => {
    return menuGroups
      .filter(group => isVisibleAtScope(group.minScope, effectiveScope))
      .map(group => ({
        ...group,
        items: group.items.filter(item => isVisibleAtScope(item.minScope, effectiveScope)),
      }))
      .filter(group => group.items.length > 0);
  }, [effectiveScope]);

  const toggleGroup = (label: string) => {
    setOpenGroups(prev => ({ ...prev, [label]: !prev[label] }));
  };

  const isActive = (path: string) => {
    if (path === '/admin') return location.pathname === '/admin';
    return location.pathname.startsWith(path);
  };

  const handleNav = (path: string) => {
    navigate(path);
    if (isMobile) onMobileClose();
  };

  const drawerContent = (
    <Box sx={{ display: 'flex', flexDirection: 'column', height: '100%' }} role="navigation" aria-label="관리자 메뉴">
      {/* Header */}
      <Box sx={{ px: 2, py: 1.5, display: 'flex', alignItems: 'center', justifyContent: 'space-between', minHeight: 56 }}>
        <Box
          component={Link}
          to="/admin"
          sx={{
            display: 'flex',
            alignItems: 'center',
            gap: 1,
            textDecoration: 'none',
          }}
        >
          <Box
            sx={{
              width: 32,
              height: 32,
              borderRadius: 1,
              bgcolor: 'primary.main',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            <Typography sx={{ fontSize: '0.75rem', fontWeight: 800, color: 'common.black' }}>SG</Typography>
          </Box>
          <Box>
            <Typography sx={{ fontSize: '0.9375rem', fontWeight: 800, color: 'text.primary', lineHeight: 1.2 }}>
              SkyGarage
            </Typography>
            <Typography sx={{ fontSize: '0.625rem', color: 'text.secondary', lineHeight: 1.2 }}>
              Admin Console
            </Typography>
          </Box>
        </Box>
        {isMobile && (
          <IconButton size="small" onClick={onMobileClose} sx={{ color: 'text.secondary' }}>
            <CloseIcon fontSize="small" />
          </IconButton>
        )}
      </Box>

      <Divider />

      {/* Home link */}
      <Box sx={{ px: 1.5, pt: 1.5, pb: 0.5 }}>
        <Tooltip title="프론트엔드 홈페이지로 이동" placement="right">
          <ListItemButton
            onClick={() => { navigate('/'); if (isMobile) onMobileClose(); }}
            sx={{
              borderRadius: 1.5,
              py: 0.75,
              px: 1.5,
              minHeight: 36,
              border: 1,
              borderColor: 'divider',
              '&:hover': { borderColor: 'primary.main', bgcolor: 'action.hover' },
            }}
          >
            <ListItemIcon sx={{ minWidth: 28, color: 'text.secondary' }}>
              <OpenInNewIcon sx={{ fontSize: 18 }} />
            </ListItemIcon>
            <ListItemText
              primary="홈페이지 보기"
              slotProps={{ primary: { sx: { fontSize: '0.8125rem', fontWeight: 600 } } }}
            />
          </ListItemButton>
        </Tooltip>
      </Box>

      {/* Navigation groups */}
      <Box
        sx={{
          flex: 1,
          overflowY: 'auto',
          overflowX: 'hidden',
          py: 1,
          '&::-webkit-scrollbar': { width: 4 },
          '&::-webkit-scrollbar-track': { bgcolor: 'transparent' },
          '&::-webkit-scrollbar-thumb': {
            bgcolor: 'action.disabled',
            borderRadius: 2,
          },
          '&::-webkit-scrollbar-thumb:hover': {
            bgcolor: 'text.secondary',
          },
        }}
      >
        {filteredMenuGroups.map((group) => (
          <Box key={group.label} sx={{ mb: 0.5 }}>
            <ListItemButton
              onClick={() => toggleGroup(group.label)}
              sx={{
                px: 2,
                py: 0.5,
                minHeight: 32,
                '&:hover': { bgcolor: 'action.hover' },
              }}
            >
              <ListItemText
                primary={group.label}
                slotProps={{ primary: { sx: { fontSize: '0.6875rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.08em', color: 'text.secondary' } } }}
              />
              {openGroups[group.label] ? <ExpandLessIcon sx={{ fontSize: 16, color: 'text.secondary' }} /> : <ExpandMoreIcon sx={{ fontSize: 16, color: 'text.secondary' }} />}
            </ListItemButton>
            <Collapse in={openGroups[group.label]} timeout="auto">
              <List disablePadding sx={{ px: 1 }}>
                {group.items.map((item) => {
                  const active = isActive(item.path);
                  return (
                    <ListItemButton
                      key={item.path}
                      onClick={() => handleNav(item.path)}
                      selected={active}
                      sx={{
                        borderRadius: 1.5,
                        mb: 0.25,
                        py: 0.625,
                        px: 1.5,
                        minHeight: 36,
                        '&.Mui-selected': {
                          bgcolor: 'rgba(0,212,255,0.08)',
                          color: 'primary.main',
                          '&:hover': { bgcolor: 'rgba(0,212,255,0.12)' },
                        },
                        '&:hover': { bgcolor: 'action.hover' },
                      }}
                    >
                      <ListItemIcon sx={{ minWidth: 32, color: active ? 'primary.main' : 'text.secondary' }}>
                        {item.icon}
                      </ListItemIcon>
                      <ListItemText
                        primary={item.label}
                        slotProps={{ primary: { sx: { fontSize: '0.8125rem', fontWeight: active ? 700 : 500 } } }}
                      />
                    </ListItemButton>
                  );
                })}
              </List>
            </Collapse>
          </Box>
        ))}
      </Box>
    </Box>
  );

  const drawerPaperStyles = {
    width: DRAWER_WIDTH,
    boxSizing: 'border-box' as const,
    bgcolor: 'background.paper',
    borderRight: 1,
    borderColor: 'divider',
  };

  if (isMobile) {
    return (
      <Drawer
        variant="temporary"
        open={mobileOpen}
        onClose={onMobileClose}
        ModalProps={{ keepMounted: true }}
        sx={{ '& .MuiDrawer-paper': drawerPaperStyles }}
      >
        {drawerContent}
      </Drawer>
    );
  }

  return (
    <Drawer
      variant="permanent"
      sx={{
        width: DRAWER_WIDTH,
        flexShrink: 0,
        '& .MuiDrawer-paper': {
          ...drawerPaperStyles,
          position: 'fixed',
          top: 0,
          left: 0,
          height: '100vh',
          overflowX: 'hidden',
        },
      }}
    >
      {drawerContent}
    </Drawer>
  );
}

export { DRAWER_WIDTH };
export { MenuIcon };
