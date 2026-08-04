import { appendAuditLog, createId, getStore, json, saveStore } from '../_store.js';
import { isEnterpriseAdmin, requireAuth, scopeByFacility } from '../_auth.js';
import { authorizeEndpoint } from '../_policy.js';
import { enforceRateLimit, parseJsonBody, validateBodyFields } from '../_security.js';

export default async function handler(req, res) {
  if (!enforceRateLimit(req, res, {
    scope: 'admin-users',
    maxRequests: 80,
    windowMs: 5 * 60 * 1000,
  })) {
    return;
  }

  const auth = requireAuth(req, res);
  if (!auth) {
    return;
  }

  if (!authorizeEndpoint(res, 'ADMIN_USERS', req.method, auth.claims)) {
    return;
  }

  const store = await getStore();
  const requesterFacility = String(auth.claims.facility || 'all');

  if (req.method === 'GET') {
    const scopedUsers = scopeByFacility(store.users, auth.claims);
    return json(res, 200, { users: scopedUsers });
  }

  if (req.method === 'POST') {
    const body = parseJsonBody(req);
    if (!body || typeof body !== 'object') {
      return json(res, 400, { error: 'Invalid JSON payload' });
    }

    const validationError = validateBodyFields(body, [
      { name: 'fullName', required: true, type: 'string', minLength: 2, maxLength: 120 },
      { name: 'email', required: true, type: 'string', minLength: 5, maxLength: 256 },
      { name: 'role', required: true, type: 'string', minLength: 3, maxLength: 40 },
      { name: 'facility', required: false, type: 'string', maxLength: 80 },
    ]);
    if (validationError) {
      return json(res, 400, { error: validationError });
    }

    const facility = String(body.facility ?? requesterFacility === 'all' ? 'psychiatric-inpatient' : requesterFacility);
    if (!isEnterpriseAdmin(auth.claims) && requesterFacility !== 'all' && facility !== requesterFacility) {
      return json(res, 403, { error: 'Cannot create users outside your facility scope' });
    }

    const user = {
      id: createId('usr'),
      fullName: String(body.fullName),
      email: String(body.email).toLowerCase(),
      role: String(body.role),
      facility,
      organization: String(auth.claims.organization || 'Enterprise Health System'),
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
