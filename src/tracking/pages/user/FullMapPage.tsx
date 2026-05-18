import { useState } from 'react';
import Box from '@mui/material/Box';
import Drawer from '@mui/material/Drawer';
import Typography from '@mui/material/Typography';
import Chip from '@mui/material/Chip';
import IconButton from '@mui/material/IconButton';
import Button from '@mui/material/Button';
import List from '@mui/material/List';
import ListItemButton from '@mui/material/ListItemButton';
import ListItemText from '@mui/material/ListItemText';
import ListItemAvatar from '@mui/material/ListItemAvatar';
import Avatar from '@mui/material/Avatar';
import useMediaQuery from '@mui/material/useMediaQuery';
import { useTheme } from '@mui/material/styles';
import DirectionsCarIcon from '@mui/icons-material/DirectionsCar';
import CloseIcon from '@mui/icons-material/Close';
import OpenInNewIcon from '@mui/icons-material/OpenInNew';
import { useNavigate } from 'react-router-dom';
import { useVehicleTracking } from '../../hooks/useVehicleTracking';
import TrackingMap from '../../components/Map/TrackingMap';
import type { Vehicle } from '../../types';

const STATUS_MAP: Record<string, { label: string; color: 'success' | 'info' | 'default' | 'warning' }> = {
  available: { label: '대기', color: 'success' },
  in_transit: { label: '운행', color: 'info' },
  offline: { label: '오프', color: 'default' },
  maintenance: { label: '정비', color: 'warning' },
};

export default function FullMapPage() {
  const navigate = useNavigate();
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down('md'));
  const { vehicles } = useVehicleTracking();
  const [selected, setSelected] = useState<Vehicle | null>(null);
  const [statusFilter, setStatusFilter] = useState<string | null>(null);

  const filteredVehicles = statusFilter
    ? vehicles.filter(v => v.status === statusFilter)
    : vehicles;

  const handleVehicleClick = (v: Vehicle) => {
    setSelected(v);
  };

  return (
    <Box sx={{ display: 'flex', height: isMobile ? 'calc(100vh - 120px)' : 'calc(100vh - 64px)' }}>
      {/* Vehicle list sidebar */}
      {!isMobile && (
        <Box sx={{ width: 300, borderRight: 1, borderColor: 'divider', overflow: 'auto' }}>
          <Box sx={{ p: 2, borderBottom: 1, borderColor: 'divider' }}>
            <Typography variant="subtitle2" sx={{ fontWeight: 700, mb: 1 }}>차량 목록 ({filteredVehicles.length})</Typography>
            <Box sx={{ display: 'flex', gap: 0.5, flexWrap: 'wrap' }}>
              <Chip
                label="전체"
                size="small"
                variant={statusFilter === null ? 'filled' : 'outlined'}
                onClick={() => setStatusFilter(null)}
                sx={{ height: 24 }}
              />
              {Object.entries(STATUS_MAP).map(([key, { label, color }]) => (
                <Chip
                  key={key}
                  label={`${label} ${vehicles.filter(v => v.status === key).length}`}
                  size="small"
                  color={color}
                  variant={statusFilter === key ? 'filled' : 'outlined'}
                  onClick={() => setStatusFilter(statusFilter === key ? null : key)}
                  sx={{ height: 24 }}
                />
              ))}
            </Box>
          </Box>
          <List disablePadding dense>
            {filteredVehicles.map(v => (
              <ListItemButton
                key={v.id}
                selected={selected?.id === v.id}
                onClick={() => setSelected(v)}
                onDoubleClick={() => navigate(`/tracking/track/${v.id}`)}
              >
                <ListItemAvatar>
                  <Avatar sx={{ width: 32, height: 32, bgcolor: v.status === 'in_transit' ? 'info.main' : v.status === 'available' ? 'success.main' : 'grey.500' }}>
                    <DirectionsCarIcon sx={{ fontSize: 18 }} />
                  </Avatar>
                </ListItemAvatar>
                <ListItemText
                  primary={v.driver_name}
                  secondary={`${v.plate_number} | ${v.speed.toFixed(0)} km/h`}
                  slotProps={{ primary: { sx: { fontSize: '0.8rem', fontWeight: 600 } }, secondary: { sx: { fontSize: '0.7rem' } } }}
                />
                <Chip label={STATUS_MAP[v.status]?.label} size="small" color={STATUS_MAP[v.status]?.color} sx={{ height: 20, fontSize: '0.6rem' }} />
              </ListItemButton>
            ))}
          </List>
        </Box>
      )}

      {/* Map */}
      <Box sx={{ flex: 1 }}>
        <TrackingMap
          vehicles={vehicles}
          selectedVehicleId={selected?.id}
          onVehicleClick={handleVehicleClick}
          height="100%"
        />
      </Box>

      {/* Mobile bottom sheet for selected vehicle */}
      {isMobile && (
        <Drawer
          anchor="bottom"
          open={!!selected}
          onClose={() => setSelected(null)}
          sx={{ '& .MuiDrawer-paper': { borderTopLeftRadius: 16, borderTopRightRadius: 16, maxHeight: '35vh' } }}
        >
          {selected && (
            <Box sx={{ p: 2 }}>
              <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 1 }}>
                <Typography variant="subtitle1" sx={{ fontWeight: 700 }}>{selected.driver_name}</Typography>
                <IconButton size="small" onClick={() => setSelected(null)}><CloseIcon /></IconButton>
              </Box>
              <Typography variant="body2" color="text.secondary">{selected.plate_number} | {selected.vehicle_model}</Typography>
              <Box sx={{ display: 'flex', gap: 1, mt: 1.5, alignItems: 'center' }}>
                <Chip label={STATUS_MAP[selected.status]?.label} size="small" color={STATUS_MAP[selected.status]?.color} />
                <Chip label={`${selected.speed.toFixed(0)} km/h`} size="small" variant="outlined" />
                <Box sx={{ flex: 1 }} />
                <Button
                  size="small"
                  variant="contained"
                  endIcon={<OpenInNewIcon sx={{ fontSize: 14 }} />}
                  onClick={() => navigate(`/tracking/track/${selected.id}`)}
                >
                  추적
                </Button>
              </Box>
            </Box>
          )}
        </Drawer>
      )}
    </Box>
  );
}
