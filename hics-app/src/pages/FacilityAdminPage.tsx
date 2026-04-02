import { useEffect, useMemo, useState } from 'react';
import { facilityLabels, type FacilityType } from '../data/facilityProfiles';
import { useTenant } from '../lib/tenantContext';
import { getScenarioAttempts, type ScenarioAttempt } from '../lib/trainingAnalytics';
import { publicApiRequest } from '../lib/apiClient';
import { writeAuditLog } from '../lib/notifications';

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

  const [attempts, setAttempts] = useState<ScenarioAttempt[]>([]);
  const [users, setUsers] = useState<AdminUser[]>([]);
  const [auditLogs, setAuditLogs] = useState<AuditLogEntry[]>([]);
  const [newUserName, setNewUserName] = useState('');
  const [newUserEmail, setNewUserEmail] = useState('');
  const [newUserRole, setNewUserRole] = useState('facilitator');
  const [newUserFacility, setNewUserFacility] = useState<FacilityType>('psychiatric-inpatient');

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
    if (!newUserName.trim() || !newUserEmail.includes('@')) {
      return;
    }

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
      await loadAdminData();
    } catch {
      // Keep form populated so admin can retry.
    }
  };

  return (
    <div className="min-h-screen bg-gray-50 lux-page">
      <div className="nyx-hero text-white py-6 px-4 relative overflow-hidden">
        <div className="lux-grid-pattern" />
        <div className="max-w-7xl mx-auto">
          <div className="lux-hero-shell">
            <h1 className="text-2xl font-bold lux-title">Facility Administration</h1>
            <p className="text-blue-200 text-sm mt-1 lux-subtitle">Tenant controls, user onboarding, and compliance-ready audit visibility</p>
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-4 py-6 space-y-6">
        <div className="nyx-panel p-5">
          <h2 className="text-lg font-bold text-gray-900 dark:text-white mb-4">Tenant Profile</h2>
          <div className="grid md:grid-cols-3 gap-4">
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
              <label htmlFor="tenant-role" className="text-xs font-semibold text-gray-600 dark:text-white/60">Current Role</label>
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
              <button type="submit" className="nyx-button-metal px-4 py-2 rounded-lg text-sm font-semibold" disabled={!canManageUsers}>
                Add User
              </button>
            </form>

            <div className="mt-4 space-y-2">
              {users.slice(0, 8).map((u) => (
                <div key={u.id} className="rounded-lg border border-gray-200 dark:border-white/10 p-3 flex items-center justify-between text-sm">
                  <div>
                    <div className="font-semibold text-gray-900 dark:text-white">{u.fullName}</div>
                    <div className="text-xs text-gray-500 dark:text-white/50">{u.email} · {u.facility}</div>
                  </div>
                  <span className="text-xs px-2 py-1 rounded-full bg-blue-100 text-blue-700">{u.role}</span>
                </div>
              ))}
            </div>
          </div>

          <div className="nyx-panel p-5">
            <h2 className="text-lg font-bold text-gray-900 dark:text-white mb-3">Permission Matrix</h2>
            <div className="grid gap-3 text-sm mb-4">
              <div className={`rounded-lg border p-3 ${canManageUsers ? 'border-green-300 bg-green-50' : 'border-gray-200 bg-gray-50'}`}>
                <div className="font-semibold">User Management</div>
                <div className="text-xs mt-1 text-gray-600 dark:text-white/60">Create users, assign roles, and maintain access</div>
                <div className="text-xs font-bold mt-2">{canManageUsers ? 'ENABLED' : 'READ-ONLY'}</div>
              </div>
              <div className={`rounded-lg border p-3 ${canManageData ? 'border-green-300 bg-green-50' : 'border-gray-200 bg-gray-50'}`}>
                <div className="font-semibold">Data Governance</div>
                <div className="text-xs mt-1 text-gray-600 dark:text-white/60">Clear telemetry/attempt data and manage retention actions</div>
                <div className="text-xs font-bold mt-2">{canManageData ? 'ENABLED' : 'RESTRICTED'}</div>
              </div>
              <div className="rounded-lg border border-blue-200 bg-blue-50 p-3 role-selected-row">
                <div className="font-semibold">Report Export</div>
                <div className="text-xs mt-1 text-gray-600 dark:text-white/60">CSV export for audit and training compliance records</div>
                <div className="text-xs font-bold mt-2">{role === 'observer' ? 'DISABLED' : 'ENABLED'}</div>
              </div>
            </div>

            <h3 className="text-sm font-bold text-gray-900 dark:text-white mb-2">Recent Audit Entries</h3>
            <div className="space-y-2">
              {auditLogs.length === 0 ? (
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
