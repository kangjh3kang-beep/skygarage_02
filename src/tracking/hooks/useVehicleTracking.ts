import { useState, useEffect, useCallback, useRef } from 'react';
import type { Vehicle, LocationHistory } from '../types';
import { vehicleService, locationService } from '../services/trackingService';

export function useVehicleTracking(vehicleId?: string) {
  const [vehicles, setVehicles] = useState<Vehicle[]>([]);
  const [selectedVehicle, setSelectedVehicle] = useState<Vehicle | null>(null);
  const [locationHistory, setLocationHistory] = useState<LocationHistory[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const loadVehicles = useCallback(async () => {
    try {
      setError(null);
      const data = await vehicleService.getAll();
      setVehicles(data);
      if (vehicleId) {
        const v = data.find(d => d.id === vehicleId) || null;
        setSelectedVehicle(v);
      }
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setLoading(false);
    }
  }, [vehicleId]);

  const loadHistory = useCallback(async () => {
    if (!vehicleId) return;
    try {
      const data = await locationService.getHistory(vehicleId, 200);
      setLocationHistory(data);
    } catch {
      // non-critical
    }
  }, [vehicleId]);

  useEffect(() => {
    loadVehicles();
    loadHistory();
    intervalRef.current = setInterval(() => {
      loadVehicles();
      loadHistory();
    }, 5000);
    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
    };
  }, [loadVehicles, loadHistory]);

  return { vehicles, selectedVehicle, locationHistory, loading, error, refresh: loadVehicles };
}
