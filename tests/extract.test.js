import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import request from 'supertest';
import { app } from '../src/app.js';
import { startMockServer } from './helpers/mock-server.js';

describe('Webpage Link Extraction Endpoints', () => {
  let mock;

  beforeAll(async () => {
    mock = await startMockServer();
  });

  afterAll(async () => {
    if (mock) await mock.close();
  });

  it('POST /api/v1/extract-links discovers candidate downloadable links in webpage HTML', async () => {
    const res = await request(app)
      .post('/api/v1/extract-links')
      .set('x-allow-local-test', 'true')
      .send({ url: `${mock.baseUrl}/html-page`, limit: 20 });

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data.totalCandidates).toBeGreaterThan(0);

    const links = res.body.data.links;

    // 1. Found /valid.zip
    const zipLink = links.find((l) => l.url.includes('/valid.zip'));
    expect(zipLink).toBeDefined();
    expect(zipLink.extension).toBe('zip');
    expect(zipLink.category).toBe('archive');
    expect(zipLink.label).toBe('Download ZIP Bundle');
    expect(zipLink.hasDownloadAttribute).toBe(true);

    // 2. Found /image.png
    const pngLink = links.find((l) => l.url.includes('/image.png'));
    expect(pngLink).toBeDefined();
    expect(pngLink.extension).toBe('png');
    expect(pngLink.category).toBe('image');

    // 3. Found external PDF
    const pdfLink = links.find((l) => l.url.includes('example.com/files/manual.pdf'));
    expect(pdfLink).toBeDefined();
    expect(pdfLink.extension).toBe('pdf');
    expect(pdfLink.category).toBe('document');

    // 4. Deduplication: /valid.zip appeared twice in HTML, but should only be returned once
    const zipMatches = links.filter((l) => l.url.includes('/valid.zip'));
    expect(zipMatches.length).toBe(1);

    // 5. Filtered out: internal #section-2 anchor and javascript: action
    expect(links.some((l) => l.url.includes('#section-2'))).toBe(false);
    expect(links.some((l) => l.url.includes('javascript:'))).toBe(false);

    // 6. Filtered out: private network router link (192.168.1.1)
    expect(links.some((l) => l.url.includes('192.168.1.1'))).toBe(false);
  });

  it('respects the limit parameter', async () => {
    const res = await request(app)
      .post('/api/v1/extract-links')
      .set('x-allow-local-test', 'true')
      .send({ url: `${mock.baseUrl}/html-page`, limit: 1 });

    expect(res.status).toBe(200);
    expect(res.body.data.links.length).toBe(1);
  });

  it('rejects invalid URL in extract-links with 400', async () => {
    const res = await request(app)
      .post('/api/v1/extract-links')
      .send({ url: 'not-a-valid-url' });

    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe('VALIDATION_ERROR');
  });
});
