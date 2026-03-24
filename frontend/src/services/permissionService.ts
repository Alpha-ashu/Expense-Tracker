/**
 * Permission Service - Backend-Driven Role-Based Access Control
 * Fetches and manages user permissions from the backend
 */

import { UserRole } from '@/lib/featureFlags';
import {
  buildApiUrl,
  clearOptionalBackendUnavailable,
  getApiBaseCandidates,
  getConfiguredApiBase,
  markOptionalBackendUnavailable,
  shouldRetryWithLocalApiFallback,
  shouldSkipOptionalBackendRequests,
} from '@/lib/apiBase';
import supabase from '@/utils/supabase/client';

const API_BASE = getConfiguredApiBase();
const PROFILE_LOOKUP_TIMEOUT_MS = 5000;

const normalizeUserRole = (value: unknown): UserRole => {
  if (value === 'admin' || value === 'advisor' || value === 'user') {
    return value;
  }
  return 'user';
};

const resolveEffectiveRole = (role: UserRole, isApproved?: boolean): UserRole => {
  if (role === 'advisor' && isApproved === false) {
    return 'user';
  }

  return role;
};

const getAuthToken = async (): Promise<string | null> => {
  const { data: { session } } = await supabase.auth.getSession();
  if (session?.access_token) {
    return session.access_token;
  }

  return (
    localStorage.getItem('auth_token')
    || localStorage.getItem('accessToken')
    || localStorage.getItem('token')
    || localStorage.getItem('authToken')
  );
};

export interface UserPermissions {
  role: UserRole;
  allowedFeatures: string[];
  permissions: {
    canAccessAdminPanel: boolean;
    canAccessAdvisorPanel: boolean;
    canControlFeatures: boolean;
    canViewAllUsers: boolean;
    canManageAdvisors: boolean;
    canApproveFeatures: boolean;
    canTestNewFeatures: boolean;
    canBookAdvisors: boolean;
    canPayForSessions: boolean;
    canJoinSessions: boolean;
    canViewSessionHistory: boolean;
    canRateAdvisors: boolean;
    canSetAvailability: boolean;
    canStartSessions: boolean;
    canReceiveBookings: boolean;
    canManageSessions: boolean;
    canReceivePayments: boolean;
    canViewClients: boolean;
  };
  lastUpdated: string;
}

type BackendRoleSnapshot = {
  role: UserRole;
  isApproved?: boolean;
  fetchedAt: string;
};

class PermissionService {
  private static instance: PermissionService;
  private permissions: UserPermissions | null = null;
  private listeners: ((permissions: UserPermissions | null) => void)[] = [];
  private inflightRoleLookups = new Map<string, Promise<UserRole>>();
  private roleSnapshots = new Map<string, BackendRoleSnapshot>();

  private constructor() { }

  static getInstance(): PermissionService {
    if (!PermissionService.instance) {
      PermissionService.instance = new PermissionService();
    }
    return PermissionService.instance;
  }

  /**
   * Fetch user permissions from the backend-authenticated profile endpoint.
   * Falls back to the caller-provided role only when the backend cannot be read.
   */
  async fetchUserPermissions(userId: string, fallbackRole?: UserRole): Promise<UserPermissions> {
    const role = await this.resolveUserRole(userId, fallbackRole);
    const permissions = this.getDefaultPermissions(role);
    this.permissions = permissions;
    this.notifyListeners();
    return permissions;
  }

  private async resolveUserRole(userId: string, fallbackRole?: UserRole): Promise<UserRole> {
    const existingLookup = this.inflightRoleLookups.get(userId);
    if (existingLookup) {
      return existingLookup;
    }

    const lookupPromise = this.loadUserRole(userId, fallbackRole);
    this.inflightRoleLookups.set(userId, lookupPromise);

    try {
      return await lookupPromise;
    } finally {
      this.inflightRoleLookups.delete(userId);
    }
  }

  private getCachedRole(userId: string): UserRole | null {
    const snapshot = this.roleSnapshots.get(userId);
    if (!snapshot) {
      return null;
    }

    return resolveEffectiveRole(snapshot.role, snapshot.isApproved);
  }

  private rememberResolvedRole(userId: string, role: UserRole, isApproved?: boolean): UserRole {
    this.roleSnapshots.set(userId, {
      role,
      isApproved,
      fetchedAt: new Date().toISOString(),
    });

    return resolveEffectiveRole(role, isApproved);
  }

