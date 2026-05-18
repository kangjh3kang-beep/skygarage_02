import { useEffect, useRef } from 'react';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import Box from '@mui/material/Box';
import type { Vehicle, LatLng } from '../../types';

interface TrackingMapProps {
  vehicles: Vehicle[];
  center?: LatLng;
  zoom?: number;
  selectedVehicleId?: string;
  routePath?: LatLng[];
  onVehicleClick?: (vehicle: Vehicle) => void;
  height?: string | number;
}

const VEHICLE_COLORS: Record<string, string> = {
  available: '#4caf50',
  in_transit: '#2196f3',
  offline: '#9e9e9e',
  maintenance: '#ff9800',
};

function createVehicleIcon(status: string, isSelected: boolean): L.DivIcon {
  const color = VEHICLE_COLORS[status] || '#9e9e9e';
  const size = isSelected ? 40 : 30;
  return L.divIcon({
    className: '',
    html: `<div style="
      width:${size}px;height:${size}px;
      background:${color};
      border:3px solid ${isSelected ? '#fff' : 'rgba(255,255,255,0.6)'};
      border-radius:50%;
      display:flex;align-items:center;justify-content:center;
      box-shadow:0 2px 8px rgba(0,0,0,0.3);
      transition:all 0.3s;
    ">
      <svg width="${size * 0.5}" height="${size * 0.5}" viewBox="0 0 24 24" fill="white">
        <path d="M18.92 6.01C18.72 5.42 18.16 5 17.5 5h-11c-.66 0-1.21.42-1.42 1.01L3 12v8c0 .55.45 1 1 1h1c.55 0 1-.45 1-1v-1h12v1c0 .55.45 1 1 1h1c.55 0 1-.45 1-1v-8l-2.08-5.99zM6.5 16c-.83 0-1.5-.67-1.5-1.5S5.67 13 6.5 13s1.5.67 1.5 1.5S7.33 16 6.5 16zm11 0c-.83 0-1.5-.67-1.5-1.5s.67-1.5 1.5-1.5 1.5.67 1.5 1.5-.67 1.5-1.5 1.5zM5 11l1.5-4.5h11L19 11H5z"/>
      </svg>
    </div>`,
    iconSize: [size, size],
    iconAnchor: [size / 2, size / 2],
  });
}

export default function TrackingMap({
  vehicles,
  center = { lat: 37.5665, lng: 126.978 },
  zoom = 13,
  selectedVehicleId,
  routePath,
  onVehicleClick,
  height = 400,
}: TrackingMapProps) {
  const mapRef = useRef<L.Map | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const markersRef = useRef<Map<string, L.Marker>>(new Map());
  const polylineRef = useRef<L.Polyline | null>(null);

  useEffect(() => {
    if (!containerRef.current || mapRef.current) return;
    mapRef.current = L.map(containerRef.current).setView([center.lat, center.lng], zoom);
    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      attribution: '&copy; OpenStreetMap contributors',
    }).addTo(mapRef.current);

    return () => {
      mapRef.current?.remove();
      mapRef.current = null;
    };
  }, []);

  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;

    const currentIds = new Set(vehicles.map(v => v.id));
    markersRef.current.forEach((marker, id) => {
      if (!currentIds.has(id)) {
        marker.remove();
        markersRef.current.delete(id);
      }
    });

    vehicles.forEach(vehicle => {
      const isSelected = vehicle.id === selectedVehicleId;
      const icon = createVehicleIcon(vehicle.status, isSelected);
      const existing = markersRef.current.get(vehicle.id);

      if (existing) {
        existing.setLatLng([vehicle.current_lat, vehicle.current_lng]);
        existing.setIcon(icon);
      } else {
        const marker = L.marker([vehicle.current_lat, vehicle.current_lng], { icon })
          .addTo(map)
          .bindTooltip(`${vehicle.driver_name} (${vehicle.plate_number})`, { direction: 'top', offset: [0, -20] });
        if (onVehicleClick) {
          marker.on('click', () => onVehicleClick(vehicle));
        }
        markersRef.current.set(vehicle.id, marker);
      }
    });
  }, [vehicles, selectedVehicleId, onVehicleClick]);

  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;

    if (polylineRef.current) {
      polylineRef.current.remove();
      polylineRef.current = null;
    }

    if (routePath && routePath.length >= 2) {
      polylineRef.current = L.polyline(
        routePath.map(p => [p.lat, p.lng] as L.LatLngTuple),
        { color: '#1976d2', weight: 4, opacity: 0.7, dashArray: '10, 5' }
      ).addTo(map);
    }
  }, [routePath]);

  useEffect(() => {
    if (selectedVehicleId && mapRef.current) {
      const v = vehicles.find(v => v.id === selectedVehicleId);
      if (v) mapRef.current.setView([v.current_lat, v.current_lng], 15, { animate: true });
    }
  }, [selectedVehicleId, vehicles]);

  return (
    <Box
      ref={containerRef}
      sx={{ width: '100%', height, borderRadius: 2, overflow: 'hidden', '& .leaflet-container': { height: '100%' } }}
    />
  );
}
