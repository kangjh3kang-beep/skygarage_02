import { useState, useEffect, useCallback } from 'react';
import { supabase } from '../../lib/supabase';
import type { Vehicle, LocationHistory } from '../types';
import { vehicleService, locationService } from '../services/trackingService';

export function useVehicleTracking(vehicleId?: string) {
  const [vehicles, setVehicles] = useState<Vehicle[]>([]);
  const [selectedVehicle, setSelectedVehicle] = useState<Vehicle | null>(null);
  const [locationHistory, setLocationHistory] = useState<LocationHistory[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

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
      // history load failure is non-critical
    }
  }, [vehicleId]);

  useEffect(() => {
    loadVehicles();
    loadHistory();
  }, [loadVehicles, loadHistory]);

  useEffect(() => {
    const channelName = `vehicle-tracking-${vehicleId || 'all'}-${Date.now()}`;
    const channel = supabase.channel(channelName);

    channel
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
      .on('postgres_changes', {
        event: 'INSERT',
        schema: 'public',
        table: 'tracking_vehicles',
      }, (payload) => {
        const newVehicle = payload.new as Vehicle;
        setVehicles(prev => [newVehicle, ...prev]);
      })
      .on('postgres_changes', {
        event: 'DELETE',
        schema: 'public',
        table: 'tracking_vehicles',
      }, (payload) => {
        const deletedId = (payload.old as { id: string }).id;
        setVehicles(prev => prev.filter(v => v.id !== deletedId));
        if (vehicleId && deletedId === vehicleId) {
          setSelectedVehicle(null);
        }
      });

    channel.subscribe();

    return () => { supabase.removeChannel(channel); };
  }, [vehicleId]);

  return { vehicles, selectedVehicle, locationHistory, loading, error, refresh: loadVehicles };
}
