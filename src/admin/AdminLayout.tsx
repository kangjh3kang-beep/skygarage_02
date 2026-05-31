import { useState, useEffect } from 'react';
import Box from '@mui/material/Box';
import AppBar from '@mui/material/AppBar';
import Toolbar from '@mui/material/Toolbar';
import IconButton from '@mui/material/IconButton';
import Typography from '@mui/material/Typography';
import Tooltip from '@mui/material/Tooltip';
import Chip from '@mui/material/Chip';
import Avatar from '@mui/material/Avatar';
import Menu from '@mui/material/Menu';
import MenuItem from '@mui/material/MenuItem';
import Divider from '@mui/material/Divider';
import Snackbar from '@mui/material/Snackbar';
import Alert from '@mui/material/Alert';
import Button from '@mui/material/Button';
import HomeIcon from '@mui/icons-material/Home';
import LogoutIcon from '@mui/icons-material/Logout';
import SearchIcon from '@mui/icons-material/Search';
import DarkModeIcon from '@mui/icons-material/DarkMode';
import LightModeIcon from '@mui/icons-material/LightMode';
import KeyboardIcon from '@mui/icons-material/Keyboard';
import { Outlet, useLocation, useNavigate } from 'react-router-dom';
import Sidebar, { MenuIcon } from './components/Sidebar';
import CommandPalette from './components/CommandPalette';
import NotificationCenter from './components/NotificationCenter';
import ConnectionStatus from './components/ConnectionStatus';
import KeyboardShortcutsHelp from './components/KeyboardShortcutsHelp';
import ErrorBoundary from './components/ErrorBoundary';
import Breadcrumbs from './components/Breadcrumbs';
import ContextSwitcher from './components/ContextSwitcher';
import CoManagementIndicator from './components/CoManagementIndicator';
import { useAuth } from './contexts/AuthContext';
import { useAdminTheme } from './contexts/ThemeContext';
import { useTenant } from './contexts/TenantContext';

const routeTitles: Record<string, string> = {
  '/admin': 'Dashboard',
  '/admin/operations': '운영 현황',
  '/admin/noc': 'NOC',
  '/admin/system': '시스템',
  '/admin/complexes': '단지 관리',
  '/admin/residents': '사용자',
  '/admin/parking': '주차 운영',
  '/admin/atr': 'ATR 로봇',
  '/admin/elevators': '엘리베이터',
  '/admin/energy': '에너지/V2G',
  '/admin/v2g': '에너지/V2G',
  '/admin/fleet': '차량 추적',
  '/admin/priority-dispatch': '우선배차',
  '/admin/maintenance': '정비',
  '/admin/contracts': '계약',
  '/admin/partners': '파트너',
  '/admin/billing': '청구/인보이스',
  '/admin/revenue': '매출',
  '/admin/crm': 'CRM',
  '/admin/inquiries': '문의',
  '/admin/tickets': '지원 티켓',
  '/admin/patents': '특허',
  '/admin/licenses': '라이선스',
  '/admin/analytics': '분석',
  '/admin/observability': '관측성',
  '/admin/security': '보안 감사',
  '/admin/access': '출입 관리',
  '/admin/esg': 'ESG',
  '/admin/alerts': '알림',
  '/admin/notifications': '알림',
  '/admin/activity': '활동 로그',
  '/admin/events': '활동 로그',
  '/admin/users': '사용자 관리',
  '/admin/team': '팀원',
  '/admin/ai': 'AI',
  '/admin/ai-management': 'AI 관리',
  '/admin/workflows': '워크플로',
  '/admin/regions': '지역 허브',
  '/admin/projects': '프로젝트',
  '/admin/safety': '안전 정책',
  '/admin/images': '콘텐츠',
  '/admin/media': '콘텐츠',
  '/admin/settings': '설정',
  '/admin/zones': '존 콘솔',
};

const roleLabels: Record<string, string> = {
  super_admin: 'Super Admin',
  admin: 'Admin',
  manager: 'Manager',
  operator: 'Operator',
  viewer: 'Viewer',
};

const roleColors: Record<string, 'error' | 'warning' | 'primary' | 'info' | 'default'> = {
  super_admin: 'error',
  admin: 'warning',
  manager: 'primary',
  operator: 'info',
  viewer: 'default',
};

const SESSION_TIMEOUT_MS = 30 * 60 * 1000;
const SESSION_WARNING_MS = 5 * 60 * 1000;

