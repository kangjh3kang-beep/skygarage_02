import { useEffect, useState, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import Box from '@mui/material/Box';
import Grid from '@mui/material/Grid';
import Typography from '@mui/material/Typography';
import Breadcrumbs from '@mui/material/Breadcrumbs';
import Link from '@mui/material/Link';
import Skeleton from '@mui/material/Skeleton';
import Alert from '@mui/material/Alert';
import { useVehicleTracking } from '../../hooks/useVehicleTracking';
import { useETA } from '../../hooks/useETA';
import { routeService, notificationService } from '../../services/trackingService';
import TrackingMap from '../../components/Map/TrackingMap';
import DriverCard from '../../components/Vehicle/DriverCard';
import ETAPanel from '../../components/Vehicle/ETAPanel';
import type { Route, LatLng } from '../../types';
import { isWithinRadius } from '../../utils/geo';

export default function VehicleTrackingPage() {
  const navigate = useNavigate();
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

  const prevEtaMinRef = useRef(0);
  const lastNotifiedAt = useRef(0);

  useEffect(() => {
    setNearbyAlert(false);
    prevEtaMinRef.current = 0;
    lastNotifiedAt.current = 0;
  }, [activeRoute?.id]);

  useEffect(() => {
    if (!selectedVehicle || !activeRoute) return;
    const destination: LatLng = { lat: activeRoute.dest_lat, lng: activeRoute.dest_lng };
    const current: LatLng = { lat: selectedVehicle.current_lat, lng: selectedVehicle.current_lng };
    if (isWithinRadius(current, destination, 0.5) && !nearbyAlert) {
      setNearbyAlert(true);
      notificationService.create({
        type: 'vehicle_nearby',
        title: '차량 접근 알림',
        message: `${selectedVehicle.driver_name} 기사님의 차량이 목적지 500m 이내에 도착했습니다.`,
      });
    }
  }, [selectedVehicle, activeRoute, nearbyAlert]);

  useEffect(() => {
    if (!eta.estimatedArrival) return;
    const now = Date.now();
    if (now - lastNotifiedAt.current < 120000) return;
    const currentMin = Math.round(eta.remainingMinutes);
    if (prevEtaMinRef.current > 0 && Math.abs(currentMin - prevEtaMinRef.current) >= 5) {
      lastNotifiedAt.current = now;
      notificationService.create({
        type: 'eta_change',
        title: '도착 예상 시간 변경',
        message: `도착 예상 시간이 ${Math.abs(currentMin - prevEtaMinRef.current)}분 ${currentMin > prevEtaMinRef.current ? '지연' : '단축'}되었습니다.`,
      });
    }
    prevEtaMinRef.current = currentMin;
  }, [eta.remainingMinutes, eta.estimatedArrival]);

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
      <Breadcrumbs sx={{ mb: 1 }}>
        <Link underline="hover" color="inherit" sx={{ cursor: 'pointer' }} onClick={() => navigate('/tracking')}>대시보드</Link>
        <Link underline="hover" color="inherit" sx={{ cursor: 'pointer' }} onClick={() => navigate('/tracking/map')}>지도</Link>
        <Typography color="text.primary" variant="body2">{selectedVehicle.driver_name}</Typography>
      </Breadcrumbs>
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
            origin={activeRoute ? { position: { lat: activeRoute.origin_lat, lng: activeRoute.origin_lng }, label: activeRoute.origin_name } : undefined}
            destination={activeRoute ? { position: { lat: activeRoute.dest_lat, lng: activeRoute.dest_lng }, label: activeRoute.destination_name } : undefined}
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
              vehicleStatus={selectedVehicle.status}
            />
          </Box>
        </Grid>
      </Grid>
    </Box>
  );
}
