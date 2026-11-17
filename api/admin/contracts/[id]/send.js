import { requireAuth } from '../../../_auth.js';
import { authorizeEndpoint } from '../../../_policy.js';
import { getAppBaseUrl, sendEmail } from '../../../_email.js';
import { enforceRateLimit } from '../../../_security.js';
import {
  createSignerToken,
  getRouteParam,
  hashDocumentText,
  renderAgreementDocument,
  toContractDetail,
} from '../../../_contracts.js';
import { appendAuditLog, json, reloadStore, saveStore } from '../../../_store.js';

//   POST /api/admin/contracts/:id/send
//
// Enterprise-admin only. Drafts only: renders the agreement from
// the template (the one and only render - a sent contract is
// never re-rendered), stores documentText + its SHA-256 hash,
// issues a 14-day signer token, and emails the customer a link
// to the public signing page. The response reports whether the
// email actually went out so the portal can warn instead of
// pretending (the password-reset saga rule: silent email failure
// is indistinguishable from success).

export default async function handler(req, res) {
  if (!enforceRateLimit(req, res, {
    scope: 'admin-contracts-send',
    maxRequests: 30,
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

  if (contract.status !== 'draft') {
    return json(res, 400, {
      error: `Only a draft contract can be sent (this one is ${contract.status}). Use resend to email the signing link again.`,
    });
  }

  const now = new Date().toISOString();
  contract.documentText = renderAgreementDocument(contract);
  contract.documentHash = hashDocumentText(contract.documentText);
  const rawToken = createSignerToken(contract);
  contract.status = 'sent';
  contract.events.push({ type: 'sent', at: now, by: String(auth.claims.email || '') });
  contract.updatedAt = now;
  appendAuditLog(store, 'contract_sent', {
    contractId: contract.id,
    organization: contract.customer.organization,
    by: String(auth.claims.email || ''),
  });
  await saveStore(store);

  const signUrl = `${getAppBaseUrl()}/sign/${rawToken}`;
  const result = await sendEmail({
    to: contract.customer.contactEmail,
    subject: 'Your NyxHICSlab subscription agreement is ready to sign',
    text: [
      `Hello ${contract.customer.contactName},`,
      '',
      `Your NyxHICSlab subscription agreement for ${contract.customer.organization} is ready for electronic signature.`,
      'Review and sign it here (this link expires in 14 days):',
      '',
      signUrl,
      '',
      'Signing is electronic: type your name, check the consent box, and select Sign. A copy of the signed agreement will be emailed to you.',
      '',
      '- Nyx Collective LLC',
    ].join('\n'),
    html: [
      `<p>Hello ${contract.customer.contactName},</p>`,
      `<p>Your NyxHICSlab subscription agreement for ${contract.customer.organization} is ready for electronic signature.</p>`,
      `<p><a href="${signUrl}">Review and sign your agreement</a> (this link expires in 14 days).</p>`,
      '<p>Signing is electronic: type your name, check the consent box, and select Sign. A copy of the signed agreement will be emailed to you.</p>',
      '<p>- Nyx Collective LLC</p>',
    ].join(''),
  });
  if (!result?.sent) {
    console.error(
      `[NyxHICSlab] Contract signing email was NOT delivered for contract ${contract.id} (reason: ${result?.reason || 'unknown'}). The contract is sent; the admin response reports emailSent=false.`,
    );
  }

  return json(res, 200, {
    contract: toContractDetail(contract),
    emailSent: Boolean(result?.sent),
  });
}
