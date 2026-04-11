import { z } from 'zod';

const envSchema = z.object({
  NODE_ENV: z.enum(['development', 'production', 'test']).default('development'),
  PORT: z.coerce.number().default(3000),
  DATABASE_URL: z.string().url(),
  REDIS_URL: z.string().url().optional(),
  REDIS_TLS: z
    .union([z.boolean(), z.string()])
    .optional()
    .transform((value) => {
      if (typeof value === 'boolean') return value;
      if (typeof value === 'string') return value === 'true';
      return false;
    }),
  JWT_SECRET: z.string().min(32),
  FRONTEND_URL: z.string().url().optional(),
  LOG_LEVEL: z.enum(['error', 'warn', 'info', 'debug']).default('info'),
  // API Keys and Credentials
  STRIPE_API_KEY: z.string().optional(),
  OPENAI_API_KEY: z.string().optional(),
  GOOGLE_API_KEY: z.string().optional(),
  FIREBASE_SECRET: z.string().optional(),
  AWS_SECRET_ACCESS_KEY: z.string().optional(),
  SENDGRID_API_KEY: z.string().optional(),
  RECEIPT_OCR_ENDPOINT: z.string().url().optional(),
  RECEIPT_OCR_API_KEY: z.string().optional(),
  RECEIPT_OCR_TIMEOUT_MS: z.coerce.number().int().positive().optional(),
  RECEIPT_SCAN_RATE_LIMIT: z.coerce.number().int().positive().optional(),
});

const parsed = envSchema.safeParse(process.env);

if (!parsed.success) {
  console.error('❌ Invalid environment variables:', JSON.stringify(parsed.error.format(), null, 2));
  
  if (process.env.NODE_ENV === 'production' && !process.env.VERCEL) {
    // In strict production (non-Vercel), we might still want to catch this later
    // but on Vercel, we need to be careful not to crash the whole runtime if possible.
  }
}

export const env = parsed.success 
  ? parsed.data 
  : (process.env as any); // Fallback to raw process.env if validation fails