import { useMemo } from 'react';
import { facilityLabels, type FacilityType } from '../data/facilityProfiles';
import { useTenant } from '../lib/tenantContext';
import { getScenarioAttempts } from '../lib/trainingAnalytics';

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

  const attempts = useMemo(() => getScenarioAttempts(), []);
  const scopedAttempts = useMemo(
    () => (facility === 'all' ? attempts : attempts.filter((attempt) => attempt.facility === facility)),
    [attempts, facility],
  );

  const completionRate = useMemo(() => {
    if (scopedAttempts.length === 0) return 0;
    return Math.round(scopedAttempts.reduce((sum, item) => sum + item.scorePercent, 0) / scopedAttempts.length);
  }, [scopedAttempts]);

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="nyx-hero text-white py-6 px-4">
        <div className="max-w-7xl mx-auto">
          <h1 className="text-2xl font-bold">Facility Administration</h1>
          <p className="text-blue-200 text-sm mt-1">Tenant controls, role permissions, and facility-scoped reporting context</p>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-4 py-6 space-y-6">
        <div className="nyx-panel p-5">
          <h2 className="text-lg font-bold text-gray-900 mb-4">Tenant Profile</h2>
          <div className="grid md:grid-cols-3 gap-4">
            <div>
              <label htmlFor="tenant-name" className="text-xs font-semibold text-gray-600">Facility Name</label>
              <input
                id="tenant-name"
                value={displayName}
                onChange={(event) => setDisplayName(event.target.value)}
                className="nyx-input mt-1 w-full border border-gray-300 rounded-lg px-3 py-2 text-sm"
              />
            </div>
            <div>
              <label htmlFor="tenant-role" className="text-xs font-semibold text-gray-600">Current Role</label>
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
              <label htmlFor="tenant-facility" className="text-xs font-semibold text-gray-600">Reporting Scope</label>
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
          <div className="nyx-panel p-4">
            <div className="text-xs text-gray-500">Current Scope</div>
            <div className="text-lg font-bold text-gray-900 mt-1">{facilityLabels[facility]}</div>
          </div>
          <div className="nyx-panel p-4">
            <div className="text-xs text-gray-500">Attempts in Scope</div>
            <div className="text-2xl font-bold text-gray-900 mt-1">{scopedAttempts.length}</div>
          </div>
          <div className="nyx-panel p-4">
            <div className="text-xs text-gray-500">Average Score in Scope</div>
            <div className="text-2xl font-bold text-gray-900 mt-1">{completionRate}%</div>
          </div>
        </div>

        <div className="nyx-panel p-5">
          <h2 className="text-lg font-bold text-gray-900 mb-3">Permission Matrix</h2>
          <div className="grid md:grid-cols-3 gap-3 text-sm">
            <div className={`rounded-lg border p-3 ${canManageUsers ? 'border-green-300 bg-green-50' : 'border-gray-200 bg-gray-50'}`}>
              <div className="font-semibold">User Management</div>
              <div className="text-xs mt-1 text-gray-600">Create users, assign roles, and maintain access</div>
              <div className="text-xs font-bold mt-2">{canManageUsers ? 'ENABLED' : 'READ-ONLY'}</div>
            </div>
            <div className={`rounded-lg border p-3 ${canManageData ? 'border-green-300 bg-green-50' : 'border-gray-200 bg-gray-50'}`}>
              <div className="font-semibold">Data Governance</div>
              <div className="text-xs mt-1 text-gray-600">Clear telemetry/attempt data and manage retention actions</div>
              <div className="text-xs font-bold mt-2">{canManageData ? 'ENABLED' : 'RESTRICTED'}</div>
            </div>
            <div className="rounded-lg border border-blue-200 bg-blue-50 p-3">
              <div className="font-semibold">Report Export</div>
              <div className="text-xs mt-1 text-gray-600">CSV export for audit and training compliance records</div>
              <div className="text-xs font-bold mt-2">{role === 'observer' ? 'DISABLED' : 'ENABLED'}</div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
