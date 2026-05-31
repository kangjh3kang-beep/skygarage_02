import { createContext, useContext, useState, useMemo, useCallback, useEffect, type ReactNode } from 'react';
import { createTheme, type Theme } from '@mui/material/styles';

type AdminThemeMode = 'dark' | 'light';

interface AdminThemeContextType {
  mode: AdminThemeMode;
  toggleMode: () => void;
  theme: Theme;
}

const AdminThemeContext = createContext<AdminThemeContextType | null>(null);

const STORAGE_KEY = 'skygarage-admin-theme-mode';

function getAdminTheme(mode: AdminThemeMode): Theme {
  const isDark = mode === 'dark';
  return createTheme({
    palette: {
      mode,
      primary: { main: isDark ? '#0ea5e9' : '#0284c7', light: '#38bdf8', dark: '#0369a1' },
      secondary: { main: isDark ? '#06b6d4' : '#0891b2' },
      success: { main: isDark ? '#10b981' : '#059669' },
      warning: { main: isDark ? '#f59e0b' : '#d97706' },
      error: { main: isDark ? '#ef4444' : '#dc2626' },
      info: { main: isDark ? '#6366f1' : '#4f46e5' },
      background: isDark
        ? { default: '#080c14', paper: '#0f1520' }
        : { default: '#f8fafc', paper: '#ffffff' },
      text: isDark
        ? { primary: '#f1f5f9', secondary: '#94a3b8' }
        : { primary: '#0f172a', secondary: '#64748b' },
      divider: isDark ? 'rgba(148,163,184,0.08)' : 'rgba(15,23,42,0.08)',
    },
    typography: {
      fontFamily: '"Inter", "Roboto", "Noto Sans KR", -apple-system, sans-serif',
      h1: { fontSize: '1.5rem', fontWeight: 700, letterSpacing: '-0.025em', lineHeight: 1.2 },
      h2: { fontSize: '1.25rem', fontWeight: 700, letterSpacing: '-0.02em', lineHeight: 1.3 },
      h3: { fontSize: '1.0625rem', fontWeight: 600, letterSpacing: '-0.015em' },
      subtitle1: { fontSize: '0.875rem', fontWeight: 600, letterSpacing: '-0.01em' },
      subtitle2: { fontSize: '0.8125rem', fontWeight: 600 },
      body1: { fontSize: '0.875rem', lineHeight: 1.6 },
      body2: { fontSize: '0.8125rem', lineHeight: 1.5 },
      caption: { fontSize: '0.72rem', letterSpacing: '0.01em' },
    },
    shape: { borderRadius: 10 },
    components: {
      MuiCssBaseline: {
        styleOverrides: {
          body: {
            scrollbarWidth: 'thin',
            '&::-webkit-scrollbar': { width: 6 },
            '&::-webkit-scrollbar-thumb': {
              borderRadius: 3,
              backgroundColor: isDark ? 'rgba(148,163,184,0.15)' : 'rgba(0,0,0,0.12)',
            },
          },
        },
      },
      MuiCard: {
        styleOverrides: {
          root: {
            backgroundImage: 'none',
            border: isDark ? '1px solid rgba(148,163,184,0.08)' : '1px solid rgba(0,0,0,0.06)',
            boxShadow: isDark ? '0 1px 3px rgba(0,0,0,0.3)' : '0 1px 3px rgba(0,0,0,0.06)',
            transition: 'border-color 0.2s ease, box-shadow 0.2s ease',
            '&:hover': {
              borderColor: isDark ? 'rgba(148,163,184,0.15)' : 'rgba(0,0,0,0.12)',
              boxShadow: isDark ? '0 4px 12px rgba(0,0,0,0.4)' : '0 4px 12px rgba(0,0,0,0.08)',
            },
          },
        },
      },
      MuiButton: {
        styleOverrides: {
          root: {
            textTransform: 'none',
            fontWeight: 600,
            borderRadius: 8,
            transition: 'all 0.15s ease',
          },
          contained: {
            boxShadow: 'none',
            '&:hover': { boxShadow: '0 2px 8px rgba(0,0,0,0.15)' },
          },
        },
      },
      MuiChip: {
        styleOverrides: {
          root: { fontWeight: 600, borderRadius: 6 },
        },
      },
      MuiTableCell: {
        styleOverrides: {
          root: { borderColor: isDark ? 'rgba(148,163,184,0.06)' : 'rgba(0,0,0,0.06)' },
          head: { fontWeight: 600, fontSize: '0.72rem', letterSpacing: '0.02em', textTransform: 'uppercase', color: isDark ? '#94a3b8' : '#64748b' },
        },
      },
      MuiDrawer: {
        styleOverrides: {
          paper: { backgroundImage: 'none' },
        },
      },
      MuiTooltip: {
        styleOverrides: {
          tooltip: {
            fontSize: '0.72rem',
            fontWeight: 500,
            borderRadius: 6,
            backgroundColor: isDark ? '#1e293b' : '#0f172a',
            padding: '6px 12px',
          },
        },
      },
      MuiDialog: {
        styleOverrides: {
          paper: {
            backgroundImage: 'none',
            borderRadius: 16,
            border: isDark ? '1px solid rgba(148,163,184,0.1)' : '1px solid rgba(0,0,0,0.08)',
          },
        },
      },
    },
  });
}

export function AdminThemeProvider({ children }: { children: ReactNode }) {
  const [mode, setMode] = useState<AdminThemeMode>(() => {
    const stored = localStorage.getItem(STORAGE_KEY);
    return (stored === 'light' || stored === 'dark') ? stored : 'dark';
  });

  useEffect(() => {
    localStorage.setItem(STORAGE_KEY, mode);
  }, [mode]);

  const toggleMode = useCallback(() => {
    setMode(prev => prev === 'dark' ? 'light' : 'dark');
  }, []);

  const theme = useMemo(() => getAdminTheme(mode), [mode]);

  const value = useMemo(() => ({ mode, toggleMode, theme }), [mode, toggleMode, theme]);

  return (
    <AdminThemeContext.Provider value={value}>
      {children}
    </AdminThemeContext.Provider>
  );
}

export function useAdminTheme() {
  const ctx = useContext(AdminThemeContext);
  if (!ctx) throw new Error('useAdminTheme must be used within AdminThemeProvider');
  return ctx;
}
