import { Router } from 'express';
import { validateRequest } from '../middleware/validation.middleware.js';
import { detectionRateLimiter, downloadRateLimiter } from '../middleware/rate-limit.middleware.js';
import { fileUrlSchema } from '../schemas/file.schema.js';
import { downloadSchema } from '../schemas/download.schema.js';
import {
  verifySameOrigin,
  proxyDetect,
  proxyInfo,
  proxyDownload
} from '../controllers/test-proxy.controller.js';

const router = Router();

// Apply same-origin verification on all internal dashboard routes
router.use(verifySameOrigin);

router.post(
  '/detect',
  detectionRateLimiter,
  validateRequest({ body: fileUrlSchema }),
  proxyDetect
);

router.post(
  '/info',
  detectionRateLimiter,
  validateRequest({ body: fileUrlSchema }),
  proxyInfo
);

router.post(
  '/download',
  downloadRateLimiter,
  validateRequest({ body: downloadSchema }),
  proxyDownload
);

router.get(
  '/download',
  downloadRateLimiter,
  validateRequest({ query: downloadSchema }),
  proxyDownload
);

export default router;
