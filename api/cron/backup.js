import crypto from 'node:crypto';
import {
  addAuditLog,
  createStoreBackup,
  isBackupSupported,
  json,
} from '../_store.js';

// Scheduled store backups (Vercel Cron, registered in
// vercel.json as a daily GET /api/cron/backup).
//
// Authorization is the CRON_SECRET env var and nothing else:
// Vercel Cron sends "Authorization: Bearer <CRON_SECRET>" when
// the project has CRON_SECRET set, and this handler accepts
// exactly that header - no user session, no signed token. The
// comparison is timing-safe. When CRON_SECRET is not set the
// endpoint answers 501 to everything rather than ever running
// unauthenticated; setting it in the Vercel project (Production)
// is the one manual step that turns the schedule on.
//
// The snapshot + prune work itself is createStoreBackup() from
// _store.js - the same helper the enterprise-admin endpoint
// (POST /api/admin/backup) uses, so manual and scheduled
// backups are identical in shape and retention (newest 14).

function isAuthorizedCronRequest(req) {
  const secret = String(process.env.CRON_SECRET || '');
  if (!secret) {
    return false;
  }
  const header = String(req.headers?.authorization || '');
  const presented = header.startsWith('Bearer ') ? header.slice('Bearer '.length) : '';
  const expectedBuffer = Buffer.from(secret, 'utf8');
  const presentedBuffer = Buffer.from(presented, 'utf8');
  return presentedBuffer.length === expectedBuffer.length
    && crypto.timingSafeEqual(presentedBuffer, expectedBuffer);
}

export default async function handler(req, res) {
  if (req.method !== 'GET') {
    return json(res, 405, { error: 'Method not allowed' });
  }

  if (!process.env.CRON_SECRET) {
    return json(res, 501, {
      error: 'Scheduled backups are not configured (CRON_SECRET is not set on this deployment).',
    });
  }

  if (!isAuthorizedCronRequest(req)) {
    return json(res, 401, { error: 'Unauthorized' });
  }

  if (!isBackupSupported()) {
    return json(res, 501, {
      error: 'Store backups require the Redis-backed store (Upstash is not configured on this deployment).',
    });
  }

  const backup = await createStoreBackup();
  if (!backup) {
    return json(res, 501, {
      error: 'Store backups require the Redis-backed store (Upstash is not configured on this deployment).',
    });
  }

  await addAuditLog('store_backup_created', {
    key: backup.key,
    bytes: backup.bytes,
    by: 'vercel-cron',
  });
  return json(res, 201, { backup });
}
