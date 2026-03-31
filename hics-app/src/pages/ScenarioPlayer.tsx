import { useEffect, useRef, useState } from 'react';
import { useParams, Link, useSearchParams } from 'react-router-dom';
import { scenarios } from '../data/scenarios';
import type { ScenarioStep, ScenarioOption } from '../types';
import { adaptScenarioText, facilityLabels, normalizeFacility } from '../data/facilityProfiles';
import { recordScenarioAttempt, trackEvent } from '../lib/trainingAnalytics';

const FACILITATOR_KEY = 'nyx-facilitator-mode';
const TIMED_KEY = 'nyx-timed-mode';
const STEP_SECONDS_KEY = 'nyx-step-seconds';

const correctQuips = [
  'Nice call, command center energy activated.',
  'That was smoother than a fully stocked crash cart.',
  'Great decision, your clipboard just gained +5 charisma.',
];

const wrongQuips = [
  'Plot twist, but this is why we train.',
  'Not ideal, but your growth arc is strong.',
  'That one zigged when protocol wanted a zag.',
];

const timeoutQuips = [
  'Timer said no mercy, just like real surge ops.',
  'The clock sprinted, but you can still recover next step.',
];

export default function ScenarioPlayer() {
  const { id } = useParams<{ id: string }>();
  const [searchParams] = useSearchParams();
  const scenario = scenarios.find((s) => s.id === id);
  const selectedFacility = normalizeFacility(searchParams.get('facility'));
  const scenariosLink = selectedFacility === 'all' ? '/scenarios' : `/scenarios?facility=${selectedFacility}`;
  const facilityContextLabel = facilityLabels[selectedFacility];

  const [currentStepIndex, setCurrentStepIndex] = useState(0);
  const [selectedOption, setSelectedOption] = useState<ScenarioOption | null>(null);
  const [score, setScore] = useState(0);
  const [answers, setAnswers] = useState<Array<{ step: ScenarioStep; option: ScenarioOption }>>([]);
  const [completed, setCompleted] = useState(false);
  const [showHint, setShowHint] = useState(false);
  const [showCorrectReveal, setShowCorrectReveal] = useState(false);
  const [isPaused, setIsPaused] = useState(false);
  const [timeoutNotice, setTimeoutNotice] = useState<string | null>(null);
  const [momentQuip, setMomentQuip] = useState<string>('');

  const [facilitatorMode, setFacilitatorMode] = useState(() => localStorage.getItem(FACILITATOR_KEY) === 'true');
  const [timedMode, setTimedMode] = useState(() => localStorage.getItem(TIMED_KEY) === 'true');
  const [stepSeconds, setStepSeconds] = useState(() => {
    const stored = Number.parseInt(localStorage.getItem(STEP_SECONDS_KEY) ?? '90', 10);
    return Number.isFinite(stored) && stored > 0 ? stored : 90;
  });
  const [secondsLeft, setSecondsLeft] = useState(stepSeconds);

  const startedAtRef = useRef(0);
  const completionSavedRef = useRef(false);

  useEffect(() => {
    if (startedAtRef.current === 0) {
      startedAtRef.current = Date.now();
    }
  }, []);

  useEffect(() => {
    localStorage.setItem(FACILITATOR_KEY, String(facilitatorMode));
  }, [facilitatorMode]);

  useEffect(() => {
    localStorage.setItem(TIMED_KEY, String(timedMode));
  }, [timedMode]);

  useEffect(() => {
    localStorage.setItem(STEP_SECONDS_KEY, String(stepSeconds));
  }, [stepSeconds]);

  const adaptText = (text: string) => adaptScenarioText(text, selectedFacility);

  const currentStep = scenario?.steps[currentStepIndex];
  const safeCurrentStep = currentStep ?? {
    id: 'fallback-step',
    title: '',
    situation: '',
    question: '',
    options: [],
  };
  const adaptedStep = {
    ...safeCurrentStep,
    title: adaptText(safeCurrentStep.title),
    situation: adaptText(safeCurrentStep.situation),
    question: adaptText(safeCurrentStep.question),
    hint: safeCurrentStep.hint ? adaptText(safeCurrentStep.hint) : undefined,
    options: safeCurrentStep.options.map((option) => ({
      ...option,
      text: adaptText(option.text),
      feedback: adaptText(option.feedback),
    })),
  };

  const totalSteps = scenario?.steps.length ?? 1;
  const isLastStep = currentStepIndex === totalSteps - 1;
  const progress = ((currentStepIndex + (selectedOption ? 1 : 0)) / totalSteps) * 100;

  useEffect(() => {
    if (!scenario || !currentStep || !timedMode || selectedOption || completed || isPaused) {
      return;
    }

    const timer = window.setTimeout(() => {
      setSecondsLeft((prev) => {
        if (prev <= 1) {
          const timeoutOption: ScenarioOption = {
            id: `timeout-${currentStep.id}`,
            text: 'No response selected before timer expired.',
            isCorrect: false,
            feedback: 'Time expired for this step. In timed mode, rapid structured decisions matter.',
          };

          setSelectedOption(timeoutOption);
          setAnswers((existing) => [...existing, { step: currentStep, option: timeoutOption }]);
          setTimeoutNotice('Time expired on this step. Review rationale, then continue.');
          setMomentQuip(timeoutQuips[currentStepIndex % timeoutQuips.length]);
          trackEvent('scenario_step_timeout', {
            scenarioId: scenario.id,
            stepId: currentStep.id,
            facility: selectedFacility,
          });
          return 0;
        }

        return prev - 1;
      });
    }, 1000);

    return () => window.clearTimeout(timer);
  }, [scenario, timedMode, selectedOption, completed, isPaused, secondsLeft, currentStep, selectedFacility, currentStepIndex]);

  useEffect(() => {
    if (!completed || completionSavedRef.current) {
      return;
    }

    const elapsedSeconds = Math.max(1, Math.round((Date.now() - startedAtRef.current) / 1000));
    if (!scenario) {
      return;
    }

    const scorePercent = Math.round((score / scenario.steps.length) * 100);

    recordScenarioAttempt({
      scenarioId: scenario.id,
      scenarioTitle: scenario.title,
      facility: selectedFacility,
      correctAnswers: score,
      totalSteps: scenario.steps.length,
      scorePercent,
      timedMode,
      facilitatorMode,
      durationSeconds: elapsedSeconds,
    });

    trackEvent('scenario_completed', {
      scenarioId: scenario.id,
      scorePercent,
      facility: selectedFacility,
      timedMode,
      facilitatorMode,
    });

    completionSavedRef.current = true;
  }, [completed, score, scenario, selectedFacility, timedMode, facilitatorMode]);

  if (!scenario || !currentStep) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center nyx-panel p-8">
          <p className="text-gray-600 mb-4">Scenario not found.</p>
          <Link to={scenariosLink} className="text-blue-600 hover:underline">← Back to Scenarios</Link>
        </div>
      </div>
    );
  }

  const handleSelectOption = (option: ScenarioOption) => {
    if (selectedOption || isPaused) return;
    setSelectedOption(option);
    setTimeoutNotice(null);
    if (option.isCorrect) {
      setScore((s) => s + 1);
      setMomentQuip(correctQuips[currentStepIndex % correctQuips.length]);
    } else {
      setMomentQuip(wrongQuips[currentStepIndex % wrongQuips.length]);
    }
    setAnswers((prev) => [...prev, { step: currentStep, option }]);

    trackEvent('scenario_option_selected', {
      scenarioId: scenario.id,
      stepId: currentStep.id,
      optionId: option.id,
      isCorrect: option.isCorrect,
      facility: selectedFacility,
    });
  };

  const handleNext = () => {
    if (isLastStep) {
      setCompleted(true);
      return;
    }

    setCurrentStepIndex((idx) => idx + 1);
    setSelectedOption(null);
    setShowHint(false);
    setShowCorrectReveal(false);
    setTimeoutNotice(null);
    setSecondsLeft(stepSeconds);
    setMomentQuip('');
  };

  const handleRestart = () => {
    setCurrentStepIndex(0);
    setSelectedOption(null);
    setScore(0);
    setAnswers([]);
    setCompleted(false);
    setShowHint(false);
    setShowCorrectReveal(false);
    setTimeoutNotice(null);
    setIsPaused(false);
    setSecondsLeft(stepSeconds);
    setMomentQuip('');
    startedAtRef.current = Date.now();
    completionSavedRef.current = false;

    trackEvent('scenario_restarted', {
      scenarioId: scenario.id,
      facility: selectedFacility,
    });
  };

  const scorePercent = Math.round((score / scenario.steps.length) * 100);
  const completionNote =
    scorePercent >= 80
      ? 'Calm, clear, and command-ready. Your incident clipboard would be legendary.'
      : scorePercent >= 60
        ? 'Solid work. A quick refresher and you are even sharper for the next incident.'
        : 'Great practice run. Every replay builds faster, safer decision-making.';

  const correctOption = adaptedStep.options.find((option) => option.isCorrect);

  if (completed) {
    return (
      <div className="min-h-screen bg-gray-50">
        <div className="nyx-hero text-white py-6 px-4">
          <div className="max-w-4xl mx-auto">
            <Link to={scenariosLink} className="text-blue-300 hover:text-white text-sm mb-2 inline-block">
              ← Back to Scenarios
            </Link>
            <h1 className="text-2xl font-bold">{adaptText(scenario.title)}</h1>
            <p className="text-blue-200 text-xs mt-1">Facility Profile: {facilityContextLabel}</p>
          </div>
        </div>

        <div className="max-w-4xl mx-auto px-4 py-8">
          <div className="nyx-panel p-8 text-center mb-6 animate-fade-in">
            <div className="text-6xl mb-4">
              {scorePercent >= 80 ? '🏆' : scorePercent >= 60 ? '👍' : '📚'}
            </div>
            <h2 className="text-2xl font-bold text-gray-900 mb-2">Scenario Complete</h2>
            <div className="text-4xl font-bold mb-1" style={{
              color: scorePercent >= 80 ? '#059669' : scorePercent >= 60 ? '#d97706' : '#dc2626'
            }}>
              {scorePercent}%
            </div>
            <div className="text-gray-500 text-sm mb-4">
              {score} of {scenario.steps.length} decisions correct
            </div>
            <p className="text-sm text-gray-600 mb-4">{completionNote}</p>
            <div className={`inline-block px-4 py-1.5 rounded-full text-sm font-semibold ${
              scorePercent >= 80 ? 'bg-green-100 text-green-700' :
              scorePercent >= 60 ? 'bg-yellow-100 text-yellow-700' :
              'bg-red-100 text-red-700'
            }`}>
              {scorePercent >= 80 ? 'Excellent Performance' :
                scorePercent >= 60 ? 'Good, Review Missed Questions' :
                  'Needs Improvement, Study HICS Protocols'}
            </div>
          </div>

          <div className="space-y-4 mb-6">
            <h3 className="text-lg font-bold text-gray-800">Decision Review</h3>
            {answers.map(({ step, option }, i) => (
              <div
                key={i}
                className={`bg-white rounded-xl shadow-sm p-5 border-l-4 ${
                  option.isCorrect ? 'border-green-500' : 'border-red-500'
                }`}
              >
                <div className="flex items-start gap-3">
                  <span className="text-xl">{option.isCorrect ? '✅' : '❌'}</span>
                  <div>
                    <div className="font-semibold text-gray-900 text-sm mb-1">
                      Step {i + 1}: {adaptText(step.title)}
                    </div>
                    <div className="text-sm text-gray-600 mb-2">
                      <span className="font-medium">Your choice:</span> {adaptText(option.text)}
                    </div>
                    <div className={`text-sm p-3 rounded-lg ${
                      option.isCorrect ? 'bg-green-50 text-green-800' : 'bg-red-50 text-red-800'
                    }`}>
                      {adaptText(option.feedback)}
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>

          <div className="flex flex-wrap gap-3">
            <button
              onClick={handleRestart}
              className="nyx-button-metal px-5 py-2.5 rounded-lg font-semibold transition-colors"
            >
              Restart Scenario
            </button>
            <Link
              to={scenariosLink}
              className="border border-gray-300 text-gray-700 px-5 py-2.5 rounded-lg font-semibold hover:bg-gray-50 transition-colors"
            >
              All Scenarios
            </Link>
            <Link
              to="/reports"
              className="border border-blue-300 text-blue-700 px-5 py-2.5 rounded-lg font-semibold hover:bg-blue-50 transition-colors"
            >
              View Reports
            </Link>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="nyx-hero text-white py-4 px-4">
        <div className="max-w-4xl mx-auto">
          <Link to={scenariosLink} className="text-blue-300 hover:text-white text-sm mb-1 inline-block">
            ← Back to Scenarios
          </Link>
          <h1 className="text-xl font-bold">{adaptText(scenario.title)}</h1>
          <p className="text-blue-200 text-xs mt-1">Facility Profile: {facilityContextLabel}</p>
        </div>
      </div>

      <div className="nyx-panel border-b">
        <div className="max-w-4xl mx-auto px-4 py-3">
          <div className="flex items-center justify-between mb-1">
            <span className="text-sm font-medium text-gray-600">
              Step {currentStepIndex + 1} of {scenario.steps.length}
            </span>
            <div className="flex items-center gap-3 text-sm text-gray-500">
              <span>Score: {score}/{currentStepIndex + (selectedOption ? 1 : 0)}</span>
              {timedMode && <span className="font-semibold text-gray-700">Timer: {secondsLeft}s</span>}
            </div>
          </div>
          <div className="w-full bg-gray-200 rounded-full h-2">
            <div
              className="bg-blue-600 h-2 rounded-full transition-all duration-500"
              style={{ width: `${progress}%` }}
            />
          </div>
        </div>
      </div>

      <div className="max-w-4xl mx-auto px-4 py-6">
        <div className="nyx-panel p-4 mb-4">
          <div className="flex flex-wrap items-center gap-3">
            <button
              type="button"
              onClick={() => setFacilitatorMode((prev) => !prev)}
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold ${facilitatorMode ? 'bg-blue-600 text-slate-900' : 'bg-slate-100 text-slate-700'}`}
            >
              Facilitator Mode: {facilitatorMode ? 'On' : 'Off'}
            </button>
            <button
              type="button"
              onClick={() => setTimedMode((prev) => !prev)}
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold ${timedMode ? 'bg-blue-600 text-slate-900' : 'bg-slate-100 text-slate-700'}`}
            >
              Timed Mode: {timedMode ? 'On' : 'Off'}
            </button>
            {timedMode && (
              <select
                value={stepSeconds}
                onChange={(e) => {
                  const nextSeconds = Number.parseInt(e.target.value, 10);
                  setStepSeconds(nextSeconds);
                  setSecondsLeft(nextSeconds);
                }}
                className="border border-gray-300 rounded-lg px-2 py-1.5 text-xs bg-white text-gray-800"
              >
                <option value={60}>60s / step</option>
                <option value={90}>90s / step</option>
                <option value={120}>120s / step</option>
              </select>
            )}
            {facilitatorMode && (
              <button
                type="button"
                onClick={() => setIsPaused((prev) => !prev)}
                className="px-3 py-1.5 rounded-lg text-xs font-semibold bg-slate-100 text-slate-700"
              >
                {isPaused ? 'Resume' : 'Pause'}
              </button>
            )}
            {facilitatorMode && !selectedOption && correctOption && (
              <button
                type="button"
                onClick={() => setShowCorrectReveal((prev) => !prev)}
                className="px-3 py-1.5 rounded-lg text-xs font-semibold bg-slate-100 text-slate-700"
              >
                {showCorrectReveal ? 'Hide Correct Answer' : 'Reveal Correct Answer'}
              </button>
            )}
          </div>
          {showCorrectReveal && correctOption && (
            <div className="mt-3 p-3 rounded-lg bg-blue-50 border border-blue-200 text-sm text-blue-900">
              <div className="font-semibold mb-1">Facilitator Reveal</div>
              <div>{correctOption.text}</div>
            </div>
          )}
          {isPaused && (
            <div className="mt-3 p-3 rounded-lg bg-amber-50 border border-amber-200 text-sm text-amber-800">
              Training is paused. Resume to continue response decisions.
            </div>
          )}
        </div>

        <div className="nyx-hero text-white rounded-xl p-5 mb-4">
          <div className="text-xs text-blue-300 mb-1 font-medium uppercase tracking-wide">
            Step {currentStepIndex + 1} | {adaptedStep.title}
          </div>
          <h2 className="text-base font-semibold leading-relaxed">{adaptedStep.situation}</h2>
        </div>

        <div className="nyx-panel p-5 mb-4 animate-fade-in">
          <h3 className="font-bold text-gray-900 mb-4 text-base">{adaptedStep.question}</h3>

          {timeoutNotice && (
            <div className="mb-3 p-3 rounded-lg bg-red-50 border border-red-200 text-sm text-red-800">
              {timeoutNotice}
            </div>
          )}

          {momentQuip && (
            <div className="mb-3 p-3 text-sm text-gray-700 fun-callout">
              {momentQuip}
            </div>
          )}

          <div className="space-y-3">
            {adaptedStep.options.map((option) => {
              let optionStyle = 'border border-gray-200 hover:border-blue-300 hover:bg-blue-50';
              if (selectedOption) {
                if (option.isCorrect) {
                  optionStyle = 'border-2 border-green-500 bg-green-50';
                } else if (option.id === selectedOption.id && !option.isCorrect) {
                  optionStyle = 'border-2 border-red-500 bg-red-50';
                } else {
                  optionStyle = 'border border-gray-200 opacity-60';
                }
              }

              return (
                <button
                  key={option.id}
                  onClick={() => handleSelectOption(option)}
                  disabled={!!selectedOption || isPaused}
                  className={`w-full text-left p-4 rounded-lg transition-all ${optionStyle} ${(!!selectedOption || isPaused) ? 'cursor-default' : 'cursor-pointer'} ${selectedOption && option.isCorrect ? 'fx-pop-correct' : ''} ${selectedOption && option.id === selectedOption.id && !option.isCorrect ? 'fx-shake-wrong' : ''}`}
                >
                  <div className="flex items-start gap-3">
                    <div className={`w-6 h-6 rounded-full border-2 flex items-center justify-center flex-shrink-0 mt-0.5 ${
                      selectedOption
                        ? option.isCorrect
                          ? 'border-green-500 bg-green-500 text-white'
                          : option.id === selectedOption.id
                            ? 'border-red-500 bg-red-500 text-white'
                            : 'border-gray-300'
                        : 'border-gray-300'
                    }`}>
                      {selectedOption && option.isCorrect && '✓'}
                      {selectedOption && option.id === selectedOption.id && !option.isCorrect && '✗'}
                    </div>
                    <span className="text-sm text-gray-800">{option.text}</span>
                  </div>

                  {selectedOption && option.id === selectedOption.id && (
                    <div className={`mt-3 ml-9 text-sm p-3 rounded-lg ${
                      option.isCorrect ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'
                    }`}>
                      {option.feedback}
                    </div>
                  )}
                  {selectedOption && option.isCorrect && option.id !== selectedOption.id && (
                    <div className="mt-3 ml-9 text-sm p-3 rounded-lg bg-green-100 text-green-800">
                      {option.feedback}
                    </div>
                  )}
                </button>
              );
            })}
          </div>

          {adaptedStep.hint && !selectedOption && (
            <div className="mt-4">
              <button
                onClick={() => setShowHint((prev) => !prev)}
                className="text-sm text-blue-600 hover:text-blue-800 font-medium flex items-center gap-1"
              >
                Hint: {showHint ? 'Hide' : 'Show'}
              </button>
              {showHint && (
                <div className="mt-2 p-3 bg-yellow-50 border border-yellow-200 rounded-lg text-sm text-yellow-800">
                  {adaptedStep.hint}
                </div>
              )}
            </div>
          )}
        </div>

        {selectedOption && (
          <div className="flex justify-end">
            <button
              onClick={handleNext}
              className="nyx-button-metal px-6 py-2.5 rounded-lg font-semibold transition-colors"
            >
              {isLastStep ? 'View Results' : 'Next Step'}
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
