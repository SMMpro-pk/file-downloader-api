import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import request from 'supertest';
import { app } from '../src/app.js';
import { startMockServer } from './helpers/mock-server.js';

describe('Archive Inspection Endpoints', () => {
  let mock;

  beforeAll(async () => {
    mock = await startMockServer();
  });

  afterAll(async () => {
    if (mock) await mock.close();
  });

  it('POST /api/v1/archive/inspect inspects valid ZIP archive entries', async () => {
    const res = await request(app)
      .post('/api/v1/archive/inspect')
      .set('x-allow-local-test', 'true')
      .send({ url: `${mock.baseUrl}/valid.zip` });

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data.format).toBe('zip');
    expect(res.body.data.totalEntries).toBeGreaterThan(0);
    expect(res.body.data.hasSuspiciousEntries).toBe(false);

    const firstEntry = res.body.data.entries[0];
    expect(firstEntry.fileName).toBe('document.txt');
    expect(firstEntry.uncompressedSize).toBeGreaterThan(0);
    expect(firstEntry.isDirectory).toBe(false);
  });

  it('detects directory traversal attack entries in ZIP archives', async () => {
    const res = await request(app)
      .post('/api/v1/archive/inspect')
      .set('x-allow-local-test', 'true')
      .send({ url: `${mock.baseUrl}/traversal.zip` });

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data.hasSuspiciousEntries).toBe(true);
    expect(res.body.data.securityWarnings.some((w) => w.includes('traversal'))).toBe(true);

    const suspiciousEntry = res.body.data.entries.find((e) => e.fileName.includes('..'));
    expect(suspiciousEntry).toBeDefined();
    expect(suspiciousEntry.isSuspicious).toBe(true);
  });

  it('returns 415 Unsupported Format when inspecting non-ZIP files', async () => {
    const res = await request(app)
      .post('/api/v1/archive/inspect')
      .set('x-allow-local-test', 'true')
      .send({ url: `${mock.baseUrl}/image.png` });

    expect(res.status).toBe(415);
    expect(res.body.success).toBe(false);
    expect(res.body.error.code).toBe('UNSUPPORTED_FORMAT');
  });
});
