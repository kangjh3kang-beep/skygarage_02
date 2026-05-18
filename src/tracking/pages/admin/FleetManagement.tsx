import { useState, useCallback, useEffect, useRef } from 'react';
import Box from '@mui/material/Box';
import Typography from '@mui/material/Typography';
import Grid from '@mui/material/Grid';
import Card from '@mui/material/Card';
import CardContent from '@mui/material/CardContent';
import Table from '@mui/material/Table';
import TableBody from '@mui/material/TableBody';
import TableCell from '@mui/material/TableCell';
import TableContainer from '@mui/material/TableContainer';
import TableHead from '@mui/material/TableHead';
import TableRow from '@mui/material/TableRow';
import Chip from '@mui/material/Chip';
import Button from '@mui/material/Button';
import IconButton from '@mui/material/IconButton';
import Dialog from '@mui/material/Dialog';
import DialogTitle from '@mui/material/DialogTitle';
import DialogContent from '@mui/material/DialogContent';
import DialogActions from '@mui/material/DialogActions';
import TextField from '@mui/material/TextField';
import MenuItem from '@mui/material/MenuItem';
import Tabs from '@mui/material/Tabs';
import Tab from '@mui/material/Tab';
import Skeleton from '@mui/material/Skeleton';
import AddIcon from '@mui/icons-material/Add';
import EditIcon from '@mui/icons-material/Edit';
import DeleteIcon from '@mui/icons-material/Delete';
import GpsFixedIcon from '@mui/icons-material/GpsFixed';
import LocalTaxiIcon from '@mui/icons-material/LocalTaxi';
import PlayArrowIcon from '@mui/icons-material/PlayArrow';
import StopIcon from '@mui/icons-material/Stop';
import FastForwardIcon from '@mui/icons-material/FastForward';
import { useVehicleTracking } from '../../hooks/useVehicleTracking';
import { useBooking } from '../../hooks/useBooking';
import { vehicleService, bookingService } from '../../services/trackingService';
import TrackingMap from '../../components/Map/TrackingMap';
import type { Vehicle } from '../../types';

const STATUS_LABELS: Record<string, { label: string; color: 'success' | 'info' | 'default' | 'warning' | 'error' }> = {
  available: { label: '대기', color: 'success' },
  in_transit: { label: '운행', color: 'info' },
  offline: { label: '오프라인', color: 'default' },
  maintenance: { label: '정비', color: 'warning' },
};

const BOOKING_STATUS: Record<string, { label: string; color: 'success' | 'info' | 'default' | 'warning' | 'error' }> = {
  pending: { label: '대기', color: 'warning' },
  confirmed: { label: '확정', color: 'info' },
  in_progress: { label: '이동중', color: 'info' },
  completed: { label: '완료', color: 'success' },
  cancelled: { label: '취소', color: 'error' },
};

