import { MetadataService } from '../services/metadata.service.js';
import { DownloadService } from '../services/download.service.js';
import { logger, sanitizeUrlForLogging } from '../utils/logger.js';
import { AppError } from '../utils/errors.js';

/**
 * Validates that the request originates from the same origin to protect the internal proxy.
 */
export function verifySameOrigin(req, res, next) {
  // Allow during automated test suite if header is present
  if (process.env.NODE_ENV === 'test' && req.headers['x-test-internal-proxy']) {
    return next();
  }

  const secFetchSite = req.headers['sec-fetch-site'];
  // Browsers sending Fetch Metadata
  if (secFetchSite && secFetchSite !== 'same-origin' && secFetchSite !== 'none') {
    return next(new AppError('FORBIDDEN_ORIGIN', 'Cross-origin access to dashboard proxy is forbidden.', 403));
  }

  // Check Origin / Referer header against Host header if present
  const origin = req.headers.origin;
  const host = req.headers.host;
  if (origin && host) {
    try {
      const originHost = new URL(origin).host;
      if (originHost !== host) {
        return next(new AppError('FORBIDDEN_ORIGIN', 'Cross-origin request to internal proxy is not permitted.', 403));
      }
    } catch {
      return next(new AppError('FORBIDDEN_ORIGIN', 'Invalid request origin.', 403));
    }
  }

  next();
}

export async function proxyDetect(req, res, next) {
  try {
    const { url } = req.body;
    const allowLocalTest = process.env.NODE_ENV === 'test' && req.headers['x-allow-local-test'] === 'true';

    logger.info({ requestId: req.id, url: sanitizeUrlForLogging(url) }, 'Dashboard proxy detecting file');
    const meta = await MetadataService.inspectUrl(url, { allowLocalTest });

    return res.jsonEnvelope({
      filename: meta.filename || meta.safeFilename,
      safeFilename: meta.safeFilename,
      extension: meta.extension,
      mimeType: meta.mimeType,
      detectedMimeType: meta.detectedMimeType,
      sizeBytes: meta.sizeBytes,
      sizeHuman: meta.sizeHuman,
      fileType: meta.fileType,
      formatStatus: meta.formatStatus,
      description: meta.description,
      supportsRanges: meta.supportsRanges,
      downloadAvailable: meta.downloadAvailable
    });
  } catch (err) {
    next(err);
  }
}

export async function proxyInfo(req, res, next) {
  try {
    const { url } = req.body;
    const allowLocalTest = process.env.NODE_ENV === 'test' && req.headers['x-allow-local-test'] === 'true';

    logger.info({ requestId: req.id, url: sanitizeUrlForLogging(url) }, 'Dashboard proxy retrieving file info');
    const meta = await MetadataService.inspectUrl(url, { allowLocalTest });

    return res.jsonEnvelope({
      filename: meta.filename,
      safeFilename: meta.safeFilename,
      extension: meta.extension,
      mimeType: meta.mimeType,
      detectedMimeType: meta.detectedMimeType,
      sizeBytes: meta.sizeBytes,
      sizeHuman: meta.sizeHuman,
      fileType: meta.fileType,
      formatStatus: meta.formatStatus,
      description: meta.description,
      supportsRanges: meta.supportsRanges,
      downloadAvailable: meta.downloadAvailable,
      requiresAuth: meta.requiresAuth,
      detectedAt: meta.detectedAt
    });
  } catch (err) {
    next(err);
  }
}

export async function proxyDownload(req, res, next) {
  try {
    const url = req.body?.url || req.query?.url;
    const mode = req.body?.mode || req.query?.mode || 'stream';
    const allowLocalTest = process.env.NODE_ENV === 'test' && req.headers['x-allow-local-test'] === 'true';

    logger.info(
      { requestId: req.id, url: sanitizeUrlForLogging(url), mode },
      'Dashboard proxy initiating download'
    );

    await DownloadService.handleDownload({
      req,
      res,
      url,
      mode,
      allowLocalTest
    });
  } catch (err) {
    next(err);
  }
}

export default {
  verifySameOrigin,
  proxyDetect,
  proxyInfo,
  proxyDownload
};
