import { useState } from 'react';
import Box from '@mui/material/Box';
import Card from '@mui/material/Card';
import CardContent from '@mui/material/CardContent';
import Typography from '@mui/material/Typography';
import Button from '@mui/material/Button';
import List from '@mui/material/List';
import ListItem from '@mui/material/ListItem';
import ListItemText from '@mui/material/ListItemText';
import ListItemIcon from '@mui/material/ListItemIcon';
import Divider from '@mui/material/Divider';
import IconButton from '@mui/material/IconButton';
import Dialog from '@mui/material/Dialog';
import DialogTitle from '@mui/material/DialogTitle';
import DialogContent from '@mui/material/DialogContent';
import DialogActions from '@mui/material/DialogActions';
import TextField from '@mui/material/TextField';
import FormControlLabel from '@mui/material/FormControlLabel';
import Switch from '@mui/material/Switch';
import Chip from '@mui/material/Chip';
import Skeleton from '@mui/material/Skeleton';
import DirectionsCarIcon from '@mui/icons-material/DirectionsCar';
import AddIcon from '@mui/icons-material/Add';
import DeleteIcon from '@mui/icons-material/Delete';
import PersonIcon from '@mui/icons-material/Person';
import LogoutIcon from '@mui/icons-material/Logout';
import ElectricCarIcon from '@mui/icons-material/ElectricCar';
import { useParkingAuth } from '../../contexts/ParkingAuthContext';
import { useVehicles } from '../../hooks/useVehicles';

