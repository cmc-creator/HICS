const STORE_KEY = '__nyx_hics_store__';

function createInitialStore() {
  return {
    attempts: [],
    events: [],
    progress: {},
    users: [
      {
        id: 'usr-1',
        fullName: 'Alex Rivera',
        email: 'alex.rivera@northcampus.org',
        role: 'facility-admin',
        facility: 'behavioral-health-north',
        status: 'active',
        createdAt: new Date().toISOString(),
      },
      {
        id: 'usr-2',
        fullName: 'Jamie Patel',
        email: 'jamie.patel@northcampus.org',
        role: 'facilitator',
        facility: 'behavioral-health-south',
        status: 'active',
        createdAt: new Date().toISOString(),
      },
    ],
    auditLogs: [],
    notifications: [],
  };
}

export function getStore() {
  if (!globalThis[STORE_KEY]) {
    globalThis[STORE_KEY] = createInitialStore();
  }
  return globalThis[STORE_KEY];
}

export function createId(prefix) {
  return `${prefix}-${Date.now()}-${Math.floor(Math.random() * 100000)}`;
}

export function addAuditLog(action, data = {}) {
  const store = getStore();
  const entry = {
    id: createId('audit'),
    action,
    at: new Date().toISOString(),
    data,
  };
  store.auditLogs.unshift(entry);
  store.auditLogs = store.auditLogs.slice(0, 2000);
  return entry;
}

export function json(res, status, payload) {
  return res.status(status).json(payload);
}
