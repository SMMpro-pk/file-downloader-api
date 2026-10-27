import crypto from 'crypto';
import { env } from '../config/env.js';
import { UnauthorizedError } from '../utils/errors.js';

// Ephemeral secret for HMAC timing-safe comparison
const HMAC_KEY = crypto.randomBytes(32);

/**
 * Safely compares two secret strings in constant time without length leakage.
 * @param {string} a
 * @param {string} b
 * @returns {boolean}
 */
function safeTimingEqual(a, b) {
  if (typeof a !== 'string' || typeof b !== 'string') return false;
  const hashA = crypto.createHmac('sha256', HMAC_KEY).update(a).digest();
  const hashB = crypto.createHmac('sha256', HMAC_KEY).update(b).digest();
  return crypto.timingSafeEqual(hashA, hashB);
}

/**
 * API Key authentication middleware
 */
export function apiKeyMiddleware(req, res, next) {
  if (!env.API_KEY_REQUIRED) {
    return next();
  }

  const headerKey = req.headers['x-api-key'];
  const queryKey = req.query?.apiKey || req.query?.api_key;
  const clientKey = headerKey || queryKey;

  if (!clientKey || typeof clientKey !== 'string') {
    return next(new UnauthorizedError('Missing required X-API-Key header.'));
  }

  if (!env.API_KEY || !safeTimingEqual(clientKey.trim(), env.API_KEY.trim())) {
    return next(new UnauthorizedError('Invalid API key provided.'));
  }

  next();
}

export default apiKeyMiddleware;