export default function SettingsPage() {
  const { user, household, signOut } = useParkingAuth();
  const { vehicles, loading, addVehicle, deleteVehicle } = useVehicles();
  const [dialogOpen, setDialogOpen] = useState(false);
  const [form, setForm] = useState({
    plate_number: '',
    brand: '',
    model: '',
    color: '',
    is_ev: false,
    vehicle_type: 'sedan',
  });
  const [submitting, setSubmitting] = useState(false);

  const handleAdd = async () => {
    if (!form.plate_number) return;
    setSubmitting(true);
    await addVehicle(form);
    setDialogOpen(false);
    setForm({ plate_number: '', brand: '', model: '', color: '', is_ev: false, vehicle_type: 'sedan' });
    setSubmitting(false);
  };

  if (loading) {
    return (
      <Box sx={{ p: 2.5 }}>
        {[1, 2, 3].map(i => <Skeleton key={i} variant="rounded" height={72} sx={{ mb: 1.5, borderRadius: 2 }} />)}
      </Box>
    );
  }

  return (
    <Box sx={{ p: 2.5, maxWidth: 520, mx: 'auto' }}>
      {/* Account Info */}
      <Card sx={{ mb: 1.5, border: '1px solid', borderColor: 'divider' }}>
        <CardContent sx={{ py: 2, '&:last-child': { pb: 2 } }}>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
            <Box sx={{ width: 44, height: 44, borderRadius: '50%', bgcolor: 'primary.main', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
              <PersonIcon sx={{ color: '#000', fontSize: 22 }} />
            </Box>
            <Box sx={{ minWidth: 0 }}>
              <Typography variant="body1" sx={{ fontWeight: 700, overflow: 'hidden', textOverflow: 'ellipsis' }}>{user?.email}</Typography>
              <Typography variant="caption" sx={{ color: 'text.secondary' }}>
                {household ? `${household.building}동 ${household.unit_number}호` : '세대 미등록'}
              </Typography>
            </Box>
          </Box>
        </CardContent>
      </Card>

      {/* Vehicle Management */}
      <Card sx={{ mb: 1.5, border: '1px solid', borderColor: 'divider' }}>
        <CardContent sx={{ py: 2, '&:last-child': { pb: 2 } }}>
          <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 1.5 }}>
            <Typography variant="body1" sx={{ fontWeight: 700 }}>등록 차량</Typography>
            <Button size="small" startIcon={<AddIcon />} onClick={() => setDialogOpen(true)} sx={{ fontSize: '0.75rem' }}>
              추가
            </Button>
          </Box>
          {vehicles.length === 0 ? (
            <Box sx={{ textAlign: 'center', py: 3 }}>
              <Typography variant="body2" sx={{ color: 'text.secondary', mb: 1 }}>
                등록된 차량이 없습니다.
              </Typography>
              <Button size="small" variant="outlined" startIcon={<AddIcon />} onClick={() => setDialogOpen(true)}>
                차량 등록하기
              </Button>
            </Box>
          ) : (
            <List disablePadding>
              {vehicles.map((v, idx) => (
                <Box key={v.id}>
                  {idx > 0 && <Divider />}
                  <ListItem
                    disablePadding
                    sx={{ py: 1 }}
                    secondaryAction={
                      <IconButton size="small" onClick={() => deleteVehicle(v.id)} title="삭제">
                        <DeleteIcon fontSize="small" color="error" />
                      </IconButton>
                    }
                  >
                    <ListItemIcon sx={{ minWidth: 32 }}>
                      {v.is_ev ? <ElectricCarIcon sx={{ fontSize: 20, color: 'warning.main' }} /> : <DirectionsCarIcon sx={{ fontSize: 20, color: 'primary.main' }} />}
                    </ListItemIcon>
                    <ListItemText
                      primary={
                        <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.8 }}>
                          <Typography variant="body2" sx={{ fontWeight: 700 }}>{v.plate_number}</Typography>
                          {v.is_ev && <Chip label="EV" size="small" sx={{ fontSize: '0.6rem', height: 18 }} color="warning" />}
                          {v.is_primary && <Chip label="대표" size="small" sx={{ fontSize: '0.6rem', height: 18 }} color="primary" />}
                        </Box>
                      }
                      secondary={`${v.brand} ${v.model} ${v.color}`}
                      slotProps={{ secondary: { sx: { fontSize: '0.7rem' } } }}
                    />
                  </ListItem>
                </Box>
              ))}
            </List>
          )}
        </CardContent>
      </Card>

      {/* Logout */}
      <Button
        fullWidth
        variant="outlined"
        color="error"
        startIcon={<LogoutIcon />}
        onClick={signOut}
        sx={{ mt: 2, py: 1.2, fontWeight: 600 }}
      >
        로그아웃
      </Button>

      {/* Add Vehicle Dialog */}
      <Dialog open={dialogOpen} onClose={() => setDialogOpen(false)} fullWidth maxWidth="sm">
        <DialogTitle sx={{ fontWeight: 700, fontSize: '1rem' }}>차량 등록</DialogTitle>
        <DialogContent sx={{ display: 'flex', flexDirection: 'column', gap: 2, pt: '16px !important' }}>
          <TextField
            label="차량 번호"
            placeholder="12가 3456"
            value={form.plate_number}
            onChange={e => setForm(prev => ({ ...prev, plate_number: e.target.value }))}
            fullWidth
            required
            size="small"
          />
          <TextField
            label="제조사"
            placeholder="현대"
            value={form.brand}
            onChange={e => setForm(prev => ({ ...prev, brand: e.target.value }))}
            fullWidth
            size="small"
          />
          <TextField
            label="모델명"
            placeholder="아이오닉 6"
            value={form.model}
            onChange={e => setForm(prev => ({ ...prev, model: e.target.value }))}
            fullWidth
            size="small"
          />
          <TextField
            label="색상"
            value={form.color}
            onChange={e => setForm(prev => ({ ...prev, color: e.target.value }))}
            fullWidth
            size="small"
          />
          <FormControlLabel
            control={<Switch checked={form.is_ev} onChange={(_, c) => setForm(prev => ({ ...prev, is_ev: c }))} size="small" />}
            label={<Typography variant="body2">전기차 여부</Typography>}
          />
        </DialogContent>
        <DialogActions sx={{ px: 3, pb: 2 }}>
          <Button onClick={() => setDialogOpen(false)} size="small">취소</Button>
          <Button variant="contained" onClick={handleAdd} disabled={!form.plate_number || submitting} size="small">
            등록
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
}
