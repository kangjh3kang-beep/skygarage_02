import { useState, useEffect, useCallback, useRef } from 'react';
import type { Booking } from '../types';
import { bookingService } from '../services/trackingService';

export function useBooking() {
  const [bookings, setBookings] = useState<Booking[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const loadBookings = useCallback(async () => {
    try {
      setError(null);
      const data = await bookingService.getAll();
      setBookings(data);
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadBookings();
    intervalRef.current = setInterval(loadBookings, 10000);
    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
    };
  }, [loadBookings]);

  const createBooking = useCallback(async (booking: Partial<Booking>) => {
    return bookingService.create(booking);
  }, []);

  const updateStatus = useCallback(async (id: string, status: Booking['status']) => {
    await bookingService.updateStatus(id, status);
    loadBookings();
  }, [loadBookings]);

  return { bookings, loading, error, createBooking, updateStatus, refresh: loadBookings };
}
