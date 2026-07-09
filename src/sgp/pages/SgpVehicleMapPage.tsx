import { useState, useEffect, useRef } from 'react';
import Box from '@mui/material/Box';
import Typography from '@mui/material/Typography';
import Card from '@mui/material/Card';
import CardContent from '@mui/material/CardContent';
import Chip from '@mui/material/Chip';
import IconButton from '@mui/material/IconButton';
import MyLocationIcon from '@mui/icons-material/MyLocation';
import DirectionsCarIcon from '@mui/icons-material/DirectionsCar';
import AccessTimeIcon from '@mui/icons-material/AccessTime';
import LocalParkingIcon from '@mui/icons-material/LocalParking';
import RefreshIcon from '@mui/icons-material/Refresh';
import { useSgpAuth } from '../contexts/SgpAuthContext';
import { supabase } from '../../lib/supabase';

interface VehicleLocation {
  id: string;
  vehicle_plate: string;
  lat: number;
  lng: number;
  floor: string;
  zone: string;
  spot_number: string;
  status: 'parked' | 'moving' | 'exiting';
  parked_at: string;
}

export default function SgpVehicleMapPage() {
  const { user } = useSgpAuth();
  const mapRef = useRef<HTMLDivElement>(null);
  const mapInstanceRef = useRef<L.Map | null>(null);
  const [vehicles, setVehicles] = useState<VehicleLocation[]>([]);
  const [selectedVehicle, setSelectedVehicle] = useState<VehicleLocation | null>(null);
  const [mapLoaded, setMapLoaded] = useState(false);

  useEffect(() => {
    if (!user) return;
    loadVehicleLocations();
    const interval = setInterval(loadVehicleLocations, 10000);
    return () => clearInterval(interval);
  }, [user]);

  useEffect(() => {
    if (!mapRef.current || mapLoaded) return;
    import('leaflet').then((L) => {
      if (!mapRef.current || mapInstanceRef.current) return;

      const map = L.map(mapRef.current, {
        center: [37.5665, 126.9780],
        zoom: 16,
        zoomControl: false,
        attributionControl: false,
      });

      L.tileLayer('https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png', {
        maxZoom: 20,
      }).addTo(map);

      mapInstanceRef.current = map;
      setMapLoaded(true);
    });

    return () => {
      if (mapInstanceRef.current) {
        mapInstanceRef.current.remove();
        mapInstanceRef.current = null;
      }
    };
  }, []);

  useEffect(() => {
    if (!mapInstanceRef.current || !mapLoaded) return;
    import('leaflet').then((L) => {
      const map = mapInstanceRef.current!;
      map.eachLayer((layer) => {
        if ((layer as L.Marker).getLatLng) map.removeLayer(layer);
      });

      L.tileLayer('https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png', {
        maxZoom: 20,
      }).addTo(map);

      vehicles.forEach(v => {
        const icon = L.divIcon({
          className: 'vehicle-marker',
          html: `<div style="
            width:36px;height:36px;border-radius:50%;
            background:${v.status === 'parked' ? '#00d4aa' : v.status === 'moving' ? '#ff9800' : '#2196f3'};
            display:flex;align-items:center;justify-content:center;
            box-shadow:0 3px 12px rgba(0,212,170,0.4);
            border:2px solid #fff;
          "><svg width="18" height="18" viewBox="0 0 24 24" fill="#0d1b2a"><path d="M18.92 6.01C18.72 5.42 18.16 5 17.5 5h-11c-.66 0-1.21.42-1.42 1.01L3 12v8c0 .55.45 1 1 1h1c.55 0 1-.45 1-1v-1h12v1c0 .55.45 1 1 1h1c.55 0 1-.45 1-1v-8l-2.08-5.99zM6.5 16c-.83 0-1.5-.67-1.5-1.5S5.67 13 6.5 13s1.5.67 1.5 1.5S7.33 16 6.5 16zm11 0c-.83 0-1.5-.67-1.5-1.5s.67-1.5 1.5-1.5 1.5.67 1.5 1.5-.67 1.5-1.5 1.5zM5 11l1.5-4.5h11L19 11H5z"/></svg></div>`,
          iconSize: [36, 36],
          iconAnchor: [18, 18],
        });

        L.marker([v.lat, v.lng], { icon })
          .addTo(map)
          .on('click', () => setSelectedVehicle(v));
      });

      if (vehicles.length > 0) {
        const bounds = L.latLngBounds(vehicles.map(v => [v.lat, v.lng] as [number, number]));
        map.fitBounds(bounds, { padding: [50, 50] });
      }
    });
  }, [vehicles, mapLoaded]);

  const loadVehicleLocations = async () => {
    if (!user) return;

    const { data: payments } = await supabase
      .from('sgp_parking_payments')
      .select('*')
      .eq('user_id', user.id)
      .eq('status', 'pending')
      .order('entry_at', { ascending: false });

    if (payments && payments.length > 0) {
      const mapped: VehicleLocation[] = payments.map((p, idx) => ({
        id: p.id,
        vehicle_plate: p.vehicle_plate,
        lat: 37.5665 + (Math.random() - 0.5) * 0.002,
        lng: 126.9780 + (Math.random() - 0.5) * 0.002,
        floor: `B${idx + 1}`,
        zone: `Z${String.fromCharCode(65 + idx)}`,
        spot_number: `${idx + 1}${String.fromCharCode(65 + Math.floor(Math.random() * 4))}-${Math.floor(Math.random() * 50 + 1)}`,
        status: 'parked' as const,
        parked_at: p.entry_at,
      }));
      setVehicles(mapped);
      if (!selectedVehicle && mapped.length > 0) setSelectedVehicle(mapped[0]);
    } else {
      setVehicles([{
        id: 'demo',
        vehicle_plate: '12가 3456',
        lat: 37.5665,
        lng: 126.9780,
        floor: 'B2',
        zone: 'ZA',
        spot_number: 'A-23',
        status: 'parked',
        parked_at: new Date(Date.now() - 3600000).toISOString(),
      }]);
    }
  };

  const centerOnVehicle = (v: VehicleLocation) => {
    if (mapInstanceRef.current) {
      mapInstanceRef.current.setView([v.lat, v.lng], 18, { animate: true });
    }
    setSelectedVehicle(v);
  };

  const getElapsedTime = (dateStr: string) => {
    const mins = Math.floor((Date.now() - new Date(dateStr).getTime()) / 60000);
    if (mins < 60) return `${mins}분`;
    return `${Math.floor(mins / 60)}시간 ${mins % 60}분`;
  };

  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', height: 'calc(100dvh - 120px)' }}>
      {/* Header */}
      <Box sx={{ px: 2, py: 1.5, display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <Typography variant="subtitle1" sx={{ color: '#fff', fontWeight: 700 }}>내 차 위치</Typography>
        <IconButton size="small" onClick={loadVehicleLocations} sx={{ color: 'rgba(255,255,255,0.6)' }}>
          <RefreshIcon sx={{ fontSize: 20 }} />
        </IconButton>
      </Box>

      {/* Map */}
      <Box sx={{ flex: 1, position: 'relative', mx: 2, borderRadius: 3, overflow: 'hidden', border: '1px solid rgba(255,255,255,0.1)' }}>
        <Box ref={mapRef} sx={{ width: '100%', height: '100%' }} />
        <IconButton
          onClick={() => selectedVehicle && centerOnVehicle(selectedVehicle)}
          sx={{
            position: 'absolute', bottom: 16, right: 16, zIndex: 1000,
            bgcolor: 'rgba(0,212,170,0.9)', color: '#0d1b2a',
            '&:hover': { bgcolor: '#00d4aa' },
            boxShadow: '0 4px 12px rgba(0,0,0,0.3)',
          }}
        >
          <MyLocationIcon />
        </IconButton>
      </Box>

      {/* Vehicle Info Panel */}
      <Box sx={{ px: 2, pt: 2, pb: 1 }}>
        {selectedVehicle ? (
          <Card sx={{
            bgcolor: 'rgba(255,255,255,0.04)',
            border: '1px solid rgba(0,212,170,0.15)',
            borderRadius: 3,
          }}>
            <CardContent sx={{ p: 2, '&:last-child': { pb: 2 } }}>
              <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 1.5 }}>
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                  <DirectionsCarIcon sx={{ color: '#00d4aa', fontSize: 22 }} />
                  <Typography variant="body1" sx={{ color: '#fff', fontWeight: 700 }}>
                    {selectedVehicle.vehicle_plate}
                  </Typography>
                </Box>
                <Chip
                  label={selectedVehicle.status === 'parked' ? '주차중' : selectedVehicle.status === 'moving' ? '이동중' : '출차중'}
                  size="small"
                  sx={{
                    height: 22, fontSize: '0.7rem', fontWeight: 600,
                    bgcolor: selectedVehicle.status === 'parked' ? 'rgba(0,212,170,0.12)' : 'rgba(255,152,0,0.12)',
                    color: selectedVehicle.status === 'parked' ? '#00d4aa' : '#ff9800',
                  }}
                />
              </Box>
              <Box sx={{ display: 'flex', gap: 3 }}>
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
                  <LocalParkingIcon sx={{ fontSize: 14, color: 'rgba(255,255,255,0.4)' }} />
                  <Typography variant="caption" sx={{ color: 'rgba(255,255,255,0.6)' }}>
                    {selectedVehicle.floor} / {selectedVehicle.spot_number}
                  </Typography>
                </Box>
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
                  <AccessTimeIcon sx={{ fontSize: 14, color: 'rgba(255,255,255,0.4)' }} />
                  <Typography variant="caption" sx={{ color: 'rgba(255,255,255,0.6)' }}>
                    {getElapsedTime(selectedVehicle.parked_at)} 경과
                  </Typography>
                </Box>
              </Box>
            </CardContent>
          </Card>
        ) : (
          <Typography variant="body2" sx={{ color: 'rgba(255,255,255,0.4)', textAlign: 'center' }}>
            주차중인 차량이 없습니다
          </Typography>
        )}
      </Box>
    </Box>
  );
}
