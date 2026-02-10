import jwt from 'jsonwebtoken';
import { AuthTokens } from '../modules/auth/auth.types';

const secret = process.env.JWT_SECRET || 'fallback-secret';

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

export const generateTokens = (user: {
  id: string;
  email: string;
  name: string;
  role: string;
  isApproved: boolean;
}): AuthTokens => {
  const accessToken = jwt.sign(
    {
      userId: user.id,
      email: user.email,
      role: user.role,
      isApproved: user.isApproved,
    },
    secret,
    { expiresIn: '15m' }
  );

  const refreshToken = jwt.sign(
    {
      userId: user.id,
      email: user.email,
      role: user.role,
      isApproved: user.isApproved,
    },
    secret,
    { expiresIn: '7d' }
  );

  return {
    accessToken,
    refreshToken,
    user: {
      id: user.id,
      email: user.email,
      name: user.name,
      role: user.role,
      isApproved: user.isApproved,
    },
  };
};

export const verifyToken = (token: string): any => {
  try {
    return jwt.verify(token, secret);
  } catch (error) {
    throw new Error('Invalid token');
  }
};