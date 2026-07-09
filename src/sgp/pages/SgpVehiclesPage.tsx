import { useState, useEffect } from 'react';
import Box from '@mui/material/Box';
import Typography from '@mui/material/Typography';
import Card from '@mui/material/Card';
import CardContent from '@mui/material/CardContent';
import Button from '@mui/material/Button';
import TextField from '@mui/material/TextField';
import Dialog from '@mui/material/Dialog';
import DialogTitle from '@mui/material/DialogTitle';
import DialogContent from '@mui/material/DialogContent';
import DialogActions from '@mui/material/DialogActions';
import Chip from '@mui/material/Chip';
import IconButton from '@mui/material/IconButton';
import Alert from '@mui/material/Alert';
import Skeleton from '@mui/material/Skeleton';
import DirectionsCarIcon from '@mui/icons-material/DirectionsCar';
import AddIcon from '@mui/icons-material/Add';
import StarIcon from '@mui/icons-material/Star';
import DeleteIcon from '@mui/icons-material/Delete';
import { useSgpAuth } from '../contexts/SgpAuthContext';
import { getVehicles, addVehicle, removeVehicle, setDefaultVehicle } from '../services/vehicleService';
import type { Vehicle } from '../types';

export default function SgpVehiclesPage() {
  const { user } = useSgpAuth();
  const [vehicles, setVehicles] = useState<Vehicle[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [dialogOpen, setDialogOpen] = useState(false);
  const [plate, setPlate] = useState('');
  const [brand, setBrand] = useState('');
  const [model, setModel] = useState('');
  const [color, setColor] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [formError, setFormError] = useState('');

  useEffect(() => {
    if (!user) return;
    loadVehicles();
  }, [user]);

  async function loadVehicles() {
    if (!user) return;
    setLoading(true);
    setError('');
    try {
      const data = await getVehicles(user.id);
      setVehicles(data);
    } catch {
      setError('차량 정보를 불러올 수 없습니다.');
    }
    setLoading(false);
  }

  async function handleAdd() {
    if (!user || !plate.trim()) return;
    setSubmitting(true);
    setFormError('');
    const result = await addVehicle(user.id, plate.trim(), brand.trim(), model.trim(), color.trim());
    if (result.success) {
      setDialogOpen(false);
      setPlate(''); setBrand(''); setModel(''); setColor('');
      await loadVehicles();
    } else {
      setFormError(result.error ?? '등록에 실패했습니다.');
    }
    setSubmitting(false);
  }

  async function handleRemove(id: string) {
    await removeVehicle(id);
    await loadVehicles();
  }

  async function handleSetDefault(id: string) {
    if (!user) return;
    await setDefaultVehicle(user.id, id);
    await loadVehicles();
  }

  if (loading) {
    return (
      <Box sx={{ px: 2, pt: 3 }}>
        <Typography variant="h6" sx={{ color: '#fff', fontWeight: 700, mb: 2 }}>내 차량</Typography>
        {[1, 2].map(i => (
          <Skeleton key={i} variant="rounded" height={80} sx={{ mb: 1.5, bgcolor: 'rgba(255,255,255,0.05)', borderRadius: 3 }} />
        ))}
      </Box>
    );
  }

  if (error) {
    return (
      <Box sx={{ px: 2, pt: 3 }}>
        <Alert severity="error" sx={{ borderRadius: 2 }}>{error}</Alert>
        <Button onClick={loadVehicles} sx={{ mt: 2, color: '#00d4aa' }}>다시 시도</Button>
      </Box>
    );
  }

  return (
    <Box sx={{ px: 2, pt: 3, pb: 10 }}>
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2 }}>
        <Typography variant="h6" sx={{ color: '#fff', fontWeight: 700 }}>내 차량</Typography>
        <Button
          size="small"
          startIcon={<AddIcon />}
          onClick={() => setDialogOpen(true)}
          sx={{ color: '#00d4aa', fontSize: '0.78rem' }}
        >
          차량 추가
        </Button>
      </Box>

      {vehicles.length === 0 && (
        <Box sx={{ textAlign: 'center', mt: 6 }}>
          <DirectionsCarIcon sx={{ fontSize: 48, color: 'rgba(255,255,255,0.2)', mb: 1 }} />
          <Typography variant="body2" sx={{ color: 'rgba(255,255,255,0.4)', mb: 2 }}>
            등록된 차량이 없습니다
          </Typography>
          <Button
            variant="contained"
            startIcon={<AddIcon />}
            onClick={() => setDialogOpen(true)}
            sx={{ bgcolor: '#00d4aa', color: '#0d1b2a', fontWeight: 700, borderRadius: 3 }}
          >
            첫 차량 등록
          </Button>
        </Box>
      )}

      {vehicles.map(v => (
        <Card key={v.id} sx={{ bgcolor: 'rgba(255,255,255,0.04)', border: `1px solid ${v.isDefault ? 'rgba(0,212,170,0.2)' : 'rgba(255,255,255,0.08)'}`, borderRadius: 3, mb: 1.5 }}>
          <CardContent sx={{ p: 2, '&:last-child': { pb: 2 }, display: 'flex', alignItems: 'center', gap: 1.5 }}>
            <Box sx={{
              width: 40, height: 40, borderRadius: 2,
              bgcolor: v.isDefault ? 'rgba(0,212,170,0.1)' : 'rgba(255,255,255,0.05)',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
            }}>
              <DirectionsCarIcon sx={{ color: v.isDefault ? '#00d4aa' : 'rgba(255,255,255,0.4)' }} />
            </Box>
            <Box sx={{ flex: 1 }}>
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
                <Typography variant="subtitle2" sx={{ color: '#fff', fontWeight: 600 }}>{v.plate}</Typography>
                {v.isDefault && <Chip label="기본" size="small" sx={{ height: 18, fontSize: '0.6rem', bgcolor: 'rgba(0,212,170,0.1)', color: '#00d4aa' }} />}
              </Box>
              <Typography variant="caption" sx={{ color: 'rgba(255,255,255,0.4)' }}>
                {[v.brand, v.model, v.color].filter(Boolean).join(' · ') || '정보 없음'}
              </Typography>
            </Box>
            {!v.isDefault && (
              <IconButton size="small" onClick={() => handleSetDefault(v.id)} sx={{ color: 'rgba(255,255,255,0.3)' }}>
                <StarIcon sx={{ fontSize: 18 }} />
              </IconButton>
            )}
            <IconButton size="small" onClick={() => handleRemove(v.id)} sx={{ color: 'rgba(255,82,82,0.6)' }}>
              <DeleteIcon sx={{ fontSize: 18 }} />
            </IconButton>
          </CardContent>
        </Card>
      ))}

      <Dialog open={dialogOpen} onClose={() => setDialogOpen(false)} maxWidth="xs" fullWidth slotProps={{ paper: { sx: { bgcolor: '#1a2d42', color: '#fff' } } }}>
        <DialogTitle sx={{ fontWeight: 700 }}>차량 등록</DialogTitle>
        <DialogContent>
          {formError && <Alert severity="error" sx={{ mb: 2, borderRadius: 2 }}>{formError}</Alert>}
          <TextField
            fullWidth size="small" label="차량 번호" placeholder="12가 3456"
            value={plate} onChange={e => setPlate(e.target.value)}
            sx={{ mb: 2, mt: 1, '& .MuiOutlinedInput-root': { bgcolor: 'rgba(255,255,255,0.05)', color: '#fff', borderRadius: 2 }, '& .MuiInputLabel-root': { color: 'rgba(255,255,255,0.4)' } }}
          />
          <TextField
            fullWidth size="small" label="제조사" placeholder="현대"
            value={brand} onChange={e => setBrand(e.target.value)}
            sx={{ mb: 2, '& .MuiOutlinedInput-root': { bgcolor: 'rgba(255,255,255,0.05)', color: '#fff', borderRadius: 2 }, '& .MuiInputLabel-root': { color: 'rgba(255,255,255,0.4)' } }}
          />
          <TextField
            fullWidth size="small" label="모델명" placeholder="아이오닉 5"
            value={model} onChange={e => setModel(e.target.value)}
            sx={{ mb: 2, '& .MuiOutlinedInput-root': { bgcolor: 'rgba(255,255,255,0.05)', color: '#fff', borderRadius: 2 }, '& .MuiInputLabel-root': { color: 'rgba(255,255,255,0.4)' } }}
          />
          <TextField
            fullWidth size="small" label="색상" placeholder="흰색"
            value={color} onChange={e => setColor(e.target.value)}
            sx={{ '& .MuiOutlinedInput-root': { bgcolor: 'rgba(255,255,255,0.05)', color: '#fff', borderRadius: 2 }, '& .MuiInputLabel-root': { color: 'rgba(255,255,255,0.4)' } }}
          />
        </DialogContent>
        <DialogActions sx={{ px: 3, pb: 3 }}>
          <Button onClick={() => setDialogOpen(false)} sx={{ color: 'rgba(255,255,255,0.5)' }}>취소</Button>
          <Button
            variant="contained" onClick={handleAdd}
            disabled={submitting || !plate.trim()}
            sx={{ bgcolor: '#00d4aa', color: '#0d1b2a', fontWeight: 700, '&:hover': { bgcolor: '#00b894' } }}
          >
            {submitting ? '등록중...' : '등록하기'}
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
}
