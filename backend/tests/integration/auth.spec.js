// Converted to JS for compatibility
const request = require('supertest');
const { createClient } = require('@supabase/supabase-js');

const baseUrl = process.env.TEST_BASE_URL || 'http://localhost:3000';
const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
const supabase = createClient(supabaseUrl, supabaseKey);

const testUser = {
  email: `testuser_${Date.now()}@example.com`,
  name: 'Test User',
  password: 'TestPassword123!',
};

afterAll(async () => {
  // Clean up test user from Supabase
  await supabase.from('users').delete().eq('email', testUser.email);
});

describe('Auth API', () => {
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

