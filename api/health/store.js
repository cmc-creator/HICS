import { getStoreHealth, json, readStore } from '../_store.js';
import { requireAuth, isEnterpriseAdmin } from '../_auth.js';

export default async function handler(req, res) {
  if (req.method !== 'GET') {
    return json(res, 405, { error: 'Method not allowed' });
  }

  const auth = requireAuth(req, res);
  if (!auth) {
    return;
  }

  let store;
  try {
    store = await readStore();
  } catch (error) {
    console.error('store health check failed', error);
    return json(res, 503, { ok: false, error: 'Datastore unavailable' });
  }

  const health = getStoreHealth();
  const fullHealth = isEnterpriseAdmin(auth.claims)
    ? health
    : { mode: health.mode, durable: health.durable, redisConfigured: health.redisConfigured };

  return json(res, 200, {
    ok: true,
    store: {
      ...fullHealth,
      counts: {
        attempts: store.attempts.length,
        events: store.events.length,
        progressKeys: Object.keys(store.progress).length,
        users: store.users.length,
        auditLogs: store.auditLogs.length,
        notifications: store.notifications.length,
      },
    },
  });
}
