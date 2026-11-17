import { useEffect, useState } from 'react';
import { BrowserRouter, Navigate, Outlet, Route, Routes, useLocation } from 'react-router-dom';
import Navbar from './components/Navbar';
import EnterpriseFooter from './components/EnterpriseFooter';
import Dashboard from './pages/Dashboard';
import RolesPage from './pages/RolesPage';
import ScenariosPage from './pages/ScenariosPage';
import ScenarioPlayer from './pages/ScenarioPlayer';
import QuizPage from './pages/QuizPage';
import ChatbotPage from './pages/ChatbotPage';
import TrainingReports from './pages/TrainingReports';
import FacilitatorQuickStart from './pages/FacilitatorQuickStart';
import FacilityAdminPage from './pages/FacilityAdminPage';
import ContractsPage, { ContractDetailPage } from './pages/ContractsPage';
import SignContractPage from './pages/SignContractPage';
import AccountPage from './pages/AccountPage';
import LearningCenterPage from './pages/LearningCenterPage';
import RapidChallengePage from './pages/RapidChallengePage';
import LiveDrillControlPage from './pages/LiveDrillControlPage';
import LandingPage from './pages/LandingPage';
import LoginPage from './pages/LoginPage';
import AuthCallbackPage from './pages/AuthCallbackPage';
import RequestDemoPage from './pages/RequestDemoPage';
import HealthCheckPage from './pages/HealthCheckPage';
import ForgotPasswordPage from './pages/ForgotPasswordPage';
import ResetPasswordPage from './pages/ResetPasswordPage';
import TermsPage from './pages/TermsPage';
import PrivacyPage from './pages/PrivacyPage';
import DeleteAccountPage from './pages/DeleteAccountPage';
import { TenantProvider } from './lib/tenantContext';
import { IS_CUSTOMER_DEPLOYMENT } from './lib/deployment';
import { AuthProvider, useAuth } from './lib/authContext';
import { ToastProvider } from './lib/toast';
import { sendNotification } from './lib/notifications';
import GlobalAssistant from './components/GlobalAssistant';

function ProtectedLayout({ theme, onToggleTheme }: { theme: 'light' | 'dark'; onToggleTheme: () => void }) {
  const { isAuthenticated, touchActivity, sessionRemainingMs, user } = useAuth();
  const location = useLocation();
  const [sessionAlerted, setSessionAlerted] = useState(false);
  const sessionMinutes = Math.ceil(sessionRemainingMs / 60000);

  useEffect(() => {
    // Record activity on initial mount; ongoing tracking uses window event listeners in AuthProvider.
    touchActivity();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (!isAuthenticated) {
      setSessionAlerted(false);
      return;
    }

    if (sessionRemainingMs > 5 * 60 * 1000) {
      setSessionAlerted(false);
      return;
    }

    if (sessionRemainingMs > 0 && !sessionAlerted) {
      setSessionAlerted(true);
      void sendNotification({
        type: 'session_expiring',
        recipient: user?.email,
        subject: 'NyxHICSlab Session Expiring',
        message: `Your training session expires in ${Math.max(1, Math.ceil(sessionRemainingMs / 60000))} minute(s).`,
      });
    }
  }, [isAuthenticated, sessionRemainingMs, sessionAlerted, user]);

  if (!isAuthenticated) {
    return <Navigate to="/login" replace />;
  }

  return (
    // pb-24 reserves room at the very end of every page so the
    // fixed Ask AI launcher (bottom-right) never covers the last
    // content or the footer (UI review P3).
    <div className="nyx-app flex flex-col min-h-screen pb-24">
      <Navbar theme={theme} onToggleTheme={onToggleTheme} />
      {sessionRemainingMs > 0 && sessionRemainingMs <= 5 * 60 * 1000 && (
        <div className="mx-4 mt-3 nyx-panel border border-amber-300 bg-amber-50/90 dark:bg-amber-900/20 px-4 py-3 text-sm text-amber-900 dark:text-amber-300">
          Session expires in {Math.max(1, sessionMinutes)} minute(s). Continue activity to keep your secure session alive.
        </div>
      )}
      {/* Keyed by route so the fade-in replays on every navigation:
          a small, consistent page transition across the whole app. */}
      <main className="flex-1 animate-fade-in" key={location.pathname}>
        <Outlet />
      </main>
      <GlobalAssistant />
      <EnterpriseFooter />
    </div>
  );
}

