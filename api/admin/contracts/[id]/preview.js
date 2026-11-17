import { requireAuth } from '../../../_auth.js';
import { authorizeEndpoint } from '../../../_policy.js';
import { enforceRateLimit } from '../../../_security.js';
import { getRouteParam, renderAgreementDocument } from '../../../_contracts.js';
import { json, reloadStore } from '../../../_store.js';

//   POST /api/admin/contracts/:id/preview -> { documentText }
//
// Enterprise-admin only. Renders the agreement for a DRAFT from
// the stored fields WITHOUT saving anything: the portal shows
// the owner exactly what will be sent, and because the preview
// comes from the same renderer the send path uses, it can never
// drift from the real document. Non-drafts are refused - a sent
// contract's stored documentText is the only true copy.

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
  const contracts = Array.isArray(store.contracts) ? store.contracts : [];
  const contract = contracts.find((candidate) => candidate?.id === id);
  if (!contract) {
    return json(res, 404, { error: 'Contract not found' });
  }

  if (contract.status !== 'draft') {
    return json(res, 400, {
      error: 'Preview is available for drafts only; a sent contract already has its final document.',
    });
  }

  return json(res, 200, { documentText: renderAgreementDocument(contract) });
}
