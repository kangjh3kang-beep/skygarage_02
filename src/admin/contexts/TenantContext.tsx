import React, { createContext, useContext, useState } from 'react';

export type ScopeLevel = 'global' | 'region' | 'complex' | 'building';

export interface TenantContextType {
  currentScope: ScopeLevel;
  currentComplexId: string | null;
  isGlobal: boolean;
  isImpersonating: boolean;
  setCurrentScope: (scope: ScopeLevel) => void;
  setCurrentComplexId: (complexId: string | null) => void;
  setIsImpersonating: (isImpersonating: boolean) => void;
}

const TenantContext = createContext<TenantContextType | undefined>(undefined);

export function TenantProvider({ children }: { children: React.ReactNode }) {
  const [currentScope, setCurrentScope] = useState<ScopeLevel>('global');
  const [currentComplexId, setCurrentComplexId] = useState<string | null>(null);
  const [isImpersonating, setIsImpersonating] = useState(false);

  const isGlobal = currentScope === 'global';

  return (
    <TenantContext.Provider
      value={{
        currentScope,
        currentComplexId,
        isGlobal,
        isImpersonating,
        setCurrentScope,
        setCurrentComplexId,
        setIsImpersonating,
      }}
    >
      {children}
    </TenantContext.Provider>
  );
}

export function useTenant(): TenantContextType {
  const context = useContext(TenantContext);
  if (context === undefined) {
    throw new Error('useTenant must be used within a TenantProvider');
  }
  return context;
}
