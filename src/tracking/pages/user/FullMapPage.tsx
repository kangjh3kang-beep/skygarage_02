import { useState, useEffect, useCallback } from 'react';
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
import Skeleton from '@mui/material/Skeleton';
import ToggleButton from '@mui/material/ToggleButton';
import ToggleButtonGroup from '@mui/material/ToggleButtonGroup';
import useMediaQuery from '@mui/material/useMediaQuery';
import { useTheme } from '@mui/material/styles';
import DirectionsCarIcon from '@mui/icons-material/DirectionsCar';
import CloseIcon from '@mui/icons-material/Close';
import OpenInNewIcon from '@mui/icons-material/OpenInNew';
import { useNavigate } from 'react-router-dom';
import { valetVehicleService, atrService } from '../../services/trackingService';
import { ValetFloorMap } from '../../components/Valet';
import { TrackingStageIndicator } from '../../components/Valet';
import type { ValetVehicle, AtrUnit } from '../../types';
import { STAGE_CONFIG } from '../../types';

export default function FullMapPage() {
  const navigate = useNavigate();
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down('md'));
  const [vehicles, setVehicles] = useState<ValetVehicle[]>([]);
  const [atrUnits, setAtrUnits] = useState<AtrUnit[]>([]);
  const [loading, setLoading] = useState(true);
  const [selected, setSelected] = useState<ValetVehicle | null>(null);
  const [floor, setFloor] = useState(1);

  const loadData = useCallback(async () => {
    try {
      const [vData, aData] = await Promise.all([
        valetVehicleService.getAll(),
        atrService.getAll(),
      ]);
      setVehicles(vData);
      setAtrUnits(aData);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadData();
    const interval = setInterval(loadData, 8000);
    return () => clearInterval(interval);
  }, [loadData]);

  const activeVehicles = vehicles.filter(v => v.current_stage !== 'exit');

  if (loading) {
    return (
      <Box sx={{ display: 'flex', height: isMobile ? 'calc(100vh - 120px)' : 'calc(100vh - 64px)' }}>
        {!isMobile && (
          <Box sx={{ width: 300, p: 2, borderRight: 1, borderColor: 'divider' }}>
            <Skeleton variant="text" width={120} height={28} sx={{ mb: 1 }} />
            {[1, 2, 3, 4, 5].map(i => <Skeleton key={i} variant="rectangular" height={56} sx={{ borderRadius: 1, mb: 1 }} />)}
          </Box>
        )}
        <Box sx={{ flex: 1 }}><Skeleton variant="rectangular" height="100%" /></Box>
      </Box>
    );
  }

  return (
    <Box sx={{ display: 'flex', height: isMobile ? 'calc(100vh - 120px)' : 'calc(100vh - 64px)' }}>
      {/* Vehicle list sidebar */}
      {!isMobile && (
        <Box sx={{ width: 300, borderRight: 1, borderColor: 'divider', overflow: 'auto' }}>
          <Box sx={{ p: 2, borderBottom: 1, borderColor: 'divider' }}>
            <Typography variant="subtitle2" sx={{ fontWeight: 700, mb: 1 }}>차량 현황 ({activeVehicles.length})</Typography>
            <ToggleButtonGroup
              value={floor}
              exclusive
              onChange={(_, v) => { if (v !== null) setFloor(v); }}
              size="small"
              sx={{ mb: 1 }}
            >
              <ToggleButton value={-1}>B1</ToggleButton>
              <ToggleButton value={1}>1F</ToggleButton>
              <ToggleButton value={2}>2F</ToggleButton>
            </ToggleButtonGroup>
          </Box>
          <List disablePadding dense>
            {activeVehicles.map(v => (
              <ListItemButton
                key={v.id}
                selected={selected?.id === v.id}
                onClick={() => setSelected(v)}
                onDoubleClick={() => navigate(`/tracking/track/${v.id}`)}
              >
                <ListItemAvatar>
                  <Avatar sx={{ width: 32, height: 32, bgcolor: v.current_stage === 'in_transit' ? 'info.main' : v.current_stage === 'stored' ? 'success.main' : 'warning.main' }}>
                    <DirectionsCarIcon sx={{ fontSize: 18 }} />
                  </Avatar>
                </ListItemAvatar>
                <ListItemText
                  primary={v.plate_number}
                  secondary={`${v.vehicle_model} | ${v.current_floor}F`}
                  slotProps={{ primary: { sx: { fontSize: '0.8rem', fontWeight: 600 } }, secondary: { sx: { fontSize: '0.7rem' } } }}
                />
                <Chip
                  label={STAGE_CONFIG[v.current_stage]?.label}
                  size="small"
                  color={STAGE_CONFIG[v.current_stage]?.color}
                  sx={{ height: 20, fontSize: '0.6rem' }}
                />
              </ListItemButton>
            ))}
          </List>
        </Box>
      )}

      {/* Floor Map */}
      <Box sx={{ flex: 1, p: 2, overflow: 'auto' }}>
        <ValetFloorMap
          vehicles={activeVehicles}
          atrUnits={atrUnits}
          selectedVehicleId={selected?.id}
          onVehicleClick={(v) => setSelected(prev => prev?.id === v.id ? null : v)}
          floor={floor}
        />
      </Box>

      {/* Mobile/Desktop detail drawer */}
      <Drawer
        anchor={isMobile ? 'bottom' : 'right'}
        open={!!selected}
        onClose={() => setSelected(null)}
        sx={{
          '& .MuiDrawer-paper': isMobile
            ? { borderTopLeftRadius: 16, borderTopRightRadius: 16, maxHeight: '40vh' }
            : { width: 320 },
        }}
      >
        {selected && (
          <Box sx={{ p: 2 }}>
            <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 1.5 }}>
              <Typography variant="subtitle1" sx={{ fontWeight: 700 }}>{selected.plate_number}</Typography>
              <IconButton size="small" onClick={() => setSelected(null)}><CloseIcon /></IconButton>
            </Box>
            <Typography variant="body2" color="text.secondary" sx={{ mb: 1.5 }}>
              {selected.vehicle_model} {selected.vehicle_color && `/ ${selected.vehicle_color}`}
            </Typography>
            <TrackingStageIndicator currentStage={selected.current_stage} />
            <Box sx={{ display: 'flex', gap: 1, mt: 2, alignItems: 'center' }}>
              <Chip label={STAGE_CONFIG[selected.current_stage]?.label} size="small" color={STAGE_CONFIG[selected.current_stage]?.color} />
              <Chip label={`${selected.current_floor}F`} size="small" variant="outlined" />
              {selected.storage_zone && <Chip label={`${selected.storage_zone}구역`} size="small" variant="outlined" />}
              <Box sx={{ flex: 1 }} />
              <Button
                size="small"
                variant="contained"
                endIcon={<OpenInNewIcon sx={{ fontSize: 14 }} />}
                onClick={() => navigate(`/tracking/track/${selected.id}`)}
              >
                상세
              </Button>
            </Box>
          </Box>
        )}
      </Drawer>
    </Box>
  );
}
