import { useState } from 'react';
import Box from '@mui/material/Box';
import Card from '@mui/material/Card';
import CardContent from '@mui/material/CardContent';
import Typography from '@mui/material/Typography';
import TextField from '@mui/material/TextField';
import Button from '@mui/material/Button';
import Alert from '@mui/material/Alert';
import LinearProgress from '@mui/material/LinearProgress';
import CircularProgress from '@mui/material/CircularProgress';
import Chip from '@mui/material/Chip';
import EvStationIcon from '@mui/icons-material/EvStation';
import BoltIcon from '@mui/icons-material/Bolt';
import DirectionsCarIcon from '@mui/icons-material/DirectionsCar';
import { supabase } from '../../../lib/supabase';
import type { EvChargingSession } from '../../types';

export default function VisitorEvCharging() {
  const [plate, setPlate] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [session, setSession] = useState<EvChargingSession | null>(null);
  const [requested, setRequested] = useState(false);

  const handleLookup = async () => {
    if (!plate.trim()) return;
    setLoading(true);
    setError('');

    const { data: parking } = await supabase
      .from('active_parking')
      .select('id, household_id')
      .eq('vehicle_plate', plate.trim())
      .is('exit_time', null)
      .limit(1);

    if (!parking || parking.length === 0) {
      setError('현재 주차 중인 차량을 찾을 수 없습니다.');
      setLoading(false);
      return;
    }

    const { data: evSession } = await supabase
      .from('ev_charging_sessions')
      .select('*')
      .eq('parking_session_id', parking[0].id)
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle();

    if (evSession) {
      setSession(evSession);
    } else {
      setSession(null);
    }
    setLoading(false);
  };

  const handleRequestCharging = async () => {
    if (!plate.trim()) return;
    setLoading(true);

    const { data: parking } = await supabase
      .from('active_parking')
      .select('id, household_id')
      .eq('vehicle_plate', plate.trim())
      .is('exit_time', null)
      .limit(1);

    if (!parking || parking.length === 0 || !parking[0].household_id) {
      setError('충전 신청 불가: 주차 세션을 찾을 수 없습니다.');
      setLoading(false);
      return;
    }

    const { data: newSession } = await supabase
      .from('ev_charging_sessions')
      .insert({
        parking_session_id: parking[0].id,
        household_id: parking[0].household_id,
        status: 'requested',
        auto_charge_enabled: false,
      })
      .select()
      .maybeSingle();

    if (newSession) {
      setSession(newSession);
      setRequested(true);
    }
    setLoading(false);
  };

  return (
    <Box sx={{ p: 2, maxWidth: 500, mx: 'auto', mt: 4 }}>
      <Typography variant="h5" sx={{ fontWeight: 800, textAlign: 'center', mb: 1 }}>
        전기차 충전
      </Typography>
      <Typography variant="body2" sx={{ textAlign: 'center', color: 'text.secondary', mb: 3 }}>
        차량 번호를 입력하여 충전 신청 또는 현황을 확인하세요
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
      {requested && <Alert severity="success" sx={{ mb: 2 }}>충전 신청이 완료되었습니다.</Alert>}

      {session ? (
        <Card>
          <CardContent>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 2 }}>
              <BoltIcon sx={{ color: 'warning.main' }} />
              <Typography variant="subtitle1" sx={{ fontWeight: 700, flex: 1 }}>충전 현황</Typography>
              <Chip
                label={session.status === 'charging' ? '충전 중' : session.status === 'completed' ? '완료' : '대기'}
                size="small"
                color={session.status === 'charging' ? 'warning' : session.status === 'completed' ? 'success' : 'default'}
              />
            </Box>

            {(session.status === 'charging' || session.status === 'completed') && (
              <Box sx={{ mb: 2 }}>
                <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 0.5 }}>
                  <Typography variant="caption" sx={{ color: 'text.secondary' }}>충전률</Typography>
                  <Typography variant="caption" sx={{ fontWeight: 700 }}>
                    {session.charge_current_pct}% / {session.charge_target_pct}%
                  </Typography>
                </Box>
                <LinearProgress
                  variant="determinate"
                  value={(session.charge_current_pct / session.charge_target_pct) * 100}
                  color="warning"
                  sx={{ height: 10, borderRadius: 5 }}
                />
              </Box>
            )}

            <Box sx={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 1.5 }}>
              <Box sx={{ bgcolor: 'background.default', p: 1.5, borderRadius: 2, textAlign: 'center' }}>
                <Typography variant="caption" sx={{ color: 'text.secondary' }}>충전량</Typography>
                <Typography variant="body2" sx={{ fontWeight: 700 }}>{session.kwh_delivered} kWh</Typography>
              </Box>
              <Box sx={{ bgcolor: 'background.default', p: 1.5, borderRadius: 2, textAlign: 'center' }}>
                <Typography variant="caption" sx={{ color: 'text.secondary' }}>예상 비용</Typography>
                <Typography variant="body2" sx={{ fontWeight: 700 }}>
                  {(session.kwh_delivered * session.cost_per_kwh).toLocaleString()}원
                </Typography>
              </Box>
            </Box>
          </CardContent>
        </Card>
      ) : (
        plate && !loading && !error && (
          <Card>
            <CardContent sx={{ textAlign: 'center', py: 4 }}>
              <EvStationIcon sx={{ fontSize: 48, color: 'text.secondary', mb: 1 }} />
              <Typography variant="body2" sx={{ color: 'text.secondary', mb: 2 }}>
                진행 중인 충전이 없습니다.
              </Typography>
              <Button
                variant="contained"
                color="warning"
                startIcon={<BoltIcon />}
                onClick={handleRequestCharging}
                disabled={loading}
              >
                충전 신청
              </Button>
            </CardContent>
          </Card>
        )
      )}
    </Box>
  );
}
