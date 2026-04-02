import { appendAuditLog, getStore, json, saveStore } from '../_store.js';

export default async function handler(req, res) {
  const store = await getStore();

  if (req.method === 'GET') {
    const key = String(req.query?.key ?? '');
    if (!key) {
      return json(res, 400, { error: 'key query parameter is required' });
    }

    return json(res, 200, { progress: store.progress[key] ?? null });
  }

  if (req.method === 'PUT') {
    const { key, progress } = req.body ?? {};
    if (!key || typeof key !== 'string' || !progress || typeof progress !== 'object') {
      return json(res, 400, { error: 'key and progress are required' });
    }

    store.progress[key] = {
      ...progress,
      updatedAt: new Date().toISOString(),
    };

    appendAuditLog(store, 'scenario_progress_saved', { key });
    await saveStore(store);
    return json(res, 200, { ok: true });
  }

  if (req.method === 'DELETE') {
    const key = String(req.query?.key ?? '');
    if (!key) {
      return json(res, 400, { error: 'key query parameter is required' });
    }

    delete store.progress[key];
    appendAuditLog(store, 'scenario_progress_cleared', { key });
    await saveStore(store);
    return json(res, 204, {});
  }

  return json(res, 405, { error: 'Method not allowed' });
}
