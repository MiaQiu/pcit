/**
 * Free/subscribed exemption cache
 *
 * SubscriptionContext's isSubscribed can still be resolving (or stuck stale-false
 * for the rest of the app session — see a841abf) when a screen needs to know
 * whether the current user is exempt from the free-session limit. Screens that
 * can afford a network round-trip (RecordScreen, at the point it actually
 * decides to block) should re-verify with confirmExempt(). Screens that only
 * need a best-effort, non-blocking read (e.g. a lock icon) should use
 * getCachedExempt(), which never hits the network.
 */
import * as userStorage from './userStorage';

const CACHE_KEY = '@nora_free_exempt_checked';
// Long enough that a confirmed-exempt user never pays a network round-trip on
// every visit; short enough to notice a revoked grant within a reasonable
// window. Bump to 30 days if weekly re-verification is more than needed.
const RECHECK_MS = 7 * 24 * 60 * 60 * 1000;

/**
 * Best-effort, cache-only read — never hits the network. Returns false if
 * there's no cached verdict yet or it's gone stale (callers should treat that
 * as "unknown", not "not exempt").
 */
export async function getCachedExempt(): Promise<boolean> {
  const cachedRaw = await userStorage.getItem(CACHE_KEY);
  if (!cachedRaw) return false;
  try {
    const { checkedAt } = JSON.parse(cachedRaw);
    return Date.now() - checkedAt < RECHECK_MS;
  } catch {
    return false;
  }
}

export async function setCachedExempt(): Promise<void> {
  await userStorage.setItem(CACHE_KEY, JSON.stringify({ checkedAt: Date.now() })).catch(() => {});
}
