import type { VercelRequest, VercelResponse } from '@vercel/node';

type NodeCompatibleResponse = VercelResponse & {
  headersSent?: boolean;
};

// Lazy-load the Express app so any startup crash is caught and returned as a
// structured error response rather than a raw FUNCTION_INVOCATION_FAILED.
let _app: ((req: any, res: any) => void) | null = null;
let _initError: Error | null = null;
let _initAttempted = false;

const loadApp = async () => {
  if (_app) return _app;
  if (_initError && _initAttempted) throw _initError;
  _initAttempted = true;
  try {
    // Validate critical environment variables before loading the app
    if (!process.env.DATABASE_URL) {
      console.error('[api/index] CRITICAL: DATABASE_URL environment variable is not set.');
    }
    if (!process.env.JWT_SECRET && !process.env.SUPABASE_JWT_SECRET) {
      console.error('[api/index] WARNING: No JWT secret configured.');
    }

    // Load from compiled JS output (backend/dist/app.js).
    // The vercel-build script compiles backend TS before deployment.
    // Use dynamic import for ESM/CJS compatibility in Vercel environment.
    // @ts-ignore - Compiled JS may not have declaration files at this location during build
    const mod = await import('../backend/dist/app.js');
    _app = mod.default?.app ?? mod.app ?? mod.default ?? mod;
    
    if (typeof _app !== 'function') {
      throw new Error(`backend/dist/app did not export a valid Express handler. Got: ${typeof _app}`);
    }
    console.log('[api/index] App loaded successfully.');
    return _app!;
  } catch (err: any) {
    _initError = err;
    console.error('[api/index] App failed to load:', err?.message ?? err);
    console.error('[api/index] Stack:', err?.stack);
    throw err;
  }
};

export default async function handler(req: VercelRequest, res: VercelResponse) {
  const nodeRes = res as NodeCompatibleResponse;

  // Health check that doesn't require the full app
  if (req.url === '/api/ping') {
    return res.status(200).json({ status: 'ok', timestamp: new Date().toISOString() });
  }

  try {
    const app = await loadApp();
    return app(req as any, res as any);
  } catch (err: any) {
    console.error('[api/index] Unhandled error during request:', err?.message ?? err);
    if (!nodeRes.headersSent) {
      res.status(500).json({
        success: false,
        error: 'Service temporarily unavailable. Please try again later.',
        code: 'FUNCTION_STARTUP_ERROR',
        details: err?.message,
      });
    }
  }
}
