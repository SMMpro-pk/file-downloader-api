import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import request from 'supertest';
import { app } from '../src/app.js';
import { startMockServer, VALID_ZIP_BUFFER, PNG_BUFFER } from './helpers/mock-server.js';

describe('File Detection & Metadata Endpoints', () => {
  let mock;

  beforeAll(async () => {
    mock = await startMockServer();
  });

  afterAll(async () => {
    if (mock) await mock.close();
  });

  describe('POST /api/v1/files/detect', () => {
    it('detects a valid ZIP archive via binary signature', async () => {
      const res = await request(app)
        .post('/api/v1/files/detect')
        .set('x-allow-local-test', 'true')
        .send({ url: `${mock.baseUrl}/valid.zip` });

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.formatStatus).toBe('verified');
      expect(res.body.data.fileType).toBe('archive');
      expect(res.body.data.extension).toBe('zip');
      expect(res.body.data.detectedMimeType).toBe('application/zip');
      expect(res.body.data.sizeBytes).toBe(VALID_ZIP_BUFFER.length);
      expect(res.body.data.supportsRanges).toBe(true);
      expect(res.body.data.downloadAvailable).toBe(true);
      expect(res.body.data.filename).toBe('smmpro_bundle.zip');
    });

    it('detects a PNG image format correctly', async () => {
      const res = await request(app)
        .post('/api/v1/files/detect')
        .set('x-allow-local-test', 'true')
        .send({ url: `${mock.baseUrl}/image.png` });

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.formatStatus).toBe('verified');
      expect(res.body.data.fileType).toBe('image');
      expect(res.body.data.extension).toBe('png');
      expect(res.body.data.detectedMimeType).toBe('image/png');
      expect(res.body.data.sizeBytes).toBe(PNG_BUFFER.length);
    });

    it('detects file format when URL path lacks an extension', async () => {
      const res = await request(app)
        .post('/api/v1/files/detect')
        .set('x-allow-local-test', 'true')
        .send({ url: `${mock.baseUrl}/no-extension` });

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.formatStatus).toBe('verified');
      expect(res.body.data.extension).toBe('zip');
      expect(res.body.data.safeFilename).toContain('data_export.zip');
    });

    it('identifies MIME and extension mismatches and raises warnings in inspect', async () => {
      const res = await request(app)
        .post('/api/v1/files/inspect')
        .set('x-allow-local-test', 'true')
        .send({ url: `${mock.baseUrl}/mismatched.pdf` });

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.formatStatus).toBe('verified');
      expect(res.body.data.detectedMimeType).toBe('image/png'); // Binary is PNG
      expect(res.body.data.mimeType).toBe('application/pdf'); // Server claimed PDF
      expect(res.body.data.securityWarnings.length).toBeGreaterThan(0);
      expect(res.body.data.securityWarnings.some((w) => w.includes('MIME mismatch'))).toBe(true);
      expect(res.body.data.securityWarnings.some((w) => w.includes('Extension mismatch'))).toBe(true);
    });

    it('returns null (not zero) for sizeBytes and sizeHuman when Content-Length is missing', async () => {
      const res = await request(app)
        .post('/api/v1/files/detect')
        .set('x-allow-local-test', 'true')
        .send({ url: `${mock.baseUrl}/no-content-length` });

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.sizeBytes).toBeNull();
      expect(res.body.data.sizeHuman).toBeNull();
      expect(res.body.data.formatStatus).toBe('verified');
    });

    it('returns 422 Unprocessable Entity when URL points to an HTML webpage instead of a file', async () => {
      const res = await request(app)
        .post('/api/v1/files/detect')
        .set('x-allow-local-test', 'true')
        .send({ url: `${mock.baseUrl}/html-page` });

      expect(res.status).toBe(422);
      expect(res.body.success).toBe(false);
      expect(res.body.error.code).toBe('UNPROCESSABLE_ENTITY');
      expect(res.body.error.message).toContain('HTML webpage');
    });

    it('identifies authentication requirements (401)', async () => {
      const res = await request(app)
        .post('/api/v1/files/info')
        .set('x-allow-local-test', 'true')
        .send({ url: `${mock.baseUrl}/requires-auth` });

      expect(res.status).toBe(200);
      expect(res.body.data.requiresAuth).toBe(true);
      expect(res.body.data.downloadAvailable).toBe(false);
    });

    it('follows HTTP redirect chains and reports redirect count', async () => {
      const res = await request(app)
        .post('/api/v1/files/inspect')
        .set('x-allow-local-test', 'true')
        .send({ url: `${mock.baseUrl}/redirect-chain` });

      expect(res.status).toBe(200);
      expect(res.body.data.redirectCount).toBe(2);
      expect(res.body.data.finalUrl).toContain('/valid.zip');
      expect(res.body.data.formatStatus).toBe('verified');
    });
  });
});
