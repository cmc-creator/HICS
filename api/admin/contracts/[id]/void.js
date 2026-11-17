import { requireAuth } from '../../../_auth.js';
import { authorizeEndpoint } from '../../../_policy.js';
import { enforceRateLimit } from '../../../_security.js';
import { getRouteParam, toContractSummary } from '../../../_contracts.js';
import { appendAuditLog, json, reloadStore, saveStore } from '../../../_store.js';

//   POST /api/admin/contracts/:id/void
//
// Enterprise-admin only. Voids a contract that has not been fully
// executed (draft, sent, or viewed). The signer token is cleared,
// so an emailed link dies immediately. A signed or completed
// agreement cannot be voided here - it is an executed record.

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

  if (req.method !== 'POST') {
    return json(res, 405, { error: 'Method not allowed' });
  }

  const id = getRouteParam(req, 'id');
  const store = await reloadStore();
  if (!Array.isArray(store.contracts)) {
    store.contracts = [];
  }
  const contract = store.contracts.find((candidate) => candidate?.id === id);
  if (!contract) {
    return json(res, 404, { error: 'Contract not found' });
  }

  if (!['draft', 'sent', 'viewed', 'expired'].includes(contract.status)) {
    return json(res, 400, {
      error: `A ${contract.status} contract cannot be voided.`,
    });
  }

  const now = new Date().toISOString();
  contract.status = 'voided';
  contract.signerTokenHash = null;
  contract.signerTokenExpiresAt = null;
  contract.events.push({ type: 'voided', at: now, by: String(auth.claims.email || '') });
  contract.updatedAt = now;
  appendAuditLog(store, 'contract_voided', {
    contractId: contract.id,
    organization: contract.customer.organization,
    by: String(auth.claims.email || ''),
  });
  await saveStore(store);

  return json(res, 200, { contract: toContractSummary(contract) });
}
