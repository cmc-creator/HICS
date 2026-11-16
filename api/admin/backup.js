import { isEnterpriseAdmin, requireAuth } from '../_auth.js';
import { enforceRateLimit } from '../_security.js';
import {
  addAuditLog,
  createStoreBackup,
  isBackupSupported,
  json,
  listStoreBackups,
} from '../_store.js';

// Store backups (enterprise-admin only). The application state is
// a single Redis value; a backup is a timestamped verbatim copy
// of it in the same database, pruned to the newest 14. Restore is
// deliberately NOT an HTTP operation - it runs from
// scripts/restore-backup.mjs so bringing back an old state always
// takes a deliberate, logged, command-line action.
//
//   GET  /api/admin/backup -> { backups: [{ key, timestamp, bytes }] }
//   POST /api/admin/backup -> 201 { backup: { key, timestamp, bytes } }

export default async function handler(req, res) {
  if (!enforceRateLimit(req, res, {
    scope: 'admin-backup',
    maxRequests: 20,
    windowMs: 5 * 60 * 1000,
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

  if (!isBackupSupported()) {
    return json(res, 501, {
      error: 'Store backups require the Redis-backed store (Upstash is not configured on this deployment).',
    });
  }

  if (req.method === 'GET') {
    const backups = await listStoreBackups();
    return json(res, 200, { backups });
  }

  if (req.method === 'POST') {
    const backup = await createStoreBackup();
    if (!backup) {
      return json(res, 501, {
        error: 'Store backups require the Redis-backed store (Upstash is not configured on this deployment).',
      });
    }
    await addAuditLog('store_backup_created', {
      key: backup.key,
      bytes: backup.bytes,
      by: String(auth.claims.email || ''),
    });
    return json(res, 201, { backup });
  }

  return json(res, 405, { error: 'Method not allowed' });
}
