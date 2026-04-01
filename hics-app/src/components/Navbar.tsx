import { Link, useLocation } from 'react-router-dom';

const navItems = [
  { path: '/', label: 'Dashboard', icon: 'DSH' },
  { path: '/roles', label: 'HICS Roles', icon: 'ORG' },
  { path: '/scenarios', label: 'Scenarios', icon: 'SIM' },
  { path: '/quiz', label: 'Quiz', icon: 'QZ' },
  { path: '/quick-start', label: 'Quick Start', icon: 'QST' },
  { path: '/reports', label: 'Reports', icon: 'RPT' },
  { path: '/chatbot', label: 'AI Assistant', icon: 'AI' },
];

interface NavbarProps {
  theme: 'light' | 'dark';
  onToggleTheme: () => void;
}

export default function Navbar({ theme, onToggleTheme }: NavbarProps) {
  const location = useLocation();

  return (
    <nav className="sticky top-0 z-50 bg-blue-900 text-white shadow-lg border-b border-white/10 backdrop-blur-xl lux-nav-shell">
      <div className="max-w-7xl mx-auto px-4">
        <div className="flex items-center justify-between min-h-16 py-2.5 gap-3">
          <div className="flex items-center gap-3">
            <div className="lux-logo-frame">
              <img
                src="/hicslogo.png"
                alt="HICS logo"
                className="h-10 w-10 rounded-lg object-contain bg-white p-1"
              />
            </div>
            <div>
              <span className="text-lg font-bold tracking-wide">NyxHICSlab</span>
              <span className="hidden sm:block text-xs text-blue-300">NyxCollective LLC · Enterprise Psychiatric Command Training</span>
            </div>
          </div>
          <div className="flex items-center gap-1 overflow-x-auto no-scrollbar max-w-[65vw] md:max-w-none">
            {navItems.map((item) => (
              <Link
                key={item.path}
                to={item.path}
                className={`touch-target flex items-center gap-1.5 px-3 py-2 rounded-md text-sm font-medium transition-colors whitespace-nowrap lux-nav-link ${
                  location.pathname === item.path
                    ? 'bg-blue-700 text-white lux-nav-active'
                    : 'text-blue-200 hover:bg-blue-800 hover:text-white'
                }`}
              >
                <span className="text-[10px] font-bold tracking-widest opacity-85">{item.icon}</span>
                <span className="hidden md:inline">{item.label}</span>
              </Link>
            ))}
            <button
              type="button"
              onClick={onToggleTheme}
              className="touch-target ml-1 px-3 py-2 rounded-md text-sm font-medium text-blue-100 hover:bg-blue-800 hover:text-white transition-colors lux-nav-link"
              aria-label={`Switch to ${theme === 'dark' ? 'light' : 'dark'} theme`}
              title={`Switch to ${theme === 'dark' ? 'light' : 'dark'} theme`}
            >
              <span className="mr-1 text-[10px] font-bold tracking-widest">{theme === 'dark' ? 'L' : 'D'}</span>
              <span className="hidden md:inline">{theme === 'dark' ? 'Light' : 'Dark'}</span>
            </button>
          </div>
        </div>
      </div>
    </nav>
  );
}
