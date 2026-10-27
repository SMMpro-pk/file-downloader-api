import rateLimit from 'express-rate-limit';
import { LIMITS } from '../config/limits.js';

function createRateLimitHandler(message = 'Rate limit exceeded. Please try again later.') {
  return (req, res) => {
    const requestId = req.id || `req_ratelimit_${Date.now()}`;
    return res.status(429).json({
      success: false,
      data: null,
      error: {
        code: 'TOO_MANY_REQUESTS',
        message,
        details: {
          retryAfterSeconds: Math.ceil((req.rateLimit?.resetTime?.getTime() - Date.now()) / 1000) || 60
        }
      },
      requestId
    });
  };
}

/**
 * Rate limiter for file detection, info, inspect, and link extraction endpoints.
 */
export const detectionRateLimiter = rateLimit({
  windowMs: 60 * 1000, // 1 minute
  max: LIMITS.DETECTION_RATE_LIMIT,
  standardHeaders: true,
  legacyHeaders: false,
  handler: createRateLimitHandler(`Detection rate limit exceeded (${LIMITS.DETECTION_RATE_LIMIT} req/min). Please try again later.`),
  skip: (req) => process.env.NODE_ENV === 'test' && !req.headers['x-test-rate-limit']
});

/**
 * Rate limiter for file download starts.
 */
export const downloadRateLimiter = rateLimit({
  windowMs: 60 * 1000, // 1 minute
  max: LIMITS.DOWNLOAD_RATE_LIMIT,
  standardHeaders: true,
  legacyHeaders: false,
  handler: createRateLimitHandler(`Download rate limit exceeded (${LIMITS.DOWNLOAD_RATE_LIMIT} starts/min). Please try again later.`),
  skip: (req) => process.env.NODE_ENV === 'test' && !req.headers['x-test-rate-limit']
});
