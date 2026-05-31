import { useState, useEffect, useCallback } from 'react';
import Box from '@mui/material/Box';
import Grid from '@mui/material/Grid';
import Typography from '@mui/material/Typography';
import Card from '@mui/material/Card';
import CardContent from '@mui/material/CardContent';
import Chip from '@mui/material/Chip';
import Button from '@mui/material/Button';
import Skeleton from '@mui/material/Skeleton';
import Tabs from '@mui/material/Tabs';
import Tab from '@mui/material/Tab';
import DirectionsCarIcon from '@mui/icons-material/DirectionsCar';
import LocalParkingIcon from '@mui/icons-material/LocalParking';
import SmartToyIcon from '@mui/icons-material/SmartToy';
import ExitToAppIcon from '@mui/icons-material/ExitToApp';
import NotificationsActiveIcon from '@mui/icons-material/NotificationsActive';
import { useNavigate } from 'react-router-dom';
import { useNotifications } from '../../hooks/useNotifications';
import { valetVehicleService, atrService } from '../../services/trackingService';
import type { ValetVehicle, AtrUnit, VehicleStage } from '../../types';
import { STAGE_CONFIG } from '../../types';
import ValetVehicleCard from './ValetVehicleCard';
import ValetFloorMap from './ValetFloorMap';
import TrackingStageIndicator from './TrackingStageIndicator';

type StageFilter = VehicleStage | 'all';

