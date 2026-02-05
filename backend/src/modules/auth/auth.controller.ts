import { Request, Response, NextFunction } from 'express';
import { AuthService } from './auth.service';
import { registerSchema, loginSchema } from './auth.types';
import { ZodError } from 'zod';

const authService = new AuthService();

// Async error wrapper to handle promise rejections
const asyncHandler = (fn: Function) => (req: Request, res: Response, next: NextFunction) => {
  Promise.resolve(fn(req, res, next)).catch(next);
};

export const register = asyncHandler(async (req: Request, res: Response) => {
  // Security: Validate input before processing
  try {
    const input = registerSchema.parse(req.body);
    const user = await authService.register(input);
    res.status(201).json({ user: { id: user.id, email: user.email, name: user.name } });
  } catch (error) {
    if (error instanceof ZodError) {
      // Security: Limit error details in production to prevent information disclosure
      const details = process.env.NODE_ENV === 'production' 
        ? undefined 
        : error.errors;
      res.status(400).json({ error: 'Validation failed', details });
      return;
    }
    throw error;
  }
});

export const login = asyncHandler(async (req: Request, res: Response) => {
  // Security: Validate input before processing
  try {
    const input = loginSchema.parse(req.body);
    const tokens = await authService.login(input);
    res.json(tokens);
  } catch (error) {
    if (error instanceof ZodError) {
      // Security: Limit error details in production to prevent information disclosure
      const details = process.env.NODE_ENV === 'production' 
        ? undefined 
        : error.errors;
      res.status(400).json({ error: 'Validation failed', details });
      return;
    }
    throw error;
  }
});
