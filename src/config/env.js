import fs from 'fs';
import path from 'path';
import crypto from 'crypto';
import dotenv from 'dotenv';
import { z } from 'zod';

dotenv.config();

const envSchema = z.object({
  NODE_ENV: z.enum(['development', 'production', 'test']).default('development'),
  PORT: z.coerce.number().int().positive().default(3000),
  HOST: z.string().default('0.0.0.0'),
  PUBLIC_BASE_URL: z
    .string()
    .optional()
    .default('')
    .transform((val) => {
      if (!val || !val.trim()) return '';
      const trimmed = val.trim();
      try {
        const u = new URL(trimmed);
        if (u.protocol !== 'http:' && u.protocol !== 'https:') {
          throw new Error('PUBLIC_BASE_URL must use http:// or https://');
        }
        return u.origin;
      } catch (err) {
        throw new Error(`Invalid PUBLIC_BASE_URL: ${err.message}`);
      }
    }),
  API_BASE_PATH: z
    .string()
    .default('/api/v1')
    .transform((val) => {
      let trimmed = (val || '/api/v1').trim();
      if (!trimmed.startsWith('/')) trimmed = `/${trimmed}`;
      return trimmed.replace(/\/+$/, '');
    }),
  FRONTEND_BASE_URL: z
    .string()
    .optional()
    .default('')
    .transform((val) => {
      if (!val || !val.trim()) return '';
      try {
        const u = new URL(val.trim());
        return u.origin;
      } catch {
        return '';
      }
    }),
  LOCAL_BASE_URL: z
    .string()
    .optional()
    .default('')
    .transform((val) => {
      if (!val || !val.trim()) return '';
      try {
        const u = new URL(val.trim());
        return u.origin;
      } catch {
        return '';
      }
    }),
  API_KEY_REQUIRED: z
    .string()
    .transform((val) => val === 'true' || val === '1')
    .default(false),
  API_KEY: z.string().optional().default(''),
  CORS_ORIGINS: z
    .string()
    .optional()
    .default('*')
    .transform((val) => {
      if (!val || val.trim() === '' || val.trim() === '*') return ['*'];
      return val.split(',').map((o) => o.trim()).filter(Boolean);
    }),
  TRUST_PROXY: z
    .string()
    .transform((val) => {
      if (val === 'true' || val === '1') return true;
      if (val === 'false' || val === '0') return false;
      const num = Number(val);
      if (!isNaN(num)) return num;
      return val.split(',').map((ip) => ip.trim()).filter(Boolean);
    })
    .default(false),
  REQUEST_TIMEOUT_MS: z.coerce.number().int().positive().default(10000),
  EXTRACT_TIMEOUT_MS: z.coerce.number().int().positive().default(15000),
  MAX_REDIRECTS: z.coerce.number().int().min(0).max(20).default(5),
  MAX_EXTRACTED_LINKS: z.coerce.number().int().positive().max(500).default(50),
  MAX_FILE_SIZE_BYTES: z.coerce.number().int().positive().default(1073741824), // 1 GB
  MAX_REQUEST_BODY_BYTES: z.coerce.number().int().positive().default(32768), // 32 KB
  MAX_CONCURRENT_DOWNLOADS: z.coerce.number().int().positive().default(5),
  DETECTION_RATE_LIMIT: z.coerce.number().int().positive().default(30),
  DOWNLOAD_RATE_LIMIT: z.coerce.number().int().positive().default(10),
  LOG_LEVEL: z.enum(['fatal', 'error', 'warn', 'info', 'debug', 'trace', 'silent']).default('info'),
  ENABLE_ARCHIVE_INSPECTION: z
    .string()
    .transform((val) => val === 'true' || val === '1')
    .default(false)
});

export function resolveStableApiKey(dataDir = path.join(process.cwd(), 'data'), suppliedKey = '') {
  if (suppliedKey && suppliedKey.length >= 16) {
    return { key: suppliedKey, source: 'environment' };
  }
  const keyFilePath = path.join(dataDir, '.api-key');
  if (fs.existsSync(keyFilePath)) {
    try {
      const persisted = fs.readFileSync(keyFilePath, 'utf8').trim();
      if (persisted && persisted.length >= 16) {
        return { key: persisted, source: 'file' };
      }
    } catch {
      // Fall through to generate
    }
  }
  if (!fs.existsSync(dataDir)) {
    fs.mkdirSync(dataDir, { recursive: true, mode: 0o750 });
  }
  const generatedKey = crypto.randomBytes(32).toString('hex');
  fs.writeFileSync(keyFilePath, generatedKey, { mode: 0o600, encoding: 'utf8' });
  return { key: generatedKey, source: 'generated' };
}

let parsedEnv;
try {
  parsedEnv = envSchema.parse(process.env);

  // Automatically initialize required runtime directories (temporary files, persistent data)
  const runtimeDirs = [path.join(process.cwd(), 'tmp'), path.join(process.cwd(), 'data')];
  for (const dir of runtimeDirs) {
    if (!fs.existsSync(dir)) {
      try {
        fs.mkdirSync(dir, { recursive: true, mode: 0o750 });
      } catch {
        // Read-only filesystem or restricted container permissions handled gracefully
      }
    }
  }

  // If API_KEY_REQUIRED is enabled, verify or resolve a stable persistent key
  if (parsedEnv.API_KEY_REQUIRED) {
    if (!parsedEnv.API_KEY || parsedEnv.API_KEY.length < 16) {
      const { key, source } = resolveStableApiKey(path.join(process.cwd(), 'data'), parsedEnv.API_KEY);
      parsedEnv.API_KEY = key;
      if (source === 'generated') {
        console.info(`[SECURITY] Stable API key generated and persisted to 'data/.api-key'. Supply API_KEY environment variable to override.`);
      }
    }
  }
} catch (error) {
  // Safe, non-sensitive error formatting
  const message = error instanceof z.ZodError
    ? `Configuration validation error: ${error.issues.map((i) => `${i.path.join('.')}: ${i.message}`).join(', ')}`
    : error.message;
  console.error(`[FATAL] Startup Configuration Failed: ${message}`);
  process.exit(1);
}

export const env = parsedEnv;
export default env;