export default function ValetDashboard() {
  const navigate = useNavigate();
  const { unreadCount } = useNotifications();
  const [vehicles, setVehicles] = useState<ValetVehicle[]>([]);
  const [atrUnits, setAtrUnits] = useState<AtrUnit[]>([]);
  const [loading, setLoading] = useState(true);
  const [stageFilter, setStageFilter] = useState<StageFilter>('all');
  const [selectedVehicleId, setSelectedVehicleId] = useState<string>();
  const [viewTab, setViewTab] = useState(0);

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

  const filteredVehicles = stageFilter === 'all'
    ? vehicles
    : vehicles.filter(v => v.current_stage === stageFilter);

  const stageCounts: Record<VehicleStage, number> = {
    entry: vehicles.filter(v => v.current_stage === 'entry').length,
    stored: vehicles.filter(v => v.current_stage === 'stored').length,
    atr_pickup: vehicles.filter(v => v.current_stage === 'atr_pickup').length,
    in_transit: vehicles.filter(v => v.current_stage === 'in_transit').length,
    exit: vehicles.filter(v => v.current_stage === 'exit').length,
  };

  const activeAtrCount = atrUnits.filter(a => a.status === 'transporting' || a.status === 'assigned').length;

  if (loading) {
    return (
      <Box sx={{ p: 3 }}>
        <Skeleton variant="text" width={200} height={40} sx={{ mb: 2 }} />
        <Grid container spacing={2}>
          {[1, 2, 3, 4].map(i => <Grid size={{ xs: 6, md: 3 }} key={i}><Skeleton variant="rectangular" height={100} sx={{ borderRadius: 2 }} /></Grid>)}
        </Grid>
        <Skeleton variant="rectangular" height={350} sx={{ borderRadius: 2, mt: 3 }} />
      </Box>
    );
  }

  const selectedVehicle = vehicles.find(v => v.id === selectedVehicleId);

  return (
    <Box sx={{ p: { xs: 2, md: 3 } }}>
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 3 }}>
        <Typography variant="h5" sx={{ fontWeight: 800 }}>발레파킹 추적</Typography>
        <Box sx={{ display: 'flex', gap: 1 }}>
          <Button
            variant="outlined"
            size="small"
            startIcon={<NotificationsActiveIcon />}
            onClick={() => navigate('/tracking/notifications')}
            color={unreadCount > 0 ? 'warning' : 'inherit'}
          >
            {unreadCount > 0 ? unreadCount : '알림'}
          </Button>
        </Box>
      </Box>

      {/* Stage Summary Cards */}
      <Grid container spacing={1.5} sx={{ mb: 3 }}>
        <Grid size={{ xs: 6, sm: 4, md: 2.4 }}>
          <Card
            sx={{ cursor: 'pointer', border: stageFilter === 'entry' ? 2 : 1, borderColor: stageFilter === 'entry' ? 'info.main' : 'divider' }}
            onClick={() => setStageFilter(stageFilter === 'entry' ? 'all' : 'entry')}
          >
            <CardContent sx={{ textAlign: 'center', py: 1.5, px: 1 }}>
              <DirectionsCarIcon sx={{ fontSize: 24, color: 'info.main', mb: 0.5 }} />
              <Typography variant="h5" sx={{ fontWeight: 800 }}>{stageCounts.entry}</Typography>
              <Typography variant="caption" color="text.secondary">입차</Typography>
            </CardContent>
          </Card>
        </Grid>
        <Grid size={{ xs: 6, sm: 4, md: 2.4 }}>
          <Card
            sx={{ cursor: 'pointer', border: stageFilter === 'stored' ? 2 : 1, borderColor: stageFilter === 'stored' ? 'success.main' : 'divider' }}
            onClick={() => setStageFilter(stageFilter === 'stored' ? 'all' : 'stored')}
          >
            <CardContent sx={{ textAlign: 'center', py: 1.5, px: 1 }}>
              <LocalParkingIcon sx={{ fontSize: 24, color: 'success.main', mb: 0.5 }} />
              <Typography variant="h5" sx={{ fontWeight: 800 }}>{stageCounts.stored}</Typography>
              <Typography variant="caption" color="text.secondary">보관 중</Typography>
            </CardContent>
          </Card>
        </Grid>
        <Grid size={{ xs: 6, sm: 4, md: 2.4 }}>
          <Card
            sx={{ cursor: 'pointer', border: stageFilter === 'atr_pickup' ? 2 : 1, borderColor: stageFilter === 'atr_pickup' ? 'warning.main' : 'divider' }}
            onClick={() => setStageFilter(stageFilter === 'atr_pickup' ? 'all' : 'atr_pickup')}
          >
            <CardContent sx={{ textAlign: 'center', py: 1.5, px: 1 }}>
              <SmartToyIcon sx={{ fontSize: 24, color: 'warning.main', mb: 0.5 }} />
              <Typography variant="h5" sx={{ fontWeight: 800 }}>{stageCounts.atr_pickup}</Typography>
              <Typography variant="caption" color="text.secondary">ATR 픽업</Typography>
            </CardContent>
          </Card>
        </Grid>
        <Grid size={{ xs: 6, sm: 4, md: 2.4 }}>
          <Card
            sx={{ cursor: 'pointer', border: stageFilter === 'in_transit' ? 2 : 1, borderColor: stageFilter === 'in_transit' ? 'error.main' : 'divider' }}
            onClick={() => setStageFilter(stageFilter === 'in_transit' ? 'all' : 'in_transit')}
          >
            <CardContent sx={{ textAlign: 'center', py: 1.5, px: 1 }}>
              <SmartToyIcon sx={{ fontSize: 24, color: 'error.main', mb: 0.5 }} />
              <Typography variant="h5" sx={{ fontWeight: 800 }}>{stageCounts.in_transit}</Typography>
              <Typography variant="caption" color="text.secondary">운송 중</Typography>
            </CardContent>
          </Card>
        </Grid>
        <Grid size={{ xs: 6, sm: 4, md: 2.4 }}>
          <Card
            sx={{ cursor: 'pointer', border: stageFilter === 'exit' ? 2 : 1, borderColor: stageFilter === 'exit' ? 'default' : 'divider' }}
            onClick={() => setStageFilter(stageFilter === 'exit' ? 'all' : 'exit')}
          >
            <CardContent sx={{ textAlign: 'center', py: 1.5, px: 1 }}>
              <ExitToAppIcon sx={{ fontSize: 24, color: 'text.secondary', mb: 0.5 }} />
              <Typography variant="h5" sx={{ fontWeight: 800 }}>{stageCounts.exit}</Typography>
              <Typography variant="caption" color="text.secondary">출차</Typography>
            </CardContent>
          </Card>
        </Grid>
      </Grid>

      {/* ATR Status */}
      <Card sx={{ mb: 3, border: 1, borderColor: activeAtrCount > 0 ? 'info.main' : 'divider' }}>
        <CardContent sx={{ py: 1.5, px: 2, display: 'flex', alignItems: 'center', gap: 2, flexWrap: 'wrap' }}>
          <SmartToyIcon sx={{ color: 'info.main' }} />
          <Typography variant="subtitle2" sx={{ fontWeight: 700 }}>ATR 현황</Typography>
          <Chip label={`가동 ${activeAtrCount}대`} size="small" color="info" />
          <Chip label={`전체 ${atrUnits.length}대`} size="small" variant="outlined" />
          {atrUnits.filter(a => a.battery_level < 20).length > 0 && (
            <Chip label={`저배터리 ${atrUnits.filter(a => a.battery_level < 20).length}대`} size="small" color="warning" />
          )}
        </CardContent>
      </Card>

      {/* View Tabs */}
      <Tabs value={viewTab} onChange={(_, v) => setViewTab(v)} sx={{ mb: 2 }}>
        <Tab label="실내 맵" />
        <Tab label="목록 뷰" />
      </Tabs>

      {viewTab === 0 && (
        <Box sx={{ mb: 3 }}>
          <ValetFloorMap
            vehicles={filteredVehicles}
            atrUnits={atrUnits}
            selectedVehicleId={selectedVehicleId}
            onVehicleClick={(v) => setSelectedVehicleId(v.id)}
            floor={1}
          />
        </Box>
      )}

      {viewTab === 1 && (
        <Grid container spacing={2} sx={{ mb: 3 }}>
          {filteredVehicles.length === 0 ? (
            <Grid size={{ xs: 12 }}>
              <Card sx={{ border: '1px dashed', borderColor: 'divider' }}>
                <CardContent sx={{ textAlign: 'center', py: 4 }}>
                  <DirectionsCarIcon sx={{ fontSize: 40, color: 'text.disabled', mb: 1 }} />
                  <Typography variant="body2" color="text.secondary">
                    {stageFilter === 'all' ? '등록된 차량이 없습니다.' : `${STAGE_CONFIG[stageFilter].label} 단계의 차량이 없습니다.`}
                  </Typography>
                </CardContent>
              </Card>
            </Grid>
          ) : (
            filteredVehicles.map(v => (
              <Grid size={{ xs: 12, sm: 6, md: 4 }} key={v.id}>
                <ValetVehicleCard
                  vehicle={v}
                  selected={v.id === selectedVehicleId}
                  onClick={() => setSelectedVehicleId(v.id)}
                />
              </Grid>
            ))
          )}
        </Grid>
      )}

      {/* Selected Vehicle Detail */}
      {selectedVehicle && (
        <Card sx={{ border: 2, borderColor: 'warning.main' }}>
          <CardContent>
            <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2 }}>
              <Typography variant="subtitle1" sx={{ fontWeight: 700 }}>
                {selectedVehicle.plate_number} - {selectedVehicle.vehicle_model}
              </Typography>
              <Chip
                label={STAGE_CONFIG[selectedVehicle.current_stage].label}
                color={STAGE_CONFIG[selectedVehicle.current_stage].color}
                size="small"
              />
            </Box>

            <TrackingStageIndicator currentStage={selectedVehicle.current_stage} />

            {selectedVehicle.current_stage === 'exit' ? (
              <Box sx={{ mt: 2, p: 2, bgcolor: 'action.disabledBackground', borderRadius: 2, textAlign: 'center' }}>
                <Typography variant="body2" sx={{ fontWeight: 600, color: 'text.secondary' }}>
                  추적 불가 - 차량이 출차되어 단지 외부로 이동했습니다.
                </Typography>
                {selectedVehicle.exit_time && (
                  <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mt: 0.5 }}>
                    출차 시각: {new Date(selectedVehicle.exit_time).toLocaleString('ko-KR')}
                  </Typography>
                )}
              </Box>
            ) : (
              <Grid container spacing={2} sx={{ mt: 1 }}>
                <Grid size={{ xs: 6, sm: 3 }}>
                  <Typography variant="caption" color="text.secondary">위치(X, Y)</Typography>
                  <Typography variant="body2" sx={{ fontWeight: 600 }}>
                    {selectedVehicle.current_x.toFixed(0)}, {selectedVehicle.current_y.toFixed(0)}
                  </Typography>
                </Grid>
                <Grid size={{ xs: 6, sm: 3 }}>
                  <Typography variant="caption" color="text.secondary">층</Typography>
                  <Typography variant="body2" sx={{ fontWeight: 600 }}>{selectedVehicle.current_floor}F</Typography>
                </Grid>
                <Grid size={{ xs: 6, sm: 3 }}>
                  <Typography variant="caption" color="text.secondary">보관구역</Typography>
                  <Typography variant="body2" sx={{ fontWeight: 600 }}>
                    {selectedVehicle.storage_zone || '-'} / {selectedVehicle.storage_slot || '-'}
                  </Typography>
                </Grid>
                <Grid size={{ xs: 6, sm: 3 }}>
                  <Typography variant="caption" color="text.secondary">담당 ATR</Typography>
                  <Typography variant="body2" sx={{ fontWeight: 600 }}>
                    {selectedVehicle.assigned_atr_id
                      ? atrUnits.find(a => a.id === selectedVehicle.assigned_atr_id)?.display_name || '-'
                      : '미배정'}
                  </Typography>
                </Grid>
              </Grid>
            )}
          </CardContent>
        </Card>
      )}
    </Box>
  );
}
