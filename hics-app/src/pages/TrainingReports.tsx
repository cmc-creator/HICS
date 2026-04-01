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
import { facilityLabels, type FacilityType } from '../data/facilityProfiles';
import { useTenant } from '../lib/tenantContext';

export default function TrainingReports() {
  const { facility, canManageData, canExportReports } = useTenant();
  const [attempts, setAttempts] = useState<ScenarioAttempt[]>(() => getScenarioAttempts());
  const [eventCounts, setEventCounts] = useState<Array<{ event: string; count: number }>>(() => getEventCounts());

  const reload = () => {
    setAttempts(getScenarioAttempts());
    setEventCounts(getEventCounts());
  };

  const scopedAttempts = useMemo(
    () => (facility === 'all' ? attempts : attempts.filter((attempt) => attempt.facility === facility)),
    [attempts, facility],
  );

  const scopedEvents = useMemo(() => {
    if (facility === 'all') {
      return eventCounts;
    }

    return eventCounts.filter((event) => {
      if (!event.event.includes(':')) {
        return true;
      }

      const [, eventFacility] = event.event.split(':');
      return eventFacility === facility;
    });
  }, [eventCounts, facility]);

  const summary = useMemo(() => getTrainingSummary(scopedAttempts), [scopedAttempts]);

  const handleExportCsv = () => {
    const csv = exportAttemptsCsv(scopedAttempts);
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
    <div className="min-h-screen bg-gray-50 lux-page">
      <div className="nyx-hero text-white py-6 px-4 relative overflow-hidden">
        <div className="lux-grid-pattern" />
        <div className="max-w-7xl mx-auto">
          <div className="lux-hero-shell">
            <h1 className="text-2xl font-bold lux-title">Training Reports</h1>
            <p className="text-blue-200 text-sm mt-1 lux-subtitle">Local performance, engagement, and export tools for facilitators</p>
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-4 py-6 space-y-6">
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <div className="nyx-panel report-stat-card p-4">
            <div className="text-xs text-gray-500">Total Attempts</div>
            <div className="text-2xl font-bold text-gray-900">{summary.totalAttempts}</div>
          </div>
          <div className="nyx-panel report-stat-card p-4">
            <div className="text-xs text-gray-500">Unique Scenarios</div>
            <div className="text-2xl font-bold text-gray-900">{summary.uniqueScenarios}</div>
          </div>
          <div className="nyx-panel report-stat-card p-4">
            <div className="text-xs text-gray-500">Average Score</div>
            <div className="text-2xl font-bold text-gray-900">{summary.averageScore}%</div>
          </div>
          <div className="nyx-panel report-stat-card p-4">
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
                disabled={scopedAttempts.length === 0 || !canExportReports}
              >
                Export CSV
              </button>
              <button
                type="button"
                onClick={handleClear}
                className="border border-red-300 text-red-700 px-4 py-2 rounded-lg text-sm font-semibold hover:bg-red-50"
                disabled={(attempts.length === 0 && eventCounts.length === 0) || !canManageData}
              >
                Clear Data
              </button>
            </div>
          </div>

          <p className="text-xs text-gray-500 mb-3">
            Scope: {facilityLabels[facility as FacilityType]}{facility !== 'all' ? ' (facility-filtered view)' : ' (enterprise view)'}
          </p>

          {scopedAttempts.length === 0 ? (
            <p className="text-sm text-gray-500">No completed scenario attempts yet.</p>
          ) : (
            <div className="overflow-auto report-table-shell">
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
                  {scopedAttempts.slice(0, 50).map((attempt) => (
                    <tr key={attempt.id} className="border-b border-gray-100 text-gray-800 hover:bg-white/40 transition-colors">
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
          {scopedEvents.length === 0 ? (
            <p className="text-sm text-gray-500">No telemetry events captured yet.</p>
          ) : (
            <div className="grid sm:grid-cols-2 md:grid-cols-3 gap-3">
              {scopedEvents.slice(0, 9).map((event) => (
                <div key={event.event} className="rounded-lg border border-gray-200 p-3 report-event-card">
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
