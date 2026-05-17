import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import AppBar from '@mui/material/AppBar';
import Toolbar from '@mui/material/Toolbar';
import Typography from '@mui/material/Typography';
import Button from '@mui/material/Button';
import IconButton from '@mui/material/IconButton';
import Box from '@mui/material/Box';
import Drawer from '@mui/material/Drawer';
import List from '@mui/material/List';
import ListItem from '@mui/material/ListItem';
import ListItemButton from '@mui/material/ListItemButton';
import ListItemText from '@mui/material/ListItemText';
import Divider from '@mui/material/Divider';
import Tooltip from '@mui/material/Tooltip';
import useScrollTrigger from '@mui/material/useScrollTrigger';
import useMediaQuery from '@mui/material/useMediaQuery';
import { useTheme } from '@mui/material/styles';
import MenuIcon from '@mui/icons-material/Menu';
import CloseIcon from '@mui/icons-material/Close';
import DarkModeIcon from '@mui/icons-material/DarkMode';
import LightModeIcon from '@mui/icons-material/LightMode';
import AdminPanelSettingsIcon from '@mui/icons-material/AdminPanelSettings';
import { COLORS } from '../theme';
import { useColorMode } from '../App';

const navItems = [
  { label: '소개', href: '#solution' },
  { label: '기술', href: '#technology' },
  { label: '시스템', href: '#process' },
  { label: '장점', href: '#benefits' },
  { label: '시장', href: '#market' },
  { label: '문의', href: '#contact' },
];

