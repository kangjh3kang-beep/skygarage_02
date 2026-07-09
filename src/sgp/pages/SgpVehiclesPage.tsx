import { useState, useEffect } from 'react';
import Box from '@mui/material/Box';
import Typography from '@mui/material/Typography';
import Card from '@mui/material/Card';
import CardContent from '@mui/material/CardContent';
import Button from '@mui/material/Button';
import IconButton from '@mui/material/IconButton';
import Dialog from '@mui/material/Dialog';
import DialogTitle from '@mui/material/DialogTitle';
import DialogContent from '@mui/material/DialogContent';
import DialogActions from '@mui/material/DialogActions';
import TextField from '@mui/material/TextField';
import Chip from '@mui/material/Chip';
import CircularProgress from '@mui/material/CircularProgress';
import AddIcon from '@mui/icons-material/Add';
import DeleteIcon from '@mui/icons-material/Delete';
import StarIcon from '@mui/icons-material/Star';
import DirectionsCarIcon from '@mui/icons-material/DirectionsCar';
import { useSgpAuth } from '../contexts/SgpAuthContext';
import { listVehicles, addVehicle, deleteVehicle, setDefaultVehicle } from '../services/vehicleService';
import type { Vehicle } from '../types';

const EMPTY_FORM = { plate: '', brand: '', model: '', color: '' };

