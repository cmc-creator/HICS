import { Link } from 'react-router-dom';
import { useEffect, useState } from 'react';
import { hicsRoles, hicsCategories } from '../data/roles';
import { scenarios } from '../data/scenarios';
import { quizQuestions } from '../data/quiz';
import { getScenarioAttempts, getTrainingSummary, type ScenarioAttempt } from '../lib/trainingAnalytics';
import { writeAuditLog } from '../lib/notifications';

const ONBOARDING_KEY = 'nyx-first-run-complete';

const stats = [
  { label: 'HICS Roles', value: hicsRoles.length, icon: '/lux-icons/roles.svg', color: 'bg-blue-500' },
  { label: 'Training Scenarios', value: scenarios.length, icon: '/lux-icons/scenarios.svg', color: 'bg-green-500' },
  { label: 'Quiz Questions', value: quizQuestions.length, icon: '/lux-icons/quiz.svg', color: 'bg-purple-500' },
  { label: 'HICS Sections', value: 5, icon: '/lux-icons/admin.svg', color: 'bg-red-500' },
];

const quickLinks = [
  {
    path: '/roles',
    title: 'Explore HICS Roles',
    description: 'Learn about each position in the HICS organizational structure, including responsibilities and reporting relationships.',
    icon: '/lux-icons/roles.svg',
    color: 'border-blue-500',
    badge: 'Interactive Chart',
  },
  {
    path: '/scenarios',
    title: 'Training Scenarios',
    description: 'Practice responding to real-world hospital emergencies including mass casualty incidents, fires, and hazmat events.',
    icon: '/lux-icons/scenarios.svg',
    color: 'border-green-500',
    badge: `${scenarios.length} Scenarios`,
  },
  {
    path: '/quiz',
    title: 'Knowledge Quiz',
    description: 'Test your HICS knowledge with scenario-based questions covering triage, protocols, and emergency management.',
    icon: '/lux-icons/quiz.svg',
    color: 'border-purple-500',
    badge: `${quizQuestions.length} Questions`,
  },
  {
    path: '/chatbot',
    title: 'AI Training Assistant',
    description: 'Ask questions and get instant answers about HICS protocols, procedures, and best practices from our AI assistant.',
    icon: '/lux-icons/assistant.svg',
    color: 'border-orange-500',
    badge: '24/7 Available',
  },
  {
    path: '/quick-start',
    title: 'Facilitator Quick Start',
    description: 'Launch guided setup, debrief prompts, and a practical 30-minute training flow for team leads.',
    icon: '/lux-icons/guide.svg',
    color: 'border-amber-500',
    badge: 'Session Guide',
  },
  {
    path: '/reports',
    title: 'Training Reports',
    description: 'Review completion trends, score performance, and export facilitator-friendly training records.',
    icon: '/lux-icons/reports.svg',
    color: 'border-slate-500',
    badge: 'CSV Export',
  },
];

