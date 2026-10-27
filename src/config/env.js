import dotenv from 'dotenv';
import { z } from 'zod';

dotenv.config();

const envSchema = z.object({
  NODE_ENV: z.enum(['development', 'production', 'test']).default('development'),
  PORT: z.coerce.number().int().positive().default(3000),
  HOST: z.string().default('0.0.0.0'),
  API_KEY_REQUIRED: z
    .string()
    .transform((val) => val === 'true' || val === '1')
    .default(false),
  API_KEY: z.string().optional().default(''),
  CORS_ORIGINS: z
    .string()
    .transform((val) => val.split(',').map((o) => o.trim()).filter(Boolean))
    .default('http://localhost:3000,https://smmpro.pk'),
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

let parsedEnv;
try {
  parsedEnv = envSchema.parse(process.env);

  // Validate API key requirements if enforced
  if (parsedEnv.API_KEY_REQUIRED && (!parsedEnv.API_KEY || parsedEnv.API_KEY.length < 16)) {
    throw new Error('API_KEY is required and must be at least 16 characters when API_KEY_REQUIRED is enabled.');
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
