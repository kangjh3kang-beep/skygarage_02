import { createContext, useContext, useState, useMemo, lazy, Suspense } from 'react';
import { BrowserRouter, Routes, Route } from 'react-router-dom';
import { ThemeProvider, createTheme } from '@mui/material/styles';
import CssBaseline from '@mui/material/CssBaseline';
import Box from '@mui/material/Box';
import CircularProgress from '@mui/material/CircularProgress';
import { AuthProvider, useAuth } from './admin/contexts/AuthContext';
import { TenantProvider } from './admin/contexts/TenantContext';
import { ToastProvider } from './admin/contexts/ToastContext';
import { AdminThemeProvider, useAdminTheme } from './admin/contexts/ThemeContext';
import AdminLayout from './admin/AdminLayout';
import { COLORS } from './theme';

const Login = lazy(() => import('./admin/pages/Login'));
const Dashboard = lazy(() => import('./admin/pages/Dashboard'));
const ComplexManagement = lazy(() => import('./admin/pages/ComplexManagement'));
const ResidentManagement = lazy(() => import('./admin/pages/ResidentManagement'));
const ParkingOperations = lazy(() => import('./admin/pages/ParkingOperations'));
const AtrManagement = lazy(() => import('./admin/pages/AtrManagement'));
const ElevatorManagement = lazy(() => import('./admin/pages/ElevatorManagement'));
const EnergyDashboard = lazy(() => import('./admin/pages/EnergyDashboard'));
const ContractManagement = lazy(() => import('./admin/pages/ContractManagement'));
const BillingInvoices = lazy(() => import('./admin/pages/BillingInvoices'));
const CrmDashboard = lazy(() => import('./admin/pages/CrmDashboard'));
const GlobalNOC = lazy(() => import('./admin/pages/GlobalNOC'));
const Analytics = lazy(() => import('./admin/pages/Analytics'));
const SecurityAudit = lazy(() => import('./admin/pages/SecurityAudit'));
const AIAgentChat = lazy(() => import('./admin/pages/AIAgentChat'));
const Settings = lazy(() => import('./admin/pages/Settings'));
const UserManagement = lazy(() => import('./admin/pages/UserManagement'));
const TeamManagement = lazy(() => import('./admin/pages/TeamManagement'));
const AccessControl = lazy(() => import('./admin/pages/AccessControl'));
const Notifications = lazy(() => import('./admin/pages/Notifications'));
const MaintenanceManagement = lazy(() => import('./admin/pages/MaintenanceManagement'));
const SupportTickets = lazy(() => import('./admin/pages/SupportTickets'));
const AlertCenter = lazy(() => import('./admin/pages/AlertCenter'));
const ObservabilityDashboard = lazy(() => import('./admin/pages/ObservabilityDashboard'));
const EsgReporting = lazy(() => import('./admin/pages/EsgReporting'));
const PartnerManagement = lazy(() => import('./admin/pages/PartnerManagement'));
const InquiryList = lazy(() => import('./admin/pages/InquiryList'));
const InquiryDetail = lazy(() => import('./admin/pages/InquiryDetail'));
const ImageManager = lazy(() => import('./admin/pages/ImageManager'));
const SectionMediaManager = lazy(() => import('./admin/pages/SectionMediaManager'));
const OperationsDashboard = lazy(() => import('./admin/pages/OperationsDashboard'));
const SystemOverview = lazy(() => import('./admin/pages/SystemOverview'));
const SafetyPolicy = lazy(() => import('./admin/pages/SafetyPolicy'));
const ProjectTracker = lazy(() => import('./admin/pages/ProjectTracker'));
const RegionHub = lazy(() => import('./admin/pages/RegionHub'));
const ZoneConsole = lazy(() => import('./admin/pages/ZoneConsole'));
const WorkflowManager = lazy(() => import('./admin/pages/WorkflowManager'));
const V2GEnergyTrading = lazy(() => import('./admin/pages/V2GEnergyTrading'));
const EventLog = lazy(() => import('./admin/pages/EventLog'));
const ActivityLog = lazy(() => import('./admin/pages/ActivityLog'));
const AIManagement = lazy(() => import('./admin/pages/AIManagement'));
const RevenueBilling = lazy(() => import('./admin/pages/RevenueBilling'));
const PatentManagement = lazy(() => import('./admin/pages/PatentManagement'));
const LicenseManagement = lazy(() => import('./admin/pages/LicenseManagement'));
const LandingPage = lazy(() => import('./pages/LandingPage'));
const PatentPage = lazy(() => import('./components/PatentPage'));
const BrandGuidePage = lazy(() => import('./components/BrandGuidePage'));
const SkyGarageValet = lazy(() => import('./components/SkyGarageValet'));

interface ColorModeContextType {
  mode: 'light' | 'dark';
  toggleMode: () => void;
}

const ColorModeContext = createContext<ColorModeContextType>({
  mode: 'dark',
  toggleMode: () => {},
});

export function useColorMode() {
  return useContext(ColorModeContext);
}

function AdminThemeWrapper({ children }: { children: React.ReactNode }) {
  const { theme } = useAdminTheme();
  return (
    <ThemeProvider theme={theme}>
      <CssBaseline />
      {children}
    </ThemeProvider>
  );
}

