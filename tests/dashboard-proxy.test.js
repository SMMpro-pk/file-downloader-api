import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import request from 'supertest';
import { app } from '../src/app.js';
import { env } from '../src/config/env.js';
import { UrlDiscoveryService } from '../src/services/url-discovery.service.js';
import { startMockServer, VALID_ZIP_BUFFER } from './helpers/mock-server.js';

describe('Dashboard Same-Origin Proxy & URL Discovery Service', () => {
  let mock;

  beforeAll(async () => {
    mock = await startMockServer();
  });

  afterAll(async () => {
    if (mock) await mock.close();
  });

  describe('UrlDiscoveryService Logic', () => {
    it('constructs correct API base URL when PUBLIC_BASE_URL is set dynamically to any domain', () => {
      const original = env.PUBLIC_BASE_URL;
      env.PUBLIC_BASE_URL = 'https://api.custom-customer-domain.example';

      const config = UrlDiscoveryService.getPublicConfig();
      expect(config.publicBaseUrl).toBe('https://api.custom-customer-domain.example');
      expect(config.apiBaseUrl).toBe('https://api.custom-customer-domain.example/api/v1');
      expect(config.docsUrl).toBe('https://api.custom-customer-domain.example/api/docs');
      expect(config.healthUrl).toBe('https://api.custom-customer-domain.example/api/v1/health');
      expect(config.testPageUrl).toBe('https://api.custom-customer-domain.example/test');

      env.PUBLIC_BASE_URL = original;
    });

    it('auto-detects Render.com external URL from RENDER_EXTERNAL_URL environment variable', () => {
      const originalEnv = env.PUBLIC_BASE_URL;
      env.PUBLIC_BASE_URL = '';
      process.env.RENDER_EXTERNAL_URL = 'https://smmpro-downloader.onrender.com';

      const url = UrlDiscoveryService.discoverPublicBaseUrl();
      expect(url).toBe('https://smmpro-downloader.onrender.com');

      delete process.env.RENDER_EXTERNAL_URL;
      env.PUBLIC_BASE_URL = originalEnv;
    });

    it('auto-detects Railway.app public domain from RAILWAY_PUBLIC_DOMAIN', () => {
      const originalEnv = env.PUBLIC_BASE_URL;
      env.PUBLIC_BASE_URL = '';
      process.env.RAILWAY_PUBLIC_DOMAIN = 'smmpro-downloader.up.railway.app';

      const url = UrlDiscoveryService.discoverPublicBaseUrl();
      expect(url).toBe('https://smmpro-downloader.up.railway.app');

      delete process.env.RAILWAY_PUBLIC_DOMAIN;
      env.PUBLIC_BASE_URL = originalEnv;
    });

    it('auto-detects Fly.io domain from FLY_APP_NAME', () => {
      const originalEnv = env.PUBLIC_BASE_URL;
      env.PUBLIC_BASE_URL = '';
      process.env.FLY_APP_NAME = 'smmpro-file-api';

      const url = UrlDiscoveryService.discoverPublicBaseUrl();
      expect(url).toBe('https://smmpro-file-api.fly.dev');

      delete process.env.FLY_APP_NAME;
      env.PUBLIC_BASE_URL = originalEnv;
    });

    it('auto-detects Heroku domain from HEROKU_APP_NAME', () => {
      const originalEnv = env.PUBLIC_BASE_URL;
      env.PUBLIC_BASE_URL = '';
      process.env.HEROKU_APP_NAME = 'my-custom-file-api';

      const url = UrlDiscoveryService.discoverPublicBaseUrl();
      expect(url).toBe('https://my-custom-file-api.herokuapp.com');

      delete process.env.HEROKU_APP_NAME;
      env.PUBLIC_BASE_URL = originalEnv;
    });

    it('auto-detects Koyeb domain from KOYEB_PUBLIC_DOMAIN', () => {
      const originalEnv = env.PUBLIC_BASE_URL;
      env.PUBLIC_BASE_URL = '';
      process.env.KOYEB_PUBLIC_DOMAIN = 'my-api-koyeb.koyeb.app';

      const url = UrlDiscoveryService.discoverPublicBaseUrl();
      expect(url).toBe('https://my-api-koyeb.koyeb.app');

      delete process.env.KOYEB_PUBLIC_DOMAIN;
      env.PUBLIC_BASE_URL = originalEnv;
    });

    it('supports configurable local development URL via LOCAL_BASE_URL or dynamic port', () => {
      const originalNodeEnv = env.NODE_ENV;
      const originalPublicUrl = env.PUBLIC_BASE_URL;
      const originalLocalUrl = env.LOCAL_BASE_URL;
      const originalPort = env.PORT;

      env.NODE_ENV = 'development';
      env.PUBLIC_BASE_URL = '';
      env.LOCAL_BASE_URL = 'http://127.0.0.1:8080';

      let url = UrlDiscoveryService.discoverPublicBaseUrl();
      expect(url).toBe('http://127.0.0.1:8080');

      env.LOCAL_BASE_URL = '';
      env.PORT = 4500;
      url = UrlDiscoveryService.discoverPublicBaseUrl();
      expect(url).toBe('http://localhost:4500');

      env.NODE_ENV = originalNodeEnv;
      env.PUBLIC_BASE_URL = originalPublicUrl;
      env.LOCAL_BASE_URL = originalLocalUrl;
      env.PORT = originalPort;
    });

    it('reports configuration_required when running in production without configured or provider domain', () => {
      const originalNodeEnv = env.NODE_ENV;
      const originalPublicUrl = env.PUBLIC_BASE_URL;

      env.NODE_ENV = 'production';
      env.PUBLIC_BASE_URL = '';

      const status = UrlDiscoveryService.getDeploymentStatus();
      expect(status).toBe('configuration_required');

      const config = UrlDiscoveryService.getPublicConfig();
      expect(config.configurationHelp).toContain('Public URL not automatically detected');

      env.NODE_ENV = originalNodeEnv;
      env.PUBLIC_BASE_URL = originalPublicUrl;
    });
  });

  describe('Dashboard UI & Deployment URL Display', () => {
    it('GET / contains copy buttons and display elements for all 5 key URLs', async () => {
      const res = await request(app).get('/');
      expect(res.status).toBe(200);
      expect(res.text).toContain('display-public-url');
      expect(res.text).toContain('display-api-url');
      expect(res.text).toContain('display-health-url');
      expect(res.text).toContain('display-docs-url');
      expect(res.text).toContain('display-test-url');
      expect(res.text).toContain('config-help-box');
      expect(res.text).toContain('data-target="display-public-url"');
      expect(res.text).toContain('data-target="display-api-url"');
      expect(res.text).toContain('data-target="display-health-url"');
      expect(res.text).toContain('data-target="display-docs-url"');
      expect(res.text).toContain('data-target="display-test-url"');
    });

    it('GET /test contains copy buttons and display elements for all 5 key URLs', async () => {
      const res = await request(app).get('/test');
      expect(res.status).toBe(200);
      expect(res.text).toContain('display-public-url');
      expect(res.text).toContain('display-api-url');
      expect(res.text).toContain('display-health-url');
      expect(res.text).toContain('display-docs-url');
      expect(res.text).toContain('display-test-url');
      expect(res.text).toContain('config-help-box');
      expect(res.text).toContain('data-target="display-public-url"');
      expect(res.text).toContain('data-target="display-api-url"');
      expect(res.text).toContain('data-target="display-health-url"');
      expect(res.text).toContain('data-target="display-docs-url"');
      expect(res.text).toContain('data-target="display-test-url"');
    });
  });

  describe('Same-Origin Dashboard Backend-for-Frontend Proxy', () => {
    it('POST /api/internal/detect succeeds for same-origin requests without client API key', async () => {
      const res = await request(app)
        .post('/api/internal/detect')
        .set('x-test-internal-proxy', 'true')
        .set('x-allow-local-test', 'true')
        .send({ url: `${mock.baseUrl}/valid.zip` });

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.formatStatus).toBe('verified');
      expect(res.body.data.extension).toBe('zip');
      expect(res.body.data.downloadAvailable).toBe(true);
    });

    it('POST /api/internal/info succeeds for same-origin requests', async () => {
      const res = await request(app)
        .post('/api/internal/info')
        .set('x-test-internal-proxy', 'true')
        .set('x-allow-local-test', 'true')
        .send({ url: `${mock.baseUrl}/valid.zip` });

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.filename).toBe('smmpro_bundle.zip');
    });

    it('POST /api/internal/download streams the file for same-origin requests', async () => {
      const res = await request(app)
        .post('/api/internal/download')
        .set('x-test-internal-proxy', 'true')
        .set('x-allow-local-test', 'true')
        .send({ url: `${mock.baseUrl}/valid.zip`, mode: 'stream' })
        .responseType('blob');

      expect(res.status).toBe(200);
      expect(res.headers['content-type']).toContain('application/zip');
      expect(res.headers['content-disposition']).toContain('smmpro_bundle.zip');
      const received = Buffer.from(res.body);
      expect(received.equals(VALID_ZIP_BUFFER)).toBe(true);
    });

    it('POST /api/internal/extract-links discovers downloadable links on webpage without client API key', async () => {
      const res = await request(app)
        .post('/api/internal/extract-links')
        .set('x-test-internal-proxy', 'true')
        .set('x-allow-local-test', 'true')
        .send({ url: `${mock.baseUrl}/html-page`, limit: 10 });

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.totalCandidates).toBeGreaterThan(0);
      expect(res.body.data.links.some((l) => l.url.includes('/valid.zip'))).toBe(true);
    });

    it('blocks cross-origin access to /api/internal endpoints with 403 Forbidden', async () => {
      const res = await request(app)
        .post('/api/internal/detect')
        .set('sec-fetch-site', 'cross-site')
        .set('origin', 'https://malicious-website.com')
        .send({ url: `${mock.baseUrl}/valid.zip` });

      expect(res.status).toBe(403);
      expect(res.body.success).toBe(false);
      expect(res.body.error.code).toBe('FORBIDDEN_ORIGIN');
    });
  });
});
