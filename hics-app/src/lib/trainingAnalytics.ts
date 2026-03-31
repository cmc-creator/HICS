import type { FacilityType } from '../data/facilityProfiles';

export interface ScenarioAttempt {
  id: string;
  scenarioId: string;
  scenarioTitle: string;
  facility: FacilityType;
  correctAnswers: number;
  totalSteps: number;
  scorePercent: number;
  timedMode: boolean;
  facilitatorMode: boolean;
  durationSeconds: number;
  completedAt: string;
}

interface TelemetryEvent {
  id: string;
  event: string;
  at: string;
  data?: Record<string, string | number | boolean>;
}

const ATTEMPTS_KEY = 'nyx-training-attempts';
const EVENTS_KEY = 'nyx-training-events';

function readJson<T>(key: string): T[] {
  try {
    const raw = localStorage.getItem(key);
    if (!raw) {
      return [];
    }

    const parsed = JSON.parse(raw) as T[];
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function writeJson<T>(key: string, value: T[]) {
  localStorage.setItem(key, JSON.stringify(value));
}

export function getScenarioAttempts(): ScenarioAttempt[] {
  return readJson<ScenarioAttempt>(ATTEMPTS_KEY);
}

export function recordScenarioAttempt(attempt: Omit<ScenarioAttempt, 'id' | 'completedAt'>): ScenarioAttempt {
  const entry: ScenarioAttempt = {
    ...attempt,
    id: `${attempt.scenarioId}-${Date.now()}-${Math.floor(Math.random() * 1000)}`,
    completedAt: new Date().toISOString(),
  };

  const attempts = getScenarioAttempts();
  attempts.unshift(entry);
  writeJson(ATTEMPTS_KEY, attempts.slice(0, 500));
  return entry;
}

export function clearScenarioAttempts() {
  localStorage.removeItem(ATTEMPTS_KEY);
}

export function exportAttemptsCsv(attempts: ScenarioAttempt[]): string {
  const header = [
    'completedAt',
    'scenarioTitle',
    'facility',
    'scorePercent',
    'correctAnswers',
    'totalSteps',
    'timedMode',
    'facilitatorMode',
    'durationSeconds',
  ];

  const rows = attempts.map((a) => [
    a.completedAt,
    a.scenarioTitle,
    a.facility,
    a.scorePercent.toString(),
    a.correctAnswers.toString(),
    a.totalSteps.toString(),
    a.timedMode ? 'yes' : 'no',
    a.facilitatorMode ? 'yes' : 'no',
    a.durationSeconds.toString(),
  ]);

  return [header, ...rows]
    .map((line) => line.map((item) => `"${item.replace(/"/g, '""')}"`).join(','))
    .join('\n');
}

export function getTrainingSummary(attempts: ScenarioAttempt[]) {
  const totalAttempts = attempts.length;
  const uniqueScenarios = new Set(attempts.map((a) => a.scenarioId)).size;
  const averageScore =
    totalAttempts === 0
      ? 0
      : Math.round(attempts.reduce((sum, a) => sum + a.scorePercent, 0) / totalAttempts);

  const bestScore = totalAttempts === 0 ? 0 : Math.max(...attempts.map((a) => a.scorePercent));

  return {
    totalAttempts,
    uniqueScenarios,
    averageScore,
    bestScore,
  };
}

export function trackEvent(event: string, data?: Record<string, string | number | boolean>) {
  const events = readJson<TelemetryEvent>(EVENTS_KEY);
  const entry: TelemetryEvent = {
    id: `${event}-${Date.now()}-${Math.floor(Math.random() * 1000)}`,
    event,
    at: new Date().toISOString(),
    data,
  };

  events.unshift(entry);
  writeJson(EVENTS_KEY, events.slice(0, 1000));
}

export function getEventCounts() {
  const events = readJson<TelemetryEvent>(EVENTS_KEY);
  const counts: Record<string, number> = {};

  for (const e of events) {
    counts[e.event] = (counts[e.event] ?? 0) + 1;
  }

  return Object.entries(counts)
    .map(([event, count]) => ({ event, count }))
    .sort((a, b) => b.count - a.count);
}

export function clearEvents() {
  localStorage.removeItem(EVENTS_KEY);
}
