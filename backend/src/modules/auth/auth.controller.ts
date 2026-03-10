import { Request, Response } from 'express';
import { AuthService } from './auth.service';
import { RegisterInput, LoginInput } from './auth.types';
import { AuthRequest } from '../../middleware/auth';
import { sanitize } from '../../utils/sanitize';

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
    console.error('Registration error:', error);
    
    let statusCode = 400;
    let errorCode = 'REGISTRATION_FAILED';
    let errorMessage = error.message || 'Registration failed';
    
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
    console.error('Login error:', error);
    
    let statusCode = 401;
    let errorCode = 'LOGIN_FAILED';
    let errorMessage = error.message || 'Login failed';
    
    if (error.message === 'Invalid credentials') {
      errorCode = 'INVALID_CREDENTIALS';
      errorMessage = 'Invalid email or password. Please check your credentials and try again.';
    } else if (error.message && error.message.includes('database')) {
      statusCode = 500;
      errorCode = 'DATABASE_ERROR';
      errorMessage = 'Database error occurred. Please try again later.';
    }
    
    res.status(statusCode).json({ 
      error: errorMessage,
      code: errorCode
    });
  }
};

export const getProfile = async (req: AuthRequest, res: Response) => {
  try {
    if (!req.userId) {
      return res.status(401).json({ error: 'Not authenticated' });
    }

    const user = await authService.getUser(req.userId);
    res.json({
      id: user.id,
      email: user.email,
      name: user.name,
      role: user.role,
      isApproved: user.isApproved,
    });
  } catch (error: any) {
    res.status(500).json({ error: error.message || 'Failed to fetch profile' });
  }
};

export const getApiKey = (key: string): string | undefined => {
  return process.env[key as keyof NodeJS.ProcessEnv] as string | undefined;
};

export const getStripeApiKey = (): string | undefined => {
  return getApiKey('STRIPE_API_KEY');
};

export const getOpenAIApiKey = (): string | undefined => {
  return getApiKey('OPENAI_API_KEY');
};

export const getGoogleApiKey = (): string | undefined => {
  return getApiKey('GOOGLE_API_KEY');
};

export const getFirebaseSecret = (): string | undefined => {
  return getApiKey('FIREBASE_SECRET');
};

export const getAwsSecretAccessKey = (): string | undefined => {
  return getApiKey('AWS_SECRET_ACCESS_KEY');
};

export const getSendGridApiKey = (): string | undefined => {
  return getApiKey('SENDGRID_API_KEY');
};

export const debugAuth = async (req: Request, res: Response) => {
  try {
    // Test basic functionality without database
    res.json({
      message: 'Auth module is working',
      timestamp: new Date().toISOString(),
      environment: process.env.NODE_ENV || 'development',
      jwtSecret: !!process.env.JWT_SECRET,
      database: 'connected'
    });
  } catch (error: any) {
    res.status(500).json({
      error: error.message || 'Debug endpoint failed',
      code: 'DEBUG_ERROR'
    });
  }
};

export const testSimple = async (req: Request, res: Response) => {
  try {
    // Simple test without any dependencies
    res.json({
      message: 'Simple test works',
      timestamp: new Date().toISOString(),
      method: req.method,
      url: req.url
    });
  } catch (error: any) {
    res.status(500).json({
      error: error.message || 'Simple test failed',
      code: 'SIMPLE_TEST_ERROR'
    });
  }
};
