import { Link, useLocation } from 'react-router-dom';
import { useTenant } from '../lib/tenantContext';

const baseNavItems = [
  { path: '/', label: 'Dashboard', icon: '/lux-icons/dashboard.svg' },
  { path: '/roles', label: 'HICS Roles', icon: '/lux-icons/roles.svg' },
  { path: '/scenarios', label: 'Scenarios', icon: '/lux-icons/scenarios.svg' },
  { path: '/quiz', label: 'Quiz', icon: '/lux-icons/quiz.svg' },
  { path: '/quick-start', label: 'Quick Start', icon: '/lux-icons/guide.svg' },
  { path: '/reports', label: 'Reports', icon: '/lux-icons/reports.svg' },
  { path: '/chatbot', label: 'AI Assistant', icon: '/lux-icons/assistant.svg' },
];

interface NavbarProps {
  theme: 'light' | 'dark';
  onToggleTheme: () => void;
}

export default function Navbar({ theme, onToggleTheme }: NavbarProps) {
  const location = useLocation();
  const { canManageUsers } = useTenant();
  const navItems = canManageUsers
    ? [...baseNavItems, { path: '/admin', label: 'Admin', icon: '/lux-icons/admin.svg' }]
    : baseNavItems;

  return (
    <nav className="sticky top-0 z-50 text-white shadow-lg border-b border-white/10 backdrop-blur-xl lux-nav-shell">
      <div className="max-w-7xl mx-auto px-4">
        <div className="flex items-center justify-between min-h-[102px] py-3 gap-4">
          <div className="flex items-center gap-4">
            <div className="lux-logo-frame">
              <img
                src="/hicslogo.png"
                alt="HICS logo"
                className="h-20 w-20 rounded-lg object-contain lux-logo-img"
              />
            </div>
            <div>
              <span className="text-2xl font-bold tracking-wide">NyxHICSlab</span>
              <span className="hidden sm:block text-xs text-amber-100/80">NyxCollective LLC · Enterprise Psychiatric Command Training</span>
            </div>
          </div>
          <div className="flex items-center gap-1 overflow-x-auto no-scrollbar max-w-[65vw] md:max-w-none">
            {navItems.map((item) => (
              <Link
                key={item.path}
                to={item.path}
                className={`touch-target flex items-center gap-1.5 px-3 py-2 rounded-md text-sm font-medium transition-colors whitespace-nowrap lux-nav-link ${
                  location.pathname === item.path
                    ? 'text-white lux-nav-active'
                    : 'text-stone-200 hover:bg-white/10 hover:text-white'
                }`}
              >
                <span className="opacity-95 rounded-md overflow-hidden border border-white/20 bg-black/20 p-0.5">
                  <img src={item.icon} alt="" className="h-4 w-4 object-contain" />
                </span>
                <span className="hidden md:inline tracking-tight">{item.label}</span>
              </Link>
            ))}
            <button
              type="button"
              onClick={onToggleTheme}
              className="touch-target ml-1 px-3 py-2 rounded-md text-sm font-medium text-stone-200 hover:bg-white/10 hover:text-white transition-colors lux-nav-link"
              aria-label={`Switch to ${theme === 'dark' ? 'light' : 'dark'} theme`}
              title={`Switch to ${theme === 'dark' ? 'light' : 'dark'} theme`}
            >
              <span className="mr-1.5 opacity-90">
                {theme === 'dark' ? (
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" className="h-4 w-4"><circle cx="12" cy="12" r="4" /><path d="M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4" /></svg>
                ) : (
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" className="h-4 w-4"><path d="M20 14.5A8.5 8.5 0 1111.5 4 6.5 6.5 0 0020 14.5z" /></svg>
                )}
              </span>
              <span className="hidden md:inline">{theme === 'dark' ? 'Light' : 'Dark'}</span>
            </button>
          </div>
        </div>
      </div>
    </nav>
  );
}
