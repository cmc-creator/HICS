import { Link } from 'react-router-dom';
import { hicsRoles, hicsCategories } from '../data/roles';
import { scenarios } from '../data/scenarios';
import { quizQuestions } from '../data/quiz';
import { getScenarioAttempts, getTrainingSummary } from '../lib/trainingAnalytics';

const stats = [
  { label: 'HICS Roles', value: hicsRoles.length, icon: '👥', color: 'bg-blue-500' },
  { label: 'Training Scenarios', value: scenarios.length, icon: '🎯', color: 'bg-green-500' },
  { label: 'Quiz Questions', value: quizQuestions.length, icon: '📝', color: 'bg-purple-500' },
  { label: 'HICS Sections', value: 5, icon: '🏛️', color: 'bg-red-500' },
];

const quickLinks = [
  {
    path: '/roles',
    title: 'Explore HICS Roles',
    description: 'Learn about each position in the HICS organizational structure, including responsibilities and reporting relationships.',
    icon: '👥',
    color: 'border-blue-500',
    badge: 'Interactive Chart',
  },
  {
    path: '/scenarios',
    title: 'Training Scenarios',
    description: 'Practice responding to real-world hospital emergencies including mass casualty incidents, fires, and hazmat events.',
    icon: '🎯',
    color: 'border-green-500',
    badge: `${scenarios.length} Scenarios`,
  },
  {
    path: '/quiz',
    title: 'Knowledge Quiz',
    description: 'Test your HICS knowledge with scenario-based questions covering triage, protocols, and emergency management.',
    icon: '📝',
    color: 'border-purple-500',
    badge: `${quizQuestions.length} Questions`,
  },
  {
    path: '/chatbot',
    title: 'AI Training Assistant',
    description: 'Ask questions and get instant answers about HICS protocols, procedures, and best practices from our AI assistant.',
    icon: '🤖',
    color: 'border-orange-500',
    badge: '24/7 Available',
  },
  {
    path: '/reports',
    title: 'Training Reports',
    description: 'Review completion trends, score performance, and export facilitator-friendly training records.',
    icon: '📊',
    color: 'border-slate-500',
    badge: 'CSV Export',
  },
];

