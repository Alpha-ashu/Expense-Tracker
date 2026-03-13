import { NextFunction, Response } from 'express';
import { AuthRequest } from './auth';
import { cacheGetJson, cacheRecordMetric, cacheSetJson } from '../cache/redis';

type CacheOptions = {
  prefix: string;
  ttlSeconds: number;
};

const buildCacheKey = (req: AuthRequest, prefix: string) => {
  const userId = req.userId || 'anonymous';
  const query = req.url.includes('?') ? req.url.split('?')[1] : '';
  const path = req.path.replace(/\//g, ':');
  return `${prefix}:${userId}:${path}:${query}`;
};

export const responseCache = ({ prefix, ttlSeconds }: CacheOptions) =>
  async (req: AuthRequest, res: Response, next: NextFunction) => {
    if (req.method !== 'GET') {
      return next();
    }

    const key = buildCacheKey(req, prefix);
    const cached = await cacheGetJson<unknown>(key);

    if (cached) {
      cacheRecordMetric(prefix, 'hit');
      return res.json(cached);
    }

    cacheRecordMetric(prefix, 'miss');

    const originalJson = res.json.bind(res);
    res.json = (body: unknown) => {
      cacheRecordMetric(prefix, 'store');
      void cacheSetJson(key, body, ttlSeconds);
      return originalJson(body);
    };

    return next();
  };
