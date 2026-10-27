import { ArchiveService } from '../services/archive.service.js';
import { logger, sanitizeUrlForLogging } from '../utils/logger.js';

export async function inspectArchive(req, res, next) {
  try {
    const { url } = req.body;
    const allowLocalTest = process.env.NODE_ENV === 'test' && req.headers['x-allow-local-test'] === 'true';

    logger.info({ requestId: req.id, url: sanitizeUrlForLogging(url) }, 'Inspecting ZIP archive entries');
    const result = await ArchiveService.inspectArchive(url, { allowLocalTest });

    return res.jsonEnvelope(result);
  } catch (err) {
    next(err);
  }
}

export default {
  inspectArchive
};
