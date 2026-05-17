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
      primary: { main: isDark ? '#00d4ff' : '#0284c7' },
      secondary: { main: '#c9a84c' },
      success: { main: isDark ? '#00e676' : '#16a34a' },
      warning: { main: isDark ? '#ffc107' : '#d97706' },
      error: { main: isDark ? '#ff5252' : '#dc2626' },
      background: isDark
        ? { default: '#0a0e1a', paper: '#111827' }
        : { default: '#f1f5f9', paper: '#ffffff' },
      text: isDark
        ? { primary: '#e8ecf4', secondary: '#8892a8' }
        : { primary: '#1e293b', secondary: '#64748b' },
      divider: isDark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.08)',
    },
    typography: {
      fontFamily: '"Roboto", "Noto Sans KR", sans-serif',
      h1: { fontSize: '1.5rem', fontWeight: 800 },
      h2: { fontSize: '1.25rem', fontWeight: 700 },
      h3: { fontSize: '1rem', fontWeight: 700 },
      subtitle1: { fontSize: '0.875rem', fontWeight: 600 },
      subtitle2: { fontSize: '0.8125rem', fontWeight: 600 },
      body1: { fontSize: '0.875rem' },
      body2: { fontSize: '0.8125rem' },
      caption: { fontSize: '0.75rem' },
    },
    shape: { borderRadius: 12 },
    components: {
      MuiCard: {
        styleOverrides: {
          root: {
            backgroundImage: 'none',
            border: isDark ? '1px solid rgba(255,255,255,0.06)' : '1px solid rgba(0,0,0,0.08)',
          },
        },
      },
      MuiButton: {
        styleOverrides: {
          root: { textTransform: 'none', fontWeight: 700, borderRadius: 8 },
        },
      },
      MuiChip: {
        styleOverrides: { root: { fontWeight: 600 } },
      },
      MuiTableCell: {
        styleOverrides: {
          root: { borderColor: isDark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.08)' },
          head: { fontWeight: 700, fontSize: '0.75rem', color: isDark ? '#8892a8' : '#64748b' },
        },
      },
      MuiDrawer: {
        styleOverrides: {
          paper: {
            backgroundImage: 'none',
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
