import { Link } from 'react-router-dom';
import { useEffect, useState } from 'react';
import { hicsRoles, hicsCategories } from '../data/roles';
import { scenarios } from '../data/scenarios';
import { quizQuestions } from '../data/quiz';
import { getScenarioAttempts, getTrainingSummary, type ScenarioAttempt } from '../lib/trainingAnalytics';
import { getAchievementSummary, getFacilityLeaderboard } from '../lib/gamification';
import { writeAuditLog } from '../lib/notifications';
import { publicAsset } from '../lib/publicAsset';
import { useCountUp } from '../lib/useCountUp';

const ONBOARDING_KEY = 'nyx-first-run-complete';

const stats = [
  { label: 'HICS Roles', value: hicsRoles.length, icon: publicAsset('lux-icons/roles.svg'), path: '/roles' },
  { label: 'Training Scenarios', value: scenarios.length, icon: publicAsset('lux-icons/scenarios.svg'), path: '/scenarios' },
  { label: 'Quiz Questions', value: quizQuestions.length, icon: publicAsset('lux-icons/quiz.svg'), path: '/quiz' },
  { label: 'HICS Sections', value: 5, icon: publicAsset('lux-icons/admin.svg'), path: '/roles' },
];

const quickLinks = [
  {
    path: '/roles',
    title: 'Explore HICS Roles',
    description: 'Learn about each position in the HICS organizational structure, including responsibilities and reporting relationships.',
    icon: publicAsset('lux-icons/roles.svg'),
    badge: 'Interactive Chart',
  },
  {
    path: '/scenarios',
    title: 'Training Scenarios',
    description: 'Practice responding to real-world hospital emergencies including mass casualty incidents, fires, and hazmat events.',
    icon: publicAsset('lux-icons/scenarios.svg'),
    badge: `${scenarios.length} Scenarios`,
  },
  {
    path: '/quiz',
    title: 'Knowledge Quiz',
    description: 'Test your HICS knowledge with scenario-based questions covering triage, protocols, and emergency management.',
    icon: publicAsset('lux-icons/quiz.svg'),
    badge: `${quizQuestions.length} Questions`,
  },
  {
    path: '/chatbot',
    title: 'AI Training Assistant',
    description: 'Ask questions and get instant answers about HICS protocols, procedures, and best practices from our AI assistant.',
    icon: publicAsset('lux-icons/assistant.svg'),
    badge: '24/7 Available',
  },
  {
    path: '/quick-start',
    title: 'Facilitator Quick Start',
    description: 'Launch guided setup, debrief prompts, and a practical 30-minute training flow for team leads.',
    icon: publicAsset('lux-icons/guide.svg'),
    badge: 'Session Guide',
  },
  {
    path: '/reports',
    title: 'Training Reports',
    description: 'Review completion trends, score performance, and export facilitator-friendly training records.',
    icon: publicAsset('lux-icons/reports.svg'),
    badge: 'CSV Export',
  },
  {
    path: '/learning-center',
    title: 'Learning Center',
    description: 'Walk through storyboard-style training modules with guided frames and role-based objectives.',
    icon: publicAsset('lux-icons/scenarios.svg'),
    badge: 'Storyboard Modules',
  },
  {
    path: '/rapid-challenge',
    title: 'Rapid Challenge',
    description: 'Play a timed mini-game with streak multipliers to sharpen high-pressure command decisions.',
    icon: publicAsset('lux-icons/quiz.svg'),
    badge: 'Timed Mode',
  },
  {
    path: '/live-drill',
    title: 'Live Drill Control',
    description: 'Run facilitator-led sessions with phase control, role assignments, and live announcements.',
    icon: publicAsset('lux-icons/guide.svg'),
    badge: 'Facilitator Mode',
  },
];

function AnimatedStat({ value, suffix = '' }: { value: number; suffix?: string }) {
  const animated = useCountUp(value);
  return <>{animated}{suffix}</>;
}

