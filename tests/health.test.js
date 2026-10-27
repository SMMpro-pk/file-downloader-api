import { describe, it, expect } from 'vitest';
import request from 'supertest';
import { app } from '../src/app.js';

describe('System & Health Endpoints', () => {
  it('GET /api/v1/health returns healthy status and SMMpro brand info', async () => {
    const res = await request(app).get('/api/v1/health');
    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data.status).toBe('healthy');
    expect(res.body.data.brand).toBe('SMMpro');
    expect(res.body.data.service).toBe('SMMpro File Downloader API');
    expect(typeof res.body.data.uptimeSeconds).toBe('number');
    expect(res.body.requestId).toMatch(/^req_/);
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