export default function Navbar() {
  const theme = useTheme();
  const navigate = useNavigate();
  const { mode, toggleMode } = useColorMode();
  const isMobile = useMediaQuery(theme.breakpoints.down('md'));
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [activeSection, setActiveSection] = useState('');

  const isDark = mode === 'dark';

  const scrolled = useScrollTrigger({
    disableHysteresis: true,
    threshold: 60,
  });

  useEffect(() => {
    const handleScroll = () => {
      const sections = navItems.map((item) => item.href.replace('#', ''));
      for (let i = sections.length - 1; i >= 0; i--) {
        const el = document.getElementById(sections[i]);
        if (el && window.scrollY >= el.offsetTop - 120) {
          setActiveSection(sections[i]);
          break;
        }
      }
    };
    window.addEventListener('scroll', handleScroll, { passive: true });
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  const handleNavClick = (href: string) => {
    setDrawerOpen(false);
    const id = href.replace('#', '');
    const el = document.getElementById(id);
    if (el) el.scrollIntoView({ behavior: 'smooth' });
  };

  const navBg = scrolled
    ? isDark
      ? 'rgba(10,10,15,0.92)'
      : 'rgba(248,246,240,0.94)'
    : isDark
      ? 'rgba(10,10,15,0.6)'
      : 'rgba(248,246,240,0.7)';

  const goldColor = isDark ? COLORS.GOLD : COLORS.GOLD_DARK;
  const goldColorLight = isDark ? COLORS.GOLD_LIGHT : COLORS.GOLD;

  return (
    <>
      <AppBar
        position="fixed"
        elevation={scrolled ? 4 : 0}
        sx={{
          background: navBg,
          backdropFilter: 'blur(12px)',
          borderBottom: scrolled
            ? isDark
              ? `1px solid rgba(201,168,76,0.15)`
              : `1px solid rgba(159,122,45,0.2)`
            : isDark
              ? '1px solid rgba(255,255,255,0.06)'
              : '1px solid rgba(0,0,0,0.06)',
          transition: 'all 0.4s cubic-bezier(0.4, 0, 0.2, 1)',
          zIndex: theme.zIndex.appBar,
        }}
      >
        <Toolbar
          sx={{
            maxWidth: 1300,
            mx: 'auto',
            width: '100%',
            px: { xs: 2, sm: 3, md: 4 },
            minHeight: { xs: 56, sm: 64, md: 72 },
          }}
        >
          {/* Logo */}
          <Box
            sx={{ display: 'flex', alignItems: 'center', gap: 1, cursor: 'pointer', flexGrow: 1 }}
            onClick={() => window.scrollTo({ top: 0, behavior: 'smooth' })}
          >
            <Box
              component="img"
              src="/logo-palatria.webp"
              alt="PALATRIA"
              sx={{
                width: { xs: 44, md: 54 },
                height: { xs: 44, md: 54 },
                objectFit: 'contain',
                flexShrink: 0,
                filter: isDark ? 'drop-shadow(0 0 10px rgba(201,168,76,0.5))' : 'drop-shadow(0 2px 4px rgba(0,0,0,0.15))',
              }}
            />
            <Box>
              <Typography
                variant="h6"
                sx={{
                  fontFamily: '"Montserrat", sans-serif',
                  fontWeight: 900,
                  fontSize: { xs: '0.9rem', md: '1.1rem' },
                  letterSpacing: '0.08em',
                  background: `linear-gradient(135deg, ${goldColor} 0%, ${goldColorLight} 100%)`,
                  backgroundClip: 'text',
                  WebkitBackgroundClip: 'text',
                  WebkitTextFillColor: 'transparent',
                  lineHeight: 1.1,
                }}
              >
                SKYGARAGE
              </Typography>
              <Typography
                sx={{
                  fontFamily: '"Noto Sans KR", sans-serif',
                  fontWeight: 500,
                  fontSize: { xs: '0.5rem', md: '0.6rem' },
                  color: isDark ? COLORS.SILVER : 'text.secondary',
                  letterSpacing: '0.05em',
                  lineHeight: 1,
                }}
              >
                스카이게러지 팔라트리아
              </Typography>
            </Box>
          </Box>

          {/* Desktop Nav */}
          {!isMobile && (
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
              {navItems.map((item) => {
                const isActive = activeSection === item.href.replace('#', '');
                return (
                  <Button
                    key={item.label}
                    onClick={() => handleNavClick(item.href)}
                    sx={{
                      color: isActive ? goldColor : isDark ? 'rgba(248,250,252,0.85)' : 'text.primary',
                      fontWeight: isActive ? 700 : 600,
                      fontSize: '0.875rem',
                      px: 1.5,
                      py: 1,
                      borderRadius: 2,
                      position: 'relative',
                      minWidth: 'auto',
                      '&::after': {
                        content: '""',
                        position: 'absolute',
                        bottom: 4,
                        left: '50%',
                        transform: isActive ? 'translateX(-50%) scaleX(1)' : 'translateX(-50%) scaleX(0)',
                        width: '60%',
                        height: '2px',
                        background: `linear-gradient(90deg, ${goldColor}, ${goldColorLight})`,
                        borderRadius: '1px',
                        transition: 'transform 0.3s ease',
                      },
                      '&:hover': {
                        color: goldColor,
                        bgcolor: isDark ? 'rgba(201,168,76,0.06)' : 'rgba(159,122,45,0.06)',
                        '&::after': {
                          transform: 'translateX(-50%) scaleX(1)',
                        },
                      },
                    }}
                  >
                    {item.label}
                  </Button>
                );
              })}

              {/* Dark/Light toggle */}
              <Tooltip title={isDark ? '라이트 모드로 전환' : '다크 모드로 전환'}>
                <IconButton
                  onClick={toggleMode}
                  size="small"
                  sx={{
                    ml: 1,
                    color: goldColor,
                    border: `1px solid ${isDark ? 'rgba(201,168,76,0.3)' : 'rgba(159,122,45,0.3)'}`,
                    borderRadius: 2,
                    width: 36,
                    height: 36,
                    transition: 'all 0.3s ease',
                    '&:hover': {
                      bgcolor: isDark ? 'rgba(201,168,76,0.1)' : 'rgba(159,122,45,0.1)',
                      transform: 'scale(1.1)',
                    },
                  }}
                >
                  {isDark ? <LightModeIcon sx={{ fontSize: 18 }} /> : <DarkModeIcon sx={{ fontSize: 18 }} />}
                </IconButton>
              </Tooltip>

              {/* Admin panel */}
              <Tooltip title="관리자 페이지">
                <IconButton
                  onClick={() => navigate('/admin')}
                  size="small"
                  sx={{
                    color: isDark ? COLORS.SILVER : 'text.secondary',
                    border: `1px solid ${isDark ? 'rgba(255,255,255,0.12)' : 'rgba(0,0,0,0.12)'}`,
                    borderRadius: 2,
                    width: 36,
                    height: 36,
                    transition: 'all 0.3s ease',
                    '&:hover': {
                      color: isDark ? '#00d4ff' : theme.palette.primary.main,
                      borderColor: isDark ? 'rgba(0,212,255,0.4)' : 'rgba(159,122,45,0.4)',
                      bgcolor: isDark ? 'rgba(0,212,255,0.08)' : 'rgba(159,122,45,0.06)',
                    },
                  }}
                >
                  <AdminPanelSettingsIcon sx={{ fontSize: 18 }} />
                </IconButton>
              </Tooltip>

              <Button
                variant="contained"
                size="small"
                onClick={() => handleNavClick('#contact')}
                sx={{ ml: 1.5, py: 1, px: 2.5, fontSize: '0.875rem' }}
              >
                도입 문의
              </Button>
            </Box>
          )}

          {/* Mobile controls */}
          {isMobile && (
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
              <Tooltip title={isDark ? '라이트 모드' : '다크 모드'}>
                <IconButton
                  onClick={toggleMode}
                  size="small"
                  sx={{
                    color: goldColor,
                    border: `1px solid ${isDark ? 'rgba(201,168,76,0.3)' : 'rgba(159,122,45,0.3)'}`,
                    borderRadius: 1.5,
                    width: 34,
                    height: 34,
                  }}
                >
                  {isDark ? <LightModeIcon sx={{ fontSize: 16 }} /> : <DarkModeIcon sx={{ fontSize: 16 }} />}
                </IconButton>
              </Tooltip>
              <IconButton
                onClick={() => setDrawerOpen(true)}
                sx={{
                  color: goldColor,
                  border: `1px solid ${isDark ? 'rgba(201,168,76,0.3)' : 'rgba(159,122,45,0.3)'}`,
                  borderRadius: 1.5,
                  width: 34,
                  height: 34,
                }}
              >
                <MenuIcon sx={{ fontSize: 20 }} />
              </IconButton>
            </Box>
          )}
        </Toolbar>
      </AppBar>

      {/* Mobile Drawer */}
      <Drawer
        anchor="right"
        open={drawerOpen}
        onClose={() => setDrawerOpen(false)}
        slotProps={{
          paper: {
            sx: {
              width: { xs: 260, sm: 300 },
              background: isDark ? 'rgba(10,10,15,0.98)' : 'rgba(248,246,240,0.98)',
              backdropFilter: 'blur(20px)',
              borderLeft: isDark
                ? `1px solid rgba(201,168,76,0.2)`
                : `1px solid rgba(159,122,45,0.2)`,
            },
          },
        }}
      >
        <Box sx={{ p: 2, display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
            <Box
              component="img"
              src="/logo-palatria.webp"
              alt="PALATRIA"
              sx={{ width: 36, height: 36, objectFit: 'contain' }}
            />
            <Typography
              sx={{
                fontFamily: '"Montserrat", sans-serif',
                fontWeight: 900,
                fontSize: '1rem',
                background: `linear-gradient(135deg, ${goldColor}, ${goldColorLight})`,
                backgroundClip: 'text',
                WebkitBackgroundClip: 'text',
                WebkitTextFillColor: 'transparent',
              }}
            >
              SKYGARAGE
            </Typography>
          </Box>
          <Box sx={{ display: 'flex', gap: 0.5 }}>
            <IconButton onClick={toggleMode} size="small" sx={{ color: goldColor }}>
              {isDark ? <LightModeIcon sx={{ fontSize: 18 }} /> : <DarkModeIcon sx={{ fontSize: 18 }} />}
            </IconButton>
            <IconButton onClick={() => setDrawerOpen(false)} sx={{ color: isDark ? COLORS.SILVER : 'text.secondary' }}>
              <CloseIcon />
            </IconButton>
          </Box>
        </Box>
        <Divider />
        <List sx={{ pt: 2 }}>
          {navItems.map((item) => (
            <ListItem key={item.label} disablePadding>
              <ListItemButton
                onClick={() => handleNavClick(item.href)}
                sx={{
                  px: 3,
                  py: 1.5,
                  borderLeft: activeSection === item.href.replace('#', '')
                    ? `3px solid ${goldColor}`
                    : '3px solid transparent',
                  '&:hover': {
                    bgcolor: isDark ? 'rgba(201,168,76,0.08)' : 'rgba(159,122,45,0.06)',
                  },
                }}
              >
                <ListItemText
                  primary={item.label}
                  slotProps={{
                    primary: {
                      sx: {
                        fontWeight: activeSection === item.href.replace('#', '') ? 700 : 400,
                        color: activeSection === item.href.replace('#', '') ? goldColor : 'text.primary',
                        fontSize: '0.9375rem',
                      },
                    },
                  }}
                />
              </ListItemButton>
            </ListItem>
          ))}
          <ListItem sx={{ px: 3, pt: 2 }}>
            <Button
              variant="contained"
              fullWidth
              onClick={() => handleNavClick('#contact')}
              sx={{ py: 1.5 }}
            >
              도입 문의하기
            </Button>
          </ListItem>
          <ListItem sx={{ px: 3, pt: 1 }}>
            <Button
              variant="outlined"
              fullWidth
              startIcon={<AdminPanelSettingsIcon />}
              onClick={() => { setDrawerOpen(false); navigate('/admin'); }}
              sx={{
                py: 1,
                borderColor: isDark ? 'rgba(255,255,255,0.15)' : 'rgba(0,0,0,0.15)',
                color: isDark ? COLORS.SILVER : 'text.secondary',
                fontSize: '0.875rem',
                '&:hover': {
                  borderColor: isDark ? 'rgba(0,212,255,0.4)' : 'rgba(159,122,45,0.4)',
                  color: isDark ? '#00d4ff' : 'primary.main',
                },
              }}
            >
              관리자 페이지
            </Button>
          </ListItem>
        </List>
      </Drawer>
    </>
  );
}