  private async loadUserRole(userId: string, fallbackRole?: UserRole): Promise<UserRole> {
    const safeFallback = normalizeUserRole(fallbackRole);
    const cachedRole = this.getCachedRole(userId);
    const apiBases = getApiBaseCandidates(API_BASE);

    try {
      const token = await getAuthToken();
      if (!token) {
        console.warn('No auth token available for permission lookup, using fallback permissions.', { userId });
        return cachedRole ?? safeFallback;
      }

      if (shouldSkipOptionalBackendRequests(API_BASE)) {
        return cachedRole ?? safeFallback;
      }

      for (let index = 0; index < apiBases.length; index += 1) {
        const apiBase = apiBases[index];
        const controller = new AbortController();
        const timeoutId = window.setTimeout(() => controller.abort(), PROFILE_LOOKUP_TIMEOUT_MS);

        try {
          const response = await fetch(buildApiUrl(apiBase, '/auth/profile'), {
            method: 'GET',
            headers: {
              Authorization: `Bearer ${token}`,
            },
            signal: controller.signal,
          });

          const payload = await response.json().catch(() => ({} as {
            success?: boolean;
            data?: { role?: unknown; isApproved?: boolean };
            error?: string;
          }));

          if (!response.ok || payload.success === false) {
            const errorMessage = payload.error || response.statusText || `HTTP ${response.status}`;
            if (shouldRetryWithLocalApiFallback(response.status)) {
              markOptionalBackendUnavailable(apiBase);
            }

            if (index < apiBases.length - 1 && shouldRetryWithLocalApiFallback(response.status)) {
              console.warn('Backend profile lookup failed on configured API base, retrying local API fallback.', {
                apiBase,
                error: errorMessage,
              });
              continue;
            }

            if (cachedRole) {
              console.warn('Failed to load backend profile role, using cached permissions role:', errorMessage);
              return cachedRole;
            }

            console.warn('Failed to load backend profile role, using fallback permissions:', errorMessage);
            return safeFallback;
          }

          const backendRole = normalizeUserRole(payload.data?.role ?? safeFallback);
          clearOptionalBackendUnavailable();
          return this.rememberResolvedRole(userId, backendRole, payload.data?.isApproved);
        } catch (error) {
          if (shouldRetryWithLocalApiFallback(undefined, error)) {
            markOptionalBackendUnavailable(apiBase);
          }

          if (index < apiBases.length - 1 && shouldRetryWithLocalApiFallback(undefined, error)) {
            console.warn('Backend profile lookup failed on configured API base, retrying local API fallback.', {
              apiBase,
              error: error instanceof Error ? error.message : String(error),
            });
            continue;
          }

          if (cachedRole) {
            console.warn('Unexpected backend role lookup failure, using cached permissions role:', error);
            return cachedRole;
          }

          console.warn('Unexpected backend role lookup failure, using fallback permissions:', error);
          return safeFallback;
        } finally {
          clearTimeout(timeoutId);
        }
      }
    } catch (error) {
      if (cachedRole) {
        console.warn('Unexpected backend role lookup failure, using cached permissions role:', error);
        return cachedRole;
      }

      console.warn('Unexpected backend role lookup failure, using fallback permissions:', error);
      return safeFallback;
    }
  }

