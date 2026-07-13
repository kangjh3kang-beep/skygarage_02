import { createContext, useContext, useState, useEffect, type ReactNode } from 'react';
import { supabase } from '../../lib/supabase';
import type { SgpUser, SgpCoinWallet } from '../types';

interface SgpAuthState {
  user: SgpUser | null;
  wallet: SgpCoinWallet | null;
  loading: boolean;
  isAuthenticated: boolean;
  signUp: (params: {
    phone: string;
    password: string;
    displayName: string;
    birthDate?: string;
    genderCode?: string;
    address?: string;
    addressDetail?: string;
  }) => Promise<{ error?: string }>;
  signIn: (phone: string, password: string) => Promise<{ error?: string }>;
  signOut: () => Promise<void>;
  refreshWallet: () => Promise<void>;
}

const SgpAuthContext = createContext<SgpAuthState | null>(null);

export function SgpAuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<SgpUser | null>(null);
  const [wallet, setWallet] = useState<SgpCoinWallet | null>(null);
  const [loading, setLoading] = useState(true);

  const loadProfile = async (userId: string) => {
    const { data: profile } = await supabase
      .from('sgp_users')
      .select('*')
      .eq('id', userId)
      .maybeSingle();

    if (profile) {
      setUser(profile);
      const { data: w } = await supabase
        .from('sgp_coin_wallets')
        .select('*')
        .eq('user_id', userId)
        .maybeSingle();
      setWallet(w);
    }
    return profile;
  };

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (session?.user) {
        loadProfile(session.user.id).finally(() => setLoading(false));
      } else {
        setLoading(false);
      }
    });

    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      if (event === 'SIGNED_OUT') {
        setUser(null);
        setWallet(null);
      } else if (session?.user && event === 'SIGNED_IN') {
        loadProfile(session.user.id);
      }
    });

    return () => subscription.unsubscribe();
  }, []);

  const signUp = async (params: {
    phone: string;
    password: string;
    displayName: string;
    birthDate?: string;
    genderCode?: string;
    address?: string;
    addressDetail?: string;
  }) => {
    const { phone, password, displayName, birthDate, genderCode, address, addressDetail } = params;
    const email = `${phone.replace(/[^0-9]/g, '')}@sgp.skygarage.app`;

    const { data: authData, error: authError } = await supabase.auth.signUp({
      email,
      password,
      options: { data: { phone, display_name: displayName } },
    });

    if (authError) return { error: authError.message };
    if (!authData.user) return { error: '회원가입에 실패했습니다.' };

    const { error: profileError } = await supabase.from('sgp_users').insert({
      id: authData.user.id,
      phone,
      display_name: displayName,
      birth_date: birthDate || null,
      gender_code: genderCode || null,
      address: address || '',
      address_detail: addressDetail || '',
      kyc_level: 1,
      is_verified: true,
      phone_verified_at: new Date().toISOString(),
    });

    if (profileError) return { error: profileError.message };

    const { error: walletError } = await supabase.from('sgp_coin_wallets').insert({
      user_id: authData.user.id,
    });

    if (walletError) return { error: walletError.message };

    await loadProfile(authData.user.id);
    return {};
  };

  const signIn = async (phone: string, password: string) => {
    const email = `${phone.replace(/[^0-9]/g, '')}@sgp.skygarage.app`;

    const { error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) return { error: error.message };

    const { data: { user: authUser } } = await supabase.auth.getUser();
    if (authUser) await loadProfile(authUser.id);
    return {};
  };

  const signOut = async () => {
    await supabase.auth.signOut();
    setUser(null);
    setWallet(null);
  };

  const refreshWallet = async () => {
    if (!user) return;
    const { data } = await supabase
      .from('sgp_coin_wallets')
      .select('*')
      .eq('user_id', user.id)
      .maybeSingle();
    if (data) setWallet(data);
  };

  return (
    <SgpAuthContext.Provider value={{
      user,
      wallet,
      loading,
      isAuthenticated: !!user,
      signUp,
      signIn,
      signOut,
      refreshWallet,
    }}>
      {children}
    </SgpAuthContext.Provider>
  );
}

export function useSgpAuth() {
  const ctx = useContext(SgpAuthContext);
  if (!ctx) throw new Error('useSgpAuth must be used within SgpAuthProvider');
  return ctx;
}
