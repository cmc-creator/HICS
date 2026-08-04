const RATE_LIMIT_KEY = '__nyx_rate_limit_state__';

function getRateState() {
  if (!globalThis[RATE_LIMIT_KEY]) {
    globalThis[RATE_LIMIT_KEY] = new Map();
  }
  return globalThis[RATE_LIMIT_KEY];
}

function getClientIp(req) {
  const forwarded = req.headers?.['x-forwarded-for'];
  if (typeof forwarded === 'string' && forwarded.length > 0) {
    return forwarded.split(',')[0].trim();
  }
  return req.socket?.remoteAddress || 'unknown';
}

function cleanupExpiredEntries(state, now) {
  for (const [key, entry] of state.entries()) {
    if (entry.resetAt <= now) {
      state.delete(key);
    }
  }
}

export function enforceRateLimit(req, res, {
  scope,
  maxRequests,
  windowMs,
}) {
  const state = getRateState();
  const now = Date.now();
  cleanupExpiredEntries(state, now);

  const ip = getClientIp(req);
  const key = `${scope}:${ip}`;
  const current = state.get(key);

  if (!current || current.resetAt <= now) {
    state.set(key, {
      count: 1,
      resetAt: now + windowMs,
    });
    return true;
  }

  if (current.count >= maxRequests) {
    const retryAfterSeconds = Math.max(1, Math.ceil((current.resetAt - now) / 1000));
    res.setHeader('Retry-After', String(retryAfterSeconds));
    res.status(429).json({
      error: 'Too many requests',
      retryAfterSeconds,
    });
    return false;
  }

  current.count += 1;
  state.set(key, current);
  return true;
}

export function parseJsonBody(req) {
  if (!req.body) {
    return {};
  }

  if (typeof req.body === 'string') {
    try {
      return JSON.parse(req.body);
    } catch {
      return null;
    }
  }

  if (typeof req.body === 'object') {
    return req.body;
  }

  return null;
}

export function validateBodyFields(body, rules) {
  for (const rule of rules) {
    const value = body?.[rule.name];

    if (rule.required && (value === undefined || value === null || value === '')) {
      return `${rule.name} is required`;
    }

    if (value === undefined || value === null) {
      continue;
    }

    if (rule.type && typeof value !== rule.type) {
      return `${rule.name} must be a ${rule.type}`;
    }

    if (rule.type === 'string') {
      const text = String(value);
      if (rule.minLength && text.length < rule.minLength) {
        return `${rule.name} must be at least ${rule.minLength} characters`;
      }
      if (rule.maxLength && text.length > rule.maxLength) {
        return `${rule.name} must be at most ${rule.maxLength} characters`;
      }
      if (rule.pattern && !rule.pattern.test(text)) {
        return `${rule.name} format is invalid`;
      }
    }
  }

  return null;
}
