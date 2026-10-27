import { Router } from 'express';
import { validateRequest } from '../middleware/validation.middleware.js';
import { detectionRateLimiter } from '../middleware/rate-limit.middleware.js';
import { fileUrlSchema } from '../schemas/file.schema.js';
import { inspectArchive } from '../controllers/archive.controller.js';

const router = Router();

router.post(
  '/inspect',
  detectionRateLimiter,
  validateRequest({ body: fileUrlSchema }),
  inspectArchive
);

export default router;
