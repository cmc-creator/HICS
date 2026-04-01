import { useEffect, useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { useAuth } from '../lib/authContext';
import { exchangeOidcCode, type OidcProvider, validateOidcState } from '../lib/oidc';

export default function AuthCallbackPage() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const { loginSession } = useAuth();
  const [status, setStatus] = useState('Completing secure sign in...');
  const [error, setError] = useState('');

  useEffect(() => {
    const run = async () => {
      const code = searchParams.get('code');
      const state = searchParams.get('state');
      const providerParam = searchParams.get('provider') as OidcProvider | null;
      const provider: OidcProvider = providerParam === 'okta' ? 'okta' : 'entra';

      if (!code || !state) {
        setError('Missing identity callback parameters. Please try sign in again.');
        return;
      }

      if (!validateOidcState(state)) {
        setError('Invalid security state detected. Please restart sign in.');
        return;
      }

      try {
        const redirectUri = `${window.location.origin}/auth/callback`;
        const result = await exchangeOidcCode(provider, code, redirectUri);
        loginSession({
          user: {
            fullName: result.fullName,
            email: result.email,
            organization: result.organization,
            mfaEnabled: true,
            plan: 'enterprise',
          },
          accessToken: result.accessToken,
          refreshToken: result.refreshToken,
          authMethod: provider === 'okta' ? 'okta-oidc' : 'entra-oidc',
          expiresInSeconds: result.expiresIn,
          remember: true,
        });
        setStatus('Authentication complete. Redirecting to dashboard...');
        navigate('/dashboard', { replace: true });
      } catch (caughtError) {
        setError(caughtError instanceof Error ? caughtError.message : 'SSO sign in failed.');
      }
    };

    void run();
  }, [searchParams, loginSession, navigate]);

  return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center px-4">
      <div className="nyx-panel p-6 max-w-lg w-full text-center">
        <h1 className="text-xl font-bold text-gray-900 mb-2">Enterprise Authentication</h1>
        {!error ? (
          <p className="text-sm text-gray-600">{status}</p>
        ) : (
          <div>
            <p className="text-sm text-red-700 bg-red-50 border border-red-200 rounded-lg px-3 py-2">{error}</p>
            <Link to="/login" className="inline-block mt-4 nyx-button-metal px-4 py-2 rounded-lg text-sm font-semibold">Return to Login</Link>
          </div>
        )}
      </div>
    </div>
  );
}
