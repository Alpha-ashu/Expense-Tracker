import type { VercelRequest, VercelResponse } from '@vercel/node';

// Lazy-load the Express app so any startup crash is caught and returned as a
// structured error response rather than a raw FUNCTION_INVOCATION_FAILED.
let _app: ((req: any, res: any) => void) | null = null;
let _initError: Error | null = null;

const loadApp = () => {
  if (_app) return _app;
  if (_initError) throw _initError;
  try {
    // Dynamic require so TypeScript compilation still works but the import
    // happens inside a try/catch rather than at module evaluation time.
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const mod = require('../backend/src/app');
    _app = mod.default ?? mod.app ?? mod;
    return _app!;
  } catch (err: any) {
    _initError = err;
    console.error('[api/index] App failed to load:', err?.message ?? err);
    throw err;
  }
};

export default function handler(req: VercelRequest, res: VercelResponse) {
  try {
    const app = loadApp();
    return app(req as any, res as any);
  } catch (err: any) {
    console.error('[api/index] Unhandled error during request:', err?.message ?? err);
    if (!res.headersSent) {
      res.status(500).json({
        success: false,
        error: 'Service temporarily unavailable. Please try again later.',
        code: 'FUNCTION_STARTUP_ERROR',
        details: process.env.NODE_ENV !== 'production' ? err?.message : undefined,
      });
    }
  }
}
