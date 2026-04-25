import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import { errorHandler } from './middleware/error';
import { apiRoutes } from './routes/index';
import { docsRoutes } from './routes/docs';
import { getRedisStatus } from './cache/redis';
import { rateLimit, authenticatedRateLimit } from './middleware/rateLimit';
import { getCircuitBreakerStatus } from './utils/circuitBreaker';

import { logger } from './config/logger';

const app = express();

app.use((req, res, next) => {
  logger.info(`[REQ] ${req.method} ${req.path}`);
  next();
});

// Disable X-Powered-By header to prevent server fingerprinting
app.disable('x-powered-by');

// Add helmet for secure HTTP headers
app.use(helmet());

const buildAllowedOrigins = () => {
  const origins = (process.env.CORS_ORIGIN || process.env.FRONTEND_URL || '')
    .split(',')
    .map(origin => origin.trim())
    .filter(Boolean);

  if (process.env.NODE_ENV !== 'production') {
    origins.push(
      'http://localhost:5173',
      'http://127.0.0.1:5173',
      'http://localhost:9002',
      'http://127.0.0.1:9002',
    );
  }

  if (process.env.VERCEL_URL) {
    origins.push(`https://${process.env.VERCEL_URL}`);
  }

  return Array.from(new Set(origins));
};

const allowedOrigins = buildAllowedOrigins();
const allowAllOrigins = allowedOrigins.length === 0 || allowedOrigins.includes('*');

const isAllowedOrigin = (origin: string) => {
  if (allowAllOrigins) return true;
  if (allowedOrigins.includes(origin)) return true;

  const wildcard = allowedOrigins.find(value => value.startsWith('*.'));
  if (wildcard) {
    const suffix = wildcard.slice(1);
    return origin.endsWith(suffix);
  }

  return false;
};

app.use(cors({
  origin(origin, callback) {
    if (!origin || isAllowedOrigin(origin)) {
      callback(null, true);
      return;
    }

    // Do not throw an error to avoid 500s; simply omit CORS headers.
    callback(null, false);
  },
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
}));
app.use(express.json({ limit: '1mb' }));

// Baseline API throttling for abuse protection (IP + optional user identity).
const defaultGlobalApiRateLimit = process.env.NODE_ENV === 'production' ? 60 : 600;

app.use('/api/v1', rateLimit({
  windowMs: 60_000,
  max: Number(process.env.API_RATE_LIMIT || defaultGlobalApiRateLimit),
  scope: 'api-global',
  message: 'Too many API requests. Please try again later.',
}));

// Stricter bill/ocr endpoint throttling to control compute and storage abuse.
app.use('/api/v1/bills', authenticatedRateLimit({
  windowMs: 60_000,
  max: Number(process.env.BILL_UPLOAD_RATE_LIMIT || 10),
  scope: 'api-bills',
  message: 'Too many bill processing requests. Please try again later.',
}));

app.use('/api/v1/receipts', authenticatedRateLimit({
  windowMs: 60_000,
  max: Number(process.env.RECEIPT_SCAN_RATE_LIMIT || 8),
  scope: 'api-receipts',
  message: 'Too many receipt scan requests. Please try again later.',
}));

// Sync endpoint throttling (higher limit, user-scoped).
app.use('/api/v1/sync', authenticatedRateLimit({
  windowMs: 60_000,
  max: Number(process.env.SYNC_RATE_LIMIT || 100),
  scope: 'api-sync',
  message: 'Too many sync requests. Please try again later.',
}));

// Health check
app.get('/health', (req, res) => {
  res.json({
    status: 'ok',
    timestamp: new Date().toISOString(),
    services: {
      redis: getRedisStatus(),
      circuitBreakers: getCircuitBreakerStatus(),
    },
  });
});

// Public API documentation
app.use('/api-docs', docsRoutes);

// API v1
app.use('/api/v1', apiRoutes);

// 404
app.use('*', (req, res) => {
  res.status(404).json({ error: 'Not found' });
});

// Error handling middleware
app.use(errorHandler);

export { app };
export default app;
