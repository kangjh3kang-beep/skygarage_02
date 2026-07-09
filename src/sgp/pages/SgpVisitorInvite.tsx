import { useState } from 'react';
import Box from '@mui/material/Box';
import Typography from '@mui/material/Typography';
import TextField from '@mui/material/TextField';
import Button from '@mui/material/Button';
import Card from '@mui/material/Card';
import CardContent from '@mui/material/CardContent';
import Alert from '@mui/material/Alert';
import CircularProgress from '@mui/material/CircularProgress';
import CheckCircleIcon from '@mui/icons-material/CheckCircle';
import PersonAddIcon from '@mui/icons-material/PersonAdd';
import { useNavigate } from 'react-router-dom';
import { useSgpAuth } from '../contexts/SgpAuthContext';
import { supabase } from '../../lib/supabase';

export default function SgpVisitorInvite() {
  const { user } = useSgpAuth();
  const navigate = useNavigate();
  const [guestName, setGuestName] = useState('');
  const [guestPlate, setGuestPlate] = useState('');
  const [validHours, setValidHours] = useState('4');
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);
  const [error, setError] = useState('');

  async function handleInvite() {
    if (!user || !guestName.trim() || !guestPlate.trim()) return;
    setLoading(true);
    setError('');

    const accessToken = crypto.randomUUID();
    const now = new Date();
    const validTo = new Date(now.getTime() + parseInt(validHours) * 60 * 60 * 1000);

    const { error: insertError } = await supabase.from('domain_events').insert({
      site_id: 'PLATFORM',
      envelope: 'AuditEvent',
      subtype: 'authz',
      action: 'VisitorInvited',
      payload: {
        hostUserId: user.id,
        guestName,
        guestVehiclePlate: guestPlate,
        validFrom: now.toISOString(),
        validTo: validTo.toISOString(),
        accessToken,
        status: 'active',
      },
      idempotency_key: `visitor-invite-${user.id}-${Date.now()}`,
      created_at: now.toISOString(),
    });

    setLoading(false);

    if (insertError) {
      setError('초대 생성에 실패했습니다.');
    } else {
      setSuccess(true);
    }
  }

  if (success) {
    const qrData = `SGP-VISITOR:${guestPlate}:${validHours}h`;
    return (
      <Box sx={{ px: 2, pt: 6, textAlign: 'center' }}>
        <CheckCircleIcon sx={{ fontSize: 64, color: '#00d4aa', mb: 2 }} />
        <Typography variant="h6" sx={{ color: '#fff', fontWeight: 700, mb: 1 }}>초대 완료</Typography>
        <Typography variant="body2" sx={{ color: 'rgba(255,255,255,0.5)', mb: 3 }}>
          방문자에게 아래 QR코드를 전달하세요. 입차 시 알림을 받습니다.
        </Typography>
        {/* QR Code Display */}
        <Box sx={{
          mx: 'auto', width: 180, height: 180, bgcolor: '#fff', borderRadius: 3, mb: 3,
          display: 'flex', alignItems: 'center', justifyContent: 'center', position: 'relative',
          boxShadow: '0 8px 32px rgba(0,212,170,0.2)',
        }}>
          <Box sx={{
            width: 140, height: 140, position: 'relative',
            background: `repeating-conic-gradient(#0d1b2a 0% 25%, transparent 0% 50%) 50% / 14px 14px`,
            borderRadius: 1,
          }} />
          <Box sx={{
            position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center',
          }}>
            <Typography variant="caption" sx={{ color: '#0d1b2a', fontWeight: 700, fontSize: '0.6rem', textAlign: 'center', px: 1 }}>
              {qrData}
            </Typography>
          </Box>
        </Box>
        <Card sx={{ bgcolor: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)', borderRadius: 2, mb: 3, mx: 2 }}>
          <CardContent>
            <Typography variant="body2" sx={{ color: 'rgba(255,255,255,0.6)' }}>
              {guestName} | {guestPlate} | {validHours}시간 유효
            </Typography>
          </CardContent>
        </Card>
        <Button onClick={() => navigate('/app')} sx={{ color: '#00d4aa' }}>홈으로</Button>
      </Box>
    );
  }

  return (
    <Box sx={{ px: 2, pt: 3, pb: 10 }}>
      <Typography variant="h6" sx={{ color: '#fff', fontWeight: 700, mb: 1 }}>방문자 초대</Typography>
      <Typography variant="body2" sx={{ color: 'rgba(255,255,255,0.4)', mb: 3 }}>
        방문자의 차량 번호와 유효 시간을 입력하세요. 1회용 QR이 생성됩니다.
      </Typography>

      {error && <Alert severity="error" sx={{ mb: 2, borderRadius: 2 }}>{error}</Alert>}

      <TextField
        fullWidth
        size="small"
        label="방문자 이름"
        value={guestName}
        onChange={e => setGuestName(e.target.value)}
        sx={{ mb: 2, '& .MuiOutlinedInput-root': { bgcolor: 'rgba(255,255,255,0.05)', color: '#fff', borderRadius: 2 }, '& .MuiInputLabel-root': { color: 'rgba(255,255,255,0.4)' } }}
      />
      <TextField
        fullWidth
        size="small"
        label="차량 번호"
        placeholder="12가 3456"
        value={guestPlate}
        onChange={e => setGuestPlate(e.target.value)}
        sx={{ mb: 2, '& .MuiOutlinedInput-root': { bgcolor: 'rgba(255,255,255,0.05)', color: '#fff', borderRadius: 2 }, '& .MuiInputLabel-root': { color: 'rgba(255,255,255,0.4)' } }}
      />
      <TextField
        fullWidth
        size="small"
        label="유효 시간"
        type="number"
        value={validHours}
        onChange={e => setValidHours(e.target.value)}
        sx={{ mb: 3, '& .MuiOutlinedInput-root': { bgcolor: 'rgba(255,255,255,0.05)', color: '#fff', borderRadius: 2 }, '& .MuiInputLabel-root': { color: 'rgba(255,255,255,0.4)' } }}
      />

      <Alert severity="info" sx={{ mb: 3, borderRadius: 2, '& .MuiAlert-message': { fontSize: '0.78rem' } }}>
        방문자에게 동의 안내가 전송됩니다. 입차 시 1회용 토큰으로 인증됩니다.
      </Alert>

      <Button
        fullWidth
        variant="contained"
        startIcon={loading ? <CircularProgress size={20} color="inherit" /> : <PersonAddIcon />}
        onClick={handleInvite}
        disabled={loading || !guestName.trim() || !guestPlate.trim()}
        sx={{ bgcolor: '#00d4aa', color: '#0d1b2a', fontWeight: 700, borderRadius: 3, py: 1.5 }}
      >
        {loading ? '생성 중...' : '초대 생성'}
      </Button>
    </Box>
  );
}
