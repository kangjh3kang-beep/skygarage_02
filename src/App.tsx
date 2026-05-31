import { lazy, Suspense } from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { ThemeProvider, createTheme } from '@mui/material/styles';
import CssBaseline from '@mui/material/CssBaseline';
import Box from '@mui/material/Box';
import CircularProgress from '@mui/material/CircularProgress';
import AdminLayout from './admin/AdminLayout';

const HardwareIntegration = lazy(() => import('./admin/pages/HardwareIntegration'));

const theme = createTheme({
  palette: {
    mode: 'dark',
    primary: { main: '#0ea5e9' },
    background: { default: '#0f1117', paper: '#1a1d27' },
  },
  typography: {
    fontFamily: '"Inter", "Pretendard", -apple-system, sans-serif',
  },
  shape: { borderRadius: 8 },
});

function LoadingFallback() {
  return (
    <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '60vh' }}>
      <CircularProgress size={32} />
    </Box>
  );
}

function PlaceholderPage({ title }: { title: string }) {
  return (
    <Box sx={{ textAlign: 'center', py: 8 }}>
      <Box sx={{ fontSize: '0.85rem', color: 'text.secondary' }}>{title} 페이지 준비 중</Box>
    </Box>
  );
}

export default function App() {
  return (
    <ThemeProvider theme={theme}>
      <CssBaseline />
      <BrowserRouter>
        <Suspense fallback={<LoadingFallback />}>
          <Routes>
            <Route path="/admin" element={<AdminLayout />}>
              <Route index element={<PlaceholderPage title="대시보드" />} />
              <Route path="hardware" element={<HardwareIntegration />} />
              <Route path="atr" element={<PlaceholderPage title="ATR 로봇" />} />
              <Route path="elevators" element={<PlaceholderPage title="차량 엘리베이터" />} />
              <Route path="parking" element={<PlaceholderPage title="주차 운영" />} />
              <Route path="energy" element={<PlaceholderPage title="에너지/충전" />} />
              <Route path="settlement" element={<PlaceholderPage title="정산 관리" />} />
              <Route path="settings" element={<PlaceholderPage title="설정" />} />
            </Route>
            <Route path="*" element={<Navigate to="/admin/hardware" replace />} />
          </Routes>
        </Suspense>
      </BrowserRouter>
    </ThemeProvider>
  );
}
