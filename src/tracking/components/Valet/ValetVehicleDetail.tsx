import { useState, useEffect, useCallback } from 'react';
import Box from '@mui/material/Box';
import Typography from '@mui/material/Typography';
import Card from '@mui/material/Card';
import CardContent from '@mui/material/CardContent';
import Grid from '@mui/material/Grid';
import Chip from '@mui/material/Chip';
import Skeleton from '@mui/material/Skeleton';
import Alert from '@mui/material/Alert';
import DirectionsCarIcon from '@mui/icons-material/DirectionsCar';
import SmartToyIcon from '@mui/icons-material/SmartToy';
import BatteryChargingFullIcon from '@mui/icons-material/BatteryChargingFull';
import { valetVehicleService, atrService, trackingEventService } from '../../services/trackingService';
import type { ValetVehicle, AtrUnit, TrackingEvent } from '../../types';
import { STAGE_CONFIG } from '../../types';
import TrackingStageIndicator from './TrackingStageIndicator';

interface ValetVehicleDetailProps {
  vehicleId: string;
}

const STAGE_DOT_COLORS: Record<string, string> = {
  info: '#0288d1',
  success: '#2e7d32',
  warning: '#ed6c02',
  error: '#d32f2f',
  default: '#9e9e9e',
};

export default function ValetVehicleDetail({ vehicleId }: ValetVehicleDetailProps) {
  const [vehicle, setVehicle] = useState<ValetVehicle | null>(null);
  const [atr, setAtr] = useState<AtrUnit | null>(null);
  const [events, setEvents] = useState<TrackingEvent[]>([]);
  const [loading, setLoading] = useState(true);

  const loadData = useCallback(async () => {
    try {
      const [vData, evData] = await Promise.all([
        valetVehicleService.getById(vehicleId),
        trackingEventService.getByVehicle(vehicleId),
      ]);
      setVehicle(vData);
      setEvents(evData);
      if (vData?.assigned_atr_id) {
        const aData = await atrService.getById(vData.assigned_atr_id);
        setAtr(aData);
      } else {
        setAtr(null);
      }
    } finally {
      setLoading(false);
    }
  }, [vehicleId]);

  useEffect(() => {
    loadData();
    const interval = setInterval(loadData, 5000);
    return () => clearInterval(interval);
  }, [loadData]);

  if (loading) {
    return (
      <Box sx={{ p: 3 }}>
        <Skeleton variant="rectangular" height={120} sx={{ borderRadius: 2, mb: 2 }} />
        <Skeleton variant="rectangular" height={200} sx={{ borderRadius: 2, mb: 2 }} />
        <Skeleton variant="rectangular" height={150} sx={{ borderRadius: 2 }} />
      </Box>
    );
  }

  if (!vehicle) {
    return (
      <Box sx={{ p: 3 }}>
        <Alert severity="warning">차량 정보를 찾을 수 없습니다.</Alert>
      </Box>
    );
  }

  const isExited = vehicle.current_stage === 'exit';

  return (
    <Box>
      {/* Vehicle Info Header */}
      <Card sx={{ mb: 2 }}>
        <CardContent>
          <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 2 }}>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5 }}>
              <DirectionsCarIcon sx={{ fontSize: 28, color: 'text.secondary' }} />
              <Box>
                <Typography variant="h6" sx={{ fontWeight: 800, lineHeight: 1.2 }}>
                  {vehicle.plate_number}
                </Typography>
                <Typography variant="caption" color="text.secondary">
                  {vehicle.vehicle_model} {vehicle.vehicle_color && `/ ${vehicle.vehicle_color}`}
                </Typography>
              </Box>
            </Box>
            <Chip
              label={STAGE_CONFIG[vehicle.current_stage].label}
              color={STAGE_CONFIG[vehicle.current_stage].color}
            />
          </Box>
          <TrackingStageIndicator currentStage={vehicle.current_stage} />
        </CardContent>
      </Card>

      {/* Exit State */}
      {isExited && (
        <Alert severity="info" sx={{ mb: 2 }}>
          차량이 출차 완료되어 더 이상 추적이 불가합니다. 출차 시각: {vehicle.exit_time ? new Date(vehicle.exit_time).toLocaleString('ko-KR') : '-'}
        </Alert>
      )}

      {/* Position & ATR Info */}
      {!isExited && (
        <Grid container spacing={2} sx={{ mb: 2 }}>
          <Grid size={{ xs: 12, sm: 6 }}>
            <Card>
              <CardContent>
                <Typography variant="subtitle2" sx={{ fontWeight: 700, mb: 1.5 }}>실내 위치</Typography>
                <Grid container spacing={1}>
                  <Grid size={{ xs: 4 }}>
                    <Typography variant="caption" color="text.secondary">X</Typography>
                    <Typography variant="body2" sx={{ fontWeight: 600 }}>{vehicle.current_x.toFixed(1)}</Typography>
                  </Grid>
                  <Grid size={{ xs: 4 }}>
                    <Typography variant="caption" color="text.secondary">Y</Typography>
                    <Typography variant="body2" sx={{ fontWeight: 600 }}>{vehicle.current_y.toFixed(1)}</Typography>
                  </Grid>
                  <Grid size={{ xs: 4 }}>
                    <Typography variant="caption" color="text.secondary">층</Typography>
                    <Typography variant="body2" sx={{ fontWeight: 600 }}>{vehicle.current_floor}F</Typography>
                  </Grid>
                </Grid>
                {vehicle.storage_zone && (
                  <Box sx={{ mt: 1.5 }}>
                    <Typography variant="caption" color="text.secondary">보관 위치</Typography>
                    <Typography variant="body2" sx={{ fontWeight: 600 }}>
                      {vehicle.storage_zone} 구역 / {vehicle.storage_slot || '-'} 슬롯
                    </Typography>
                  </Box>
                )}
              </CardContent>
            </Card>
          </Grid>

          <Grid size={{ xs: 12, sm: 6 }}>
            <Card>
              <CardContent>
                <Typography variant="subtitle2" sx={{ fontWeight: 700, mb: 1.5 }}>
                  <SmartToyIcon sx={{ fontSize: 16, mr: 0.5, verticalAlign: 'text-bottom' }} />
                  담당 ATR
                </Typography>
                {atr ? (
                  <Box>
                    <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 1 }}>
                      <Typography variant="body2" sx={{ fontWeight: 600 }}>{atr.display_name}</Typography>
                      <Chip
                        label={atr.status === 'transporting' ? '운송중' : atr.status === 'idle' ? '대기' : atr.status}
                        size="small"
                        color={atr.status === 'transporting' ? 'info' : 'default'}
                        sx={{ height: 20 }}
                      />
                    </Box>
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                      <BatteryChargingFullIcon sx={{ fontSize: 16, color: atr.battery_level > 20 ? 'success.main' : 'error.main' }} />
                      <Typography variant="caption">{atr.battery_level}%</Typography>
                      <Typography variant="caption" color="text.secondary" sx={{ ml: 1 }}>
                        속도: {atr.speed.toFixed(1)} m/s
                      </Typography>
                    </Box>
                  </Box>
                ) : (
                  <Typography variant="body2" color="text.secondary">ATR 미배정</Typography>
                )}
              </CardContent>
            </Card>
          </Grid>
        </Grid>
      )}

      {/* Event Timeline */}
      <Card>
        <CardContent>
          <Typography variant="subtitle2" sx={{ fontWeight: 700, mb: 1.5 }}>이벤트 기록</Typography>
          {events.length === 0 ? (
            <Typography variant="body2" color="text.secondary" sx={{ py: 2, textAlign: 'center' }}>
              아직 기록된 이벤트가 없습니다.
            </Typography>
          ) : (
            <Box sx={{ pl: 1 }}>
              {events.map((ev, idx) => {
                const stageColor = ev.to_stage === 'exit' ? 'default' : (STAGE_CONFIG[ev.to_stage]?.color || 'default');
                const dotColor = STAGE_DOT_COLORS[stageColor] || STAGE_DOT_COLORS.default;
                return (
                  <Box key={ev.id} sx={{ display: 'flex', gap: 1.5, position: 'relative' }}>
                    {/* Connector line */}
                    <Box sx={{ display: 'flex', flexDirection: 'column', alignItems: 'center', width: 16 }}>
                      <Box sx={{ width: 12, height: 12, borderRadius: '50%', bgcolor: dotColor, flexShrink: 0, mt: 0.5 }} />
                      {idx < events.length - 1 && (
                        <Box sx={{ width: 2, flex: 1, bgcolor: 'divider', my: 0.5 }} />
                      )}
                    </Box>
                    {/* Content */}
                    <Box sx={{ flex: 1, pb: idx < events.length - 1 ? 2 : 0 }}>
                      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                        <Typography variant="body2" sx={{ fontWeight: 600 }}>
                          {ev.from_stage ? `${STAGE_CONFIG[ev.from_stage]?.label} → ` : ''}{STAGE_CONFIG[ev.to_stage]?.label}
                        </Typography>
                        <Typography variant="caption" color="text.secondary">
                          {new Date(ev.created_at).toLocaleString('ko-KR')}
                        </Typography>
                      </Box>
                      {ev.notes && (
                        <Typography variant="caption" color="text.secondary">{ev.notes}</Typography>
                      )}
                    </Box>
                  </Box>
                );
              })}
            </Box>
          )}
        </CardContent>
      </Card>
    </Box>
  );
}
