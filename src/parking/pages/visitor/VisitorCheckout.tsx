import { useState } from 'react';
import Box from '@mui/material/Box';
import Card from '@mui/material/Card';
import CardContent from '@mui/material/CardContent';
import Typography from '@mui/material/Typography';
import TextField from '@mui/material/TextField';
import Button from '@mui/material/Button';
import Alert from '@mui/material/Alert';
import CircularProgress from '@mui/material/CircularProgress';
import Divider from '@mui/material/Divider';
import CheckCircleIcon from '@mui/icons-material/CheckCircle';
import ExitToAppIcon from '@mui/icons-material/ExitToApp';
import DirectionsCarIcon from '@mui/icons-material/DirectionsCar';
import { supabase } from '../../../lib/supabase';

interface CheckoutResult {
  plate: string;
  entryTime: string;
  exitTime: string;
  totalMinutes: number;
  freeMinutes: number;
  overageMinutes: number;
  overageFee: number;
}

export default function VisitorCheckout() {
  const [plate, setPlate] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [result, setResult] = useState<CheckoutResult | null>(null);

  const handleCheckout = async () => {
    if (!plate.trim()) return;
    setLoading(true);
    setError('');
    setResult(null);

    const { data: sessions } = await supabase
      .from('active_parking')
      .select('*')
      .eq('vehicle_plate', plate.trim())
      .is('exit_time', null)
      .eq('is_visitor', true)
      .limit(1);

    if (!sessions || sessions.length === 0) {
      setError('출차 가능한 방문 차량을 찾을 수 없습니다.');
      setLoading(false);
      return;
    }

    const session = sessions[0];
    const exitTime = new Date().toISOString();
    const entryTime = new Date(session.entry_time).getTime();
    const totalMinutes = Math.floor((Date.now() - entryTime) / 60000);

    let freeMinutes = 0;
    if (session.visitor_registration_id) {
      const { data: reg } = await supabase
        .from('visitor_registrations')
        .select('free_hours_granted')
        .eq('id', session.visitor_registration_id)
        .maybeSingle();
      freeMinutes = (reg?.free_hours_granted ?? 0) * 60;
    }

    const overageMinutes = Math.max(totalMinutes - freeMinutes, 0);
    const overageFee = Math.ceil(overageMinutes / 10) * 1000;

    await supabase
      .from('active_parking')
      .update({
        exit_time: exitTime,
        status: 'exiting',
        overage_minutes: overageMinutes,
        overage_fee: overageFee,
        updated_at: exitTime,
      })
      .eq('id', session.id);

    if (session.visitor_registration_id) {
      await supabase
        .from('visitor_registrations')
        .update({ status: 'completed', updated_at: exitTime })
        .eq('id', session.visitor_registration_id);
    }

    setResult({
      plate: session.vehicle_plate,
      entryTime: session.entry_time,
      exitTime,
      totalMinutes,
      freeMinutes,
      overageMinutes,
      overageFee,
    });
    setLoading(false);
  };

  const formatMinutes = (min: number) => {
    const h = Math.floor(min / 60);
    const m = min % 60;
    if (h > 0) return `${h}시간 ${m}분`;
    return `${m}분`;
  };

  return (
    <Box sx={{ p: 2, maxWidth: 500, mx: 'auto', mt: 4 }}>
      <Typography variant="h5" sx={{ fontWeight: 800, textAlign: 'center', mb: 1 }}>
        출차 및 정산
      </Typography>
      <Typography variant="body2" sx={{ textAlign: 'center', color: 'text.secondary', mb: 3 }}>
        차량 번호를 입력하여 출차를 진행하세요
      </Typography>

      {!result ? (
        <Card>
          <CardContent sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
            <TextField
              label="차량 번호"
              placeholder="12가 3456"
              value={plate}
              onChange={e => setPlate(e.target.value)}
              fullWidth
              slotProps={{ input: { startAdornment: <DirectionsCarIcon sx={{ color: 'text.secondary', mr: 1 }} /> } }}
            />
            {error && <Alert severity="warning">{error}</Alert>}
            <Button
              variant="contained"
              fullWidth
              onClick={handleCheckout}
              disabled={!plate.trim() || loading}
              startIcon={loading ? <CircularProgress size={20} /> : <ExitToAppIcon />}
              sx={{ py: 1.5 }}
            >
              출차 진행
            </Button>
          </CardContent>
        </Card>
      ) : (
        <Card>
          <CardContent>
            <Box sx={{ textAlign: 'center', mb: 3 }}>
              <CheckCircleIcon sx={{ fontSize: 56, color: 'success.main', mb: 1 }} />
              <Typography variant="h6" sx={{ fontWeight: 700 }}>출차 처리 완료</Typography>
              <Typography variant="body2" sx={{ fontWeight: 700, mt: 0.5 }}>{result.plate}</Typography>
            </Box>

            <Box sx={{ bgcolor: 'background.default', borderRadius: 2, p: 2, mb: 2 }}>
              <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 1 }}>
                <Typography variant="body2" sx={{ color: 'text.secondary' }}>입차 시간</Typography>
                <Typography variant="body2" sx={{ fontWeight: 600 }}>
                  {new Date(result.entryTime).toLocaleTimeString('ko-KR', { hour: '2-digit', minute: '2-digit' })}
                </Typography>
              </Box>
              <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 1 }}>
                <Typography variant="body2" sx={{ color: 'text.secondary' }}>출차 시간</Typography>
                <Typography variant="body2" sx={{ fontWeight: 600 }}>
                  {new Date(result.exitTime).toLocaleTimeString('ko-KR', { hour: '2-digit', minute: '2-digit' })}
                </Typography>
              </Box>
              <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 1 }}>
                <Typography variant="body2" sx={{ color: 'text.secondary' }}>총 이용 시간</Typography>
                <Typography variant="body2" sx={{ fontWeight: 600 }}>{formatMinutes(result.totalMinutes)}</Typography>
              </Box>
              <Box sx={{ display: 'flex', justifyContent: 'space-between' }}>
                <Typography variant="body2" sx={{ color: 'text.secondary' }}>무료 주차 시간</Typography>
                <Typography variant="body2" sx={{ fontWeight: 600 }}>{formatMinutes(result.freeMinutes)}</Typography>
              </Box>
            </Box>

            <Divider sx={{ mb: 2 }} />

            <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <Typography variant="subtitle1" sx={{ fontWeight: 700 }}>정산 금액</Typography>
              <Typography variant="h5" sx={{ fontWeight: 800, color: result.overageFee > 0 ? 'error.main' : 'success.main' }}>
                {result.overageFee > 0 ? `${result.overageFee.toLocaleString()}원` : '무료'}
              </Typography>
            </Box>
            {result.overageMinutes > 0 && (
              <Typography variant="caption" sx={{ color: 'text.secondary' }}>
                초과 {formatMinutes(result.overageMinutes)} (10분당 1,000원)
              </Typography>
            )}

            <Button
              variant="outlined"
              fullWidth
              onClick={() => { setPlate(''); setResult(null); }}
              sx={{ mt: 3 }}
            >
              새 차량 출차
            </Button>
          </CardContent>
        </Card>
      )}
    </Box>
  );
}
