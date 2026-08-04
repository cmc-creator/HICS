import { useEffect, useMemo, useState } from 'react';
import { quizQuestions } from '../data/quiz';
import { useAuth } from '../lib/authContext';
import {
  getRapidChallengeLeaderboard,
  recordRapidChallengeScore,
  type RapidChallengeLeaderboardEntry,
} from '../lib/trainingAnalytics';

const ROUND_SECONDS = 75;
const ROUND_SIZE = 10;

function shuffle<T>(items: T[]): T[] {
  const copy = [...items];
  for (let i = copy.length - 1; i > 0; i -= 1) {
    const j = Math.floor(Math.random() * (i + 1));
    [copy[i], copy[j]] = [copy[j], copy[i]];
  }
  return copy;
}

export default function RapidChallengePage() {
  const { user } = useAuth();
  const [seed, setSeed] = useState(1);
  const [activeIndex, setActiveIndex] = useState(0);
  const [score, setScore] = useState(0);
  const [streak, setStreak] = useState(0);
  const [peakStreak, setPeakStreak] = useState(0);
  const [selected, setSelected] = useState<number | null>(null);
  const [startedAt, setStartedAt] = useState<number>(() => Date.now());
  const [now, setNow] = useState<number>(() => Date.now());
  const [leaderboard, setLeaderboard] = useState<RapidChallengeLeaderboardEntry[]>([]);
  const [submittedRound, setSubmittedRound] = useState(false);

  const roundQuestions = useMemo(() => shuffle(quizQuestions).slice(0, ROUND_SIZE), [seed]);
  const question = roundQuestions[activeIndex];

  const elapsed = Math.floor((now - startedAt) / 1000);
  const remaining = Math.max(0, ROUND_SECONDS - elapsed);
  const timeUp = remaining === 0;
  const complete = timeUp || activeIndex >= roundQuestions.length;
  const answered = Math.min(ROUND_SIZE, activeIndex + (selected !== null ? 1 : 0));

  useEffect(() => {
    if (complete || remaining <= 0) {
      return;
    }

    const timer = window.setInterval(() => {
      setNow(Date.now());
    }, 400);

    return () => window.clearInterval(timer);
  }, [complete, remaining]);

  useEffect(() => {
    let cancelled = false;
    void getRapidChallengeLeaderboard().then((rows) => {
      if (!cancelled) {
        setLeaderboard(rows);
      }
    });

    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    if (!complete || submittedRound) {
      return;
    }

    setSubmittedRound(true);
    void recordRapidChallengeScore({
      score,
      peakStreak,
      durationSeconds: Math.max(1, elapsed),
      totalQuestions: ROUND_SIZE,
      answered,
      learnerName: user?.fullName,
      learnerEmail: user?.email,
    }).then((rows) => {
      if (rows.length > 0) {
        setLeaderboard(rows);
      }
    });
  }, [complete, submittedRound, score, peakStreak, elapsed, answered, user]);

  const answer = (optionIndex: number) => {
    if (!question || selected !== null || timeUp) {
      return;
    }

    setSelected(optionIndex);

    const correct = optionIndex === question.correctAnswer;
    if (correct) {
      setStreak((prev) => {
        const nextStreak = prev + 1;
        setPeakStreak((best) => Math.max(best, nextStreak));
        const multiplier = nextStreak >= 4 ? 2 : 1;
        setScore((current) => current + 100 * multiplier);
        return nextStreak;
      });
    } else {
      setStreak(0);
    }
  };

  const next = () => {
    if (activeIndex >= roundQuestions.length - 1) {
      setActiveIndex(roundQuestions.length);
      return;
    }

    setActiveIndex((idx) => idx + 1);
    setSelected(null);
  };

  const restart = () => {
    setSeed((s) => s + 1);
    setActiveIndex(0);
    setScore(0);
    setStreak(0);
    setPeakStreak(0);
    setSelected(null);
    setStartedAt(Date.now());
    setNow(Date.now());
    setSubmittedRound(false);
  };

  return (
    <div className="min-h-screen bg-gray-50 px-4 py-8">
      <div className="max-w-5xl mx-auto">
        <div className="nyx-panel p-6 mb-5">
          <p className="text-xs tracking-[0.16em] uppercase text-gray-500">Mini Game</p>
          <h1 className="text-2xl font-bold text-gray-900 mt-2">Rapid Triage Challenge</h1>
          <p className="text-sm text-gray-600 mt-2">
            Answer as many high-pressure command questions as possible before time expires. Build streaks to trigger score multipliers.
          </p>
          <div className="mt-4 grid sm:grid-cols-4 gap-3 text-sm">
            <div className="rounded-lg border border-gray-200 bg-white p-3"><strong>Time Left:</strong> {remaining}s</div>
            <div className="rounded-lg border border-gray-200 bg-white p-3"><strong>Score:</strong> {score}</div>
            <div className="rounded-lg border border-gray-200 bg-white p-3"><strong>Streak:</strong> {streak}</div>
            <div className="rounded-lg border border-gray-200 bg-white p-3"><strong>Question:</strong> {Math.min(activeIndex + 1, ROUND_SIZE)}/{ROUND_SIZE}</div>
          </div>
        </div>

        {!complete && question ? (
          <div className="nyx-panel p-6">
            <p className="text-xs text-gray-500">{question.category}</p>
            <h2 className="text-xl font-bold text-gray-900 mt-1">{question.question}</h2>
            <div className="mt-4 space-y-2">
              {question.options.map((option, idx) => {
                const isSelected = selected === idx;
                const isCorrect = idx === question.correctAnswer;
                const className = selected === null
                  ? 'border-gray-200 hover:border-blue-300 hover:bg-blue-50'
                  : isCorrect
                    ? 'border-green-400 bg-green-50'
                    : isSelected
                      ? 'border-red-400 bg-red-50'
                      : 'border-gray-200 opacity-80';

                return (
                  <button
                    type="button"
                    key={`${question.id}-${option}`}
                    disabled={selected !== null}
                    onClick={() => answer(idx)}
                    className={`w-full text-left rounded-lg border px-4 py-3 transition ${className}`}
                  >
                    {option}
                  </button>
                );
              })}
            </div>

            {selected !== null && (
              <div className="mt-4 rounded-lg border border-gray-200 bg-gray-50 p-4">
                <p className="text-sm text-gray-700">{question.explanation}</p>
                <button
                  type="button"
                  onClick={next}
                  className="mt-3 rounded-lg bg-blue-600 px-4 py-2 text-sm font-semibold text-white hover:bg-blue-700"
                >
                  Next Question
                </button>
              </div>
            )}
          </div>
        ) : (
          <div className="nyx-panel p-6 text-center">
            <h2 className="text-2xl font-bold text-gray-900">Round Complete</h2>
            <p className="text-gray-600 mt-2">Final score: <strong>{score}</strong></p>
            <p className="text-gray-600">Peak streak: <strong>{peakStreak}</strong></p>
            <p className="text-gray-600">Answered: <strong>{answered}</strong> / {ROUND_SIZE}</p>
            <button
              type="button"
              onClick={restart}
              className="mt-4 rounded-lg bg-blue-600 px-5 py-2.5 text-sm font-semibold text-white hover:bg-blue-700"
            >
              Play Another Round
            </button>

            <div className="mt-6 text-left">
              <h3 className="text-lg font-bold text-gray-900">Facility Leaderboard</h3>
              <div className="mt-3 space-y-2">
                {leaderboard.length === 0 ? (
                  <p className="text-sm text-gray-500">No leaderboard entries yet.</p>
                ) : (
                  leaderboard.map((entry, idx) => (
                    <div key={`${entry.learnerEmail}-${idx}`} className="rounded-lg border border-gray-200 bg-white p-3 flex items-center justify-between">
                      <div>
                        <p className="text-sm font-semibold text-gray-900">#{idx + 1} {entry.learnerName}</p>
                        <p className="text-[11px] text-gray-500">{entry.facility} · {entry.totalRounds} round{entry.totalRounds === 1 ? '' : 's'}</p>
                      </div>
                      <div className="text-right">
                        <p className="text-sm font-bold text-gray-900">{entry.bestScore}</p>
                        <p className="text-[11px] text-gray-500">Streak {entry.bestStreak}</p>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
