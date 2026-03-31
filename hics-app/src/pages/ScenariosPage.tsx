import { Link } from 'react-router-dom';
import { scenarios } from '../data/scenarios';

const difficultyColors = {
  beginner: 'bg-green-100 text-green-700',
  intermediate: 'bg-yellow-100 text-yellow-700',
  advanced: 'bg-red-100 text-red-700',
};

const typeIcons: Record<string, string> = {
  'Mass Casualty': '🚑',
  'Fire/Evacuation': '🔥',
  'HazMat': '☢️',
  'Infrastructure': '💻',
  'Weather': '🌪️',
  'Utilities': '🔌',
  'Pediatric Surge': '🧸',
  'Public Health': '🧪',
  'Logistics': '📦',
  'Throughput': '🚪',
  'Behavioral Health': '🧠',
  'Safety': '🛡️',
  'Medication Safety': '💊',
};

export default function ScenariosPage() {
  return (
    <div className="min-h-screen bg-gray-50">
      <div className="bg-blue-900 text-white py-6 px-4">
        <div className="max-w-7xl mx-auto">
          <h1 className="text-2xl font-bold">Training Scenarios</h1>
          <p className="text-blue-200 text-sm mt-1">
            Practice psychiatric inpatient response with interactive choices, practical feedback, and a little personality
          </p>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-4 py-6">
        <div className="grid md:grid-cols-2 gap-6">
          {scenarios.map((scenario) => (
            <div key={scenario.id} className="bg-white rounded-xl shadow-sm overflow-hidden">
              <div className="bg-gradient-to-r from-blue-800 to-blue-600 text-white p-5">
                <div className="flex items-start justify-between">
                  <div>
                    <div className="flex items-center gap-2 mb-2">
                      <span className="text-2xl">{typeIcons[scenario.type] || '⚠️'}</span>
                      <span className="text-xs bg-white/20 px-2 py-0.5 rounded-full">
                        {scenario.type}
                      </span>
                    </div>
                    <h2 className="text-xl font-bold">{scenario.title}</h2>
                  </div>
                  <span className={`text-xs px-2 py-1 rounded-full font-medium ${difficultyColors[scenario.difficulty]}`}>
                    {scenario.difficulty}
                  </span>
                </div>
              </div>

              <div className="p-5">
                <p className="text-gray-600 text-sm mb-4 leading-relaxed">{scenario.description}</p>

                <div className="mb-4">
                  <h3 className="text-sm font-bold text-gray-800 mb-2">Learning Objectives:</h3>
                  <ul className="space-y-1">
                    {scenario.objectives.slice(0, 3).map((obj, i) => (
                      <li key={i} className="flex items-start gap-2 text-xs text-gray-600">
                        <span className="text-blue-500 mt-0.5 flex-shrink-0">•</span>
                        {obj}
                      </li>
                    ))}
                    {scenario.objectives.length > 3 && (
                      <li className="text-xs text-gray-400 italic">
                        +{scenario.objectives.length - 3} more objectives...
                      </li>
                    )}
                  </ul>
                </div>

                <div className="flex items-center justify-between pt-4 border-t">
                  <div className="flex gap-4 text-xs text-gray-500">
                    <span>⏱️ {scenario.duration}</span>
                    <span>📋 {scenario.steps.length} steps</span>
                  </div>
                  <Link
                    to={`/scenarios/${scenario.id}`}
                    className="bg-blue-600 text-white px-4 py-2 rounded-lg text-sm font-semibold hover:bg-blue-700 transition-colors"
                  >
                    Start Scenario →
                  </Link>
                </div>
              </div>
            </div>
          ))}
        </div>

        {/* Info Banner */}
        <div className="mt-6 bg-blue-50 border border-blue-200 rounded-xl p-5">
          <div className="flex items-start gap-3">
            <span className="text-2xl">💡</span>
            <div>
              <h3 className="font-bold text-blue-900">About These Scenarios</h3>
              <p className="text-blue-700 text-sm mt-1">
                These scenarios are based on real-world hospital emergency events and are designed to help you
                practice HICS activation, decision-making, and coordination. Each scenario presents realistic
                situations with multiple choice decisions, including psychiatric inpatient operations such as elopement risk, behavioral escalation, and medication safety events. Learn from both correct and incorrect responses, and expect the occasional morale-boosting line.
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
