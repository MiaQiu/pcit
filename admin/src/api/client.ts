const TOKEN_KEY = 'nora_admin_token';

export function getToken(): string | null {
  return localStorage.getItem(TOKEN_KEY);
}

export function setToken(token: string) {
  localStorage.setItem(TOKEN_KEY, token);
}

export function clearToken() {
  localStorage.removeItem(TOKEN_KEY);
}

export async function apiFetch<T = any>(
  path: string,
  options: RequestInit = {}
): Promise<T> {
  const token = getToken();
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    ...(options.headers as Record<string, string>),
  };

  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
  }

  const res = await fetch(path, { ...options, headers });

  if (res.status === 401) {
    clearToken();
    window.location.href = '/login';
    throw new Error('Unauthorized');
  }

  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new Error(body.error || `Request failed: ${res.status}`);
  }

  return res.json();
}

// Env-aware fetch: used for endpoints that can target dev or prod.
// Pass baseUrl + token to call the prod API directly; omit both for dev (uses Vercel rewrite).
export async function apiFetchEnv<T = any>(
  path: string,
  options: RequestInit = {},
  envOpts?: { baseUrl?: string; token?: string }
): Promise<T> {
  const token = envOpts?.token ?? getToken();
  const baseUrl = envOpts?.baseUrl ?? '';

  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    ...(options.headers as Record<string, string>),
  };

  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
  }

  const res = await fetch(`${baseUrl}${path}`, { ...options, headers });

  if (res.status === 401) {
    if (!envOpts?.baseUrl) {
      // Only auto-redirect to login for the dev API
      clearToken();
      window.location.href = '/login';
    }
    throw new Error('Unauthorized');
  }

  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new Error(body.error || `Request failed: ${res.status}`);
  }

  return res.json();
}

// Like apiFetchEnv, but hands back the raw Response instead of throwing on
// non-2xx — for endpoints (e.g. session analysis) whose non-200 statuses
// (202 processing, 500 failed-analysis) are expected states, not errors.
export async function apiFetchRaw(
  path: string,
  options: RequestInit = {},
  envOpts?: { baseUrl?: string; token?: string }
): Promise<Response> {
  const token = envOpts?.token ?? getToken();
  const baseUrl = envOpts?.baseUrl ?? '';

  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    ...(options.headers as Record<string, string>),
  };

  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
  }

  const res = await fetch(`${baseUrl}${path}`, { ...options, headers });

  if (res.status === 401) {
    if (!envOpts?.baseUrl) {
      clearToken();
      window.location.href = '/login';
    }
    throw new Error('Unauthorized');
  }

  return res;
}
