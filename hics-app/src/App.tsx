import { useEffect, useState } from 'react';
import { BrowserRouter, Routes, Route } from 'react-router-dom';
import Navbar from './components/Navbar';
import Dashboard from './pages/Dashboard';
import RolesPage from './pages/RolesPage';
import ScenariosPage from './pages/ScenariosPage';
import ScenarioPlayer from './pages/ScenarioPlayer';
import QuizPage from './pages/QuizPage';
import ChatbotPage from './pages/ChatbotPage';
import TrainingReports from './pages/TrainingReports';
import FacilitatorQuickStart from './pages/FacilitatorQuickStart';
import FacilityAdminPage from './pages/FacilityAdminPage';
import { TenantProvider } from './lib/tenantContext';

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
    <TenantProvider>
      <BrowserRouter>
        <div className="nyx-app flex flex-col min-h-screen">
          <Navbar theme={theme} onToggleTheme={toggleTheme} />
          <main className="flex-1 animate-fade-in">
            <Routes>
              <Route path="/" element={<Dashboard />} />
              <Route path="/roles" element={<RolesPage />} />
              <Route path="/scenarios" element={<ScenariosPage />} />
              <Route path="/scenarios/:id" element={<ScenarioPlayer />} />
              <Route path="/quiz" element={<QuizPage />} />
              <Route path="/chatbot" element={<ChatbotPage />} />
              <Route path="/reports" element={<TrainingReports />} />
              <Route path="/quick-start" element={<FacilitatorQuickStart />} />
              <Route path="/admin" element={<FacilityAdminPage />} />
            </Routes>
          </main>
        </div>
      </BrowserRouter>
    </TenantProvider>
  );
}
