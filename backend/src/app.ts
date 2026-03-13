import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import { errorHandler } from './middleware/error';
import { apiRoutes } from './routes/index';
import { getRedisStatus } from './cache/redis';

const app = express();

// Disable X-Powered-By header to prevent server fingerprinting
app.disable('x-powered-by');

// Add helmet for secure HTTP headers
app.use(helmet());

const buildAllowedOrigins = () => {
  const origins = (process.env.CORS_ORIGIN || process.env.FRONTEND_URL || '')
    .split(',')
    .map(origin => origin.trim())
    .filter(Boolean);

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

// Health check
app.get('/health', (req, res) => {
  res.json({
    status: 'ok',
    timestamp: new Date().toISOString(),
    services: {
      redis: getRedisStatus(),
    },
  });
});

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
