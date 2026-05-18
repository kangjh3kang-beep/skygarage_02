import { useState, useEffect, useCallback, useRef } from 'react';
import { supabase } from '../../lib/supabase';
import type { Vehicle, LocationHistory } from '../types';
import { vehicleService, locationService } from '../services/trackingService';

export function useVehicleTracking(vehicleId?: string) {
  const [vehicles, setVehicles] = useState<Vehicle[]>([]);
  const [selectedVehicle, setSelectedVehicle] = useState<Vehicle | null>(null);
  const [locationHistory, setLocationHistory] = useState<LocationHistory[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const channelRef = useRef<ReturnType<typeof supabase.channel> | null>(null);
  const mountedRef = useRef(false);

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
  }, [loadVehicles, loadHistory]);

  useEffect(() => {
    if (mountedRef.current) return;
    mountedRef.current = true;

    try {
      const channel = supabase.channel(`vehicle-rt-${crypto.randomUUID()}`);
      channelRef.current = channel;

      channel.on('postgres_changes', {
        event: '*',
        schema: 'public',
        table: 'tracking_vehicles',
      }, (payload) => {
        if (payload.eventType === 'UPDATE') {
          const updated = payload.new as Vehicle;
          setVehicles(prev => prev.map(v => v.id === updated.id ? updated : v));
          if (vehicleId && updated.id === vehicleId) {
            setSelectedVehicle(updated);
          }
        } else if (payload.eventType === 'INSERT') {
          const newVehicle = payload.new as Vehicle;
          setVehicles(prev => [newVehicle, ...prev]);
        } else if (payload.eventType === 'DELETE') {
          const deletedId = (payload.old as { id: string }).id;
          setVehicles(prev => prev.filter(v => v.id !== deletedId));
          if (vehicleId && deletedId === vehicleId) {
            setSelectedVehicle(null);
          }
        }
      });

      channel.subscribe();
    } catch {
      // Realtime subscription failed - data still loads via polling
    }

    return () => {
      mountedRef.current = false;
      if (channelRef.current) {
        supabase.removeChannel(channelRef.current);
        channelRef.current = null;
      }
    };
  }, [vehicleId]);

  return { vehicles, selectedVehicle, locationHistory, loading, error, refresh: loadVehicles };
}
