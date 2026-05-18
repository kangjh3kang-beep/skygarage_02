import { useState, useEffect, useCallback } from 'react';
import { supabase } from '../../lib/supabase';
import type { Vehicle, LocationHistory } from '../types';
import { vehicleService, locationService } from '../services/trackingService';

export function useVehicleTracking(vehicleId?: string) {
  const [vehicles, setVehicles] = useState<Vehicle[]>([]);
  const [selectedVehicle, setSelectedVehicle] = useState<Vehicle | null>(null);
  const [locationHistory, setLocationHistory] = useState<LocationHistory[]>([]);
  const [loading, setLoading] = useState(true);

  const loadVehicles = useCallback(async () => {
    try {
      const data = await vehicleService.getAll();
      setVehicles(data);
      if (vehicleId) {
        const v = data.find(d => d.id === vehicleId) || null;
        setSelectedVehicle(v);
      }
    } finally {
      setLoading(false);
    }
  }, [vehicleId]);

  const loadHistory = useCallback(async () => {
    if (!vehicleId) return;
    const data = await locationService.getHistory(vehicleId, 50);
    setLocationHistory(data);
  }, [vehicleId]);

  useEffect(() => {
    loadVehicles();
    loadHistory();
  }, [loadVehicles, loadHistory]);

  useEffect(() => {
    const channel = supabase
      .channel('vehicle-tracking-rt')
      .on('postgres_changes', {
        event: 'UPDATE',
        schema: 'public',
        table: 'tracking_vehicles',
      }, (payload) => {
        const updated = payload.new as Vehicle;
        setVehicles(prev => prev.map(v => v.id === updated.id ? updated : v));
        if (vehicleId && updated.id === vehicleId) {
          setSelectedVehicle(updated);
        }
      })
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, [vehicleId]);

  return { vehicles, selectedVehicle, locationHistory, loading, refresh: loadVehicles };
}
