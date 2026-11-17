import { requireAuth } from '../_auth.js';
import { authorizeEndpoint } from '../_policy.js';
import { enforceRateLimit, parseJsonBody, validateBodyFields } from '../_security.js';
import { CONTRACT_TEMPLATE_VERSION, PLAN_TIERS, toContractSummary } from '../_contracts.js';
import { appendAuditLog, createId, json, reloadStore, saveStore } from '../_store.js';

// Contracts collection (owner portal, enterprise-admin only - see
// ADMIN_CONTRACTS in _policy.js).
//
//   GET  /api/admin/contracts -> { contracts: [summary...] }
//   POST /api/admin/contracts -> 201 { contract: summary }
//
// Creating a contract makes a DRAFT only. Nothing is rendered or
// emailed until POST /api/admin/contracts/:id/send, and there is
// deliberately no update route: a draft's fields are fixed at
// creation (create a new draft to change them), and a sent
// contract's document can never change except by appending
// signature blocks at signing time.

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const DATE_REGEX = /^\d{4}-\d{2}-\d{2}$/;

function validateCreateBody(body) {
  const customer = body?.customer && typeof body.customer === 'object' ? body.customer : {};
  const fields = body?.fields && typeof body.fields === 'object' ? body.fields : {};

  const customerError = validateBodyFields(customer, [
    { name: 'organization', required: true, type: 'string', minLength: 2, maxLength: 200 },
    { name: 'contactName', required: true, type: 'string', minLength: 2, maxLength: 120 },
    { name: 'contactEmail', required: true, type: 'string', maxLength: 200 },
  ]);
  if (customerError) {
    return `customer.${customerError}`;
  }
  if (!EMAIL_REGEX.test(String(customer.contactEmail))) {
    return 'customer.contactEmail format is invalid';
  }
  if (customer.facility !== undefined && (typeof customer.facility !== 'string' || customer.facility.length > 200)) {
    return 'customer.facility must be a string of at most 200 characters';
  }

  if (!Object.prototype.hasOwnProperty.call(PLAN_TIERS, String(fields.planTier || ''))) {
    return 'fields.planTier must be one of: small, community, enterprise';
  }
  if (typeof fields.annualFee !== 'number' || !Number.isFinite(fields.annualFee) || fields.annualFee <= 0 || fields.annualFee > 10000000) {
    return 'fields.annualFee must be a number greater than 0';
  }
  if (typeof fields.setupFee !== 'number' || !Number.isFinite(fields.setupFee) || fields.setupFee < 0 || fields.setupFee > 10000000) {
    return 'fields.setupFee must be a number of 0 or more';
  }
  if (!Number.isInteger(fields.termMonths) || fields.termMonths < 1 || fields.termMonths > 120) {
    return 'fields.termMonths must be a whole number of months between 1 and 120';
  }
  if (typeof fields.startDate !== 'string' || !DATE_REGEX.test(fields.startDate) || Number.isNaN(new Date(`${fields.startDate}T12:00:00Z`).getTime())) {
    return 'fields.startDate must be a valid date (YYYY-MM-DD)';
  }
  if (fields.governingLaw !== undefined && (typeof fields.governingLaw !== 'string' || fields.governingLaw.length > 80)) {
    return 'fields.governingLaw must be a string of at most 80 characters';
  }

  return null;
}

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

  if (req.method === 'GET') {
    const store = await reloadStore();
    const contracts = Array.isArray(store.contracts) ? store.contracts : [];
    return json(res, 200, { contracts: contracts.map(toContractSummary) });
  }

  if (req.method === 'POST') {
    const body = parseJsonBody(req);
    if (!body || typeof body !== 'object') {
      return json(res, 400, { error: 'Invalid JSON payload' });
    }

    const validationError = validateCreateBody(body);
    if (validationError) {
      return json(res, 400, { error: validationError });
    }

    // Reload before writing, like the settings write: a contract
    // create must not clobber another instance's recent changes
    // with this warm instance's stale whole-store copy.
    const store = await reloadStore();
    if (!Array.isArray(store.contracts)) {
      store.contracts = [];
    }

    const now = new Date().toISOString();
    const contract = {
      id: createId('contract'),
      templateVersion: CONTRACT_TEMPLATE_VERSION,
      customer: {
        organization: String(body.customer.organization).trim(),
        facility: typeof body.customer.facility === 'string' ? body.customer.facility.trim() : '',
        contactName: String(body.customer.contactName).trim(),
        contactEmail: String(body.customer.contactEmail).trim().toLowerCase(),
      },
      fields: {
        planTier: String(body.fields.planTier),
        annualFee: body.fields.annualFee,
        setupFee: body.fields.setupFee,
        termMonths: body.fields.termMonths,
        startDate: String(body.fields.startDate),
        governingLaw: typeof body.fields.governingLaw === 'string' && body.fields.governingLaw.trim()
          ? body.fields.governingLaw.trim()
          : 'Arizona',
      },
      status: 'draft',
      signerTokenHash: null,
      signerTokenExpiresAt: null,
      events: [{ type: 'created', at: now, by: String(auth.claims.email || '') }],
      signatures: [],
      documentText: '',
      documentHash: null,
      createdBy: String(auth.claims.email || ''),
      createdAt: now,
      updatedAt: now,
    };

    store.contracts.unshift(contract);
    appendAuditLog(store, 'contract_created', {
      contractId: contract.id,
      organization: contract.customer.organization,
      by: contract.createdBy,
    });
    await saveStore(store);

    return json(res, 201, { contract: toContractSummary(contract) });
  }

  return json(res, 405, { error: 'Method not allowed' });
}
