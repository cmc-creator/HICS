import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';

interface LandingPageProps {
  theme: 'light' | 'dark';
  onToggleTheme: () => void;
}

const testimonials = [
  {
    quote: 'We ran our first full-facility HICS drill in under 45 minutes. The scenario fidelity is unlike anything we had before.',
    name: 'Director of Emergency Management',
    org: 'Regional Behavioral Health System, Pacific Northwest',
  },
  {
    quote: 'Our new staff complete HICS orientation in one session now. The AI assistant fills gaps instantly and the quiz scores have improved significantly.',
    name: 'Nurse Educator',
    org: 'Community Psychiatric Center, Southeast',
  },
  {
    quote: "NyxHICSlab gave our compliance team the exportable reporting they'd been requesting for three years.",
    name: 'Chief Compliance Officer',
    org: 'Multi-Site Behavioral Health Network, Midwest',
  },
];

const pillars = [
  {
    title: 'Enterprise Governance',
    detail: 'Facility-scoped controls, role-based access, and audit-ready reporting aligned with health system operations.',
    image: '/landing/dashboard-mockup.svg',
    alt: 'NyxHICSlab dashboard showing stat cards and quick-link modules',
  },
  {
    title: 'High-Fidelity Simulation',
    detail: 'Behavioral health focused scenarios for command activation, throughput stress, safety incidents, and infrastructure failure.',
    image: '/landing/scenario-mockup.svg',
    alt: 'NyxHICSlab scenario player with timed mode and facilitator notes',
  },
  {
    title: 'Operational Readiness',
    detail: 'Facilitator workflows, timed drills, and decision analytics that accelerate team competence and incident response consistency.',
    image: '/landing/quiz-mockup.svg',
    alt: 'NyxHICSlab knowledge quiz with per-category scoring and answer reveal',
  },
];

const trustItems = ['SSO-ready authentication flow', 'Tenant-aware access model', 'Exportable compliance reporting', 'Rapid onboarding in under 30 minutes'];

const pricingTiers = [
  {
    name: 'Pilot',
    price: '$7,500',
    cadence: '/facility/year',
    points: ['Up to 50 users', 'Core scenarios, quiz, assistant', 'CSV export and facilitator mode'],
  },
  {
    name: 'Enterprise',
    price: 'Custom',
    cadence: 'annual contract',
    points: ['Multi-facility tenant hierarchy', 'SSO, role mapping, and policy controls', 'Deployment onboarding + success plan'],
  },
  {
    name: 'System-Wide',
    price: 'Custom',
    cadence: 'MSA + SLA',
    points: ['Unlimited facilities', 'Advanced governance and compliance exports', 'Dedicated roadmap and integration support'],
  },
];

