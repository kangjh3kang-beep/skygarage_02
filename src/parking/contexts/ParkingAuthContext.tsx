import { createContext, useContext, useState, useEffect, useCallback, type ReactNode } from 'react';
import { supabase } from '../../lib/supabase';
import type { User } from '@supabase/supabase-js';
import type { Household, UserRole } from '../types';

export interface Complex {
  id: string;
  name: string;
  code: string;
  address: string;
  region: string;
  status: string;
  lat: number | null;
  lng: number | null;
}

interface ParkingAuthState {
  user: User | null;
  household: Household | null;
  complex: Complex | null;
  role: UserRole;
  loading: boolean;
  signIn: (email: string, password: string, complexId: string) => Promise<{ error: string | null }>;
  signOut: () => Promise<void>;
  setRole: (role: UserRole) => void;
  selectComplex: (complexId: string) => Promise<boolean>;
}

const ParkingAuthContext = createContext<ParkingAuthState>({
  user: null,
  household: null,
  complex: null,
  role: 'resident',
  loading: true,
  signIn: async () => ({ error: null }),
  signOut: async () => {},
  setRole: () => {},
  selectComplex: async () => false,
});

export function useParkingAuth() {
  return useContext(ParkingAuthContext);
}

const COMPLEX_KEY = 'sgp_selected_complex';

export function ParkingAuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [household, setHousehold] = useState<Household | null>(null);
  const [complex, setComplex] = useState<Complex | null>(null);
  const [role, setRole] = useState<UserRole>('resident');
  const [loading, setLoading] = useState(true);

  const fetchHouseholdForComplex = useCallback(async (userId: string, complexId: string) => {
    const { data } = await supabase
      .from('households')
      .select('*')
      .eq('user_id', userId)
      .eq('complex_id', complexId)
      .maybeSingle();
    setHousehold(data);
    return data;
  }, []);

  const fetchComplex = useCallback(async (complexId: string) => {
    const { data } = await supabase
      .from('complexes')
      .select('id, name, code, address, region, status, lat, lng')
      .eq('id', complexId)
      .maybeSingle();
    if (data) {
      setComplex(data);
      localStorage.setItem(COMPLEX_KEY, complexId);
    }
    return data;
  }, []);

  const initializeSession = useCallback(async (u: User) => {
    const savedComplexId = localStorage.getItem(COMPLEX_KEY);
    if (savedComplexId) {
      const c = await fetchComplex(savedComplexId);
      if (c) {
        await fetchHouseholdForComplex(u.id, savedComplexId);
      }
    }
  }, [fetchComplex, fetchHouseholdForComplex]);

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      const u = session?.user ?? null;
      setUser(u);
      if (u) {
        initializeSession(u).then(() => setLoading(false));
      } else {
        setLoading(false);
      }
    });

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      const u = session?.user ?? null;
      setUser(u);
      if (u) {
        (async () => {
          await initializeSession(u);
          setLoading(false);
        })();
      } else {
        setHousehold(null);
        setComplex(null);
        localStorage.removeItem(COMPLEX_KEY);
        setLoading(false);
      }
    });

    return () => subscription.unsubscribe();
  }, [initializeSession]);

  const signIn = async (email: string, password: string, complexId: string) => {
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) return { error: error.message };

    const { data: { user: newUser } } = await supabase.auth.getUser();
    if (newUser) {
      setUser(newUser);
      await fetchComplex(complexId);
      await fetchHouseholdForComplex(newUser.id, complexId);
    }
    return { error: null };
  };

  const signOut = async () => {
    await supabase.auth.signOut();
    setUser(null);
    setHousehold(null);
    setComplex(null);
    localStorage.removeItem(COMPLEX_KEY);
  };

  const selectComplex = async (complexId: string) => {
    const c = await fetchComplex(complexId);
    if (!c) return false;
    if (user) {
      await fetchHouseholdForComplex(user.id, complexId);
    }
    return true;
  };

  return (
    <ParkingAuthContext.Provider value={{ user, household, complex, role, loading, signIn, signOut, setRole, selectComplex }}>
      {children}
    </ParkingAuthContext.Provider>
  );
}
