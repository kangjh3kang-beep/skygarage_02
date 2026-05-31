import Box from '@mui/material/Box';
import Card from '@mui/material/Card';
import CardContent from '@mui/material/CardContent';
import Typography from '@mui/material/Typography';
import Chip from '@mui/material/Chip';
import DirectionsCarIcon from '@mui/icons-material/DirectionsCar';
import type { ValetVehicle } from '../../types';
import { STAGE_CONFIG } from '../../types';
import TrackingStageIndicator from './TrackingStageIndicator';

interface ValetVehicleCardProps {
  vehicle: ValetVehicle;
  onClick?: () => void;
  selected?: boolean;
}

export default function ValetVehicleCard({ vehicle, onClick, selected }: ValetVehicleCardProps) {
  const stageConfig = STAGE_CONFIG[vehicle.current_stage];
  const isExited = vehicle.current_stage === 'exit';

  return (
    <Card
      onClick={onClick}
      sx={{
        cursor: onClick ? 'pointer' : 'default',
        transition: 'all 0.2s',
        border: 2,
        borderColor: selected ? 'warning.main' : 'divider',
        '&:hover': onClick ? { borderColor: 'warning.main', transform: 'translateY(-1px)', boxShadow: 3 } : {},
        opacity: isExited ? 0.7 : 1,
      }}
    >
      <CardContent sx={{ p: 2, '&:last-child': { pb: 2 } }}>
        <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 1.5 }}>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
            <DirectionsCarIcon sx={{ fontSize: 20, color: 'text.secondary' }} />
            <Typography variant="body2" sx={{ fontWeight: 700 }}>
              {vehicle.plate_number}
            </Typography>
          </Box>
          <Chip
            label={stageConfig.label}
            size="small"
            color={stageConfig.color}
            sx={{ height: 22, fontWeight: 600 }}
          />
        </Box>

        <Box sx={{ display: 'flex', alignItems: 'center', gap: 2, mb: 1.5 }}>
          <Typography variant="caption" color="text.secondary">
            {vehicle.vehicle_model}
          </Typography>
          {vehicle.vehicle_color && (
            <Typography variant="caption" color="text.secondary">
              {vehicle.vehicle_color}
            </Typography>
          )}
        </Box>

        <TrackingStageIndicator currentStage={vehicle.current_stage} compact />

        {isExited && (
          <Box sx={{ mt: 1.5, p: 1, bgcolor: 'action.disabledBackground', borderRadius: 1, textAlign: 'center' }}>
            <Typography variant="caption" sx={{ fontWeight: 600, color: 'text.secondary' }}>
              추적 불가 - 출차 완료
            </Typography>
          </Box>
        )}

        {vehicle.entry_time && (
          <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mt: 1 }}>
            입차: {new Date(vehicle.entry_time).toLocaleString('ko-KR')}
          </Typography>
        )}
      </CardContent>
    </Card>
  );
}
