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
    verificationId: string;
    verificationCode: string;
  }) => Promise<{ error?: string; code?: string }>;
  signIn: (phone: string, password: string) => Promise<{ error?: string; code?: string }>;
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
    verificationId: string;
    verificationCode: string;
  }) => {
    try {
      const response = await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/sms-verify/register`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${import.meta.env.VITE_SUPABASE_ANON_KEY}` },
        body: JSON.stringify({ phone: params.phone, password: params.password, display_name: params.displayName,
          birth_date: params.birthDate, gender_code: params.genderCode, address: params.address, address_detail: params.addressDetail,
          verification_id: params.verificationId, code: params.verificationCode }),
      });
      const result = await response.json();
      if (!response.ok || !result.registered) return { error: result.error || '회원가입에 실패했습니다.', code: result.code };
      const email = `${params.phone.replace(/[^0-9]/g, '')}@sgp.skygarage.app`;
      const { data, error } = await supabase.auth.signInWithPassword({ email, password: params.password });
      if (error || !data.user) return { error: '회원가입이 완료되었습니다. 로그인 화면에서 로그인해주세요.', code: 'registered_login_required' };
      const profile = await loadProfile(data.user.id);
      if (!profile) return { error: '가입이 완료되었으나 정보를 불러오지 못했습니다. 다시 로그인해주세요.', code: 'registered_login_required' };
      return {};
    } catch {
      return { error: '서버 연결을 확인해주세요. 가입완료를 이미 누르셨다면 로그인도 확인해주세요.' };
    }
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
