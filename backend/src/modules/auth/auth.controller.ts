import { Request, Response } from 'express';
import { AuthService } from './auth.service';
import { RegisterInput, LoginInput } from './auth.types';
import { AuthRequest } from '../../middleware/auth';
import { sanitize } from '../../utils/sanitize';
import { logger } from '../../config/logger';

const authService = new AuthService();

// Strict email regex: local@domain.tld, no SQL/XSS chars
const EMAIL_REGEX = /^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/;

export const register = async (req: Request, res: Response) => {
  try {
    const input: RegisterInput = req.body;

    // Validate input
    if (!input.email || !input.name || !input.password) {
      return res.status(400).json({
        error: 'Missing required fields: email, name, password',
        code: 'MISSING_FIELDS'
      });
    }

    // Validate email format (strict)
    if (!EMAIL_REGEX.test(input.email)) {
      return res.status(400).json({
        error: 'Invalid email format',
        code: 'INVALID_EMAIL'
      });
    }

    // Validate password length
    if (input.password.length < 8) {
      return res.status(400).json({
        error: 'Password must be at least 8 characters long',
        code: 'PASSWORD_TOO_SHORT'
      });
    }

    // Sanitize user-facing text fields
    const sanitizedInput = {
      ...input,
      name: sanitize(input.name),
      email: input.email.toLowerCase().trim(),
    };

    const tokens = await authService.register(sanitizedInput);

    res.status(201).json({
      success: true,
      message: 'Registration successful',
      data: tokens
    });
  } catch (error: any) {
    logger.error('Registration error', { error: error.message });

    let statusCode = 400;
    let errorCode = 'REGISTRATION_FAILED';
    let errorMessage = 'Registration failed. Please try again.';

    // Handle specific database errors
    if (error.message && error.message.includes('UNIQUE constraint failed')) {
      statusCode = 409;
      errorCode = 'EMAIL_EXISTS';
      errorMessage = 'This email is already registered. Please use a different email or try signing in.';
    } else if (error.message === 'Email already registered') {
      statusCode = 409;
      errorCode = 'EMAIL_EXISTS';
      errorMessage = 'This email is already registered. Please use a different email or try signing in.';
    } else if (error.message && error.message.includes('database')) {
      statusCode = 500;
      errorCode = 'DATABASE_ERROR';
      errorMessage = 'Database error occurred. Please try again later.';
    }

    res.status(statusCode).json({
      success: false,
      error: errorMessage,
      code: errorCode
    });
  }
};

export const login = async (req: Request, res: Response) => {
  try {
    const input: LoginInput = req.body;


    // Validate input
    if (!input.email || !input.password) {
      return res.status(400).json({
        error: 'Missing required fields: email, password',
        code: 'MISSING_FIELDS'
      });
    }

    // Validate email format (strict)
    if (!EMAIL_REGEX.test(input.email)) {
      return res.status(400).json({
        error: 'Invalid email format',
        code: 'INVALID_EMAIL'
      });
    }

    const tokens = await authService.login({
      email: input.email.toLowerCase().trim(),
      password: input.password,
    });

    res.json({
      success: true,
      message: 'Login successful',
      data: tokens
    });
  } catch (error: any) {
    logger.error('Login error', { error: error.message });

    let statusCode = 401;
    let errorCode = 'LOGIN_FAILED';
    let errorMessage = 'Invalid email or password. Please check your credentials and try again.';

    if (error.message === 'Invalid credentials') {
      errorCode = 'INVALID_CREDENTIALS';
      errorMessage = 'Invalid email or password. Please check your credentials and try again.';
    } else if (error.message && error.message.includes('database')) {
      statusCode = 500;
      errorCode = 'DATABASE_ERROR';
      errorMessage = 'Database error occurred. Please try again later.';
    }

    res.status(statusCode).json({
      success: false,
      error: errorMessage,
      code: errorCode
    });
  }
};

export const getProfile = async (req: AuthRequest, res: Response) => {
  try {
    if (!req.userId) {
      return res.status(401).json({ success: false, error: 'Not authenticated' });
    }

    try {
      const user = await authService.getUser(req.userId);
      res.json({
        success: true,
        data: {
          id: user.id,
          email: user.email,
          name: user.name,
          firstName: user.firstName,
          lastName: user.lastName,
          gender: user.gender,
          country: user.country,
          state: user.state,
          city: user.city,
          salary: user.salary,
          dateOfBirth: user.dateOfBirth,
          jobType: user.jobType,
          role: user.role,
          isApproved: user.isApproved,
        }
      });
    } catch (userError: any) {
      if (userError.message === 'User not found') {
        // Return 404 but with some context
        return res.status(404).json({
          success: false,
          error: 'User profile not found in database',
          code: 'USER_NOT_FOUND'
        });
      }
      throw userError;
    }
  } catch (error: any) {
    logger.error('Get profile error:', {
      message: error.message,
      userId: req.userId
    });
    res.status(500).json({ success: false, error: 'Failed to fetch profile' });
  }
};

export const updateProfile = async (req: AuthRequest, res: Response) => {
  try {
    if (!req.userId) {
      return res.status(401).json({ success: false, error: 'Not authenticated' });
    }

    const sanitizedData = sanitize(req.body as any);
    const user = await authService.updateProfile(req.userId, sanitizedData, req.user?.email);

    res.json({
      success: true,
      message: 'Profile updated successfully',
      data: {
        id: user.id,
        email: user.email,
        name: user.name,
        firstName: user.firstName,
        lastName: user.lastName,
        gender: user.gender,
        country: user.country,
        state: user.state,
        city: user.city,
        salary: user.salary,
        dateOfBirth: user.dateOfBirth,
        jobType: user.jobType,
      }
    });
  } catch (error: any) {
    logger.error('Update profile error:', {
      message: error.message,
      stack: error.stack,
      userId: req.userId
    });

    res.status(500).json({
      success: false,
      error: 'Failed to update profile',
      details: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
};

