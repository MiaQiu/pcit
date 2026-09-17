const SENSITIVE_KEY_PATTERN = /token|password|secret/i;

/**
 * Extracts the subset of a route's params that are safe to attach to an
 * analytics event: primitive values only (so large/nested payloads like a
 * full lesson, quiz, or transcript object are never forwarded), and never a
 * key that looks like a token/password/secret (e.g. ResetPassword's `token`).
 */
export function getSafeRouteParams(params: object | undefined): Record<string, any> {
  if (!params) return {};

  const safe: Record<string, any> = {};
  for (const [key, value] of Object.entries(params)) {
    if (SENSITIVE_KEY_PATTERN.test(key)) continue;
    if (typeof value === 'string' || typeof value === 'number' || typeof value === 'boolean') {
      safe[key] = value;
    }
  }
  return safe;
}
