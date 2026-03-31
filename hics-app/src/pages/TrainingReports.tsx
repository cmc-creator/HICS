import { useMemo, useState } from 'react';
import {
  clearEvents,
  clearScenarioAttempts,
  exportAttemptsCsv,
  getEventCounts,
  getScenarioAttempts,
  getTrainingSummary,
  type ScenarioAttempt,
} from '../lib/trainingAnalytics';

export default function TrainingReports() {
  const [attempts, setAttempts] = useState<ScenarioAttempt[]>(() => getScenarioAttempts());
  const [eventCounts, setEventCounts] = useState<Array<{ event: string; count: number }>>(() => getEventCounts());

  const reload = () => {
    setAttempts(getScenarioAttempts());
    setEventCounts(getEventCounts());
  };

  const summary = useMemo(() => getTrainingSummary(attempts), [attempts]);

  const handleExportCsv = () => {
    const csv = exportAttemptsCsv(attempts);
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `nyxhicslab-training-report-${new Date().toISOString().slice(0, 10)}.csv`;
    link.click();
    URL.revokeObjectURL(url);
  };

  const handleClear = () => {
    clearScenarioAttempts();
    clearEvents();
    reload();
  };

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="nyx-hero text-white py-6 px-4">
        <div className="max-w-7xl mx-auto">
          <h1 className="text-2xl font-bold">Training Reports</h1>
          <p className="text-blue-200 text-sm mt-1">Local performance, engagement, and export tools for facilitators</p>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-4 py-6 space-y-6">
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <div className="nyx-panel p-4">
            <div className="text-xs text-gray-500">Total Attempts</div>
            <div className="text-2xl font-bold text-gray-900">{summary.totalAttempts}</div>
          </div>
          <div className="nyx-panel p-4">
            <div className="text-xs text-gray-500">Unique Scenarios</div>
            <div className="text-2xl font-bold text-gray-900">{summary.uniqueScenarios}</div>
          </div>
          <div className="nyx-panel p-4">
            <div className="text-xs text-gray-500">Average Score</div>
            <div className="text-2xl font-bold text-gray-900">{summary.averageScore}%</div>
          </div>
          <div className="nyx-panel p-4">
            <div className="text-xs text-gray-500">Best Score</div>
            <div className="text-2xl font-bold text-gray-900">{summary.bestScore}%</div>
          </div>
        </div>

        <div className="nyx-panel p-4">
          <div className="flex flex-wrap items-center justify-between gap-3 mb-4">
            <h2 className="text-lg font-bold text-gray-900">Attempts</h2>
            <div className="flex gap-2">
              <button
                type="button"
                onClick={handleExportCsv}
                className="nyx-button-metal px-4 py-2 rounded-lg text-sm font-semibold"
                disabled={attempts.length === 0}
              >
                Export CSV
              </button>
              <button
                type="button"
                onClick={handleClear}
                className="border border-red-300 text-red-700 px-4 py-2 rounded-lg text-sm font-semibold hover:bg-red-50"
                disabled={attempts.length === 0 && eventCounts.length === 0}
              >
                Clear Data
              </button>
            </div>
          </div>

          {attempts.length === 0 ? (
            <p className="text-sm text-gray-500">No completed scenario attempts yet.</p>
          ) : (
            <div className="overflow-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="text-left border-b border-gray-200 text-gray-600">
                    <th className="py-2 pr-4">Completed</th>
                    <th className="py-2 pr-4">Scenario</th>
                    <th className="py-2 pr-4">Facility</th>
                    <th className="py-2 pr-4">Score</th>
                    <th className="py-2 pr-4">Timed</th>
                    <th className="py-2 pr-4">Facilitator</th>
                    <th className="py-2 pr-4">Duration</th>
                  </tr>
                </thead>
                <tbody>
                  {attempts.slice(0, 50).map((attempt) => (
                    <tr key={attempt.id} className="border-b border-gray-100 text-gray-800">
                      <td className="py-2 pr-4">{new Date(attempt.completedAt).toLocaleString()}</td>
                      <td className="py-2 pr-4">{attempt.scenarioTitle}</td>
                      <td className="py-2 pr-4">{attempt.facility}</td>
                      <td className="py-2 pr-4 font-semibold">{attempt.scorePercent}%</td>
                      <td className="py-2 pr-4">{attempt.timedMode ? 'Yes' : 'No'}</td>
                      <td className="py-2 pr-4">{attempt.facilitatorMode ? 'Yes' : 'No'}</td>
                      <td className="py-2 pr-4">{Math.round(attempt.durationSeconds / 60)} min</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>

        <div className="nyx-panel p-4">
          <h2 className="text-lg font-bold text-gray-900 mb-3">Telemetry Events</h2>
          {eventCounts.length === 0 ? (
            <p className="text-sm text-gray-500">No telemetry events captured yet.</p>
          ) : (
            <div className="grid sm:grid-cols-2 md:grid-cols-3 gap-3">
              {eventCounts.slice(0, 9).map((event) => (
                <div key={event.event} className="rounded-lg border border-gray-200 p-3">
                  <div className="text-xs text-gray-500">Event</div>
                  <div className="font-semibold text-sm text-gray-900">{event.event}</div>
                  <div className="text-xs text-gray-600 mt-1">Count: {event.count}</div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
