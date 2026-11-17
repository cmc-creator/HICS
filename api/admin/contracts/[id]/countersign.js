import { requireAuth } from '../../../_auth.js';
import { authorizeEndpoint } from '../../../_policy.js';
import { enforceRateLimit, parseJsonBody, validateBodyFields } from '../../../_security.js';
import {
  appendSignatureBlock,
  getClientIp,
  getRouteParam,
  hashDocumentText,
  toContractDetail,
} from '../../../_contracts.js';
import { appendAuditLog, json, reloadStore, saveStore } from '../../../_store.js';

//   POST /api/admin/contracts/:id/countersign
//   body: { name, title, typedSignature }
//
// Enterprise-admin only. Records Nyx Collective's countersignature
// AFTER the customer has signed (status signed -> completed).
// Countersigning earlier is a 400: the execution order is part of
// the evidence trail. The Nyx signature block is appended to the
// document and the hash recomputed, exactly like the customer's.

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

  const body = parseJsonBody(req);
  if (!body || typeof body !== 'object') {
    return json(res, 400, { error: 'Invalid JSON payload' });
  }
  const validationError = validateBodyFields(body, [
    { name: 'name', required: true, type: 'string', minLength: 2, maxLength: 120 },
    { name: 'title', required: true, type: 'string', minLength: 2, maxLength: 120 },
    { name: 'typedSignature', required: true, type: 'string', minLength: 2, maxLength: 120 },
  ]);
  if (validationError) {
    return json(res, 400, { error: validationError });
  }
  if (String(body.typedSignature).trim() !== String(body.name).trim()) {
    return json(res, 400, { error: 'typedSignature must match the signer name exactly' });
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

  if (contract.status !== 'signed') {
    return json(res, 400, {
      error: `Nyx Collective can countersign only after the customer has signed (this contract is ${contract.status}).`,
    });
  }

  const now = new Date().toISOString();
  const signature = {
    party: 'nyx',
    name: String(body.name).trim(),
    title: String(body.title).trim(),
    email: String(auth.claims.email || ''),
    signedAt: now,
    method: 'typed',
    ipAddress: getClientIp(req),
    userAgent: String(req.headers?.['user-agent'] || ''),
  };
  contract.signatures.push(signature);
  contract.documentText = appendSignatureBlock(contract.documentText, {
    partyLabel: 'Nyx Collective LLC',
    ...signature,
  });
  contract.documentHash = hashDocumentText(contract.documentText);
  contract.status = 'completed';
  contract.events.push({ type: 'countersigned', at: now, by: signature.email });
  contract.updatedAt = now;
  appendAuditLog(store, 'contract_countersigned', {
    contractId: contract.id,
    organization: contract.customer.organization,
    by: signature.email,
  });
  await saveStore(store);

  return json(res, 200, { contract: toContractDetail(contract) });
}
