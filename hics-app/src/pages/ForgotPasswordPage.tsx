import { useState } from 'react';
import { Link } from 'react-router-dom';
import EnterpriseFooter from '../components/EnterpriseFooter';

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState('');
  const [submitted, setSubmitted] = useState(false);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    if (!email.includes('@') || email.trim().length < 5) {
      setError('Enter a valid enterprise email address.');
      return;
    }

    setLoading(true);
    try {
      await fetch('/api/auth/forgot-password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: email.trim() }),
      });
      // Always show success to prevent email enumeration
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
          <p className="text-xs font-bold tracking-[0.2em] text-gray-500 dark:text-white/50">PASSWORD RESET</p>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white mt-2">Reset your password</h1>

          {submitted ? (
            <div className="mt-6">
              <div className="bg-green-50 dark:bg-green-900/30 border border-green-200 dark:border-green-700 rounded-xl px-4 py-4">
                <p className="text-sm font-semibold text-green-800 dark:text-green-300">Check your inbox</p>
                <p className="text-sm text-green-700 dark:text-green-400 mt-1">
                  If <strong>{email}</strong> is registered, you will receive a reset link shortly. Check spam if it doesn't arrive within a few minutes.
                </p>
              </div>
              <Link to="/login" className="mt-5 block text-center nyx-button-metal w-full py-2.5 rounded-lg text-sm font-semibold">
                Return to Login
              </Link>
            </div>
          ) : (
            <>
              <p className="text-sm text-gray-600 dark:text-white/60 mt-3 leading-relaxed">
                Enter your work email address and we'll send you a secure link to reset your password.
              </p>

              <form onSubmit={handleSubmit} className="mt-6 space-y-4">
                <div>
                  <label className="text-xs font-semibold text-gray-600 dark:text-white/60" htmlFor="reset-email">
                    Work Email
                  </label>
                  <input
                    id="reset-email"
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="you@yourhospital.org"
                    className="nyx-input mt-1 w-full border border-gray-300 rounded-lg px-3 py-2.5 text-sm"
                    required
                    autoFocus
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
                  {loading ? 'Sending...' : 'Send Reset Link'}
                </button>
              </form>

              <p className="mt-4 text-center text-xs text-gray-500 dark:text-white/40">
                Remember your password?{' '}
                <Link to="/login" className="text-amber-700 dark:text-amber-400 hover:underline font-semibold">
                  Sign in
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