export default function FleetManagement() {
  const { vehicles, loading, refresh } = useVehicleTracking();
  const { bookings, loading: bLoading, refresh: refreshBookings } = useBooking();
  const [tab, setTab] = useState(0);
  const [selectedVehicleId, setSelectedVehicleId] = useState<string>();
  const [vehicleDialog, setVehicleDialog] = useState(false);
  const [editingVehicle, setEditingVehicle] = useState<Vehicle | null>(null);
  const [form, setForm] = useState({ driver_name: '', plate_number: '', phone: '', vehicle_model: '', status: 'available' });

  const [simRunning, setSimRunning] = useState(false);
  const [simLog, setSimLog] = useState('');
  const simInterval = useRef<ReturnType<typeof setInterval> | null>(null);

  const simulateStep = useCallback(async () => {
    const apiUrl = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/vehicle-simulator`;
    try {
      const res = await fetch(apiUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${import.meta.env.VITE_SUPABASE_ANON_KEY}` },
        body: JSON.stringify({ action: 'simulate_step', steps: 1 }),
      });
      const data = await res.json();
      setSimLog(`${data.updated}대 이동 완료 (${new Date().toLocaleTimeString('ko-KR')})`);
      refresh();
    } catch {
      setSimLog('시뮬레이션 오류');
    }
  }, [refresh]);

  const toggleSimulation = useCallback(() => {
    if (simRunning) {
      if (simInterval.current) clearInterval(simInterval.current);
      simInterval.current = null;
      setSimRunning(false);
      setSimLog('시뮬레이션 중지됨');
    } else {
      setSimRunning(true);
      setSimLog('시뮬레이션 시작...');
      simulateStep();
      simInterval.current = setInterval(simulateStep, 3000);
    }
  }, [simRunning, simulateStep]);

  useEffect(() => {
    return () => { if (simInterval.current) clearInterval(simInterval.current); };
  }, []);

  const startRoute = useCallback(async (vehicleId: string) => {
    const apiUrl = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/vehicle-simulator`;
    await fetch(apiUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${import.meta.env.VITE_SUPABASE_ANON_KEY}` },
      body: JSON.stringify({ action: 'start_route', vehicle_id: vehicleId }),
    });
    refresh();
  }, [refresh]);

  const openAdd = () => { setEditingVehicle(null); setForm({ driver_name: '', plate_number: '', phone: '', vehicle_model: '', status: 'available' }); setVehicleDialog(true); };
  const openEdit = (v: Vehicle) => { setEditingVehicle(v); setForm({ driver_name: v.driver_name, plate_number: v.plate_number, phone: v.phone, vehicle_model: v.vehicle_model, status: v.status }); setVehicleDialog(true); };

  const handleSave = useCallback(async () => {
    if (editingVehicle) {
      await vehicleService.updateStatus(editingVehicle.id, form.status as Vehicle['status']);
    } else {
      await vehicleService.create(form as Partial<Vehicle>);
    }
    setVehicleDialog(false);
    refresh();
  }, [editingVehicle, form, refresh]);

  const handleDelete = useCallback(async (id: string) => {
    await vehicleService.delete(id);
    refresh();
  }, [refresh]);

  const handleBookingStatus = useCallback(async (id: string, status: string) => {
    await bookingService.updateStatus(id, status as 'confirmed' | 'in_progress' | 'completed' | 'cancelled');
    refreshBookings();
  }, [refreshBookings]);

  if (loading) {
    return (
      <Box sx={{ p: 3 }}>
        <Skeleton variant="rectangular" height={400} sx={{ borderRadius: 2, mb: 2 }} />
        <Skeleton variant="rectangular" height={300} sx={{ borderRadius: 2 }} />
      </Box>
    );
  }

  const availableCount = vehicles.filter(v => v.status === 'available').length;
  const transitCount = vehicles.filter(v => v.status === 'in_transit').length;
  const offlineCount = vehicles.filter(v => v.status === 'offline').length;

  return (
    <Box sx={{ p: { xs: 2, md: 3 } }}>
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 3 }}>
        <Typography variant="h5" sx={{ fontWeight: 800 }}>차량 관제</Typography>
        <Button variant="contained" startIcon={<AddIcon />} onClick={openAdd} size="small">차량 등록</Button>
      </Box>

      {/* Simulator Panel */}
      <Card sx={{ mb: 3, border: 1, borderColor: simRunning ? 'success.main' : 'divider' }}>
        <CardContent sx={{ py: 1.5, px: 2, display: 'flex', alignItems: 'center', gap: 2, flexWrap: 'wrap' }}>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
            <Chip
              label={simRunning ? '실행중' : '정지'}
              size="small"
              color={simRunning ? 'success' : 'default'}
              sx={{ animation: simRunning ? 'pulse 2s infinite' : 'none', '@keyframes pulse': { '0%,100%': { opacity: 1 }, '50%': { opacity: 0.6 } } }}
            />
            <Typography variant="subtitle2" sx={{ fontWeight: 700 }}>차량 시뮬레이터</Typography>
          </Box>
          <Box sx={{ display: 'flex', gap: 1 }}>
            <Button
              variant={simRunning ? 'outlined' : 'contained'}
              size="small"
              color={simRunning ? 'error' : 'success'}
              startIcon={simRunning ? <StopIcon /> : <PlayArrowIcon />}
              onClick={toggleSimulation}
            >
              {simRunning ? '중지' : '시작'}
            </Button>
            <Button
              variant="outlined"
              size="small"
              startIcon={<FastForwardIcon />}
              onClick={simulateStep}
              disabled={simRunning}
            >
              1회 실행
            </Button>
          </Box>
          {simLog && <Typography variant="caption" color="text.secondary">{simLog}</Typography>}
        </CardContent>
      </Card>

      {/* Stats */}
      <Grid container spacing={2} sx={{ mb: 3 }}>
        <Grid size={{ xs: 4 }}>
          <Card><CardContent sx={{ textAlign: 'center', py: 1.5 }}>
            <Typography variant="h4" color="success.main" sx={{ fontWeight: 800 }}>{availableCount}</Typography>
            <Typography variant="caption" color="text.secondary">대기</Typography>
          </CardContent></Card>
        </Grid>
        <Grid size={{ xs: 4 }}>
          <Card><CardContent sx={{ textAlign: 'center', py: 1.5 }}>
            <Typography variant="h4" color="info.main" sx={{ fontWeight: 800 }}>{transitCount}</Typography>
            <Typography variant="caption" color="text.secondary">운행</Typography>
          </CardContent></Card>
        </Grid>
        <Grid size={{ xs: 4 }}>
          <Card><CardContent sx={{ textAlign: 'center', py: 1.5 }}>
            <Typography variant="h4" color="text.secondary" sx={{ fontWeight: 800 }}>{offlineCount}</Typography>
            <Typography variant="caption" color="text.secondary">오프라인</Typography>
          </CardContent></Card>
        </Grid>
      </Grid>

      {/* Map */}
      <Card sx={{ mb: 3 }}>
        <CardContent sx={{ p: 0, '&:last-child': { pb: 0 } }}>
          <TrackingMap
            vehicles={vehicles}
            selectedVehicleId={selectedVehicleId}
            onVehicleClick={v => setSelectedVehicleId(v.id)}
            height={350}
          />
        </CardContent>
      </Card>

      {/* Tabs: Vehicles / Bookings */}
      <Tabs value={tab} onChange={(_, v) => setTab(v)} sx={{ mb: 2 }}>
        <Tab icon={<LocalTaxiIcon />} iconPosition="start" label={`차량 (${vehicles.length})`} />
        <Tab icon={<GpsFixedIcon />} iconPosition="start" label={`예약 (${bookings.length})`} />
      </Tabs>

      {tab === 0 && (
        <Card>
          <TableContainer>
            <Table size="small">
              <TableHead><TableRow>
                <TableCell>운전기사</TableCell>
                <TableCell>차량번호</TableCell>
                <TableCell>차종</TableCell>
                <TableCell>상태</TableCell>
                <TableCell>속도</TableCell>
                <TableCell align="right">관리</TableCell>
              </TableRow></TableHead>
              <TableBody>
                {vehicles.map(v => (
                  <TableRow key={v.id} hover selected={v.id === selectedVehicleId} onClick={() => setSelectedVehicleId(v.id)} sx={{ cursor: 'pointer' }}>
                    <TableCell><Typography variant="body2" sx={{ fontWeight: 600 }}>{v.driver_name}</Typography></TableCell>
                    <TableCell><Typography variant="caption">{v.plate_number}</Typography></TableCell>
                    <TableCell><Typography variant="caption">{v.vehicle_model}</Typography></TableCell>
                    <TableCell><Chip label={STATUS_LABELS[v.status]?.label} size="small" color={STATUS_LABELS[v.status]?.color} sx={{ height: 22 }} /></TableCell>
                    <TableCell><Typography variant="caption">{v.speed.toFixed(0)} km/h</Typography></TableCell>
                    <TableCell align="right">
                      {v.status === 'available' && (
                        <Button size="small" variant="text" sx={{ mr: 0.5, minWidth: 0, fontSize: '0.7rem' }} onClick={e => { e.stopPropagation(); startRoute(v.id); }}>출발</Button>
                      )}
                      <IconButton size="small" onClick={e => { e.stopPropagation(); openEdit(v); }}><EditIcon sx={{ fontSize: 16 }} /></IconButton>
                      <IconButton size="small" onClick={e => { e.stopPropagation(); handleDelete(v.id); }} sx={{ color: 'error.main' }}><DeleteIcon sx={{ fontSize: 16 }} /></IconButton>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </TableContainer>
        </Card>
      )}

      {tab === 1 && (
        <Card>
          <TableContainer>
            <Table size="small">
              <TableHead><TableRow>
                <TableCell>출발지</TableCell>
                <TableCell>도착지</TableCell>
                <TableCell>상태</TableCell>
                <TableCell>예약일시</TableCell>
                <TableCell align="right">배차</TableCell>
              </TableRow></TableHead>
              <TableBody>
                {bLoading ? (
                  <TableRow><TableCell colSpan={5}><Skeleton /></TableCell></TableRow>
                ) : bookings.map(b => (
                  <TableRow key={b.id} hover>
                    <TableCell><Typography variant="body2" sx={{ fontWeight: 600 }}>{b.pickup_name}</Typography></TableCell>
                    <TableCell><Typography variant="body2">{b.dropoff_name}</Typography></TableCell>
                    <TableCell><Chip label={BOOKING_STATUS[b.status]?.label} size="small" color={BOOKING_STATUS[b.status]?.color} sx={{ height: 22 }} /></TableCell>
                    <TableCell><Typography variant="caption">{new Date(b.scheduled_at).toLocaleString('ko-KR')}</Typography></TableCell>
                    <TableCell align="right">
                      {b.status === 'pending' && (
                        <Button size="small" variant="outlined" onClick={() => handleBookingStatus(b.id, 'confirmed')}>확정</Button>
                      )}
                      {b.status === 'confirmed' && (
                        <Button size="small" variant="contained" onClick={() => handleBookingStatus(b.id, 'in_progress')}>배차</Button>
                      )}
                      {b.status === 'in_progress' && (
                        <Button size="small" color="success" onClick={() => handleBookingStatus(b.id, 'completed')}>완료</Button>
                      )}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </TableContainer>
        </Card>
      )}

      {/* Vehicle Dialog */}
      <Dialog open={vehicleDialog} onClose={() => setVehicleDialog(false)} maxWidth="sm" fullWidth>
        <DialogTitle>{editingVehicle ? '차량 수정' : '차량 등록'}</DialogTitle>
        <DialogContent sx={{ display: 'flex', flexDirection: 'column', gap: 2, pt: '16px !important' }}>
          <TextField label="운전기사명" value={form.driver_name} onChange={e => setForm({ ...form, driver_name: e.target.value })} fullWidth size="small" />
          <TextField label="차량번호" value={form.plate_number} onChange={e => setForm({ ...form, plate_number: e.target.value })} fullWidth size="small" />
          <TextField label="연락처" value={form.phone} onChange={e => setForm({ ...form, phone: e.target.value })} fullWidth size="small" />
          <TextField label="차종" value={form.vehicle_model} onChange={e => setForm({ ...form, vehicle_model: e.target.value })} fullWidth size="small" />
          <TextField select label="상태" value={form.status} onChange={e => setForm({ ...form, status: e.target.value })} fullWidth size="small">
            <MenuItem value="available">대기</MenuItem>
            <MenuItem value="in_transit">운행</MenuItem>
            <MenuItem value="offline">오프라인</MenuItem>
            <MenuItem value="maintenance">정비</MenuItem>
          </TextField>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setVehicleDialog(false)}>취소</Button>
          <Button variant="contained" onClick={handleSave}>저장</Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
}
