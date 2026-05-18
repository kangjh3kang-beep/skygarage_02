import Box from '@mui/material/Box';
import Typography from '@mui/material/Typography';
import List from '@mui/material/List';
import ListItemButton from '@mui/material/ListItemButton';
import ListItemText from '@mui/material/ListItemText';
import ListItemIcon from '@mui/material/ListItemIcon';
import Divider from '@mui/material/Divider';
import Button from '@mui/material/Button';
import Skeleton from '@mui/material/Skeleton';
import DirectionsCarIcon from '@mui/icons-material/DirectionsCar';
import EvStationIcon from '@mui/icons-material/EvStation';
import PaymentIcon from '@mui/icons-material/Payment';
import PeopleAltIcon from '@mui/icons-material/PeopleAlt';
import InfoIcon from '@mui/icons-material/Info';
import DoneAllIcon from '@mui/icons-material/DoneAll';
import { useParkingNotifications } from '../../hooks/useNotifications';

const typeIcon = (type: string) => {
  switch (type) {
    case 'parking': return <DirectionsCarIcon sx={{ fontSize: 20, color: 'primary.main' }} />;
    case 'ev_charging': return <EvStationIcon sx={{ fontSize: 20, color: 'warning.main' }} />;
    case 'billing': return <PaymentIcon sx={{ fontSize: 20, color: 'error.main' }} />;
    case 'visitor': return <PeopleAltIcon sx={{ fontSize: 20, color: 'info.main' }} />;
    default: return <InfoIcon sx={{ fontSize: 20 }} />;
  }
};

export default function NotificationsPage() {
  const { notifications, unreadCount, loading, markAsRead, markAllRead } = useParkingNotifications();

  if (loading) {
    return (
      <Box sx={{ p: 2.5 }}>
        {[1, 2, 3, 4].map(i => <Skeleton key={i} variant="rounded" height={56} sx={{ mb: 1, borderRadius: 2 }} />)}
      </Box>
    );
  }

  return (
    <Box sx={{ p: 2.5, maxWidth: 520, mx: 'auto' }}>
      {unreadCount > 0 && (
        <Box sx={{ display: 'flex', justifyContent: 'flex-end', mb: 1 }}>
          <Button size="small" startIcon={<DoneAllIcon />} onClick={markAllRead} sx={{ fontSize: '0.75rem' }}>
            모두 읽음
          </Button>
        </Box>
      )}

      {notifications.length === 0 ? (
        <Box sx={{ textAlign: 'center', py: 8 }}>
          <Typography variant="body2" sx={{ color: 'text.secondary' }}>알림이 없습니다.</Typography>
        </Box>
      ) : (
        <List disablePadding>
          {notifications.map((n, idx) => (
            <Box key={n.id}>
              {idx > 0 && <Divider />}
              <ListItemButton
                onClick={() => !n.is_read && markAsRead(n.id)}
                sx={{ borderRadius: 1.5, bgcolor: n.is_read ? 'transparent' : 'action.hover', py: 1.5, px: 1.5 }}
              >
                <ListItemIcon sx={{ minWidth: 32 }}>{typeIcon(n.notification_type)}</ListItemIcon>
                <ListItemText
                  primary={n.title}
                  secondary={
                    <Box>
                      <Typography variant="caption" component="span" sx={{ display: 'block', color: 'text.secondary', lineHeight: 1.4 }}>{n.message}</Typography>
                      <Typography variant="caption" sx={{ color: 'text.disabled', fontSize: '0.65rem' }}>
                        {new Date(n.created_at).toLocaleString('ko-KR', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })}
                      </Typography>
                    </Box>
                  }
                  slotProps={{ primary: { sx: { fontWeight: n.is_read ? 400 : 700, fontSize: '0.8rem' } } }}
                />
                {!n.is_read && (
                  <Box sx={{ width: 7, height: 7, borderRadius: '50%', bgcolor: 'primary.main', ml: 1, flexShrink: 0 }} />
                )}
              </ListItemButton>
            </Box>
          ))}
        </List>
      )}
    </Box>
  );
}
