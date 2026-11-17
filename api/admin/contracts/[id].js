import { requireAuth } from '../../_auth.js';
import { authorizeEndpoint } from '../../_policy.js';
import { enforceRateLimit } from '../../_security.js';
import { getRouteParam, toContractDetail } from '../../_contracts.js';
import { json, reloadStore } from '../../_store.js';

//   GET /api/admin/contracts/:id -> { contract: detail }
//
// Enterprise-admin only (ADMIN_CONTRACTS policy). The detail
// includes the full documentText and documentHash so the owner
// portal can show the exact agreement and its tamper-evident
// fingerprint; the signer token hash is never exposed.

export default async function handler(req, res) {
  if (!enforceRateLimit(req, res, {
    scope: 'admin-contracts',
    maxRequests: 60,
    windowMs: 5 * 60 * 1000,
  })) {
    return;
  }

  const auth = requireAuth(req, res);
  if (!auth) {
    return;
  }

  if (!authorizeEndpoint(res, 'ADMIN_CONTRACTS', req.method, auth.claims)) {
    return;
  }

  if (req.method !== 'GET') {
    return json(res, 405, { error: 'Method not allowed' });
  }

  const id = getRouteParam(req, 'id');
  const store = await reloadStore();
  const contracts = Array.isArray(store.contracts) ? store.contracts : [];
  const contract = contracts.find((candidate) => candidate?.id === id);
  if (!contract) {
    return json(res, 404, { error: 'Contract not found' });
  }

  return json(res, 200, { contract: toContractDetail(contract) });
}
