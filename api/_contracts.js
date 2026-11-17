import crypto from 'node:crypto';

// Contracts: the SaaS subscription agreement, built into the app
// at the attorney's direction (Connie, 2026-11-16) - an
// enterprise admin fills in the order fields, the app renders the
// agreement from the versioned template below, emails the customer
// a signing link, and the customer signs electronically in the
// browser. No third-party e-sign vendor: the record itself is the
// evidence (hash-chained document text, append-only event log,
// signer name/title/IP/user-agent captured at signing).
//
// Template version 1 renders the business substance of
// hics-sales-pack/contract-term-sheet.md. Bump
// CONTRACT_TEMPLATE_VERSION when the attorney revises the text;
// every contract record keeps the version it was rendered from,
// and a sent contract's documentText is never re-rendered.

export const CONTRACT_TEMPLATE_VERSION = 1;
export const SIGNER_TOKEN_TTL_MS = 14 * 24 * 60 * 60 * 1000; // 14 days

export const PLAN_TIERS = {
  small: 'Small Facility',
  community: 'Community Hospital',
  enterprise: 'Health System / Enterprise',
};

export const CONTRACT_STATUSES = ['draft', 'sent', 'viewed', 'signed', 'completed', 'voided', 'expired'];

function hashToken(rawToken) {
  return crypto.createHash('sha256').update(String(rawToken || '')).digest('hex');
}

function hashesEqual(a, b) {
  const left = Buffer.from(String(a || ''), 'utf8');
  const right = Buffer.from(String(b || ''), 'utf8');
  return left.length === right.length && crypto.timingSafeEqual(left, right);
}

// SHA-256 of the exact agreement text. Stored at send time and
// recomputed every time a signature block is appended, so any
// later edit to the stored text is detectable by re-hashing.
export function hashDocumentText(documentText) {
  return crypto.createHash('sha256').update(String(documentText || ''), 'utf8').digest('hex');
}

// Issues a fresh signer token for a contract. Only the sha256
// hash is stored (same pattern as password set tokens in
// _passwords.js); the raw token goes into the emailed link.
export function createSignerToken(contract) {
  const rawToken = crypto.randomBytes(32).toString('hex');
  contract.signerTokenHash = hashToken(rawToken);
  contract.signerTokenExpiresAt = new Date(Date.now() + SIGNER_TOKEN_TTL_MS).toISOString();
  return rawToken;
}

// Finds the contract a raw signer token belongs to. Returns
// { contract, expired } or null when the token is unknown. An
// expired-but-real token is reported distinctly so the signing
// page can say "this link expired" without leaking anything
// about other contracts.
export function findContractByToken(store, rawToken) {
  if (!rawToken || typeof rawToken !== 'string') {
    return null;
  }
  const tokenHash = hashToken(rawToken);
  const contracts = Array.isArray(store?.contracts) ? store.contracts : [];
  const contract = contracts.find((candidate) => (
    candidate
    && typeof candidate.signerTokenHash === 'string'
    && hashesEqual(candidate.signerTokenHash, tokenHash)
  ));
  if (!contract) {
    return null;
  }
  const expiresAt = new Date(contract.signerTokenExpiresAt || 0).getTime();
  const expired = !Number.isFinite(expiresAt) || expiresAt <= Date.now();
  return { contract, expired };
}

// Dynamic route params arrive in req.query on Vercel; tests pass
// them the same way. Fall back to the URL path so a handler never
// depends on one transport detail.
export function getRouteParam(req, name, positionFromEnd = 0) {
  const fromQuery = req?.query?.[name];
  if (typeof fromQuery === 'string' && fromQuery) {
    return fromQuery;
  }
  const url = typeof req?.url === 'string' ? req.url.split('?')[0] : '';
  const segments = url.split('/').filter(Boolean).map((segment) => decodeURIComponent(segment));
  if (name === 'id') {
    // /api/admin/contracts/<id>[/action]
    const contractsIndex = segments.indexOf('contracts');
    if (contractsIndex >= 0 && segments[contractsIndex + 1]) {
      return segments[contractsIndex + 1];
    }
  }
  if (name === 'token') {
    return segments[segments.length - 1] || '';
  }
  return segments[segments.length - 1 - positionFromEnd] || '';
}

export function getClientIp(req) {
  const forwarded = req?.headers?.['x-forwarded-for'];
  if (typeof forwarded === 'string' && forwarded.length > 0) {
    return forwarded.split(',')[0].trim();
  }
  return req?.socket?.remoteAddress || 'unknown';
}