export default function SgpVehiclesPage() {
  const { user } = useSgpAuth();
  const [vehicles, setVehicles] = useState<Vehicle[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [form, setForm] = useState(EMPTY_FORM);
  const [submitting, setSubmitting] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<Vehicle | null>(null);

  useEffect(() => {
    if (!user) return;
    loadData();
  }, [user]);

  async function loadData() {
    setLoading(true);
    setError(null);
    try {
      const data = await listVehicles(user!.id);
      setVehicles(data);
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setLoading(false);
    }
  }

  async function handleAdd() {
    if (!user || !form.plate) return;
    setSubmitting(true);
    try {
      await addVehicle(user.id, { ...form, isDefault: vehicles.length === 0 });
      setDialogOpen(false);
      setForm(EMPTY_FORM);
      await loadData();
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setSubmitting(false);
    }
  }

  async function handleDelete() {
    if (!deleteTarget) return;
    try {
      await deleteVehicle(deleteTarget.id);
      setDeleteTarget(null);
      await loadData();
    } catch (err) {
      setError((err as Error).message);
    }
  }

  async function handleSetDefault(vehicleId: string) {
    if (!user) return;
    try {
      await setDefaultVehicle(user.id, vehicleId);
      await loadData();
    } catch (err) {
      setError((err as Error).message);
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
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2 }}>
        <Typography variant="subtitle1" sx={{ color: '#fff', fontWeight: 700 }}>내 차량</Typography>
        <Button
          startIcon={<AddIcon />}
          size="small"
          onClick={() => setDialogOpen(true)}
          sx={{ color: '#00d4aa', fontWeight: 600 }}
        >
          추가
        </Button>
      </Box>

      {error && <Typography variant="body2" color="error" sx={{ mb: 2 }}>{error}</Typography>}

      {vehicles.length === 0 ? (
        <Box sx={{ textAlign: 'center', py: 6 }}>
          <DirectionsCarIcon sx={{ fontSize: 48, color: 'rgba(255,255,255,0.2)', mb: 1 }} />
          <Typography variant="body2" sx={{ color: 'rgba(255,255,255,0.4)' }}>등록된 차량이 없습니다</Typography>
        </Box>
      ) : (
        vehicles.map(v => (
          <Card key={v.id} sx={{ mb: 1.5, bgcolor: 'rgba(255,255,255,0.03)', borderRadius: 2, border: v.isDefault ? '1px solid rgba(0,212,170,0.3)' : 'none' }}>
            <CardContent sx={{ p: 2, '&:last-child': { pb: 2 } }}>
              <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <Box>
                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 0.5 }}>
                    <Typography variant="body1" sx={{ color: '#fff', fontWeight: 700 }}>{v.plate}</Typography>
                    {v.isDefault && <Chip label="기본" size="small" sx={{ bgcolor: 'rgba(0,212,170,0.15)', color: '#00d4aa', height: 20, fontSize: '0.7rem' }} />}
                    {v.isVerified && <Chip label="인증" size="small" color="success" sx={{ height: 20, fontSize: '0.7rem' }} />}
                  </Box>
                  <Typography variant="caption" sx={{ color: 'rgba(255,255,255,0.5)' }}>
                    {v.brand} {v.model} {v.color && `/ ${v.color}`}
                  </Typography>
                </Box>
                <Box>
                  {!v.isDefault && (
                    <IconButton size="small" onClick={() => handleSetDefault(v.id)} sx={{ color: 'rgba(255,255,255,0.3)' }}>
                      <StarIcon sx={{ fontSize: 18 }} />
                    </IconButton>
                  )}
                  <IconButton size="small" onClick={() => setDeleteTarget(v)} sx={{ color: 'rgba(255,100,100,0.6)' }}>
                    <DeleteIcon sx={{ fontSize: 18 }} />
                  </IconButton>
                </Box>
              </Box>
            </CardContent>
          </Card>
        ))
      )}

      {/* Add Dialog */}
      <Dialog open={dialogOpen} onClose={() => setDialogOpen(false)} maxWidth="xs" fullWidth slotProps={{ paper: { sx: { bgcolor: '#1a2d42', color: '#fff' } } }}>
        <DialogTitle sx={{ fontWeight: 700 }}>차량 등록</DialogTitle>
        <DialogContent sx={{ display: 'flex', flexDirection: 'column', gap: 2, pt: '16px !important' }}>
          <TextField label="차량번호" value={form.plate} onChange={e => setForm({ ...form, plate: e.target.value })} fullWidth size="small" sx={{ '& .MuiInputBase-root': { color: '#fff' } }} />
          <TextField label="브랜드" value={form.brand} onChange={e => setForm({ ...form, brand: e.target.value })} fullWidth size="small" sx={{ '& .MuiInputBase-root': { color: '#fff' } }} />
          <TextField label="모델" value={form.model} onChange={e => setForm({ ...form, model: e.target.value })} fullWidth size="small" sx={{ '& .MuiInputBase-root': { color: '#fff' } }} />
          <TextField label="색상" value={form.color} onChange={e => setForm({ ...form, color: e.target.value })} fullWidth size="small" sx={{ '& .MuiInputBase-root': { color: '#fff' } }} />
        </DialogContent>
        <DialogActions sx={{ px: 3, pb: 3 }}>
          <Button onClick={() => setDialogOpen(false)} sx={{ color: 'rgba(255,255,255,0.5)' }}>취소</Button>
          <Button variant="contained" onClick={handleAdd} disabled={!form.plate || submitting} sx={{ bgcolor: '#00d4aa', color: '#0d1b2a', fontWeight: 700 }}>
            {submitting ? '등록중...' : '등록'}
          </Button>
        </DialogActions>
      </Dialog>

      {/* Delete Confirmation */}
      <Dialog open={!!deleteTarget} onClose={() => setDeleteTarget(null)} maxWidth="xs" slotProps={{ paper: { sx: { bgcolor: '#1a2d42', color: '#fff' } } }}>
        <DialogTitle>차량 삭제</DialogTitle>
        <DialogContent>
          <Typography variant="body2" sx={{ color: 'rgba(255,255,255,0.7)' }}>
            "{deleteTarget?.plate}" 차량을 삭제하시겠습니까?
          </Typography>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setDeleteTarget(null)} sx={{ color: 'rgba(255,255,255,0.5)' }}>취소</Button>
          <Button variant="contained" color="error" onClick={handleDelete}>삭제</Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
}
