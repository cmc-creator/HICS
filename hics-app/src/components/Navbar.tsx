import { Link, useLocation } from 'react-router-dom';
import { useAuth } from '../lib/authContext';
import { publicAsset } from '../lib/publicAsset';

const baseNavItems = [
  { path: '/dashboard', label: 'Dashboard', icon: publicAsset('lux-icons/dashboard.svg') },
  { path: '/roles', label: 'HICS Roles', icon: publicAsset('lux-icons/roles.svg') },
  { path: '/scenarios', label: 'Scenarios', icon: publicAsset('lux-icons/scenarios.svg') },
  { path: '/quiz', label: 'Quiz', icon: publicAsset('lux-icons/quiz.svg') },
  { path: '/learning-center', label: 'Learning Center', icon: publicAsset('lux-icons/scenarios.svg') },
  { path: '/rapid-challenge', label: 'Rapid Challenge', icon: publicAsset('lux-icons/quiz.svg') },
  { path: '/live-drill', label: 'Live Drill', icon: publicAsset('lux-icons/guide.svg') },
  { path: '/quick-start', label: 'Quick Start', icon: publicAsset('lux-icons/guide.svg') },
  { path: '/reports', label: 'Reports', icon: publicAsset('lux-icons/reports.svg') },
  { path: '/chatbot', label: 'AI Assistant', icon: publicAsset('lux-icons/assistant.svg') },
];

interface NavbarProps {
  theme: 'light' | 'dark';
  onToggleTheme: () => void;
}

// Slim sticky header (UI review B2/B4/B5/P2/P13): a compact brand
// row over the nav rail as a slim second row, on a solid theme
// surface - replacing the centered 80-120px logo stack (about
// 220px of sticky chrome), the white-on-metal labels that failed
// contrast in light theme, the "Out" abbreviation for Sign Out on
// phones, and the hamburger slide-down that duplicated the rail.
export default function Navbar({ theme, onToggleTheme }: NavbarProps) {
  const location = useLocation();
  // The Admin link follows the AUTH session role, not the tenant
  // preview switcher: only facility-admin / enterprise-admin
  // sessions ever see it (matching the /admin route gate).
  const { user, logout, sessionRemainingMs, isAdmin, isEnterpriseAdmin } = useAuth();
  const sessionMinutes = Math.max(1, Math.floor(sessionRemainingMs / 60000));
  const navItems = [
    ...baseNavItems,
    ...(isAdmin ? [{ path: '/admin', label: 'Admin', icon: publicAsset('lux-icons/admin.svg') }] : []),
    ...(isEnterpriseAdmin ? [{ path: '/admin/contracts', label: 'Contracts', icon: publicAsset('lux-icons/reports.svg') }] : []),
  ];
  // Active state follows the LONGEST matching nav path, so
  // /admin/contracts/123 lights up Contracts, not Admin, while
  // /scenarios/4 still lights up Scenarios.
  const activeNavPath = navItems
    .filter((item) => location.pathname === item.path || location.pathname.startsWith(`${item.path}/`))
    .sort((a, b) => b.path.length - a.path.length)[0]?.path;

  const quietLink =
    'text-stone-600 hover:bg-black/5 hover:text-stone-900 dark:text-stone-200 dark:hover:bg-white/10 dark:hover:text-white';

  return (
    <header className="sticky top-0 z-50 lux-nav-shell">
      <div className="max-w-7xl mx-auto px-3 sm:px-4">
        {/* Brand row */}
        <div className="flex items-center gap-2.5 py-2">
          <Link to="/dashboard" className="flex items-center gap-2.5 min-w-0" aria-label="NyxHICSlab - go to dashboard">
            <span className="lux-logo-frame shrink-0">
              <img src={publicAsset('hicslogo.png')} alt="" className="h-8 w-8 rounded-md object-contain lux-logo-img" />
            </span>
            <span className="min-w-0">
              <span className="text-lg leading-tight font-bold tracking-wide block truncate lux-brand-title text-stone-900 dark:text-white">NyxHICSlab</span>
              <span className="hidden md:block text-[11px] leading-tight tracking-wide truncate text-stone-500 dark:text-stone-300">Hospital Incident Command Training</span>
            </span>
          </Link>

          <div className="ml-auto flex items-center gap-1.5 sm:gap-2 shrink-0">
            {user && (
              <span className="hidden xl:inline-flex text-[10px] tracking-[0.12em] uppercase text-stone-500 dark:text-stone-300 border border-stone-900/15 dark:border-white/20 rounded-full px-2.5 py-1">
                {user.organization} · {sessionMinutes}m session
              </span>
            )}
            <button
              type="button"
              onClick={onToggleTheme}
              className={`touch-target flex items-center px-2.5 sm:px-3 py-2 rounded-full text-sm font-medium transition-colors ${quietLink}`}
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
            <Link
              to="/account"
              aria-current={location.pathname === '/account' ? 'page' : undefined}
              className={`touch-target px-2.5 sm:px-3 py-2 rounded-full text-sm font-medium transition-colors ${quietLink}`}
              title="Account and security settings"
            >
              Account
            </Link>
            <button
              type="button"
              onClick={logout}
              className="touch-target px-3 sm:px-3.5 py-2 rounded-full text-sm font-semibold whitespace-nowrap border border-red-800/30 text-red-800 transition-colors hover:bg-red-700 hover:text-white dark:border-red-300/40 dark:text-red-200 dark:hover:bg-red-500/25"
              title="Sign out"
            >
              Sign Out
            </button>
          </div>
        </div>

        {/* Nav rail: slim second row inside the sticky header. The
            wrap paints a right-edge fade while the rail can scroll
            sideways, so the scroll affordance is visible (P2). */}
        <div className="lux-nav-rail-wrap pb-2">
          <nav aria-label="Primary" className="flex items-center gap-1 overflow-x-auto no-scrollbar lux-nav-rail px-1 py-1">
            {navItems.map((item) => (
              <Link
                key={item.path}
                to={item.path}
                aria-current={activeNavPath === item.path ? 'page' : undefined}
                className={`touch-target flex items-center gap-1.5 px-2.5 sm:px-3 py-1.5 rounded-full text-[13px] sm:text-sm font-medium transition-colors whitespace-nowrap ${
                  activeNavPath === item.path ? 'lux-nav-active' : quietLink
                }`}
              >
                <span className="opacity-95 rounded-md overflow-hidden border border-stone-900/10 bg-white/60 dark:border-white/20 dark:bg-white/10 p-0.5">
                  <img src={item.icon} alt="" className="h-4 w-4 object-contain" />
                </span>
                <span className="tracking-tight">{item.label}</span>
              </Link>
            ))}
          </nav>
        </div>
      </div>
    </header>
  );
}