export function formatMoney(value) {
  const amount = Number(value) || 0;
  return `$${amount.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

function formatLongDate(isoDate) {
  const date = new Date(`${isoDate}T12:00:00Z`);
  if (Number.isNaN(date.getTime())) {
    return String(isoDate || '');
  }
  return date.toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
    timeZone: 'UTC',
  });
}

// Renders the full agreement text for a contract's customer +
// fields. Called ONCE, at send time; the result is stored as
// documentText and never re-rendered afterwards, so the signed
// copy is exactly what the customer saw.
export function renderAgreementDocument(contract) {
  const { customer, fields } = contract;
  const tierLabel = PLAN_TIERS[fields.planTier] || String(fields.planTier || '');
  const governingLaw = String(fields.governingLaw || 'Arizona');
  const termYears = Number(fields.termMonths) === 12
    ? 'one (1) year'
    : `${fields.termMonths} months`;

  const lines = [
    'NyxHICSlab SUBSCRIPTION AGREEMENT',
    `Agreement template version ${CONTRACT_TEMPLATE_VERSION}`,
    '',
    `This Subscription Agreement (the "Agreement") is between Nyx Collective LLC, an Arizona limited liability company ("Nyx Collective" or "Vendor"), and ${customer.organization} ("Customer"), for Customer's use of the NyxHICSlab hospital incident command system (HICS) training platform (the "Service").`,
    '',
    'ORDER DETAILS',
    `Customer organization: ${customer.organization}`,
    `Facility: ${customer.facility || 'As listed by Customer'}`,
    `Customer contact: ${customer.contactName} (${customer.contactEmail})`,
    `Plan tier: ${tierLabel}`,
    `Annual subscription fee: ${formatMoney(fields.annualFee)} per facility per year`,
    `One-time setup fee: ${formatMoney(fields.setupFee)}`,
    `Initial term: ${termYears} (${fields.termMonths} months)`,
    `Start date: ${formatLongDate(fields.startDate)}`,
    '',
    '1. SUBSCRIPTION GRANT',
    'Vendor grants Customer a non-exclusive, non-transferable subscription to access and use the Service for Customer\'s internal emergency-preparedness training during the term of this Agreement. The Service is provided as hosted software in a dedicated, single-tenant deployment for Customer. Vendor retains all intellectual property rights in the Service, its content library, and its scenarios. Customer data (user accounts, training records, and reports) belongs to Customer.',
    '',
    '2. AUTHORIZED USE',
    'Authorized users are Customer\'s employees and contractors who hold a training role at the facilities covered by this Agreement. User accounts are individual; shared logins are not permitted. Customer may not resell, sublicense, or provide access to the Service to any third party outside its organization and covered facilities.',
    '',
    '3. FEES AND PAYMENT',
    `Customer will pay the annual subscription fee of ${formatMoney(fields.annualFee)} per facility and the one-time setup fee of ${formatMoney(fields.setupFee)}. Fees are invoiced annually in advance and are due Net 30 from the invoice date. Fees are exclusive of taxes; Customer is responsible for applicable sales and use taxes. Vendor may increase fees at renewal by no more than the greater of five percent (5%) or the Consumer Price Index increase, with at least sixty (60) days\' notice before the renewal date.`,
    '',
    '4. TERM AND TERMINATION',
    `The initial term begins on ${formatLongDate(fields.startDate)} and continues for ${termYears}, then renews automatically for successive one-year terms unless either party gives at least sixty (60) days' written notice of non-renewal before the renewal date. Either party may terminate for material breach if the breach is not cured within thirty (30) days after written notice. Annual fees are prepaid and are non-refundable, except that Customer will receive a pro-rata refund if Vendor's uncured material breach caused the termination.`,
    '',
    '5. CUSTOMER DATA, RETURN, AND DELETION',
    'Customer owns its data. Vendor processes Customer data only to provide the Service. For thirty (30) days after expiration or termination, Vendor will make Customer data (user list, training records, and reports) available for export. Consistent with Vendor\'s published privacy policy, all Customer data will be deleted within ninety (90) days after the subscription ends, and Vendor will confirm deletion on request. Vendor uses the subprocessors disclosed to Customer (hosting, database, email delivery, single sign-on, and AI providers, as applicable) and will give notice of material subprocessor changes where practicable.',
    '',
    '6. NO PROTECTED HEALTH INFORMATION',
    'The Service is designed for training data only and is not intended to store protected health information ("PHI") as defined under HIPAA. Customer agrees that it will NOT enter, upload, or transmit PHI, or any patient or resident identifying information, into the Service - including free-text fields, drill notes, media uploads, and the AI assistant - and that it will instruct its users accordingly. Because the Service is not designed for PHI, the parties agree that no Business Associate Agreement applies to the Service as designed. If Vendor discovers PHI in the Service, Vendor may remove it and notify Customer. A breach of this section by Customer is Customer\'s responsibility, including under Section 11.',
    '',
    '7. AI ASSISTANT AND SUBPROCESSORS',
    'The Service includes an optional AI assistant feature. The assistant can be disabled for Customer\'s deployment at Customer\'s election, and Vendor will disable it on request; because Customer has a dedicated deployment, disabling it affects only Customer. When used, the assistant processes the text a user submits through Vendor\'s AI subprocessors (currently Anthropic as primary and Google Gemini as fallback) under those providers\' commercial terms; Vendor does not use Customer data to train models. AI output is training support only - it is not clinical, legal, or regulatory advice - and Customer remains responsible for its emergency plans and compliance decisions. Section 6 applies with special emphasis to the AI assistant.',
    '',
    '8. SECURITY',
    'Vendor maintains the security program described in its security documentation, including encryption in transit and at rest through its platform providers, role-based access control, audit logging, signed short-lived sessions, refresh-token rotation, and rate limiting. Vendor will notify Customer of a confirmed security breach affecting Customer data without unreasonable delay, targeting seventy-two (72) hours from confirmation. Vendor will complete one security questionnaire per year from Customer and reasonable follow-ups.',
    '',
    '9. SERVICE LEVELS AND SUPPORT',
    'Vendor targets 99.9% monthly availability of the Service, excluding scheduled maintenance and force majeure. Support is provided by email during Arizona business hours (Monday-Friday, 8am-5pm Arizona time, excluding federal holidays), with a response target of one (1) business day for standard issues and the same business day for service-down issues affecting a drill in progress. An administrator onboarding session is included in the setup fee.',
    '',
    '10. LIMITATION OF LIABILITY',
    'Each party\'s aggregate liability under this Agreement is capped at the fees paid by Customer under this Agreement in the twelve (12) months preceding the claim. Neither party is liable for consequential, incidental, indirect, or lost-profit damages, to the maximum extent permitted by law.',
    '',
    '11. INDEMNIFICATION',
    'Vendor will indemnify Customer against third-party claims that the Service, as provided by Vendor, infringes intellectual property rights. Customer will indemnify Vendor against claims arising from Customer\'s data and use of the Service, including PHI entered in violation of Section 6.',
    '',
    '12. INSURANCE',
    'During the term, Vendor will maintain cyber liability and technology errors-and-omissions insurance with limits of at least $1,000,000 per claim and in the aggregate, and will provide a certificate of insurance on request.',
    '',
    '13. GENERAL',
    `This Agreement is governed by the laws of the State of ${governingLaw}, and any dispute will be resolved in the state or federal courts located in ${governingLaw}. Neither party may assign this Agreement without the other party's consent, except that Vendor may assign it in connection with a sale of its business. This Agreement, together with the order details above, is the entire agreement between the parties for the Service and supersedes any terms in Customer purchase orders, which are expressly excluded. Amendments must be in writing.`,
    '',
    '14. ELECTRONIC SIGNATURES AND CONSENT',
    'The parties agree to sign this Agreement electronically. By typing their name in the signature field and selecting the consent checkbox on the signing page, each signer consents to use electronic records and signatures under the federal ESIGN Act and the Arizona Uniform Electronic Transactions Act, and agrees that the typed signature is the legal equivalent of a handwritten signature for this Agreement. Each signer represents that they are authorized to bind their party. A copy of the signed Agreement, including its audit record of signing events, will be emailed to both parties.',
    '',
    'SIGNATURES',
    '(Signature blocks are appended below as each party signs.)',
  ];

  return lines.join('\n');
}

