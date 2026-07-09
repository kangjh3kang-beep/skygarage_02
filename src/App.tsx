import { createContext, useContext, useState, useMemo, lazy, Suspense } from 'react';
import { BrowserRouter, Routes, Route } from 'react-router-dom';
import { ThemeProvider, createTheme } from '@mui/material/styles';
import CssBaseline from '@mui/material/CssBaseline';
import Box from '@mui/material/Box';
import CircularProgress from '@mui/material/CircularProgress';
import { AuthProvider, useAuth } from './admin/contexts/AuthContext';
import { ParkingAuthProvider, useParkingAuth } from './parking/contexts/ParkingAuthContext';
import { SgpAuthProvider } from './sgp/contexts/SgpAuthContext';
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
const PriorityDispatch = lazy(() => import('./admin/pages/PriorityDispatch'));
const SettlementManagement = lazy(() => import('./admin/pages/SettlementManagement'));
const LandingPage = lazy(() => import('./pages/LandingPage'));
const PatentPage = lazy(() => import('./components/PatentPage'));
const BrandGuidePage = lazy(() => import('./components/BrandGuidePage'));
const SkyGarageValet = lazy(() => import('./components/SkyGarageValet'));
const TrackingLayout = lazy(() => import('./tracking/TrackingLayout'));
const TrackingDashboard = lazy(() => import('./tracking/pages/user/TrackingDashboard'));
const VehicleTrackingPage = lazy(() => import('./tracking/pages/user/VehicleTrackingPage'));
const BookingPage = lazy(() => import('./tracking/pages/user/BookingPage'));
const NotificationsPage = lazy(() => import('./tracking/pages/user/NotificationsPage'));
const TrackingMyPage = lazy(() => import('./tracking/pages/user/MyPage'));
const FullMapPage = lazy(() => import('./tracking/pages/user/FullMapPage'));
const FleetManagement = lazy(() => import('./tracking/pages/admin/FleetManagement'));
const NotFoundPage = lazy(() => import('./tracking/pages/NotFoundPage'));

// Parking App (Resident) - Legacy
const ParkingLayout = lazy(() => import('./parking/ParkingLayout'));
const ParkingLoginPage = lazy(() => import('./parking/pages/LoginPage'));
const ResidentDashboard = lazy(() => import('./parking/pages/resident/Dashboard'));
const ParkingManagement = lazy(() => import('./parking/pages/resident/ParkingManagement'));
const ParkingMap = lazy(() => import('./parking/pages/resident/ParkingMap'));
const VisitorManagement = lazy(() => import('./parking/pages/resident/VisitorManagement'));
const EvCharging = lazy(() => import('./parking/pages/resident/EvCharging'));
const BillingPage = lazy(() => import('./parking/pages/resident/BillingPage'));
const ParkingNotifications = lazy(() => import('./parking/pages/resident/NotificationsPage'));
const ParkingSettings = lazy(() => import('./parking/pages/resident/SettingsPage'));

// SGP App (New User App)
const SgpLayout = lazy(() => import('./sgp/SgpLayout'));
const SgpHomePage = lazy(() => import('./sgp/pages/SgpHomePage'));
const SgpWalletPage = lazy(() => import('./sgp/pages/SgpWalletPage'));
const SgpPayPage = lazy(() => import('./sgp/pages/SgpPayPage'));
const SgpParkingPage = lazy(() => import('./sgp/pages/SgpParkingPage'));
const SgpVehicleMapPage = lazy(() => import('./sgp/pages/SgpVehicleMapPage'));
const SgpProfilePage = lazy(() => import('./sgp/pages/SgpProfilePage'));
const SgpMissionsPage = lazy(() => import('./sgp/pages/SgpMissionsPage'));
const SgpMissionRequest = lazy(() => import('./sgp/pages/SgpMissionRequest'));
const SgpPlacesAdd = lazy(() => import('./sgp/pages/SgpPlacesAdd'));
const SgpVisitorInvite = lazy(() => import('./sgp/pages/SgpVisitorInvite'));
const SgpNotifications = lazy(() => import('./sgp/pages/SgpNotifications'));
const SgpPrivacySettings = lazy(() => import('./sgp/pages/SgpPrivacySettings'));

// Parking App (Visitor)
const VisitorHome = lazy(() => import('./parking/pages/visitor/VisitorHome'));
const VisitorEntry = lazy(() => import('./parking/pages/visitor/VisitorEntry'));
const VisitorStatus = lazy(() => import('./parking/pages/visitor/VisitorStatus'));
const VisitorEvCharging = lazy(() => import('./parking/pages/visitor/VisitorEvCharging'));
const VisitorCheckout = lazy(() => import('./parking/pages/visitor/VisitorCheckout'));

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

