import { getRedisConfig, redisPipeline } from './_redis.js';

const RATE_LIMIT_KEY = '__nyx_rate_limit_state__';
const REDIS_RATE_PREFIX = 'nyx:hics:rate:';

function getRateState() {
  if (!globalThis[RATE_LIMIT_KEY]) {
    globalThis[RATE_LIMIT_KEY] = new Map();
  }
  return globalThis[RATE_LIMIT_KEY];
}

export function getClientIp(req) {
  // Vercel sets x-real-ip / x-forwarded-for itself, overwriting anything the client sent.
  const realIp = req.headers?.['x-real-ip'];
  if (typeof realIp === 'string' && realIp.length > 0) {
    return realIp.trim();
  }

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

function countInMemory(key, windowMs) {
  const state = getRateState();
  const now = Date.now();
  cleanupExpiredEntries(state, now);

  const current = state.get(key);
  if (!current || current.resetAt <= now) {
    state.set(key, { count: 1, resetAt: now + windowMs });
    return { count: 1, resetInMs: windowMs };
  }

  current.count += 1;
  return { count: current.count, resetInMs: current.resetAt - now };
}

// Fixed window shared by every serverless instance. SET NX starts the window; INCR counts.
async function countInRedis(key, windowMs) {
  const redisKey = `${REDIS_RATE_PREFIX}${key}`;
  const [, count, ttl] = await redisPipeline([
    ['SET', redisKey, '0', 'PX', String(windowMs), 'NX'],
    ['INCR', redisKey],
    ['PTTL', redisKey],
  ]);
  return { count: Number(count), resetInMs: Number(ttl) > 0 ? Number(ttl) : windowMs };
}

/**
 * Returns true when the request may proceed; otherwise sends 429 and returns false.
 * `identity` defaults to the client IP; pass a user id or email to limit per account.
 */
export async function enforceRateLimit(req, res, {
  scope,
  maxRequests,
  windowMs,
  identity,
}) {
  const key = `${scope}:${identity ?? getClientIp(req)}`;

  let result;
  if (getRedisConfig()) {
    try {
      result = await countInRedis(key, windowMs);
    } catch (error) {
      console.error('rate limiter: Redis unavailable, using per-instance limits', error);
      result = countInMemory(key, windowMs);
    }
  } else {
    result = countInMemory(key, windowMs);
  }

  if (result.count > maxRequests) {
    const retryAfterSeconds = Math.max(1, Math.ceil(result.resetInMs / 1000));
    res.setHeader('Retry-After', String(retryAfterSeconds));
    res.status(429).json({
      error: 'Too many requests',
      retryAfterSeconds,
    });
    return false;
  }

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
