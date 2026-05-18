import { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import Box from '@mui/material/Box';
import Grid from '@mui/material/Grid';
import Typography from '@mui/material/Typography';
import Skeleton from '@mui/material/Skeleton';
import Alert from '@mui/material/Alert';
import { useVehicleTracking } from '../../hooks/useVehicleTracking';
import { useETA } from '../../hooks/useETA';
import { routeService } from '../../services/trackingService';
import TrackingMap from '../../components/Map/TrackingMap';
import DriverCard from '../../components/Vehicle/DriverCard';
import ETAPanel from '../../components/Vehicle/ETAPanel';
import type { Route, LatLng } from '../../types';
import { isWithinRadius } from '../../utils/geo';

export default function VehicleTrackingPage() {
  const { vehicleId } = useParams<{ vehicleId: string }>();
  const { selectedVehicle, locationHistory, loading } = useVehicleTracking(vehicleId);
  const [activeRoute, setActiveRoute] = useState<Route | null>(null);
  const [nearbyAlert, setNearbyAlert] = useState(false);

  useEffect(() => {
    if (!vehicleId) return;
    routeService.getByVehicle(vehicleId).then(routes => {
      const active = routes.find(r => r.status === 'active') || null;
      setActiveRoute(active);
    });
  }, [vehicleId]);

  const eta = useETA(selectedVehicle, activeRoute);

  useEffect(() => {
    if (!selectedVehicle || !activeRoute) return;
    const pickup: LatLng = { lat: activeRoute.dest_lat, lng: activeRoute.dest_lng };
    const current: LatLng = { lat: selectedVehicle.current_lat, lng: selectedVehicle.current_lng };
    if (isWithinRadius(current, pickup, 0.5)) {
      setNearbyAlert(true);
    }
  }, [selectedVehicle, activeRoute]);

  if (loading) {
    return (
      <Box sx={{ p: 3 }}>
        <Skeleton variant="rectangular" height={400} sx={{ borderRadius: 2, mb: 2 }} />
        <Skeleton variant="rectangular" height={120} sx={{ borderRadius: 2 }} />
      </Box>
    );
  }

  if (!selectedVehicle) {
    return (
      <Box sx={{ p: 3 }}>
        <Alert severity="warning">차량 정보를 찾을 수 없습니다.</Alert>
      </Box>
    );
  }

  const routePath: LatLng[] = locationHistory.map(l => ({ lat: l.lat, lng: l.lng }));
  if (activeRoute) {
    routePath.unshift({ lat: activeRoute.origin_lat, lng: activeRoute.origin_lng });
    routePath.push({ lat: activeRoute.dest_lat, lng: activeRoute.dest_lng });
  }

  return (
    <Box sx={{ p: { xs: 2, md: 3 } }}>
      <Typography variant="h5" sx={{ fontWeight: 800, mb: 2 }}>차량 실시간 추적</Typography>

      {nearbyAlert && (
        <Alert severity="success" sx={{ mb: 2 }}>
          차량이 목적지 500m 이내에 도착했습니다!
        </Alert>
      )}

      <Grid container spacing={2}>
        <Grid size={{ xs: 12, md: 8 }}>
          <TrackingMap
            vehicles={[selectedVehicle]}
            selectedVehicleId={selectedVehicle.id}
            routePath={routePath}
            height={500}
          />
        </Grid>
        <Grid size={{ xs: 12, md: 4 }}>
          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
            <DriverCard vehicle={selectedVehicle} />
            <ETAPanel
              eta={eta}
              originName={activeRoute?.origin_name}
              destinationName={activeRoute?.destination_name}
            />
          </Box>
        </Grid>
      </Grid>
    </Box>
  );
}
