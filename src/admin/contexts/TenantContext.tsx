import { createContext, useContext, useState, useEffect, useCallback, type ReactNode } from 'react';
import { supabase } from '../../lib/supabase';
import { useAuth, type UserRole } from './AuthContext';

// ─────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────

export type AdminScopeLevel = 'global' | 'region' | 'complex' | 'building';

export interface Region {
  id: string;
  name: string;
  code: string;
}

export interface Complex {
  id: string;
  name: string;
  code: string;
  region_id: string;
}

export interface Building {
  id: string;
  name: string;
  code: string;
  complex_id: string;
}

export interface ScopeSelection {
  region: Region | null;
  complex: Complex | null;
  building: Building | null;
}

export interface TenantContextType {
  regions: Region[];
  complexes: Complex[];
  buildings: Building[];
  filteredComplexes: Complex[];
  filteredBuildings: Building[];
  scope: ScopeSelection;
  scopeLevel: AdminScopeLevel;
  isImpersonating: boolean;
  setRegion: (r: Region | null) => void;
  setComplex: (c: Complex | null) => void;
  setBuilding: (b: Building | null) => void;
  resetScope: () => void;
  canSelectRegion: boolean;
  canSelectComplex: boolean;
  canSelectBuilding: boolean;
  // Backward-compatible accessors
  selectedComplex: Complex | null;
  setSelectedComplex: (c: Complex | null) => void;
}

const TenantContext = createContext<TenantContextType | undefined>(undefined);

// ─────────────────────────────────────────────
// Role → Scope Permission Mapping
// Governance [660] R-001~R-004
// ─────────────────────────────────────────────

function getRoleLevel(role: UserRole | null): AdminScopeLevel {
  switch (role) {
    case 'super_admin': return 'global';
    case 'admin': return 'region';
    case 'manager': return 'complex';
    case 'operator':
    case 'viewer':
      return 'building';
    default: return 'building';
  }
}

// ─────────────────────────────────────────────
// Provider
// ─────────────────────────────────────────────

export function TenantProvider({ children }: { children: ReactNode }) {
  const { role } = useAuth();
  const [regions] = useState<Region[]>([]);
  const [complexes, setComplexes] = useState<Complex[]>([]);
  const [buildings] = useState<Building[]>([]);
  const [scope, setScope] = useState<ScopeSelection>({ region: null, complex: null, building: null });

  const roleLevel = getRoleLevel(role);

  useEffect(() => {
    supabase.from('complexes').select('id, name, code, region_id').order('name').then(({ data, error }) => {
      if (error) {
        console.error('Failed to load complexes:', error.message);
        return;
      }
      if (data) setComplexes(data.map(c => ({ ...c, region_id: c.region_id ?? '' })));
    });
  }, []);

  const filteredComplexes = scope.region
    ? complexes.filter(c => c.region_id === scope.region!.id)
    : complexes;

  const filteredBuildings = scope.complex
    ? buildings.filter(b => b.complex_id === scope.complex!.id)
    : buildings;

  const scopeLevel: AdminScopeLevel = scope.building
    ? 'building'
    : scope.complex
      ? 'complex'
      : scope.region
        ? 'region'
        : 'global';

  const isImpersonating = roleLevel === 'global' && scopeLevel !== 'global';

  const setRegion = useCallback((r: Region | null) => {
    setScope({ region: r, complex: null, building: null });
  }, []);

  const setComplex = useCallback((c: Complex | null) => {
    setScope(prev => ({ ...prev, complex: c, building: null }));
  }, []);

  const setBuilding = useCallback((b: Building | null) => {
    setScope(prev => ({ ...prev, building: b }));
  }, []);

  const resetScope = useCallback(() => {
    setScope({ region: null, complex: null, building: null });
  }, []);

  const canSelectRegion = roleLevel === 'global' || roleLevel === 'region';
  const canSelectComplex = roleLevel === 'global' || roleLevel === 'region' || roleLevel === 'complex';
  const canSelectBuilding = true;

  return (
    <TenantContext.Provider value={{
      regions,
      complexes,
      buildings,
      filteredComplexes,
      filteredBuildings,
      scope,
      scopeLevel,
      isImpersonating,
      setRegion,
      setComplex,
      setBuilding,
      resetScope,
      canSelectRegion,
      canSelectComplex,
      canSelectBuilding,
      selectedComplex: scope.complex,
      setSelectedComplex: setComplex,
    }}>
      {children}
    </TenantContext.Provider>
  );
}

export function useTenant() {
  const ctx = useContext(TenantContext);
  if (!ctx) throw new Error('useTenant must be used within TenantProvider');
  return ctx;
}