  /**
   * Get default permissions for a role (fallback)
   */
  private getDefaultPermissions(role: UserRole): UserPermissions {
    const defaults: Record<UserRole, UserPermissions> = {
      admin: {
        role: 'admin',
        allowedFeatures: [
          'accounts', 'transactions', 'loans', 'goals', 'groups',
          'investments', 'reports', 'calendar', 'todoLists',
          'transfer', 'taxCalculator', 'bookAdvisor',
          'adminPanel', 'featureControl', 'advisorPanel'
        ],
        permissions: {
          canAccessAdminPanel: true,
          canAccessAdvisorPanel: true,
          canControlFeatures: true,
          canViewAllUsers: true,
          canManageAdvisors: true,
          canApproveFeatures: true,
          canTestNewFeatures: true,
          canBookAdvisors: true,
          canPayForSessions: true,
          canJoinSessions: true,
          canViewSessionHistory: true,
          canRateAdvisors: true,
          canSetAvailability: false,
          canStartSessions: false,
          canReceiveBookings: false,
          canManageSessions: false,
          canReceivePayments: false,
          canViewClients: false,
        },
        lastUpdated: new Date().toISOString()
      },
      advisor: {
        role: 'advisor',
        allowedFeatures: [
          'accounts', 'transactions', 'loans', 'goals', 'groups',
          'investments', 'reports', 'calendar', 'todoLists',
          'transfer', 'taxCalculator', 'bookAdvisor',
          'advisorPanel'
        ],
        permissions: {
          canAccessAdminPanel: false,
          canAccessAdvisorPanel: true,
          canControlFeatures: false,
          canViewAllUsers: false,
          canManageAdvisors: false,
          canApproveFeatures: false,
          canTestNewFeatures: false,
          canBookAdvisors: false,
          canPayForSessions: false,
          canJoinSessions: true,
          canViewSessionHistory: true,
          canRateAdvisors: true,
          canSetAvailability: true,
          canStartSessions: true,
          canReceiveBookings: true,
          canManageSessions: true,
          canReceivePayments: true,
          canViewClients: true,
        },
        lastUpdated: new Date().toISOString()
      },
      user: {
        role: 'user',
        allowedFeatures: [
          'accounts', 'transactions', 'loans', 'goals', 'groups',
          'investments', 'reports', 'calendar', 'todoLists',
          'transfer', 'taxCalculator', 'bookAdvisor'
        ],
        permissions: {
          canAccessAdminPanel: false,
          canAccessAdvisorPanel: false,
          canControlFeatures: false,
          canViewAllUsers: false,
          canManageAdvisors: false,
          canApproveFeatures: false,
          canTestNewFeatures: false,
          canBookAdvisors: true,
          canPayForSessions: true,
          canJoinSessions: true,
          canViewSessionHistory: true,
          canRateAdvisors: true,
          canSetAvailability: false,
          canStartSessions: false,
          canReceiveBookings: false,
          canManageSessions: false,
          canReceivePayments: false,
          canViewClients: false,
        },
        lastUpdated: new Date().toISOString()
      }
    };

    return defaults[role];
  }

  /**
   * Get current permissions
   */
  getPermissions(): UserPermissions | null {
    return this.permissions;
  }

  /**
   * Check if user has access to a feature
   */
  hasFeatureAccess(feature: string): boolean {
    if (!this.permissions) {
      console.warn('⚠️ No permissions loaded, denying access to:', feature);
      return false;
    }
    return this.permissions.allowedFeatures.includes(feature);
  }

  /**
   * Check if user can perform a specific action
   */
  canPerformAction(action: string): boolean {
    if (!this.permissions) {
      console.warn('⚠️ No permissions loaded, denying action:', action);
      return false;
    }
    const permissionKey = `can${action.charAt(0).toUpperCase()}${action.slice(1)}`;
    return this.permissions.permissions[permissionKey as keyof typeof this.permissions.permissions] === true;
  }

  /**
   * Get user role
   */
  getUserRole(): UserRole | null {
    return this.permissions?.role || null;
  }

  /**
   * Update permissions (called when admin changes permissions)
   */
  updatePermissions(newPermissions: Partial<UserPermissions>): void {
    if (!this.permissions) return;

    this.permissions = {
      ...this.permissions,
      ...newPermissions,
      lastUpdated: new Date().toISOString()
    };

    console.log('🔄 Permissions updated:', this.permissions);
    this.notifyListeners();
  }

  /**
   * Subscribe to permission changes
   */
  subscribe(listener: (permissions: UserPermissions | null) => void): () => void {
    this.listeners.push(listener);
    listener(this.permissions);

    // Return unsubscribe function
    return () => {
      const index = this.listeners.indexOf(listener);
      if (index > -1) {
        this.listeners.splice(index, 1);
      }
    };
  }

  /**
   * Notify all listeners of permission changes
   */
  private notifyListeners(): void {
    this.listeners.forEach(listener => listener(this.permissions));
  }

  /**
   * Clear permissions (logout)
   */
  clearPermissions(): void {
    this.permissions = null;
    this.inflightRoleLookups.clear();
    this.roleSnapshots.clear();
    this.notifyListeners();
  }

  /**
   * Refresh permissions from backend
   */
  async refreshPermissions(): Promise<void> {
    const { data: { user } } = await supabase.auth.getUser();
    if (user?.id) {
      await this.fetchUserPermissions(user.id);
    }
  }
}

export const permissionService = PermissionService.getInstance();
export default permissionService;
