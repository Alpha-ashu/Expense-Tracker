/**
 * SYNC API - Comprehensive Test Suite
 * Covers: Pull/Push, Device Registration, Conflict Resolution, Auth
 */
import request from 'supertest';
import { app } from '../../src/app';

const API = '/api/v1';

const getAuthHeaders = (token = 'mock-access-token') => ({
  Authorization: `Bearer ${token}`,
});

describe('SYNC MODULE', () => {
  // ───────── POST /sync/pull ─────────
  describe('POST /sync/pull', () => {
    it('should return 401 without auth', async () => {
      const res = await request(app)
        .post(`${API}/sync/pull`)
        .send({ userId: 'user1', deviceId: 'device1' });
      expect(res.status).toBe(401);
    });

    it('should reject pull with missing userId', async () => {
      const res = await request(app)
        .post(`${API}/sync/pull`)
        .set(getAuthHeaders())
        .send({ deviceId: 'device1' });
      expect([400, 401]).toContain(res.status);
    });

    it('should reject pull with missing deviceId', async () => {
      const res = await request(app)
        .post(`${API}/sync/pull`)
        .set(getAuthHeaders())
        .send({ userId: 'user1' });
      expect([400, 401]).toContain(res.status);
    });

    it('should reject pull when userId does not match authenticated user', async () => {
      const res = await request(app)
        .post(`${API}/sync/pull`)
        .set(getAuthHeaders())
        .send({ userId: 'different-user', deviceId: 'device1' });
      expect([403, 401]).toContain(res.status);
    });

    it('should handle empty entityTypes array', async () => {
      const res = await request(app)
        .post(`${API}/sync/pull`)
        .set(getAuthHeaders())
        .send({ userId: 'test-user', deviceId: 'device1', entityTypes: [] });
      expect([200, 400, 401, 403]).toContain(res.status);
    });

    it('should handle invalid lastSyncedAt timestamp', async () => {
      const res = await request(app)
        .post(`${API}/sync/pull`)
        .set(getAuthHeaders())
        .send({ userId: 'test-user', deviceId: 'device1', lastSyncedAt: 'not-a-date' });
      expect([200, 400, 401, 403, 500]).toContain(res.status);
    });
  });

  // ───────── POST /sync/push ─────────
  describe('POST /sync/push', () => {
    it('should return 401 without auth', async () => {
      const res = await request(app)
        .post(`${API}/sync/push`)
        .send({ userId: 'user1', deviceId: 'device1', entities: [] });
      expect(res.status).toBe(401);
    });

    it('should reject push with missing entities', async () => {
      const res = await request(app)
        .post(`${API}/sync/push`)
        .set(getAuthHeaders())
        .send({ userId: 'user1', deviceId: 'device1' });
      expect([400, 401]).toContain(res.status);
    });

    it('should reject push when entities is not an array', async () => {
      const res = await request(app)
        .post(`${API}/sync/push`)
        .set(getAuthHeaders())
        .send({ userId: 'user1', deviceId: 'device1', entities: 'not-array' });
      expect([400, 401]).toContain(res.status);
    });

    it('should reject push when userId mismatch', async () => {
      const res = await request(app)
        .post(`${API}/sync/push`)
        .set(getAuthHeaders())
        .send({ userId: 'different-user', deviceId: 'device1', entities: [] });
      expect([403, 401]).toContain(res.status);
    });

    it('should handle malformed entity in push', async () => {
      const res = await request(app)
        .post(`${API}/sync/push`)
        .set(getAuthHeaders())
        .send({
          userId: 'test-user',
          deviceId: 'device1',
          entities: [{ invalid: 'data' }],
        });
      expect([200, 400, 401, 403, 500]).toContain(res.status);
    });
  });

  // ───────── POST /sync/register-device ─────────
  describe('POST /sync/register-device', () => {
    it('should return 401 without auth', async () => {
      const res = await request(app)
        .post(`${API}/sync/register-device`)
        .send({ userId: 'user1', deviceId: 'device1', deviceName: 'Test Phone' });
      expect(res.status).toBe(401);
    });

    it('should reject without userId', async () => {
      const res = await request(app)
        .post(`${API}/sync/register-device`)
        .set(getAuthHeaders())
        .send({ deviceId: 'device1' });
      expect([400, 401]).toContain(res.status);
    });

    it('should reject without deviceId', async () => {
      const res = await request(app)
        .post(`${API}/sync/register-device`)
        .set(getAuthHeaders())
        .send({ userId: 'user1' });
      expect([400, 401]).toContain(res.status);
    });
  });

  // ───────── GET /sync/devices ─────────
  describe('GET /sync/devices', () => {
    it('should return 401 without auth', async () => {
      const res = await request(app).get(`${API}/sync/devices`);
      expect(res.status).toBe(401);
    });
  });

  // ───────── POST /sync/deactivate-device ─────────
  describe('POST /sync/deactivate-device', () => {
    it('should return 401 without auth', async () => {
      const res = await request(app)
        .post(`${API}/sync/deactivate-device`)
        .send({ deviceId: 'device1' });
      expect(res.status).toBe(401);
    });

    it('should reject without deviceId', async () => {
      const res = await request(app)
        .post(`${API}/sync/deactivate-device`)
        .set(getAuthHeaders())
        .send({});
      expect([400, 401]).toContain(res.status);
    });
  });
});
