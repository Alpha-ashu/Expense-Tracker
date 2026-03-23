import { beforeEach, describe, expect, it, vi } from 'vitest';

const { getSession } = vi.hoisted(() => ({
  getSession: vi.fn(),
}));

vi.mock('@/utils/supabase/client', () => ({
  default: {
    auth: {
      getSession,
    },
  },
}));

import { permissionService } from './permissionService';

describe('permissionService', () => {
  beforeEach(() => {
    permissionService.clearPermissions();
    getSession.mockReset();
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
    localStorage.clear();
  });

  it('uses backend profile role instead of the fallback role when available', async () => {
    getSession.mockResolvedValue({
      data: {
        session: {
          access_token: 'session-token',
        },
      },
    });

    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        success: true,
        data: {
          role: 'admin',
        },
      }),
    }));

    const permissions = await permissionService.fetchUserPermissions('user-1', 'user');

    expect(fetch).toHaveBeenCalledWith('/api/v1/auth/profile', {
      method: 'GET',
      headers: {
        Authorization: 'Bearer session-token',
      },
    });
    expect(permissions.role).toBe('admin');
    expect(permissions.permissions.canAccessAdminPanel).toBe(true);
  });

  it('downgrades unapproved advisors to user permissions', async () => {
    getSession.mockResolvedValue({
      data: {
        session: {
          access_token: 'session-token',
        },
      },
    });

    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        success: true,
        data: {
          role: 'advisor',
          isApproved: false,
        },
      }),
    }));

    const permissions = await permissionService.fetchUserPermissions('user-1', 'advisor');

    expect(permissions.role).toBe('user');
    expect(permissions.permissions.canAccessAdvisorPanel).toBe(false);
    expect(permissions.permissions.canBookAdvisors).toBe(true);
  });

  it('falls back to the caller role when backend profile lookup fails', async () => {
    getSession.mockResolvedValue({
      data: {
        session: {
          access_token: 'session-token',
        },
      },
    });

    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
      ok: false,
      status: 503,
      statusText: 'Service Unavailable',
      json: async () => ({
        success: false,
        error: 'temporarily unavailable',
      }),
    }));

    const permissions = await permissionService.fetchUserPermissions('user-1', 'advisor');

    expect(permissions.role).toBe('advisor');
    expect(permissions.permissions.canAccessAdvisorPanel).toBe(true);
    expect(permissions.permissions.canAccessAdminPanel).toBe(false);
  });
});
