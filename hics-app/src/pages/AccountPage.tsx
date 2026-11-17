import { useCallback, useEffect, useState } from 'react';
import { useAuth } from '../lib/authContext';
import { useTenant } from '../lib/tenantContext';
import { publicApiRequest } from '../lib/apiClient';
import { useToast } from '../lib/toast';

interface MfaStatus {
  mfaEnabled: boolean;
  canEnroll: boolean;
  enrollmentPending: boolean;
}

// Account & security: profile summary plus opt-in MFA (TOTP)
// management for password accounts. Enrollment is a three-step
// flow - start (server generates a secret), confirm with a code
// (proves the authenticator works), then the one-time recovery
// codes are shown exactly once.
export default function AccountPage() {
  const { user } = useAuth();
  const toast = useToast();
  const { roleOptions } = useTenant();

  const [status, setStatus] = useState<MfaStatus | null>(null);
  const [statusError, setStatusError] = useState('');
  const [enrollment, setEnrollment] = useState<{ secret: string; otpauthUri: string } | null>(null);
  const [confirmCode, setConfirmCode] = useState('');
  const [recoveryCodes, setRecoveryCodes] = useState<string[] | null>(null);
  const [disableCode, setDisableCode] = useState('');
  const [actionError, setActionError] = useState('');
  const [actionMessage, setActionMessage] = useState('');
  const [busy, setBusy] = useState(false);

  const loadStatus = useCallback(async () => {
    try {
      const result = await publicApiRequest<MfaStatus>('/auth/mfa/status', { method: 'GET' });
      setStatus(result);
      setStatusError('');
    } catch {
      setStatusError('Could not load your security settings.');
    }
  }, []);

  useEffect(() => {
    void loadStatus();
  }, [loadStatus]);

  const roleLabel = user?.role
    ? (roleOptions.find((option) => option.value === user.role)?.label ?? user.role)
    : 'Not recorded - sign in again';

  const startEnrollment = async () => {
    setBusy(true);
    setActionError('');
    setActionMessage('');
    try {
      const result = await publicApiRequest<{ secret: string; otpauthUri: string }>('/auth/mfa/enroll', {
        method: 'POST',
        body: JSON.stringify({}),
      });
      setEnrollment(result);
      setConfirmCode('');
    } catch (err) {
      setActionError(err instanceof Error ? err.message : 'Could not start MFA enrollment.');
    } finally {
      setBusy(false);
    }
  };

  const confirmEnrollment = async (event: React.FormEvent) => {
    event.preventDefault();
    setBusy(true);
    setActionError('');
    try {
      const result = await publicApiRequest<{ recoveryCodes: string[] }>('/auth/mfa/confirm', {
        method: 'POST',
        body: JSON.stringify({ code: confirmCode.trim() }),
      });
      setRecoveryCodes(result.recoveryCodes);
      toast.success('Two-factor authentication is on. Save your recovery codes now - they are shown only once.');
      setEnrollment(null);
      setConfirmCode('');
      await loadStatus();
    } catch (err) {
      setActionError(err instanceof Error ? err.message : 'That code did not match.');
    } finally {
      setBusy(false);
    }
  };

  const disableMfa = async (event: React.FormEvent) => {
    event.preventDefault();
    setBusy(true);
    setActionError('');
    setActionMessage('');
    try {
      await publicApiRequest('/auth/mfa/disable', {
        method: 'POST',
        body: JSON.stringify({ code: disableCode.trim() }),
      });
      setDisableCode('');
      setActionMessage('Two-factor authentication is now off for your account.');
      toast.info('Two-factor authentication is now off for your account.');
      await loadStatus();
    } catch (err) {
      setActionError(err instanceof Error ? err.message : 'Could not disable MFA.');
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="min-h-screen bg-gray-50 lux-page">
      <div className="max-w-4xl mx-auto px-4 pt-6">
        <div className="page-head">
          <h1 className="text-xl md:text-2xl font-bold lux-title">Account &amp; Security</h1>
          <p className="page-head-sub text-sm mt-1 lux-subtitle">Your profile and sign-in protection</p>
        </div>
      </div>

      <div className="max-w-4xl mx-auto px-4 py-6 space-y-6">
        <div className="nyx-panel p-5">
          <h2 className="text-lg font-bold text-gray-900 dark:text-white mb-4">Profile</h2>
          <dl className="grid sm:grid-cols-2 gap-4 text-sm">
            <div>
              <dt className="text-xs font-semibold text-gray-600 dark:text-white/60">Name</dt>
              <dd className="mt-1 text-gray-900 dark:text-white">{user?.fullName || '-'}</dd>
            </div>
            <div>
              <dt className="text-xs font-semibold text-gray-600 dark:text-white/60">Email</dt>
              <dd className="mt-1 text-gray-900 dark:text-white">{user?.email || '-'}</dd>
            </div>
            <div>
              <dt className="text-xs font-semibold text-gray-600 dark:text-white/60">Organization</dt>
              <dd className="mt-1 text-gray-900 dark:text-white">{user?.organization || '-'}</dd>
            </div>
            <div>
              <dt className="text-xs font-semibold text-gray-600 dark:text-white/60">Role</dt>
              <dd className="mt-1 text-gray-900 dark:text-white">{roleLabel}</dd>
            </div>
          </dl>
        </div>

        <div className="nyx-panel p-5">
          <h2 className="text-lg font-bold text-gray-900 dark:text-white mb-1">Two-Factor Authentication</h2>
          <p className="text-xs text-gray-500 dark:text-white/50 mb-4">
            Optional extra protection for password sign-in, using an authenticator app (Microsoft Authenticator,
            Google Authenticator, Authy, or similar). It is off unless you turn it on.
          </p>

          {statusError && <p className="text-sm text-red-600 dark:text-red-400" role="alert">{statusError}</p>}
          {!status && !statusError && (
            <div aria-busy="true" aria-label="Loading security settings" className="space-y-2">
              <div className="skeleton-block h-5 rounded w-2/3" />
              <div className="skeleton-block h-10 rounded w-1/3" />
            </div>
          )}
          {actionMessage && <p className="text-sm text-green-700 dark:text-green-400 mb-3" role="status">{actionMessage}</p>}
          {actionError && <p className="text-sm text-red-600 dark:text-red-400 mb-3" role="alert">{actionError}</p>}

          {status && !status.canEnroll && (
            <p className="text-sm text-gray-700 dark:text-white/80">
              Your account signs in with Google, so two-factor authentication is handled by your identity
              provider rather than here. Nothing to set up on this page.
            </p>
          )}

          {status?.canEnroll && !status.mfaEnabled && !enrollment && !recoveryCodes && (
            <div>
              <p className="text-sm text-gray-700 dark:text-white/80 mb-3">
                Status: <strong>Off</strong>. When on, signing in takes your password plus a 6-digit code from
                your authenticator app.
              </p>
              <button
                type="button"
                onClick={() => void startEnrollment()}
                disabled={busy}
                className="nyx-button-metal px-4 py-2 rounded-lg text-sm font-semibold disabled:opacity-50"
              >
                Turn on two-factor authentication
              </button>
            </div>
          )}

          {enrollment && (
            <form onSubmit={confirmEnrollment} className="space-y-3">
              <p className="text-sm text-gray-700 dark:text-white/80">
                1. Add this account to your authenticator app using the setup key below (or the full setup link).
              </p>
              <div>
                <span className="text-xs font-semibold text-gray-600 dark:text-white/60">Setup key (manual entry)</span>
                <div className="mt-1 font-mono text-sm break-all border border-gray-200 dark:border-white/10 rounded-lg px-3 py-2 bg-gray-50 dark:bg-white/5 text-gray-900 dark:text-white">
                  {enrollment.secret}
                </div>
              </div>
              <div>
                <span className="text-xs font-semibold text-gray-600 dark:text-white/60">Setup link (otpauth)</span>
                <div className="mt-1 font-mono text-[11px] break-all border border-gray-200 dark:border-white/10 rounded-lg px-3 py-2 bg-gray-50 dark:bg-white/5 text-gray-600 dark:text-white/60">
                  {enrollment.otpauthUri}
                </div>
              </div>
              <div>
                <label className="text-xs font-semibold text-gray-600 dark:text-white/60" htmlFor="mfa-confirm-code">
                  2. Enter the 6-digit code the app shows for NyxHICSlab
                </label>
                <input
                  id="mfa-confirm-code"
                  type="text"
                  autoComplete="one-time-code"
                  value={confirmCode}
                  onChange={(e) => setConfirmCode(e.target.value)}
                  className="nyx-input mt-1 w-full border border-gray-300 rounded-lg px-3 py-2 text-sm"
                />
              </div>
              <div className="flex gap-2">
                <button type="submit" disabled={busy} className="nyx-button-metal px-4 py-2 rounded-lg text-sm font-semibold disabled:opacity-50">
                  Confirm and turn on
                </button>
                <button
                  type="button"
                  disabled={busy}
                  onClick={() => { setEnrollment(null); setConfirmCode(''); }}
                  className="px-4 py-2 rounded-lg text-sm font-medium border border-gray-300 text-gray-700 dark:text-white/80"
                >
                  Cancel
                </button>
              </div>
            </form>
          )}

          {recoveryCodes && (
            <div className="space-y-3" role="status">
              <p className="text-sm text-green-700 dark:text-green-400 font-semibold">Two-factor authentication is on.</p>
              <p className="text-sm text-gray-700 dark:text-white/80">
                Save these recovery codes somewhere safe. Each one works once, in place of an authenticator
                code, if you lose your phone. They are shown only now - they cannot be displayed again.
              </p>
              <ul className="grid grid-cols-2 gap-2 font-mono text-sm">
                {recoveryCodes.map((code) => (
                  <li key={code} className="border border-gray-200 dark:border-white/10 rounded-lg px-3 py-2 bg-gray-50 dark:bg-white/5 text-gray-900 dark:text-white text-center">
                    {code}
                  </li>
                ))}
              </ul>
              <button
                type="button"
                onClick={() => setRecoveryCodes(null)}
                className="nyx-button-metal px-4 py-2 rounded-lg text-sm font-semibold"
              >
                I saved my recovery codes
              </button>
            </div>
          )}

          {status?.canEnroll && status.mfaEnabled && (
            <form onSubmit={disableMfa} className="space-y-3">
              <p className="text-sm text-gray-700 dark:text-white/80">
                Status: <strong>On</strong>. To turn it off, enter a current authenticator code or an unused
                recovery code.
              </p>
              <div>
                <label className="text-xs font-semibold text-gray-600 dark:text-white/60" htmlFor="mfa-disable-code">Authenticator or recovery code</label>
                <input
                  id="mfa-disable-code"
                  type="text"
                  autoComplete="one-time-code"
                  value={disableCode}
                  onChange={(e) => setDisableCode(e.target.value)}
                  className="nyx-input mt-1 w-full border border-gray-300 rounded-lg px-3 py-2 text-sm"
                />
              </div>
              <button type="submit" disabled={busy} className="px-4 py-2 rounded-lg text-sm font-semibold border border-red-300 text-red-700 dark:text-red-300 disabled:opacity-50">
                Turn off two-factor authentication
              </button>
            </form>
          )}
        </div>
      </div>
    </div>
  );
}
