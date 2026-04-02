import { useEffect, useMemo, useState } from 'react';
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
import { useAuth } from '../lib/authContext';
import { publicApiRequest } from '../lib/apiClient';
import { writeAuditLog } from '../lib/notifications';

interface AuditLogEntry {
  id: string;
  action: string;
  at: string;
  data?: Record<string, string | number | boolean>;
}

function downloadCertificate(userName: string, attempt: ScenarioAttempt) {
  const certificateHtml = `<!doctype html>
<html>
<head>
  <meta charset="utf-8" />
  <title>NyxHICSlab Certificate</title>
  <style>
    body { font-family: Georgia, serif; background: #f5f1e8; margin: 0; padding: 32px; }
    .sheet { max-width: 900px; margin: 0 auto; background: #fffdf7; border: 10px solid #baa06a; padding: 42px; }
    .muted { color: #6f5b32; letter-spacing: 0.18em; font-size: 11px; text-transform: uppercase; }
    h1 { margin: 8px 0; font-size: 44px; color: #2d2211; }
    h2 { margin: 8px 0 20px; font-size: 22px; color: #4a3a1c; }
    .name { font-size: 34px; margin: 28px 0 10px; color: #2c2111; font-weight: bold; }
    .meta { margin-top: 20px; font-size: 15px; color: #3f341f; }
    .score { display: inline-block; margin-top: 16px; padding: 10px 16px; border-radius: 999px; background: #ede3cb; color: #352a16; font-weight: 700; }
  </style>
</head>
<body>
  <div class="sheet">
    <div class="muted">NyxCollective LLC · NyxHICSlab</div>
    <h1>Certificate of Completion</h1>
    <h2>Hospital Incident Command Simulation Training</h2>
    <p>This certifies that</p>
    <div class="name">${userName}</div>
    <p>successfully completed the scenario:</p>
    <h2>${attempt.scenarioTitle}</h2>
    <div class="score">Score: ${attempt.scorePercent}%</div>
    <div class="meta">
      Facility: ${attempt.facility}<br/>
      Completed: ${new Date(attempt.completedAt).toLocaleString()}<br/>
      Duration: ${Math.round(attempt.durationSeconds / 60)} minutes
    </div>
  </div>
</body>
</html>`;

  const printWindow = window.open('', '_blank', 'width=1100,height=850');
  if (!printWindow) {
    return;
  }

  printWindow.document.open();
  printWindow.document.write(certificateHtml);
  printWindow.document.close();
  printWindow.focus();
  printWindow.print();
}

