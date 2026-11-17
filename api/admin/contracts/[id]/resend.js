import { requireAuth } from '../../../_auth.js';
import { authorizeEndpoint } from '../../../_policy.js';
import { getAppBaseUrl, sendEmail } from '../../../_email.js';
import { enforceRateLimit } from '../../../_security.js';
import { createSignerToken, getRouteParam, toContractSummary } from '../../../_contracts.js';
import { appendAuditLog, json, reloadStore, saveStore } from '../../../_store.js';

//   POST /api/admin/contracts/:id/resend
//
// Enterprise-admin only. Re-emails the signing link for a sent or
// viewed contract with a FRESH 14-day token (the old link stops
// working). The document is NOT re-rendered - resend can never
// change what the customer signs.

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

  if (contract.status !== 'sent' && contract.status !== 'viewed') {
    return json(res, 400, {
      error: `Only a sent or viewed contract can be resent (this one is ${contract.status}).`,
    });
  }

  const now = new Date().toISOString();
  const rawToken = createSignerToken(contract);
  contract.events.push({ type: 'resent', at: now, by: String(auth.claims.email || '') });
  contract.updatedAt = now;
  appendAuditLog(store, 'contract_resent', {
    contractId: contract.id,
    organization: contract.customer.organization,
    by: String(auth.claims.email || ''),
  });
  await saveStore(store);

  const signUrl = `${getAppBaseUrl()}/sign/${rawToken}`;
  const result = await sendEmail({
    to: contract.customer.contactEmail,
    subject: 'Reminder: your NyxHICSlab subscription agreement is ready to sign',
    text: [
      `Hello ${contract.customer.contactName},`,
      '',
      `A reminder that your NyxHICSlab subscription agreement for ${contract.customer.organization} is ready for electronic signature.`,
      'Review and sign it here (this link expires in 14 days; any earlier link no longer works):',
      '',
      signUrl,
      '',
      '- Nyx Collective LLC',
    ].join('\n'),
    html: [
      `<p>Hello ${contract.customer.contactName},</p>`,
      `<p>A reminder that your NyxHICSlab subscription agreement for ${contract.customer.organization} is ready for electronic signature.</p>`,
      `<p><a href="${signUrl}">Review and sign your agreement</a> (this link expires in 14 days; any earlier link no longer works).</p>`,
      '<p>- Nyx Collective LLC</p>',
    ].join(''),
  });
  if (!result?.sent) {
    console.error(
      `[NyxHICSlab] Contract resend email was NOT delivered for contract ${contract.id} (reason: ${result?.reason || 'unknown'}).`,
    );
  }

  return json(res, 200, {
    contract: toContractSummary(contract),
    emailSent: Boolean(result?.sent),
  });
}
