import path from 'path';
import { fileURLToPath } from 'url';
import express from 'express';
import helmet from 'helmet';
import cors from 'cors';
import { pinoHttp } from 'pino-http';
import { env } from './config/env.js';
import { LIMITS } from './config/limits.js';
import { logger } from './utils/logger.js';
import { AppError } from './utils/errors.js';
import { requestIdMiddleware } from './middleware/request-id.middleware.js';
import { notFoundHandler, errorHandler } from './middleware/error.middleware.js';
import routes from './routes/index.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const publicDir = path.join(__dirname, 'public');

export const app = express();

// Disable x-powered-by header
app.disable('x-powered-by');

// Trusted proxy configuration (prevents client IP spoofing unless explicitly configured)
if (env.TRUST_PROXY !== false) {
  app.set('trust proxy', env.TRUST_PROXY);
}

// 1. Helmet HTTP security headers
app.use(
  helmet({
    contentSecurityPolicy: {
      directives: {
        defaultSrc: ["'self'"],
        scriptSrc: ["'self'", "'unsafe-inline'"], // Required for Swagger UI and dashboard
        styleSrc: ["'self'", "'unsafe-inline'"], // Required for Swagger UI and dashboard
        imgSrc: ["'self'", 'data:', 'https:'],
        connectSrc: ["'self'"]
      }
    },
    crossOriginEmbedderPolicy: false
  })
);

// 2. CORS configuration
app.use(
  cors({
    origin: (origin, callback) => {
      // Allow requests with no origin (like curl, mobile apps, or same-origin)
      if (!origin) return callback(null, true);
      if (env.CORS_ORIGINS.includes('*') || env.CORS_ORIGINS.includes(origin)) {
        return callback(null, true);
      }
      return callback(new AppError('FORBIDDEN_ORIGIN', `CORS origin "${origin}" is not permitted.`, 403));
    },
    methods: ['GET', 'POST', 'HEAD', 'OPTIONS'],
    allowedHeaders: [
      'Content-Type',
      'X-API-Key',
      'Authorization',
      'Range',
      'X-Request-Id',
      'x-allow-local-test',
      'x-test-rate-limit',
      'x-test-internal-proxy'
    ],
    exposedHeaders: [
      'Content-Disposition',
      'Content-Length',
      'Content-Range',
      'Accept-Ranges',
      'X-Request-Id',
      'RateLimit-Limit',
      'RateLimit-Remaining',
      'RateLimit-Reset'
    ],
    credentials: true,
    maxAge: 86400
  })
);

// 3. Request ID middleware (attaches req.id and helper envelopes)
app.use(requestIdMiddleware);

// 4. Pino HTTP logger
app.use(
  pinoHttp({
    logger,
    genReqId: (req) => req.id,
    customLogLevel: (req, res, err) => {
      if (res.statusCode >= 500 || err) return 'error';
      if (res.statusCode >= 400) return 'warn';
      return 'info';
    },
    customSuccessMessage: (req, res) => `${req.method} ${req.originalUrl} ${res.statusCode}`,
    customErrorMessage: (req, res, err) => `${req.method} ${req.originalUrl} ${res.statusCode} - ${err.message}`,
    autoLogging: {
      ignore: (req) =>
        (req.originalUrl === '/api/v1/health' || req.originalUrl === '/api/v1/ready') &&
        process.env.NODE_ENV === 'test'
    }
  })
);

// 5. Body parsers with strict size limits
app.use(express.json({ limit: LIMITS.MAX_REQUEST_BODY_BYTES }));
app.use(express.urlencoded({ extended: false, limit: LIMITS.MAX_REQUEST_BODY_BYTES }));

// 6. Serve static files from src/public
app.use(express.static(publicDir));

// 7. Public web pages (Homepage and Live Testing Dashboard)
app.get('/', (req, res) => {
  res.sendFile(path.join(publicDir, 'index.html'));
});

app.get('/test', (req, res) => {
  res.sendFile(path.join(publicDir, 'test.html'));
});

// 8. Mount application API routes
app.use(routes);

// 9. 404 Handler for undefined routes
app.use(notFoundHandler);

// 10. Global Error Handler
app.use(errorHandler);

export default app;
