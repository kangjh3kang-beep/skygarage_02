import { useState } from 'react';
import Box from '@mui/material/Box';
import Card from '@mui/material/Card';
import CardContent from '@mui/material/CardContent';
import Typography from '@mui/material/Typography';
import Button from '@mui/material/Button';
import Chip from '@mui/material/Chip';
import LinearProgress from '@mui/material/LinearProgress';
import List from '@mui/material/List';
import ListItem from '@mui/material/ListItem';
import ListItemText from '@mui/material/ListItemText';
import Divider from '@mui/material/Divider';
import Dialog from '@mui/material/Dialog';
import DialogTitle from '@mui/material/DialogTitle';
import DialogContent from '@mui/material/DialogContent';
import DialogActions from '@mui/material/DialogActions';
import FormControlLabel from '@mui/material/FormControlLabel';
import Switch from '@mui/material/Switch';
import Select from '@mui/material/Select';
import MenuItem from '@mui/material/MenuItem';
import FormControl from '@mui/material/FormControl';
import InputLabel from '@mui/material/InputLabel';
import Skeleton from '@mui/material/Skeleton';
import Tab from '@mui/material/Tab';
import Tabs from '@mui/material/Tabs';
import EvStationIcon from '@mui/icons-material/EvStation';
import BoltIcon from '@mui/icons-material/Bolt';
import { useEvCharging } from '../../hooks/useEvCharging';
import { useVehicles } from '../../hooks/useVehicles';
import { useActiveParking } from '../../hooks/useActiveParking';

