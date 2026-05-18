import { useState } from 'react';
import Box from '@mui/material/Box';
import Typography from '@mui/material/Typography';
import TextField from '@mui/material/TextField';
import Button from '@mui/material/Button';
import Card from '@mui/material/Card';
import CardContent from '@mui/material/CardContent';
import Grid from '@mui/material/Grid';
import Stepper from '@mui/material/Stepper';
import Step from '@mui/material/Step';
import StepLabel from '@mui/material/StepLabel';
import Chip from '@mui/material/Chip';
import Alert from '@mui/material/Alert';
import Avatar from '@mui/material/Avatar';
import Rating from '@mui/material/Rating';
import CircularProgress from '@mui/material/CircularProgress';
import DirectionsCarIcon from '@mui/icons-material/DirectionsCar';
import { useNavigate } from 'react-router-dom';
import { useVehicleTracking } from '../../hooks/useVehicleTracking';
import { useBooking } from '../../hooks/useBooking';
import { useToast } from '../../components/common/ToastProvider';
import type { Vehicle } from '../../types';

const STEPS = ['출발/도착지', '차량 선택', '확인'];

const LOCATIONS = [
  { name: '강남역 3번 출구', lat: 37.4979, lng: 127.0276 },
  { name: '여의도 IFC', lat: 37.5252, lng: 126.9258 },
  { name: '서울역', lat: 37.5547, lng: 126.9707 },
  { name: '잠실 롯데타워', lat: 37.5126, lng: 127.1026 },
  { name: '홍대입구역', lat: 37.5563, lng: 126.9237 },
  { name: '광화문', lat: 37.5759, lng: 126.9769 },
  { name: '판교역', lat: 37.3947, lng: 127.1113 },
  { name: '인천공항 T1', lat: 37.4602, lng: 126.4407 },
];

