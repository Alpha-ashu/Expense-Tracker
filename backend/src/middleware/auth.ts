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
}

export const authMiddleware = (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const token = req.headers.authorization?.split(' ')[1];

    if (!token) {
      return res.status(401).json({ error: 'No token provided' });
    }

    const secret = process.env.JWT_SECRET || 'your-secret-key';
    const decoded = jwt.verify(token, secret) as { 
      userId: string; 
      email: string; 
      role: string;
      isApproved: boolean;
    };

    req.userId = decoded.userId;
    req.user = { 
      id: decoded.userId, 
      email: decoded.email,
      role: decoded.role,
      isApproved: decoded.isApproved
    };

    next();
  } catch (error) {
    return res.status(401).json({ error: 'Invalid token' });
  }
};

export const getUserId = (req: AuthRequest): string => {
  if (!req.userId) {
    throw new Error('User ID not found in request');
  }
  return req.userId;
};
