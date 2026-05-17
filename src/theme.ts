import { createTheme } from '@mui/material/styles';

export const COLORS = {
  GOLD: '#c9a84c',
  GOLD_LIGHT: '#e8c96a',
  GOLD_DARK: '#9e7f30',
  TECH_BLUE: '#3b82f6',
  SILVER: '#a8b2c1',
  BG_PRIMARY: '#0a0a0f',
  BG_SECONDARY: '#111827',
  BG_ELEVATED: '#1a2236',
  LIGHT_BG_PRIMARY: '#f8f6f0',
};

const theme = createTheme({
  palette: {
    mode: 'dark',
    primary: { main: '#00d4ff' },
    secondary: { main: '#c9a84c' },
    success: { main: '#00e676' },
    warning: { main: '#ffc107' },
    error: { main: '#ff5252' },
    background: {
      default: '#0a0e1a',
      paper: '#111827',
    },
    text: {
      primary: '#e8ecf4',
      secondary: '#8892a8',
    },
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
          border: '1px solid rgba(255,255,255,0.06)',
        },
      },
    },
    MuiButton: {
      styleOverrides: {
        root: { textTransform: 'none', fontWeight: 700, borderRadius: 8 },
      },
    },
    MuiChip: {
      styleOverrides: {
        root: { fontWeight: 600 },
      },
    },
    MuiTableCell: {
      styleOverrides: {
        root: { borderColor: 'rgba(255,255,255,0.06)' },
        head: { fontWeight: 700, fontSize: '0.75rem', color: '#8892a8' },
      },
    },
  },
});

export default theme;
