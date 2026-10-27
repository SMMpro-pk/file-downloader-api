import { Router } from 'express';
import { validateRequest } from '../middleware/validation.middleware.js';
import { detectionRateLimiter } from '../middleware/rate-limit.middleware.js';
import { fileUrlSchema } from '../schemas/file.schema.js';
import { detectFile, getFileInfo, inspectFile } from '../controllers/files.controller.js';

const router = Router();

router.post(
  '/detect',
  detectionRateLimiter,
  validateRequest({ body: fileUrlSchema }),
  detectFile
);

router.post(
  '/info',
  detectionRateLimiter,
  validateRequest({ body: fileUrlSchema }),
  getFileInfo
);

router.post(
  '/inspect',
  detectionRateLimiter,
  validateRequest({ body: fileUrlSchema }),
  inspectFile
);

export default router;
