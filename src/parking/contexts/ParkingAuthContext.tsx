import { createContext, useContext, useState, useEffect, useCallback, type ReactNode } from 'react';
import { supabase } from '../../lib/supabase';
import type { User } from '@supabase/supabase-js';
import type { Household, UserRole } from '../types';

interface ParkingAuthState {
  user: User | null;
  household: Household | null;
  role: UserRole;
  loading: boolean;
  signIn: (email: string, password: string) => Promise<{ error: string | null }>;
  signOut: () => Promise<void>;
  setRole: (role: UserRole) => void;
}

const ParkingAuthContext = createContext<ParkingAuthState>({
  user: null,
  household: null,
  role: 'resident',
  loading: true,
  signIn: async () => ({ error: null }),
  signOut: async () => {},
  setRole: () => {},
});

export function useParkingAuth() {
  return useContext(ParkingAuthContext);
}

export function ParkingAuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [household, setHousehold] = useState<Household | null>(null);
  const [role, setRole] = useState<UserRole>('resident');
  const [loading, setLoading] = useState(true);

  const fetchHousehold = useCallback(async (userId: string) => {
    const { data } = await supabase
      .from('households')
      .select('*')
      .eq('user_id', userId)
      .maybeSingle();
    setHousehold(data);
  }, []);

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      const u = session?.user ?? null;
      setUser(u);
      if (u) {
        fetchHousehold(u.id);
      }
      setLoading(false);
    });

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      const u = session?.user ?? null;
      setUser(u);
      if (u) {
        (async () => { await fetchHousehold(u.id); })();
      } else {
        setHousehold(null);
      }
      setLoading(false);
    });

    return () => subscription.unsubscribe();
  }, [fetchHousehold]);

  const signIn = async (email: string, password: string) => {
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    return { error: error?.message ?? null };
  };

  const signOut = async () => {
    await supabase.auth.signOut();
    setUser(null);
    setHousehold(null);
  };

  return (
    <ParkingAuthContext.Provider value={{ user, household, role, loading, signIn, signOut, setRole }}>
      {children}
    </ParkingAuthContext.Provider>
  );
}
