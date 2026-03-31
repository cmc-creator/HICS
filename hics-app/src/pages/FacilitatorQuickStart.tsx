import { Link } from 'react-router-dom';

const checklist = [
  'Choose facility profile and scenario playlist before group starts.',
  'Turn on Facilitator Mode for pause and answer reveal controls.',
  'Optional: enable Timed Mode to simulate operational pressure.',
  'Run 1-2 scenarios, then debrief using Decision Review.',
  'Open Reports and export CSV for attendance/performance records.',
];

const debriefPrompts = [
  'What was your first signal to escalate command activation?',
  'Which communication action reduced confusion fastest?',
  'Where did staffing, safety, or logistics create decision friction?',
  'What policy or checklist should we update before next drill?',
];

export default function FacilitatorQuickStart() {
  return (
    <div className="min-h-screen bg-gray-50">
      <div className="nyx-hero text-white py-6 px-4">
        <div className="max-w-5xl mx-auto">
          <h1 className="text-2xl font-bold">Facilitator Quick Start</h1>
          <p className="text-blue-200 text-sm mt-1">Run a high-quality drill in under 10 minutes of setup</p>
        </div>
      </div>

      <div className="max-w-5xl mx-auto px-4 py-6 space-y-6">
        <div className="nyx-panel p-5">
          <h2 className="text-lg font-bold text-gray-900 mb-3">Session Setup Checklist</h2>
          <ol className="space-y-2 text-sm text-gray-700">
            {checklist.map((item, index) => (
              <li key={item} className="flex gap-2">
                <span className="font-semibold text-blue-700">{index + 1}.</span>
                <span>{item}</span>
              </li>
            ))}
          </ol>
          <div className="mt-4 flex flex-wrap gap-2">
            <Link to="/scenarios" className="nyx-button-metal px-4 py-2 rounded-lg text-sm font-semibold">
              Open Scenarios
            </Link>
            <Link to="/reports" className="border border-gray-300 text-gray-700 px-4 py-2 rounded-lg text-sm font-semibold hover:bg-gray-50">
              Open Reports
            </Link>
          </div>
        </div>

        <div className="grid md:grid-cols-2 gap-4">
          <div className="nyx-panel p-5">
            <h2 className="text-lg font-bold text-gray-900 mb-3">Suggested 30-Minute Flow</h2>
            <div className="space-y-3 text-sm text-gray-700">
              <p><span className="font-semibold">0-5 min:</span> orient team, assign observer and scribe.</p>
              <p><span className="font-semibold">5-18 min:</span> run primary scenario with facilitator controls.</p>
              <p><span className="font-semibold">18-24 min:</span> debrief key decisions and communication points.</p>
              <p><span className="font-semibold">24-30 min:</span> run one rapid replay step or timed challenge.</p>
            </div>
          </div>

          <div className="nyx-panel p-5">
            <h2 className="text-lg font-bold text-gray-900 mb-3">Debrief Prompt Bank</h2>
            <ul className="space-y-2 text-sm text-gray-700">
              {debriefPrompts.map((prompt) => (
                <li key={prompt} className="flex gap-2">
                  <span className="text-blue-600">•</span>
                  <span>{prompt}</span>
                </li>
              ))}
            </ul>
          </div>
        </div>

        <div className="nyx-panel p-5">
          <h2 className="text-lg font-bold text-gray-900 mb-3">Facilitator Notes</h2>
          <p className="text-sm text-gray-700 leading-relaxed">
            Keep humor supportive, not distracting. Use timed mode after baseline confidence is established. If a group is mixed
            experience, run one beginner scenario first, then switch to intermediate with pause-and-discuss enabled.
          </p>
        </div>
      </div>
    </div>
  );
}
