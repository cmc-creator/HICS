import { BrowserRouter, Routes, Route } from 'react-router-dom';
import Navbar from './components/Navbar';
import Dashboard from './pages/Dashboard';
import RolesPage from './pages/RolesPage';
import ScenariosPage from './pages/ScenariosPage';
import ScenarioPlayer from './pages/ScenarioPlayer';
import QuizPage from './pages/QuizPage';
import ChatbotPage from './pages/ChatbotPage';

export default function App() {
  return (
    <BrowserRouter>
      <div className="flex flex-col min-h-screen">
        <Navbar />
        <main className="flex-1">
          <Routes>
            <Route path="/" element={<Dashboard />} />
            <Route path="/roles" element={<RolesPage />} />
            <Route path="/scenarios" element={<ScenariosPage />} />
            <Route path="/scenarios/:id" element={<ScenarioPlayer />} />
            <Route path="/quiz" element={<QuizPage />} />
            <Route path="/chatbot" element={<ChatbotPage />} />
          </Routes>
        </main>
      </div>
    </BrowserRouter>
  );
}
