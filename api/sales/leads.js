const crypto = require('crypto');

function json(res, status, body) {
  res.statusCode = status;
  res.setHeader('Content-Type', 'application/json');
  res.end(JSON.stringify(body));
}

function isValidEmail(value) {
  return typeof value === 'string' && value.includes('@') && value.includes('.');
}

module.exports = async (req, res) => {
  if (req.method !== 'POST') {
    return json(res, 405, { error: 'Method not allowed' });
  }

  const body = typeof req.body === 'string' ? JSON.parse(req.body || '{}') : (req.body || {});
  const { name, email, organization, teamSize, timeline, goals, createdAt } = body;

  if (!name || !email || !organization) {
    return json(res, 400, { error: 'Missing required fields: name, email, organization' });
  }

  if (!isValidEmail(email)) {
    return json(res, 400, { error: 'Invalid email format' });
  }

  const lead = {
    id: `lead_${crypto.randomUUID()}`,
    name,
    email,
    organization,
    teamSize: teamSize || 'unspecified',
    timeline: timeline || 'unspecified',
    goals: goals || '',
    createdAt: createdAt || new Date().toISOString(),
    source: 'nyxhicslab-request-demo',
  };

  // Replace this with persistence to your CRM or database.
  // Optionally forward to webhook when configured.
  if (process.env.SALES_WEBHOOK_URL) {
    try {
      await fetch(process.env.SALES_WEBHOOK_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(lead),
      });
    } catch (error) {
      return json(res, 502, { error: 'Lead webhook forwarding failed' });
    }
  }

  return json(res, 201, { leadId: lead.id, status: 'accepted' });
};
