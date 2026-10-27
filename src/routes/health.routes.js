import { Router } from 'express';
import {
  getHealth,
  getReady,
  getPublicConfig,
  getVersion,
  getPlatforms
} from '../controllers/health.controller.js';

const router = Router();

router.get('/health', getHealth);
router.get('/ready', getReady);
router.get('/config/public', getPublicConfig);
router.get('/version', getVersion);
router.get('/platforms', getPlatforms);

export default router;
