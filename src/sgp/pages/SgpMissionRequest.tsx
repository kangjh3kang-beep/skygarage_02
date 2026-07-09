import { useState, useEffect } from 'react';
import Box from '@mui/material/Box';
import Typography from '@mui/material/Typography';
import Card from '@mui/material/Card';
import CardContent from '@mui/material/CardContent';
import Button from '@mui/material/Button';
import CircularProgress from '@mui/material/CircularProgress';
import MenuItem from '@mui/material/MenuItem';
import TextField from '@mui/material/TextField';
import { useNavigate } from 'react-router-dom';
import { useSgpAuth } from '../contexts/SgpAuthContext';
import { listVehicles } from '../services/vehicleService';
import { listPlaces } from '../services/placeService';
import { requestMission } from '../services/missionService';
import type { Vehicle, Place, MissionType } from '../types';

const MISSION_TYPES: { value: MissionType; label: string }[] = [
  { value: 'DIRECT_UNIT_EXIT', label: '직접 출차' },
  { value: 'DIRECT_UNIT_ENTRY', label: '직접 입차' },
  { value: 'AUTO_VALET_CHECKIN', label: '자동 발렛 입차' },
  { value: 'AUTO_VALET_EXIT', label: '자동 발렛 출차' },
  { value: 'SCHEDULED', label: '예약 호출' },
];

export default function SgpMissionRequest() {
  const { user } = useSgpAuth();
  const navigate = useNavigate();
  const [vehicles, setVehicles] = useState<Vehicle[]>([]);
  const [places, setPlaces] = useState<Place[]>([]);
  const [selectedVehicle, setSelectedVehicle] = useState('');
  const [selectedPlace, setSelectedPlace] = useState('');
  const [missionType, setMissionType] = useState<MissionType>('DIRECT_UNIT_EXIT');
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!user) return;
    Promise.all([listVehicles(user.id), listPlaces(user.id)])
      .then(([v, p]) => {
        setVehicles(v);
        setPlaces(p.filter(pl => pl.grantStatus === 'ACTIVE'));
        const defaultV = v.find(x => x.isDefault);
        if (defaultV) setSelectedVehicle(defaultV.id);
        const defaultP = p.find(x => x.isDefault);
        if (defaultP) setSelectedPlace(defaultP.id);
      })
      .catch(err => setError((err as Error).message))
      .finally(() => setLoading(false));
  }, [user]);

  async function handleSubmit() {
    if (!user || !selectedVehicle || !selectedPlace) return;
    setSubmitting(true);
    setError(null);
    try {
      const place = places.find(p => p.id === selectedPlace)!;
      await requestMission({
        userId: user.id,
        siteId: place.siteId,
        placeId: place.id,
        vehicleId: selectedVehicle,
        type: missionType,
      });
      navigate('/app/missions');
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setSubmitting(false);
    }
  }

  if (loading) {
    return (
      <Box sx={{ display: 'flex', justifyContent: 'center', py: 8 }}>
        <CircularProgress sx={{ color: '#00d4aa' }} />
      </Box>
    );
  }

  return (
    <Box sx={{ p: 2 }}>
      <Typography variant="subtitle1" sx={{ color: '#fff', fontWeight: 700, mb: 2 }}>차량 호출</Typography>

      {error && (
        <Typography variant="body2" color="error" sx={{ mb: 2 }}>{error}</Typography>
      )}

      <Card sx={{ bgcolor: 'rgba(255,255,255,0.03)', borderRadius: 2, mb: 2 }}>
        <CardContent sx={{ display: 'flex', flexDirection: 'column', gap: 2.5, p: 2.5 }}>
          <TextField
            select
            label="차량 선택"
            value={selectedVehicle}
            onChange={e => setSelectedVehicle(e.target.value)}
            fullWidth
            size="small"
            sx={{ '& .MuiInputBase-root': { color: '#fff' }, '& .MuiInputLabel-root': { color: 'rgba(255,255,255,0.5)' } }}
          >
            {vehicles.length === 0 ? (
              <MenuItem value="" disabled>등록된 차량이 없습니다</MenuItem>
            ) : vehicles.map(v => (
              <MenuItem key={v.id} value={v.id}>{v.plate} ({v.brand} {v.model})</MenuItem>
            ))}
          </TextField>

          <TextField
            select
            label="장소 선택"
            value={selectedPlace}
            onChange={e => setSelectedPlace(e.target.value)}
            fullWidth
            size="small"
            sx={{ '& .MuiInputBase-root': { color: '#fff' }, '& .MuiInputLabel-root': { color: 'rgba(255,255,255,0.5)' } }}
          >
            {places.length === 0 ? (
              <MenuItem value="" disabled>등록된 장소가 없습니다</MenuItem>
            ) : places.map(p => (
              <MenuItem key={p.id} value={p.id}>{p.label} ({p.siteName})</MenuItem>
            ))}
          </TextField>

          <TextField
            select
            label="미션 유형"
            value={missionType}
            onChange={e => setMissionType(e.target.value as MissionType)}
            fullWidth
            size="small"
            sx={{ '& .MuiInputBase-root': { color: '#fff' }, '& .MuiInputLabel-root': { color: 'rgba(255,255,255,0.5)' } }}
          >
            {MISSION_TYPES.map(t => (
              <MenuItem key={t.value} value={t.value}>{t.label}</MenuItem>
            ))}
          </TextField>
        </CardContent>
      </Card>

      <Button
        variant="contained"
        fullWidth
        onClick={handleSubmit}
        disabled={submitting || !selectedVehicle || !selectedPlace}
        sx={{ py: 1.5, fontWeight: 700, bgcolor: '#00d4aa', color: '#0d1b2a', '&:hover': { bgcolor: '#00b894' }, '&.Mui-disabled': { bgcolor: 'rgba(0,212,170,0.2)' } }}
      >
        {submitting ? '요청중...' : '호출 요청'}
      </Button>
    </Box>
  );
}