function ProtectedRoutes() {
  const { user, loading } = useAuth();

  const fallback = <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', minHeight: '100vh' }}><CircularProgress /></Box>;

  if (loading) return fallback;
  if (!user) return <Suspense fallback={fallback}><Login /></Suspense>;

  return (
    <AdminThemeProvider>
      <AdminThemeWrapper>
        <TenantProvider>
          <ToastProvider>
            <Suspense fallback={<Box sx={{ display: 'flex', justifyContent: 'center', py: 10 }}><CircularProgress /></Box>}>
            <Routes>
              <Route element={<AdminLayout />}>
            <Route index element={<Dashboard />} />
            <Route path="complexes" element={<ComplexManagement />} />
            <Route path="residents" element={<ResidentManagement />} />
            <Route path="parking" element={<ParkingOperations />} />
            <Route path="atr" element={<AtrManagement />} />
            <Route path="elevators" element={<ElevatorManagement />} />
            <Route path="energy" element={<EnergyDashboard />} />
            <Route path="contracts" element={<ContractManagement />} />
            <Route path="billing" element={<BillingInvoices />} />
            <Route path="crm" element={<CrmDashboard />} />
            <Route path="noc" element={<GlobalNOC />} />
            <Route path="analytics" element={<Analytics />} />
            <Route path="security" element={<SecurityAudit />} />
            <Route path="ai" element={<AIAgentChat />} />
            <Route path="ai-management" element={<AIManagement />} />
            <Route path="users" element={<UserManagement />} />
            <Route path="team" element={<TeamManagement />} />
            <Route path="access" element={<AccessControl />} />
            <Route path="notifications" element={<Notifications />} />
            <Route path="maintenance" element={<MaintenanceManagement />} />
            <Route path="tickets" element={<SupportTickets />} />
            <Route path="alerts" element={<AlertCenter />} />
            <Route path="observability" element={<ObservabilityDashboard />} />
            <Route path="esg" element={<EsgReporting />} />
            <Route path="partners" element={<PartnerManagement />} />
            <Route path="inquiries" element={<InquiryList />} />
            <Route path="inquiries/:id" element={<InquiryDetail />} />
            <Route path="images" element={<ImageManager />} />
            <Route path="media" element={<SectionMediaManager />} />
            <Route path="operations" element={<OperationsDashboard />} />
            <Route path="system" element={<SystemOverview />} />
            <Route path="safety" element={<SafetyPolicy />} />
            <Route path="projects" element={<ProjectTracker />} />
            <Route path="regions" element={<RegionHub />} />
            <Route path="zones" element={<ZoneConsole />} />
            <Route path="workflows" element={<WorkflowManager />} />
            <Route path="v2g" element={<V2GEnergyTrading />} />
            <Route path="events" element={<EventLog />} />
            <Route path="activity" element={<ActivityLog />} />
            <Route path="revenue" element={<RevenueBilling />} />
            <Route path="patents" element={<PatentManagement />} />
            <Route path="licenses" element={<LicenseManagement />} />
            <Route path="settings" element={<Settings />} />
          </Route>
        </Routes>
        </Suspense>
          </ToastProvider>
        </TenantProvider>
      </AdminThemeWrapper>
    </AdminThemeProvider>
  );
}

export default function App() {
  const [mode, setMode] = useState<'light' | 'dark'>('dark');

  const toggleMode = () => setMode(prev => prev === 'dark' ? 'light' : 'dark');

  const colorModeValue = useMemo(() => ({ mode, toggleMode }), [mode]);

  const publicTheme = useMemo(() => createTheme({
    palette: {
      mode,
      primary: { main: COLORS.GOLD },
      secondary: { main: COLORS.TECH_BLUE },
      background: mode === 'dark'
        ? { default: COLORS.BG_PRIMARY, paper: COLORS.BG_SECONDARY }
        : { default: COLORS.LIGHT_BG_PRIMARY, paper: '#ffffff' },
      text: mode === 'dark'
        ? { primary: '#e8ecf4', secondary: '#8892a8' }
        : { primary: '#1a1a2e', secondary: '#4a5568' },
    },
    typography: {
      fontFamily: '"Roboto", "Noto Sans KR", sans-serif',
    },
    shape: { borderRadius: 12 },
    components: {
      MuiButton: {
        styleOverrides: {
          root: { textTransform: 'none', fontWeight: 700, borderRadius: 8 },
        },
      },
    },
  }), [mode]);

  return (
    <BrowserRouter>
      <ColorModeContext.Provider value={colorModeValue}>
        <Routes>
          <Route path="/admin/*" element={
            <AuthProvider>
              <ProtectedRoutes />
            </AuthProvider>
          } />
          <Route path="/*" element={
            <ThemeProvider theme={publicTheme}>
              <CssBaseline />
              <Suspense fallback={<Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', minHeight: '100vh' }}><CircularProgress /></Box>}>
                <Routes>
                  <Route index element={<LandingPage />} />
                  <Route path="patent" element={<PatentPage />} />
                  <Route path="brand-guide" element={<BrandGuidePage />} />
                  <Route path="valet" element={<SkyGarageValet />} />
                </Routes>
              </Suspense>
            </ThemeProvider>
          } />
        </Routes>
      </ColorModeContext.Provider>
    </BrowserRouter>
  );
}
