export async function apiRequest<T>(
  path: string,
  options: RequestInit,
  accessToken: string,
  onUnauthorized: () => void,
): Promise<T> {
  const response = await fetch(path, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      ...(options.headers ?? {}),
      Authorization: `Bearer ${accessToken}`,
    },
  });

  if (response.status === 401) {
    onUnauthorized();
    throw new Error('Session expired. Please sign in again.');
  }

  if (!response.ok) {
    throw new Error(`API request failed with status ${response.status}`);
  }

  if (response.status === 204) {
    return undefined as T;
  }

  return response.json() as Promise<T>;
}
