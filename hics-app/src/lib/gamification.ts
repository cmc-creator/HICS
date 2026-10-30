import type { ScenarioAttempt } from './trainingAnalytics';

export interface AdaptiveDifficultyProfile {
  recommended: 'beginner' | 'intermediate' | 'advanced';
  confidence: number;
  rationale: string;
}

export interface AchievementSummary {
  streakDays: number;
  totalBadges: number;
  badges: string[];
}

export interface FacilityLeaderboardEntry {
  facility: string;
  avgScore: number;
  attempts: number;
}

function uniqueDaysFromAttempts(attempts: ScenarioAttempt[]) {
  return new Set(
    attempts.map((attempt) => new Date(attempt.completedAt).toISOString().slice(0, 10)),
  );
}

export function getAchievementSummary(attempts: ScenarioAttempt[]): AchievementSummary {
  const badges = new Set<string>();

  const scored = attempts.filter((attempt) => Number.isFinite(attempt.scorePercent));
  const avgScore = scored.length
    ? Math.round(scored.reduce((sum, attempt) => sum + attempt.scorePercent, 0) / scored.length)
    : 0;

  const days = [...uniqueDaysFromAttempts(attempts)].sort((a, b) => b.localeCompare(a));
  let streakDays = 0;
  if (days.length > 0) {
    const cursor = new Date(days[0]);
    for (const day of days) {
      const current = new Date(day);
      if (current.toISOString().slice(0, 10) !== cursor.toISOString().slice(0, 10)) {
        break;
      }
      streakDays += 1;
      cursor.setUTCDate(cursor.getUTCDate() - 1);
    }
  }

  if (attempts.length >= 1) badges.add('First Action Taken');
  if (attempts.length >= 5) badges.add('Command Operator');
  if (attempts.length >= 15) badges.add('Drill Veteran');
  if (avgScore >= 80) badges.add('Protocol Pro');
  if (avgScore >= 92) badges.add('Gold Standard');
  if (streakDays >= 3) badges.add('3-Day Streak');
  if (streakDays >= 7) badges.add('7-Day Streak');

  for (const attempt of attempts) {
    if (attempt.scorePercent === 100) {
      badges.add('Perfect Run');
    }
    if ((attempt.multiplierApplied ?? 1) >= 1.8) {
      badges.add('Multiplier Master');
    }
    if (attempt.branchOutcome === 'exemplary') {
      badges.add('Exemplary Outcome');
    }
    for (const badge of attempt.earnedBadges ?? []) {
      badges.add(badge);
    }
  }

  return {
    streakDays,
    totalBadges: badges.size,
    badges: [...badges].slice(0, 10),
  };
}

export function getFacilityLeaderboard(attempts: ScenarioAttempt[]): FacilityLeaderboardEntry[] {
  const grouped = new Map<string, { total: number; count: number }>();

  for (const attempt of attempts) {
    const key = attempt.facility || 'unknown';
    const current = grouped.get(key) ?? { total: 0, count: 0 };
    current.total += Number.isFinite(attempt.scorePercent) ? attempt.scorePercent : 0;
    current.count += 1;
    grouped.set(key, current);
  }

  return [...grouped.entries()]
    .map(([facility, values]) => ({
      facility,
      attempts: values.count,
      avgScore: values.count ? Math.round(values.total / values.count) : 0,
    }))
    .sort((a, b) => b.avgScore - a.avgScore || b.attempts - a.attempts)
    .slice(0, 5);
}

export function getAdaptiveDifficultyProfile(attempts: ScenarioAttempt[]): AdaptiveDifficultyProfile {
  const recent = [...attempts]
    .sort((a, b) => new Date(b.completedAt).getTime() - new Date(a.completedAt).getTime())
    .slice(0, 8);

  if (recent.length === 0) {
    return {
      recommended: 'beginner',
      confidence: 0.2,
      rationale: 'Start with beginner scenarios to establish baseline confidence.',
    };
  }

  const avgScore = Math.round(recent.reduce((sum, attempt) => sum + attempt.scorePercent, 0) / recent.length);
  const highMultiplierRuns = recent.filter((attempt) => (attempt.multiplierApplied ?? 1) >= 1.5).length;

  if (avgScore >= 88 && highMultiplierRuns >= 2) {
    return {
      recommended: 'advanced',
      confidence: 0.9,
      rationale: 'High recent scores and multiplier consistency indicate readiness for advanced pressure scenarios.',
    };
  }

  if (avgScore >= 70) {
    return {
      recommended: 'intermediate',
      confidence: 0.75,
      rationale: 'Solid consistency suggests intermediate scenarios will improve decision speed and complexity handling.',
    };
  }

  return {
    recommended: 'beginner',
    confidence: 0.8,
    rationale: 'Use beginner scenarios to reinforce core protocol patterns before escalating difficulty.',
  };
}
