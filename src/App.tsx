import { lazy, Suspense, useMemo } from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { ThemeProvider, createTheme } from '@mui/material/styles';
import CssBaseline from '@mui/material/CssBaseline';
import Box from '@mui/material/Box';
import CircularProgress from '@mui/material/CircularProgress';
import { AdminThemeProvider, useAdminTheme } from './admin/contexts/ThemeContext';
import { AuthProvider } from './admin/contexts/AuthContext';
import { TenantProvider } from './admin/contexts/TenantContext';
import { ToastProvider } from './admin/contexts/ToastContext';
import AdminLayout from './admin/AdminLayout';

const HardwareIntegration = lazy(() => import('./admin/pages/HardwareIntegration'));
const Dashboard = lazy(() => import('./admin/pages/Dashboard'));

function LoadingFallback() {
  return (
    <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '60vh' }}>
      <CircularProgress size={32} />
    </Box>
  );
}

function PlaceholderPage({ title }: { title: string }) {
  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', py: 10, color: 'text.secondary' }}>
      <Box sx={{ fontSize: '2rem', mb: 2, opacity: 0.3 }}>--</Box>
      <Box sx={{ fontSize: '0.9rem', fontWeight: 600 }}>{title}</Box>
      <Box sx={{ fontSize: '0.75rem', mt: 0.5, opacity: 0.6 }}>페이지 준비 중</Box>
    </Box>
  );
}

function ThemedApp() {
  const { mode } = useAdminTheme();

  const theme = useMemo(() => createTheme({
    palette: {
      mode,
      primary: { main: '#0ea5e9' },
      ...(mode === 'dark' ? {
        background: { default: '#0f1117', paper: '#1a1d27' },
      } : {
        background: { default: '#f5f7fa', paper: '#ffffff' },
      }),
    },
    typography: {
      fontFamily: '"Inter", "Pretendard", -apple-system, sans-serif',
    },
    shape: { borderRadius: 8 },
    components: {
      MuiButton: { styleOverrides: { root: { textTransform: 'none', fontWeight: 600 } } },
      MuiChip: { styleOverrides: { root: { fontWeight: 600 } } },
      MuiTableCell: { styleOverrides: { head: { fontWeight: 700, fontSize: '0.75rem' } } },
    },
  }), [mode]);

  return (
    <ThemeProvider theme={theme}>
      <CssBaseline />
      <AuthProvider>
        <TenantProvider>
          <ToastProvider>
            <BrowserRouter>
              <Suspense fallback={<LoadingFallback />}>
                <Routes>
                  <Route path="/admin" element={<AdminLayout />}>
                    <Route index element={<Dashboard />} />
                    <Route path="complexes" element={<PlaceholderPage title="단지 관리" />} />
                    <Route path="parking" element={<PlaceholderPage title="주차 운영" />} />
                    <Route path="atr" element={<PlaceholderPage title="ATR 로봇" />} />
                    <Route path="elevators" element={<PlaceholderPage title="차량 엘리베이터" />} />
                    <Route path="hardware" element={<HardwareIntegration />} />
                    <Route path="energy" element={<PlaceholderPage title="에너지/V2G" />} />
                    <Route path="maintenance" element={<PlaceholderPage title="정비" />} />
                    <Route path="residents" element={<PlaceholderPage title="사용자" />} />
                    <Route path="settlement" element={<PlaceholderPage title="정산 관리" />} />
                    <Route path="billing" element={<PlaceholderPage title="청구/인보이스" />} />
                    <Route path="contracts" element={<PlaceholderPage title="계약/파트너" />} />
                    <Route path="crm" element={<PlaceholderPage title="CRM" />} />
                    <Route path="analytics" element={<PlaceholderPage title="분석" />} />
                    <Route path="security" element={<PlaceholderPage title="보안 감사" />} />
                    <Route path="alerts" element={<PlaceholderPage title="알림" />} />
                    <Route path="settings" element={<PlaceholderPage title="설정" />} />
                  </Route>
                  <Route path="*" element={<Navigate to="/admin" replace />} />
                </Routes>
              </Suspense>
            </BrowserRouter>
          </ToastProvider>
        </TenantProvider>
      </AuthProvider>
    </ThemeProvider>
  );
}

export default function App() {
  return (
    <AdminThemeProvider>
      <ThemedApp />
    </AdminThemeProvider>
  );
}