export default function TrainingReports() {
  const { facility, canManageData, canExportReports } = useTenant();
  const { user } = useAuth();
  const [attempts, setAttempts] = useState<ScenarioAttempt[]>([]);
  const [eventCounts, setEventCounts] = useState<Array<{ event: string; count: number }>>([]);
  const [auditLogs, setAuditLogs] = useState<AuditLogEntry[]>([]);
  const [loading, setLoading] = useState(true);

  const reload = async () => {
    setLoading(true);
    const [nextAttempts, nextEvents] = await Promise.all([getScenarioAttempts(), getEventCounts()]);
    setAttempts(nextAttempts);
    setEventCounts(nextEvents);

    try {
      const response = await publicApiRequest<{ logs: AuditLogEntry[] }>('/audit/logs', { method: 'GET' });
      setAuditLogs(Array.isArray(response?.logs) ? response.logs : []);
    } catch {
      setAuditLogs([]);
    }

    setLoading(false);
  };

  useEffect(() => {
    void reload();
  }, []);

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

  const handleExportCsv = async () => {
    const csv = exportAttemptsCsv(scopedAttempts);
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `nyxhicslab-training-report-${new Date().toISOString().slice(0, 10)}.csv`;
    link.click();
    URL.revokeObjectURL(url);
    await writeAuditLog('report_csv_exported', { facility, rows: scopedAttempts.length });
  };

  const handleClear = async () => {
    await Promise.all([clearScenarioAttempts(), clearEvents()]);
    await writeAuditLog('report_data_cleared', { facility });
    await reload();
  };

  const handleCertificate = async () => {
    if (scopedAttempts.length === 0) {
      return;
    }

    const bestAttempt = [...scopedAttempts].sort((a, b) => b.scorePercent - a.scorePercent)[0];
    downloadCertificate(user?.fullName ?? 'HICS Learner', bestAttempt);
    await writeAuditLog('certificate_generated', {
      scenarioId: bestAttempt.scenarioId,
      scorePercent: bestAttempt.scorePercent,
    });
  };

  return (
    <div className="min-h-screen bg-gray-50 lux-page">
      <div className="nyx-hero text-white py-6 px-4 relative overflow-hidden">
        <div className="lux-grid-pattern" />
        <div className="max-w-7xl mx-auto">
          <div className="lux-hero-shell">
            <h1 className="text-2xl font-bold lux-title">Training Reports</h1>
            <p className="text-blue-200 text-sm mt-1 lux-subtitle">Server-backed performance, audit logs, export tools, and completion certificates</p>
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-4 py-6 space-y-6">
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <div className="nyx-panel report-stat-card p-4">
            <div className="text-xs text-gray-500 dark:text-white/50">Total Attempts</div>
            <div className="text-2xl font-bold text-gray-900 dark:text-white">{summary.totalAttempts}</div>
          </div>
          <div className="nyx-panel report-stat-card p-4">
            <div className="text-xs text-gray-500 dark:text-white/50">Unique Scenarios</div>
            <div className="text-2xl font-bold text-gray-900 dark:text-white">{summary.uniqueScenarios}</div>
          </div>
          <div className="nyx-panel report-stat-card p-4">
            <div className="text-xs text-gray-500 dark:text-white/50">Average Score</div>
            <div className="text-2xl font-bold text-gray-900 dark:text-white">{summary.averageScore}%</div>
          </div>
          <div className="nyx-panel report-stat-card p-4">
            <div className="text-xs text-gray-500 dark:text-white/50">Best Score</div>
            <div className="text-2xl font-bold text-gray-900 dark:text-white">{summary.bestScore}%</div>
          </div>
        </div>

        <div className="nyx-panel p-4">
          <div className="flex flex-wrap items-center justify-between gap-3 mb-4">
            <h2 className="text-lg font-bold text-gray-900 dark:text-white">Attempts</h2>
            <div className="flex flex-wrap gap-2">
              <button
                type="button"
                onClick={() => void handleExportCsv()}
                className="nyx-button-metal px-4 py-2 rounded-lg text-sm font-semibold"
                disabled={scopedAttempts.length === 0 || !canExportReports}
              >
                Export CSV
              </button>
              <button
                type="button"
                onClick={() => void handleCertificate()}
                className="border border-amber-300 text-amber-800 dark:text-amber-300 px-4 py-2 rounded-lg text-sm font-semibold hover:bg-amber-50 dark:hover:bg-amber-900/20"
                disabled={scopedAttempts.length === 0}
              >
                Completion Certificate
              </button>
              <button
                type="button"
                onClick={() => void handleClear()}
                className="border border-red-300 text-red-700 px-4 py-2 rounded-lg text-sm font-semibold hover:bg-red-50"
                disabled={(attempts.length === 0 && eventCounts.length === 0) || !canManageData}
              >
                Clear Data
              </button>
            </div>
          </div>

          <p className="text-xs text-gray-500 dark:text-white/50 mb-3">
            Scope: {facilityLabels[facility as FacilityType]}{facility !== 'all' ? ' (facility-filtered view)' : ' (enterprise view)'}
          </p>

          {loading ? (
            <p className="text-sm text-gray-500 dark:text-white/50">Loading reports...</p>
          ) : scopedAttempts.length === 0 ? (
            <p className="text-sm text-gray-500 dark:text-white/50">No completed scenario attempts yet.</p>
          ) : (
            <div className="overflow-auto report-table-shell">
              <table className="w-full text-sm">
                <thead>
                  <tr className="text-left border-b border-gray-200 text-gray-600 dark:text-white/60">
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
                    <tr key={attempt.id} className="border-b border-gray-100 text-gray-800 dark:text-white/80 hover:bg-white/40 dark:hover:bg-white/5 transition-colors">
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
          <h2 className="text-lg font-bold text-gray-900 dark:text-white mb-3">Telemetry Events</h2>
          {scopedEvents.length === 0 ? (
            <p className="text-sm text-gray-500 dark:text-white/50">No telemetry events captured yet.</p>
          ) : (
            <div className="grid sm:grid-cols-2 md:grid-cols-3 gap-3">
              {scopedEvents.slice(0, 9).map((event) => (
                <div key={event.event} className="rounded-lg border border-gray-200 dark:border-white/10 p-3 report-event-card">
                  <div className="text-xs text-gray-500 dark:text-white/50">Event</div>
                  <div className="font-semibold text-sm text-gray-900 dark:text-white">{event.event}</div>
                  <div className="text-xs text-gray-600 dark:text-white/60 mt-1">Count: {event.count}</div>
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="nyx-panel p-4">
          <h2 className="text-lg font-bold text-gray-900 dark:text-white mb-3">Audit Log</h2>
          {auditLogs.length === 0 ? (
            <p className="text-sm text-gray-500 dark:text-white/50">No audit events yet.</p>
          ) : (
            <div className="space-y-2">
              {auditLogs.slice(0, 10).map((log) => (
                <div key={log.id} className="rounded-lg border border-gray-200 dark:border-white/10 p-3 bg-white/70 dark:bg-white/5">
                  <div className="text-xs text-gray-500 dark:text-white/50">{new Date(log.at).toLocaleString()}</div>
                  <div className="text-sm font-semibold text-gray-900 dark:text-white">{log.action}</div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
