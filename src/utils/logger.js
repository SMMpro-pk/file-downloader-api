import pino from 'pino';
import { env } from '../config/env.js';

const redactPaths = [
  'req.headers["x-api-key"]',
  'req.headers.authorization',
  'req.headers.cookie',
  'req.headers["set-cookie"]',
  '*.apiKey',
  '*.api_key',
  '*.password',
  '*.token',
  '*.secret',
  '*.signature',
  '*.sig'
];

export const logger = pino({
  level: env.LOG_LEVEL,
  redact: {
    paths: redactPaths,
    censor: '[REDACTED]'
  },
  timestamp: pino.stdTimeFunctions.isoTime,
  formatters: {
    level(label) {
      return { level: label };
    }
  }
});

/**
 * Sanitizes URLs for logging by stripping credentials and sensitive query parameters.
 * @param {string} rawUrl
 * @returns {string} Safe URL string
 */
export function sanitizeUrlForLogging(rawUrl) {
  if (!rawUrl || typeof rawUrl !== 'string') return '';
  try {
    const parsed = new URL(rawUrl);
    // Strip user/pass
    parsed.username = '';
    parsed.password = '';
    // Redact sensitive query parameters
    const sensitiveKeys = ['token', 'key', 'auth', 'signature', 'sig', 'secret', 'access_token', 'apikey', 'password', 'pwd'];
    for (const [key] of parsed.searchParams) {
      if (sensitiveKeys.some((s) => key.toLowerCase().includes(s))) {
        parsed.searchParams.set(key, '[REDACTED]');
      }
    }
    return parsed.toString();
  } catch {
    return '[INVALID_URL]';
  }
}

export default logger;
