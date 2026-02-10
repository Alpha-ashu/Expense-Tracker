import { Request, Response } from 'express';
import { AuthService } from './auth.service';
import { RegisterInput, LoginInput } from './auth.types';
import { AuthRequest } from '../../middleware/auth';

const authService = new AuthService();

export const register = async (req: Request, res: Response) => {
  try {
    const input: RegisterInput = req.body;

    // Validate input
    if (!input.email || !input.name || !input.password) {
      return res.status(400).json({ error: 'Missing required fields: email, name, password' });
    }

    const tokens = await authService.register(input);
    res.status(201).json(tokens);
  } catch (error: any) {
    res.status(400).json({ error: error.message || 'Registration failed' });
  }
};

export const login = async (req: Request, res: Response) => {
  try {
    const input: LoginInput = req.body;

    // Validate input
    if (!input.email || !input.password) {
      return res.status(400).json({ error: 'Missing required fields: email, password' });
    }

    const tokens = await authService.login(input);
    res.json(tokens);
  } catch (error: any) {
    res.status(401).json({ error: error.message || 'Login failed' });
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

// API Keys and Credentials
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
