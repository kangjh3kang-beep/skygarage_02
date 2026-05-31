import { useNavigate } from 'react-router-dom';
import Box from '@mui/material/Box';
import Card from '@mui/material/Card';
import CardContent from '@mui/material/CardContent';
import Typography from '@mui/material/Typography';
import CardActionArea from '@mui/material/CardActionArea';
import Button from '@mui/material/Button';
import LoginIcon from '@mui/icons-material/Login';
import LocalParkingIcon from '@mui/icons-material/LocalParking';
import EvStationIcon from '@mui/icons-material/EvStation';
import ExitToAppIcon from '@mui/icons-material/ExitToApp';
import ArrowBackIcon from '@mui/icons-material/ArrowBack';

const MENU_ITEMS = [
  {
    label: '입차 등록',
    description: '사전 등록된 차량번호로 입차 진행',
    icon: <LoginIcon sx={{ fontSize: 28 }} />,
    path: '/visitor/entry',
    color: '#1976d2',
  },
  {
    label: '주차 현황',
    description: '잔여 무료 주차 시간 및 위치 확인',
    icon: <LocalParkingIcon sx={{ fontSize: 28 }} />,
    path: '/visitor/status',
    color: '#2e7d32',
  },
  {
    label: '전기차 충전',
    description: '충전 신청 및 현황 모니터링',
    icon: <EvStationIcon sx={{ fontSize: 28 }} />,
    path: '/visitor/ev',
    color: '#ed6c02',
  },
  {
    label: '출차 및 정산',
    description: '출차 처리 및 요금 정산',
    icon: <ExitToAppIcon sx={{ fontSize: 28 }} />,
    path: '/visitor/checkout',
    color: '#d32f2f',
  },
];

export default function VisitorHome() {
  const navigate = useNavigate();

  return (
    <Box sx={{ p: 2.5, maxWidth: 480, mx: 'auto', minHeight: '100vh', bgcolor: 'background.default' }}>
      {/* Header */}
      <Box sx={{ display: 'flex', alignItems: 'center', mb: 4, mt: 2 }}>
        <Button
          size="small"
          startIcon={<ArrowBackIcon />}
          onClick={() => navigate('/')}
          sx={{ color: 'text.secondary', fontSize: '0.75rem' }}
        >
          메인
        </Button>
      </Box>

      <Box sx={{ textAlign: 'center', mb: 4 }}>
        <Typography variant="h5" sx={{ fontWeight: 800, mb: 0.5, letterSpacing: -0.5 }}>
          SkyGarage
        </Typography>
        <Typography variant="body2" sx={{ color: 'text.secondary' }}>
          방문 차량 서비스
        </Typography>
      </Box>

      <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1.5 }}>
        {MENU_ITEMS.map(item => (
          <Card
            key={item.path}
            sx={{
              border: '1px solid',
              borderColor: 'divider',
              transition: 'all 0.2s ease',
              '&:hover': { transform: 'translateY(-1px)', borderColor: 'primary.main', boxShadow: '0 4px 12px rgba(0,0,0,0.12)' },
            }}
          >
            <CardActionArea onClick={() => navigate(item.path)}>
              <CardContent sx={{ display: 'flex', alignItems: 'center', gap: 2, py: 2, '&:last-child': { pb: 2 } }}>
                <Box sx={{
                  width: 48, height: 48, borderRadius: '12px',
                  bgcolor: item.color, display: 'flex',
                  alignItems: 'center', justifyContent: 'center', color: '#fff', flexShrink: 0,
                }}>
                  {item.icon}
                </Box>
                <Box>
                  <Typography variant="body1" sx={{ fontWeight: 700 }}>{item.label}</Typography>
                  <Typography variant="caption" sx={{ color: 'text.secondary', lineHeight: 1.3 }}>{item.description}</Typography>
                </Box>
              </CardContent>
            </CardActionArea>
          </Card>
        ))}
      </Box>

      <Typography variant="caption" sx={{ color: 'text.disabled', textAlign: 'center', display: 'block', mt: 4 }}>
        입주민 전용 서비스는 로그인이 필요합니다
      </Typography>
      <Button
        variant="text"
        size="small"
        onClick={() => navigate('/app')}
        sx={{ display: 'block', mx: 'auto', mt: 0.5, fontSize: '0.75rem', color: 'text.secondary' }}
      >
        입주민 로그인
      </Button>
    </Box>
  );
}
