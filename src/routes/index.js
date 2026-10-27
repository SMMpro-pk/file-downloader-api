import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { Router } from 'express';
import yaml from 'yaml';
import swaggerUi from 'swagger-ui-express';
import { apiKeyMiddleware } from '../middleware/api-key.middleware.js';
import healthRoutes from './health.routes.js';
import filesRoutes from './files.routes.js';
import extractRoutes from './extract.routes.js';
import downloadRoutes from './download.routes.js';
import archiveRoutes from './archive.routes.js';
import testProxyRoutes from './test-proxy.routes.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const rootDir = path.resolve(__dirname, '../../');
const openapiPath = path.join(rootDir, 'openapi.yaml');

let openApiSpec = {};
try {
  const fileContent = fs.readFileSync(openapiPath, 'utf8');
  openApiSpec = yaml.parse(fileContent);
} catch (err) {
  console.warn('Warning: Could not load openapi.yaml:', err.message);
}

const router = Router();

// OpenAPI Specification JSON endpoints
router.get(['/api/openapi.json', '/api/v1/openapi.json'], (req, res) => {
  res.json(openApiSpec);
});

// Swagger UI Documentation
router.use('/api/docs', swaggerUi.serve, swaggerUi.setup(openApiSpec, {
  customSiteTitle: 'SMMpro File Downloader API Docs',
  customCss: '.swagger-ui .topbar { display: none }',
  swaggerOptions: {
    persistAuthorization: true
  }
}));

// System routes under /api/v1 (health, ready, config/public, version, platforms)
router.use('/api/v1', healthRoutes);

// Protected functional routes under /api/v1 (apply apiKeyMiddleware)
router.use('/api/v1/files', apiKeyMiddleware, filesRoutes);
router.use('/api/v1', apiKeyMiddleware, extractRoutes);
router.use('/api/v1', apiKeyMiddleware, downloadRoutes);
router.use('/api/v1/archive', apiKeyMiddleware, archiveRoutes);

// Same-origin testing dashboard proxy routes (for /test and homepage demo without exposing API keys)
router.use('/api/internal', testProxyRoutes);

export default router;
