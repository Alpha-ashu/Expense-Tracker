describe('Auth Integration', () => {
import request from 'supertest';
import { supabase } from '../../src/db/supabase';

const baseUrl = process.env.TEST_BASE_URL || 'http://localhost:3000';

describe('Auth API', () => {
  const testUser = {
    email: `testuser_${Date.now()}@example.com`,
    name: 'Test User',
    password: 'TestPassword123!',
  };

  afterAll(async () => {
    // Clean up test user from Supabase
    await supabase.from('users').delete().eq('email', testUser.email);
  });

  it('should register a new user', async () => {
    const res = await request(baseUrl)
      .post('/api/auth?register')
      .send(testUser);
    expect(res.status).toBe(201);
    expect(res.body.user).toHaveProperty('id');
    expect(res.body.user.email).toBe(testUser.email);
  });

  it('should not register with existing email', async () => {
    await request(baseUrl).post('/api/auth?register').send(testUser);
    const res = await request(baseUrl)
      .post('/api/auth?register')
      .send(testUser);
    expect(res.status).toBe(400);
    expect(res.body.error).toBeDefined();
  });

  it('should login with correct credentials', async () => {
    await request(baseUrl).post('/api/auth?register').send(testUser);
    const res = await request(baseUrl)
      .post('/api/auth?login')
      .send({ email: testUser.email, password: testUser.password });
    expect(res.status).toBe(200);
    expect(res.body.accessToken).toBeDefined();
    expect(res.body.refreshToken).toBeDefined();
  });

  it('should not login with wrong password', async () => {
    await request(baseUrl).post('/api/auth?register').send(testUser);
    const res = await request(baseUrl)
      .post('/api/auth?login')
      .send({ email: testUser.email, password: 'WrongPassword' });
    expect(res.status).toBe(400);
    expect(res.body.error).toBeDefined();
  });

  it('should return 404 for unknown route', async () => {
    const res = await request(baseUrl).post('/api/auth?unknown').send({});
    expect(res.status).toBe(404);
  });
});

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
