import { isEnterpriseAdmin, requireAuth } from '../_auth.js';
import { enforceRateLimit } from '../_security.js';
import { addAuditLog, json, loadStore, snapshotStore } from '../_store.js';

// Full data export (enterprise-admin only).
//
//   GET /api/admin/data-export -> the entire store as a JSON
//   download (Content-Disposition: attachment).
//
// This is the first half of the contract-end procedure the
// privacy policy promises (data return, then deletion - the
// wipe half is POST /api/admin/data-wipe): before a customer's
// deployment is torn down, their data is exported and handed
// over. The export is a point-in-time snapshot taken BEFORE the
// audit entry for the export itself is written, and every
// export is audit-logged with who took it and how large it was.

export default async function handler(req, res) {
  if (req.method !== 'GET') {
    return json(res, 405, { error: 'Method not allowed' });
  }

  if (!enforceRateLimit(req, res, {
    scope: 'admin-data-export',
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

  const store = await loadStore();
  const exportedAt = new Date().toISOString();
  const payload = {
    exportedAt,
    exportedBy: String(auth.claims.email || ''),
    store: snapshotStore(store),
  };
  const bytes = Buffer.byteLength(JSON.stringify(payload));

  await addAuditLog('store_data_exported', {
    by: String(auth.claims.email || ''),
    bytes,
  });

  res.setHeader(
    'Content-Disposition',
    `attachment; filename="nyxhicslab-data-export-${exportedAt.slice(0, 10)}.json"`,
  );
  return json(res, 200, payload);
}
