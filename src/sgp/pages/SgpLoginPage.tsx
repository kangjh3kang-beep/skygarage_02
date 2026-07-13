import { useState, useEffect, useCallback } from 'react';
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
import MenuItem from '@mui/material/MenuItem';
import PhoneIcon from '@mui/icons-material/Phone';
import LockIcon from '@mui/icons-material/Lock';
import PersonIcon from '@mui/icons-material/Person';
import VerifiedIcon from '@mui/icons-material/Verified';
import SmsIcon from '@mui/icons-material/Sms';
import CakeIcon from '@mui/icons-material/Cake';
import HomeIcon from '@mui/icons-material/Home';
import { useSgpAuth } from '../contexts/SgpAuthContext';

const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL;
const SUPABASE_ANON_KEY = import.meta.env.VITE_SUPABASE_ANON_KEY;

const REGISTER_STEPS = ['본인인증', '정보입력', '주소등록'];

const textFieldStyles = {
  '& .MuiInputBase-root': { bgcolor: 'rgba(255,255,255,0.05)', borderRadius: 2 },
  '& input': { color: '#fff' },
  '& .MuiSelect-select': { color: '#fff' },
};

const labelStyles = { sx: { color: 'rgba(255,255,255,0.6)' } };

export default function SgpLoginPage() {
  const { signIn, signUp } = useSgpAuth();
  const [mode, setMode] = useState<'login' | 'register'>('login');
  const [phone, setPhone] = useState('');
  const [password, setPassword] = useState('');
  const [passwordConfirm, setPasswordConfirm] = useState('');
  const [displayName, setDisplayName] = useState('');
  const [birthDate, setBirthDate] = useState('');
  const [genderCode, setGenderCode] = useState('');
  const [address, setAddress] = useState('');
  const [addressDetail, setAddressDetail] = useState('');
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

  const startCooldown = useCallback(() => {
    setOtpCooldown(180);
    const interval = setInterval(() => {
      setOtpCooldown(prev => {
        if (prev <= 1) { clearInterval(interval); return 0; }
        return prev - 1;
      });
    }, 1000);
  }, []);

  const sendOtp = async () => {
    const cleanPhone = phone.replace(/[^0-9]/g, '');
    if (cleanPhone.length < 10) {
      setError('올바른 전화번호를 입력하세요.');
      return;
    }
    setLoading(true);
    setError('');
    setSuccess('');

    try {
      const response = await fetch(`${SUPABASE_URL}/functions/v1/sms-verify/send`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${SUPABASE_ANON_KEY}`,
        },
        body: JSON.stringify({ phone: cleanPhone }),
      });

      const result = await response.json();

      if (!response.ok) {
        setError(result.error || '인증코드 발송에 실패했습니다.');
        setLoading(false);
        return;
      }

      setVerificationId(result.verification_id);
      setOtpSent(true);
      setSuccess(`인증코드가 ${phone}로 발송되었습니다.`);
      startCooldown();
    } catch {
      setError('네트워크 오류. 다시 시도해주세요.');
    }
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

    try {
      const response = await fetch(`${SUPABASE_URL}/functions/v1/sms-verify/confirm`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${SUPABASE_ANON_KEY}`,
        },
        body: JSON.stringify({ verification_id: verificationId, code: otpCode }),
      });

      const result = await response.json();

      if (!response.ok) {
        setError(result.error || '인증에 실패했습니다.');
        setLoading(false);
        return;
      }

      setOtpVerified(true);
      setRegisterStep(1);
      setSuccess('본인인증이 완료되었습니다.');
    } catch {
      setError('네트워크 오류. 다시 시도해주세요.');
    }
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

  const handleNextToAddress = () => {
    setError('');
    if (!displayName.trim()) { setError('이름을 입력하세요.'); return; }
    if (birthDate.length !== 6 || !/^\d{6}$/.test(birthDate)) {
      setError('생년월일 6자리를 정확히 입력하세요. (예: 901225)');
      return;
    }
    if (!genderCode) { setError('성별을 선택하세요.'); return; }
    if (password.length < 6) { setError('비밀번호는 6자 이상이어야 합니다.'); return; }
    if (password !== passwordConfirm) { setError('비밀번호가 일치하지 않습니다.'); return; }
    setSuccess('');
    setRegisterStep(2);
  };

  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    if (!address.trim()) { setError('주소를 입력하세요.'); return; }
    setLoading(true);
    const cleanPhone = phone.replace(/[^0-9]/g, '');
    const result = await signUp({
      phone: cleanPhone,
      password,
      displayName: displayName.trim(),
      birthDate,
      genderCode,
      address: address.trim(),
      addressDetail: addressDetail.trim(),
    });
    if (result.error) setError(result.error);
    setLoading(false);
  };

  const resetRegistration = () => {
    setMode('login');
    setRegisterStep(0);
    setOtpSent(false);
    setOtpVerified(false);
    setOtpCode('');
    setPassword('');
    setPasswordConfirm('');
    setDisplayName('');
    setBirthDate('');
    setGenderCode('');
    setAddress('');
    setAddressDetail('');
    setError('');
    setSuccess('');
  };

  useEffect(() => {
    setError('');
    setSuccess('');
  }, [registerStep]);

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
          maxWidth: 380,
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
              sx={{ mb: 2, ...textFieldStyles }}
              slotProps={{
                input: { startAdornment: <InputAdornment position="start"><PhoneIcon sx={{ fontSize: 18, color: 'rgba(255,255,255,0.4)' }} /></InputAdornment> },
                inputLabel: labelStyles,
              }}
            />
            <TextField
              label="비밀번호"
              type="password"
              value={password}
              onChange={e => setPassword(e.target.value)}
              fullWidth size="small"
              sx={{ mb: 3, ...textFieldStyles }}
              slotProps={{
                input: { startAdornment: <InputAdornment position="start"><LockIcon sx={{ fontSize: 18, color: 'rgba(255,255,255,0.4)' }} /></InputAdornment> },
                inputLabel: labelStyles,
              }}
            />
            <Button
              type="submit" variant="contained" fullWidth disabled={loading}
              sx={{ py: 1.3, fontWeight: 700, fontSize: '0.95rem', borderRadius: 2, bgcolor: '#00d4aa', color: '#0d1b2a', '&:hover': { bgcolor: '#00b894' }, boxShadow: '0 4px 14px rgba(0,212,170,0.3)' }}
            >
              로그인
            </Button>
            <Box sx={{ textAlign: 'center', mt: 2.5 }}>
              <Button size="small" onClick={() => { setMode('register'); setError(''); }} sx={{ color: 'rgba(255,255,255,0.5)', fontSize: '0.8rem' }}>
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
                    '& .MuiStepLabel-label': { color: 'rgba(255,255,255,0.4)', fontSize: '0.7rem', '&.Mui-active': { color: '#00d4aa' }, '&.Mui-completed': { color: '#4caf50' } },
                    '& .MuiStepIcon-root': { color: 'rgba(255,255,255,0.15)', '&.Mui-active': { color: '#00d4aa' }, '&.Mui-completed': { color: '#4caf50' } },
                  }}>
                    {label}
                  </StepLabel>
                </Step>
              ))}
            </Stepper>

            {error && <Alert severity="error" sx={{ mb: 2, fontSize: '0.78rem', py: 0.5 }}>{error}</Alert>}
            {success && <Alert severity="success" sx={{ mb: 2, fontSize: '0.78rem', py: 0.5 }}>{success}</Alert>}

            {/* Step 0: Phone Verification */}
            {registerStep === 0 && (
              <Box>
                <TextField
                  label="전화번호"
                  value={phone}
                  onChange={e => handlePhoneChange(e.target.value)}
                  fullWidth size="small"
                  placeholder="010-1234-5678"
                  disabled={otpVerified}
                  sx={{ mb: 2, ...textFieldStyles }}
                  slotProps={{
                    input: {
                      startAdornment: <InputAdornment position="start"><PhoneIcon sx={{ fontSize: 18, color: 'rgba(255,255,255,0.4)' }} /></InputAdornment>,
                      endAdornment: otpVerified ? <InputAdornment position="end"><VerifiedIcon sx={{ fontSize: 18, color: '#4caf50' }} /></InputAdornment> : undefined,
                    },
                    inputLabel: labelStyles,
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
                        slotProps={{ inputLabel: labelStyles }}
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
                        {otpCooldown > 0 ? `${Math.floor(otpCooldown / 60)}:${String(otpCooldown % 60).padStart(2, '0')}` : '만료됨'}
                      </Typography>
                      <Button size="small" onClick={sendOtp} disabled={loading || otpCooldown > 150} sx={{ color: 'rgba(255,255,255,0.5)', fontSize: '0.7rem' }}>
                        재발송
                      </Button>
                    </Box>
                  </Box>
                ) : null}
              </Box>
            )}

            {/* Step 1: Personal Info */}
            {registerStep === 1 && (
              <Box>
                <Box sx={{ p: 1.5, mb: 2, bgcolor: 'rgba(76,175,80,0.06)', borderRadius: 2, border: '1px solid rgba(76,175,80,0.2)', display: 'flex', alignItems: 'center', gap: 1 }}>
                  <VerifiedIcon sx={{ fontSize: 16, color: '#4caf50' }} />
                  <Typography variant="body2" sx={{ color: '#4caf50', fontWeight: 600, fontSize: '0.8rem' }}>{phone}</Typography>
                  <Typography variant="caption" sx={{ color: 'rgba(255,255,255,0.3)', ml: 'auto' }}>인증완료</Typography>
                </Box>

                <TextField
                  label="이름 (실명)"
                  value={displayName}
                  onChange={e => setDisplayName(e.target.value)}
                  fullWidth size="small"
                  placeholder="홍길동"
                  sx={{ mb: 2, ...textFieldStyles }}
                  slotProps={{
                    input: { startAdornment: <InputAdornment position="start"><PersonIcon sx={{ fontSize: 18, color: 'rgba(255,255,255,0.4)' }} /></InputAdornment> },
                    inputLabel: labelStyles,
                  }}
                />

                <Box sx={{ display: 'flex', gap: 1.5, mb: 2 }}>
                  <TextField
                    label="생년월일"
                    value={birthDate}
                    onChange={e => setBirthDate(e.target.value.replace(/[^0-9]/g, '').slice(0, 6))}
                    size="small"
                    placeholder="901225"
                    sx={{ flex: 2, ...textFieldStyles }}
                    slotProps={{
                      input: { startAdornment: <InputAdornment position="start"><CakeIcon sx={{ fontSize: 18, color: 'rgba(255,255,255,0.4)' }} /></InputAdornment> },
                      inputLabel: labelStyles,
                    }}
                  />
                  <TextField
                    label="성별"
                    value={genderCode}
                    onChange={e => setGenderCode(e.target.value)}
                    select
                    size="small"
                    sx={{ flex: 1, ...textFieldStyles, '& .MuiSvgIcon-root': { color: 'rgba(255,255,255,0.4)' } }}
                    slotProps={{ inputLabel: labelStyles }}
                  >
                    <MenuItem value="1">남(1)</MenuItem>
                    <MenuItem value="2">여(2)</MenuItem>
                    <MenuItem value="3">남(3)</MenuItem>
                    <MenuItem value="4">여(4)</MenuItem>
                  </TextField>
                </Box>

                <Typography variant="caption" sx={{ color: 'rgba(255,255,255,0.3)', display: 'block', mb: 2, ml: 0.5 }}>
                  * 주민번호 앞6자리(생년월일) + 뒷자리 첫번째(성별)만 수집합니다.
                </Typography>

                <TextField
                  label="비밀번호"
                  type="password"
                  value={password}
                  onChange={e => setPassword(e.target.value)}
                  fullWidth size="small"
                  placeholder="6자 이상"
                  sx={{ mb: 1.5, ...textFieldStyles }}
                  slotProps={{
                    input: { startAdornment: <InputAdornment position="start"><LockIcon sx={{ fontSize: 18, color: 'rgba(255,255,255,0.4)' }} /></InputAdornment> },
                    inputLabel: labelStyles,
                  }}
                />
                <TextField
                  label="비밀번호 확인"
                  type="password"
                  value={passwordConfirm}
                  onChange={e => setPasswordConfirm(e.target.value)}
                  fullWidth size="small"
                  sx={{ mb: 3, ...textFieldStyles }}
                  slotProps={{
                    input: { startAdornment: <InputAdornment position="start"><LockIcon sx={{ fontSize: 18, color: 'rgba(255,255,255,0.4)' }} /></InputAdornment> },
                    inputLabel: labelStyles,
                  }}
                />

                <Button
                  variant="contained" fullWidth onClick={handleNextToAddress}
                  disabled={loading}
                  sx={{ py: 1.3, fontWeight: 700, fontSize: '0.95rem', borderRadius: 2, bgcolor: '#00d4aa', color: '#0d1b2a', '&:hover': { bgcolor: '#00b894' } }}
                >
                  다음 단계
                </Button>
              </Box>
            )}

            {/* Step 2: Address */}
            {registerStep === 2 && (
              <Box>
                <Box sx={{ p: 1.5, mb: 2, bgcolor: 'rgba(76,175,80,0.06)', borderRadius: 2, border: '1px solid rgba(76,175,80,0.2)' }}>
                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 0.5 }}>
                    <VerifiedIcon sx={{ fontSize: 14, color: '#4caf50' }} />
                    <Typography variant="caption" sx={{ color: '#4caf50', fontWeight: 600 }}>{displayName}</Typography>
                    <Typography variant="caption" sx={{ color: 'rgba(255,255,255,0.3)' }}>|</Typography>
                    <Typography variant="caption" sx={{ color: 'rgba(255,255,255,0.4)' }}>{phone}</Typography>
                  </Box>
                  <Typography variant="caption" sx={{ color: 'rgba(255,255,255,0.3)', fontSize: '0.68rem' }}>
                    {birthDate.slice(0, 2)}년생 / {genderCode === '1' || genderCode === '3' ? '남' : '여'}
                  </Typography>
                </Box>

                <TextField
                  label="주소"
                  value={address}
                  onChange={e => setAddress(e.target.value)}
                  fullWidth size="small"
                  placeholder="서울특별시 강남구 역삼동"
                  sx={{ mb: 2, ...textFieldStyles }}
                  slotProps={{
                    input: { startAdornment: <InputAdornment position="start"><HomeIcon sx={{ fontSize: 18, color: 'rgba(255,255,255,0.4)' }} /></InputAdornment> },
                    inputLabel: labelStyles,
                  }}
                />
                <TextField
                  label="상세주소 (선택)"
                  value={addressDetail}
                  onChange={e => setAddressDetail(e.target.value)}
                  fullWidth size="small"
                  placeholder="아파트 동/호수"
                  sx={{ mb: 3, ...textFieldStyles }}
                  slotProps={{ inputLabel: labelStyles }}
                />

                <Box sx={{ display: 'flex', gap: 1.5 }}>
                  <Button
                    variant="outlined" onClick={() => setRegisterStep(1)}
                    sx={{ flex: 1, py: 1.2, fontWeight: 600, borderRadius: 2, color: 'rgba(255,255,255,0.6)', borderColor: 'rgba(255,255,255,0.2)', '&:hover': { borderColor: 'rgba(255,255,255,0.4)' } }}
                  >
                    이전
                  </Button>
                  <Button
                    type="submit" variant="contained" disabled={loading}
                    sx={{ flex: 2, py: 1.2, fontWeight: 700, fontSize: '0.95rem', borderRadius: 2, bgcolor: '#00d4aa', color: '#0d1b2a', '&:hover': { bgcolor: '#00b894' }, boxShadow: '0 4px 14px rgba(0,212,170,0.3)' }}
                  >
                    가입완료
                  </Button>
                </Box>
              </Box>
            )}

            <Box sx={{ textAlign: 'center', mt: 2.5 }}>
              <Button size="small" onClick={resetRegistration} sx={{ color: 'rgba(255,255,255,0.5)', fontSize: '0.8rem' }}>
                이미 계정이 있으신가요? <Box component="span" sx={{ color: '#00d4aa', ml: 0.5, fontWeight: 600 }}>로그인</Box>
              </Button>
            </Box>
          </>
        )}
      </Box>
    </Box>
  );
}
