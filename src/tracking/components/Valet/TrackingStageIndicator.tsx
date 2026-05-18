import Box from '@mui/material/Box';
import Typography from '@mui/material/Typography';
import { useTheme } from '@mui/material/styles';
import type { VehicleStage } from '../../types';
import { STAGE_CONFIG, STAGE_LABELS } from '../../types';

interface TrackingStageIndicatorProps {
  currentStage: VehicleStage;
  compact?: boolean;
}

export default function TrackingStageIndicator({ currentStage, compact = false }: TrackingStageIndicatorProps) {
  const theme = useTheme();
  const currentStep = STAGE_CONFIG[currentStage].step;

  const getStepColor = (step: number) => {
    if (step < currentStep) return theme.palette.success.main;
    if (step === currentStep) return theme.palette.warning.main;
    return theme.palette.action.disabled;
  };

  const getLineColor = (step: number) => {
    if (step < currentStep) return theme.palette.success.main;
    return theme.palette.action.disabled;
  };

  if (compact) {
    return (
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
        {STAGE_LABELS.map((stage, idx) => (
          <Box key={stage} sx={{ display: 'flex', alignItems: 'center' }}>
            <Box
              sx={{
                width: 10,
                height: 10,
                borderRadius: '50%',
                bgcolor: getStepColor(idx),
                transition: 'background-color 0.3s',
              }}
            />
            {idx < STAGE_LABELS.length - 1 && (
              <Box
                sx={{
                  width: 12,
                  height: 2,
                  bgcolor: getLineColor(idx),
                  transition: 'background-color 0.3s',
                }}
              />
            )}
          </Box>
        ))}
      </Box>
    );
  }

  return (
    <Box sx={{ width: '100%', py: 2 }}>
      <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', position: 'relative' }}>
        {/* Connecting line */}
        <Box
          sx={{
            position: 'absolute',
            top: '50%',
            left: '10%',
            right: '10%',
            height: 3,
            bgcolor: 'action.disabled',
            transform: 'translateY(-50%)',
            zIndex: 0,
          }}
        />
        <Box
          sx={{
            position: 'absolute',
            top: '50%',
            left: '10%',
            width: `${Math.min(currentStep / (STAGE_LABELS.length - 1), 1) * 80}%`,
            height: 3,
            bgcolor: 'success.main',
            transform: 'translateY(-50%)',
            zIndex: 1,
            transition: 'width 0.5s ease-in-out',
          }}
        />

        {STAGE_LABELS.map((stage, idx) => {
          const config = STAGE_CONFIG[stage];
          const isActive = idx === currentStep;
          const isCompleted = idx < currentStep;

          return (
            <Box
              key={stage}
              sx={{
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                position: 'relative',
                zIndex: 2,
                flex: 1,
              }}
            >
              <Box
                sx={{
                  width: isActive ? 36 : 28,
                  height: isActive ? 36 : 28,
                  borderRadius: '50%',
                  bgcolor: isCompleted ? 'success.main' : isActive ? 'warning.main' : 'action.disabledBackground',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  border: isActive ? '3px solid' : '2px solid',
                  borderColor: isActive ? 'warning.light' : 'transparent',
                  boxShadow: isActive ? `0 0 12px ${theme.palette.warning.main}40` : 'none',
                  transition: 'all 0.3s ease-in-out',
                }}
              >
                <Typography
                  variant="caption"
                  sx={{
                    fontWeight: 800,
                    color: isCompleted || isActive ? '#fff' : 'text.disabled',
                    fontSize: isActive ? '0.7rem' : '0.6rem',
                  }}
                >
                  {idx + 1}
                </Typography>
              </Box>
              <Typography
                variant="caption"
                sx={{
                  mt: 1,
                  fontWeight: isActive ? 700 : 400,
                  color: isActive ? 'text.primary' : isCompleted ? 'success.main' : 'text.disabled',
                  fontSize: '0.7rem',
                  textAlign: 'center',
                  whiteSpace: 'nowrap',
                }}
              >
                {config.label}
              </Typography>
            </Box>
          );
        })}
      </Box>
    </Box>
  );
}