export default function BookingPage() {
  const navigate = useNavigate();
  const { vehicles } = useVehicleTracking();
  const { createBooking } = useBooking();
  const { showToast } = useToast();
  const [step, setStep] = useState(0);
  const [pickup, setPickup] = useState('');
  const [dropoff, setDropoff] = useState('');
  const [selectedVehicle, setSelectedVehicle] = useState<Vehicle | null>(null);
  const [success, setSuccess] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  const availableVehicles = vehicles.filter(v => v.status === 'available');
  const pickupLoc = LOCATIONS.find(l => l.name === pickup);
  const dropoffLoc = LOCATIONS.find(l => l.name === dropoff);

  const canProceed = () => {
    if (step === 0) return !!pickupLoc && !!dropoffLoc && pickup !== dropoff;
    if (step === 1) return !!selectedVehicle;
    return true;
  };

  const handleConfirm = async () => {
    if (!pickupLoc || !dropoffLoc || !selectedVehicle) return;
    setSubmitting(true);
    try {
      await createBooking({
        vehicle_id: selectedVehicle.id,
        pickup_name: pickup,
        pickup_lat: pickupLoc.lat,
        pickup_lng: pickupLoc.lng,
        dropoff_name: dropoff,
        dropoff_lat: dropoffLoc.lat,
        dropoff_lng: dropoffLoc.lng,
        status: 'confirmed',
        scheduled_at: new Date().toISOString(),
      });
      setSuccess(true);
      showToast('예약이 완료되었습니다!', 'success');
    } catch {
      showToast('예약 처리 중 오류가 발생했습니다. 다시 시도해주세요.', 'error');
    } finally {
      setSubmitting(false);
    }
  };

  if (success) {
    return (
      <Box sx={{ p: 3, textAlign: 'center' }}>
        <Alert severity="success" sx={{ mb: 3 }}>예약이 완료되었습니다!</Alert>
        <Typography variant="h6" sx={{ fontWeight: 700, mb: 1 }}>{pickup} → {dropoff}</Typography>
        <Typography variant="body2" color="text.secondary" sx={{ mb: 3 }}>
          {selectedVehicle?.driver_name} ({selectedVehicle?.plate_number})
        </Typography>
        <Box sx={{ display: 'flex', gap: 1, justifyContent: 'center' }}>
          <Button variant="contained" onClick={() => navigate('/tracking')}>대시보드</Button>
          <Button variant="outlined" onClick={() => navigate(`/tracking/track/${selectedVehicle?.id}`)}>추적하기</Button>
        </Box>
      </Box>
    );
  }

  return (
    <Box sx={{ p: { xs: 2, md: 3 } }}>
      <Typography variant="h5" sx={{ fontWeight: 800, mb: 3 }}>차량 예약</Typography>

      <Stepper activeStep={step} sx={{ mb: 3 }}>
        {STEPS.map(label => <Step key={label}><StepLabel>{label}</StepLabel></Step>)}
      </Stepper>

      {step === 0 && (
        <Card>
          <CardContent sx={{ display: 'flex', flexDirection: 'column', gap: 2.5, p: 3 }}>
            <TextField
              select label="출발지" value={pickup}
              onChange={e => setPickup(e.target.value)} fullWidth
              slotProps={{ select: { native: true } }}
            >
              <option value="">선택하세요</option>
              {LOCATIONS.map(l => <option key={l.name} value={l.name}>{l.name}</option>)}
            </TextField>
            <TextField
              select label="도착지" value={dropoff}
              onChange={e => setDropoff(e.target.value)} fullWidth
              slotProps={{ select: { native: true } }}
            >
              <option value="">선택하세요</option>
              {LOCATIONS.filter(l => l.name !== pickup).map(l => <option key={l.name} value={l.name}>{l.name}</option>)}
            </TextField>
          </CardContent>
        </Card>
      )}

      {step === 1 && (
        <Box>
          {availableVehicles.length === 0 ? (
            <Alert severity="info">현재 대기중인 차량이 없습니다.</Alert>
          ) : (
            <Grid container spacing={2}>
              {availableVehicles.map(v => (
                <Grid size={{ xs: 12, sm: 6 }} key={v.id}>
                  <Card
                    onClick={() => setSelectedVehicle(v)}
                    sx={{
                      cursor: 'pointer',
                      border: 2,
                      borderColor: selectedVehicle?.id === v.id ? 'primary.main' : 'transparent',
                      transition: 'all 0.2s',
                      '&:hover': { borderColor: 'primary.light' },
                    }}
                  >
                    <CardContent sx={{ display: 'flex', gap: 2, alignItems: 'center' }}>
                      <Avatar sx={{ bgcolor: 'primary.main' }}>
                        <DirectionsCarIcon />
                      </Avatar>
                      <Box sx={{ flex: 1 }}>
                        <Typography variant="subtitle2" sx={{ fontWeight: 700 }}>{v.driver_name}</Typography>
                        <Typography variant="caption" color="text.secondary">{v.plate_number} | {v.vehicle_model}</Typography>
                        <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5, mt: 0.5 }}>
                          <Rating value={v.rating} readOnly size="small" precision={0.1} />
                          <Typography variant="caption">{v.rating.toFixed(1)}</Typography>
                        </Box>
                      </Box>
                      {selectedVehicle?.id === v.id && <Chip label="선택됨" color="primary" size="small" />}
                    </CardContent>
                  </Card>
                </Grid>
              ))}
            </Grid>
          )}
        </Box>
      )}

      {step === 2 && (
        <Card>
          <CardContent sx={{ p: 3 }}>
            <Typography variant="subtitle1" sx={{ fontWeight: 700, mb: 2 }}>예약 확인</Typography>
            <Grid container spacing={2}>
              <Grid size={{ xs: 12, sm: 6 }}>
                <Typography variant="caption" color="text.secondary">출발지</Typography>
                <Typography variant="body1" sx={{ fontWeight: 600 }}>{pickup}</Typography>
              </Grid>
              <Grid size={{ xs: 12, sm: 6 }}>
                <Typography variant="caption" color="text.secondary">도착지</Typography>
                <Typography variant="body1" sx={{ fontWeight: 600 }}>{dropoff}</Typography>
              </Grid>
              <Grid size={{ xs: 12, sm: 6 }}>
                <Typography variant="caption" color="text.secondary">운전기사</Typography>
                <Typography variant="body1" sx={{ fontWeight: 600 }}>{selectedVehicle?.driver_name}</Typography>
              </Grid>
              <Grid size={{ xs: 12, sm: 6 }}>
                <Typography variant="caption" color="text.secondary">차량</Typography>
                <Typography variant="body1" sx={{ fontWeight: 600 }}>{selectedVehicle?.plate_number}</Typography>
              </Grid>
            </Grid>
          </CardContent>
        </Card>
      )}

      {/* Navigation */}
      <Box sx={{ display: 'flex', justifyContent: 'space-between', mt: 3 }}>
        <Button disabled={step === 0 || submitting} onClick={() => setStep(s => s - 1)}>이전</Button>
        {step < 2 ? (
          <Button variant="contained" disabled={!canProceed()} onClick={() => setStep(s => s + 1)}>다음</Button>
        ) : (
          <Button
            variant="contained"
            color="primary"
            onClick={handleConfirm}
            disabled={submitting}
            endIcon={submitting ? <CircularProgress size={18} color="inherit" /> : undefined}
          >
            {submitting ? '처리중...' : '예약 확정'}
          </Button>
        )}
      </Box>
    </Box>
  );
}