export default function Dashboard() {
  const progressSummary = getTrainingSummary(getScenarioAttempts());

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Hero Banner */}
      <div className="bg-gradient-to-r from-blue-900 to-blue-700 text-white py-12 px-4">
        <div className="max-w-7xl mx-auto">
          <div className="flex items-center gap-4 mb-4">
            <span className="text-5xl">🏥</span>
            <div>
              <h1 className="text-3xl font-bold">NyxHICSlab</h1>
              <p className="text-blue-200 text-lg">Luxury psychiatric incident command training by NyxCollective LLC</p>
            </div>
          </div>
          <p className="text-blue-100 max-w-2xl text-base leading-relaxed">
            Prepare behavioral health teams for real-world incidents with premium interactive scenarios, role-based training,
            and an AI assistant designed for psychiatric inpatient operations.
          </p>
          <div className="mt-6 flex flex-wrap gap-3">
            <Link
              to="/scenarios"
              className="bg-white text-blue-900 px-5 py-2.5 rounded-lg font-semibold hover:bg-blue-50 transition-colors"
            >
              Start Training →
            </Link>
            <Link
              to="/roles"
              className="border border-white text-white px-5 py-2.5 rounded-lg font-semibold hover:bg-blue-800 transition-colors"
            >
              Explore HICS Structure
            </Link>
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-4 py-8">
        {/* Stats Row */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8 motion-stagger">
          {stats.map((stat) => (
            <div key={stat.label} className="bg-white rounded-xl shadow-sm p-5 flex items-center gap-4 card-lift">
              <div className={`${stat.color} text-white rounded-lg p-3 text-2xl flex items-center justify-center w-12 h-12`}>
                {stat.icon}
              </div>
              <div>
                <div className="text-2xl font-bold text-gray-900">{stat.value}</div>
                <div className="text-sm text-gray-500">{stat.label}</div>
              </div>
            </div>
          ))}
        </div>

        {/* Quick Links Grid */}
        <h2 className="text-xl font-bold text-gray-800 mb-4">Platform Modules</h2>
        <div className="grid md:grid-cols-2 gap-4 mb-8 motion-stagger">
          {quickLinks.map((link) => (
            <Link
              key={link.path}
              to={link.path}
              className={`bg-white rounded-xl shadow-sm p-6 border-l-4 ${link.color} hover:shadow-md transition-all group card-lift`}
            >
              <div className="flex items-start justify-between mb-3">
                <span className="text-3xl">{link.icon}</span>
                <span className="text-xs bg-gray-100 text-gray-600 px-2 py-1 rounded-full font-medium">
                  {link.badge}
                </span>
              </div>
              <h3 className="text-lg font-bold text-gray-900 mb-2 group-hover:text-blue-700 transition-colors">
                {link.title}
              </h3>
              <p className="text-gray-600 text-sm leading-relaxed">{link.description}</p>
            </Link>
          ))}
        </div>

        {/* HICS Overview */}
        <div className="bg-white rounded-xl shadow-sm p-6 mb-8">
          <h2 className="text-xl font-bold text-gray-800 mb-4">NyxHICSlab Command Structure Overview</h2>
          <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
            {hicsCategories.map((cat) => {
              const roles = hicsRoles.filter((r) => r.category === cat.id);
              return (
                <div key={cat.id} className="rounded-lg p-3 border-t-4" style={{ borderColor: cat.color, backgroundColor: `${cat.color}10` }}>
                  <div className="text-xs font-bold mb-2 text-gray-700">{cat.label}</div>
                  <div className="space-y-1">
                    {roles.map((role) => (
                      <div key={role.id} className="text-xs text-gray-600 flex items-center gap-1">
                        <div className="w-1.5 h-1.5 rounded-full flex-shrink-0" style={{ backgroundColor: role.color }} />
                        {role.abbreviation}
                      </div>
                    ))}
                  </div>
                </div>
              );
            })}
          </div>
          <div className="mt-4">
            <Link to="/roles" className="text-blue-600 hover:text-blue-800 text-sm font-medium">
              View full interactive org chart →
            </Link>
          </div>
        </div>

        <div className="bg-white rounded-xl shadow-sm p-6 mb-8">
          <h2 className="text-xl font-bold text-gray-800 mb-4">Learner Progress Snapshot</h2>
          <div className="grid sm:grid-cols-3 gap-4">
            <div className="rounded-lg border border-gray-200 p-4">
              <div className="text-xs text-gray-500">Attempts Logged</div>
              <div className="text-2xl font-bold text-gray-900">{progressSummary.totalAttempts}</div>
            </div>
            <div className="rounded-lg border border-gray-200 p-4">
              <div className="text-xs text-gray-500">Average Score</div>
              <div className="text-2xl font-bold text-gray-900">{progressSummary.averageScore}%</div>
            </div>
            <div className="rounded-lg border border-gray-200 p-4">
              <div className="text-xs text-gray-500">Best Score</div>
              <div className="text-2xl font-bold text-gray-900">{progressSummary.bestScore}%</div>
            </div>
          </div>
          <div className="mt-4">
            <Link to="/reports" className="text-blue-600 hover:text-blue-800 text-sm font-medium">
              Open full training reports →
            </Link>
          </div>
        </div>

        {/* Emergency Types */}
        <div className="bg-white rounded-xl shadow-sm p-6">
          <h2 className="text-xl font-bold text-gray-800 mb-4">Available Emergency Scenarios</h2>
          <div className="grid md:grid-cols-2 gap-3 motion-stagger">
            {scenarios.map((scenario) => (
              <Link
                key={scenario.id}
                to={`/scenarios/${scenario.id}`}
                className="flex items-center gap-4 p-4 rounded-lg border hover:border-blue-300 hover:bg-blue-50 transition-colors group card-lift"
              >
                <div className="text-2xl">
                  {scenario.type === 'Mass Casualty' ? '🚑' :
                   scenario.type === 'Fire/Evacuation' ? '🔥' :
                   scenario.type === 'HazMat' ? '☢️' : '💻'}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="font-semibold text-gray-900 group-hover:text-blue-700 transition-colors text-sm">
                    {scenario.title}
                  </div>
                  <div className="text-xs text-gray-500 mt-0.5">
                    {scenario.difficulty} • {scenario.duration} • {scenario.steps.length} steps
                  </div>
                </div>
                <span className={`text-xs px-2 py-1 rounded-full font-medium ${
                  scenario.difficulty === 'beginner' ? 'bg-green-100 text-green-700' :
                  scenario.difficulty === 'intermediate' ? 'bg-yellow-100 text-yellow-700' :
                  'bg-red-100 text-red-700'
                }`}>
                  {scenario.difficulty}
                </span>
              </Link>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
