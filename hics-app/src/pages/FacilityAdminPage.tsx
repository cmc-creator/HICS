import { useEffect, useMemo, useState } from 'react';
import { facilityLabels, type FacilityType } from '../data/facilityProfiles';
import { useTenant } from '../lib/tenantContext';
import { useAuth } from '../lib/authContext';
import { getScenarioAttempts, type ScenarioAttempt } from '../lib/trainingAnalytics';
import { publicApiRequest } from '../lib/apiClient';
import { resetAiAssistantEnabledCache } from '../lib/assistantSettings';
import { writeAuditLog } from '../lib/notifications';
import { useToast } from '../lib/toast';

interface AdminUser {
  id: string;
  fullName: string;
  email: string;
  role: string;
  facility: string;
  status: string;
  createdAt: string;
}

interface AuditLogEntry {
  id: string;
  action: string;
  at: string;
}

export default function FacilityAdminPage() {
  const {
    role,
    displayName,
    facility,
    roleOptions,
    facilityOptions,
    canManageUsers,
    canManageData,
    setRole,
    setFacility,
    setDisplayName,
  } = useTenant();

  // The signed-in user's REAL role, from the auth session (issued
  // by the sign-in endpoints from the store record). The tenant
  // role above is only a preview switcher for reporting scope -
  // it is not a permission and is labeled as such below.
  const { user: authUser } = useAuth();
  const toast = useToast();
  const signedInRoleLabel = authUser?.role
    ? (roleOptions.find((option) => option.value === authUser.role)?.label ?? authUser.role)
    : 'Not recorded - sign in again';

  const [attempts, setAttempts] = useState<ScenarioAttempt[]>([]);
  const [users, setUsers] = useState<AdminUser[]>([]);
  const [auditLogs, setAuditLogs] = useState<AuditLogEntry[]>([]);
  const [newUserName, setNewUserName] = useState('');
  const [newUserEmail, setNewUserEmail] = useState('');
  const [newUserRole, setNewUserRole] = useState('facilitator');
  const [newUserFacility, setNewUserFacility] = useState<FacilityType>('general-acute-care');
  const [addUserError, setAddUserError] = useState<string | null>(null);
  const [addingUser, setAddingUser] = useState(false);
  const [adminLoading, setAdminLoading] = useState(true);

  // Per-facility AI assistant switch (store setting, admin write).
  // Null = still loading; the toggle renders once the value lands.
  const [aiAssistantEnabled, setAiAssistantEnabled] = useState<boolean | null>(null);
  const [aiToggleSaving, setAiToggleSaving] = useState(false);
  const [aiToggleError, setAiToggleError] = useState<string | null>(null);

  useEffect(() => {
    let live = true;
    publicApiRequest<{ aiAssistantEnabled?: boolean }>('/admin/settings', { method: 'GET' })
      .then((result) => {
        if (live) {
          setAiAssistantEnabled(result?.aiAssistantEnabled !== false);
        }
      })
      .catch(() => {
        if (live) {
          setAiToggleError('Could not load the AI assistant setting.');
        }
      });
    return () => {
      live = false;
    };
  }, []);

  const handleAiToggle = async (next: boolean) => {
    setAiToggleSaving(true);
    setAiToggleError(null);
    try {
      const result = await publicApiRequest<{ aiAssistantEnabled?: boolean }>('/admin/settings', {
        method: 'PUT',
        body: JSON.stringify({ aiAssistantEnabled: next }),
      });
      setAiAssistantEnabled(result?.aiAssistantEnabled !== false);
      // The assistant entry points cache the setting per page
      // load; drop the cache so this browser reflects the change.
      resetAiAssistantEnabledCache();
      toast.success(next ? 'AI assistant enabled for this facility.' : 'AI assistant disabled for this facility.');
    } catch (err) {
      setAiToggleError(err instanceof Error ? err.message : 'Failed to update the AI assistant setting.');
    } finally {
      setAiToggleSaving(false);
    }
  };

  const loadAdminData = async () => {
    const nextAttempts = await getScenarioAttempts();
    setAttempts(nextAttempts);

    try {
      const [usersResponse, logsResponse] = await Promise.all([
        publicApiRequest<{ users: AdminUser[] }>('/admin/users', { method: 'GET' }),
        publicApiRequest<{ logs: AuditLogEntry[] }>('/audit/logs', { method: 'GET' }),
      ]);
      setUsers(Array.isArray(usersResponse?.users) ? usersResponse.users : []);
      setAuditLogs(Array.isArray(logsResponse?.logs) ? logsResponse.logs.slice(0, 10) : []);
    } catch {
      setUsers([]);
      setAuditLogs([]);
    } finally {
      setAdminLoading(false);
    }
  };

  useEffect(() => {
    void loadAdminData();
  }, []);

  const scopedAttempts = useMemo(
    () => (facility === 'all' ? attempts : attempts.filter((attempt) => attempt.facility === facility)),
    [attempts, facility],
  );

  const completionRate = useMemo(() => {
    if (scopedAttempts.length === 0) return 0;
    return Math.round(scopedAttempts.reduce((sum, item) => sum + item.scorePercent, 0) / scopedAttempts.length);
  }, [scopedAttempts]);

  const handleCreateUser = async (event: React.FormEvent) => {
    event.preventDefault();
    setAddUserError(null);

    if (!newUserName.trim() || !newUserEmail.includes('@')) {
      setAddUserError('Enter a valid full name and work email address.');
      return;
    }

    setAddingUser(true);
    try {
      await publicApiRequest('/admin/users', {
        method: 'POST',
        body: JSON.stringify({
          fullName: newUserName.trim(),
          email: newUserEmail.trim().toLowerCase(),
          role: newUserRole,
          facility: newUserFacility,
        }),
      });

      await writeAuditLog('admin_user_invite_submitted', {
        role: newUserRole,
        facility: newUserFacility,
      });

      setNewUserName('');
      setNewUserEmail('');
      setNewUserRole('facilitator');
      setNewUserFacility('psychiatric-inpatient');
      toast.success(`User invited - ${newUserEmail.trim().toLowerCase()} will set their password from the email link.`);
      await loadAdminData();
    } catch (err) {
      setAddUserError(err instanceof Error ? err.message : 'Failed to create user. Please try again.');
    } finally {
      setAddingUser(false);
    }
  };

  return (
    <div className="min-h-screen bg-gray-50 lux-page">
      <div className="max-w-7xl mx-auto px-4 pt-6">
        <div className="page-head">
          <h1 className="text-xl md:text-2xl font-bold lux-title">Facility Administration</h1>
          <p className="page-head-sub text-sm mt-1 lux-subtitle">Tenant controls, user onboarding, and compliance-ready audit visibility</p>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-4 py-6 space-y-6">
        <div className="nyx-panel p-5">
          <h2 className="text-lg font-bold text-gray-900 dark:text-white mb-4">Tenant Profile</h2>
          <div className="grid md:grid-cols-2 xl:grid-cols-4 gap-4">
            <div>
              <label htmlFor="tenant-name" className="text-xs font-semibold text-gray-600 dark:text-white/60">Facility Name</label>
              <input
                id="tenant-name"
                value={displayName}
                onChange={(event) => setDisplayName(event.target.value)}
                className="nyx-input mt-1 w-full border border-gray-300 rounded-lg px-3 py-2 text-sm"
              />
            </div>
            <div>
              <span className="text-xs font-semibold text-gray-600 dark:text-white/60">Signed-in Role</span>
              <div className="mt-1 w-full border border-gray-200 dark:border-white/10 rounded-lg px-3 py-2 text-sm bg-gray-50 dark:bg-white/5 text-gray-800 dark:text-white">
                {signedInRoleLabel}
              </div>
              <p className="text-[11px] text-gray-500 dark:text-white/50 mt-1">Your actual permission, from your account. It cannot be changed here.</p>
            </div>
            <div>
              <label htmlFor="tenant-role" className="text-xs font-semibold text-gray-600 dark:text-white/60">Preview As Role</label>
              <select
                id="tenant-role"
                value={role}
                onChange={(event) => setRole(event.target.value as typeof role)}
                className="select-comfort mt-1 w-full border border-gray-300 rounded-lg px-3 py-2 text-sm bg-white text-gray-800"
              >
                {roleOptions.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>
              <p className="text-[11px] text-gray-500 dark:text-white/50 mt-1">Preview only - changes reporting scope displays, never your permissions.</p>
            </div>
            <div>
              <label htmlFor="tenant-facility" className="text-xs font-semibold text-gray-600 dark:text-white/60">Reporting Scope</label>
              <select
                id="tenant-facility"
                value={facility}
                onChange={(event) => setFacility(event.target.value as FacilityType)}
                className="select-comfort mt-1 w-full border border-gray-300 rounded-lg px-3 py-2 text-sm bg-white text-gray-800"
              >
                {facilityOptions.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>
            </div>
          </div>
        </div>

        <div className="nyx-panel p-5">
          <h2 className="text-lg font-bold text-gray-900 dark:text-white mb-1">Facility Settings</h2>
          <p className="text-xs text-gray-500 dark:text-white/50 mb-4">Settings apply to the whole facility and are enforced by the server, not just hidden in the interface.</p>
          <div className="flex items-start justify-between gap-4">
            <div>
              <div className="text-sm font-semibold text-gray-900 dark:text-white">AI Assistant</div>
              <p className="text-xs text-gray-600 dark:text-white/60 mt-1 max-w-xl">
                When off, the AI assistant is unavailable to every user in this facility: the assistant
                entry points are hidden and the server refuses chat requests before any AI provider is contacted.
              </p>
              {aiToggleError && (
                <p className="text-xs text-red-600 dark:text-red-400 mt-2">{aiToggleError}</p>
              )}
            </div>
            <label className="flex items-center gap-2 text-sm font-medium text-gray-800 dark:text-white shrink-0">
              <input
                type="checkbox"
                checked={aiAssistantEnabled === true}
                disabled={aiAssistantEnabled === null || aiToggleSaving}
                onChange={(event) => void handleAiToggle(event.target.checked)}
                aria-label="Enable the AI assistant for this facility"
              />
              {aiAssistantEnabled === null ? 'Loading...' : aiAssistantEnabled ? 'Enabled' : 'Disabled'}
            </label>
          </div>
        </div>

        <div className="grid md:grid-cols-3 gap-4">
          <div className="nyx-panel p-4 report-stat-card">
            <div className="text-xs text-gray-500">Current Scope</div>
            <div className="text-lg font-bold text-gray-900 dark:text-white mt-1">{facilityLabels[facility]}</div>
          </div>
          <div className="nyx-panel p-4 report-stat-card">
            <div className="text-xs text-gray-500">Attempts in Scope</div>
            <div className="text-2xl font-bold text-gray-900 dark:text-white mt-1">{scopedAttempts.length}</div>
          </div>
          <div className="nyx-panel p-4 report-stat-card">
            <div className="text-xs text-gray-500">Average Score in Scope</div>
            <div className="text-2xl font-bold text-gray-900 dark:text-white mt-1">{completionRate}%</div>
          </div>
        </div>

        <div className="grid xl:grid-cols-2 gap-6">
          <div className="nyx-panel p-5">
            <h2 className="text-lg font-bold text-gray-900 dark:text-white mb-3">User Provisioning</h2>
            <form onSubmit={handleCreateUser} className="space-y-3">
              <div>
                <label className="text-xs font-semibold text-gray-600 dark:text-white/60" htmlFor="new-user-name">Full Name</label>
                <input id="new-user-name" value={newUserName} onChange={(e) => setNewUserName(e.target.value)} className="nyx-input mt-1 w-full border border-gray-300 rounded-lg px-3 py-2 text-sm" />
              </div>
              <div>
                <label className="text-xs font-semibold text-gray-600 dark:text-white/60" htmlFor="new-user-email">Work Email</label>
                <input id="new-user-email" type="email" value={newUserEmail} onChange={(e) => setNewUserEmail(e.target.value)} className="nyx-input mt-1 w-full border border-gray-300 rounded-lg px-3 py-2 text-sm" />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs font-semibold text-gray-600 dark:text-white/60" htmlFor="new-user-role">Role</label>
                  <select id="new-user-role" value={newUserRole} onChange={(e) => setNewUserRole(e.target.value)} className="select-comfort mt-1 w-full border border-gray-300 rounded-lg px-3 py-2 text-sm bg-white text-gray-800">
                    {roleOptions.map((option) => (
                      <option key={option.value} value={option.value}>{option.label}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="text-xs font-semibold text-gray-600 dark:text-white/60" htmlFor="new-user-facility">Facility</label>
                  <select id="new-user-facility" value={newUserFacility} onChange={(e) => setNewUserFacility(e.target.value as FacilityType)} className="select-comfort mt-1 w-full border border-gray-300 rounded-lg px-3 py-2 text-sm bg-white text-gray-800">
                    {facilityOptions.filter((item) => item.value !== 'all').map((option) => (
                      <option key={option.value} value={option.value}>{option.label}</option>
                    ))}
                  </select>
                </div>
              </div>
              <button type="submit" className="nyx-button-metal px-4 py-2 rounded-lg text-sm font-semibold disabled:opacity-60 disabled:cursor-not-allowed" disabled={!canManageUsers || addingUser}>
                {addingUser ? <><span className="spinner" aria-hidden="true" /> Adding...</> : 'Add User'}
              </button>
              {addUserError && (
                <p className="text-xs text-red-600 dark:text-red-400 mt-1" role="alert">{addUserError}</p>
              )}
            </form>

            <div className="mt-4 space-y-2">
              {adminLoading ? (
                <div aria-busy="true" aria-label="Loading users">
                  {[0, 1].map((row) => <div key={row} className="skeleton-block h-14 rounded-lg mb-2" />)}
                </div>
              ) : users.length === 0 ? (
                <p className="text-xs text-gray-500 dark:text-white/50 border border-dashed border-gray-300 dark:border-white/15 rounded-lg p-3">
                  No users yet in this view. Add the first user above - they will receive an email to set their password.
                </p>
              ) : null}
              {users.slice(0, 8).map((u) => (
                <div key={u.id} className="rounded-lg border border-gray-200 dark:border-white/10 p-3 flex items-center justify-between text-sm">
                  <div>
                    <div className="font-semibold text-gray-900 dark:text-white">{u.fullName}</div>
                    <div className="text-xs text-gray-500 dark:text-white/50">{u.email} · {u.facility}</div>
                  </div>
                  <span className="nyx-chip">{u.role}</span>
                </div>
              ))}
            </div>
          </div>

          <div className="nyx-panel p-5">
            <h2 className="text-lg font-bold text-gray-900 dark:text-white mb-1">Permission Matrix</h2>
            <p className="text-[11px] text-gray-500 dark:text-white/50 mb-3">Shown for the role selected under Preview As Role - a preview, not your signed-in permission.</p>
            <div className="grid gap-3 text-sm mb-4">
              <div className={`rounded-lg border p-3 ${canManageUsers ? 'border-green-300 bg-green-50 dark:border-green-700 dark:bg-green-900/30' : 'border-gray-200 bg-gray-50 dark:border-white/10 dark:bg-white/5'}`}>
                <div className="font-semibold">User Management</div>
                <div className="text-xs mt-1 text-gray-600 dark:text-white/60">Create users, assign roles, and maintain access</div>
                <div className="text-xs font-bold mt-2">{canManageUsers ? 'ENABLED' : 'READ-ONLY'}</div>
              </div>
              <div className={`rounded-lg border p-3 ${canManageData ? 'border-green-300 bg-green-50 dark:border-green-700 dark:bg-green-900/30' : 'border-gray-200 bg-gray-50 dark:border-white/10 dark:bg-white/5'}`}>
                <div className="font-semibold">Data Governance</div>
                <div className="text-xs mt-1 text-gray-600 dark:text-white/60">Clear telemetry/attempt data and manage retention actions</div>
                <div className="text-xs font-bold mt-2">{canManageData ? 'ENABLED' : 'RESTRICTED'}</div>
              </div>
              <div className="rounded-lg nyx-tint p-3 role-selected-row">
                <div className="font-semibold">Report Export</div>
                <div className="text-xs mt-1 text-gray-600 dark:text-white/60">CSV export for audit and training compliance records</div>
                <div className="text-xs font-bold mt-2">{role === 'observer' ? 'DISABLED' : 'ENABLED'}</div>
              </div>
            </div>

            <h3 className="text-sm font-bold text-gray-900 dark:text-white mb-2">Recent Audit Entries</h3>
            <div className="space-y-2">
              {adminLoading ? (
                <div aria-busy="true" aria-label="Loading audit entries">
                  {[0, 1].map((row) => <div key={row} className="skeleton-block h-12 rounded-lg mb-2" />)}
                </div>
              ) : auditLogs.length === 0 ? (
                <p className="text-xs text-gray-500 dark:text-white/50">No audit entries yet.</p>
              ) : (
                auditLogs.map((log) => (
                  <div key={log.id} className="rounded-lg border border-gray-200 dark:border-white/10 p-3">
                    <div className="text-xs text-gray-500 dark:text-white/50">{new Date(log.at).toLocaleString()}</div>
                    <div className="text-sm font-semibold text-gray-900 dark:text-white">{log.action}</div>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
