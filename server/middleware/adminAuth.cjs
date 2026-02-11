const { verifyAccessToken } = require('../utils/jwt.cjs');
const { UnauthorizedError, ForbiddenError, AppError } = require('../utils/errors.cjs');

function requireAdminAuth(req, res, next) {
  try {
    const authHeader = req.headers.authorization;

    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      throw new UnauthorizedError('No admin token provided', 'Please log in to the admin portal');
    }

    const token = authHeader.substring(7);
    const payload = verifyAccessToken(token);

    if (!payload) {
      throw new UnauthorizedError('Invalid or expired admin token', 'Your admin session has expired. Please log in again.');
    }

    if (payload.role !== 'admin') {
      throw new ForbiddenError('Not an admin token', 'Admin access required');
    }

    req.adminRole = 'admin';
    next();
  } catch (error) {
    if (error instanceof AppError) {
      return next(error);
    }
    console.error('Admin auth middleware error:', error);
    return next(new AppError(
      `Admin authentication error: ${error.message}`,
      500,
      'AUTH_ERROR',
      'Authentication failed. Please try again.'
    ));
  }
}

module.exports = { requireAdminAuth };
