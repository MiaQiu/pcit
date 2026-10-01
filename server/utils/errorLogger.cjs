/**
 * Shared structured error logging, used by the global Express error handler
 * and by individual route catch blocks so every error is logged in one
 * consistent shape.
 *
 * Usage:
 *   const { logError } = require('../utils/errorLogger.cjs');
 *   logError(error, { route: 'sessions.getSessions', userId: req.user?.id });
 */

/**
 * @param {Error} err - The error to log
 * @param {object} context - Extra context (route, method, path, userId, etc.)
 */
function logError(err, context = {}) {
  console.error('[ERROR]', {
    timestamp: new Date().toISOString(),
    ...context,
    error: err?.message,
    code: err?.code || 'INTERNAL_ERROR',
    statusCode: err?.statusCode || 500,
    stack: process.env.NODE_ENV === 'development' ? err?.stack : undefined
  });
}

module.exports = { logError };
