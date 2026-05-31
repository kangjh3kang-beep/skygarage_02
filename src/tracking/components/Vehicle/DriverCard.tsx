import Box from '@mui/material/Box';
import Typography from '@mui/material/Typography';
import Chip from '@mui/material/Chip';
import Avatar from '@mui/material/Avatar';
import IconButton from '@mui/material/IconButton';
import Paper from '@mui/material/Paper';
import Rating from '@mui/material/Rating';
import PhoneIcon from '@mui/icons-material/Phone';
import DirectionsCarIcon from '@mui/icons-material/DirectionsCar';
import SpeedIcon from '@mui/icons-material/Speed';
import type { Vehicle } from '../../types';

const STATUS_MAP: Record<string, { label: string; color: 'success' | 'info' | 'default' | 'warning' }> = {
  available: { label: '대기중', color: 'success' },
  in_transit: { label: '운행중', color: 'info' },
  offline: { label: '오프라인', color: 'default' },
  maintenance: { label: '정비중', color: 'warning' },
};

export default function DriverCard({ vehicle }: { vehicle: Vehicle }) {
  const statusInfo = STATUS_MAP[vehicle.status] || STATUS_MAP.offline;

  return (
    <Paper sx={{ p: 2, display: 'flex', gap: 2, alignItems: 'center' }}>
      <Avatar sx={{ width: 56, height: 56, bgcolor: 'primary.main', fontSize: '1.25rem' }}>
        {vehicle.driver_name.charAt(0)}
      </Avatar>
      <Box sx={{ flex: 1 }}>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 0.5 }}>
          <Typography variant="subtitle1" sx={{ fontWeight: 700 }}>{vehicle.driver_name}</Typography>
          <Chip label={statusInfo.label} size="small" color={statusInfo.color} sx={{ height: 22 }} />
        </Box>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5, mb: 0.5 }}>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
            <DirectionsCarIcon sx={{ fontSize: 14, color: 'text.secondary' }} />
            <Typography variant="caption" color="text.secondary">{vehicle.plate_number}</Typography>
          </Box>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
            <SpeedIcon sx={{ fontSize: 14, color: 'text.secondary' }} />
            <Typography variant="caption" color="text.secondary">{vehicle.speed.toFixed(0)} km/h</Typography>
          </Box>
        </Box>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
          <Rating value={vehicle.rating} readOnly size="small" precision={0.1} />
          <Typography variant="caption" color="text.secondary">{vehicle.rating.toFixed(1)}</Typography>
        </Box>
        <Typography variant="caption" color="text.secondary">{vehicle.vehicle_model}</Typography>
      </Box>
      <IconButton
        color="primary"
        component="a"
        {...(vehicle.phone ? { href: `tel:${vehicle.phone}` } : {})}
        disabled={!vehicle.phone}
        sx={{ opacity: vehicle.phone ? 1 : 0.4 }}
      >
        <PhoneIcon />
      </IconButton>
    </Paper>
  );
}
