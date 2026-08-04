import { getStore, getStoreHealth, json, snapshotStore } from '../_store.js';
import { requireAuth, isEnterpriseAdmin } from '../_auth.js';

export default async function handler(req, res) {
  if (req.method !== 'GET') {
    return json(res, 405, { error: 'Method not allowed' });
  }

  const auth = requireAuth(req, res);
  if (!auth) {
    return;
  }

  const store = await getStore();
  const health = getStoreHealth();
  const snap = snapshotStore(store);

  const fullHealth = isEnterpriseAdmin(auth.claims)
    ? health
    : { mode: health.mode, redisConfigured: health.redisConfigured };

  return json(res, 200, {
    ok: true,
    store: {
      ...fullHealth,
      counts: {
        attempts: Array.isArray(snap.attempts) ? snap.attempts.length : 0,
        events: Array.isArray(snap.events) ? snap.events.length : 0,
        progressKeys: snap.progress ? Object.keys(snap.progress).length : 0,
        users: Array.isArray(snap.users) ? snap.users.length : 0,
        auditLogs: Array.isArray(snap.auditLogs) ? snap.auditLogs.length : 0,
        notifications: Array.isArray(snap.notifications) ? snap.notifications.length : 0,
      },
    },
  });
}
