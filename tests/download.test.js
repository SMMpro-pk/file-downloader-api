import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import request from 'supertest';
import { app } from '../src/app.js';
import { startMockServer, VALID_ZIP_BUFFER } from './helpers/mock-server.js';

describe('Secure Download Endpoints', () => {
  let mock;

  beforeAll(async () => {
    mock = await startMockServer();
  });

  afterAll(async () => {
    if (mock) await mock.close();
  });

  it('POST /api/v1/download streams the file binary data with safe attachment header', async () => {
    const res = await request(app)
      .post('/api/v1/download')
      .set('x-allow-local-test', 'true')
      .send({ url: `${mock.baseUrl}/valid.zip`, mode: 'stream' })
      .responseType('blob');

    expect(res.status).toBe(200);
    expect(res.headers['content-type']).toContain('application/zip');
    expect(res.headers['content-disposition']).toContain('attachment');
    expect(res.headers['content-disposition']).toContain('smmpro_bundle.zip');
    expect(res.headers['x-content-type-options']).toBe('nosniff');

    // Verify binary integrity
    const receivedBuffer = Buffer.from(res.body);
    expect(receivedBuffer.equals(VALID_ZIP_BUFFER)).toBe(true);
  });

  it('POST /api/v1/download supports redirect mode returning 302', async () => {
    const res = await request(app)
      .post('/api/v1/download')
      .set('x-allow-local-test', 'true')
      .send({ url: `${mock.baseUrl}/valid.zip`, mode: 'redirect' })
      .redirects(0);

    expect(res.status).toBe(302);
    expect(res.headers.location).toContain('/valid.zip');
  });

  it('GET /api/v1/download supports browser streaming via query parameters', async () => {
    const res = await request(app)
      .get(`/api/v1/download?url=${encodeURIComponent(mock.baseUrl + '/valid.zip')}&mode=stream`)
      .set('x-allow-local-test', 'true')
      .responseType('blob');

    expect(res.status).toBe(200);
    expect(res.headers['content-type']).toContain('application/zip');
    const receivedBuffer = Buffer.from(res.body);
    expect(receivedBuffer.equals(VALID_ZIP_BUFFER)).toBe(true);
  });

  it('supports HTTP byte range requests (206 Partial Content)', async () => {
    const res = await request(app)
      .post('/api/v1/download')
      .set('x-allow-local-test', 'true')
      .set('Range', 'bytes=0-15')
      .send({ url: `${mock.baseUrl}/valid.zip`, mode: 'stream' })
      .responseType('blob');

    expect(res.status).toBe(206);
    expect(res.headers['content-range']).toMatch(/^bytes 0-15\/\d+$/);
    const receivedBuffer = Buffer.from(res.body);
    expect(receivedBuffer.length).toBe(16);
    expect(receivedBuffer.equals(VALID_ZIP_BUFFER.subarray(0, 16))).toBe(true);
  });

  it('enforces maximum file size limits (413 Payload Too Large)', async () => {
    const res = await request(app)
      .post('/api/v1/download')
      .set('x-allow-local-test', 'true')
      .send({ url: `${mock.baseUrl}/large-file`, mode: 'stream' });

    expect(res.status).toBe(413);
    expect(res.body.success).toBe(false);
    expect(res.body.error.code).toBe('PAYLOAD_TOO_LARGE');
    expect(res.body.error.message).toContain('exceeds maximum limit');
  });

  it('rejects invalid download mode with 400 validation error', async () => {
    const res = await request(app)
      .post('/api/v1/download')
      .send({ url: `${mock.baseUrl}/valid.zip`, mode: 'invalid_mode' });

    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe('VALIDATION_ERROR');
  });
});
