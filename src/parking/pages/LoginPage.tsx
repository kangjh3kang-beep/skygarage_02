import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import Box from '@mui/material/Box';
import Card from '@mui/material/Card';
import CardContent from '@mui/material/CardContent';
import Typography from '@mui/material/Typography';
import TextField from '@mui/material/TextField';
import Button from '@mui/material/Button';
import Alert from '@mui/material/Alert';
import Divider from '@mui/material/Divider';
import CircularProgress from '@mui/material/CircularProgress';
import DirectionsCarIcon from '@mui/icons-material/DirectionsCar';
import { useParkingAuth } from '../contexts/ParkingAuthContext';

export default function LoginPage() {
  const navigate = useNavigate();
  const { signIn } = useParkingAuth();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email || !password) return;
    setLoading(true);
    setError('');
    const { error: err } = await signIn(email, password);
    if (err) {
      setError(err);
    }
    setLoading(false);
  };

  return (
    <Box sx={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', p: 2, bgcolor: 'background.default' }}>
      <Card sx={{ width: '100%', maxWidth: 400 }}>
        <CardContent sx={{ p: 4 }}>
          <Box sx={{ textAlign: 'center', mb: 3 }}>
            <DirectionsCarIcon sx={{ fontSize: 48, color: 'primary.main', mb: 1 }} />
            <Typography variant="h5" sx={{ fontWeight: 800 }}>SkyGarage</Typography>
            <Typography variant="body2" sx={{ color: 'text.secondary' }}>스마트 주차 관리</Typography>
          </Box>

          <form onSubmit={handleSubmit}>
            <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
              <TextField
                label="이메일"
                type="email"
                value={email}
                onChange={e => setEmail(e.target.value)}
                fullWidth
                autoFocus
              />
              <TextField
                label="비밀번호"
                type="password"
                value={password}
                onChange={e => setPassword(e.target.value)}
                fullWidth
              />
              {error && <Alert severity="error">{error}</Alert>}
              <Button
                type="submit"
                variant="contained"
                fullWidth
                disabled={loading || !email || !password}
                sx={{ py: 1.5 }}
              >
                {loading ? <CircularProgress size={24} /> : '로그인'}
              </Button>
            </Box>
          </form>

          <Divider sx={{ my: 3 }} />

          <Button
            fullWidth
            variant="outlined"
            onClick={() => navigate('/visitor')}
            sx={{ py: 1.2 }}
          >
            방문자 서비스 이용
          </Button>
        </CardContent>
      </Card>
    </Box>
  );
}
