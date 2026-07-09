import Box from '@mui/material/Box';
import Typography from '@mui/material/Typography';
import Button from '@mui/material/Button';
import PhoneIphoneIcon from '@mui/icons-material/PhoneIphone';
import DesktopWindowsIcon from '@mui/icons-material/DesktopWindows';
import LanguageIcon from '@mui/icons-material/Language';
import { useNavigate } from 'react-router-dom';

export default function MobileOnlyGate() {
  const navigate = useNavigate();

  return (
    <Box sx={{
      minHeight: '100dvh',
      bgcolor: '#0d1b2a',
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      justifyContent: 'center',
      px: 4,
      textAlign: 'center',
    }}>
      <Box sx={{
        width: 80, height: 80, borderRadius: '20px',
        bgcolor: 'rgba(0,212,170,0.1)',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        mb: 3,
      }}>
        <PhoneIphoneIcon sx={{ fontSize: 40, color: '#00d4aa' }} />
      </Box>
      <Typography variant="h5" sx={{ color: '#fff', fontWeight: 800, mb: 1.5 }}>
        모바일 전용 앱
      </Typography>
      <Typography variant="body1" sx={{ color: 'rgba(255,255,255,0.6)', mb: 4, maxWidth: 300 }}>
        SGP App은 스마트폰에서만 이용할 수 있습니다.<br />
        휴대폰 브라우저에서 접속해 주세요.
      </Typography>
      <Box sx={{
        p: 2.5, borderRadius: 3,
        bgcolor: 'rgba(255,255,255,0.03)',
        border: '1px solid rgba(255,255,255,0.08)',
        maxWidth: 280, width: '100%',
        mb: 3,
      }}>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5, mb: 1.5 }}>
          <DesktopWindowsIcon sx={{ fontSize: 20, color: 'rgba(255,255,255,0.3)' }} />
          <Typography variant="body2" sx={{ color: 'rgba(255,255,255,0.4)' }}>
            현재 PC/태블릿으로 접속중
          </Typography>
        </Box>
        <Typography variant="caption" sx={{ color: 'rgba(255,255,255,0.3)', lineHeight: 1.6 }}>
          QR코드를 스캔하거나 휴대폰 브라우저에서<br />
          동일한 URL을 입력해 접속하세요.
        </Typography>
      </Box>
      <Button
        variant="outlined"
        startIcon={<LanguageIcon />}
        onClick={() => navigate('/')}
        sx={{
          color: '#00d4aa',
          borderColor: 'rgba(0,212,170,0.3)',
          borderRadius: 2,
          px: 3,
          py: 1,
          fontWeight: 700,
          textTransform: 'none',
          '&:hover': {
            borderColor: '#00d4aa',
            bgcolor: 'rgba(0,212,170,0.08)',
          },
        }}
      >
        웹사이트로 이동
      </Button>
    </Box>
  );
}
