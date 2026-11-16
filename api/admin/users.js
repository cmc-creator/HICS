import { appendAuditLog, createId, getStore, json, saveStore } from '../_store.js';
import { isEnterpriseAdmin, requireAuth, resolveFacility, scopeByFacility } from '../_auth.js';
import { authorizeEndpoint } from '../_policy.js';
import { buildPasswordSetUrl, sendEmail } from '../_email.js';
import { createPasswordToken } from '../_passwords.js';
import { enforceRateLimit, parseJsonBody, validateBodyFields } from '../_security.js';

// The canonical role list, mirroring AppUserRole in
// hics-app/src/types/index.ts (and the roleOptions in
// tenantContext.tsx). Unknown roles are rejected at creation so a
// typo can never mint an account no policy recognizes (audit W8).
const KNOWN_ROLES = ['enterprise-admin', 'facility-admin', 'training-manager', 'facilitator', 'observer'];

// Credential material (password hashes, set-password token hashes)
// lives on the stored user record but must never leave the server.
function toPublicUser(user) {
  if (!user || typeof user !== 'object') {
    return user;
  }
  const { passwordHash, passwordTokenHash, passwordTokenExpiresAt, ...publicUser } = user;
  return publicUser;
}

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
    return json(res, 200, { users: scopedUsers.map(toPublicUser) });
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

    const role = String(body.role);
    if (!KNOWN_ROLES.includes(role)) {
      return json(res, 400, { error: `Unknown role: ${role}` });
    }

    const email = String(body.email).trim().toLowerCase();
    const users = Array.isArray(store.users) ? store.users : [];
    if (users.some((candidate) => String(candidate?.email || '').toLowerCase() === email)) {
      return json(res, 409, { error: 'A user with this email already exists' });
    }

    const facility = resolveFacility(body.facility, requesterFacility);
    if (!isEnterpriseAdmin(auth.claims) && requesterFacility !== 'all' && facility !== requesterFacility) {
      return json(res, 403, { error: 'Cannot create users outside your facility scope' });
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
    };

    store.users.unshift(user);

    // The new user starts passwordless: they get a set-password
    // token and an invite email with the link. The token is stored
    // (hashed) on the record before saving so the link works as
    // soon as the invite lands.
    const rawToken = createPasswordToken(store, user);
    appendAuditLog(store, 'admin_user_created', { userId: user.id, role: user.role, facility: user.facility });
    await saveStore(store);

    // Email failure must not fail the invite - the user record
    // already exists and an admin can re-send access later.
    const setPasswordUrl = buildPasswordSetUrl(rawToken);
    const invite = await sendEmail({
      to: user.email,
      subject: 'You have been invited to NyxHICSlab',
      text: [
        `Hello ${user.fullName},`,
        '',
        'An administrator has created a NyxHICSlab account for you.',
        'Use the link below to set your password and sign in. The link expires in 1 hour.',
        '',
        setPasswordUrl,
        '',
        'If you were not expecting this invitation, you can ignore this email.',
        '',
        '- NyxHICSlab',
      ].join('\n'),
      html: [
        `<p>Hello ${user.fullName},</p>`,
        '<p>An administrator has created a NyxHICSlab account for you. ',
        'Use the link below to set your password and sign in. The link expires in 1 hour.</p>',
        `<p><a href="${setPasswordUrl}">Set your password</a></p>`,
        '<p>If you were not expecting this invitation, you can ignore this email.</p>',
        '<p>- NyxHICSlab</p>',
      ].join(''),
    });

    return json(res, 201, { user: toPublicUser(user), inviteEmailSent: invite.sent === true });
  }

  return json(res, 405, { error: 'Method not allowed' });
}
