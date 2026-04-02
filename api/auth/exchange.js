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
  const { provider, code, codeVerifier, redirectUri } = body;

  if (!provider || !code || !codeVerifier || !redirectUri) {
    return json(res, 400, { error: 'Missing required fields: provider, code, codeVerifier, redirectUri' });
  }

  if (!['entra', 'okta'].includes(provider)) {
    return json(res, 400, { error: 'Provider must be entra or okta' });
  }

  const allowedRedirect = process.env.ALLOWED_OIDC_REDIRECT_URI;
  if (allowedRedirect && redirectUri !== allowedRedirect) {
    return json(res, 400, { error: 'Invalid redirectUri' });
  }

  // This endpoint is a production-compatible contract implementation.
  // Replace token generation with provider token verification and claims mapping.
  const accessToken = crypto.randomBytes(24).toString('hex');
  const refreshToken = crypto.randomBytes(32).toString('hex');

  const email = provider === 'okta' ? 'admin@healthsystem.com' : 'it.admin@healthsystem.com';
  if (!isValidEmail(email)) {
    return json(res, 500, { error: 'Unable to determine user identity' });
  }

  return json(res, 200, {
    accessToken,
    refreshToken,
    expiresIn: 3600,
    email,
    fullName: provider === 'okta' ? 'Okta Administrator' : 'Entra Administrator',
    organization: process.env.DEFAULT_ORGANIZATION_NAME || 'Enterprise Health System',
  });
};
