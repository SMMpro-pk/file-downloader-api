import fs from 'fs';
import path from 'path';
import os from 'os';
import { fileURLToPath } from 'url';
import { describe, it, expect } from 'vitest';
import request from 'supertest';
import { app } from '../src/app.js';
import { env, resolveStableApiKey } from '../src/config/env.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const rootDir = path.resolve(__dirname, '../');

describe('Docker Auto-Deployment & Zero-Configuration Requirements', () => {
  describe('Mandatory Public Endpoints & Interfaces', () => {
    it('GET / serves homepage with service status and documentation links', async () => {
      const res = await request(app).get('/');
      expect(res.status).toBe(200);
      expect(res.headers['content-type']).toContain('text/html');
      expect(res.text).toContain('SMMpro');
      expect(res.text).toContain('File Downloader');
      expect(res.text).toContain('/api/docs');
      expect(res.text).toContain('/test');
    });

    it('GET /test serves interactive live API testing page with link discovery and detection controls', async () => {
      const res = await request(app).get('/test');
      expect(res.status).toBe(200);
      expect(res.headers['content-type']).toContain('text/html');
      expect(res.text).toContain('target-url');
      expect(res.text).toContain('btn-detect');
      expect(res.text).toContain('btn-info');
      expect(res.text).toContain('btn-extract');
      expect(res.text).toContain('btn-download');
      expect(res.text).toContain('links-card');
      expect(res.text).toContain('results-card');
    });

    it('GET /api/v1/health returns health status ok or healthy', async () => {
      const res = await request(app).get('/api/v1/health');
      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(['healthy', 'ok']).toContain(res.body.data.status);
      expect(res.body.data.uptimeSeconds).toBeGreaterThanOrEqual(0);
    });

    it('GET /api/v1/ready returns readiness confirmation', async () => {
      const res = await request(app).get('/api/v1/ready');
      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.ready).toBe(true);
    });

    it('GET /api/v1/version returns service semantic version', async () => {
      const res = await request(app).get('/api/v1/version');
      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.version).toBeDefined();
    });

    it('GET /api/v1/platforms returns supported categories and capabilities', async () => {
      const res = await request(app).get('/api/v1/platforms');
      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.categories).toBeDefined();
      expect(Array.isArray(res.body.data.categories)).toBe(true);
      expect(res.body.data.categories.length).toBeGreaterThan(0);
    });

    it('GET /api/docs serves Swagger UI documentation', async () => {
      const res = await request(app).get('/api/docs/');
      expect(res.status).toBe(200);
      expect(res.text).toContain('swagger-ui');
    });

    it('GET /api/openapi.json and /api/v1/openapi.json expose the OpenAPI specification', async () => {
      const res1 = await request(app).get('/api/openapi.json');
      expect(res1.status).toBe(200);
      expect(res1.body.openapi).toBe('3.0.3');
      expect(res1.body.info.title).toContain('SMMpro File Downloader');

      const res2 = await request(app).get('/api/v1/openapi.json');
      expect(res2.status).toBe(200);
      expect(res2.body.openapi).toBe('3.0.3');
    });

    it('GET /api/v1/config/public exposes only safe public config and NEVER leaks secrets', async () => {
      const res = await request(app).get('/api/v1/config/public');
      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);

      const config = res.body.data;
      expect(config.appName).toBeDefined();
      expect(config.version).toBeDefined();
      expect(config.apiKeyRequired).toBeDefined();
      expect(config.apiBaseUrl).toBeDefined();

      // Crucial security checks: No API keys, credentials, or internal secrets
      expect(config.apiKey).toBeUndefined();
      expect(config.API_KEY).toBeUndefined();
      expect(config.secret).toBeUndefined();
      expect(JSON.stringify(config)).not.toContain(env.API_KEY || 'RANDOM_NON_EXISTENT_KEY');
    });
  });

  describe('Zero-Manual-Configuration & Directory Auto-Initialization', () => {
    it('creates data and tmp directories automatically without manual intervention', () => {
      const dataDir = path.join(rootDir, 'data');
      const tmpDir = path.join(rootDir, 'tmp');

      expect(fs.existsSync(dataDir)).toBe(true);
      expect(fs.existsSync(tmpDir)).toBe(true);

      const dataStat = fs.statSync(dataDir);
      const tmpStat = fs.statSync(tmpDir);
      expect(dataStat.isDirectory()).toBe(true);
      expect(tmpStat.isDirectory()).toBe(true);
    });

    it('persists a stable API key across container restarts and reuses it without generating a new key', () => {
      // Use an isolated temporary data directory
      const testDataDir = path.join(os.tmpdir(), `smmpro-test-key-${Date.now()}`);

      // First run: No key file exists -> generates new key and writes it
      const run1 = resolveStableApiKey(testDataDir, '');
      expect(run1.source).toBe('generated');
      expect(run1.key.length).toBeGreaterThanOrEqual(32);

      const keyFile = path.join(testDataDir, '.api-key');
      expect(fs.existsSync(keyFile)).toBe(true);
      const savedKey = fs.readFileSync(keyFile, 'utf8').trim();
      expect(savedKey).toBe(run1.key);

      // Second run (simulating container restart): Key file exists -> must return EXACT same key
      const run2 = resolveStableApiKey(testDataDir, '');
      expect(run2.source).toBe('file');
      expect(run2.key).toBe(run1.key);

      // Third run: If hosting provider supplies key via env var, it takes precedence
      const run3 = resolveStableApiKey(testDataDir, 'custom-fixed-environment-api-key-32chars');
      expect(run3.source).toBe('environment');
      expect(run3.key).toBe('custom-fixed-environment-api-key-32chars');

      // Cleanup
      try {
        fs.rmSync(testDataDir, { recursive: true, force: true });
      } catch {
        // ignore
      }
    });

    it('never trusts arbitrary incoming Host headers to construct URLs', async () => {
      const res = await request(app)
        .get('/api/v1/config/public')
        .set('Host', 'evil-attacker-website.com');

      expect(res.status).toBe(200);
      // The returned public config must NOT contain evil-attacker-website.com
      expect(res.body.data.publicBaseUrl).not.toContain('evil-attacker-website.com');
      expect(res.body.data.apiBaseUrl).not.toContain('evil-attacker-website.com');
    });
  });
});