function TrackingGuard({ darkMode, onToggleDarkMode }: { darkMode: boolean; onToggleDarkMode: () => void }) {
  const { user, loading } = useAuth();
  const fallback = <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', minHeight: '100vh' }}><CircularProgress /></Box>;
  if (loading) return fallback;
  if (!user) return <Suspense fallback={fallback}><Login /></Suspense>;
  return (
    <Suspense fallback={fallback}>
      <Routes>
        <Route element={<TrackingLayout darkMode={darkMode} onToggleDarkMode={onToggleDarkMode} />}>
          <Route index element={<TrackingDashboard />} />
          <Route path="map" element={<FullMapPage />} />
          <Route path="track/:vehicleId" element={<VehicleTrackingPage />} />
          <Route path="booking" element={<BookingPage />} />
          <Route path="notifications" element={<NotificationsPage />} />
          <Route path="mypage" element={<TrackingMyPage />} />
          <Route path="fleet" element={<FleetManagement />} />
          <Route path="*" element={<NotFoundPage />} />
        </Route>
      </Routes>
    </Suspense>
  );
}

function SgpAppGuard() {
  const fallback = <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', minHeight: '100vh', bgcolor: '#0d1b2a' }}><CircularProgress sx={{ color: '#00d4aa' }} /></Box>;
  return (
    <Suspense fallback={fallback}>
      <Routes>
        <Route element={<SgpLayout />}>
          <Route index element={<SgpHomePage />} />
          <Route path="wallet" element={<SgpWalletPage />} />
          <Route path="pay" element={<SgpPayPage />} />
          <Route path="parking" element={<SgpParkingPage />} />
          <Route path="map" element={<SgpVehicleMapPage />} />
          <Route path="profile" element={<SgpProfilePage />} />
          <Route path="missions" element={<SgpMissionsPage />} />
          <Route path="mission/request" element={<SgpMissionRequest />} />
          <Route path="places/add" element={<SgpPlacesAdd />} />
          <Route path="visitor/invite" element={<SgpVisitorInvite />} />
          <Route path="notifications" element={<SgpNotifications />} />
          <Route path="privacy" element={<SgpPrivacySettings />} />
        </Route>
      </Routes>
    </Suspense>
  );
}

function ParkingAppGuard() {
  const { user, complex, loading } = useParkingAuth();
  const fallback = <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', minHeight: '100vh' }}><CircularProgress /></Box>;
  if (loading) return fallback;
  if (!user || !complex) return <Suspense fallback={fallback}><ParkingLoginPage /></Suspense>;
  return (
    <Suspense fallback={fallback}>
      <Routes>
        <Route element={<ParkingLayout />}>
          <Route index element={<ResidentDashboard />} />
          <Route path="parking" element={<ParkingManagement />} />
          <Route path="parking/map" element={<ParkingMap />} />
          <Route path="visitors" element={<VisitorManagement />} />
          <Route path="ev" element={<EvCharging />} />
          <Route path="billing" element={<BillingPage />} />
          <Route path="notifications" element={<ParkingNotifications />} />
          <Route path="settings" element={<ParkingSettings />} />
        </Route>
      </Routes>
    </Suspense>
  );
}

function VisitorRoutes() {
  const fallback = <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', minHeight: '100vh' }}><CircularProgress /></Box>;
  return (
    <Suspense fallback={fallback}>
      <Routes>
        <Route index element={<VisitorHome />} />
        <Route path="entry" element={<VisitorEntry />} />
        <Route path="status" element={<VisitorStatus />} />
        <Route path="ev" element={<VisitorEvCharging />} />
        <Route path="checkout" element={<VisitorCheckout />} />
      </Routes>
    </Suspense>
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
            <Route path="priority-dispatch" element={<PriorityDispatch />} />
            <Route path="settlement" element={<SettlementManagement />} />
            <Route path="fleet" element={<FleetManagement />} />
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
          <Route path="/app/*" element={
            <SgpAuthProvider>
              <ThemeProvider theme={publicTheme}>
                <CssBaseline />
                <SgpAppGuard />
              </ThemeProvider>
            </SgpAuthProvider>
          } />
          <Route path="/parking/*" element={
            <ParkingAuthProvider>
              <ThemeProvider theme={publicTheme}>
                <CssBaseline />
                <ParkingAppGuard />
              </ThemeProvider>
            </ParkingAuthProvider>
          } />
          <Route path="/visitor/*" element={
            <ThemeProvider theme={publicTheme}>
              <CssBaseline />
              <VisitorRoutes />
            </ThemeProvider>
          } />
          <Route path="/tracking/*" element={
            <AuthProvider>
              <ThemeProvider theme={publicTheme}>
                <CssBaseline />
                <TrackingGuard darkMode={mode === 'dark'} onToggleDarkMode={toggleMode} />
              </ThemeProvider>
            </AuthProvider>
          } />
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
