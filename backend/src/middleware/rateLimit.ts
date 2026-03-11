import { Request, Response, NextFunction } from 'express';

type RateLimitOptions = {
  windowMs: number;
  max: number;
  keyGenerator?: (req: Request) => string;
};

const buckets = new Map<string, { count: number; resetAt: number }>();

export const rateLimit = ({ windowMs, max, keyGenerator }: RateLimitOptions) =>
  (req: Request, res: Response, next: NextFunction) => {
    const key = keyGenerator?.(req) || req.ip || 'anonymous';
    const now = Date.now();

    const bucket = buckets.get(key);
    if (!bucket || bucket.resetAt <= now) {
      buckets.set(key, { count: 1, resetAt: now + windowMs });
      return next();
    }

    if (bucket.count >= max) {
      const retryAfter = Math.ceil((bucket.resetAt - now) / 1000);
      res.setHeader('Retry-After', retryAfter.toString());
      return res.status(429).json({ error: 'Too many uploads. Please try again later.' });
    }

    bucket.count += 1;
    return next();
  };
