import { getAppBaseUrl, sendEmail } from '../_email.js';
import { enforceRateLimit, parseJsonBody, validateBodyFields } from '../_security.js';
import {
  appendSignatureBlock,
  findContractByToken,
  getClientIp,
  getRouteParam,
  hashDocumentText,
} from '../_contracts.js';
import { appendAuditLog, json, reloadStore, saveStore } from '../_store.js';

// Public signing endpoint - no login. The 256-bit signer token in
// the URL is the credential, and only its SHA-256 hash is stored.
//
//   GET  /api/sign/:token -> the agreement + customer fields for
//        display. The first view of a sent contract marks it
//        viewed (once) in the event log.
//   POST /api/sign/:token -> records the customer's typed
//        electronic signature (name, title, typedSignature,
//        consent: true required), appends the signature block to
//        the document, recomputes its hash, and emails a
//        confirmation to the customer and to Nyx Collective.
//
// Invalid token -> 404 with a generic message. Expired -> 410.
// A contract that is not awaiting signature (already signed,
// completed, voided) -> 400/200 with its status and NO document
// changes. Nothing about other contracts is ever revealed.

const NYX_NOTICE_EMAIL = 'info@nyxcollectivellc.com';

function publicView(contract) {
  return {
    status: contract.status,
    organization: contract.customer.organization,
    facility: contract.customer.facility,
    contactName: contract.customer.contactName,
    contactEmail: contract.customer.contactEmail,
    fields: contract.fields,
    documentText: contract.documentText || '',
    documentHash: contract.documentHash || null,
    signatures: (contract.signatures || []).map((signature) => ({
      party: signature.party,
      name: signature.name,
      title: signature.title,
      signedAt: signature.signedAt,
    })),
    signerTokenExpiresAt: contract.signerTokenExpiresAt || null,
  };
}

export default async function handler(req, res) {
  if (req.method !== 'GET' && req.method !== 'POST') {
    return json(res, 405, { error: 'Method not allowed' });
  }

  if (!enforceRateLimit(req, res, {
    scope: req.method === 'POST' ? 'sign-submit' : 'sign-view',
    maxRequests: req.method === 'POST' ? 10 : 60,
    windowMs: req.method === 'POST' ? 15 * 60 * 1000 : 5 * 60 * 1000,
  })) {
    return;
  }

  const token = getRouteParam(req, 'token');
  const store = await reloadStore();
  const found = findContractByToken(store, token);
  if (!found) {
    return json(res, 404, { error: 'This signing link is not valid.' });
  }
  const { contract, expired } = found;

  if (req.method === 'GET') {
    if (contract.status === 'expired' || ((contract.status === 'sent' || contract.status === 'viewed') && expired)) {
      if (contract.status !== 'expired') {
        contract.status = 'expired';
        contract.events.push({ type: 'expired', at: new Date().toISOString() });
        contract.updatedAt = new Date().toISOString();
        appendAuditLog(store, 'contract_signing_link_expired', { contractId: contract.id });
        await saveStore(store);
      }
      return json(res, 410, { error: 'This signing link has expired. Please contact Nyx Collective LLC for a new link.' });
    }

    if (contract.status === 'sent') {
      const now = new Date().toISOString();
      contract.status = 'viewed';
      contract.events.push({ type: 'viewed', at: now });
      contract.updatedAt = now;
      appendAuditLog(store, 'contract_viewed', {
        contractId: contract.id,
        organization: contract.customer.organization,
      });
      await saveStore(store);
    }

    return json(res, 200, { contract: publicView(contract) });
  }

  // POST: sign.
  if (expired || contract.status === 'expired') {
    return json(res, 410, { error: 'This signing link has expired. Please contact Nyx Collective LLC for a new link.' });
  }
  if (contract.status !== 'sent' && contract.status !== 'viewed') {
    return json(res, 400, {
      error: `This agreement is not awaiting signature (status: ${contract.status}).`,
    });
  }

  const body = parseJsonBody(req);
  if (!body || typeof body !== 'object') {
    return json(res, 400, { error: 'Invalid JSON payload' });
  }
  if (body.consent !== true) {
    return json(res, 400, { error: 'Electronic signature consent is required: please check the consent box to sign.' });
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
    return json(res, 400, { error: 'The typed signature must match the signer name exactly.' });
  }

  const now = new Date().toISOString();
  const signature = {
    party: 'customer',
    name: String(body.name).trim(),
    title: String(body.title).trim(),
    email: contract.customer.contactEmail,
    signedAt: now,
    method: 'typed',
    ipAddress: getClientIp(req),
    userAgent: String(req.headers?.['user-agent'] || ''),
  };
  contract.signatures.push(signature);
  contract.documentText = appendSignatureBlock(contract.documentText, {
    partyLabel: contract.customer.organization,
    ...signature,
  });
  contract.documentHash = hashDocumentText(contract.documentText);
  contract.status = 'signed';
  contract.events.push({ type: 'signed', at: now, by: signature.email });
  contract.updatedAt = now;
  appendAuditLog(store, 'contract_signed', {
    contractId: contract.id,
    organization: contract.customer.organization,
    signer: signature.name,
  });
  await saveStore(store);

  // Confirmations: the customer's copy and Nyx's notice. Failures
  // are logged loudly server-side; the signature itself is already
  // recorded, so the response does not depend on email delivery.
  const signPageUrl = `${getAppBaseUrl()}/sign/${token}`;
  const adminUrl = `${getAppBaseUrl()}/admin/contracts/${contract.id}`;
  const confirmationText = [
    `The NyxHICSlab subscription agreement for ${contract.customer.organization} was signed electronically by ${signature.name} (${signature.title}) on ${now}.`,
    '',
    `View the agreement: ${signPageUrl}`,
    `Document SHA-256: ${contract.documentHash}`,
    '',
    'Nyx Collective LLC will countersign and return the fully executed copy.',
    '',
    '- Nyx Collective LLC',
  ].join('\n');

  const customerResult = await sendEmail({
    to: contract.customer.contactEmail,
    subject: 'Signed: your NyxHICSlab subscription agreement',
    text: confirmationText,
  });
  if (!customerResult?.sent) {
    console.error(`[NyxHICSlab] Contract signed confirmation to the customer was NOT delivered for contract ${contract.id} (reason: ${customerResult?.reason || 'unknown'}).`);
  }
  const nyxResult = await sendEmail({
    to: NYX_NOTICE_EMAIL,
    subject: `Contract signed: ${contract.customer.organization} (NyxHICSlab)`,
    text: `${confirmationText}\n\nOwner portal: ${adminUrl}`,
  });
  if (!nyxResult?.sent) {
    console.error(`[NyxHICSlab] Contract signed notice to Nyx was NOT delivered for contract ${contract.id} (reason: ${nyxResult?.reason || 'unknown'}).`);
  }

  return json(res, 200, {
    contract: publicView(contract),
    message: 'Thank you - your signature has been recorded and a copy has been emailed to you.',
  });
}
