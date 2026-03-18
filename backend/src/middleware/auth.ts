import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';

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

export const authMiddleware = (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const token = req.headers.authorization?.split(' ')[1];

    if (!token) {
      return res.status(401).json({ error: 'No token provided' });
    }

    const customSecret = process.env.JWT_SECRET;
    const supabaseSecret = process.env.SUPABASE_JWT_SECRET || process.env.SUPABASE_SERVICE_ROLE_KEY;

    let decoded: any;
    let isValid = false;

    // Try Supabase JWT first
    if (supabaseSecret) {
      try {
        decoded = jwt.verify(token, supabaseSecret);
        isValid = true;
      } catch (err) {
        // Fall back to custom secret
      }
    }

    // Try Custom JWT if Supabase failed
    if (!isValid && customSecret) {
      try {
        decoded = jwt.verify(token, customSecret);
        isValid = true;
      } catch (err) {
        // failed both
      }
    }

    if (!isValid || !decoded) {
      return res.status(401).json({ error: 'Invalid token' });
    }

    // Handle payload from custom JWT ({ userId, email, role }) 
    // vs Supabase JWT ({ sub, email, user_metadata })
    const userId = decoded.userId || decoded.sub;
    const email = decoded.email || decoded.user_metadata?.email || '';
    const role = decoded.role || decoded.user_role || 'user';
    const isApproved = decoded.isApproved ?? true; // Default true for supabase users

    req.userId = userId;
    req.user = {
      id: userId,
      email: email,
      role: role,
      isApproved: isApproved
    };

    next();
  } catch (error) {
    return res.status(401).json({ error: 'Invalid token extraction' });
  }
};

export const getUserId = (req: AuthRequest): string => {
  if (!req.userId) {
    throw new Error('User ID not found in request');
  }
  return req.userId;
};
