import { Router } from 'express';
import { validateRequest } from '../middleware/validation.middleware.js';
import { downloadRateLimiter } from '../middleware/rate-limit.middleware.js';
import { downloadSchema } from '../schemas/download.schema.js';
import { downloadFile } from '../controllers/download.controller.js';

const router = Router();

router.post(
  '/download',
  downloadRateLimiter,
  validateRequest({ body: downloadSchema }),
  downloadFile
);

router.get(
  '/download',
  downloadRateLimiter,
  validateRequest({ query: downloadSchema }),
  downloadFile
);

export default router;
