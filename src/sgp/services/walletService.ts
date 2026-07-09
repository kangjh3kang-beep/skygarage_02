import { supabase } from '../../lib/supabase';
import type { SgpCoinWallet, SgpCoinTransaction } from '../types';

export async function getWallet(userId: string): Promise<SgpCoinWallet | null> {
  const { data, error } = await supabase
    .from('sgp_coin_wallets')
    .select('*')
    .eq('user_id', userId)
    .maybeSingle();

  if (error) throw new Error(error.message);
  return data;
}

export async function getTransactions(userId: string, limit = 30): Promise<SgpCoinTransaction[]> {
  const { data, error } = await supabase
    .from('sgp_coin_transactions')
    .select('*')
    .eq('user_id', userId)
    .order('created_at', { ascending: false })
    .limit(limit);

  if (error) throw new Error(error.message);
  return data || [];
}

export async function chargeWallet(userId: string, amount: number): Promise<SgpCoinTransaction> {
  const { data, error } = await supabase
    .rpc('charge_wallet', { p_user_id: userId, p_amount: amount });

  if (error) throw new Error(error.message);
  return data;
}

export async function updateAutoCharge(walletId: string, enabled: boolean, threshold?: number, amount?: number): Promise<void> {
  const update: Record<string, unknown> = { auto_charge_enabled: enabled };
  if (threshold !== undefined) update.auto_charge_threshold = threshold;
  if (amount !== undefined) update.auto_charge_amount = amount;

  const { error } = await supabase.from('sgp_coin_wallets').update(update).eq('id', walletId);
  if (error) throw new Error(error.message);
}
