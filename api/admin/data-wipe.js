import { isEnterpriseAdmin, requireAuth } from '../_auth.js';
import { verifyPassword } from '../_passwords.js';
import { enforceRateLimit, parseJsonBody } from '../_security.js';
import {
  appendAuditLog,
  createInitialStore,
  json,
  loadStore,
  saveStore,
} from '../_store.js';

// Data wipe (enterprise-admin only) - the deletion half of the
// contract-end procedure behind the privacy policy's 90-day
// deletion promise (the return half is GET
// /api/admin/data-export; export first, then wipe).
//
//   POST /api/admin/data-wipe
//   body: { confirm: "WIPE", password }        - password accounts
//         { confirm: "WIPE", confirmEmail }    - SSO-only accounts
//
// Deliberately hard to fire by accident:
// - the literal confirm string "WIPE" is required;
// - the caller must re-authenticate: password accounts re-enter
//   their password (verified against the stored scrypt hash),
//   SSO-only accounts (no passwordHash on their record) type
//   their own account email back;
// - the caller's store record must exist - the wipe preserves
//   exactly that one record so the deployment is never bricked
//   (no users left = no way back in), and resets every other
//   collection to the initial-store defaults.
//
// Audit trail: a 'store_data_wipe_requested' entry is appended
// and saved to the PRE-wipe store (so an export or backup taken
// beforehand shows who authorized the destruction), then the
// fresh post-wipe store's audit log opens with a single
// 'store_data_wiped' entry recording by whom and when. All
// sessions die with the wipe (refreshTokens reset), including
// the caller's - they sign in again afterwards.

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return json(res, 405, { error: 'Method not allowed' });
  }

  if (!enforceRateLimit(req, res, {
    scope: 'admin-data-wipe',
    maxRequests: 5,
    windowMs: 15 * 60 * 1000,
  })) {
    return;
  }

  const auth = requireAuth(req, res);
  if (!auth) {
    return;
  }

  if (!isEnterpriseAdmin(auth.claims)) {
    return json(res, 403, { error: 'Forbidden' });
  }

  const body = parseJsonBody(req);
  if (!body || typeof body !== 'object') {
    return json(res, 400, { error: 'Invalid JSON payload' });
  }

  if (body.confirm !== 'WIPE') {
    return json(res, 400, { error: 'Wipe requires the confirmation { "confirm": "WIPE" }.' });
  }

  const store = await loadStore();
  if (!Array.isArray(store.users)) {
    store.users = [];
  }
  const callerEmail = String(auth.claims.email || '').toLowerCase();
  const caller = store.users.find(
    (candidate) => String(candidate?.email || '').toLowerCase() === callerEmail,
  );
  if (!caller) {
    return json(res, 400, {
      error: 'Your account record was not found in this deployment, so the wipe cannot preserve it. Refusing to proceed.',
    });
  }

  // Re-authentication, shaped by what the caller's record
  // supports: a stored password hash means re-enter the
  // password; an SSO-only record has nothing to verify a
  // password against, so the caller types their email back.
  if (typeof caller.passwordHash === 'string' && caller.passwordHash) {
    if (typeof body.password !== 'string' || !verifyPassword(body.password, caller.passwordHash)) {
      return json(res, 403, { error: 'Password re-entry did not match your account. The wipe did not run.' });
    }
  } else if (String(body.confirmEmail || '').trim().toLowerCase() !== callerEmail) {
    return json(res, 400, { error: 'Type your account email exactly to confirm the wipe.' });
  }

  const wipedAt = new Date().toISOString();
  const destroyed = {
    users: store.users.length - 1,
    attempts: Array.isArray(store.attempts) ? store.attempts.length : 0,
    events: Array.isArray(store.events) ? store.events.length : 0,
    leads: Array.isArray(store.leads) ? store.leads.length : 0,
    contracts: Array.isArray(store.contracts) ? store.contracts.length : 0,
    auditLogs: Array.isArray(store.auditLogs) ? store.auditLogs.length : 0,
  };

  // Final entry in the pre-wipe audit log, persisted before
  // anything is destroyed.
  appendAuditLog(store, 'store_data_wipe_requested', {
    by: callerEmail,
    at: wipedAt,
    destroyed,
  });
  await saveStore(store);

  // Reset in place: other handlers may hold this same store
  // object via the load cache, so replace its contents rather
  // than swapping in a different object.
  const fresh = createInitialStore();
  fresh.users = [caller];
  appendAuditLog(fresh, 'store_data_wiped', {
    by: callerEmail,
    at: wipedAt,
    preservedUser: callerEmail,
    destroyed,
  });
  for (const key of Object.keys(store)) {
    delete store[key];
  }
  Object.assign(store, fresh);
  await saveStore(store);

  return json(res, 200, {
    wiped: true,
    wipedAt,
    preservedUser: callerEmail,
    destroyed,
  });
}
