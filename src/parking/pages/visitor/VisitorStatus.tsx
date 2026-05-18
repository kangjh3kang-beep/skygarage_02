import { useState, useEffect } from 'react';
import Box from '@mui/material/Box';
import Card from '@mui/material/Card';
import CardContent from '@mui/material/CardContent';
import Typography from '@mui/material/Typography';
import TextField from '@mui/material/TextField';
import Button from '@mui/material/Button';
import Chip from '@mui/material/Chip';
import LinearProgress from '@mui/material/LinearProgress';
import Alert from '@mui/material/Alert';
import CircularProgress from '@mui/material/CircularProgress';
import AccessTimeIcon from '@mui/icons-material/AccessTime';
import DirectionsCarIcon from '@mui/icons-material/DirectionsCar';
import LocalParkingIcon from '@mui/icons-material/LocalParking';
import { supabase } from '../../../lib/supabase';
import type { ActiveParking, VisitorRegistration } from '../../types';

export default function VisitorStatus() {
  const [plate, setPlate] = useState('');
  const [session, setSession] = useState<ActiveParking | null>(null);
  const [registration, setRegistration] = useState<VisitorRegistration | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [elapsed, setElapsed] = useState(0);

  const handleLookup = async () => {
    if (!plate.trim()) return;
    setLoading(true);
    setError('');

    const { data: sessions } = await supabase
      .from('active_parking')
      .select('*')
      .eq('vehicle_plate', plate.trim())
      .is('exit_time', null)
      .limit(1);

    if (!sessions || sessions.length === 0) {
      setError('현재 주차 중인 차량을 찾을 수 없습니다.');
      setSession(null);
      setLoading(false);
      return;
    }

    setSession(sessions[0]);

    if (sessions[0].visitor_registration_id) {
      const { data: reg } = await supabase
        .from('visitor_registrations')
        .select('*')
        .eq('id', sessions[0].visitor_registration_id)
        .maybeSingle();
      setRegistration(reg);
    }
    setLoading(false);
  };

  useEffect(() => {
    if (!session) return;
    const interval = setInterval(() => {
      const entryTime = new Date(session.entry_time).getTime();
      const now = Date.now();
      setElapsed(Math.floor((now - entryTime) / 60000));
    }, 10000);

    const entryTime = new Date(session.entry_time).getTime();
    setElapsed(Math.floor((Date.now() - entryTime) / 60000));

    return () => clearInterval(interval);
  }, [session]);

  const freeMinutes = (registration?.free_hours_granted ?? 0) * 60;
  const remainingFreeMinutes = Math.max(freeMinutes - elapsed, 0);
  const isOvertime = elapsed > freeMinutes && freeMinutes > 0;
  const progressPct = freeMinutes > 0 ? Math.min((elapsed / freeMinutes) * 100, 100) : 0;

  const formatMinutes = (min: number) => {
    const h = Math.floor(min / 60);
    const m = min % 60;
    if (h > 0) return `${h}시간 ${m}분`;
    return `${m}분`;
  };

  return (
    <Box sx={{ p: 2, maxWidth: 500, mx: 'auto', mt: 4 }}>
      <Typography variant="h5" sx={{ fontWeight: 800, textAlign: 'center', mb: 1 }}>
        주차 현황 조회
      </Typography>
      <Typography variant="body2" sx={{ textAlign: 'center', color: 'text.secondary', mb: 3 }}>
        차량 번호로 주차 현황을 확인하세요
      </Typography>

      <Card sx={{ mb: 2 }}>
        <CardContent sx={{ display: 'flex', gap: 1, alignItems: 'center' }}>
          <TextField
            placeholder="차량 번호 입력"
            value={plate}
            onChange={e => setPlate(e.target.value)}
            fullWidth
            size="small"
            slotProps={{ input: { startAdornment: <DirectionsCarIcon sx={{ color: 'text.secondary', mr: 1, fontSize: 20 }} /> } }}
          />
          <Button variant="contained" onClick={handleLookup} disabled={!plate.trim() || loading}>
            {loading ? <CircularProgress size={20} /> : '조회'}
          </Button>
        </CardContent>
      </Card>

      {error && <Alert severity="warning" sx={{ mb: 2 }}>{error}</Alert>}

      {session && (
        <Card>
          <CardContent>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 2 }}>
              <LocalParkingIcon color="primary" />
              <Typography variant="h6" sx={{ fontWeight: 700, flex: 1 }}>{session.vehicle_plate}</Typography>
              <Chip
                label={session.entry_method === 'direct_entry' ? '세대직입' : session.entry_method === 'valet' ? '발렛' : '자가'}
                size="small"
                color="info"
              />
            </Box>

            <Box sx={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 2, mb: 2 }}>
              <Box sx={{ bgcolor: 'background.default', p: 1.5, borderRadius: 2, textAlign: 'center' }}>
                <Typography variant="caption" sx={{ color: 'text.secondary' }}>입차 시간</Typography>
                <Typography variant="body2" sx={{ fontWeight: 700 }}>
                  {new Date(session.entry_time).toLocaleTimeString('ko-KR', { hour: '2-digit', minute: '2-digit' })}
                </Typography>
              </Box>
              <Box sx={{ bgcolor: 'background.default', p: 1.5, borderRadius: 2, textAlign: 'center' }}>
                <Typography variant="caption" sx={{ color: 'text.secondary' }}>이용 시간</Typography>
                <Typography variant="body2" sx={{ fontWeight: 700 }}>{formatMinutes(elapsed)}</Typography>
              </Box>
            </Box>

            {registration && (
              <>
                <Box sx={{ mb: 2 }}>
                  <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 0.5 }}>
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
                      <AccessTimeIcon sx={{ fontSize: 16, color: 'text.secondary' }} />
                      <Typography variant="caption" sx={{ color: 'text.secondary' }}>무료 주차 시간</Typography>
                    </Box>
                    <Typography variant="caption" sx={{ fontWeight: 700, color: isOvertime ? 'error.main' : 'success.main' }}>
                      {isOvertime ? '초과됨' : `잔여 ${formatMinutes(remainingFreeMinutes)}`}
                    </Typography>
                  </Box>
                  <LinearProgress
                    variant="determinate"
                    value={progressPct}
                    color={isOvertime ? 'error' : 'success'}
                    sx={{ height: 8, borderRadius: 4 }}
                  />
                </Box>

                {isOvertime && (
                  <Alert severity="error" sx={{ fontSize: '0.8rem' }}>
                    무료 주차 시간이 초과되었습니다. 초과 요금이 발생합니다.
                    (초과: {formatMinutes(elapsed - freeMinutes)})
                  </Alert>
                )}
              </>
            )}
          </CardContent>
        </Card>
      )}
    </Box>
  );
}
