import { useState, useEffect, useCallback } from 'react';
import { supabase } from '../../lib/supabase';
import { useParkingAuth } from '../contexts/ParkingAuthContext';
import type { BillingRecord, PaymentMethod } from '../types';

export function useBilling() {
  const { user } = useParkingAuth();
  const [records, setRecords] = useState<BillingRecord[]>([]);
  const [paymentMethods, setPaymentMethods] = useState<PaymentMethod[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchRecords = useCallback(async () => {
    if (!user) return;
    const { data } = await supabase
      .from('billing_records')
      .select('*')
      .eq('user_id', user.id)
      .order('billing_date', { ascending: false });
    setRecords(data ?? []);
  }, [user]);

  const fetchPaymentMethods = useCallback(async () => {
    if (!user) return;
    const { data } = await supabase
      .from('payment_methods')
      .select('*')
      .eq('user_id', user.id)
      .order('is_default', { ascending: false });
    setPaymentMethods(data ?? []);
  }, [user]);

  useEffect(() => {
    if (!user) {
      setRecords([]);
      setPaymentMethods([]);
      setLoading(false);
      return;
    }
    setLoading(true);
    Promise.all([fetchRecords(), fetchPaymentMethods()]).then(() => setLoading(false));
  }, [user, fetchRecords, fetchPaymentMethods]);

  const addPaymentMethod = async (method: Partial<PaymentMethod>) => {
    if (!user) return null;
    const { data, error } = await supabase
      .from('payment_methods')
      .insert({ ...method, user_id: user.id })
      .select()
      .maybeSingle();
    if (!error && data) {
      setPaymentMethods(prev => [...prev, data]);
    }
    return { data, error };
  };

  const setDefaultMethod = async (id: string) => {
    if (!user) return;
    await supabase
      .from('payment_methods')
      .update({ is_default: false })
      .eq('user_id', user.id);
    await supabase
      .from('payment_methods')
      .update({ is_default: true })
      .eq('id', id);
    setPaymentMethods(prev =>
      prev.map(m => ({ ...m, is_default: m.id === id }))
    );
  };

  const deletePaymentMethod = async (id: string) => {
    await supabase.from('payment_methods').delete().eq('id', id);
    setPaymentMethods(prev => prev.filter(m => m.id !== id));
  };

  const pendingAmount = records
    .filter(r => r.status === 'pending')
    .reduce((sum, r) => sum + r.amount, 0);

  return {
    records, paymentMethods, loading, pendingAmount,
    addPaymentMethod, setDefaultMethod, deletePaymentMethod,
    refetch: () => Promise.all([fetchRecords(), fetchPaymentMethods()]),
  };
}