export default function LandingPage({ theme, onToggleTheme }: LandingPageProps) {
  const [stickyVisible, setStickyVisible] = useState(false);

  useEffect(() => {
    const onScroll = () => setStickyVisible(window.scrollY > 320);
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, []);

  return (
    <div className="min-h-screen bg-gray-50 lux-page pb-20 md:pb-0">
      <header className="nyx-hero text-white px-4 py-5 relative overflow-hidden">
        <div className="lux-grid-pattern" />
        <div className="max-w-7xl mx-auto flex items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="lux-logo-frame">
              <img src="/hicslogo.png" alt="NyxHICSlab logo" className="h-20 w-20 rounded-lg object-contain lux-logo-img" />
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
        <section className="grid lg:grid-cols-[1.15fr_1fr] gap-6 items-stretch">
          <div className="nyx-panel p-8 md:p-10">
            <p className="text-xs tracking-[0.2em] opacity-50 font-bold mb-3">SELL-READY PLATFORM</p>
            <h1 className="text-3xl md:text-5xl font-bold leading-tight max-w-4xl">
              Enterprise-grade incident command training for behavioral health systems.
            </h1>
            <p className="opacity-60 text-base md:text-lg mt-4 max-w-3xl leading-relaxed">
              Deploy secure, role-aware HICS simulation across facilities with one platform for scenarios, assessment,
              facilitator operations, and compliance reporting.
            </p>
            <div className="mt-6 flex flex-wrap gap-3">
              <Link to="/login" className="nyx-button-metal px-5 py-2.5 rounded-lg text-sm font-semibold">Launch Enterprise Workspace</Link>
              <Link to="/request-demo" className="border border-white/20 opacity-80 hover:opacity-100 px-5 py-2.5 rounded-lg text-sm font-semibold transition-opacity">Request Demo</Link>
              <a href="#capabilities" className="border border-white/20 opacity-80 hover:opacity-100 px-5 py-2.5 rounded-lg text-sm font-semibold transition-opacity">Explore Capabilities</a>
            </div>
          </div>
          <div className="nyx-panel p-3 flex items-center">
            <img src="/landing/dashboard-mockup.svg" alt="NyxHICSlab enterprise dashboard — stat cards, quick-link modules, and facilitator controls" className="w-full h-auto rounded-xl" />
          </div>
        </section>

        <section id="capabilities" className="grid md:grid-cols-3 gap-4 motion-stagger">
          {pillars.map((pillar) => (
            <article key={pillar.title} className="nyx-panel p-5 card-lift">
              <img
                src={pillar.image}
                alt={pillar.alt}
                className="w-full h-36 object-cover object-top rounded-lg mb-3 border border-white/5"
              />
              <h2 className="text-lg font-bold mb-2">{pillar.title}</h2>
              <p className="text-sm opacity-60 leading-relaxed">{pillar.detail}</p>
            </article>
          ))}
        </section>

        <section className="nyx-panel p-6">
          <h2 className="text-xl font-bold mb-6">Enterprise Pricing Paths</h2>
          <div className="grid md:grid-cols-3 gap-4">
            {pricingTiers.map((tier, i) => (
              <article
                key={tier.name}
                className={`rounded-xl border p-5 flex flex-col gap-1 ${
                  i === 1
                    ? 'border-amber-400/40 bg-amber-950/20'
                    : 'border-white/10 bg-white/5'
                }`}
              >
                <h3 className="text-sm font-semibold tracking-widest uppercase opacity-60">{tier.name}</h3>
                <p className="text-3xl font-extrabold mt-1">{tier.price}</p>
                <p className="text-xs opacity-40 mb-2">{tier.cadence}</p>
                <ul className="mt-1 space-y-2">
                  {tier.points.map((point) => (
                    <li key={point} className="flex items-start gap-2 text-sm">
                      <span className="text-green-400 mt-0.5 shrink-0">✓</span>
                      <span className="opacity-80">{point}</span>
                    </li>
                  ))}
                </ul>
              </article>
            ))}
          </div>
        </section>

        <section className="nyx-panel p-6">
          <p className="text-xs tracking-[0.2em] opacity-50 font-bold mb-6">WHAT TEAMS ARE SAYING</p>
          <div className="grid md:grid-cols-3 gap-4">
            {testimonials.map((t) => (
              <blockquote key={t.name} className="rounded-xl border border-white/10 bg-white/5 p-5 flex flex-col gap-3">
                <p className="text-sm leading-relaxed opacity-80">"{t.quote}"</p>
                <footer className="mt-auto pt-3 border-t border-white/10">
                  <p className="text-xs font-semibold opacity-70">{t.name}</p>
                  <p className="text-xs opacity-40 mt-0.5">{t.org}</p>
                </footer>
              </blockquote>
            ))}
          </div>
        </section>

        <section className="nyx-panel p-6">
          <h2 className="text-xl font-bold mb-3">Enterprise Readiness Checklist</h2>
          <div className="grid sm:grid-cols-2 gap-2">
            {trustItems.map((item) => (
              <div key={item} className="flex items-center gap-2 text-sm opacity-80">
                <span className="text-green-400 shrink-0">✓</span>
                <span>{item}</span>
              </div>
            ))}
          </div>
          <div className="mt-6 flex flex-wrap gap-3">
            <Link to="/request-demo" className="nyx-button-metal px-5 py-2.5 rounded-lg text-sm font-semibold">Talk to Sales</Link>
            <Link to="/login" className="border border-white/20 opacity-80 hover:opacity-100 px-5 py-2.5 rounded-lg text-sm font-semibold transition-opacity">Enterprise Sign In</Link>
          </div>
        </section>

        <footer className="nyx-panel p-4 text-xs opacity-50 leading-relaxed">
          <p>NyxHICSlab is a product of NyxCollective LLC.</p>
          <p className="mt-1">Copyright (c) 2026 NyxCollective LLC. All rights reserved.</p>
          <p className="mt-1">NyxHICSlab, NyxCollective, and related names, logos, product marks, and design marks are trademarks of NyxCollective LLC.</p>
        </footer>
      </main>

      {/* Sticky bottom CTA - appears after hero scrolls out of view */}
      <div
        className={`fixed bottom-0 inset-x-0 z-50 transition-transform duration-300 ${
          stickyVisible ? 'translate-y-0' : 'translate-y-full'
        }`}
      >
        <div className="nyx-hero border-t border-white/10 px-4 py-3">
          <div className="max-w-7xl mx-auto flex items-center justify-between gap-4 flex-wrap">
            <p className="text-sm font-semibold text-white/90 hidden sm:block">
              Ready to modernize your HICS training?
            </p>
            <div className="flex items-center gap-3 ml-auto">
              <Link
                to="/request-demo"
                className="nyx-button-metal px-5 py-2 rounded-lg text-sm font-semibold"
              >
                Request Demo
              </Link>
              <Link
                to="/login"
                className="border border-white/25 text-white/80 hover:text-white px-4 py-2 rounded-lg text-sm font-semibold transition-colors"
              >
                Sign In
              </Link>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
