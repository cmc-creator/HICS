import { useEffect, useState } from 'react';
import { BrowserRouter, Navigate, Outlet, Route, Routes } from 'react-router-dom';
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
import LandingPage from './pages/LandingPage';
import LoginPage from './pages/LoginPage';
import AuthCallbackPage from './pages/AuthCallbackPage';
import RequestDemoPage from './pages/RequestDemoPage';
import HealthCheckPage from './pages/HealthCheckPage';
import { TenantProvider } from './lib/tenantContext';
import { AuthProvider, useAuth } from './lib/authContext';

function ProtectedLayout({ theme, onToggleTheme }: { theme: 'light' | 'dark'; onToggleTheme: () => void }) {
  const { isAuthenticated, touchActivity } = useAuth();

  useEffect(() => {
    touchActivity();
  }, [touchActivity]);

  if (!isAuthenticated) {
    return <Navigate to="/login" replace />;
  }

  return (
    <div className="nyx-app flex flex-col min-h-screen">
      <Navbar theme={theme} onToggleTheme={onToggleTheme} />
      <main className="flex-1 animate-fade-in">
        <Outlet />
      </main>
      <EnterpriseFooter />
    </div>
  );
}

function AppRoutes({ theme, onToggleTheme }: { theme: 'light' | 'dark'; onToggleTheme: () => void }) {
  const { isAuthenticated } = useAuth();

  return (
    <Routes>
      <Route path="/" element={isAuthenticated ? <Navigate to="/dashboard" replace /> : <LandingPage theme={theme} onToggleTheme={onToggleTheme} />} />
      <Route path="/login" element={isAuthenticated ? <Navigate to="/dashboard" replace /> : <LoginPage theme={theme} onToggleTheme={onToggleTheme} />} />
      <Route path="/auth/callback" element={<AuthCallbackPage />} />
      <Route path="/request-demo" element={<RequestDemoPage />} />
      <Route path="/health" element={<HealthCheckPage />} />

      <Route element={<ProtectedLayout theme={theme} onToggleTheme={onToggleTheme} />}>
        <Route path="/dashboard" element={<Dashboard />} />
        <Route path="/roles" element={<RolesPage />} />
        <Route path="/scenarios" element={<ScenariosPage />} />
        <Route path="/scenarios/:id" element={<ScenarioPlayer />} />
        <Route path="/quiz" element={<QuizPage />} />
        <Route path="/chatbot" element={<ChatbotPage />} />
        <Route path="/reports" element={<TrainingReports />} />
        <Route path="/quick-start" element={<FacilitatorQuickStart />} />
        <Route path="/admin" element={<FacilityAdminPage />} />
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
        <BrowserRouter>
          <AppRoutes theme={theme} onToggleTheme={toggleTheme} />
        </BrowserRouter>
      </TenantProvider>
    </AuthProvider>
  );
}
