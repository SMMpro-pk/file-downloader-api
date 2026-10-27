import { DownloadService } from '../services/download.service.js';
import { logger, sanitizeUrlForLogging } from '../utils/logger.js';

export async function downloadFile(req, res, next) {
  try {
    const url = req.body?.url || req.query?.url;
    const mode = req.body?.mode || req.query?.mode || 'stream';
    const allowLocalTest = process.env.NODE_ENV === 'test' && req.headers['x-allow-local-test'] === 'true';

    logger.info(
      { requestId: req.id, url: sanitizeUrlForLogging(url), mode },
      'Initiating file download request'
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
  downloadFile
};
