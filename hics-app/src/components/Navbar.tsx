import { Link, useLocation } from 'react-router-dom';
import { useTenant } from '../lib/tenantContext';

const baseNavItems = [
  { path: '/', label: 'Dashboard', icon: 'dashboard' },
  { path: '/roles', label: 'HICS Roles', icon: 'roles' },
  { path: '/scenarios', label: 'Scenarios', icon: 'scenarios' },
  { path: '/quiz', label: 'Quiz', icon: 'quiz' },
  { path: '/quick-start', label: 'Quick Start', icon: 'guide' },
  { path: '/reports', label: 'Reports', icon: 'reports' },
  { path: '/chatbot', label: 'AI Assistant', icon: 'assistant' },
];

interface NavbarProps {
  theme: 'light' | 'dark';
  onToggleTheme: () => void;
}

function NavIcon({ icon }: { icon: string }) {
  if (icon === 'dashboard') {
    return <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" className="h-4 w-4"><rect x="3" y="3" width="8" height="8" rx="2" /><rect x="13" y="3" width="8" height="5" rx="2" /><rect x="13" y="10" width="8" height="11" rx="2" /><rect x="3" y="13" width="8" height="8" rx="2" /></svg>;
  }

  if (icon === 'roles') {
    return <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" className="h-4 w-4"><circle cx="6" cy="7" r="2.5" /><circle cx="18" cy="7" r="2.5" /><circle cx="12" cy="17" r="2.5" /><path d="M8 8.8l2.7 5.3M16 8.8l-2.7 5.3" /></svg>;
  }

  if (icon === 'scenarios') {
    return <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" className="h-4 w-4"><path d="M4 6h16M4 12h10M4 18h16" /><circle cx="18" cy="12" r="2.5" /></svg>;
  }

  if (icon === 'quiz') {
    return <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" className="h-4 w-4"><path d="M8.5 8.8a3.5 3.5 0 117 0c0 2.2-1.5 3.1-2.7 3.9-.8.5-1.3 1-1.3 1.8" /><circle cx="12" cy="18" r="1" /></svg>;
  }

  if (icon === 'guide') {
    return <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" className="h-4 w-4"><path d="M5 4h10a3 3 0 013 3v13H8a3 3 0 00-3 3V4z" /><path d="M8 20h11" /></svg>;
  }

  if (icon === 'reports') {
    return <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" className="h-4 w-4"><path d="M5 5h14v14H5z" /><path d="M9 14l2-2 2 1 2-3" /></svg>;
  }

  if (icon === 'assistant') {
    return <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" className="h-4 w-4"><rect x="5" y="6" width="14" height="12" rx="3" /><circle cx="10" cy="12" r="1" /><circle cx="14" cy="12" r="1" /><path d="M12 3v3M8 18l-2 3M16 18l2 3" /></svg>;
  }

  if (icon === 'admin') {
    return <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" className="h-4 w-4"><path d="M12 3l7 4v5c0 4.2-2.8 7.8-7 9-4.2-1.2-7-4.8-7-9V7l7-4z" /><path d="M9.5 12.5l1.7 1.7 3.3-3.3" /></svg>;
  }

  return <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" className="h-4 w-4"><path d="M4 12h16M12 4v16" /></svg>;
}

export default function Navbar({ theme, onToggleTheme }: NavbarProps) {
  const location = useLocation();
  const { canManageUsers } = useTenant();
  const navItems = canManageUsers
    ? [...baseNavItems, { path: '/admin', label: 'Admin', icon: 'admin' }]
    : baseNavItems;

  return (
    <nav className="sticky top-0 z-50 text-white shadow-lg border-b border-white/10 backdrop-blur-xl lux-nav-shell">
      <div className="max-w-7xl mx-auto px-4">
        <div className="flex items-center justify-between min-h-[88px] py-3 gap-4">
          <div className="flex items-center gap-4">
            <div className="lux-logo-frame">
              <img
                src="/hicslogo.png"
                alt="HICS logo"
                className="h-16 w-16 rounded-lg object-contain lux-logo-img"
              />
            </div>
            <div>
              <span className="text-xl font-bold tracking-wide">NyxHICSlab</span>
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
                <span className="opacity-90"><NavIcon icon={item.icon} /></span>
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
