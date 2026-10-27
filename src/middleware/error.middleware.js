import { AppError, NotFoundError } from '../utils/errors.js';
import { logger } from '../utils/logger.js';
import { env } from '../config/env.js';

/**
 * 404 Not Found Middleware for unhandled routes
 */
export function notFoundHandler(req, res, next) {
  next(new NotFoundError(`Route ${req.method} ${req.originalUrl} not found.`));
}

/**
 * Global Error Handler Middleware
 */
export function errorHandler(err, req, res, next) { // eslint-disable-line no-unused-vars
  const requestId = req.id || `req_err_${Date.now()}`;

  // Handle body-parser payload too large
  if (err.type === 'entity.too.large' || err.status === 413) {
    return res.status(413).json({
      success: false,
      data: null,
      error: {
        code: 'PAYLOAD_TOO_LARGE',
        message: 'Request body exceeds configured limit.',
        details: null
      },
      requestId
    });
  }

  // Handle JSON parse syntax errors
  if (err instanceof SyntaxError && err.status === 400 && 'body' in err) {
    return res.status(400).json({
      success: false,
      data: null,
      error: {
        code: 'MALFORMED_JSON',
        message: 'Malformed JSON payload in request body.',
        details: null
      },
      requestId
    });
  }

  // Handle CORS errors
  if (err.message && err.message.includes('CORS origin') && err.message.includes('is not permitted')) {
    return res.status(403).json({
      success: false,
      data: null,
      error: {
        code: 'FORBIDDEN_ORIGIN',
        message: err.message,
        details: null
      },
      requestId
    });
  }

  // Application errors (AppError)
  if (err instanceof AppError) {
    // Only log warnings for 4xx client errors, errors for 5xx
    if (err.statusCode >= 500) {
      logger.error({ err, requestId, path: req.path, method: req.method }, err.message);
    } else {
      logger.warn({ errCode: err.code, message: err.message, requestId, path: req.path }, 'Client error handled');
    }

    return res.status(err.statusCode).json({
      success: false,
      data: null,
      error: {
        code: err.code,
        message: err.message,
        details: err.details
      },
      requestId
    });
  }

  // Unexpected errors
  logger.error({ err, requestId, path: req.path, method: req.method }, 'Unhandled internal server error');

  const isProd = env.NODE_ENV === 'production';
  return res.status(500).json({
    success: false,
    data: null,
    error: {
      code: 'INTERNAL_SERVER_ERROR',
      message: isProd ? 'An unexpected internal server error occurred.' : (err.message || 'Internal server error'),
      details: null
    },
    requestId
  });
}

export default errorHandler;
