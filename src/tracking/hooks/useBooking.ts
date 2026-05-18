import { useState, useEffect, useCallback } from 'react';
import { supabase } from '../../lib/supabase';
import type { Booking } from '../types';
import { bookingService } from '../services/trackingService';

export function useBooking() {
  const [bookings, setBookings] = useState<Booking[]>([]);
  const [loading, setLoading] = useState(true);

  const loadBookings = useCallback(async () => {
    try {
      const data = await bookingService.getAll();
      setBookings(data);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { loadBookings(); }, [loadBookings]);

  useEffect(() => {
    const channel = supabase
      .channel('bookings-rt')
      .on('postgres_changes', {
        event: '*',
        schema: 'public',
        table: 'tracking_bookings',
      }, () => { loadBookings(); })
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, [loadBookings]);

  const createBooking = useCallback(async (booking: Partial<Booking>) => {
    return bookingService.create(booking);
  }, []);

  const updateStatus = useCallback(async (id: string, status: Booking['status']) => {
    await bookingService.updateStatus(id, status);
    loadBookings();
  }, [loadBookings]);

  return { bookings, loading, createBooking, updateStatus, refresh: loadBookings };
}
