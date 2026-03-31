import { useState } from 'react';
import { quizQuestions } from '../data/quiz';
import type { QuizQuestion } from '../types';

type QuizState = 'start' | 'playing' | 'review' | 'complete';

export default function QuizPage() {
  const [state, setState] = useState<QuizState>('start');
  const [currentIndex, setCurrentIndex] = useState(0);
  const [selectedAnswer, setSelectedAnswer] = useState<number | null>(null);
  const [answers, setAnswers] = useState<Array<{ question: QuizQuestion; answer: number; correct: boolean }>>([]);
  const [filterCategory, setFilterCategory] = useState<string>('all');

  const categories = ['all', ...Array.from(new Set(quizQuestions.map((q) => q.category)))];

  const filteredQuestions = filterCategory === 'all'
    ? quizQuestions
    : quizQuestions.filter((q) => q.category === filterCategory);

  const currentQuestion = filteredQuestions[currentIndex];
  const totalQuestions = filteredQuestions.length;
  const score = answers.filter((a) => a.correct).length;
  const progress = totalQuestions > 0 ? ((currentIndex + (selectedAnswer !== null ? 1 : 0)) / totalQuestions) * 100 : 0;

  const handleSelectAnswer = (index: number) => {
    if (selectedAnswer !== null) return;
    setSelectedAnswer(index);
    const correct = index === currentQuestion.correctAnswer;
    setAnswers((prev) => [...prev, { question: currentQuestion, answer: index, correct }]);
  };

  const handleNext = () => {
    if (currentIndex < totalQuestions - 1) {
      setCurrentIndex((i) => i + 1);
      setSelectedAnswer(null);
    } else {
      setState('complete');
    }
  };

  const handleStart = () => {
    setCurrentIndex(0);
    setSelectedAnswer(null);
    setAnswers([]);
    setState('playing');
  };

  const handleRestart = () => {
    setCurrentIndex(0);
    setSelectedAnswer(null);
    setAnswers([]);
    setState('start');
  };

  const scorePercent = totalQuestions > 0 ? Math.round((score / totalQuestions) * 100) : 0;

  if (state === 'start') {
    return (
      <div className="min-h-screen bg-gray-50">
        <div className="bg-blue-900 text-white py-6 px-4">
          <div className="max-w-3xl mx-auto">
            <h1 className="text-2xl font-bold">HICS Knowledge Quiz</h1>
            <p className="text-blue-200 text-sm mt-1">Test your knowledge of HICS protocols and emergency procedures</p>
          </div>
        </div>

        <div className="max-w-3xl mx-auto px-4 py-8">
          <div className="bg-white rounded-xl shadow-sm p-8 text-center mb-6">
            <div className="text-6xl mb-4">📝</div>
            <h2 className="text-2xl font-bold text-gray-900 mb-2">Ready to Test Your Knowledge?</h2>
            <p className="text-gray-600 mb-6">
              {filteredQuestions.length} questions covering HICS structure, triage, fire response, hazmat protocols, and more.
            </p>

            <div className="mb-6">
              <label className="text-sm font-medium text-gray-700 block mb-2">Filter by Category:</label>
              <div className="flex flex-wrap justify-center gap-2">
                {categories.map((cat) => (
                  <button
                    key={cat}
                    onClick={() => setFilterCategory(cat)}
                    className={`px-4 py-1.5 rounded-full text-sm font-medium transition-colors ${
                      filterCategory === cat
                        ? 'bg-blue-600 text-white'
                        : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                    }`}
                  >
                    {cat === 'all' ? 'All Categories' : cat}
                  </button>
                ))}
              </div>
            </div>

            <div className="grid grid-cols-3 gap-4 mb-8 text-sm text-gray-500">
              <div className="bg-gray-50 rounded-lg p-3">
                <div className="text-2xl font-bold text-gray-900">{filteredQuestions.length}</div>
                Questions
              </div>
              <div className="bg-gray-50 rounded-lg p-3">
                <div className="text-2xl font-bold text-gray-900">~{Math.ceil(filteredQuestions.length * 0.5)}</div>
                Minutes
              </div>
              <div className="bg-gray-50 rounded-lg p-3">
                <div className="text-2xl font-bold text-gray-900">80%</div>
                Pass Score
              </div>
            </div>

            <button
              onClick={handleStart}
              className="bg-blue-600 text-white px-8 py-3 rounded-lg font-bold text-lg hover:bg-blue-700 transition-colors"
            >
              Start Quiz →
            </button>
          </div>
        </div>
      </div>
    );
  }

  if (state === 'complete') {
    return (
      <div className="min-h-screen bg-gray-50">
        <div className="bg-blue-900 text-white py-6 px-4">
          <div className="max-w-3xl mx-auto">
            <h1 className="text-2xl font-bold">Quiz Results</h1>
          </div>
        </div>

        <div className="max-w-3xl mx-auto px-4 py-8">
          {/* Score Card */}
          <div className="bg-white rounded-xl shadow-sm p-8 text-center mb-6">
            <div className="text-6xl mb-4">
              {scorePercent >= 80 ? '🏆' : scorePercent >= 60 ? '👍' : '📚'}
            </div>
            <h2 className="text-2xl font-bold text-gray-900 mb-2">Quiz Complete!</h2>
            <div className="text-5xl font-bold mb-1" style={{
              color: scorePercent >= 80 ? '#059669' : scorePercent >= 60 ? '#d97706' : '#dc2626'
            }}>
              {scorePercent}%
            </div>
            <div className="text-gray-500 mb-4">{score} of {totalQuestions} correct</div>
            <div className={`inline-block px-4 py-1.5 rounded-full text-sm font-semibold ${
              scorePercent >= 80 ? 'bg-green-100 text-green-700' :
              scorePercent >= 60 ? 'bg-yellow-100 text-yellow-700' :
              'bg-red-100 text-red-700'
            }`}>
              {scorePercent >= 80 ? '✓ PASS' : '✗ Did Not Pass'}
            </div>

            {/* Category Breakdown */}
            <div className="mt-6 text-left">
              <h3 className="font-bold text-gray-800 mb-3 text-sm">Performance by Category:</h3>
              <div className="space-y-2">
                {Array.from(new Set(answers.map((a) => a.question.category))).map((cat) => {
                  const catAnswers = answers.filter((a) => a.question.category === cat);
                  const catScore = catAnswers.filter((a) => a.correct).length;
                  const catPercent = Math.round((catScore / catAnswers.length) * 100);
                  return (
                    <div key={cat} className="flex items-center gap-3">
                      <div className="text-xs text-gray-600 w-32 flex-shrink-0">{cat}</div>
                      <div className="flex-1 bg-gray-100 rounded-full h-2">
                        <div
                          className="h-2 rounded-full transition-all"
                          style={{
                            width: `${catPercent}%`,
                            backgroundColor: catPercent >= 80 ? '#059669' : catPercent >= 60 ? '#d97706' : '#dc2626'
                          }}
                        />
                      </div>
                      <div className="text-xs text-gray-600 w-16 text-right">{catScore}/{catAnswers.length}</div>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>

          {/* Wrong Answers Review */}
          {answers.filter((a) => !a.correct).length > 0 && (
            <div className="bg-white rounded-xl shadow-sm p-6 mb-6">
              <h3 className="font-bold text-gray-800 mb-4">Review Incorrect Answers</h3>
              <div className="space-y-4">
                {answers.filter((a) => !a.correct).map(({ question, answer }, i) => (
                  <div key={i} className="border-l-4 border-red-400 pl-4">
                    <div className="text-sm font-semibold text-gray-900 mb-2">{question.question}</div>
                    <div className="text-sm text-red-600 mb-1">
                      ❌ Your answer: {question.options[answer]}
                    </div>
                    <div className="text-sm text-green-600 mb-2">
                      ✅ Correct: {question.options[question.correctAnswer]}
                    </div>
                    <div className="text-sm text-gray-600 bg-gray-50 p-3 rounded-lg">
                      {question.explanation}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          <div className="flex flex-wrap gap-3">
            <button
              onClick={handleRestart}
              className="bg-blue-600 text-white px-5 py-2.5 rounded-lg font-semibold hover:bg-blue-700 transition-colors"
            >
              🔄 Retake Quiz
            </button>
          </div>
        </div>
      </div>
    );
  }

  // Playing state
  return (
    <div className="min-h-screen bg-gray-50">
      <div className="bg-blue-900 text-white py-4 px-4">
        <div className="max-w-3xl mx-auto flex items-center justify-between">
          <h1 className="text-xl font-bold">HICS Quiz</h1>
          <button
            onClick={handleRestart}
            className="text-blue-300 hover:text-white text-sm"
          >
            ✕ Exit
          </button>
        </div>
      </div>

      {/* Progress */}
      <div className="bg-white border-b">
        <div className="max-w-3xl mx-auto px-4 py-3">
          <div className="flex items-center justify-between mb-1">
            <span className="text-sm font-medium text-gray-600">
              Question {currentIndex + 1} of {totalQuestions}
            </span>
            <span className="text-sm text-gray-500">Score: {score}</span>
          </div>
          <div className="w-full bg-gray-200 rounded-full h-2">
            <div
              className="bg-blue-600 h-2 rounded-full transition-all duration-500"
              style={{ width: `${progress}%` }}
            />
          </div>
        </div>
      </div>

      <div className="max-w-3xl mx-auto px-4 py-6">
        <div className="bg-white rounded-xl shadow-sm p-6">
          <div className="flex items-center justify-between mb-4">
            <span className="text-xs font-medium text-blue-600 bg-blue-50 px-3 py-1 rounded-full">
              {currentQuestion.category}
            </span>
          </div>

          <h2 className="text-lg font-bold text-gray-900 mb-6">{currentQuestion.question}</h2>

          <div className="space-y-3">
            {currentQuestion.options.map((option, index) => {
              let optionStyle = 'border border-gray-200 hover:border-blue-300 hover:bg-blue-50 cursor-pointer';
              if (selectedAnswer !== null) {
                if (index === currentQuestion.correctAnswer) {
                  optionStyle = 'border-2 border-green-500 bg-green-50 cursor-default';
                } else if (index === selectedAnswer && index !== currentQuestion.correctAnswer) {
                  optionStyle = 'border-2 border-red-500 bg-red-50 cursor-default';
                } else {
                  optionStyle = 'border border-gray-200 opacity-50 cursor-default';
                }
              }

              return (
                <button
                  key={index}
                  onClick={() => handleSelectAnswer(index)}
                  disabled={selectedAnswer !== null}
                  className={`w-full text-left p-4 rounded-lg transition-all ${optionStyle}`}
                >
                  <div className="flex items-start gap-3">
                    <div className={`w-6 h-6 rounded-full border-2 flex items-center justify-center flex-shrink-0 mt-0.5 text-sm ${
                      selectedAnswer !== null
                        ? index === currentQuestion.correctAnswer
                          ? 'border-green-500 bg-green-500 text-white'
                          : index === selectedAnswer
                            ? 'border-red-500 bg-red-500 text-white'
                            : 'border-gray-300 text-gray-400'
                        : 'border-gray-300'
                    }`}>
                      {selectedAnswer !== null && index === currentQuestion.correctAnswer && '✓'}
                      {selectedAnswer !== null && index === selectedAnswer && index !== currentQuestion.correctAnswer && '✗'}
                      {selectedAnswer === null && String.fromCharCode(65 + index)}
                    </div>
                    <span className="text-sm text-gray-800">{option}</span>
                  </div>
                </button>
              );
            })}
          </div>

          {selectedAnswer !== null && (
            <div className={`mt-4 p-4 rounded-lg ${
              selectedAnswer === currentQuestion.correctAnswer
                ? 'bg-green-50 border border-green-200'
                : 'bg-red-50 border border-red-200'
            }`}>
              <div className={`font-semibold text-sm mb-1 ${
                selectedAnswer === currentQuestion.correctAnswer ? 'text-green-800' : 'text-red-800'
              }`}>
                {selectedAnswer === currentQuestion.correctAnswer ? '✅ Correct!' : '❌ Incorrect'}
              </div>
              <p className={`text-sm ${
                selectedAnswer === currentQuestion.correctAnswer ? 'text-green-700' : 'text-red-700'
              }`}>
                {currentQuestion.explanation}
              </p>
            </div>
          )}
        </div>

        {selectedAnswer !== null && (
          <div className="flex justify-end mt-4">
            <button
              onClick={handleNext}
              className="bg-blue-600 text-white px-6 py-2.5 rounded-lg font-semibold hover:bg-blue-700 transition-colors"
            >
              {currentIndex === totalQuestions - 1 ? 'View Results →' : 'Next Question →'}
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
