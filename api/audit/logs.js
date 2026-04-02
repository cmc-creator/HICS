import { addAuditLog, getStore, json } from '../_store.js';

export default async function handler(req, res) {
  const store = getStore();

  if (req.method === 'GET') {
    return json(res, 200, { logs: store.auditLogs.slice(0, 200) });
  }

  if (req.method === 'POST') {
    const body = req.body ?? {};
    if (!body.action || typeof body.action !== 'string') {
      return json(res, 400, { error: 'action is required' });
    }

    const entry = addAuditLog(body.action, typeof body.data === 'object' && body.data ? body.data : {});
    return json(res, 201, { log: entry });
  }

  return json(res, 405, { error: 'Method not allowed' });
}
