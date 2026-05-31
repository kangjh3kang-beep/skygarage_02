import { useState } from 'react';
import Box from '@mui/material/Box';
import TextField from '@mui/material/TextField';
import Button from '@mui/material/Button';
import Typography from '@mui/material/Typography';
import Alert from '@mui/material/Alert';
import InputAdornment from '@mui/material/InputAdornment';
import Stepper from '@mui/material/Stepper';
import Step from '@mui/material/Step';
import StepLabel from '@mui/material/StepLabel';
import LinearProgress from '@mui/material/LinearProgress';
import PhoneIcon from '@mui/icons-material/Phone';
import LockIcon from '@mui/icons-material/Lock';
import PersonIcon from '@mui/icons-material/Person';
import VerifiedIcon from '@mui/icons-material/Verified';
import SmsIcon from '@mui/icons-material/Sms';
import { useSgpAuth } from '../contexts/SgpAuthContext';
import { supabase } from '../../lib/supabase';

const REGISTER_STEPS = ['본인인증', '정보입력'];

export default function SgpLoginPage() {
  const { signIn, signUp } = useSgpAuth();
  const [mode, setMode] = useState<'login' | 'register'>('login');
  const [phone, setPhone] = useState('');
  const [password, setPassword] = useState('');
  const [displayName, setDisplayName] = useState('');
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [loading, setLoading] = useState(false);

  const [registerStep, setRegisterStep] = useState(0);
  const [otpCode, setOtpCode] = useState('');
  const [otpSent, setOtpSent] = useState(false);
  const [otpVerified, setOtpVerified] = useState(false);
  const [verificationId, setVerificationId] = useState('');
  const [otpCooldown, setOtpCooldown] = useState(0);

  const formatPhone = (value: string) => {
    const digits = value.replace(/[^0-9]/g, '');
    if (digits.length <= 3) return digits;
    if (digits.length <= 7) return `${digits.slice(0, 3)}-${digits.slice(3)}`;
    return `${digits.slice(0, 3)}-${digits.slice(3, 7)}-${digits.slice(7, 11)}`;
  };

  const handlePhoneChange = (value: string) => {
    setPhone(formatPhone(value));
    if (otpSent && !otpVerified) {
      setOtpSent(false);
      setOtpCode('');
    }
  };

  const startCooldown = () => {
    setOtpCooldown(180);
    const interval = setInterval(() => {
      setOtpCooldown(prev => {
        if (prev <= 1) { clearInterval(interval); return 0; }
        return prev - 1;
      });
    }, 1000);
  };

  const sendOtp = async () => {
    const cleanPhone = phone.replace(/[^0-9]/g, '');
    if (cleanPhone.length < 10) {
      setError('올바른 전화번호를 입력하세요.');
      return;
    }
    setLoading(true);
    setError('');
    setSuccess('');

    const code = String(Math.floor(100000 + Math.random() * 900000));
    const { data, error: insertError } = await supabase
      .from('sgp_phone_verifications')
      .insert({
        phone: cleanPhone,
        code,
        expires_at: new Date(Date.now() + 3 * 60 * 1000).toISOString(),
      })
      .select('id')
      .single();

    if (insertError) {
      setError('인증코드 발송에 실패했습니다.');
      setLoading(false);
      return;
    }

    setVerificationId(data.id);
    setOtpSent(true);
    setSuccess(`인증코드가 ${phone}로 발송되었습니다.`);
    startCooldown();
    setLoading(false);
  };

  const verifyOtp = async () => {
    if (otpCode.length !== 6) {
      setError('6자리 인증코드를 입력하세요.');
      return;
    }
    setLoading(true);
    setError('');
    setSuccess('');

    const { data, error: fetchError } = await supabase
      .from('sgp_phone_verifications')
      .select('*')
      .eq('id', verificationId)
      .maybeSingle();

    if (fetchError || !data) {
      setError('인증 정보를 찾을 수 없습니다.');
      setLoading(false);
      return;
    }

    if (data.attempts >= 5) {
      setError('시도 횟수 초과. 새 코드를 요청하세요.');
      setOtpSent(false);
      setLoading(false);
      return;
    }

    if (new Date(data.expires_at) < new Date()) {
      setError('인증코드가 만료되었습니다.');
      setOtpSent(false);
      setLoading(false);
      return;
    }

    await supabase
      .from('sgp_phone_verifications')
      .update({ attempts: data.attempts + 1 })
      .eq('id', verificationId);

    if (data.code !== otpCode) {
      setError(`인증코드 불일치 (${4 - data.attempts}회 남음)`);
      setLoading(false);
      return;
    }

    await supabase
      .from('sgp_phone_verifications')
      .update({ verified: true })
      .eq('id', verificationId);

    setOtpVerified(true);
    setRegisterStep(1);
    setSuccess('본인인증 완료');
    setError('');
    setLoading(false);
  };

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    const cleanPhone = phone.replace(/[^0-9]/g, '');
    if (cleanPhone.length < 10) { setError('올바른 전화번호를 입력하세요.'); return; }
    if (password.length < 6) { setError('비밀번호는 6자 이상이어야 합니다.'); return; }
    setLoading(true);
    const result = await signIn(cleanPhone, password);
    if (result.error) setError(result.error);
    setLoading(false);
  };

  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    if (!otpVerified) { setError('전화번호 본인인증을 완료해주세요.'); return; }
    if (!displayName.trim()) { setError('이름을 입력하세요.'); return; }
    if (password.length < 6) { setError('비밀번호는 6자 이상이어야 합니다.'); return; }
    setLoading(true);
    const cleanPhone = phone.replace(/[^0-9]/g, '');
    const result = await signUp(cleanPhone, password, displayName.trim());
    if (result.error) setError(result.error);
    setLoading(false);
  };

  const switchToLogin = () => {
    setMode('login');
    setRegisterStep(0);
    setOtpSent(false);
    setOtpVerified(false);
    setOtpCode('');
    setError('');
    setSuccess('');
  };

  const switchToRegister = () => {
    setMode('register');
    setRegisterStep(0);
    setOtpSent(false);
    setOtpVerified(false);
    setOtpCode('');
    setError('');
    setSuccess('');
  };

  return (
    <Box sx={{
      minHeight: '100dvh',
      bgcolor: '#0d1b2a',
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      justifyContent: 'center',
      px: 2.5,
      py: 4,
    }}>
      <Box sx={{ textAlign: 'center', mb: 3 }}>
        <Box
          component="img"
          src="/logo01.png"
          alt="SGP"
          sx={{ width: 56, height: 56, mb: 1.5, borderRadius: '16px', boxShadow: '0 4px 20px rgba(0,212,170,0.3)' }}
        />
        <Typography variant="h5" sx={{ color: '#fff', fontWeight: 800, letterSpacing: '-0.5px' }}>
          SGP App
        </Typography>
        <Typography variant="caption" sx={{ color: 'rgba(255,255,255,0.5)' }}>
          SkyGarage Parking
        </Typography>
      </Box>

      <Box
        component="form"
        onSubmit={mode === 'login' ? handleLogin : handleRegister}
        sx={{
          width: '100%',
          maxWidth: 360,
          bgcolor: 'rgba(255,255,255,0.04)',
          borderRadius: 4,
          p: 3,
          border: '1px solid rgba(255,255,255,0.08)',
          backdropFilter: 'blur(10px)',
        }}
      >
        {loading && <LinearProgress sx={{ mb: 2, borderRadius: 1, '& .MuiLinearProgress-bar': { bgcolor: '#00d4aa' } }} />}

        {mode === 'login' ? (
          <>
            <Typography variant="subtitle1" sx={{ color: '#fff', fontWeight: 700, mb: 2.5, textAlign: 'center' }}>
              로그인
            </Typography>
            {error && <Alert severity="error" sx={{ mb: 2, fontSize: '0.78rem', py: 0.5 }}>{error}</Alert>}
            <TextField
              label="전화번호"
              value={phone}
              onChange={e => handlePhoneChange(e.target.value)}
              fullWidth size="small"
              placeholder="010-1234-5678"
              sx={{ mb: 2, '& .MuiInputBase-root': { bgcolor: 'rgba(255,255,255,0.05)', borderRadius: 2 }, '& input': { color: '#fff' } }}
              slotProps={{
                input: { startAdornment: <InputAdornment position="start"><PhoneIcon sx={{ fontSize: 18, color: 'rgba(255,255,255,0.4)' }} /></InputAdornment> },
                inputLabel: { sx: { color: 'rgba(255,255,255,0.6)' } },
              }}
            />
            <TextField
              label="비밀번호"
              type="password"
              value={password}
              onChange={e => setPassword(e.target.value)}
              fullWidth size="small"
              sx={{ mb: 3, '& .MuiInputBase-root': { bgcolor: 'rgba(255,255,255,0.05)', borderRadius: 2 }, '& input': { color: '#fff' } }}
              slotProps={{
                input: { startAdornment: <InputAdornment position="start"><LockIcon sx={{ fontSize: 18, color: 'rgba(255,255,255,0.4)' }} /></InputAdornment> },
                inputLabel: { sx: { color: 'rgba(255,255,255,0.6)' } },
              }}
            />
            <Button
              type="submit" variant="contained" fullWidth disabled={loading}
              sx={{ py: 1.3, fontWeight: 700, fontSize: '0.95rem', borderRadius: 2, bgcolor: '#00d4aa', color: '#0d1b2a', '&:hover': { bgcolor: '#00b894' }, boxShadow: '0 4px 14px rgba(0,212,170,0.3)' }}
            >
              로그인
            </Button>
            <Box sx={{ textAlign: 'center', mt: 2.5 }}>
              <Button size="small" onClick={switchToRegister} sx={{ color: 'rgba(255,255,255,0.5)', fontSize: '0.8rem' }}>
                계정이 없으신가요? <Box component="span" sx={{ color: '#00d4aa', ml: 0.5, fontWeight: 600 }}>회원가입</Box>
              </Button>
            </Box>
          </>
        ) : (
          <>
            <Typography variant="subtitle1" sx={{ color: '#fff', fontWeight: 700, mb: 1.5, textAlign: 'center' }}>
              회원가입
            </Typography>
            <Stepper activeStep={registerStep} sx={{ mb: 2.5 }}>
              {REGISTER_STEPS.map(label => (
                <Step key={label}>
                  <StepLabel sx={{
                    '& .MuiStepLabel-label': { color: 'rgba(255,255,255,0.4)', fontSize: '0.72rem', '&.Mui-active': { color: '#00d4aa' }, '&.Mui-completed': { color: '#4caf50' } },
                    '& .MuiStepIcon-root': { color: 'rgba(255,255,255,0.15)', '&.Mui-active': { color: '#00d4aa' }, '&.Mui-completed': { color: '#4caf50' } },
                  }}>
                    {label}
                  </StepLabel>
                </Step>
              ))}
            </Stepper>

            {error && <Alert severity="error" sx={{ mb: 2, fontSize: '0.78rem', py: 0.5 }}>{error}</Alert>}
            {success && <Alert severity="success" sx={{ mb: 2, fontSize: '0.78rem', py: 0.5 }}>{success}</Alert>}

            {registerStep === 0 && (
              <Box>
                <TextField
                  label="전화번호"
                  value={phone}
                  onChange={e => handlePhoneChange(e.target.value)}
                  fullWidth size="small"
                  placeholder="010-1234-5678"
                  disabled={otpVerified}
                  sx={{ mb: 2, '& .MuiInputBase-root': { bgcolor: 'rgba(255,255,255,0.05)', borderRadius: 2 }, '& input': { color: '#fff' } }}
                  slotProps={{
                    input: {
                      startAdornment: <InputAdornment position="start"><PhoneIcon sx={{ fontSize: 18, color: 'rgba(255,255,255,0.4)' }} /></InputAdornment>,
                      endAdornment: otpVerified ? <InputAdornment position="end"><VerifiedIcon sx={{ fontSize: 18, color: '#4caf50' }} /></InputAdornment> : undefined,
                    },
                    inputLabel: { sx: { color: 'rgba(255,255,255,0.6)' } },
                  }}
                />

                {!otpSent ? (
                  <Button
                    variant="contained" fullWidth onClick={sendOtp}
                    disabled={loading || phone.replace(/[^0-9]/g, '').length < 10}
                    startIcon={<SmsIcon />}
                    sx={{ py: 1.2, fontWeight: 600, borderRadius: 2, bgcolor: '#2196f3', '&:hover': { bgcolor: '#1976d2' } }}
                  >
                    인증코드 발송
                  </Button>
                ) : !otpVerified ? (
                  <Box>
                    <Box sx={{ display: 'flex', gap: 1, mb: 1.5 }}>
                      <TextField
                        value={otpCode}
                        onChange={e => setOtpCode(e.target.value.replace(/[^0-9]/g, '').slice(0, 6))}
                        fullWidth size="small"
                        placeholder="인증코드 6자리"
                        sx={{
                          '& .MuiInputBase-root': { bgcolor: 'rgba(255,255,255,0.05)', borderRadius: 2 },
                          '& input': { color: '#fff', letterSpacing: 6, textAlign: 'center', fontSize: '1.2rem', fontWeight: 700 },
                        }}
                        slotProps={{ inputLabel: { sx: { color: 'rgba(255,255,255,0.6)' } } }}
                      />
                      <Button
                        variant="contained" onClick={verifyOtp}
                        disabled={loading || otpCode.length !== 6}
                        sx={{ minWidth: 72, fontWeight: 700, borderRadius: 2, bgcolor: '#00d4aa', color: '#0d1b2a', '&:hover': { bgcolor: '#00b894' } }}
                      >
                        확인
                      </Button>
                    </Box>
                    <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <Typography variant="caption" sx={{ color: otpCooldown < 30 ? '#ff7043' : 'rgba(255,255,255,0.4)' }}>
                        {otpCooldown > 0 ? `${Math.floor(otpCooldown / 60)}:${String(otpCooldown % 60).padStart(2, '0')}` : '만료'}
                      </Typography>
                      <Button size="small" onClick={sendOtp} disabled={loading || otpCooldown > 150} sx={{ color: 'rgba(255,255,255,0.5)', fontSize: '0.7rem' }}>
                        재발송
                      </Button>
                    </Box>
                  </Box>
                ) : null}
              </Box>
            )}

            {registerStep === 1 && (
              <Box>
                <Box sx={{ p: 1.5, mb: 2.5, bgcolor: 'rgba(76,175,80,0.06)', borderRadius: 2, border: '1px solid rgba(76,175,80,0.2)', display: 'flex', alignItems: 'center', gap: 1 }}>
                  <VerifiedIcon sx={{ fontSize: 16, color: '#4caf50' }} />
                  <Typography variant="body2" sx={{ color: '#4caf50', fontWeight: 600, fontSize: '0.8rem' }}>{phone}</Typography>
                  <Typography variant="caption" sx={{ color: 'rgba(255,255,255,0.3)', ml: 'auto' }}>인증완료</Typography>
                </Box>
                <TextField
                  label="이름"
                  value={displayName}
                  onChange={e => setDisplayName(e.target.value)}
                  fullWidth size="small"
                  placeholder="홍길동"
                  sx={{ mb: 2, '& .MuiInputBase-root': { bgcolor: 'rgba(255,255,255,0.05)', borderRadius: 2 }, '& input': { color: '#fff' } }}
                  slotProps={{
                    input: { startAdornment: <InputAdornment position="start"><PersonIcon sx={{ fontSize: 18, color: 'rgba(255,255,255,0.4)' }} /></InputAdornment> },
                    inputLabel: { sx: { color: 'rgba(255,255,255,0.6)' } },
                  }}
                />
                <TextField
                  label="비밀번호"
                  type="password"
                  value={password}
                  onChange={e => setPassword(e.target.value)}
                  fullWidth size="small"
                  placeholder="6자 이상"
                  sx={{ mb: 3, '& .MuiInputBase-root': { bgcolor: 'rgba(255,255,255,0.05)', borderRadius: 2 }, '& input': { color: '#fff' } }}
                  slotProps={{
                    input: { startAdornment: <InputAdornment position="start"><LockIcon sx={{ fontSize: 18, color: 'rgba(255,255,255,0.4)' }} /></InputAdornment> },
                    inputLabel: { sx: { color: 'rgba(255,255,255,0.6)' } },
                  }}
                />
                <Button
                  type="submit" variant="contained" fullWidth disabled={loading}
                  sx={{ py: 1.3, fontWeight: 700, fontSize: '0.95rem', borderRadius: 2, bgcolor: '#00d4aa', color: '#0d1b2a', '&:hover': { bgcolor: '#00b894' }, boxShadow: '0 4px 14px rgba(0,212,170,0.3)' }}
                >
                  가입완료
                </Button>
              </Box>
            )}

            <Box sx={{ textAlign: 'center', mt: 2.5 }}>
              <Button size="small" onClick={switchToLogin} sx={{ color: 'rgba(255,255,255,0.5)', fontSize: '0.8rem' }}>
                이미 계정이 있으신가요? <Box component="span" sx={{ color: '#00d4aa', ml: 0.5, fontWeight: 600 }}>로그인</Box>
              </Button>
            </Box>
          </>
        )}
      </Box>
    </Box>
  );
}