export default function AdminLayout() {
  const [mobileOpen, setMobileOpen] = useState(false);
  const [anchorEl, setAnchorEl] = useState<null | HTMLElement>(null);
  const [commandPaletteOpen, setCommandPaletteOpen] = useState(false);
  const [shortcutsOpen, setShortcutsOpen] = useState(false);
  const [sessionWarning, setSessionWarning] = useState(false);
  const location = useLocation();
  const navigate = useNavigate();
  const { user, role, signOut } = useAuth();
  const { mode, toggleMode } = useAdminTheme();
  const { isImpersonating } = useTenant();

  const title = routeTitles[location.pathname] || 'Admin';
  const displayName = user?.email?.split('@')[0] || 'User';
  const initials = displayName.slice(0, 2).toUpperCase();

  // 키보드 단축키
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'k' && (e.metaKey || e.ctrlKey)) {
        e.preventDefault();
        setCommandPaletteOpen(true);
      }
      if (e.key === '?' && !e.ctrlKey && !e.metaKey && !(e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement)) {
        e.preventDefault();
        setShortcutsOpen(true);
      }
      if (e.key === 'D' && e.ctrlKey && e.shiftKey) {
        e.preventDefault();
        toggleMode();
      }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [toggleMode]);

  // 세션 타임아웃 경고
  useEffect(() => {
    let warningTimer: ReturnType<typeof setTimeout>;
    let logoutTimer: ReturnType<typeof setTimeout>;

    const resetTimers = () => {
      clearTimeout(warningTimer);
      clearTimeout(logoutTimer);
      setSessionWarning(false);

      warningTimer = setTimeout(() => {
        setSessionWarning(true);
      }, SESSION_TIMEOUT_MS - SESSION_WARNING_MS);

      logoutTimer = setTimeout(() => {
        signOut();
      }, SESSION_TIMEOUT_MS);
    };

    const events = ['mousedown', 'keydown', 'touchstart', 'scroll'];
    events.forEach(evt => window.addEventListener(evt, resetTimers));
    resetTimers();

    return () => {
      clearTimeout(warningTimer);
      clearTimeout(logoutTimer);
      events.forEach(evt => window.removeEventListener(evt, resetTimers));
    };
  }, [signOut]);

  const handleSignOut = async () => {
    setAnchorEl(null);
    await signOut();
  };

  const handleExtendSession = () => {
    setSessionWarning(false);
  };

  return (
    <Box sx={{ display: 'flex', minHeight: '100vh', width: '100%', overflow: 'hidden' }}>
      {/* Co-Management Gold Glow Indicator */}
      <CoManagementIndicator />

      <Box
        component="a"
        href="#main-content"
        sx={{
          position: 'absolute',
          top: -100,
          left: 8,
          zIndex: 9999,
          bgcolor: 'primary.main',
          color: 'primary.contrastText',
          px: 2,
          py: 1,
          borderRadius: 1,
          fontWeight: 700,
          fontSize: '0.875rem',
          textDecoration: 'none',
          '&:focus': { top: 8 },
        }}
      >
        본문으로 건너뛰기
      </Box>
      <Sidebar mobileOpen={mobileOpen} onMobileClose={() => setMobileOpen(false)} />

      <Box
        component="main"
        sx={{
          flexGrow: 1,
          minWidth: 0,
          minHeight: '100vh',
          bgcolor: 'background.default',
          display: 'flex',
          flexDirection: 'column',
          overflow: 'hidden',
          pt: isImpersonating ? '24px' : 0,
        }}
      >
        <AppBar
          position="sticky"
          elevation={0}
          aria-label="상단 도구 모음"
          sx={{
            bgcolor: 'background.paper',
            borderBottom: '1px solid',
            borderColor: 'divider',
            zIndex: (theme) => theme.zIndex.appBar,
            backdropFilter: 'blur(8px)',
          }}
        >
          <Toolbar sx={{ minHeight: { xs: 52, sm: 56 }, gap: 0.75, px: { xs: 1.5, sm: 2.5 } }}>
            <IconButton
              edge="start"
              color="inherit"
              onClick={() => setMobileOpen(true)}
              sx={{ display: { lg: 'none' }, mr: 0.5, color: 'text.secondary' }}
            >
              <MenuIcon />
            </IconButton>

            <Typography
              variant="subtitle1"
              noWrap
              sx={{ color: 'text.primary', fontWeight: 700, letterSpacing: '-0.02em', display: { xs: 'none', sm: 'block' } }}
            >
              {title}
            </Typography>

            {/* Hierarchical Context Switcher */}
            <Box sx={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: { xs: 'flex-start', md: 'center' }, ml: { xs: 0, sm: 1 } }}>
              <ContextSwitcher />
            </Box>

            <ConnectionStatus />

            {/* 검색 단축키 표시 */}
            <Tooltip title="명령 팔레트 (Ctrl+K)">
              <Chip
                icon={<SearchIcon sx={{ fontSize: 14 }} />}
                label="Ctrl+K"
                size="small"
                variant="outlined"
                onClick={() => setCommandPaletteOpen(true)}
                sx={{
                  height: 26,
                  fontSize: '0.65rem',
                  fontWeight: 500,
                  cursor: 'pointer',
                  display: { xs: 'none', md: 'flex' },
                  borderColor: 'divider',
                  '&:hover': { borderColor: 'primary.main', bgcolor: 'action.hover' },
                }}
              />
            </Tooltip>

            {/* 테마 토글 */}
            <Tooltip title={mode === 'dark' ? '라이트 모드' : '다크 모드'}>
              <IconButton
                size="small"
                onClick={toggleMode}
                sx={{ color: 'text.secondary', '&:hover': { color: 'primary.main', bgcolor: 'action.hover' } }}
              >
                {mode === 'dark' ? <LightModeIcon sx={{ fontSize: 18 }} /> : <DarkModeIcon sx={{ fontSize: 18 }} />}
              </IconButton>
            </Tooltip>

            {/* 알림 센터 */}
            <NotificationCenter />

            {role && (
              <Chip
                label={roleLabels[role] || role}
                size="small"
                color={roleColors[role] || 'default'}
                sx={{ fontSize: '0.7rem', height: 22, display: { xs: 'none', sm: 'flex' } }}
              />
            )}

            <Tooltip title="홈페이지 이동">
              <IconButton
                size="small"
                onClick={() => navigate('/')}
                sx={{ color: 'text.secondary', '&:hover': { color: 'primary.main' } }}
              >
                <HomeIcon fontSize="small" />
              </IconButton>
            </Tooltip>

            <Tooltip title={user?.email || '사용자'}>
              <Avatar
                onClick={(e) => setAnchorEl(e.currentTarget)}
                sx={{
                  width: 30, height: 30, fontSize: '0.7rem', fontWeight: 700,
                  background: 'linear-gradient(135deg, #0ea5e9 0%, #06b6d4 100%)',
                  color: '#fff', cursor: 'pointer',
                  transition: 'opacity 0.15s',
                  '&:hover': { opacity: 0.85 },
                }}
              >
                {initials}
              </Avatar>
            </Tooltip>

            <Menu
              anchorEl={anchorEl}
              open={Boolean(anchorEl)}
              onClose={() => setAnchorEl(null)}
              slotProps={{ paper: { sx: { mt: 1, minWidth: 200 } } }}
            >
              <Box sx={{ px: 2, py: 1 }}>
                <Typography variant="body2" sx={{ fontWeight: 700 }}>{displayName}</Typography>
                <Typography variant="caption" color="text.secondary">{user?.email}</Typography>
              </Box>
              <Divider />
              <MenuItem onClick={() => { setAnchorEl(null); setShortcutsOpen(true); }} sx={{ gap: 1 }}>
                <KeyboardIcon fontSize="small" />
                단축키 도움말
              </MenuItem>
              <MenuItem onClick={handleSignOut} sx={{ color: 'error.main', gap: 1 }}>
                <LogoutIcon fontSize="small" />
                로그아웃
              </MenuItem>
            </Menu>
          </Toolbar>
        </AppBar>

        <Box id="main-content" sx={{ flex: 1, p: { xs: 2, sm: 2.5, md: 3 }, overflow: 'auto', minWidth: 0 }} role="main">
          <Breadcrumbs />
          <ErrorBoundary>
            <Outlet />
          </ErrorBoundary>
        </Box>
      </Box>

      {/* 명령 팔레트 */}
      <CommandPalette open={commandPaletteOpen} onClose={() => setCommandPaletteOpen(false)} />

      {/* 키보드 단축키 도움말 */}
      <KeyboardShortcutsHelp open={shortcutsOpen} onClose={() => setShortcutsOpen(false)} />

      {/* 세션 타임아웃 경고 */}
      <Snackbar
        open={sessionWarning}
        anchorOrigin={{ vertical: 'top', horizontal: 'center' }}
      >
        <Alert
          severity="warning"
          variant="filled"
          action={
            <Button color="inherit" size="small" onClick={handleExtendSession}>
              연장
            </Button>
          }
        >
          세션이 5분 후 만료됩니다. 계속 사용하시려면 연장을 클릭하세요.
        </Alert>
      </Snackbar>
    </Box>
  );
}
