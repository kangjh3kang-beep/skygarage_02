import Box from '@mui/material/Box';
import Typography from '@mui/material/Typography';
import Button from '@mui/material/Button';
import SentimentDissatisfiedIcon from '@mui/icons-material/SentimentDissatisfied';
import { useNavigate } from 'react-router-dom';

export default function NotFoundPage() {
  const navigate = useNavigate();

  return (
    <Box sx={{ textAlign: 'center', py: 8, px: 3 }}>
      <SentimentDissatisfiedIcon sx={{ fontSize: 64, color: 'text.disabled', mb: 2 }} />
      <Typography variant="h4" sx={{ fontWeight: 800, mb: 1 }}>404</Typography>
      <Typography variant="body1" color="text.secondary" sx={{ mb: 3 }}>
        요청하신 페이지를 찾을 수 없습니다.
      </Typography>
      <Button variant="contained" onClick={() => navigate('/tracking')}>
        대시보드로 이동
      </Button>
    </Box>
  );
}
