import { Link } from 'react-router-dom';

interface LandingPageProps {
  theme: 'light' | 'dark';
  onToggleTheme: () => void;
}

const pillars = [
  {
    title: 'Enterprise Governance',
    detail: 'Facility-scoped controls, role-based access, and audit-ready reporting aligned with health system operations.',
  },
  {
    title: 'High-Fidelity Simulation',
    detail: 'Behavioral health focused scenarios for command activation, throughput stress, safety incidents, and infrastructure failure.',
  },
  {
    title: 'Operational Readiness',
    detail: 'Facilitator workflows, timed drills, and decision analytics that accelerate team competence and incident response consistency.',
  },
];

const trustItems = ['SSO-ready authentication flow', 'Tenant-aware access model', 'Exportable compliance reporting', 'Rapid onboarding in under 30 minutes'];

export default function LandingPage({ theme, onToggleTheme }: LandingPageProps) {
  return (
    <div className="min-h-screen bg-gray-50 lux-page">
      <header className="nyx-hero text-white px-4 py-5 relative overflow-hidden">
        <div className="lux-grid-pattern" />
        <div className="max-w-7xl mx-auto flex items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="lux-logo-frame">
              <img src="/hicslogo.png" alt="NyxHICSlab logo" className="h-12 w-12 rounded-lg object-contain lux-logo-img" />
            </div>
            <div>
              <div className="text-xl font-bold lux-brand-title">NyxHICSlab</div>
              <div className="text-xs text-amber-100/85">Enterprise Hospital Incident Command System Training</div>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={onToggleTheme}
              className="touch-target px-3 py-2 rounded-md text-sm font-medium text-stone-200 hover:bg-white/10 hover:text-white transition-colors lux-nav-link"
            >
              {theme === 'dark' ? 'Light' : 'Dark'}
            </button>
            <Link to="/login" className="nyx-button-metal px-4 py-2 rounded-lg text-sm font-semibold">
              Sign In
            </Link>
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 py-10 space-y-8">
        <section className="nyx-panel p-8 md:p-10">
          <p className="text-xs tracking-[0.2em] text-gray-500 font-bold mb-3">SELL-READY PLATFORM</p>
          <h1 className="text-3xl md:text-5xl font-bold text-gray-900 leading-tight max-w-4xl">
            Enterprise-grade incident command training for behavioral health systems.
          </h1>
          <p className="text-gray-600 text-base md:text-lg mt-4 max-w-3xl leading-relaxed">
            Deploy secure, role-aware HICS simulation across facilities with one platform for scenarios, assessment,
            facilitator operations, and compliance reporting.
          </p>
          <div className="mt-6 flex flex-wrap gap-3">
            <Link to="/login" className="nyx-button-metal px-5 py-2.5 rounded-lg text-sm font-semibold">Launch Enterprise Workspace</Link>
            <Link to="/request-demo" className="border border-gray-300 text-gray-700 px-5 py-2.5 rounded-lg text-sm font-semibold hover:bg-gray-50">Request Demo</Link>
            <a href="#capabilities" className="border border-gray-300 text-gray-700 px-5 py-2.5 rounded-lg text-sm font-semibold hover:bg-gray-50">Explore Capabilities</a>
          </div>
        </section>

        <section id="capabilities" className="grid md:grid-cols-3 gap-4 motion-stagger">
          {pillars.map((pillar) => (
            <article key={pillar.title} className="nyx-panel p-5 card-lift">
              <h2 className="text-lg font-bold text-gray-900 mb-2">{pillar.title}</h2>
              <p className="text-sm text-gray-600 leading-relaxed">{pillar.detail}</p>
            </article>
          ))}
        </section>

        <section className="nyx-panel p-6">
          <h2 className="text-xl font-bold text-gray-900 mb-3">Enterprise Readiness Checklist</h2>
          <div className="grid sm:grid-cols-2 gap-2">
            {trustItems.map((item) => (
              <div key={item} className="flex items-center gap-2 text-sm text-gray-700">
                <span className="text-[10px] font-bold tracking-widest px-2 py-0.5 rounded border border-green-300 text-green-700">OK</span>
                <span>{item}</span>
              </div>
            ))}
          </div>
          <div className="mt-6 flex flex-wrap gap-3">
            <Link to="/request-demo" className="nyx-button-metal px-5 py-2.5 rounded-lg text-sm font-semibold">Talk to Sales</Link>
            <Link to="/login" className="border border-gray-300 text-gray-700 px-5 py-2.5 rounded-lg text-sm font-semibold hover:bg-gray-50">Enterprise Sign In</Link>
          </div>
        </section>
      </main>
    </div>
  );
}
