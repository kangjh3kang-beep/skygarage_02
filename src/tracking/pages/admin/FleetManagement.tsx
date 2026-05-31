import { useState, useCallback, useEffect, useRef } from 'react';
import Box from '@mui/material/Box';
import Typography from '@mui/material/Typography';
import Grid from '@mui/material/Grid';
import Card from '@mui/material/Card';
import CardContent from '@mui/material/CardContent';
import Paper from '@mui/material/Paper';
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
import InputAdornment from '@mui/material/InputAdornment';
import AddIcon from '@mui/icons-material/Add';
import EditIcon from '@mui/icons-material/Edit';
import DeleteIcon from '@mui/icons-material/Delete';
import GpsFixedIcon from '@mui/icons-material/GpsFixed';
import LocalTaxiIcon from '@mui/icons-material/LocalTaxi';
import PlayArrowIcon from '@mui/icons-material/PlayArrow';
import StopIcon from '@mui/icons-material/Stop';
import FastForwardIcon from '@mui/icons-material/FastForward';
import SearchIcon from '@mui/icons-material/Search';
import LockIcon from '@mui/icons-material/Lock';
import { useToast } from '../../components/common/ToastProvider';
import { useVehicleTracking } from '../../hooks/useVehicleTracking';
import { useBooking } from '../../hooks/useBooking';
import { vehicleService, bookingService } from '../../services/trackingService';
import TrackingMap from '../../components/Map/TrackingMap';
import type { Vehicle } from '../../types';

const ADMIN_PIN = '1234';

