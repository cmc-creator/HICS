import type { FacilityType } from '../data/facilityProfiles';
import { publicApiRequest } from './apiClient';

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

export interface ScenarioProgressState {
  scenarioId: string;
  facility: FacilityType;
  currentStepIndex: number;
  score: number;
  answers: Array<{
    step: {
      id: string;
      title: string;
      situation: string;
      question: string;
      options: Array<{ id: string; text: string; isCorrect: boolean; feedback: string }>;
      hint?: string;
    };
    option: { id: string; text: string; isCorrect: boolean; feedback: string };
  }>;
  selectedOption: { id: string; text: string; isCorrect: boolean; feedback: string } | null;
  facilitatorMode: boolean;
  timedMode: boolean;
  stepSeconds: number;
  secondsLeft: number;
  startedAt: number;
  savedAt: string;
}

const ATTEMPTS_KEY = 'nyx-training-attempts';
const EVENTS_KEY = 'nyx-training-events';
const PROGRESS_PREFIX = 'nyx-scenario-progress:';

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

function getProgressStorageKey(key: string) {
  return `${PROGRESS_PREFIX}${key}`;
}

export function getScenarioAttemptsSync(): ScenarioAttempt[] {
  return readJson<ScenarioAttempt>(ATTEMPTS_KEY);
}

export async function getScenarioAttempts(): Promise<ScenarioAttempt[]> {
  try {
    const response = await publicApiRequest<{ attempts: ScenarioAttempt[] }>('/training/attempts', { method: 'GET' });
    const attempts = Array.isArray(response?.attempts) ? response.attempts : [];
    writeJson(ATTEMPTS_KEY, attempts);
    return attempts;
  } catch {
    return getScenarioAttemptsSync();
  }
}

export async function recordScenarioAttempt(attempt: Omit<ScenarioAttempt, 'id' | 'completedAt'> & { learnerEmail?: string; learnerName?: string }): Promise<ScenarioAttempt> {
  const entry: ScenarioAttempt = {
    ...attempt,
    id: `${attempt.scenarioId}-${Date.now()}-${Math.floor(Math.random() * 1000)}`,
    completedAt: new Date().toISOString(),
  };

  const attempts = getScenarioAttemptsSync();
  attempts.unshift(entry);
  writeJson(ATTEMPTS_KEY, attempts.slice(0, 500));

  try {
    const response = await publicApiRequest<{ attempt: ScenarioAttempt }>('/training/attempts', {
      method: 'POST',
      body: JSON.stringify(attempt),
    });
    return response?.attempt ?? entry;
  } catch {
    return entry;
  }
}

export async function clearScenarioAttempts() {
  localStorage.removeItem(ATTEMPTS_KEY);

  try {
    await publicApiRequest('/training/attempts', { method: 'DELETE' });
  } catch {
    // Local clear already completed.
  }
}

function summarizeEventCounts(events: TelemetryEvent[]) {
  const counts: Record<string, number> = {};

  for (const e of events) {
    counts[e.event] = (counts[e.event] ?? 0) + 1;
  }

  return Object.entries(counts)
    .map(([event, count]) => ({ event, count }))
    .sort((a, b) => b.count - a.count);
}

export function getEventCountsSync() {
  const events = readJson<TelemetryEvent>(EVENTS_KEY);
  return summarizeEventCounts(events);
}

export async function getEventCounts() {
  try {
    const response = await publicApiRequest<{ eventCounts: Array<{ event: string; count: number }> }>('/training/events', { method: 'GET' });
    return Array.isArray(response?.eventCounts) ? response.eventCounts : [];
  } catch {
    return getEventCountsSync();
  }
}

export async function clearEvents() {
  localStorage.removeItem(EVENTS_KEY);

  try {
    await publicApiRequest('/training/events', { method: 'DELETE' });
  } catch {
    // Local clear already completed.
  }
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

  void publicApiRequest('/training/events', {
    method: 'POST',
    body: JSON.stringify({ event, data }),
  }).catch(() => undefined);

  void publicApiRequest('/audit/logs', {
    method: 'POST',
    body: JSON.stringify({ action: event, data }),
  }).catch(() => undefined);
}

export async function saveScenarioProgress(key: string, progress: Omit<ScenarioProgressState, 'savedAt'>) {
  const payload: ScenarioProgressState = {
    ...progress,
    savedAt: new Date().toISOString(),
  };

  localStorage.setItem(getProgressStorageKey(key), JSON.stringify(payload));

  try {
    await publicApiRequest('/training/progress', {
      method: 'PUT',
      body: JSON.stringify({ key, progress: payload }),
    });
  } catch {
    // Local save already completed.
  }
}

export async function loadScenarioProgress(key: string): Promise<ScenarioProgressState | null> {
  try {
    const response = await publicApiRequest<{ progress: ScenarioProgressState | null }>(`/training/progress?key=${encodeURIComponent(key)}`, {
      method: 'GET',
    });
    if (response?.progress) {
      localStorage.setItem(getProgressStorageKey(key), JSON.stringify(response.progress));
      return response.progress;
    }
  } catch {
    // Fallback below.
  }

  try {
    const raw = localStorage.getItem(getProgressStorageKey(key));
    if (!raw) {
      return null;
    }
    return JSON.parse(raw) as ScenarioProgressState;
  } catch {
    return null;
  }
}

export async function clearScenarioProgress(key: string) {
  localStorage.removeItem(getProgressStorageKey(key));

  try {
    await publicApiRequest(`/training/progress?key=${encodeURIComponent(key)}`, { method: 'DELETE' });
  } catch {
    // Local clear already completed.
  }
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
