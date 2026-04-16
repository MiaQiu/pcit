'use strict';

/**
 * Tracks in-flight LLM agent requests so they can be aborted externally (e.g. by an admin).
 * userId → AbortController
 */

const activeRequests = new Map();

function setActive(userId, controller) {
  activeRequests.set(userId, controller);
}

function abort(userId) {
  const ctrl = activeRequests.get(userId);
  if (ctrl) {
    ctrl.abort();
    activeRequests.delete(userId);
    return true;
  }
  return false;
}

function clear(userId) {
  activeRequests.delete(userId);
}

function isActive(userId) {
  return activeRequests.has(userId);
}

module.exports = { setActive, abort, clear, isActive };
