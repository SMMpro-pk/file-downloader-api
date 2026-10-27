import { describe, it, expect } from 'vitest';
import request from 'supertest';
import { app } from '../src/app.js';

describe('System, Health & Public Discovery Endpoints', () => {
  it('GET /api/v1/health returns healthy status, application name, and SMMpro brand info', async () => {
    const res = await request(app).get('/api/v1/health');
    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data.status).toBe('healthy');
    expect(res.body.data.application).toBe('SMMpro File Downloader');
    expect(res.body.data.brand).toBe('SMMpro');
    expect(res.body.data.service).toBe('SMMpro File Downloader API');
    expect(typeof res.body.data.uptimeSeconds).toBe('number');
    expect(res.body.requestId).toMatch(/^req_/);
  });

  it('GET /api/v1/ready returns readiness check response', async () => {
    const res = await request(app).get('/api/v1/ready');
    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data.ready).toBe(true);
    expect(res.body.data.application).toBe('SMMpro File Downloader');
    expect(typeof res.body.data.uptimeSeconds).toBe('number');
  });

  it('GET /api/v1/config/public returns live public URLs and never exposes API keys', async () => {
    const res = await request(app).get('/api/v1/config/public');
    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data.appName).toBe('SMMpro File Downloader');
    expect(res.body.data.apiBasePath).toBe('/api/v1');
    expect(res.body.data.docsUrl).toContain('/api/docs');
    expect(res.body.data.healthUrl).toContain('/api/v1/health');
    expect(res.body.data.readyUrl).toContain('/api/v1/ready');
    expect(res.body.data.testPageUrl).toContain('/test');
    expect(typeof res.body.data.apiKeyRequired).toBe('boolean');

    // Security requirement: Never expose API secrets or keys
    expect(res.body.data.apiKey).toBeUndefined();
    expect(res.body.data.api_key).toBeUndefined();
    expect(res.body.data.secret).toBeUndefined();
    expect(JSON.stringify(res.body)).not.toContain('replace_with_a_long_random_secret');
  });

  it('GET / renders the SMMpro File Downloader homepage', async () => {
    const res = await request(app).get('/');
    expect(res.status).toBe(200);
    expect(res.headers['content-type']).toContain('text/html');
    expect(res.text).toContain('SMMpro');
    expect(res.text).toContain('File Downloader');
    expect(res.text).toContain('Detect, Verify & Stream Files');
    expect(res.text).toContain('Live Deployment & API Status');
  });

  it('GET /test renders the Live File Downloader Testing Dashboard', async () => {
    const res = await request(app).get('/test');
    expect(res.status).toBe(200);
    expect(res.headers['content-type']).toContain('text/html');
    expect(res.text).toContain('Live Testing Dashboard');
    expect(res.text).toContain('target-url');
    expect(res.text).toContain('btn-detect');
    expect(res.text).toContain('btn-download');
  });

  it('GET /api/v1/version returns version, nodeVersion, and website', async () => {
    const res = await request(app).get('/api/v1/version');
    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data.version).toBe('1.0.0');
    expect(res.body.data.brand.name).toBe('SMMpro');
    expect(res.body.data.brand.website).toBe('https://smmpro.pk/');
  });

  it('GET /api/v1/platforms returns categories, supported formats, limits, and features', async () => {
    const res = await request(app).get('/api/v1/platforms');
    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data.categories).toContain('archive');
    expect(res.body.data.categories).toContain('document');
    expect(res.body.data.categories).toContain('image');
    expect(res.body.data.categories).toContain('audio');
    expect(res.body.data.categories).toContain('video');
    expect(res.body.data.categories).toContain('package');
    expect(res.body.data.limits.maxFileSizeBytes).toBeGreaterThan(0);
    expect(res.body.data.features.directFileDetection).toBe(true);
    expect(res.body.data.features.streamDownloadProxy).toBe(true);
  });

  it('GET /api/v1/openapi.json returns valid OpenAPI 3.0 specification', async () => {
    const res = await request(app).get('/api/v1/openapi.json');
    expect(res.status).toBe(200);
    expect(res.body.openapi).toMatch(/^3\./);
    expect(res.body.info.title).toBe('SMMpro File Downloader API');
  });

  it('GET /api/docs returns interactive Swagger UI page', async () => {
    const res = await request(app).get('/api/docs/');
    expect(res.status).toBe(200);
    expect(res.text).toContain('swagger-ui');
  });

  it('GET /unknown-route returns 404 with standardized error envelope', async () => {
    const res = await request(app).get('/api/v1/non-existent-endpoint');
    expect(res.status).toBe(404);
    expect(res.body.success).toBe(false);
    expect(res.body.error.code).toBe('NOT_FOUND');
    expect(res.body.data).toBeNull();
  });
});
