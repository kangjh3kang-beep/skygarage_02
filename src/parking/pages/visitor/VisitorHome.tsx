import { useNavigate } from 'react-router-dom';
import Box from '@mui/material/Box';
import Card from '@mui/material/Card';
import CardContent from '@mui/material/CardContent';
import Typography from '@mui/material/Typography';
import CardActionArea from '@mui/material/CardActionArea';
import LoginIcon from '@mui/icons-material/Login';
import LocalParkingIcon from '@mui/icons-material/LocalParking';
import EvStationIcon from '@mui/icons-material/EvStation';
import ExitToAppIcon from '@mui/icons-material/ExitToApp';

const MENU_ITEMS = [
  {
    label: '입차 등록',
    description: '사전 등록된 차량번호로 입차 진행',
    icon: <LoginIcon sx={{ fontSize: 32 }} />,
    path: '/visitor/entry',
    color: '#3b82f6',
  },
  {
    label: '주차 현황',
    description: '잔여 무료 주차 시간 및 위치 확인',
    icon: <LocalParkingIcon sx={{ fontSize: 32 }} />,
    path: '/visitor/status',
    color: '#22c55e',
  },
  {
    label: '전기차 충전',
    description: '충전 신청 및 현황 모니터링',
    icon: <EvStationIcon sx={{ fontSize: 32 }} />,
    path: '/visitor/ev',
    color: '#f59e0b',
  },
  {
    label: '출차 및 정산',
    description: '출차 처리 및 요금 정산',
    icon: <ExitToAppIcon sx={{ fontSize: 32 }} />,
    path: '/visitor/checkout',
    color: '#ef4444',
  },
];

export default function VisitorHome() {
  const navigate = useNavigate();

  return (
    <Box sx={{ p: 2, maxWidth: 500, mx: 'auto', mt: 4 }}>
      <Box sx={{ textAlign: 'center', mb: 4 }}>
        <Typography variant="h4" sx={{ fontWeight: 800, mb: 0.5 }}>
          SkyGarage
        </Typography>
        <Typography variant="body1" sx={{ color: 'text.secondary' }}>
          방문 차량 서비스
        </Typography>
      </Box>

      <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
        {MENU_ITEMS.map(item => (
          <Card key={item.path} sx={{ transition: 'transform 0.15s', '&:hover': { transform: 'translateY(-2px)' } }}>
            <CardActionArea onClick={() => navigate(item.path)}>
              <CardContent sx={{ display: 'flex', alignItems: 'center', gap: 2, py: 2.5 }}>
                <Box sx={{
                  width: 56, height: 56, borderRadius: 2,
                  bgcolor: item.color, display: 'flex',
                  alignItems: 'center', justifyContent: 'center', color: '#fff',
                }}>
                  {item.icon}
                </Box>
                <Box>
                  <Typography variant="subtitle1" sx={{ fontWeight: 700 }}>{item.label}</Typography>
                  <Typography variant="caption" sx={{ color: 'text.secondary' }}>{item.description}</Typography>
                </Box>
              </CardContent>
            </CardActionArea>
          </Card>
        ))}
      </Box>
    </Box>
  );
}
