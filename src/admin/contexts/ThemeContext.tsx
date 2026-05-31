import React, { createContext, useContext, useState, useEffect } from 'react';
import type { PaletteMode } from '@mui/material';

export interface AdminThemeContextType {
  mode: PaletteMode;
  toggleMode: () => void;
}

const AdminThemeContext = createContext<AdminThemeContextType | undefined>(
  undefined
);

export function AdminThemeProvider({ children }: { children: React.ReactNode }) {
  const [mode, setMode] = useState<PaletteMode>('light');

  // Load theme preference from localStorage on mount
  useEffect(() => {
    const savedMode = localStorage.getItem('adminThemeMode') as PaletteMode | null;
    if (savedMode === 'dark' || savedMode === 'light') {
      setMode(savedMode);
    }
  }, []);

  // Save theme preference when it changes
  useEffect(() => {
    localStorage.setItem('adminThemeMode', mode);
  }, [mode]);

  const toggleMode = () => {
    setMode((prevMode) => (prevMode === 'light' ? 'dark' : 'light'));
  };

  return (
    <AdminThemeContext.Provider value={{ mode, toggleMode }}>
      {children}
    </AdminThemeContext.Provider>
  );
}

export function useAdminTheme(): AdminThemeContextType {
  const context = useContext(AdminThemeContext);
  if (context === undefined) {
    throw new Error('useAdminTheme must be used within an AdminThemeProvider');
  }
  return context;
}
