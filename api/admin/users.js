import { appendAuditLog, createId, getStore, json, saveStore } from '../_store.js';

export default async function handler(req, res) {
  const store = await getStore();

  if (req.method === 'GET') {
    return json(res, 200, { users: store.users });
  }

  if (req.method === 'POST') {
    const body = req.body ?? {};
    if (!body.fullName || !body.email || !body.role) {
      return json(res, 400, { error: 'fullName, email and role are required' });
    }

    const user = {
      id: createId('usr'),
      fullName: String(body.fullName),
      email: String(body.email).toLowerCase(),
      role: String(body.role),
      facility: String(body.facility ?? 'all'),
      status: 'active',
      createdAt: new Date().toISOString(),
    };

    store.users.unshift(user);
    appendAuditLog(store, 'admin_user_created', { userId: user.id, role: user.role, facility: user.facility });
    await saveStore(store);
    return json(res, 201, { user });
  }

  return json(res, 405, { error: 'Method not allowed' });
}
