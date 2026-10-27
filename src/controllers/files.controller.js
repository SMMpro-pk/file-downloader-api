import { MetadataService } from '../services/metadata.service.js';
import { logger, sanitizeUrlForLogging } from '../utils/logger.js';

export async function detectFile(req, res, next) {
  try {
    const { url } = req.body;
    const allowLocalTest = process.env.NODE_ENV === 'test' && req.headers['x-allow-local-test'] === 'true';

    logger.info({ requestId: req.id, url: sanitizeUrlForLogging(url) }, 'Detecting file from URL');
    const meta = await MetadataService.inspectUrl(url, { allowLocalTest });

    // Detect endpoint returns concise detection fields matching section 5
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

export async function getFileInfo(req, res, next) {
  try {
    const { url } = req.body;
    const allowLocalTest = process.env.NODE_ENV === 'test' && req.headers['x-allow-local-test'] === 'true';

    logger.info({ requestId: req.id, url: sanitizeUrlForLogging(url) }, 'Retrieving file info');
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

export async function inspectFile(req, res, next) {
  try {
    const { url } = req.body;
    const allowLocalTest = process.env.NODE_ENV === 'test' && req.headers['x-allow-local-test'] === 'true';

    logger.info({ requestId: req.id, url: sanitizeUrlForLogging(url) }, 'Inspecting file details and security warnings');
    const meta = await MetadataService.inspectUrl(url, { allowLocalTest });

    // Inspect endpoint returns full technical details including warnings and redirect info
    return res.jsonEnvelope(meta);
  } catch (err) {
    next(err);
  }
}

export default {
  detectFile,
  getFileInfo,
  inspectFile
};
