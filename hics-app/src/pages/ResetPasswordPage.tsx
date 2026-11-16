import { useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import EnterpriseFooter from '../components/EnterpriseFooter';

export default function ResetPasswordPage() {
  const [searchParams] = useSearchParams();
  const token = searchParams.get('token') ?? '';

  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [submitted, setSubmitted] = useState(false);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    if (password.length < 10) {
      setError('Choose a password with at least 10 characters.');
      return;
    }

    if (password !== confirmPassword) {
      setError('The passwords do not match.');
      return;
    }

    setLoading(true);
    try {
      const response = await fetch('/api/auth/reset-password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token, password }),
      });

      if (!response.ok) {
        let message = 'This password link is invalid or has expired. Request a new one and try again.';
        try {
          const payload = await response.json();
          if (payload && typeof payload.error === 'string' && payload.error) {
            message = payload.error;
          }
        } catch {
          // Keep the generic message when the body is not JSON.
        }
        setError(message);
        return;
      }

      setSubmitted(true);
    } catch {
      setError('Unable to reach the server. Check your connection and try again.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gray-50 lux-page">
      <header className="nyx-hero text-white px-4 py-5 relative overflow-hidden">
        <div className="lux-grid-pattern" />
        <div className="max-w-4xl mx-auto">
          <Link to="/login" className="text-sm text-amber-100 hover:text-white">← Back to Login</Link>
        </div>
      </header>

      <main className="max-w-md mx-auto px-4 py-16">
        <div className="nyx-panel p-8">
          <p className="text-xs font-bold tracking-[0.2em] text-gray-500 dark:text-white/50">SET PASSWORD</p>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white mt-2">Set your password</h1>

          {submitted ? (
            <div className="mt-6">
              <div className="bg-green-50 dark:bg-green-900/30 border border-green-200 dark:border-green-700 rounded-xl px-4 py-4">
                <p className="text-sm font-semibold text-green-800 dark:text-green-300">Password set</p>
                <p className="text-sm text-green-700 dark:text-green-400 mt-1">
                  Your password has been set. You can now sign in with your email and new password.
                </p>
              </div>
              <Link to="/login" className="mt-5 block text-center nyx-button-metal w-full py-2.5 rounded-lg text-sm font-semibold">
                Go to Login
              </Link>
            </div>
          ) : !token ? (
            <div className="mt-6">
              <p className="text-sm text-red-700 bg-red-50 border border-red-200 rounded-lg px-3 py-2">
                This link is missing its security token, so it cannot be used. Open the full link from your email, or request a new one.
              </p>
              <Link to="/forgot-password" className="mt-5 block text-center nyx-button-metal w-full py-2.5 rounded-lg text-sm font-semibold">
                Request a New Link
              </Link>
            </div>
          ) : (
            <>
              <p className="text-sm text-gray-600 dark:text-white/60 mt-3 leading-relaxed">
                Choose a new password for your account. It must be at least 10 characters long.
              </p>

              <form onSubmit={handleSubmit} className="mt-6 space-y-4">
                <div>
                  <label className="text-xs font-semibold text-gray-600 dark:text-white/60" htmlFor="reset-password">
                    New Password
                  </label>
                  <input
                    id="reset-password"
                    type="password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="At least 10 characters"
                    className="nyx-input mt-1 w-full border border-gray-300 rounded-lg px-3 py-2.5 text-sm"
                    required
                    autoFocus
                  />
                </div>

                <div>
                  <label className="text-xs font-semibold text-gray-600 dark:text-white/60" htmlFor="reset-password-confirm">
                    Confirm Password
                  </label>
                  <input
                    id="reset-password-confirm"
                    type="password"
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    placeholder="Repeat the new password"
                    className="nyx-input mt-1 w-full border border-gray-300 rounded-lg px-3 py-2.5 text-sm"
                    required
                  />
                </div>

                {error && (
                  <p className="text-xs text-red-700 bg-red-50 border border-red-200 rounded-lg px-3 py-2">{error}</p>
                )}

                <button
                  type="submit"
                  disabled={loading}
                  className="nyx-button-metal w-full py-2.5 rounded-lg text-sm font-semibold disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {loading ? 'Saving...' : 'Set Password'}
                </button>
              </form>

              <p className="mt-4 text-center text-xs text-gray-500 dark:text-white/40">
                Link expired?{' '}
                <Link to="/forgot-password" className="text-amber-700 dark:text-amber-400 hover:underline font-semibold">
                  Request a new one
                </Link>
              </p>
            </>
          )}
        </div>
      </main>

      <EnterpriseFooter />
    </div>
  );
}
