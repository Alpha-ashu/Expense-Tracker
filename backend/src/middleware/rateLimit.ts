import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';

type RateLimitOptions = {
  windowMs: number;
  max: number;
  scope?: string;
  keyGenerator?: (req: Request) => string;
  message?: string;
};

const buckets = new Map<string, { count: number; resetAt: number }>();

export const rateLimit = ({ windowMs, max, scope = 'global', keyGenerator, message }: RateLimitOptions) =>
  (req: Request, res: Response, next: NextFunction) => {
    // Skip rate limiting in test environment
    if (process.env.NODE_ENV === 'test') {
      return next();
    }

    const rawKey = keyGenerator?.(req) || req.ip || 'anonymous';
    const key = `${scope}:${rawKey}`;
    const now = Date.now();

    const bucket = buckets.get(key);
    if (!bucket || bucket.resetAt <= now) {
      const resetAt = now + windowMs;
      buckets.set(key, { count: 1, resetAt });
      res.setHeader('X-RateLimit-Limit', String(max));
      res.setHeader('X-RateLimit-Remaining', String(Math.max(0, max - 1)));
      res.setHeader('X-RateLimit-Reset', String(Math.ceil(resetAt / 1000)));
      return next();
    }

    if (bucket.count >= max) {
      const retryAfter = Math.ceil((bucket.resetAt - now) / 1000);
      res.setHeader('Retry-After', retryAfter.toString());
      res.setHeader('X-RateLimit-Limit', String(max));
      res.setHeader('X-RateLimit-Remaining', '0');
      res.setHeader('X-RateLimit-Reset', String(Math.ceil(bucket.resetAt / 1000)));
      return res.status(429).json({ error: message || 'Too many requests. Please try again later.' });
    }

    bucket.count += 1;
    res.setHeader('X-RateLimit-Limit', String(max));
    res.setHeader('X-RateLimit-Remaining', String(Math.max(0, max - bucket.count)));
    res.setHeader('X-RateLimit-Reset', String(Math.ceil(bucket.resetAt / 1000)));
    return next();
  };

export const authenticatedRateLimit = (options: Omit<RateLimitOptions, 'keyGenerator'>) =>
  rateLimit({
    ...options,
    keyGenerator: (req) => {
      const authReq = req as Request & { userId?: string; user?: { id?: string } };
      let userId = authReq.userId || authReq.user?.id;

      if (!userId) {
        const bearerToken = req.headers.authorization?.startsWith('Bearer ')
          ? req.headers.authorization.slice('Bearer '.length).trim()
          : '';
        const secret = process.env.JWT_SECRET;

        if (bearerToken && secret) {
          try {
            const decoded = jwt.verify(bearerToken, secret) as { userId?: string; id?: string };
            userId = decoded.userId || decoded.id;
          } catch {
            // Fallback to IP-based throttling for invalid/expired tokens.
          }
        }
      }

      const ip = req.ip || req.headers['x-forwarded-for']?.toString() || 'anonymous';
      return userId ? `user:${userId}` : `ip:${ip}`;
    },
  });