export default function Dashboard() {
  const [attempts, setAttempts] = useState<ScenarioAttempt[]>([]);
  const [attemptsLoaded, setAttemptsLoaded] = useState(false);
  const [showOnboarding, setShowOnboarding] = useState(false);

  useEffect(() => {
    void getScenarioAttempts()
      .then(setAttempts)
      .finally(() => setAttemptsLoaded(true));

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
  const achievementSummary = getAchievementSummary(attempts);
  const leaderboard = getFacilityLeaderboard(attempts);

  return (
    <div className="min-h-screen bg-gray-50 lux-page">
      {showOnboarding && (
        <div className="fixed inset-0 z-[90] bg-black/60 backdrop-blur-sm flex items-center justify-center px-4">
          <div className="nyx-panel w-full max-w-2xl p-6" role="dialog" aria-modal="true" aria-labelledby="onboarding-title">
            <p className="text-xs font-bold tracking-[0.2em] text-gray-500 dark:text-white/50">WELCOME</p>
            <h2 id="onboarding-title" className="text-2xl font-bold text-gray-900 dark:text-white mt-2">First-Run Command Briefing</h2>
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

      <div className="nyx-hero text-white">
        <div className="lux-grid-pattern" />
        <div className="lux-orb lux-orb-a" />
        <div className="lux-orb lux-orb-b" />
        <div className="max-w-7xl mx-auto">
          <div className="lux-hero-shell">
            {/* No logo here (UI review B4): the header carries the
                one logo lockup; this hero leads with the pitch. */}
            <h1 className="text-3xl md:text-4xl font-bold lux-title">Hospital incident command training for every facility type</h1>
            <p className="text-amber-50/90 text-base md:text-lg lux-subtitle mt-2">Interactive HICS scenarios, role-based drills, and audit-ready training records</p>
            <p className="text-amber-50/90 max-w-3xl text-base leading-relaxed mt-4">
              Prepare your teams for real-world incidents with interactive scenarios, role-based training, and an AI
              assistant - built for general acute care and community hospitals, long-term care, and ambulatory centers,
              with deep behavioral health and psychiatric inpatient content as a specialty strength.
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
            <Link key={stat.label} to={stat.path} className="lux-stat-card p-5 flex items-center gap-4 card-lift hover:shadow-md transition-shadow">
              <div className="stat-chip rounded-xl p-2.5 flex items-center justify-center w-12 h-12">
                <img src={stat.icon} alt="" className="h-7 w-7 object-contain" />
              </div>
              <div>
                <div className="text-2xl font-bold text-gray-900 dark:text-white"><AnimatedStat value={stat.value} /></div>
                <div className="text-sm text-gray-500 dark:text-white/60">{stat.label}</div>
              </div>
            </Link>
          ))}
        </div>

        <h2 className="text-xl font-bold text-gray-800 dark:text-white mb-4">Platform Modules</h2>
        <div className="grid md:grid-cols-2 gap-4 mb-8 motion-stagger">
          {quickLinks.map((link) => (
            <Link
              key={link.path}
              to={link.path}
              className="bg-white dark:bg-white/5 rounded-xl shadow-sm p-6 border-l-4 border-l-amber-700/60 dark:border-l-amber-300/50 hover:shadow-md transition-all group card-lift"
            >
              <div className="flex items-start justify-between mb-3">
                <span className="rounded-lg bg-slate-900/90 text-white p-2.5">
                  <img src={link.icon} alt="" className="h-6 w-6 object-contain" />
                </span>
                <span className="text-xs bg-gray-100 dark:bg-white/10 text-gray-600 dark:text-white/70 px-2 py-1 rounded-full font-medium">{link.badge}</span>
              </div>
              <h3 className="text-lg font-bold text-gray-900 dark:text-white mb-2 group-hover:text-[#5f4390] dark:group-hover:text-[#d3c2f0] transition-colors">{link.title}</h3>
              <p className="text-gray-600 dark:text-white/70 text-sm leading-relaxed">{link.description}</p>
            </Link>
          ))}
        </div>

        <div className="bg-white dark:bg-white/5 rounded-xl shadow-sm p-6 mb-8">
          <h2 className="text-xl font-bold text-gray-800 dark:text-white mb-4">Learner Progress Snapshot</h2>
          {!attemptsLoaded ? (
            <div className="grid sm:grid-cols-3 gap-4" aria-busy="true" aria-label="Loading your progress">
              {[0, 1, 2].map((tile) => (
                <div key={tile} className="skeleton-block h-[74px] rounded-lg" />
              ))}
            </div>
          ) : attempts.length === 0 ? (
            <div className="rounded-lg border border-dashed border-gray-300 dark:border-white/15 p-5 text-center">
              <p className="text-sm font-semibold text-gray-800 dark:text-white">No training attempts yet</p>
              <p className="text-sm text-gray-500 dark:text-white/50 mt-1">Your scores, streaks, and facility rankings will appear here after your first scenario.</p>
              <Link to="/scenarios" className="nyx-button-metal inline-block px-4 py-2 rounded-lg text-sm font-semibold mt-3">Run your first scenario</Link>
            </div>
          ) : (
          <div className="grid sm:grid-cols-3 gap-4">
            <div className="rounded-lg border border-gray-200 dark:border-white/10 p-4">
              <div className="text-xs text-gray-500 dark:text-white/50">Attempts Logged</div>
              <div className="text-2xl font-bold text-gray-900 dark:text-white"><AnimatedStat value={progressSummary.totalAttempts} /></div>
            </div>
            <div className="rounded-lg border border-gray-200 dark:border-white/10 p-4">
              <div className="text-xs text-gray-500 dark:text-white/50">Average Score</div>
              <div className="text-2xl font-bold text-gray-900 dark:text-white"><AnimatedStat value={progressSummary.averageScore} suffix="%" /></div>
            </div>
            <div className="rounded-lg border border-gray-200 dark:border-white/10 p-4">
              <div className="text-xs text-gray-500 dark:text-white/50">Best Score</div>
              <div className="text-2xl font-bold text-gray-900 dark:text-white"><AnimatedStat value={progressSummary.bestScore} suffix="%" /></div>
            </div>
          </div>
          )}
          <div className="mt-4">
            <Link to="/reports" className="nyx-link text-sm">Open full training reports →</Link>
          </div>
        </div>

        <div className="grid md:grid-cols-2 gap-4 mb-8">
          <div className="bg-white dark:bg-white/5 rounded-xl shadow-sm p-6">
            <h2 className="text-xl font-bold text-gray-800 dark:text-white mb-3">Achievement Hub</h2>
            <div className="grid grid-cols-2 gap-3 mb-4">
              <div className="rounded-lg border border-gray-200 dark:border-white/10 p-3">
                <div className="text-xs text-gray-500 dark:text-white/50">Current Streak</div>
                <div className="text-xl font-bold text-gray-900 dark:text-white">{achievementSummary.streakDays} day{achievementSummary.streakDays === 1 ? '' : 's'}</div>
              </div>
              <div className="rounded-lg border border-gray-200 dark:border-white/10 p-3">
                <div className="text-xs text-gray-500 dark:text-white/50">Badges Unlocked</div>
                <div className="text-xl font-bold text-gray-900 dark:text-white">{achievementSummary.totalBadges}</div>
              </div>
            </div>
            <div className="flex flex-wrap gap-2">
              {achievementSummary.badges.length === 0 ? (
                <p className="text-sm text-gray-500 dark:text-white/50">Complete scenarios to unlock badges.</p>
              ) : (
                achievementSummary.badges.map((badge) => (
                  <span key={badge} className="rounded-full border border-amber-300 bg-amber-50 px-3 py-1 text-xs font-semibold text-amber-800">
                    {badge}
                  </span>
                ))
              )}
            </div>
          </div>

          <div className="bg-white dark:bg-white/5 rounded-xl shadow-sm p-6">
            <h2 className="text-xl font-bold text-gray-800 dark:text-white mb-3">Facility Leaderboard</h2>
            {leaderboard.length === 0 ? (
              <p className="text-sm text-gray-500 dark:text-white/50">No attempts logged yet. Start a scenario to rank facilities.</p>
            ) : (
              <div className="space-y-2">
                {leaderboard.map((entry, idx) => (
                  <div key={`${entry.facility}-${idx}`} className="rounded-lg border border-gray-200 dark:border-white/10 p-3 flex items-center justify-between">
                    <div>
                      <div className="text-sm font-semibold text-gray-900 dark:text-white">#{idx + 1} {entry.facility}</div>
                      <div className="text-xs text-gray-500 dark:text-white/50">{entry.attempts} attempt{entry.attempts === 1 ? '' : 's'}</div>
                    </div>
                    <div className="text-lg font-bold text-gray-900 dark:text-white">{entry.avgScore}%</div>
                  </div>
                ))}
              </div>
            )}
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
