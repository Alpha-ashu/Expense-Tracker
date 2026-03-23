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
        
        const userId = decoded.userId || decoded.sub;
        req.userId = userId;
        req.user = {
          id: userId,
          email: decoded.email || '',
          role: decoded.role || 'user',
          isApproved: decoded.isApproved ?? true
        };

        // Best-effort status check. A verified JWT should not be downgraded to an
        // auth failure purely because the database is temporarily unavailable.
        try {
          const dbUser = await prisma.user.findUnique({
            where: { id: userId },
            select: { status: true },
          });
          if (dbUser?.status === 'suspended') {
            return res.status(403).json({ error: 'Account suspended. Contact support.', code: 'ACCOUNT_SUSPENDED' });
          }
        } catch (dbError) {
          logger.warn('Auth status lookup failed after JWT verification, continuing with token claims.', {
            userId,
            error: dbError instanceof Error ? dbError.message : String(dbError),
          });
        }

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
          req.userId = user.id;
          req.user = {
            id: user.id,
            email: user.email || '',
            role: (user.app_metadata?.role as string) || 'user',
            isApproved: true,
            name: user.user_metadata?.full_name
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
