import { useState, useEffect } from 'react';
import Box from '@mui/material/Box';
import Typography from '@mui/material/Typography';
import Card from '@mui/material/Card';
import CardContent from '@mui/material/CardContent';
import Button from '@mui/material/Button';
import TextField from '@mui/material/TextField';
import MenuItem from '@mui/material/MenuItem';
import CircularProgress from '@mui/material/CircularProgress';
import Chip from '@mui/material/Chip';
import IconButton from '@mui/material/IconButton';
import AddIcon from '@mui/icons-material/Add';
import DeleteIcon from '@mui/icons-material/Delete';
import PlaceIcon from '@mui/icons-material/Place';
import Dialog from '@mui/material/Dialog';
import DialogTitle from '@mui/material/DialogTitle';
import DialogContent from '@mui/material/DialogContent';
import DialogActions from '@mui/material/DialogActions';
import { useSgpAuth } from '../contexts/SgpAuthContext';
import { listPlaces, addPlace, removePlace, setDefaultPlace } from '../services/placeService';
import type { Place, PlaceType } from '../types';

const TYPE_LABELS: Record<PlaceType, string> = {
  HOME_UNIT: '자택',
  OFFICE: '사무실',
  PARTNER: '제휴',
};

const STATUS_COLORS: Record<string, 'success' | 'warning' | 'default'> = {
  ACTIVE: 'success',
  PENDING: 'warning',
  EXPIRED: 'default',
};

export default function SgpPlacesPage() {
  const { user } = useSgpAuth();
  const [places, setPlaces] = useState<Place[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [form, setForm] = useState({ siteId: '', siteName: '', label: '', type: 'HOME_UNIT' as PlaceType });
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (!user) return;
    loadData();
  }, [user]);

  async function loadData() {
    setLoading(true);
    setError(null);
    try {
      const data = await listPlaces(user!.id);
      setPlaces(data);
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setLoading(false);
    }
  }

  async function handleAdd() {
    if (!user || !form.label) return;
    setSubmitting(true);
    try {
      await addPlace(user.id, {
        siteId: form.siteId || crypto.randomUUID(),
        siteName: form.siteName || form.label,
        label: form.label,
        type: form.type,
        isDefault: places.length === 0,
      });
      setDialogOpen(false);
      setForm({ siteId: '', siteName: '', label: '', type: 'HOME_UNIT' });
      await loadData();
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setSubmitting(false);
    }
  }

  async function handleRemove(placeId: string) {
    try {
      await removePlace(placeId);
      await loadData();
    } catch (err) {
      setError((err as Error).message);
    }
  }

  async function handleSetDefault(placeId: string) {
    if (!user) return;
    try {
      await setDefaultPlace(user.id, placeId);
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
        <Typography variant="subtitle1" sx={{ color: '#fff', fontWeight: 700 }}>내 장소</Typography>
        <Button startIcon={<AddIcon />} size="small" onClick={() => setDialogOpen(true)} sx={{ color: '#00d4aa', fontWeight: 600 }}>
          추가
        </Button>
      </Box>

      {error && <Typography variant="body2" color="error" sx={{ mb: 2 }}>{error}</Typography>}

      {places.length === 0 ? (
        <Box sx={{ textAlign: 'center', py: 6 }}>
          <PlaceIcon sx={{ fontSize: 48, color: 'rgba(255,255,255,0.2)', mb: 1 }} />
          <Typography variant="body2" sx={{ color: 'rgba(255,255,255,0.4)' }}>등록된 장소가 없습니다</Typography>
        </Box>
      ) : (
        places.map(p => (
          <Card key={p.id} sx={{ mb: 1.5, bgcolor: 'rgba(255,255,255,0.03)', borderRadius: 2, border: p.isDefault ? '1px solid rgba(0,212,170,0.3)' : 'none' }}>
            <CardContent sx={{ p: 2, '&:last-child': { pb: 2 } }}>
              <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <Box>
                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 0.5 }}>
                    <Typography variant="body2" sx={{ color: '#fff', fontWeight: 600 }}>{p.label}</Typography>
                    <Chip label={TYPE_LABELS[p.type]} size="small" sx={{ height: 20, fontSize: '0.65rem', bgcolor: 'rgba(255,255,255,0.08)', color: 'rgba(255,255,255,0.6)' }} />
                    <Chip label={p.grantStatus} size="small" color={STATUS_COLORS[p.grantStatus]} sx={{ height: 20, fontSize: '0.65rem' }} />
                  </Box>
                  <Typography variant="caption" sx={{ color: 'rgba(255,255,255,0.4)' }}>{p.siteName}</Typography>
                  {p.etaMinutes && (
                    <Typography variant="caption" sx={{ color: 'rgba(255,255,255,0.4)', ml: 1 }}>~{p.etaMinutes}분</Typography>
                  )}
                </Box>
                <Box>
                  {!p.isDefault && (
                    <Button size="small" onClick={() => handleSetDefault(p.id)} sx={{ color: 'rgba(255,255,255,0.4)', fontSize: '0.7rem', minWidth: 0 }}>
                      기본
                    </Button>
                  )}
                  <IconButton size="small" onClick={() => handleRemove(p.id)} sx={{ color: 'rgba(255,100,100,0.6)' }}>
                    <DeleteIcon sx={{ fontSize: 16 }} />
                  </IconButton>
                </Box>
              </Box>
            </CardContent>
          </Card>
        ))
      )}

      <Dialog open={dialogOpen} onClose={() => setDialogOpen(false)} maxWidth="xs" fullWidth slotProps={{ paper: { sx: { bgcolor: '#1a2d42', color: '#fff' } } }}>
        <DialogTitle sx={{ fontWeight: 700 }}>장소 등록</DialogTitle>
        <DialogContent sx={{ display: 'flex', flexDirection: 'column', gap: 2, pt: '16px !important' }}>
          <TextField label="장소 이름" value={form.label} onChange={e => setForm({ ...form, label: e.target.value })} fullWidth size="small" sx={{ '& .MuiInputBase-root': { color: '#fff' } }} />
          <TextField label="시설명" value={form.siteName} onChange={e => setForm({ ...form, siteName: e.target.value })} fullWidth size="small" sx={{ '& .MuiInputBase-root': { color: '#fff' } }} />
          <TextField select label="유형" value={form.type} onChange={e => setForm({ ...form, type: e.target.value as PlaceType })} fullWidth size="small" sx={{ '& .MuiInputBase-root': { color: '#fff' } }}>
            <MenuItem value="HOME_UNIT">자택</MenuItem>
            <MenuItem value="OFFICE">사무실</MenuItem>
            <MenuItem value="PARTNER">제휴</MenuItem>
          </TextField>
        </DialogContent>
        <DialogActions sx={{ px: 3, pb: 3 }}>
          <Button onClick={() => setDialogOpen(false)} sx={{ color: 'rgba(255,255,255,0.5)' }}>취소</Button>
          <Button variant="contained" onClick={handleAdd} disabled={!form.label || submitting} sx={{ bgcolor: '#00d4aa', color: '#0d1b2a', fontWeight: 700 }}>
            {submitting ? '등록중...' : '등록'}
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
}