// The admin area is gated on the AUTH session role (facility-admin
// or enterprise-admin, from the sign-in response) - never on the
// tenant preview switcher, which any user can set to anything.
// Non-admin sessions, including role-less sessions persisted
// before the role was plumbed through, are sent to the dashboard
// (fail closed; a fresh sign-in re-issues the session with a
// role). The server enforces the same policy on every admin API
// request regardless of what the UI shows.
function AdminRoute() {
  const { isAdmin } = useAuth();
  if (!isAdmin) {
    return <Navigate to="/dashboard" replace />;
  }
  return <FacilityAdminPage />;
}

// Contracts are the OWNER portal: enterprise-admin sessions only
// (Nyx Collective issues its own sales agreements there). The
// server enforces the same rule on every contracts endpoint.
function EnterpriseAdminRoute({ children }: { children: React.ReactNode }) {
  const { isEnterpriseAdmin } = useAuth();
  if (!isEnterpriseAdmin) {
    return <Navigate to="/dashboard" replace />;
  }
  return <>{children}</>;
}

function AppRoutes({ theme, onToggleTheme }: { theme: 'light' | 'dark'; onToggleTheme: () => void }) {
  const { isAuthenticated } = useAuth();

  return (
    <Routes>
      {/* Customer deployments skip the marketing landing entirely:
          the front door is the sign-in page (lib/deployment.ts). */}
      <Route path="/" element={isAuthenticated ? <Navigate to="/dashboard" replace /> : IS_CUSTOMER_DEPLOYMENT ? <LoginPage theme={theme} onToggleTheme={onToggleTheme} /> : <LandingPage theme={theme} onToggleTheme={onToggleTheme} />} />
      <Route path="/login" element={isAuthenticated ? <Navigate to="/dashboard" replace /> : <LoginPage theme={theme} onToggleTheme={onToggleTheme} />} />
      <Route path="/auth/callback" element={<AuthCallbackPage />} />
      <Route path="/request-demo" element={IS_CUSTOMER_DEPLOYMENT ? <Navigate to="/login" replace /> : <RequestDemoPage />} />
      <Route path="/health" element={<HealthCheckPage />} />
      <Route path="/forgot-password" element={<ForgotPasswordPage />} />
      <Route path="/reset-password" element={<ResetPasswordPage />} />
      <Route path="/tos" element={<TermsPage />} />
      <Route path="/privacy" element={<PrivacyPage />} />
      <Route path="/delete-account" element={<DeleteAccountPage />} />
      <Route path="/sign/:token" element={<SignContractPage />} />

      <Route element={<ProtectedLayout theme={theme} onToggleTheme={onToggleTheme} />}>
        <Route path="/dashboard" element={<Dashboard />} />
        <Route path="/roles" element={<RolesPage />} />
        <Route path="/scenarios" element={<ScenariosPage />} />
        <Route path="/scenarios/:id" element={<ScenarioPlayer />} />
        <Route path="/quiz" element={<QuizPage />} />
        <Route path="/chatbot" element={<ChatbotPage />} />
        <Route path="/reports" element={<TrainingReports />} />
        <Route path="/quick-start" element={<FacilitatorQuickStart />} />
        <Route path="/learning-center" element={<LearningCenterPage />} />
        <Route path="/rapid-challenge" element={<RapidChallengePage />} />
        <Route path="/live-drill" element={<LiveDrillControlPage />} />
        <Route path="/account" element={<AccountPage />} />
        <Route path="/admin" element={<AdminRoute />} />
        <Route path="/admin/contracts" element={<EnterpriseAdminRoute><ContractsPage /></EnterpriseAdminRoute>} />
        <Route path="/admin/contracts/:id" element={<EnterpriseAdminRoute><ContractDetailPage /></EnterpriseAdminRoute>} />
      </Route>

      <Route path="*" element={<Navigate to={isAuthenticated ? '/dashboard' : '/'} replace />} />
    </Routes>
  );
}

export default function App() {
  const [theme, setTheme] = useState<'light' | 'dark'>(() => {
    const stored = localStorage.getItem('hics-theme');
    if (stored === 'light' || stored === 'dark') return stored;
    return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
  });

  useEffect(() => {
    document.documentElement.classList.toggle('dark', theme === 'dark');
    localStorage.setItem('hics-theme', theme);
  }, [theme]);

  const toggleTheme = () => {
    setTheme((prev) => (prev === 'dark' ? 'light' : 'dark'));
  };

  return (
    <AuthProvider>
      <TenantProvider>
        <ToastProvider>
          <BrowserRouter basename={import.meta.env.BASE_URL}>
            <AppRoutes theme={theme} onToggleTheme={toggleTheme} />
          </BrowserRouter>
        </ToastProvider>
      </TenantProvider>
    </AuthProvider>
  );
}