export default function Dashboard() {
  const [attempts, setAttempts] = useState<ScenarioAttempt[]>([]);
  const [showOnboarding, setShowOnboarding] = useState(false);

  useEffect(() => {
    void getScenarioAttempts().then(setAttempts);

    const alreadySeen = localStorage.getItem(ONBOARDING_KEY) === 'true';
    if (!alreadySeen) {
      setShowOnboarding(true);
      void writeAuditLog('onboarding_opened');
    }
  }, []);

  const completeOnboarding = () => {
    localStorage.setItem(ONBOARDING_KEY, 'true');
    setShowOnboarding(false);
    void writeAuditLog('onboarding_completed');
  };

  const progressSummary = getTrainingSummary(attempts);

  return (
    <div className="min-h-screen bg-gray-50 lux-page">
      {showOnboarding && (
        <div className="fixed inset-0 z-[90] bg-black/60 backdrop-blur-sm flex items-center justify-center px-4">
          <div className="nyx-panel w-full max-w-2xl p-6">
            <p className="text-xs font-bold tracking-[0.2em] text-gray-500 dark:text-white/50">WELCOME</p>
            <h2 className="text-2xl font-bold text-gray-900 dark:text-white mt-2">First-Run Command Briefing</h2>
            <div className="mt-4 space-y-3 text-sm text-gray-700 dark:text-white/70">
              <p><strong>1.</strong> Start with one scenario to baseline response behavior.</p>
              <p><strong>2.</strong> Use the AI assistant for protocol clarifications during drills.</p>
              <p><strong>3.</strong> Run the quiz for post-drill competency checks.</p>
              <p><strong>4.</strong> Use Reports to export CSV and generate certificates.</p>
              <p><strong>5.</strong> Use Admin to manage users and monitor audit logs.</p>
            </div>
            <div className="mt-5 flex flex-wrap gap-2">
              <Link to="/scenarios" onClick={completeOnboarding} className="nyx-button-metal px-4 py-2 rounded-lg text-sm font-semibold">Start First Scenario</Link>
              <button type="button" onClick={completeOnboarding} className="border border-gray-300 dark:border-white/20 px-4 py-2 rounded-lg text-sm font-semibold text-gray-700 dark:text-white/80">Continue to Dashboard</button>
            </div>
          </div>
        </div>
      )}

      <div className="bg-gradient-to-r from-blue-900 to-blue-700 text-white py-12 px-4 relative overflow-hidden">
        <div className="lux-grid-pattern" />
        <div className="lux-orb lux-orb-a" />
        <div className="lux-orb lux-orb-b" />
        <div className="max-w-7xl mx-auto">
          <div className="lux-hero-shell">
            <div className="flex items-center gap-4 mb-4">
              <span className="h-14 w-14 rounded-xl overflow-hidden border border-white/45 bg-white/90 shadow-lg flex items-center justify-center">
                <img src="/hicslogo.png" alt="HICS" className="h-12 w-12 object-contain" />
              </span>
              <div>
                <h1 className="text-3xl md:text-4xl font-bold lux-title">NyxHICSlab</h1>
                <p className="text-blue-100/95 text-base md:text-lg lux-subtitle">Enterprise psychiatric incident command simulation platform</p>
              </div>
            </div>
            <p className="text-blue-100/95 max-w-3xl text-base leading-relaxed">
              Prepare behavioral health teams for real-world incidents with premium interactive scenarios, role-based training,
              and an AI assistant designed for psychiatric inpatient operations.
            </p>
            <div className="mt-6 flex flex-wrap gap-3">
              <Link to="/scenarios" className="lux-button-primary px-5 py-2.5 font-semibold">Start Training</Link>
              <Link to="/roles" className="lux-button-secondary text-white px-5 py-2.5 font-semibold">Explore HICS Structure</Link>
            </div>
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-4 py-8">
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8 motion-stagger">
          {stats.map((stat) => (
            <div key={stat.label} className="lux-stat-card p-5 flex items-center gap-4 card-lift">
              <div className={`${stat.color} text-white rounded-xl p-2.5 flex items-center justify-center w-12 h-12 shadow-lg`}>
                <img src={stat.icon} alt="" className="h-7 w-7 object-contain" />
              </div>
              <div>
                <div className="text-2xl font-bold text-gray-900 dark:text-white">{stat.value}</div>
                <div className="text-sm text-gray-500 dark:text-white/60">{stat.label}</div>
              </div>
            </div>
          ))}
        </div>

        <h2 className="text-xl font-bold text-gray-800 dark:text-white mb-4">Platform Modules</h2>
        <div className="grid md:grid-cols-2 gap-4 mb-8 motion-stagger">
          {quickLinks.map((link) => (
            <Link
              key={link.path}
              to={link.path}
              className={`bg-white dark:bg-white/5 rounded-xl shadow-sm p-6 border-l-4 ${link.color} hover:shadow-md transition-all group card-lift`}
            >
              <div className="flex items-start justify-between mb-3">
                <span className="rounded-lg bg-slate-900/90 text-white p-2.5">
                  <img src={link.icon} alt="" className="h-6 w-6 object-contain" />
                </span>
                <span className="text-xs bg-gray-100 dark:bg-white/10 text-gray-600 dark:text-white/70 px-2 py-1 rounded-full font-medium">{link.badge}</span>
              </div>
              <h3 className="text-lg font-bold text-gray-900 dark:text-white mb-2 group-hover:text-blue-700 transition-colors">{link.title}</h3>
              <p className="text-gray-600 dark:text-white/70 text-sm leading-relaxed">{link.description}</p>
            </Link>
          ))}
        </div>

        <div className="bg-white dark:bg-white/5 rounded-xl shadow-sm p-6 mb-8">
          <h2 className="text-xl font-bold text-gray-800 dark:text-white mb-4">Learner Progress Snapshot</h2>
          <div className="grid sm:grid-cols-3 gap-4">
            <div className="rounded-lg border border-gray-200 dark:border-white/10 p-4">
              <div className="text-xs text-gray-500 dark:text-white/50">Attempts Logged</div>
              <div className="text-2xl font-bold text-gray-900 dark:text-white">{progressSummary.totalAttempts}</div>
            </div>
            <div className="rounded-lg border border-gray-200 dark:border-white/10 p-4">
              <div className="text-xs text-gray-500 dark:text-white/50">Average Score</div>
              <div className="text-2xl font-bold text-gray-900 dark:text-white">{progressSummary.averageScore}%</div>
            </div>
            <div className="rounded-lg border border-gray-200 dark:border-white/10 p-4">
              <div className="text-xs text-gray-500 dark:text-white/50">Best Score</div>
              <div className="text-2xl font-bold text-gray-900 dark:text-white">{progressSummary.bestScore}%</div>
            </div>
          </div>
          <div className="mt-4">
            <Link to="/reports" className="text-blue-600 hover:text-blue-800 text-sm font-medium">Open full training reports →</Link>
          </div>
        </div>

        <div className="bg-white dark:bg-white/5 rounded-xl shadow-sm p-6">
          <h2 className="text-xl font-bold text-gray-800 dark:text-white mb-4">NyxHICSlab Command Structure Overview</h2>
          <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
            {hicsCategories.map((cat) => {
              const roles = hicsRoles.filter((r) => r.category === cat.id);
              return (
                <div key={cat.id} className="rounded-lg p-3 border-t-4" style={{ borderColor: cat.color, backgroundColor: `${cat.color}10` }}>
                  <div className="text-xs font-bold mb-2 text-gray-700 dark:text-white/70">{cat.label}</div>
                  <div className="space-y-1">
                    {roles.map((role) => (
                      <div key={role.id} className="text-xs text-gray-600 dark:text-white/60 flex items-center gap-1">
                        <div className="w-1.5 h-1.5 rounded-full flex-shrink-0" style={{ backgroundColor: role.color }} />
                        {role.abbreviation}
                      </div>
                    ))}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
}
