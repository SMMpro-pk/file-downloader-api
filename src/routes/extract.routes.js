import { Router } from 'express';
import { validateRequest } from '../middleware/validation.middleware.js';
import { detectionRateLimiter } from '../middleware/rate-limit.middleware.js';
import { extractLinksSchema } from '../schemas/extract.schema.js';
import { extractLinks } from '../controllers/extract.controller.js';

const router = Router();

router.post(
  '/extract-links',
  detectionRateLimiter,
  validateRequest({ body: extractLinksSchema }),
  extractLinks
);

export default router;