// Appends a signature block to the document text and returns the
// new text. The caller recomputes documentHash over the result,
// so the final signed copy's hash covers the signatures too.
export function appendSignatureBlock(documentText, { partyLabel, name, title, email, signedAt, method }) {
  const block = [
    '',
    '------------------------------------------------------------',
    `Signed for ${partyLabel}:`,
    `Signature: ${name}`,
    `Name: ${name}`,
    `Title: ${title}`,
    `Email: ${email}`,
    `Date: ${signedAt}`,
    `Method: ${method === 'typed' ? 'Typed electronic signature' : method}`,
  ];
  return `${String(documentText || '')}\n${block.join('\n')}`;
}

// Public/admin response shaping: the signer token hash never
// leaves the server, and list views omit the full document text.
export function toContractSummary(contract) {
  return {
    id: contract.id,
    templateVersion: contract.templateVersion,
    customer: contract.customer,
    fields: contract.fields,
    status: contract.status,
    signerTokenExpiresAt: contract.signerTokenExpiresAt || null,
    events: contract.events || [],
    signatures: contract.signatures || [],
    documentHash: contract.documentHash || null,
    createdBy: contract.createdBy,
    createdAt: contract.createdAt,
    updatedAt: contract.updatedAt,
  };
}

export function toContractDetail(contract) {
  return {
    ...toContractSummary(contract),
    documentText: contract.documentText || '',
  };
}
