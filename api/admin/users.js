import { appendAuditLog, createId, json, readStore, updateStore } from '../_store.js';
import { isEnterpriseAdmin, requireAuth, scopeByFacility } from '../_auth.js';
import { authorizeEndpoint } from '../_policy.js';
import { enforceRateLimit, parseJsonBody, validateBodyFields } from '../_security.js';
import { ROLES, canAssignRole, isValidEmail, normalizeEmail, toPublicUser } from '../_users.js';

export default async function handler(req, res) {
  if (!await enforceRateLimit(req, res, {
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

  const requesterFacility = String(auth.claims.facility || 'all');

  if (req.method === 'GET') {
    const store = await readStore();
    const scopedUsers = scopeByFacility(store.users, auth.claims).map(toPublicUser);
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

    const email = normalizeEmail(body.email);
    if (!isValidEmail(email)) {
      return json(res, 400, { error: 'Invalid email format' });
    }

    const role = String(body.role);
    if (!ROLES.includes(role)) {
      return json(res, 400, { error: `role must be one of: ${ROLES.join(', ')}` });
    }
    if (!canAssignRole(auth.claims.role, role)) {
      return json(res, 403, { error: 'You cannot assign a role above your own' });
    }

    const defaultFacility = requesterFacility === 'all'
      ? (process.env.DEFAULT_USER_FACILITY || 'general-acute-care')
      : requesterFacility;
    const facility = role === 'enterprise-admin' ? 'all' : String(body.facility || defaultFacility);
    if (!isEnterpriseAdmin(auth.claims) && requesterFacility !== 'all' && facility !== requesterFacility) {
      return json(res, 403, { error: 'Cannot create users outside your facility scope' });
    }

    const result = await updateStore((store) => {
      if (store.users.some((existing) => normalizeEmail(existing.email) === email)) {
        return { conflict: true };
      }

      const user = {
        id: createId('usr'),
        fullName: String(body.fullName),
        email,
        role,
        facility,
        organization: String(auth.claims.organization || 'Enterprise Health System'),
        status: 'active',
        createdAt: new Date().toISOString(),
        createdBy: String(auth.claims.email || ''),
      };

      store.users.unshift(user);
      appendAuditLog(store, 'admin_user_created', {
        userId: user.id,
        role: user.role,
        facility: user.facility,
        actorEmail: String(auth.claims.email || ''),
      });
      return { user };
    });

    if (result.conflict) {
      return json(res, 409, { error: 'A user with that email already exists' });
    }
    return json(res, 201, { user: toPublicUser(result.user) });
  }

  return json(res, 405, { error: 'Method not allowed' });
}
