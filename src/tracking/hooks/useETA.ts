import { useState, useEffect, useRef } from 'react';
import type { Vehicle, Route, ETAInfo, LatLng } from '../types';
import { haversineDistance, calculateProgress } from '../utils/geo';

export function useETA(vehicle: Vehicle | null, route: Route | null): ETAInfo {
  const [eta, setEta] = useState<ETAInfo>({
    estimatedArrival: null,
    remainingMinutes: 0,
    remainingSeconds: 0,
    distanceKm: 0,
    progressPercent: 0,
    isDelayed: false,
  });
  const prevEtaRef = useRef<number>(0);

  useEffect(() => {
    if (!vehicle || !route || route.status !== 'active') {
      setEta({ estimatedArrival: null, remainingMinutes: 0, remainingSeconds: 0, distanceKm: 0, progressPercent: 0, isDelayed: false });
      return;
    }

    const updateEta = () => {
      const current: LatLng = { lat: vehicle.current_lat, lng: vehicle.current_lng };
      const destination: LatLng = { lat: route.dest_lat, lng: route.dest_lng };
      const origin: LatLng = { lat: route.origin_lat, lng: route.origin_lng };

      const remainingKm = haversineDistance(current, destination);
      const avgSpeed = vehicle.speed > 0 ? vehicle.speed : 30;
      const remainingMinutes = (remainingKm / avgSpeed) * 60;
      const remainingSeconds = Math.round(remainingMinutes * 60);

      const estimatedArrival = new Date(Date.now() + remainingMinutes * 60000);
      const progressPercent = calculateProgress(origin, destination, current);

      const isDelayed = route.estimated_arrival
        ? estimatedArrival.getTime() > new Date(route.estimated_arrival).getTime() + 5 * 60000
        : false;

      const newMinutes = Math.round(remainingMinutes);
      if (prevEtaRef.current > 0 && Math.abs(newMinutes - prevEtaRef.current) >= 5) {
        // ETA changed significantly - this would trigger a notification in a real system
      }
      prevEtaRef.current = newMinutes;

      setEta({ estimatedArrival, remainingMinutes, remainingSeconds, distanceKm: remainingKm, progressPercent, isDelayed });
    };

    updateEta();
    const interval = setInterval(updateEta, 3000);
    return () => clearInterval(interval);
  }, [vehicle, route]);

  return eta;
}
