'use strict';

/**
 * In-process pub/sub for coach chat long-polling.
 * When a message is written for a user, publish() wakes any waiting /events requests instantly.
 */

const waiters = new Map(); // userId → Set<{ resolve, timer }>

/**
 * Subscribe to new messages for a user.
 * resolve() is called with an array of messages when publish() fires or on timeout.
 * Returns an unsubscribe function (call on request close).
 */
function subscribe(userId, resolve, timeoutMs = 25_000) {
  if (!waiters.has(userId)) waiters.set(userId, new Set());

  const entry = { resolve };
  entry.timer = setTimeout(() => {
    waiters.get(userId)?.delete(entry);
    resolve([]); // timeout — no new messages, client retries
  }, timeoutMs);

  waiters.get(userId).add(entry);

  return function unsubscribe() {
    clearTimeout(entry.timer);
    waiters.get(userId)?.delete(entry);
  };
}

/**
 * Wake all waiting subscribers for a user with the given messages.
 */
function publish(userId, messages) {
  const subs = waiters.get(userId);
  if (!subs || subs.size === 0) return;
  for (const entry of subs) {
    clearTimeout(entry.timer);
    entry.resolve(messages);
  }
  waiters.set(userId, new Set());
}

module.exports = { subscribe, publish };
