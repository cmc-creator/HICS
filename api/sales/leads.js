import crypto from 'node:crypto';
import { json } from '../_store.js';
import { enforceRateLimit, parseJsonBody, validateBodyFields } from '../_security.js';

function isValidEmail(value) {
  return typeof value === 'string' && value.includes('@') && value.includes('.');
}

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return json(res, 405, { error: 'Method not allowed' });
  }

  if (!enforceRateLimit(req, res, { scope: 'sales-leads', maxRequests: 10, windowMs: 60 * 60 * 1000 })) {
    return;
  }

  const body = parseJsonBody(req);
  if (!body || typeof body !== 'object') {
    return json(res, 400, { error: 'Invalid JSON payload' });
  }

  const validationError = validateBodyFields(body, [
    { name: 'name', required: true, type: 'string', minLength: 2, maxLength: 120 },
    { name: 'email', required: true, type: 'string', minLength: 5, maxLength: 256 },
    { name: 'organization', required: true, type: 'string', minLength: 2, maxLength: 200 },
    { name: 'teamSize', required: false, type: 'string', maxLength: 40 },
    { name: 'timeline', required: false, type: 'string', maxLength: 40 },
    { name: 'goals', required: false, type: 'string', maxLength: 1000 },
  ]);
  if (validationError) {
    return json(res, 400, { error: validationError });
  }

  if (!isValidEmail(body.email)) {
    return json(res, 400, { error: 'Invalid email format' });
  }

  const lead = {
    id: `lead_${crypto.randomUUID()}`,
    name: String(body.name).trim(),
    email: String(body.email).trim().toLowerCase(),
    organization: String(body.organization).trim(),
    teamSize: typeof body.teamSize === 'string' ? body.teamSize : 'unspecified',
    timeline: typeof body.timeline === 'string' ? body.timeline : 'unspecified',
    goals: typeof body.goals === 'string' ? body.goals : '',
    createdAt: new Date().toISOString(),
    source: 'nyxhicslab-request-demo',
  };

  if (process.env.SALES_WEBHOOK_URL) {
    try {
      await fetch(process.env.SALES_WEBHOOK_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(lead),
      });
    } catch {
      // Webhook failure is non-fatal; lead is still accepted.
    }
  }

  return json(res, 201, { leadId: lead.id, status: 'accepted' });
}
