import { createContext, useContext, useState, useEffect, type ReactNode } from 'react';
import { supabase } from '../../lib/supabase';

interface Complex {
  id: string;
  name: string;
  code: string;
}

interface TenantContextType {
  complexes: Complex[];
  selectedComplex: Complex | null;
  setSelectedComplex: (c: Complex | null) => void;
}

const TenantContext = createContext<TenantContextType | undefined>(undefined);

export function TenantProvider({ children }: { children: ReactNode }) {
  const [complexes, setComplexes] = useState<Complex[]>([]);
  const [selectedComplex, setSelectedComplex] = useState<Complex | null>(null);

  useEffect(() => {
    supabase.from('complexes').select('id, name, code').order('name').then(({ data }) => {
      if (data) setComplexes(data);
    });
  }, []);

  return (
    <TenantContext.Provider value={{ complexes, selectedComplex, setSelectedComplex }}>
      {children}
    </TenantContext.Provider>
  );
}

export function useTenant() {
  const ctx = useContext(TenantContext);
  if (!ctx) throw new Error('useTenant must be used within TenantProvider');
  return ctx;
}
