import { useState, useEffect, useRef, useCallback } from 'react';
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
  const prevEtaMinRef = useRef(0);
  const visibleRef = useRef(true);

  useEffect(() => {
    const handleVisibility = () => { visibleRef.current = document.visibilityState === 'visible'; };
    document.addEventListener('visibilitychange', handleVisibility);
    return () => document.removeEventListener('visibilitychange', handleVisibility);
  }, []);

  const computeEta = useCallback(() => {
    if (!vehicle || !route || route.status !== 'active') {
      setEta({ estimatedArrival: null, remainingMinutes: 0, remainingSeconds: 0, distanceKm: 0, progressPercent: 0, isDelayed: false });
      return;
    }
    if (!visibleRef.current) return;

    const current: LatLng = { lat: vehicle.current_lat, lng: vehicle.current_lng };
    const destination: LatLng = { lat: route.dest_lat, lng: route.dest_lng };
    const origin: LatLng = { lat: route.origin_lat, lng: route.origin_lng };

    const remainingKm = haversineDistance(current, destination);

    let avgSpeed: number;
    if (vehicle.speed > 5) {
      avgSpeed = vehicle.speed;
    } else if (vehicle.status === 'in_transit') {
      avgSpeed = 25;
    } else {
      avgSpeed = 0;
    }

    const remainingMinutes = avgSpeed > 0 ? (remainingKm / avgSpeed) * 60 : 0;
    const remainingSeconds = Math.max(0, Math.round(remainingMinutes * 60));
    const estimatedArrival = avgSpeed > 0 ? new Date(Date.now() + remainingMinutes * 60000) : null;
    const progressPercent = calculateProgress(origin, destination, current);

    const isDelayed = route.estimated_arrival && estimatedArrival
      ? estimatedArrival.getTime() > new Date(route.estimated_arrival).getTime() + 5 * 60000
      : false;

    prevEtaMinRef.current = Math.round(remainingMinutes);

    setEta({ estimatedArrival, remainingMinutes, remainingSeconds, distanceKm: remainingKm, progressPercent, isDelayed });
  }, [vehicle, route]);

  useEffect(() => {
    computeEta();
    const interval = setInterval(computeEta, 3000);
    return () => clearInterval(interval);
  }, [computeEta]);

  return eta;
}
