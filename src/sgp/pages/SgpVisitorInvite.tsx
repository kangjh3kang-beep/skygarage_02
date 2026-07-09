import { useState } from 'react';
import Box from '@mui/material/Box';
import Typography from '@mui/material/Typography';
import Card from '@mui/material/Card';
import CardContent from '@mui/material/CardContent';
import Button from '@mui/material/Button';
import TextField from '@mui/material/TextField';
import CircularProgress from '@mui/material/CircularProgress';
import CheckCircleIcon from '@mui/icons-material/CheckCircle';
import PersonAddIcon from '@mui/icons-material/PersonAdd';
import ContentCopyIcon from '@mui/icons-material/ContentCopy';
import { useSgpAuth } from '../contexts/SgpAuthContext';
import { supabase } from '../../lib/supabase';

export default function SgpVisitorInvite() {
  const { user } = useSgpAuth();
  const [guestName, setGuestName] = useState('');
  const [guestPlate, setGuestPlate] = useState('');
  const [validHours, setValidHours] = useState('24');
  const [submitting, setSubmitting] = useState(false);
  const [success, setSuccess] = useState(false);
  const [inviteCode, setInviteCode] = useState('');
  const [error, setError] = useState<string | null>(null);

  async function handleInvite() {
    if (!user || !guestName || !guestPlate) return;
    setSubmitting(true);
    setError(null);
    try {
      const { data, error: insertError } = await supabase
        .from('sgp_visitor_invitations')
        .insert({
          host_user_id: user.id,
          guest_name: guestName,
          guest_plate: guestPlate,
          valid_hours: parseInt(validHours) || 24,
          status: 'active',
        })
        .select('id')
        .single();
      if (insertError) throw new Error(insertError.message);
      setInviteCode(data.id.slice(0, 8).toUpperCase());
      setSuccess(true);
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setSubmitting(false);
    }
  }

  function handleReset() {
    setGuestName('');
    setGuestPlate('');
    setValidHours('24');
    setSuccess(false);
    setInviteCode('');
  }

  function handleCopy() {
    navigator.clipboard.writeText(`SGP 방문자 초대코드: ${inviteCode}\n차량번호: ${guestPlate}\n유효시간: ${validHours}시간`);
  }

  if (success) {
    return (
      <Box sx={{ p: 2, textAlign: 'center' }}>
        <CheckCircleIcon sx={{ fontSize: 64, color: '#00d4aa', mb: 2, mt: 4 }} />
        <Typography variant="h6" sx={{ color: '#fff', fontWeight: 700, mb: 1 }}>초대 완료</Typography>
        <Typography variant="body2" sx={{ color: 'rgba(255,255,255,0.6)', mb: 3 }}>
          {guestName}님의 방문 초대가 등록되었습니다
        </Typography>
        <Card sx={{ bgcolor: 'rgba(0,212,170,0.08)', border: '1px solid rgba(0,212,170,0.3)', borderRadius: 2, mb: 3 }}>
          <CardContent sx={{ p: 3 }}>
            <Typography variant="caption" sx={{ color: 'rgba(255,255,255,0.5)' }}>초대 코드</Typography>
            <Typography variant="h4" sx={{ color: '#00d4aa', fontWeight: 800, letterSpacing: 4 }}>{inviteCode}</Typography>
            <Typography variant="caption" sx={{ color: 'rgba(255,255,255,0.4)', mt: 1, display: 'block' }}>
              유효시간: {validHours}시간 / 차량: {guestPlate}
            </Typography>
          </CardContent>
        </Card>
        <Box sx={{ display: 'flex', gap: 1 }}>
          <Button variant="outlined" fullWidth startIcon={<ContentCopyIcon />} onClick={handleCopy} sx={{ borderColor: 'rgba(255,255,255,0.2)', color: '#fff' }}>
            복사
          </Button>
          <Button variant="contained" fullWidth onClick={handleReset} sx={{ bgcolor: '#00d4aa', color: '#0d1b2a', fontWeight: 700 }}>
            새 초대
          </Button>
        </Box>
      </Box>
    );
  }

  return (
    <Box sx={{ p: 2 }}>
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 3 }}>
        <PersonAddIcon sx={{ color: '#00d4aa' }} />
        <Typography variant="subtitle1" sx={{ color: '#fff', fontWeight: 700 }}>방문자 초대</Typography>
      </Box>

      {error && <Typography variant="body2" color="error" sx={{ mb: 2 }}>{error}</Typography>}

      <Card sx={{ bgcolor: 'rgba(255,255,255,0.03)', borderRadius: 2 }}>
        <CardContent sx={{ display: 'flex', flexDirection: 'column', gap: 2.5, p: 2.5 }}>
          <TextField
            label="방문자 이름"
            value={guestName}
            onChange={e => setGuestName(e.target.value)}
            fullWidth
            size="small"
            sx={{ '& .MuiInputBase-root': { color: '#fff' }, '& .MuiInputLabel-root': { color: 'rgba(255,255,255,0.5)' } }}
          />
          <TextField
            label="방문자 차량번호"
            value={guestPlate}
            onChange={e => setGuestPlate(e.target.value)}
            fullWidth
            size="small"
            sx={{ '& .MuiInputBase-root': { color: '#fff' }, '& .MuiInputLabel-root': { color: 'rgba(255,255,255,0.5)' } }}
          />
          <TextField
            label="유효 시간"
            type="number"
            value={validHours}
            onChange={e => setValidHours(e.target.value)}
            fullWidth
            size="small"
            helperText="초대장 유효 시간 (기본 24시간)"
            sx={{ '& .MuiInputBase-root': { color: '#fff' }, '& .MuiInputLabel-root': { color: 'rgba(255,255,255,0.5)' }, '& .MuiFormHelperText-root': { color: 'rgba(255,255,255,0.3)' } }}
          />
        </CardContent>
      </Card>

      <Button
        variant="contained"
        fullWidth
        onClick={handleInvite}
        disabled={!guestName || !guestPlate || submitting}
        sx={{ mt: 3, py: 1.5, fontWeight: 700, bgcolor: '#00d4aa', color: '#0d1b2a', '&:hover': { bgcolor: '#00b894' } }}
      >
        {submitting ? <CircularProgress size={20} sx={{ color: '#0d1b2a' }} /> : '초대장 생성'}
      </Button>
    </Box>
  );
}
