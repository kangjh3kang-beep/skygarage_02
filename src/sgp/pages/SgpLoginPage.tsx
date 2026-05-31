import { useState } from 'react';
import Box from '@mui/material/Box';
import TextField from '@mui/material/TextField';
import Button from '@mui/material/Button';
import Typography from '@mui/material/Typography';
import Alert from '@mui/material/Alert';
import InputAdornment from '@mui/material/InputAdornment';
import PhoneIcon from '@mui/icons-material/Phone';
import LockIcon from '@mui/icons-material/Lock';
import PersonIcon from '@mui/icons-material/Person';
import { useSgpAuth } from '../contexts/SgpAuthContext';

export default function SgpLoginPage() {
  const { signIn, signUp } = useSgpAuth();
  const [mode, setMode] = useState<'login' | 'register'>('login');
  const [phone, setPhone] = useState('');
  const [password, setPassword] = useState('');
  const [displayName, setDisplayName] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const formatPhone = (value: string) => {
    const digits = value.replace(/[^0-9]/g, '');
    if (digits.length <= 3) return digits;
    if (digits.length <= 7) return `${digits.slice(0, 3)}-${digits.slice(3)}`;
    return `${digits.slice(0, 3)}-${digits.slice(3, 7)}-${digits.slice(7, 11)}`;
  };

  const handlePhoneChange = (value: string) => {
    setPhone(formatPhone(value));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    const cleanPhone = phone.replace(/[^0-9]/g, '');
    if (cleanPhone.length < 10) {
      setError('올바른 전화번호를 입력하세요.');
      return;
    }
    if (password.length < 6) {
      setError('비밀번호는 6자 이상이어야 합니다.');
      return;
    }

    setLoading(true);
    if (mode === 'login') {
      const result = await signIn(cleanPhone, password);
      if (result.error) setError(result.error);
    } else {
      if (!displayName.trim()) {
        setError('이름을 입력하세요.');
        setLoading(false);
        return;
      }
      const result = await signUp(cleanPhone, password, displayName.trim());
      if (result.error) setError(result.error);
    }
    setLoading(false);
  };

  return (
    <Box sx={{
      minHeight: '100vh',
      bgcolor: '#0d1b2a',
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      justifyContent: 'center',
      px: 3,
    }}>
      <Box sx={{ textAlign: 'center', mb: 4 }}>
        <Box
          component="img"
          src="/logo01.png"
          alt="SGP"
          sx={{ width: 64, height: 64, mb: 2 }}
        />
        <Typography variant="h5" sx={{ color: '#fff', fontWeight: 700 }}>
          SGP App
        </Typography>
        <Typography variant="body2" sx={{ color: 'rgba(255,255,255,0.6)', mt: 0.5 }}>
          SkyGarage 스마트 주차 결제
        </Typography>
      </Box>

      <Box
        component="form"
        onSubmit={handleSubmit}
        sx={{
          width: '100%',
          maxWidth: 360,
          bgcolor: 'rgba(255,255,255,0.05)',
          borderRadius: 3,
          p: 3,
          border: '1px solid rgba(255,255,255,0.1)',
        }}
      >
        <Typography variant="h6" sx={{ color: '#fff', mb: 2, textAlign: 'center' }}>
          {mode === 'login' ? '로그인' : '회원가입'}
        </Typography>

        {error && <Alert severity="error" sx={{ mb: 2, fontSize: '0.8rem' }}>{error}</Alert>}

        <TextField
          label="전화번호"
          value={phone}
          onChange={e => handlePhoneChange(e.target.value)}
          fullWidth
          size="small"
          placeholder="010-1234-5678"
          sx={{ mb: 2, '& .MuiInputBase-root': { bgcolor: 'rgba(255,255,255,0.05)' }, '& input': { color: '#fff' } }}
          slotProps={{
            input: {
              startAdornment: (
                <InputAdornment position="start">
                  <PhoneIcon sx={{ fontSize: 18, color: 'rgba(255,255,255,0.5)' }} />
                </InputAdornment>
              ),
            },
            inputLabel: { sx: { color: 'rgba(255,255,255,0.7)' } },
          }}
        />

        {mode === 'register' && (
          <TextField
            label="이름"
            value={displayName}
            onChange={e => setDisplayName(e.target.value)}
            fullWidth
            size="small"
            placeholder="홍길동"
            sx={{ mb: 2, '& .MuiInputBase-root': { bgcolor: 'rgba(255,255,255,0.05)' }, '& input': { color: '#fff' } }}
            slotProps={{
              input: {
                startAdornment: (
                  <InputAdornment position="start">
                    <PersonIcon sx={{ fontSize: 18, color: 'rgba(255,255,255,0.5)' }} />
                  </InputAdornment>
                ),
              },
              inputLabel: { sx: { color: 'rgba(255,255,255,0.7)' } },
            }}
          />
        )}

        <TextField
          label="비밀번호"
          type="password"
          value={password}
          onChange={e => setPassword(e.target.value)}
          fullWidth
          size="small"
          placeholder="6자 이상"
          sx={{ mb: 3, '& .MuiInputBase-root': { bgcolor: 'rgba(255,255,255,0.05)' }, '& input': { color: '#fff' } }}
          slotProps={{
            input: {
              startAdornment: (
                <InputAdornment position="start">
                  <LockIcon sx={{ fontSize: 18, color: 'rgba(255,255,255,0.5)' }} />
                </InputAdornment>
              ),
            },
            inputLabel: { sx: { color: 'rgba(255,255,255,0.7)' } },
          }}
        />

        <Button
          type="submit"
          variant="contained"
          fullWidth
          disabled={loading}
          sx={{
            py: 1.2,
            fontWeight: 700,
            bgcolor: '#00d4aa',
            color: '#0d1b2a',
            '&:hover': { bgcolor: '#00b894' },
          }}
        >
          {loading ? '처리중...' : mode === 'login' ? '로그인' : '가입하기'}
        </Button>

        <Box sx={{ textAlign: 'center', mt: 2 }}>
          <Button
            size="small"
            onClick={() => { setMode(mode === 'login' ? 'register' : 'login'); setError(''); }}
            sx={{ color: 'rgba(255,255,255,0.6)', fontSize: '0.8rem' }}
          >
            {mode === 'login' ? '계정이 없으신가요? 회원가입' : '이미 계정이 있으신가요? 로그인'}
          </Button>
        </Box>
      </Box>
    </Box>
  );
}
