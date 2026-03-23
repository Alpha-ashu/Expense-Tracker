import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import { logger } from '../config/logger';
import { createClient } from '@supabase/supabase-js';
import { audit } from '../utils/auditLogger';
import { prisma } from '../db/prisma';

export interface AuthRequest extends Request {
  userId?: string;
  user?: {
    id: string;
    email: string;
    role: string;
    isApproved: boolean;
    name?: string;
  };
  file?: Express.Multer.File;
}

const supabaseUrl = process.env.SUPABASE_URL || '';
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || '';
const supabase = (supabaseUrl && supabaseServiceKey) 
  ? createClient(supabaseUrl, supabaseServiceKey)
  : null;
const AUTH_STATUS_LOOKUP_TIMEOUT_MS = Number(process.env.AUTH_STATUS_LOOKUP_TIMEOUT_MS || 250);
const STATUS_LOOKUP_TIMEOUT = Symbol('auth-status-timeout');
const ALLOW_TEST_ROLE_FALLBACK = process.env.NODE_ENV === 'test';

interface UserAuthSnapshot {
  email: string;
  role: string;
  isApproved: boolean;
  name: string;
  status: string;
}

const getUserAuthSnapshot = async (userId: string): Promise<UserAuthSnapshot | null> => {
  if (process.env.NODE_ENV === 'test' || AUTH_STATUS_LOOKUP_TIMEOUT_MS <= 0) {
    return null;
  }

  try {
    const result = await Promise.race([
      prisma.user.findUnique({
        where: { id: userId },
        select: {
          email: true,
          role: true,
          isApproved: true,
          name: true,
          status: true,
        },
      }),
      new Promise<typeof STATUS_LOOKUP_TIMEOUT>((resolve) => {
        setTimeout(() => resolve(STATUS_LOOKUP_TIMEOUT), AUTH_STATUS_LOOKUP_TIMEOUT_MS);
      }),
    ]);

    if (result === STATUS_LOOKUP_TIMEOUT) {
      logger.warn('Auth status lookup timed out after JWT verification, continuing with token claims.', {
        userId,
        timeoutMs: AUTH_STATUS_LOOKUP_TIMEOUT_MS,
      });
      return null;
    }

    return result ?? null;
  } catch (error) {
    logger.warn('Auth user lookup failed after JWT verification, continuing with token claims.', {
      userId,
      error: error instanceof Error ? error.message : String(error),
    });
    return null;
  }
};

export const authMiddleware = async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const authHeader = req.headers.authorization || '';
    const token = authHeader.replace(/^Bearer\s+/i, '').trim();

    if (!token || token === authHeader) {
      logger.warn('Auth check failed: No token provided in headers.');
      return res.status(401).json({ error: 'No token provided' });
    }

    const customSecret = process.env.JWT_SECRET || '';
    let decoded: any;

    // 1. Try Custom JWT first (fast, local)
    if (customSecret) {
      try {
        decoded = jwt.verify(token, customSecret);

        const userId = typeof decoded === 'object'
          ? (typeof decoded.userId === 'string' ? decoded.userId : decoded.sub)
          : null;

        if (typeof userId !== 'string' || userId.length === 0) {
          throw new Error('Invalid JWT subject');
        }

        const authSnapshot = await getUserAuthSnapshot(userId);
        if (authSnapshot?.status === 'suspended') {
          return res.status(403).json({ error: 'Account suspended. Contact support.', code: 'ACCOUNT_SUSPENDED' });
        }

        req.userId = userId;
        req.user = {
          id: userId,
          email: authSnapshot?.email || (typeof decoded.email === 'string' ? decoded.email : ''),
          role: authSnapshot?.role || (ALLOW_TEST_ROLE_FALLBACK && typeof decoded.role === 'string' ? decoded.role : 'user'),
          isApproved: authSnapshot?.isApproved ?? (ALLOW_TEST_ROLE_FALLBACK
            ? (typeof decoded.isApproved === 'boolean' ? decoded.isApproved : true)
            : false),
          name: authSnapshot?.name || (typeof decoded.name === 'string' ? decoded.name : undefined),
        };

        return next();
      } catch (err) {
        // Fall back to Supabase
      }
    }

    // 2. Try Supabase verification (handles ES256, HS256, etc.)
    if (supabase && process.env.NODE_ENV !== 'test') {
      try {
        const { data: { user }, error } = await supabase.auth.getUser(token);
        
        if (user && !error) {
          const authSnapshot = await getUserAuthSnapshot(user.id);
          if (authSnapshot?.status === 'suspended') {
            return res.status(403).json({ error: 'Account suspended. Contact support.', code: 'ACCOUNT_SUSPENDED' });
          }

          req.userId = user.id;
          req.user = {
            id: user.id,
            email: authSnapshot?.email || user.email || '',
            role: authSnapshot?.role || 'user',
            isApproved: authSnapshot?.isApproved ?? false,
            name: authSnapshot?.name || user.user_metadata?.full_name,
          };
          return next();
        } else if (error) {
          logger.warn(`Supabase Auth rejection: ${error.message}`);
        }
      } catch (supabaseError) {
        logger.warn('Supabase auth lookup failed, continuing to final auth rejection.', {
          error: supabaseError instanceof Error ? supabaseError.message : String(supabaseError),
        });
      }
    }

    audit({
      event: 'auth.login_failed',
      ip: req.ip || undefined,
      action: `${req.method} ${req.path}`,
      meta: { reason: 'invalid_token' },
    });
    logger.info(`Final Auth result: 401 Unauthorized for token starting ${token.substring(0, 10)}...`);
    return res.status(401).json({ error: 'Invalid or expired session' });
  } catch (error) {
    audit({
      event: 'auth.login_failed',
      ip: req.ip || undefined,
      action: `${req.method} ${req.path}`,
      meta: { reason: 'auth_error' },
    });
    logger.error('Critical Auth middleware error:', error);
    return res.status(401).json({ error: 'Authentication failed' });
  }
};

export const getUserId = (req: AuthRequest): string => {
  if (!req.userId) {
    throw new Error('User ID not found in request');
  }
  return req.userId;
};
