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
import { getAchievementSummary, getFacilityLeaderboard } from '../lib/gamification';
import {
  branchOutcomeLabel,
  printAfterActionReport,
  printCertificate,
} from '../lib/printDocuments';
import { writeAuditLog } from '../lib/notifications';
import { useToast } from '../lib/toast';

interface AuditLogEntry {
  id: string;
  action: string;
  at: string;
  data?: Record<string, string | number | boolean>;
}

export default function TrainingReports() {
  const { facility, canManageData, canExportReports } = useTenant();
  const toast = useToast();
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
  const achievements = useMemo(() => getAchievementSummary(scopedAttempts), [scopedAttempts]);
  const leaderboard = useMemo(() => getFacilityLeaderboard(attempts), [attempts]);

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
    toast.success(`CSV exported - ${scopedAttempts.length} attempt${scopedAttempts.length === 1 ? '' : 's'} included.`);
  };

  const handleClear = async () => {
    await Promise.all([clearScenarioAttempts(), clearEvents()]);
    await writeAuditLog('report_data_cleared', { facility });
    await reload();
    toast.info('Training data cleared for this view.');
  };

  const handleCertificate = async () => {
    if (scopedAttempts.length === 0) {
      return;
    }

    const bestAttempt = [...scopedAttempts].sort((a, b) => b.scorePercent - a.scorePercent)[0];
    printCertificate({
      recipientName: user?.fullName ?? 'HICS Learner',
      scenarioTitle: bestAttempt.scenarioTitle,
      facility: bestAttempt.facility,
      scorePercent: bestAttempt.scorePercent,
      completedAt: bestAttempt.completedAt,
      durationSeconds: bestAttempt.durationSeconds,
    });
    toast.success('Certificate downloaded.');
    await writeAuditLog('certificate_generated', {
      scenarioId: bestAttempt.scenarioId,
      scorePercent: bestAttempt.scorePercent,
    });
  };

  const handleAttemptAar = async (attempt: ScenarioAttempt) => {
    const missed = Math.max(0, attempt.totalSteps - attempt.correctAnswers);
    const strengths: string[] = [
      `${attempt.correctAnswers} of ${attempt.totalSteps} decisions matched the recommended action.`,
    ];
    if (attempt.branchOutcome) {
      strengths.push(`The run finished with a ${branchOutcomeLabel(attempt.branchOutcome).toLowerCase()} branch outcome.`);
    }
    if (attempt.earnedBadges && attempt.earnedBadges.length > 0) {
      strengths.push(`Badges earned: ${attempt.earnedBadges.join(', ')}.`);
    }
    if (attempt.scorePercent >= 80) {
      strengths.push('Final score landed in the excellent band (80% or higher).');
    }

    const improvements: string[] = [];
    if (missed > 0) {
      improvements.push(
        `${missed} decision${missed === 1 ? '' : 's'} did not match the recommended action. Re-run the scenario and use the Decision Review on the completion screen to walk through each missed step.`,
      );
    }
    if (attempt.branchOutcome === 'critical' || attempt.branchOutcome === 'recovering') {
      improvements.push(
        'The simulated incident ended short of a stable state - prioritize earlier escalation and command coordination decisions in the next run.',
      );
    }
    if (attempt.scorePercent < 60) {
      improvements.push(
        'The final score fell below the 60% readiness band - a facilitator-led review of this scenario is recommended before the next independent run.',
      );
    }
    if (missed === 0) {
      improvements.push(
        attempt.timedMode
          ? 'No missed decisions were recorded in this run. Keep building readiness with the replay branch challenge for a harder path.'
          : 'No missed decisions were recorded in this run. Keep building readiness by re-running in timed mode or with the replay branch challenge.',
      );
    }

    printAfterActionReport({
      documentLabel: 'Scenario After-Action Report',
      exerciseTitle: attempt.scenarioTitle,
      facility: attempt.facility,
      organization: attempt.organization,
      exerciseAt: attempt.completedAt,
      teamName: attempt.teamName,
      participants: attempt.learnerName
        ? [{ name: attempt.learnerName, role: attempt.assignedRole ?? 'Participant' }]
        : [],
      modeLine: `${attempt.facilitatorMode ? 'Facilitator-led' : 'Self-paced'} · Timed mode ${attempt.timedMode ? 'on' : 'off'}`,
      durationSeconds: attempt.durationSeconds,
      scorePercent: attempt.scorePercent,
      correctAnswers: attempt.correctAnswers,
      totalSteps: attempt.totalSteps,
      branchOutcome: attempt.branchOutcome,
      multiplierApplied: attempt.multiplierApplied,
      earnedBadges: attempt.earnedBadges,
      strengths,
      improvements,
      notesLines: true,
    });
    toast.success('After-Action Report opened for printing.');
    await writeAuditLog('after_action_report_generated', {
      scenarioId: attempt.scenarioId,
      scorePercent: attempt.scorePercent,
    });
  };

  return (
    <div className="min-h-screen bg-gray-50 lux-page">
      <div className="max-w-7xl mx-auto px-4 pt-6">
        <div className="page-head">
          <h1 className="text-xl md:text-2xl font-bold lux-title">Training Reports</h1>
          <p className="page-head-sub text-sm mt-1 lux-subtitle">Server-backed performance, audit logs, export tools, and completion certificates</p>
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
              <table className="w-full min-w-[720px] text-sm">
                <thead>
                  <tr className="text-left border-b border-gray-200 text-gray-600 dark:text-white/60">
                    <th className="py-2 pr-4">Completed</th>
                    <th className="py-2 pr-4">Scenario</th>
                    <th className="py-2 pr-4">Facility</th>
                    <th className="py-2 pr-4">Score</th>
                    <th className="py-2 pr-4">Timed</th>
                    <th className="py-2 pr-4 hidden md:table-cell">Facilitator</th>
                    <th className="py-2 pr-4 hidden md:table-cell">Duration</th>
                    <th className="py-2 pr-4">Report</th>
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
                      <td className="py-2 pr-4 hidden md:table-cell">{attempt.facilitatorMode ? 'Yes' : 'No'}</td>
                      <td className="py-2 pr-4 hidden md:table-cell">{Math.round(attempt.durationSeconds / 60)} min</td>
                      <td className="py-2 pr-4">
                        <button
                          type="button"
                          onClick={() => void handleAttemptAar(attempt)}
                          className="border border-[#6a5578]/50 text-[#5f4390] dark:border-[#a392bc]/50 dark:text-[#d3c2f0] px-3 py-1.5 rounded-lg text-xs font-semibold hover:bg-[#6a5578]/10 dark:hover:bg-white/10"
                          aria-label={`After-Action Report for ${attempt.scenarioTitle} completed ${new Date(attempt.completedAt).toLocaleString()}`}
                        >
                          AAR
                        </button>
                      </td>
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

        <div className="grid md:grid-cols-2 gap-4">
          <div className="nyx-panel p-4">
            <h2 className="text-lg font-bold text-gray-900 dark:text-white mb-3">Achievement Snapshot</h2>
            <div className="grid grid-cols-2 gap-3 mb-3">
              <div className="rounded-lg border border-gray-200 dark:border-white/10 p-3">
                <div className="text-xs text-gray-500 dark:text-white/50">Streak</div>
                <div className="text-xl font-bold text-gray-900 dark:text-white">{achievements.streakDays} day{achievements.streakDays === 1 ? '' : 's'}</div>
              </div>
              <div className="rounded-lg border border-gray-200 dark:border-white/10 p-3">
                <div className="text-xs text-gray-500 dark:text-white/50">Badges</div>
                <div className="text-xl font-bold text-gray-900 dark:text-white">{achievements.totalBadges}</div>
              </div>
            </div>
            <div className="flex flex-wrap gap-2">
              {achievements.badges.length === 0 ? (
                <p className="text-sm text-gray-500 dark:text-white/50">Complete scenarios to unlock badges.</p>
              ) : (
                achievements.badges.map((badge) => (
                  <span key={badge} className="rounded-full border border-amber-300 bg-amber-50 px-3 py-1 text-xs font-semibold text-amber-800">
                    {badge}
                  </span>
                ))
              )}
            </div>
          </div>

          <div className="nyx-panel p-4">
            <h2 className="text-lg font-bold text-gray-900 dark:text-white mb-3">Facility Leaderboard</h2>
            {leaderboard.length === 0 ? (
              <p className="text-sm text-gray-500 dark:text-white/50">Not enough attempts to rank facilities yet.</p>
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
