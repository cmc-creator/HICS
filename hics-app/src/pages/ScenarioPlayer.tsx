import { useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import { scenarios } from '../data/scenarios';
import type { ScenarioStep, ScenarioOption } from '../types';

export default function ScenarioPlayer() {
  const { id } = useParams<{ id: string }>();
  const scenario = scenarios.find((s) => s.id === id);

  const [currentStepIndex, setCurrentStepIndex] = useState(0);
  const [selectedOption, setSelectedOption] = useState<ScenarioOption | null>(null);
  const [score, setScore] = useState(0);
  const [answers, setAnswers] = useState<Array<{ step: ScenarioStep; option: ScenarioOption }>>([]);
  const [completed, setCompleted] = useState(false);
  const [showHint, setShowHint] = useState(false);

  if (!scenario) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <p className="text-gray-600 mb-4">Scenario not found.</p>
          <Link to="/scenarios" className="text-blue-600 hover:underline">← Back to Scenarios</Link>
        </div>
      </div>
    );
  }

  const currentStep = scenario.steps[currentStepIndex];
  const isLastStep = currentStepIndex === scenario.steps.length - 1;
  const progress = ((currentStepIndex + (selectedOption ? 1 : 0)) / scenario.steps.length) * 100;

  const handleSelectOption = (option: ScenarioOption) => {
    if (selectedOption) return;
    setSelectedOption(option);
    if (option.isCorrect) {
      setScore((s) => s + 1);
    }
    setAnswers((prev) => [...prev, { step: currentStep, option }]);
  };

  const handleNext = () => {
    if (isLastStep) {
      setCompleted(true);
    } else {
      const nextStepIndex = currentStepIndex + 1;
      setCurrentStepIndex(nextStepIndex);
      setSelectedOption(null);
      setShowHint(false);
    }
  };

  const handleRestart = () => {
    setCurrentStepIndex(0);
    setSelectedOption(null);
    setScore(0);
    setAnswers([]);
    setCompleted(false);
    setShowHint(false);
  };

  const scorePercent = Math.round((score / scenario.steps.length) * 100);
  const completionNote =
    scorePercent >= 80
      ? 'Calm, clear, and command-ready. Your incident clipboard would be legendary.'
      : scorePercent >= 60
        ? 'Solid work. A quick refresher and you are even sharper for the next incident.'
        : 'Great practice run. Every replay builds faster, safer decision-making.';

  if (completed) {
    return (
      <div className="min-h-screen bg-gray-50">
        <div className="bg-blue-900 text-white py-6 px-4">
          <div className="max-w-4xl mx-auto">
            <Link to="/scenarios" className="text-blue-300 hover:text-white text-sm mb-2 inline-block">
              ← Back to Scenarios
            </Link>
            <h1 className="text-2xl font-bold">{scenario.title}</h1>
          </div>
        </div>

        <div className="max-w-4xl mx-auto px-4 py-8">
          {/* Score Card */}
          <div className="bg-white rounded-xl shadow-sm p-8 text-center mb-6">
            <div className="text-6xl mb-4">
              {scorePercent >= 80 ? '🏆' : scorePercent >= 60 ? '👍' : '📚'}
            </div>
            <h2 className="text-2xl font-bold text-gray-900 mb-2">Scenario Complete!</h2>
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
               scorePercent >= 60 ? 'Good – Review Missed Questions' :
               'Needs Improvement – Study HICS Protocols'}
            </div>
          </div>

          {/* Answer Review */}
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
                      Step {i + 1}: {step.title}
                    </div>
                    <div className="text-sm text-gray-600 mb-2">
                      <span className="font-medium">Your choice:</span> {option.text}
                    </div>
                    <div className={`text-sm p-3 rounded-lg ${
                      option.isCorrect ? 'bg-green-50 text-green-800' : 'bg-red-50 text-red-800'
                    }`}>
                      {option.feedback}
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>

          {/* Actions */}
          <div className="flex flex-wrap gap-3">
            <button
              onClick={handleRestart}
              className="bg-blue-600 text-white px-5 py-2.5 rounded-lg font-semibold hover:bg-blue-700 transition-colors"
            >
              🔄 Try Again
            </button>
            <Link
              to="/scenarios"
              className="border border-gray-300 text-gray-700 px-5 py-2.5 rounded-lg font-semibold hover:bg-gray-50 transition-colors"
            >
              ← All Scenarios
            </Link>
            <Link
              to="/quiz"
              className="border border-blue-300 text-blue-700 px-5 py-2.5 rounded-lg font-semibold hover:bg-blue-50 transition-colors"
            >
              📝 Take the Quiz
            </Link>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <div className="bg-blue-900 text-white py-4 px-4">
        <div className="max-w-4xl mx-auto">
          <Link to="/scenarios" className="text-blue-300 hover:text-white text-sm mb-1 inline-block">
            ← Back to Scenarios
          </Link>
          <h1 className="text-xl font-bold">{scenario.title}</h1>
        </div>
      </div>

      {/* Progress Bar */}
      <div className="bg-white border-b">
        <div className="max-w-4xl mx-auto px-4 py-3">
          <div className="flex items-center justify-between mb-1">
            <span className="text-sm font-medium text-gray-600">
              Step {currentStepIndex + 1} of {scenario.steps.length}
            </span>
            <span className="text-sm text-gray-500">
              Score: {score}/{currentStepIndex + (selectedOption ? 1 : 0)}
            </span>
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
        {/* Step Header */}
        <div className="bg-blue-800 text-white rounded-xl p-5 mb-4">
          <div className="text-xs text-blue-300 mb-1 font-medium uppercase tracking-wide">
            Step {currentStepIndex + 1} — {currentStep.title}
          </div>
          <h2 className="text-base font-semibold leading-relaxed">{currentStep.situation}</h2>
        </div>

        {/* Question */}
        <div className="bg-white rounded-xl shadow-sm p-5 mb-4">
          <h3 className="font-bold text-gray-900 mb-4 text-base">{currentStep.question}</h3>

          <div className="space-y-3">
            {currentStep.options.map((option) => {
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
                  disabled={!!selectedOption}
                  className={`w-full text-left p-4 rounded-lg transition-all ${optionStyle} ${
                    !selectedOption ? 'cursor-pointer' : 'cursor-default'
                  }`}
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

          {/* Hint */}
          {currentStep.hint && !selectedOption && (
            <div className="mt-4">
              <button
                onClick={() => setShowHint(!showHint)}
                className="text-sm text-blue-600 hover:text-blue-800 font-medium flex items-center gap-1"
              >
                💡 {showHint ? 'Hide Hint' : 'Show Hint'}
              </button>
              {showHint && (
                <div className="mt-2 p-3 bg-yellow-50 border border-yellow-200 rounded-lg text-sm text-yellow-800">
                  {currentStep.hint}
                </div>
              )}
            </div>
          )}
        </div>

        {/* Next Button */}
        {selectedOption && (
          <div className="flex justify-end">
            <button
              onClick={handleNext}
              className="bg-blue-600 text-white px-6 py-2.5 rounded-lg font-semibold hover:bg-blue-700 transition-colors"
            >
              {isLastStep ? 'View Results →' : 'Next Step →'}
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
