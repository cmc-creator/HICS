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
  teamName?: string;
  assignedRole?: string;
  multiplierApplied?: number;
  branchOutcome?: 'critical' | 'recovering' | 'stable' | 'exemplary';
  earnedBadges?: string[];
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
  currentMultiplier?: number;
  correctStreak?: number;
  branchStability?: number;
  replayBoost?: number;
  teamName?: string;
  assignedRole?: string;
  teamAssignments?: Array<{ name: string; roleId: string }>;
  hintUsedCount?: number;
  revealUsedCount?: number;
  startedAt: number;
  savedAt: string;
}

export interface LearningMediaAsset {
  id: string;
  moduleId: string;
  title: string;
  sourceType: 'stream' | 'upload';
  videoUrl: string;
  posterUrl?: string;
  description?: string;
  durationSeconds?: number;
  mimeType?: string;
  bytes?: number;
  storageKey?: string;
  storageProvider?: string;
  facility: string;
  uploadedBy: string;
  createdAt: string;
}

export interface LiveDrillParticipant {
  name: string;
  roleId: string;
}

export interface LiveDrillEvent {
  at: string;
  message: string;
}

export interface LiveDrillSession {
  id: string;
  sessionCode: string;
  phaseIndex: number;
  running: boolean;
  elapsedSeconds: number;
  participants: LiveDrillParticipant[];
  events: LiveDrillEvent[];
  facility: string;
  updatedAt: string;
}

export interface RapidChallengeLeaderboardEntry {
  learnerName: string;
  learnerEmail: string;
  facility: string;
  bestScore: number;
  bestStreak: number;
  totalRounds: number;
  bestDurationSeconds: number;
  updatedAt: string;
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

export async function getLearningMediaAssets(moduleId?: string): Promise<LearningMediaAsset[]> {
  try {
    const query = moduleId ? `?moduleId=${encodeURIComponent(moduleId)}` : '';
    const response = await publicApiRequest<{ mediaAssets: LearningMediaAsset[] }>(`/training/media${query}`, { method: 'GET' });
    return Array.isArray(response?.mediaAssets) ? response.mediaAssets : [];
  } catch {
    return [];
  }
}

export async function uploadLearningMediaAsset(payload: {
  moduleId: string;
  title: string;
  sourceType: 'stream' | 'upload';
  videoUrl: string;
  posterUrl?: string;
  description?: string;
  durationSeconds?: number;
  mimeType?: string;
  bytes?: number;
  storageKey?: string;
  storageProvider?: string;
}): Promise<LearningMediaAsset | null> {
  try {
    const response = await publicApiRequest<{ mediaAsset: LearningMediaAsset }>('/training/media', {
      method: 'POST',
      body: JSON.stringify(payload),
    });
    return response?.mediaAsset ?? null;
  } catch {
    return null;
  }
}

export async function deleteLearningMediaAsset(id: string): Promise<boolean> {
  try {
    await publicApiRequest(`/training/media?id=${encodeURIComponent(id)}`, { method: 'DELETE' });
    return true;
  } catch {
    return false;
  }
}

export async function getLiveDrillSession(sessionCode: string): Promise<LiveDrillSession | null> {
  try {
    const response = await publicApiRequest<{ session: LiveDrillSession | null }>(`/training/live-drills?sessionCode=${encodeURIComponent(sessionCode)}`, {
      method: 'GET',
    });
    return response?.session ?? null;
  } catch {
    return null;
  }
}

export async function saveLiveDrillSession(payload: {
  sessionCode: string;
  phaseIndex: number;
  running: boolean;
  elapsedSeconds: number;
  participants: LiveDrillParticipant[];
  events: LiveDrillEvent[];
}): Promise<LiveDrillSession | null> {
  try {
    const response = await publicApiRequest<{ session: LiveDrillSession }>('/training/live-drills', {
      method: 'PUT',
      body: JSON.stringify(payload),
    });
    return response?.session ?? null;
  } catch {
    return null;
  }
}

export async function deleteLiveDrillSession(sessionCode: string): Promise<boolean> {
  try {
    await publicApiRequest(`/training/live-drills?sessionCode=${encodeURIComponent(sessionCode)}`, { method: 'DELETE' });
    return true;
  } catch {
    return false;
  }
}

export async function getRapidChallengeLeaderboard(): Promise<RapidChallengeLeaderboardEntry[]> {
  try {
    const response = await publicApiRequest<{ leaderboard: RapidChallengeLeaderboardEntry[] }>('/training/rapid-challenge', {
      method: 'GET',
    });
    return Array.isArray(response?.leaderboard) ? response.leaderboard : [];
  } catch {
    return [];
  }
}

export async function recordRapidChallengeScore(payload: {
  score: number;
  peakStreak: number;
  durationSeconds: number;
  totalQuestions: number;
  answered: number;
  learnerName?: string;
  learnerEmail?: string;
}): Promise<RapidChallengeLeaderboardEntry[]> {
  try {
    const response = await publicApiRequest<{ leaderboard: RapidChallengeLeaderboardEntry[] }>('/training/rapid-challenge', {
      method: 'POST',
      body: JSON.stringify(payload),
    });
    return Array.isArray(response?.leaderboard) ? response.leaderboard : [];
  } catch {
    return [];
  }
}
