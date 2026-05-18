import Box from '@mui/material/Box';
import Typography from '@mui/material/Typography';
import List from '@mui/material/List';
import ListItemButton from '@mui/material/ListItemButton';
import ListItemIcon from '@mui/material/ListItemIcon';
import ListItemText from '@mui/material/ListItemText';
import Chip from '@mui/material/Chip';
import Alert from '@mui/material/Alert';
import Skeleton from '@mui/material/Skeleton';
import AccessTimeIcon from '@mui/icons-material/AccessTime';
import NearMeIcon from '@mui/icons-material/NearMe';
import SwapHorizIcon from '@mui/icons-material/SwapHoriz';
import WarningAmberIcon from '@mui/icons-material/WarningAmber';
import { useNotifications } from '../../hooks/useNotifications';

const TYPE_CONFIG: Record<string, { icon: React.ReactElement; color: string }> = {
  eta_change: { icon: <AccessTimeIcon />, color: 'warning.main' },
  vehicle_nearby: { icon: <NearMeIcon />, color: 'success.main' },
  status_change: { icon: <SwapHorizIcon />, color: 'info.main' },
  delay: { icon: <WarningAmberIcon />, color: 'error.main' },
};

export default function NotificationsPage() {
  const { notifications, loading, markAsRead } = useNotifications();

  if (loading) {
    return (
      <Box sx={{ p: 3 }}>
        <Skeleton variant="text" width={200} height={36} sx={{ mb: 2 }} />
        {[1, 2, 3].map(i => <Skeleton key={i} variant="rectangular" height={72} sx={{ borderRadius: 1, mb: 1 }} />)}
      </Box>
    );
  }

  return (
    <Box sx={{ p: { xs: 2, md: 3 } }}>
      <Typography variant="h5" sx={{ fontWeight: 800, mb: 3 }}>알림 센터</Typography>

      {notifications.length === 0 ? (
        <Alert severity="info">알림이 없습니다.</Alert>
      ) : (
        <List disablePadding>
          {notifications.map(n => {
            const config = TYPE_CONFIG[n.type] || TYPE_CONFIG.status_change;
            return (
              <ListItemButton
                key={n.id}
                onClick={() => { if (!n.read) markAsRead(n.id); }}
                sx={{
                  borderRadius: 2,
                  mb: 1,
                  bgcolor: n.read ? 'transparent' : 'action.hover',
                  border: 1,
                  borderColor: 'divider',
                }}
              >
                <ListItemIcon sx={{ color: config.color, minWidth: 40 }}>
                  {config.icon}
                </ListItemIcon>
                <ListItemText
                  primary={n.title}
                  secondary={n.message}
                  slotProps={{
                    primary: { sx: { fontWeight: n.read ? 400 : 700, fontSize: '0.875rem' } },
                    secondary: { sx: { fontSize: '0.75rem' } },
                  }}
                />
                <Box sx={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 0.5 }}>
                  <Typography variant="caption" color="text.secondary">
                    {new Date(n.created_at).toLocaleString('ko-KR', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })}
                  </Typography>
                  {!n.read && <Chip label="NEW" size="small" color="error" sx={{ height: 18, fontSize: '0.6rem' }} />}
                </Box>
              </ListItemButton>
            );
          })}
        </List>
      )}
    </Box>
  );
}