function AdminGate({ children }: { children: React.ReactNode }) {
  const [authorized, setAuthorized] = useState(() => sessionStorage.getItem('fleet_auth') === 'true');
  const [pin, setPin] = useState('');
  const [error, setError] = useState(false);

  if (authorized) return <>{children}</>;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (pin === ADMIN_PIN) {
      sessionStorage.setItem('fleet_auth', 'true');
      setAuthorized(true);
    } else {
      setError(true);
      setPin('');
    }
  };

  return (
    <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', minHeight: '60vh', p: 3 }}>
      <Paper sx={{ p: 4, textAlign: 'center', maxWidth: 360, width: '100%' }}>
        <LockIcon sx={{ fontSize: 48, color: 'text.secondary', mb: 2 }} />
        <Typography variant="h6" sx={{ fontWeight: 700, mb: 1 }}>관리자 인증</Typography>
        <Typography variant="body2" color="text.secondary" sx={{ mb: 3 }}>
          차량 관제 페이지에 접근하려면 관리자 PIN을 입력하세요.
        </Typography>
        <form onSubmit={handleSubmit}>
          <TextField
            fullWidth
            size="small"
            type="password"
            label="PIN 입력"
            value={pin}
            onChange={e => { setPin(e.target.value); setError(false); }}
            error={error}
            helperText={error ? 'PIN이 올바르지 않습니다.' : ' '}
            autoFocus
            sx={{ mb: 2 }}
          />
          <Button variant="contained" fullWidth type="submit" disabled={!pin}>확인</Button>
        </form>
      </Paper>
    </Box>
  );
}

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

  const { showToast } = useToast();
  const [searchQuery, setSearchQuery] = useState('');
  const [deleteConfirmId, setDeleteConfirmId] = useState<string | null>(null);

  const openAdd = () => { setEditingVehicle(null); setForm({ driver_name: '', plate_number: '', phone: '', vehicle_model: '', status: 'available' }); setVehicleDialog(true); };
  const openEdit = (v: Vehicle) => { setEditingVehicle(v); setForm({ driver_name: v.driver_name, plate_number: v.plate_number, phone: v.phone, vehicle_model: v.vehicle_model, status: v.status }); setVehicleDialog(true); };

  const handleSave = useCallback(async () => {
    try {
      if (editingVehicle) {
        await vehicleService.updateStatus(editingVehicle.id, form.status as Vehicle['status']);
        showToast('차량 정보가 수정되었습니다.', 'success');
      } else {
        await vehicleService.create(form as Partial<Vehicle>);
        showToast('차량이 등록되었습니다.', 'success');
      }
      setVehicleDialog(false);
      refresh();
    } catch {
      showToast('저장 중 오류가 발생했습니다.', 'error');
    }
  }, [editingVehicle, form, refresh, showToast]);

  const handleDeleteConfirm = useCallback(async () => {
    if (!deleteConfirmId) return;
    try {
      await vehicleService.delete(deleteConfirmId);
      showToast('차량이 삭제되었습니다.', 'success');
      refresh();
    } catch {
      showToast('삭제 중 오류가 발생했습니다.', 'error');
    } finally {
      setDeleteConfirmId(null);
    }
  }, [deleteConfirmId, refresh, showToast]);

  const handleBookingStatus = useCallback(async (id: string, status: string) => {
    try {
      await bookingService.updateStatus(id, status as 'confirmed' | 'in_progress' | 'completed' | 'cancelled');
      showToast('예약 상태가 변경되었습니다.', 'success');
      refreshBookings();
    } catch {
      showToast('상태 변경 중 오류가 발생했습니다.', 'error');
    }
  }, [refreshBookings, showToast]);

  const seedDemoData = useCallback(async () => {
    try {
      const demoVehicles = [
        { driver_name: '김민수', plate_number: '서울 12가 3456', phone: '010-1234-5678', vehicle_model: 'Genesis G80', current_lat: 37.4979, current_lng: 127.0276 },
        { driver_name: '이영진', plate_number: '서울 34나 7890', phone: '010-2345-6789', vehicle_model: 'Mercedes S-Class', current_lat: 37.5252, current_lng: 126.9258 },
        { driver_name: '박서준', plate_number: '경기 56다 1234', phone: '010-3456-7890', vehicle_model: 'BMW 7 Series', current_lat: 37.5547, current_lng: 126.9707 },
        { driver_name: '최하나', plate_number: '서울 78라 5678', phone: '010-4567-8901', vehicle_model: 'Audi A8', current_lat: 37.5126, current_lng: 127.1026 },
        { driver_name: '정우성', plate_number: '경기 90마 9012', phone: '010-5678-9012', vehicle_model: 'Tesla Model S', current_lat: 37.3947, current_lng: 127.1113 },
      ];
      for (const v of demoVehicles) {
        await vehicleService.create({ ...v, status: 'available' });
      }
      showToast(`${demoVehicles.length}대 데모 차량이 추가되었습니다.`, 'success');
      refresh();
    } catch {
      showToast('데모 데이터 생성 중 오류가 발생했습니다.', 'error');
    }
  }, [refresh, showToast]);

  const filteredVehicles = vehicles.filter(v =>
    !searchQuery ||
    v.driver_name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    v.plate_number.toLowerCase().includes(searchQuery.toLowerCase()) ||
    v.vehicle_model.toLowerCase().includes(searchQuery.toLowerCase())
  );

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
    <AdminGate>
    <Box sx={{ p: { xs: 2, md: 3 } }}>
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 3 }}>
        <Typography variant="h5" sx={{ fontWeight: 800 }}>차량 관제</Typography>
        <Box sx={{ display: 'flex', gap: 1 }}>
          {vehicles.length === 0 && (
            <Button variant="outlined" size="small" onClick={seedDemoData}>데모 데이터 생성</Button>
          )}
          <Button variant="contained" startIcon={<AddIcon />} onClick={openAdd} size="small">차량 등록</Button>
        </Box>
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
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 2, mb: 2 }}>
        <Tabs value={tab} onChange={(_, v) => setTab(v)} sx={{ flex: 1 }}>
          <Tab icon={<LocalTaxiIcon />} iconPosition="start" label={`차량 (${filteredVehicles.length})`} />
          <Tab icon={<GpsFixedIcon />} iconPosition="start" label={`예약 (${bookings.length})`} />
        </Tabs>
        {tab === 0 && (
          <TextField
            size="small"
            placeholder="검색 (이름, 차량번호, 차종)"
            value={searchQuery}
            onChange={e => setSearchQuery(e.target.value)}
            sx={{ width: 240 }}
            slotProps={{ input: { startAdornment: <InputAdornment position="start"><SearchIcon sx={{ fontSize: 18 }} /></InputAdornment> } }}
          />
        )}
      </Box>

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
                {filteredVehicles.length === 0 ? (
                  <TableRow><TableCell colSpan={6} sx={{ textAlign: 'center', py: 4 }}><Typography variant="body2" color="text.secondary">검색 결과가 없습니다.</Typography></TableCell></TableRow>
                ) : filteredVehicles.map(v => (
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
                      <IconButton size="small" onClick={e => { e.stopPropagation(); setDeleteConfirmId(v.id); }} sx={{ color: 'error.main' }}><DeleteIcon sx={{ fontSize: 16 }} /></IconButton>
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

      {/* Delete Confirmation Dialog */}
      <Dialog open={!!deleteConfirmId} onClose={() => setDeleteConfirmId(null)}>
        <DialogTitle>차량 삭제 확인</DialogTitle>
        <DialogContent>
          <Typography variant="body2">
            이 차량을 삭제하시겠습니까? 관련된 경로 및 예약 데이터에 영향을 줄 수 있습니다.
          </Typography>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setDeleteConfirmId(null)}>취소</Button>
          <Button variant="contained" color="error" onClick={handleDeleteConfirm}>삭제</Button>
        </DialogActions>
      </Dialog>
    </Box>
    </AdminGate>
  );
}
