import http from 'http';
import { app } from './app.js';
import { env } from './config/env.js';
import { logger } from './utils/logger.js';
import { downloadSemaphore } from './services/download.service.js';

const server = http.createServer(app);

// Keep-alive and socket timeouts
server.keepAliveTimeout = 65000;
server.headersTimeout = 66000;

let isShuttingDown = false;

server.listen(env.PORT, env.HOST, () => {
  logger.info({
    brand: 'SMMpro',
    product: 'SMMpro File Downloader API',
    port: env.PORT,
    host: env.HOST,
    environment: env.NODE_ENV,
    archiveInspection: env.ENABLE_ARCHIVE_INSPECTION,
    apiKeyRequired: env.API_KEY_REQUIRED
  }, `SMMpro File Downloader API server running at http://${env.HOST}:${env.PORT}`);
});

function gracefulShutdown(signal) {
  if (isShuttingDown) return;
  isShuttingDown = true;

  logger.info({ signal }, 'Received shutdown signal, initiating graceful drain...');

  // Stop accepting new incoming HTTP connections
  server.close((err) => {
    if (err) {
      logger.error({ err }, 'Error occurred while closing HTTP listener');
      process.exit(1);
    }
    logger.info('HTTP listener closed successfully.');
    process.exit(0);
  });

  // Check active downloads and allow grace period
  const activeDownloads = downloadSemaphore.getActiveCount();
  if (activeDownloads > 0) {
    logger.info({ activeDownloads }, 'Waiting for active download streams to finish...');
  }

  // Force termination after 15 seconds grace period
  const forceTimeout = setTimeout(() => {
    logger.error('Graceful shutdown timeout exceeded (15s). Forcing termination.');
    process.exit(1);
  }, 15000);

  forceTimeout.unref();
}

process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));
process.on('SIGINT', () => gracefulShutdown('SIGINT'));

process.on('unhandledRejection', (reason) => {
  logger.error({ reason }, 'Unhandled Promise Rejection detected');
});

process.on('uncaughtException', (err) => {
  logger.fatal({ err }, 'Uncaught Exception detected! Terminating process');
  process.exit(1);
});

export default server;
