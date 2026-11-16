import { getStore, getStoreHealth, isBackupSupported, json, listStoreBackups, snapshotStore } from '../_store.js';
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

  // Backup visibility for the enterprise admin (count + most
  // recent snapshot). Best-effort: a backup-listing failure must
  // never take the health endpoint down with it.
  let backups;
  if (isEnterpriseAdmin(auth.claims) && isBackupSupported()) {
    try {
      const list = await listStoreBackups();
      backups = {
        count: list.length,
        latestAt: list.length > 0 ? list[0].timestamp : null,
      };
    } catch (error) {
      console.error('[NyxHICSlab] Backup listing for health failed:', error instanceof Error ? error.message : error);
    }
  }

  return json(res, 200, {
    ok: true,
    store: {
      ...fullHealth,
      ...(backups ? { backups } : {}),
      counts: {
        attempts: Array.isArray(snap.attempts) ? snap.attempts.length : 0,
        events: Array.isArray(snap.events) ? snap.events.length : 0,
        progressKeys: snap.progress ? Object.keys(snap.progress).length : 0,
        users: Array.isArray(snap.users) ? snap.users.length : 0,
        auditLogs: Array.isArray(snap.auditLogs) ? snap.auditLogs.length : 0,
        notifications: Array.isArray(snap.notifications) ? snap.notifications.length : 0,
        leads: Array.isArray(snap.leads) ? snap.leads.length : 0,
      },
    },
  });
}
