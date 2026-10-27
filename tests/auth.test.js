import { describe, it, expect } from 'vitest';
import request from 'supertest';
import express from 'express';
import { env } from '../src/config/env.js';
import { apiKeyMiddleware } from '../src/middleware/api-key.middleware.js';
import { requestIdMiddleware } from '../src/middleware/request-id.middleware.js';
import { errorHandler } from '../src/middleware/error.middleware.js';

describe('API Key Authentication Middleware', () => {
  const testApp = express();
  testApp.use(requestIdMiddleware);
  testApp.use(apiKeyMiddleware);
  testApp.get('/test-protected', (req, res) => res.jsonEnvelope({ access: 'granted' }));
  testApp.use(errorHandler);

  it('allows access when API_KEY_REQUIRED is false', async () => {
    env.API_KEY_REQUIRED = false;
    const res = await request(testApp).get('/test-protected');
    expect(res.status).toBe(200);
    expect(res.body.data.access).toBe('granted');
  });

  it('rejects with 401 when API_KEY_REQUIRED is true and header is missing', async () => {
    env.API_KEY_REQUIRED = true;
    env.API_KEY = 'test_secret_key_at_least_32_characters_long_12345';

    const res = await request(testApp).get('/test-protected');
    expect(res.status).toBe(401);
    expect(res.body.success).toBe(false);
    expect(res.body.error.code).toBe('UNAUTHORIZED');
    expect(res.body.error.message).toContain('Missing required X-API-Key');
  });

  it('rejects with 401 when API_KEY_REQUIRED is true and key is incorrect', async () => {
    env.API_KEY_REQUIRED = true;
    env.API_KEY = 'test_secret_key_at_least_32_characters_long_12345';

    const res = await request(testApp)
      .get('/test-protected')
      .set('X-API-Key', 'wrong_secret_key');

    expect(res.status).toBe(401);
    expect(res.body.success).toBe(false);
    expect(res.body.error.code).toBe('UNAUTHORIZED');
    expect(res.body.error.message).toContain('Invalid API key');
  });

  it('allows access when API_KEY_REQUIRED is true and valid key is provided', async () => {
    env.API_KEY_REQUIRED = true;
    env.API_KEY = 'test_secret_key_at_least_32_characters_long_12345';

    const res = await request(testApp)
      .get('/test-protected')
      .set('X-API-Key', 'test_secret_key_at_least_32_characters_long_12345');

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data.access).toBe('granted');

    // Reset back to false for other tests
    env.API_KEY_REQUIRED = false;
  });
});
