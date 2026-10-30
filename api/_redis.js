export function getRedisConfig() {
  const url = process.env.UPSTASH_REDIS_REST_URL;
  const token = process.env.UPSTASH_REDIS_REST_TOKEN;
  if (!url || !token) {
    return null;
  }

  return { url: url.replace(/\/$/, ''), token };
}

async function postToRedis(path, body) {
  const redis = getRedisConfig();
  if (!redis) {
    throw new Error('Redis is not configured');
  }

  // Commands go in the POST body so large store payloads never hit URL length limits.
  const response = await fetch(`${redis.url}${path}`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${redis.token}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(body),
  });

  if (!response.ok) {
    throw new Error(`Redis request failed with status ${response.status}`);
  }

  return response.json();
}

export async function redisCommand(command) {
  const payload = await postToRedis('', command);
  if (payload?.error) {
    throw new Error(`Redis ${command[0]} failed: ${payload.error}`);
  }
  return payload?.result;
}

export async function redisPipeline(commands) {
  const payload = await postToRedis('/pipeline', commands);
  if (!Array.isArray(payload)) {
    throw new Error('Redis pipeline returned an unexpected response');
  }

  return payload.map((entry, index) => {
    if (entry?.error) {
      throw new Error(`Redis ${commands[index][0]} failed: ${entry.error}`);
    }
    return entry?.result;
  });
}
