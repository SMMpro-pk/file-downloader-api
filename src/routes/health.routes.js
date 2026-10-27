import { Router } from 'express';
import { getHealth, getVersion, getPlatforms } from '../controllers/health.controller.js';

const router = Router();

router.get('/health', getHealth);
router.get('/version', getVersion);
router.get('/platforms', getPlatforms);

export default router;
