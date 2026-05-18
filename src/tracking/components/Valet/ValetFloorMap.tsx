import Box from '@mui/material/Box';
import Typography from '@mui/material/Typography';
import Card from '@mui/material/Card';
import CardContent from '@mui/material/CardContent';
import Chip from '@mui/material/Chip';
import type { ValetVehicle, AtrUnit } from '../../types';

interface ValetFloorMapProps {
  vehicles: ValetVehicle[];
  atrUnits: AtrUnit[];
  selectedVehicleId?: string;
  onVehicleClick?: (vehicle: ValetVehicle) => void;
  floor?: number;
}

const FLOOR_WIDTH = 600;
const FLOOR_HEIGHT = 350;

export default function ValetFloorMap({ vehicles, atrUnits, selectedVehicleId, onVehicleClick, floor = 1 }: ValetFloorMapProps) {
  const floorVehicles = vehicles.filter(v => v.current_floor === floor && v.current_stage !== 'exit');
  const floorAtrs = atrUnits.filter(a => a.current_floor === floor);

  return (
    <Card>
      <CardContent sx={{ p: 2 }}>
        <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 1.5 }}>
          <Typography variant="subtitle2" sx={{ fontWeight: 700 }}>
            {floor}F 실내 위치 뷰
          </Typography>
          <Box sx={{ display: 'flex', gap: 1 }}>
            <Chip label={`차량 ${floorVehicles.length}`} size="small" variant="outlined" />
            <Chip label={`ATR ${floorAtrs.length}`} size="small" color="info" variant="outlined" />
          </Box>
        </Box>

        <Box
          sx={{
            position: 'relative',
            width: '100%',
            aspectRatio: `${FLOOR_WIDTH}/${FLOOR_HEIGHT}`,
            bgcolor: 'action.hover',
            borderRadius: 2,
            border: 1,
            borderColor: 'divider',
            overflow: 'hidden',
          }}
        >
          {/* Grid overlay */}
          <Box sx={{ position: 'absolute', inset: 0, opacity: 0.1 }}>
            {Array.from({ length: 8 }).map((_, i) => (
              <Box key={`h-${i}`} sx={{ position: 'absolute', top: `${(i + 1) * 11.1}%`, left: 0, right: 0, height: '1px', bgcolor: 'text.primary' }} />
            ))}
            {Array.from({ length: 12 }).map((_, i) => (
              <Box key={`v-${i}`} sx={{ position: 'absolute', left: `${(i + 1) * 7.7}%`, top: 0, bottom: 0, width: '1px', bgcolor: 'text.primary' }} />
            ))}
          </Box>

          {/* Zone labels */}
          <Typography variant="caption" sx={{ position: 'absolute', top: 8, left: 8, opacity: 0.4, fontWeight: 600 }}>입구</Typography>
          <Typography variant="caption" sx={{ position: 'absolute', top: 8, right: 8, opacity: 0.4, fontWeight: 600 }}>출구</Typography>
          <Typography variant="caption" sx={{ position: 'absolute', bottom: 8, left: '50%', transform: 'translateX(-50%)', opacity: 0.4, fontWeight: 600 }}>주차구역</Typography>

          {/* Vehicles */}
          {floorVehicles.map(v => {
            const xPercent = Math.max(5, Math.min(95, (v.current_x / FLOOR_WIDTH) * 100));
            const yPercent = Math.max(5, Math.min(95, (v.current_y / FLOOR_HEIGHT) * 100));
            const isSelected = v.id === selectedVehicleId;

            return (
              <Box
                key={v.id}
                onClick={() => onVehicleClick?.(v)}
                sx={{
                  position: 'absolute',
                  left: `${xPercent}%`,
                  top: `${yPercent}%`,
                  transform: 'translate(-50%, -50%)',
                  width: isSelected ? 28 : 22,
                  height: isSelected ? 28 : 22,
                  borderRadius: 1,
                  bgcolor: isSelected ? 'warning.main' : 'primary.main',
                  border: 2,
                  borderColor: isSelected ? 'warning.light' : 'primary.light',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  cursor: 'pointer',
                  transition: 'all 0.3s',
                  boxShadow: isSelected ? 4 : 1,
                  '&:hover': { transform: 'translate(-50%, -50%) scale(1.2)', boxShadow: 3 },
                  zIndex: isSelected ? 10 : 5,
                }}
              >
                <Typography variant="caption" sx={{ fontSize: '0.55rem', fontWeight: 800, color: '#fff' }}>
                  {v.plate_number.slice(-4)}
                </Typography>
              </Box>
            );
          })}

          {/* ATR units */}
          {floorAtrs.map(a => {
            const xPercent = Math.max(5, Math.min(95, (a.current_x / FLOOR_WIDTH) * 100));
            const yPercent = Math.max(5, Math.min(95, (a.current_y / FLOOR_HEIGHT) * 100));

            return (
              <Box
                key={a.id}
                sx={{
                  position: 'absolute',
                  left: `${xPercent}%`,
                  top: `${yPercent}%`,
                  transform: 'translate(-50%, -50%)',
                  width: 20,
                  height: 20,
                  borderRadius: '50%',
                  bgcolor: a.status === 'transporting' ? 'info.main' : a.status === 'idle' ? 'success.main' : 'grey.500',
                  border: 2,
                  borderColor: 'background.paper',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  zIndex: 8,
                }}
              >
                <Typography variant="caption" sx={{ fontSize: '0.5rem', fontWeight: 800, color: '#fff' }}>
                  {a.unit_code.slice(-2)}
                </Typography>
              </Box>
            );
          })}

          {/* Legend */}
          <Box sx={{ position: 'absolute', bottom: 6, right: 6, display: 'flex', gap: 1, bgcolor: 'background.paper', borderRadius: 1, px: 1, py: 0.5, border: 1, borderColor: 'divider' }}>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
              <Box sx={{ width: 8, height: 8, borderRadius: 0.5, bgcolor: 'primary.main' }} />
              <Typography variant="caption" sx={{ fontSize: '0.6rem' }}>차량</Typography>
            </Box>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
              <Box sx={{ width: 8, height: 8, borderRadius: '50%', bgcolor: 'success.main' }} />
              <Typography variant="caption" sx={{ fontSize: '0.6rem' }}>ATR</Typography>
            </Box>
          </Box>
        </Box>
      </CardContent>
    </Card>
  );
}
