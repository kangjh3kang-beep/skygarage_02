import { useState } from 'react';
import Box from '@mui/material/Box';
import Typography from '@mui/material/Typography';
import Card from '@mui/material/Card';
import CardContent from '@mui/material/CardContent';
import Chip from '@mui/material/Chip';
import Avatar from '@mui/material/Avatar';
import Button from '@mui/material/Button';
import Divider from '@mui/material/Divider';
import List from '@mui/material/List';
import ListItemButton from '@mui/material/ListItemButton';
import ListItemText from '@mui/material/ListItemText';
import IconButton from '@mui/material/IconButton';
import Dialog from '@mui/material/Dialog';
import DialogTitle from '@mui/material/DialogTitle';
import DialogContent from '@mui/material/DialogContent';
import DialogActions from '@mui/material/DialogActions';
import Skeleton from '@mui/material/Skeleton';
import PersonIcon from '@mui/icons-material/Person';
import AddCircleIcon from '@mui/icons-material/AddCircle';
import CancelIcon from '@mui/icons-material/Cancel';
import { useNavigate } from 'react-router-dom';
import { useBooking } from '../../hooks/useBooking';
import { useToast } from '../../components/common/ToastProvider';
import { bookingService } from '../../services/trackingService';

const STATUS_LABELS: Record<string, { label: string; color: 'default' | 'success' | 'info' | 'warning' | 'error' }> = {
  pending: { label: '대기중', color: 'warning' },
  confirmed: { label: '확정', color: 'info' },
  in_progress: { label: '이동중', color: 'info' },
  completed: { label: '완료', color: 'success' },
  cancelled: { label: '취소', color: 'error' },
};

export default function MyPage() {
  const navigate = useNavigate();
  const { bookings, loading, refresh } = useBooking();
  const { showToast } = useToast();
  const [cancelId, setCancelId] = useState<string | null>(null);

  if (loading) {
    return (
      <Box sx={{ p: 3 }}>
        <Skeleton variant="circular" width={80} height={80} sx={{ mx: 'auto', mb: 2 }} />
        <Skeleton variant="text" width={200} height={36} sx={{ mx: 'auto', mb: 3 }} />
        {[1, 2, 3].map(i => <Skeleton key={i} variant="rectangular" height={72} sx={{ borderRadius: 1, mb: 1 }} />)}
      </Box>
    );
  }

  const completedCount = bookings.filter(b => b.status === 'completed').length;
  const totalCount = bookings.length;

  return (
    <Box sx={{ p: { xs: 2, md: 3 } }}>
      {/* Profile */}
      <Card sx={{ mb: 3 }}>
        <CardContent sx={{ textAlign: 'center', py: 4 }}>
          <Avatar sx={{ width: 72, height: 72, mx: 'auto', mb: 2, bgcolor: 'primary.main' }}>
            <PersonIcon sx={{ fontSize: 36 }} />
          </Avatar>
          <Typography variant="h6" sx={{ fontWeight: 700 }}>SkyGarage 이용자</Typography>
          <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>프리미엄 회원</Typography>
          <Box sx={{ display: 'flex', justifyContent: 'center', gap: 3 }}>
            <Box sx={{ textAlign: 'center' }}>
              <Typography variant="h5" sx={{ fontWeight: 800 }}>{totalCount}</Typography>
              <Typography variant="caption" color="text.secondary">전체 예약</Typography>
            </Box>
            <Divider orientation="vertical" flexItem />
            <Box sx={{ textAlign: 'center' }}>
              <Typography variant="h5" sx={{ fontWeight: 800 }}>{completedCount}</Typography>
              <Typography variant="caption" color="text.secondary">완료</Typography>
            </Box>
          </Box>
        </CardContent>
      </Card>

      {/* Booking History */}
      <Typography variant="subtitle1" sx={{ fontWeight: 700, mb: 1.5 }}>예약 이력</Typography>
      {bookings.length === 0 ? (
        <Card sx={{ border: '1px dashed', borderColor: 'divider' }}>
          <CardContent sx={{ textAlign: 'center', py: 4 }}>
            <AddCircleIcon sx={{ fontSize: 40, color: 'text.disabled', mb: 1 }} />
            <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
              아직 예약 이력이 없습니다.
            </Typography>
            <Button variant="outlined" size="small" onClick={() => navigate('/tracking/booking')}>
              첫 예약 만들기
            </Button>
          </CardContent>
        </Card>
      ) : (
        <List disablePadding>
          {bookings.map(b => {
            const statusInfo = STATUS_LABELS[b.status] || STATUS_LABELS.pending;
            const isTrackable = b.status === 'in_progress' && b.vehicle_id;
            const isCancellable = b.status === 'pending' || b.status === 'confirmed';
            return (
              <ListItemButton
                key={b.id}
                sx={{ borderRadius: 2, mb: 1, border: 1, borderColor: 'divider' }}
                onClick={() => { if (isTrackable) navigate(`/tracking/track/${b.vehicle_id}`); }}
              >
                <ListItemText
                  primary={`${b.pickup_name} → ${b.dropoff_name}`}
                  secondary={new Date(b.created_at).toLocaleString('ko-KR')}
                  slotProps={{
                    primary: { sx: { fontWeight: 600, fontSize: '0.875rem' } },
                    secondary: { sx: { fontSize: '0.75rem' } },
                  }}
                />
                <Chip label={statusInfo.label} size="small" color={statusInfo.color} sx={{ height: 22, mr: isCancellable ? 1 : 0 }} />
                {isCancellable && (
                  <IconButton size="small" onClick={e => { e.stopPropagation(); setCancelId(b.id); }} sx={{ color: 'error.main' }}>
                    <CancelIcon sx={{ fontSize: 18 }} />
                  </IconButton>
                )}
              </ListItemButton>
            );
          })}
        </List>
      )}

      <Dialog open={!!cancelId} onClose={() => setCancelId(null)}>
        <DialogTitle>예약 취소</DialogTitle>
        <DialogContent>
          <Typography variant="body2">이 예약을 취소하시겠습니까?</Typography>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setCancelId(null)}>아니오</Button>
          <Button
            variant="contained"
            color="error"
            onClick={async () => {
              if (!cancelId) return;
              try {
                await bookingService.updateStatus(cancelId, 'cancelled');
                showToast('예약이 취소되었습니다.', 'info');
                refresh();
              } catch {
                showToast('취소 처리 중 오류가 발생했습니다.', 'error');
              }
              setCancelId(null);
            }}
          >
            취소하기
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
}
