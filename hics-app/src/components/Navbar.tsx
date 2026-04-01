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
      <div className="max-w-7xl mx-auto px-3 sm:px-4">
        <div className="grid grid-cols-[1fr_auto_1fr] items-center py-2.5 md:py-3 gap-2 md:gap-4 lux-nav-top">
          <div className="justify-self-start">
            <span className="hidden lg:inline-flex text-[10px] tracking-[0.2em] uppercase text-amber-100/80 border border-amber-100/25 rounded-full px-2.5 py-1">Command Ready</span>
          </div>

          <div className="flex flex-col items-center text-center min-w-0">
            <div className="lux-logo-frame">
              <img
                src="/hicslogo.png"
                alt="HICS logo"
                className="h-20 w-20 sm:h-24 sm:w-24 md:h-28 md:w-28 lg:h-[120px] lg:w-[120px] rounded-lg object-contain lux-logo-img"
              />
            </div>
            <span className="text-2xl md:text-3xl font-bold tracking-wide block truncate lux-brand-title">NyxHICSlab</span>
            <span className="hidden sm:block text-xs md:text-sm text-amber-100/80 truncate">NyxCollective LLC · Enterprise Psychiatric Command Training</span>
          </div>

          <div className="flex items-center justify-self-end">
            <button
              type="button"
              onClick={onToggleTheme}
              className="touch-target px-2.5 sm:px-3 py-2 rounded-md text-sm font-medium text-stone-200 hover:bg-white/10 hover:text-white transition-colors lux-nav-link lux-theme-toggle"
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

        <div className="pb-3">
          <div className="flex items-center gap-1 overflow-x-auto no-scrollbar lux-nav-rail lux-nav-scroll px-1 py-1.5">
            {navItems.map((item) => (
              <Link
                key={item.path}
                to={item.path}
                className={`touch-target flex items-center gap-1.5 px-2.5 sm:px-3 py-2 rounded-md text-sm font-medium transition-colors whitespace-nowrap lux-nav-link lux-nav-item ${
                  location.pathname === item.path
                    ? 'text-white lux-nav-active'
                    : 'text-stone-200 hover:bg-white/10 hover:text-white'
                }`}
              >
                <span className="opacity-95 rounded-md overflow-hidden border border-white/20 bg-black/20 p-0.5">
                  <img src={item.icon} alt="" className="h-4 w-4 object-contain" />
                </span>
                <span className="inline text-[11px] sm:text-xs md:text-sm tracking-tight">{item.label}</span>
              </Link>
            ))}
          </div>
        </div>
      </div>
    </nav>
  );
}
