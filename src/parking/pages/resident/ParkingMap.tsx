import { useEffect, useRef } from 'react';
import Box from '@mui/material/Box';
import Typography from '@mui/material/Typography';
import Chip from '@mui/material/Chip';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import { useActiveParking } from '../../hooks/useActiveParking';
import { useHousehold } from '../../hooks/useHousehold';

export default function ParkingMap() {
  const mapRef = useRef<HTMLDivElement>(null);
  const mapInstance = useRef<L.Map | null>(null);
  const { sessions } = useActiveParking();
  const { spots } = useHousehold();

  useEffect(() => {
    if (!mapRef.current || mapInstance.current) return;
    const map = L.map(mapRef.current).setView([37.5665, 126.978], 17);
    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      attribution: '&copy; OpenStreetMap',
    }).addTo(map);
    mapInstance.current = map;

    return () => { map.remove(); mapInstance.current = null; };
  }, []);

  useEffect(() => {
    if (!mapInstance.current) return;
    const map = mapInstance.current;

    map.eachLayer(layer => {
      if (layer instanceof L.Marker || layer instanceof L.CircleMarker) {
        map.removeLayer(layer);
      }
    });

    spots.forEach(spot => {
      if (spot.lat && spot.lng) {
        L.circleMarker([spot.lat, spot.lng], {
          radius: 8,
          fillColor: spot.is_occupied ? '#ef4444' : '#22c55e',
          color: '#fff',
          weight: 2,
          fillOpacity: 0.9,
        }).addTo(map).bindPopup(`${spot.spot_number} (${spot.is_occupied ? '사용중' : '비어있음'})`);
      }
    });

    sessions.forEach(session => {
      if (session.lat && session.lng) {
        const icon = L.divIcon({
          className: '',
          html: `<div style="background:#3b82f6;color:#fff;padding:4px 8px;border-radius:6px;font-size:11px;font-weight:700;white-space:nowrap;">${session.vehicle_plate}</div>`,
        });
        L.marker([session.lat, session.lng], { icon }).addTo(map);
      }
    });
  }, [sessions, spots]);

  return (
    <Box sx={{ height: '100%', display: 'flex', flexDirection: 'column' }}>
      <Box sx={{ p: 2, display: 'flex', gap: 1, flexWrap: 'wrap' }}>
        <Chip size="small" label="비어있음" sx={{ bgcolor: '#22c55e', color: '#fff' }} />
        <Chip size="small" label="사용 중" sx={{ bgcolor: '#ef4444', color: '#fff' }} />
        <Chip size="small" label="내 차량" sx={{ bgcolor: '#3b82f6', color: '#fff' }} />
      </Box>
      <Box ref={mapRef} sx={{ flex: 1, minHeight: 400 }} />
      {sessions.length === 0 && spots.length === 0 && (
        <Box sx={{ position: 'absolute', top: '50%', left: '50%', transform: 'translate(-50%, -50%)', textAlign: 'center' }}>
          <Typography variant="body2" sx={{ color: 'text.secondary' }}>
            주차 데이터가 없습니다.
          </Typography>
        </Box>
      )}
    </Box>
  );
}
