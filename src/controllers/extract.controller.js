import { LinkExtractorService } from '../services/link-extractor.service.js';
import { logger, sanitizeUrlForLogging } from '../utils/logger.js';

export async function extractLinks(req, res, next) {
  try {
    const { url, limit } = req.body;
    const allowLocalTest = process.env.NODE_ENV === 'test' && req.headers['x-allow-local-test'] === 'true';

    logger.info({ requestId: req.id, url: sanitizeUrlForLogging(url), limit }, 'Extracting downloadable links from page');
    const result = await LinkExtractorService.extractLinks(url, { limit, allowLocalTest });

    return res.jsonEnvelope(result);
  } catch (err) {
    next(err);
  }
}

export default {
  extractLinks
};
