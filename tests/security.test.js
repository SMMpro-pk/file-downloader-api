import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import request from 'supertest';
import { app } from '../src/app.js';
import { sanitizeFilename, resolveFilenames } from '../src/utils/filename.js';
import { isProhibitedIp } from '../src/services/url-validator.service.js';
import { startMockServer } from './helpers/mock-server.js';

describe('Security Controls & SSRF Protection', () => {
  let mock;

  beforeAll(async () => {
    mock = await startMockServer();
  });

  afterAll(async () => {
    if (mock) await mock.close();
  });

  describe('IP Range & Host Prohibitions (SSRF)', () => {
    it('blocks IPv4 loopback (127.0.0.1, 127.0.0.2)', () => {
      expect(isProhibitedIp('127.0.0.1')).toBe(true);
      expect(isProhibitedIp('127.0.0.2')).toBe(true);
    });

    it('blocks AWS/GCP/Azure link-local metadata (169.254.169.254)', () => {
      expect(isProhibitedIp('169.254.169.254')).toBe(true);
      expect(isProhibitedIp('169.254.0.1')).toBe(true);
    });

    it('blocks RFC 1918 private subnets (10.0.0.0/8, 172.16.0.0/12, 192.168.0.0/16)', () => {
      expect(isProhibitedIp('10.0.0.5')).toBe(true);
      expect(isProhibitedIp('172.16.0.1')).toBe(true);
      expect(isProhibitedIp('172.31.255.254')).toBe(true);
      expect(isProhibitedIp('192.168.1.1')).toBe(true);
    });

    it('blocks Carrier Grade NAT (100.64.0.0/10) including Tailscale/metadata', () => {
      expect(isProhibitedIp('100.64.0.1')).toBe(true);
      expect(isProhibitedIp('100.100.100.200')).toBe(true);
    });

    it('blocks IPv6 loopback (::1)', () => {
      expect(isProhibitedIp('::1')).toBe(true);
    });

    it('blocks IPv6 link-local (fe80::1) and unique-local (fc00::1)', () => {
      expect(isProhibitedIp('fe80::1')).toBe(true);
      expect(isProhibitedIp('fc00::1')).toBe(true);
      expect(isProhibitedIp('fd12:3456:789a::1')).toBe(true);
    });

    it('blocks IPv4-mapped IPv6 address pointing to loopback (::ffff:127.0.0.1)', () => {
      expect(isProhibitedIp('::ffff:127.0.0.1')).toBe(true);
      expect(isProhibitedIp('::ffff:192.168.1.1')).toBe(true);
    });

    it('allows legitimate public IP addresses', () => {
      expect(isProhibitedIp('8.8.8.8')).toBe(false);
      expect(isProhibitedIp('1.1.1.1')).toBe(false);
      expect(isProhibitedIp('93.184.215.14')).toBe(false);
    });
  });

  describe('Outbound Request Security Enforcement via API', () => {
    it('rejects loopback URL without bypass flag', async () => {
      const res = await request(app)
        .post('/api/v1/files/detect')
        .send({ url: 'http://127.0.0.1:8080/file.zip' });

      expect(res.status).toBe(403);
      expect(res.body.success).toBe(false);
      expect(res.body.error.code).toBe('FORBIDDEN_DESTINATION');
    });

    it('rejects cloud metadata IP directly (169.254.169.254)', async () => {
      const res = await request(app)
        .post('/api/v1/files/detect')
        .send({ url: 'http://169.254.169.254/latest/meta-data/' });

      expect(res.status).toBe(403);
      expect(res.body.error.code).toBe('FORBIDDEN_DESTINATION');
    });

    it('rejects private RFC 1918 IPs (192.168.1.1, 10.0.0.1)', async () => {
      const res = await request(app)
        .post('/api/v1/files/detect')
        .send({ url: 'http://192.168.1.1/firmware.bin' });

      expect(res.status).toBe(403);
      expect(res.body.error.code).toBe('FORBIDDEN_DESTINATION');
    });

    it('rejects blocked hostnames (localhost, metadata.google.internal)', async () => {
      const res = await request(app)
        .post('/api/v1/files/detect')
        .send({ url: 'http://localhost:3000/archive.zip' });

      expect(res.status).toBe(403);
      expect(res.body.error.code).toBe('FORBIDDEN_DESTINATION');
    });

    it('rejects blocked private domain suffixes (.internal, .local, .onion)', async () => {
      const res = await request(app)
        .post('/api/v1/files/detect')
        .send({ url: 'http://database.internal/dump.sql' });

      expect(res.status).toBe(403);
      expect(res.body.error.code).toBe('FORBIDDEN_DESTINATION');
    });

    it('rejects unsupported URL schemes (ftp://, gopher://, file://)', async () => {
      const res = await request(app)
        .post('/api/v1/files/detect')
        .send({ url: 'ftp://ftp.example.com/files/archive.zip' });

      expect(res.status).toBe(400);
      expect(res.body.error.code).toBe('VALIDATION_ERROR');
      expect(res.body.error.message).toContain('Unsupported URL scheme');
    });

    it('rejects URLs containing embedded user credentials', async () => {
      const res = await request(app)
        .post('/api/v1/files/detect')
        .send({ url: 'http://admin:secret123@example.com/files/data.zip' });

      expect(res.status).toBe(400);
      expect(res.body.error.code).toBe('VALIDATION_ERROR');
      expect(res.body.error.message).toContain('embedded credentials');
    });

    it('blocks SSRF via redirect to private destination', async () => {
      const res = await request(app)
        .post('/api/v1/files/detect')
        .set('x-allow-local-test', 'true') // allows mock server on 127.0.0.1
        .send({ url: `${mock.baseUrl}/redirect-to-private` });

      // The redirect targets 169.254.169.254 which must be blocked even when local test is enabled!
      expect(res.status).toBe(403);
      expect(res.body.error.code).toBe('FORBIDDEN_DESTINATION');
    });

    it('detects and terminates redirect loops', async () => {
      const res = await request(app)
        .post('/api/v1/files/detect')
        .set('x-allow-local-test', 'true')
        .send({ url: `${mock.baseUrl}/redirect-loop` });

      expect(res.status).toBe(400);
      expect(res.body.error.code).toBe('VALIDATION_ERROR');
      expect(res.body.error.message).toContain('Redirect limit exceeded');
    });
  });

  describe('Filename Security Sanitization', () => {
    it('neutralizes path traversal sequences (../ and ..\\)', () => {
      const safe = sanitizeFilename('../../etc/passwd');
      expect(safe).toBe('passwd');
      expect(safe).not.toContain('..');
      expect(safe).not.toContain('/');
    });

    it('strips null bytes and control characters', () => {
      const safe = sanitizeFilename('malicious\0file.pdf\x08');
      expect(safe).toBe('maliciousfile.pdf');
    });

    it('prefixes Windows reserved device names (CON, AUX, NUL, COM1, LPT1)', () => {
      expect(sanitizeFilename('CON.txt')).toBe('safe_CON.txt');
      expect(sanitizeFilename('aux.pdf')).toBe('safe_aux.pdf');
      expect(sanitizeFilename('nul.zip')).toBe('safe_nul.zip');
      expect(sanitizeFilename('com1.exe')).toBe('safe_com1.exe');
    });

    it('replaces dangerous filesystem characters (<>:"/\\|?*) with underscores', () => {
      const safe = sanitizeFilename('my<file>:name"test|?.zip');
      expect(safe).toBe('my_file_name_test_.zip');
    });

    it('provides safe fallback filename when input is empty or invalid', () => {
      expect(sanitizeFilename('')).toBe('download.bin');
      expect(sanitizeFilename('...')).toBe('download.bin');
      expect(sanitizeFilename('///')).toBe('download.bin');
    });

    it('appends detected extension if safe filename lacks one', () => {
      const res = resolveFilenames({
        url: 'https://example.com/download-action',
        detectedExt: 'zip'
      });
      expect(res.safeFilename).toBe('download-action.zip');
      expect(res.extension).toBe('zip');
    });
  });
});
