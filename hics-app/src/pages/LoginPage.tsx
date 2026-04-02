import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../lib/authContext';
import { beginOidcLogin } from '../lib/oidc';
import EnterpriseFooter from '../components/EnterpriseFooter';

interface LoginPageProps {
  theme: 'light' | 'dark';
  onToggleTheme: () => void;
}

export default function LoginPage({ theme, onToggleTheme }: LoginPageProps) {
  const navigate = useNavigate();
  const { loginSession } = useAuth();
  const [organization, setOrganization] = useState('North Campus Behavioral Health');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [remember, setRemember] = useState(true);
  const [error, setError] = useState('');

  const handleCredentialLogin = (event: React.FormEvent) => {
    event.preventDefault();
    if (!email.includes('@') || password.length < 8) {
      setError('Use a valid enterprise email and a password with at least 8 characters.');
      return;
    }

    loginSession(
      {
        user: {
          fullName: email.split('@')[0].replace('.', ' '),
          email,
          organization,
          mfaEnabled: true,
          plan: 'enterprise',
        },
        accessToken: `pwd-${Math.random().toString(36).slice(2)}`,
        authMethod: 'password',
        expiresInSeconds: 3600,
        remember,
      },
    );
    navigate('/dashboard');
  };

  const handleSsoLogin = async (provider: 'entra' | 'okta') => {
    try {
      const redirectUri = `${window.location.origin}/auth/callback`;
      await beginOidcLogin(provider, redirectUri);
    } catch (caughtError) {
      setError(caughtError instanceof Error ? caughtError.message : 'Unable to start enterprise SSO flow.');
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
        <div className="grid md:grid-cols-2 gap-6 items-start">
          <section className="nyx-panel p-6">
            <p className="text-xs font-bold tracking-[0.2em] text-gray-500">ENTERPRISE ACCESS</p>
            <h1 className="text-3xl font-bold text-gray-900 mt-2">Sign in to your command workspace</h1>
            <p className="text-sm text-gray-600 mt-3 leading-relaxed">
              Access scenario operations, facility-scoped dashboards, facilitator controls, and export-ready reporting.
            </p>
            <div className="mt-5 space-y-2 text-sm text-gray-700">
              <div className="flex items-center gap-2"><span className="text-[10px] font-bold tracking-widest px-2 py-0.5 rounded border border-green-300 text-green-700">OK</span>MFA expected for all enterprise users</div>
              <div className="flex items-center gap-2"><span className="text-[10px] font-bold tracking-widest px-2 py-0.5 rounded border border-green-300 text-green-700">OK</span>Role and facility scope applied after login</div>
              <div className="flex items-center gap-2"><span className="text-[10px] font-bold tracking-widest px-2 py-0.5 rounded border border-green-300 text-green-700">OK</span>Audit-ready training records and exports</div>
            </div>
          </section>

          <section className="nyx-panel p-6">
            <h2 className="text-xl font-bold text-gray-900 mb-4">Login</h2>
            <div className="grid grid-cols-2 gap-2 mb-4">
              <button type="button" onClick={() => handleSsoLogin('entra')} className="border border-gray-300 rounded-lg px-3 py-2 text-sm font-semibold hover:bg-gray-50">Microsoft Entra</button>
              <button type="button" onClick={() => handleSsoLogin('okta')} className="border border-gray-300 rounded-lg px-3 py-2 text-sm font-semibold hover:bg-gray-50">Okta</button>
            </div>

            <form onSubmit={handleCredentialLogin} className="space-y-3">
              <div>
                <label className="text-xs font-semibold text-gray-600" htmlFor="org">Organization</label>
                <input id="org" value={organization} onChange={(e) => setOrganization(e.target.value)} className="nyx-input mt-1 w-full border border-gray-300 rounded-lg px-3 py-2 text-sm" />
              </div>
              <div>
                <label className="text-xs font-semibold text-gray-600" htmlFor="email">Work Email</label>
                <input id="email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} className="nyx-input mt-1 w-full border border-gray-300 rounded-lg px-3 py-2 text-sm" />
              </div>
              <div>
                <div className="flex items-center justify-between">
                  <label className="text-xs font-semibold text-gray-600" htmlFor="password">Password</label>
                  <Link to="/forgot-password" className="text-xs text-amber-700 hover:underline font-medium">Forgot password?</Link>
                </div>
                <input id="password" type="password" value={password} onChange={(e) => setPassword(e.target.value)} className="nyx-input mt-1 w-full border border-gray-300 rounded-lg px-3 py-2 text-sm" />
              </div>
              <label className="flex items-center gap-2 text-xs text-gray-600">
                <input type="checkbox" checked={remember} onChange={(e) => setRemember(e.target.checked)} />
                Keep me signed in on this device
              </label>
              {error && <p className="text-xs text-red-700 bg-red-50 border border-red-200 rounded-lg px-3 py-2">{error}</p>}
              <button type="submit" className="nyx-button-metal w-full py-2.5 rounded-lg text-sm font-semibold">Sign In Securely</button>
            </form>
          </section>
        </div>
      </main>
      <EnterpriseFooter />
    </div>
  );
}
