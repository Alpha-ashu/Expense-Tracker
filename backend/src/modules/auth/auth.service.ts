import bcrypt from 'bcryptjs';
import { User, RegisterInput, LoginInput, AuthTokens } from './auth.types';
import { supabase } from '../../db/supabase';
import { generateTokens } from '../../utils/auth';

export class AuthService {
  async register(input: RegisterInput): Promise<User> {
    const hashedPassword = await bcrypt.hash(input.password, 10);
    const { data, error } = await supabase
      .from('users')
      .insert([
        {
          email: input.email,
          name: input.name,
          password: hashedPassword,
        },
      ])
      .select()
      .single();
    if (error) throw new Error(error.message);
    return data;
  }

  async login(input: LoginInput): Promise<AuthTokens> {
    const { data: user, error } = await supabase
      .from('users')
      .select('*')
      .eq('email', input.email)
      .single();
    if (error || !user) {
      throw new Error('Invalid credentials');
    }
    const isPasswordValid = await bcrypt.compare(input.password, user.password);
    if (!isPasswordValid) {
      throw new Error('Invalid credentials');
    }
    return generateTokens(user.id);
  }
}

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
