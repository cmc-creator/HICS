import { Link, useLocation } from 'react-router-dom';

const navItems = [
  { path: '/', label: 'Dashboard', icon: '🏠' },
  { path: '/roles', label: 'HICS Roles', icon: '👥' },
  { path: '/scenarios', label: 'Scenarios', icon: '🎯' },
  { path: '/quiz', label: 'Quiz', icon: '📝' },
  { path: '/quick-start', label: 'Quick Start', icon: '⚡' },
  { path: '/reports', label: 'Reports', icon: '📊' },
  { path: '/chatbot', label: 'AI Assistant', icon: '🤖' },
];

interface NavbarProps {
  theme: 'light' | 'dark';
  onToggleTheme: () => void;
}

export default function Navbar({ theme, onToggleTheme }: NavbarProps) {
  const location = useLocation();

  return (
    <nav className="sticky top-0 z-50 bg-blue-900 text-white shadow-lg border-b border-white/10 backdrop-blur-xl">
      <div className="max-w-7xl mx-auto px-4">
        <div className="flex items-center justify-between min-h-16 py-2 gap-3">
          <div className="flex items-center gap-3">
            <span className="text-2xl">🏥</span>
            <div>
              <span className="text-lg font-bold tracking-wide">NyxHICSlab</span>
              <span className="hidden sm:block text-xs text-blue-300">NyxCollective LLC · Psychiatric Incident Command Training</span>
            </div>
          </div>
          <div className="flex items-center gap-1 overflow-x-auto no-scrollbar max-w-[65vw] md:max-w-none">
            {navItems.map((item) => (
              <Link
                key={item.path}
                to={item.path}
                className={`flex items-center gap-1.5 px-2.5 py-2 rounded-md text-sm font-medium transition-colors whitespace-nowrap ${
                  location.pathname === item.path
                    ? 'bg-blue-700 text-white'
                    : 'text-blue-200 hover:bg-blue-800 hover:text-white'
                }`}
              >
                <span className="text-base">{item.icon}</span>
                <span className="hidden md:inline">{item.label}</span>
              </Link>
            ))}
            <button
              type="button"
              onClick={onToggleTheme}
              className="ml-1 px-3 py-2 rounded-md text-sm font-medium text-blue-100 hover:bg-blue-800 hover:text-white transition-colors"
              aria-label={`Switch to ${theme === 'dark' ? 'light' : 'dark'} theme`}
              title={`Switch to ${theme === 'dark' ? 'light' : 'dark'} theme`}
            >
              <span className="mr-1">{theme === 'dark' ? '☀️' : '🌙'}</span>
              <span className="hidden md:inline">{theme === 'dark' ? 'Light' : 'Dark'}</span>
            </button>
          </div>
        </div>
      </div>
    </nav>
  );
}
