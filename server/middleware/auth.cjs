// JWT authentication middleware
const { verifyAccessToken } = require('../utils/jwt.cjs');
const { UnauthorizedError, AppError } = require('../utils/errors.cjs');

function requireAuth(req, res, next) {
  try {
    // Get token from Authorization header
    const authHeader = req.headers.authorization;

    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      throw new UnauthorizedError('No token provided', 'Please log in to continue');
    }

    const token = authHeader.substring(7); // Remove 'Bearer ' prefix

    // Verify token
    const payload = verifyAccessToken(token);

    if (!payload) {
      throw new UnauthorizedError('Invalid or expired token', 'Your session has expired. Please log in again.');
    }

    // Add user info to request
    req.userId = payload.userId;
    req.userEmail = payload.email;

    // Also add to req.user for consistency with global error handler
    req.user = {
      id: payload.userId,
      email: payload.email
    };

    next();
  } catch (error) {
    // If it's already an AppError, pass it through
    if (error instanceof AppError) {
      return next(error);
    }

    // Otherwise, wrap it
    console.error('Auth middleware error:', error);
    return next(new AppError(
      `Authentication middleware error: ${error.message}`,
      500,
      'AUTH_ERROR',
      'Authentication failed. Please try again.'
    ));
  }
}

module.exports = { requireAuth };