export default function EvCharging() {
  const { activeSessions, completedSessions, loading, requestCharging } = useEvCharging();
  const { vehicles } = useVehicles();
  const { myVehicleSessions } = useActiveParking();
  const [dialogOpen, setDialogOpen] = useState(false);
  const [selectedVehicle, setSelectedVehicle] = useState('');
  const [autoCharge, setAutoCharge] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [tab, setTab] = useState(0);

  const evVehicles = vehicles.filter(v => v.is_ev);
  const parkedEvSessions = myVehicleSessions.filter(s =>
    evVehicles.some(v => v.plate_number === s.vehicle_plate)
  );

  const handleRequest = async () => {
    if (!selectedVehicle) return;
    const parkingSession = parkedEvSessions[0];
    if (!parkingSession) return;
    setSubmitting(true);
    await requestCharging(selectedVehicle, parkingSession.id, autoCharge);
    setDialogOpen(false);
    setSelectedVehicle('');
    setAutoCharge(false);
    setSubmitting(false);
  };

  if (loading) {
    return (
      <Box sx={{ p: 2 }}>
        {[1, 2].map(i => <Skeleton key={i} variant="rounded" height={160} sx={{ mb: 2, borderRadius: 3 }} />)}
      </Box>
    );
  }

  return (
    <Box sx={{ p: 2, maxWidth: 600, mx: 'auto' }}>
      {/* Active Charging */}
      {activeSessions.map(session => {
        const vehicle = vehicles.find(v => v.id === session.vehicle_id);
        return (
          <Card key={session.id} sx={{ mb: 2, border: '1px solid', borderColor: 'warning.main' }}>
            <CardContent>
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 2 }}>
                <BoltIcon sx={{ color: 'warning.main' }} />
                <Typography variant="subtitle1" sx={{ fontWeight: 700, flex: 1 }}>
                  {vehicle?.plate_number ?? '차량'}
                </Typography>
                <Chip
                  label={session.status === 'charging' ? '충전 중' : '대기 중'}
                  size="small"
                  color={session.status === 'charging' ? 'warning' : 'default'}
                />
              </Box>

              <Box sx={{ mb: 2 }}>
                <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 0.5 }}>
                  <Typography variant="caption" sx={{ color: 'text.secondary' }}>충전 진행률</Typography>
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

              <Box sx={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 1, textAlign: 'center' }}>
                <Box>
                  <Typography variant="caption" sx={{ color: 'text.secondary' }}>충전량</Typography>
                  <Typography variant="body2" sx={{ fontWeight: 700 }}>{session.kwh_delivered} kWh</Typography>
                </Box>
                <Box>
                  <Typography variant="caption" sx={{ color: 'text.secondary' }}>예상 비용</Typography>
                  <Typography variant="body2" sx={{ fontWeight: 700 }}>
                    {(session.kwh_delivered * session.cost_per_kwh).toLocaleString()}원
                  </Typography>
                </Box>
                <Box>
                  <Typography variant="caption" sx={{ color: 'text.secondary' }}>예상 완료</Typography>
                  <Typography variant="body2" sx={{ fontWeight: 700 }}>
                    {session.estimated_completion
                      ? new Date(session.estimated_completion).toLocaleTimeString('ko-KR', { hour: '2-digit', minute: '2-digit' })
                      : '-'}
                  </Typography>
                </Box>
              </Box>
            </CardContent>
          </Card>
        );
      })}

      {/* Request Button */}
      {activeSessions.length === 0 && (
        <Card sx={{ mb: 2 }}>
          <CardContent sx={{ textAlign: 'center', py: 4 }}>
            <EvStationIcon sx={{ fontSize: 48, color: 'text.secondary', mb: 1 }} />
            <Typography variant="body1" sx={{ mb: 2, color: 'text.secondary' }}>
              현재 진행 중인 충전이 없습니다.
            </Typography>
            <Button
              variant="contained"
              color="warning"
              startIcon={<BoltIcon />}
              onClick={() => setDialogOpen(true)}
              disabled={evVehicles.length === 0 || parkedEvSessions.length === 0}
            >
              충전 신청
            </Button>
            {evVehicles.length === 0 && (
              <Typography variant="caption" sx={{ display: 'block', mt: 1, color: 'text.secondary' }}>
                등록된 전기차가 없습니다. 설정에서 차량을 등록하세요.
              </Typography>
            )}
            {evVehicles.length > 0 && parkedEvSessions.length === 0 && (
              <Typography variant="caption" sx={{ display: 'block', mt: 1, color: 'text.secondary' }}>
                주차 중인 전기차가 없습니다.
              </Typography>
            )}
          </CardContent>
        </Card>
      )}

      {/* History Tabs */}
      <Tabs value={tab} onChange={(_, v) => setTab(v)} sx={{ mb: 2 }}>
        <Tab label={`충전 중 (${activeSessions.length})`} />
        <Tab label={`이력 (${completedSessions.length})`} />
      </Tabs>

      {tab === 1 && (
        <List disablePadding>
          {completedSessions.length === 0 ? (
            <Typography variant="body2" sx={{ color: 'text.secondary', textAlign: 'center', py: 4 }}>
              충전 이력이 없습니다.
            </Typography>
          ) : (
            completedSessions.map((s, idx) => (
              <Box key={s.id}>
                {idx > 0 && <Divider />}
                <ListItem disablePadding sx={{ py: 1.5 }}>
                  <ListItemText
                    primary={`${s.kwh_delivered} kWh 충전 완료`}
                    secondary={`${new Date(s.completed_at!).toLocaleDateString('ko-KR')} | ${s.total_cost.toLocaleString()}원`}
                    slotProps={{ primary: { sx: { fontWeight: 700, fontSize: '0.875rem' } }, secondary: { sx: { fontSize: '0.75rem' } } }}
                  />
                  <Chip label="완료" size="small" color="success" />
                </ListItem>
              </Box>
            ))
          )}
        </List>
      )}

      {/* Charging Request Dialog */}
      <Dialog open={dialogOpen} onClose={() => setDialogOpen(false)} fullWidth maxWidth="sm">
        <DialogTitle sx={{ fontWeight: 700 }}>전기차 충전 신청</DialogTitle>
        <DialogContent sx={{ display: 'flex', flexDirection: 'column', gap: 2, pt: '16px !important' }}>
          <FormControl fullWidth>
            <InputLabel>차량 선택</InputLabel>
            <Select
              value={selectedVehicle}
              label="차량 선택"
              onChange={e => setSelectedVehicle(e.target.value)}
            >
              {evVehicles.map(v => (
                <MenuItem key={v.id} value={v.id}>
                  {v.plate_number} ({v.brand} {v.model})
                </MenuItem>
              ))}
            </Select>
          </FormControl>
          <FormControlLabel
            control={<Switch checked={autoCharge} onChange={(_, c) => setAutoCharge(c)} />}
            label="다음 입차 시 자동 충전 신청"
          />
          <Typography variant="caption" sx={{ color: 'text.secondary' }}>
            충전 요금: 300원/kWh (변동 가능)
          </Typography>
        </DialogContent>
        <DialogActions sx={{ px: 3, pb: 2 }}>
          <Button onClick={() => setDialogOpen(false)}>취소</Button>
          <Button variant="contained" color="warning" onClick={handleRequest} disabled={!selectedVehicle || submitting}>
            충전 신청
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
}
