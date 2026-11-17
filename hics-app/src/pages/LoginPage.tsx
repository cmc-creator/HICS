import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../lib/authContext';
import { beginOidcLogin } from '../lib/oidc';
import { publicApiRequest } from '../lib/apiClient';
import { publicAsset } from '../lib/publicAsset';
import EnterpriseFooter from '../components/EnterpriseFooter';

interface LoginPageProps {
  theme: 'light' | 'dark';
  onToggleTheme: () => void;
}

export default function LoginPage({ theme, onToggleTheme }: LoginPageProps) {
  const navigate = useNavigate();
  const { loginSession } = useAuth();
  const [organization, setOrganization] = useState('North Campus Medical Center');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [remember, setRemember] = useState(true);
  const [error, setError] = useState('');
  // Set when the server answers a correct password with an MFA
  // challenge (opt-in second factor): the sign-in completes only
  // after the code step below.
  const [mfaChallengeToken, setMfaChallengeToken] = useState<string | null>(null);
  const [mfaCode, setMfaCode] = useState('');
  const [signingIn, setSigningIn] = useState(false);
  const [verifying, setVerifying] = useState(false);
  const [startingGoogle, setStartingGoogle] = useState(false);
  const [fieldErrors, setFieldErrors] = useState<{ email?: string; password?: string; code?: string }>({});

  const handleCredentialLogin = async (event: React.FormEvent) => {
    event.preventDefault();
    const errors: { email?: string; password?: string } = {};
    if (!email.includes('@')) errors.email = 'Enter a valid enterprise email.';
    if (password.length < 8) errors.password = 'Password must be at least 8 characters.';
    setFieldErrors(errors);
    if (Object.keys(errors).length > 0) {
      setError('');
      return;
    }

    setSigningIn(true);
    setError('');
    try {
      const result = await publicApiRequest<{
        accessToken: string;
        refreshToken?: string;
        expiresIn: number;
        email: string;
        fullName: string;
        organization: string;
        role: string;
        facility: string;
        mfaRequired?: boolean;
        challengeToken?: string;
      }>('/auth/local-login', {
        method: 'POST',
        body: JSON.stringify({
          email,
          password,
          organization,
        }),
      });

      if (result.mfaRequired && result.challengeToken) {
        setMfaChallengeToken(result.challengeToken);
        setMfaCode('');
        setError('');
        return;
      }

      loginSession({
        user: {
          fullName: result.fullName,
          email: result.email,
          organization: result.organization,
          mfaEnabled: true,
          plan: 'enterprise',
          role: result.role,
          facility: result.facility,
        },
        accessToken: result.accessToken,
        refreshToken: result.refreshToken,
        authMethod: 'password',
        expiresInSeconds: result.expiresIn,
        remember,
      });

      navigate('/dashboard');
    } catch (caughtError) {
      setError(caughtError instanceof Error ? caughtError.message : 'Credential sign in failed.');
    } finally {
      setSigningIn(false);
    }
  };

  const handleMfaVerify = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!mfaChallengeToken || mfaCode.trim().length < 6) {
      setFieldErrors({ code: 'Enter the 6-digit code from your authenticator app, or one of your recovery codes.' });
      return;
    }

    setVerifying(true);
    setError('');
    setFieldErrors({});
    try {
      const result = await publicApiRequest<{
        accessToken: string;
        refreshToken?: string;
        expiresIn: number;
        email: string;
        fullName: string;
        organization: string;
        role: string;
        facility: string;
      }>('/auth/mfa/verify', {
        method: 'POST',
        body: JSON.stringify({
          challengeToken: mfaChallengeToken,
          code: mfaCode.trim(),
        }),
      });

      loginSession({
        user: {
          fullName: result.fullName,
          email: result.email,
          organization: result.organization,
          mfaEnabled: true,
          plan: 'enterprise',
          role: result.role,
          facility: result.facility,
        },
        accessToken: result.accessToken,
        refreshToken: result.refreshToken,
        authMethod: 'password',
        expiresInSeconds: result.expiresIn,
        remember,
      });

      navigate('/dashboard');
    } catch (caughtError) {
      setError(caughtError instanceof Error ? caughtError.message : 'Verification failed.');
    } finally {
      setVerifying(false);
    }
  };

  const handleGoogleLogin = async () => {
    setStartingGoogle(true);
    setError('');
    try {
      const redirectUri = `${window.location.origin}/auth/callback`;
      await beginOidcLogin('google', redirectUri);
    } catch (caughtError) {
      setError(caughtError instanceof Error ? caughtError.message : 'Unable to start Google sign in.');
      setStartingGoogle(false);
    }
  };

  return (
    <div className="min-h-screen bg-gray-50 lux-page">
      <header className="nyx-hero text-white px-4 py-5 relative overflow-hidden">
        <div className="lux-grid-pattern" />
        <div className="max-w-4xl mx-auto flex items-center justify-between">
          <Link to="/" className="text-sm text-amber-100 hover:text-white">← Back to Home</Link>
          <button type="button" onClick={onToggleTheme} className="touch-target px-3 py-2 rounded-md text-sm font-medium text-stone-200 hover:bg-white/10 hover:text-white transition-colors lux-nav-link">
            {theme === 'dark' ? 'Light' : 'Dark'}
          </button>
        </div>
      </header>

      <main className="max-w-4xl mx-auto px-4 py-10">
        <div className="grid md:grid-cols-2 gap-6 items-start motion-stagger">
          <section className="nyx-panel p-6 relative overflow-hidden">
            <div className="lux-orb lux-orb-a" aria-hidden="true" />
            <div className="flex items-center gap-3">
              <span className="lux-logo-frame">
                <img src={publicAsset('hicslogo.png')} alt="NyxHICSlab logo" className="h-12 w-12 rounded-lg object-contain lux-logo-img" />
              </span>
              <div>
                <p className="text-xs font-bold tracking-[0.2em] text-gray-500 dark:text-white/50">ENTERPRISE ACCESS</p>
                <p className="text-sm font-semibold text-gray-700 dark:text-white/80">NyxHICSlab · Nyx Collective LLC</p>
              </div>
            </div>
            <h1 className="text-3xl font-bold text-gray-900 dark:text-white mt-4">Sign in to your command workspace</h1>
            <p className="text-sm text-gray-600 dark:text-white/70 mt-3 leading-relaxed">
              Access scenario operations, facility-scoped dashboards, facilitator controls, and export-ready reporting.
            </p>
            <div className="mt-5 space-y-2 text-sm text-gray-700 dark:text-white/80">
              <div className="flex items-center gap-2"><span className="text-[10px] font-bold tracking-widest px-2 py-0.5 rounded border border-green-300 text-green-700 dark:text-green-300">OK</span>MFA expected for all enterprise users</div>
              <div className="flex items-center gap-2"><span className="text-[10px] font-bold tracking-widest px-2 py-0.5 rounded border border-green-300 text-green-700 dark:text-green-300">OK</span>Role and facility scope applied after login</div>
              <div className="flex items-center gap-2"><span className="text-[10px] font-bold tracking-widest px-2 py-0.5 rounded border border-green-300 text-green-700 dark:text-green-300">OK</span>Audit-ready training records and exports</div>
            </div>
          </section>

          <section className="nyx-panel p-6">
            <h2 className="text-xl font-bold text-gray-900 dark:text-white mb-4">{mfaChallengeToken ? 'Two-Factor Verification' : 'Login'}</h2>
            {mfaChallengeToken ? (
              <form onSubmit={handleMfaVerify} className="space-y-3" noValidate>
                <p className="text-sm text-gray-600 dark:text-white/70 leading-relaxed">
                  Your password was accepted. Enter the code from your authenticator app to finish signing in.
                  You can also use one of your recovery codes.
                </p>
                <div>
                  <label className="text-xs font-semibold text-gray-600 dark:text-white/60" htmlFor="mfa-code">Authenticator or recovery code</label>
                  <input
                    id="mfa-code"
                    type="text"
                    autoComplete="one-time-code"
                    value={mfaCode}
                    onChange={(e) => setMfaCode(e.target.value)}
                    aria-invalid={fieldErrors.code ? true : undefined}
                    aria-describedby={fieldErrors.code ? 'mfa-code-error' : undefined}
                    className="nyx-input mt-1 w-full border border-gray-300 rounded-lg px-3 py-2 text-sm"
                  />
                  {fieldErrors.code && <p id="mfa-code-error" className="text-xs text-red-600 dark:text-red-400 mt-1" role="alert">{fieldErrors.code}</p>}
                </div>
                {error && <p className="text-xs text-red-700 bg-red-50 border border-red-200 rounded-lg px-3 py-2" role="alert">{error}</p>}
                <button type="submit" disabled={verifying} className="nyx-button-metal w-full py-2.5 rounded-lg text-sm font-semibold disabled:opacity-60 disabled:cursor-not-allowed">
                  {verifying ? <><span className="spinner" aria-hidden="true" /> Verifying...</> : 'Verify and Sign In'}
                </button>
                <button
                  type="button"
                  onClick={() => { setMfaChallengeToken(null); setMfaCode(''); setError(''); setFieldErrors({}); }}
                  className="w-full text-xs text-gray-600 dark:text-white/60 hover:underline py-1"
                >
                  Back to sign in
                </button>
              </form>
            ) : (
            <>
            <div className="mb-4">
              <button type="button" onClick={handleGoogleLogin} disabled={startingGoogle} className="w-full border border-gray-300 dark:border-white/20 rounded-lg px-3 py-2 text-sm font-semibold hover:bg-gray-50 dark:hover:bg-white/10 transition-colors disabled:opacity-60 disabled:cursor-not-allowed">
                {startingGoogle ? <><span className="spinner" aria-hidden="true" /> Connecting to Google...</> : 'Continue with Google'}
              </button>
            </div>
            <div className="flex items-center gap-3 mb-4" aria-hidden="true">
              <span className="h-px flex-1 bg-gray-200 dark:bg-white/10" />
              <span className="text-[11px] font-semibold tracking-widest text-gray-400 dark:text-white/40">OR</span>
              <span className="h-px flex-1 bg-gray-200 dark:bg-white/10" />
            </div>

            <form onSubmit={handleCredentialLogin} className="space-y-3" noValidate>
              <div>
                <label className="text-xs font-semibold text-gray-600 dark:text-white/60" htmlFor="org">Organization</label>
                <input id="org" value={organization} onChange={(e) => setOrganization(e.target.value)} className="nyx-input mt-1 w-full border border-gray-300 rounded-lg px-3 py-2 text-sm" />
              </div>
              <div>
                <label className="text-xs font-semibold text-gray-600 dark:text-white/60" htmlFor="email">Work Email</label>
                <input id="email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} aria-invalid={fieldErrors.email ? true : undefined} aria-describedby={fieldErrors.email ? 'email-error' : undefined} className="nyx-input mt-1 w-full border border-gray-300 rounded-lg px-3 py-2 text-sm" />
                {fieldErrors.email && <p id="email-error" className="text-xs text-red-600 dark:text-red-400 mt-1" role="alert">{fieldErrors.email}</p>}
              </div>
              <div>
                <div className="flex items-center justify-between">
                  <label className="text-xs font-semibold text-gray-600 dark:text-white/60" htmlFor="password">Password</label>
                  <Link to="/forgot-password" className="text-xs text-amber-700 dark:text-amber-300 hover:underline font-medium">Forgot password?</Link>
                </div>
                <input id="password" type="password" value={password} onChange={(e) => setPassword(e.target.value)} aria-invalid={fieldErrors.password ? true : undefined} aria-describedby={fieldErrors.password ? 'password-error' : undefined} className="nyx-input mt-1 w-full border border-gray-300 rounded-lg px-3 py-2 text-sm" />
                {fieldErrors.password && <p id="password-error" className="text-xs text-red-600 dark:text-red-400 mt-1" role="alert">{fieldErrors.password}</p>}
              </div>
              <label className="flex items-center gap-2 text-xs text-gray-600 dark:text-white/70">
                <input type="checkbox" checked={remember} onChange={(e) => setRemember(e.target.checked)} />
                Keep me signed in on this device
              </label>
              {error && <p className="text-xs text-red-700 bg-red-50 border border-red-200 rounded-lg px-3 py-2" role="alert">{error}</p>}
              <button type="submit" disabled={signingIn} className="nyx-button-metal w-full py-2.5 rounded-lg text-sm font-semibold disabled:opacity-60 disabled:cursor-not-allowed">
                {signingIn ? <><span className="spinner" aria-hidden="true" /> Signing in...</> : 'Sign In Securely'}
              </button>
            </form>
            </>
            )}
          </section>
        </div>
      </main>
      <EnterpriseFooter />
    </div>
  );
}
