import { createContext, useContext, useMemo, useState } from 'react';
import { facilityOptions, normalizeFacility, type FacilityType } from '../data/facilityProfiles';
import type { AppUserRole } from '../types';

const TENANT_ROLE_KEY = 'nyx-tenant-role';
const TENANT_FACILITY_KEY = 'nyx-tenant-facility';
const TENANT_NAME_KEY = 'nyx-tenant-display-name';

const roleOptions: Array<{ value: AppUserRole; label: string }> = [
  { value: 'enterprise-admin', label: 'Enterprise Admin' },
  { value: 'facility-admin', label: 'Facility Admin' },
  { value: 'training-manager', label: 'Training Manager' },
  { value: 'facilitator', label: 'Facilitator' },
  { value: 'observer', label: 'Observer' },
];

interface TenantContextValue {
  role: AppUserRole;
  facility: FacilityType;
  displayName: string;
  roleOptions: Array<{ value: AppUserRole; label: string }>;
  facilityOptions: typeof facilityOptions;
  canManageUsers: boolean;
  canManageData: boolean;
  canExportReports: boolean;
  setRole: (role: AppUserRole) => void;
  setFacility: (facility: FacilityType) => void;
  setDisplayName: (name: string) => void;
}

const TenantContext = createContext<TenantContextValue | null>(null);

function readStoredRole(): AppUserRole {
  const stored = localStorage.getItem(TENANT_ROLE_KEY);
  const allowed = new Set(roleOptions.map((option) => option.value));
  return stored && allowed.has(stored as AppUserRole) ? (stored as AppUserRole) : 'facility-admin';
}

export function TenantProvider({ children }: { children: React.ReactNode }) {
  const [role, setRoleState] = useState<AppUserRole>(() => readStoredRole());
  const [facility, setFacilityState] = useState<FacilityType>(() => normalizeFacility(localStorage.getItem(TENANT_FACILITY_KEY)));
  const [displayName, setDisplayNameState] = useState<string>(() => localStorage.getItem(TENANT_NAME_KEY) ?? 'North Campus Behavioral Health');

  const setRole = (nextRole: AppUserRole) => {
    setRoleState(nextRole);
    localStorage.setItem(TENANT_ROLE_KEY, nextRole);
  };

  const setFacility = (nextFacility: FacilityType) => {
    const normalized = normalizeFacility(nextFacility);
    setFacilityState(normalized);
    localStorage.setItem(TENANT_FACILITY_KEY, normalized);
  };

  const setDisplayName = (nextName: string) => {
    const value = nextName.trim() || 'North Campus Behavioral Health';
    setDisplayNameState(value);
    localStorage.setItem(TENANT_NAME_KEY, value);
  };

  const value = useMemo<TenantContextValue>(() => {
    const canManageUsers = role === 'enterprise-admin' || role === 'facility-admin';
    const canManageData = canManageUsers || role === 'training-manager';
    const canExportReports = canManageData || role === 'facilitator';

    return {
      role,
      facility,
      displayName,
      roleOptions,
      facilityOptions,
      canManageUsers,
      canManageData,
      canExportReports,
      setRole,
      setFacility,
      setDisplayName,
    };
  }, [role, facility, displayName]);

  return <TenantContext.Provider value={value}>{children}</TenantContext.Provider>;
}

export function useTenant() {
  const context = useContext(TenantContext);
  if (!context) {
    throw new Error('useTenant must be used within TenantProvider');
  }
  return context;
}
