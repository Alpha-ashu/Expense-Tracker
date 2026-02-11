/**
 * Permission Service - Backend-Driven Role-Based Access Control
 * Fetches and manages user permissions from the backend
 */

import { UserRole } from '@/lib/featureFlags';
import supabase from '@/utils/supabase/client';

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

class PermissionService {
  private static instance: PermissionService;
  private permissions: UserPermissions | null = null;
  private listeners: ((permissions: UserPermissions | null) => void)[] = [];

  private constructor() {}

  static getInstance(): PermissionService {
    if (!PermissionService.instance) {
      PermissionService.instance = new PermissionService();
    }
    return PermissionService.instance;
  }

  /**
   * Fetch user permissions from backend
   */
  async fetchUserPermissions(userId: string, fallbackRole?: UserRole): Promise<UserPermissions> {
    try {
      console.log('🔐 Fetching permissions for user:', userId);

      // Call backend function to get user permissions
      const { data, error } = await supabase.functions.invoke('get-user-permissions', {
        userId
      });

      if (error) {
        console.error('❌ Error fetching permissions:', error);
        // Use fallback role if provided, otherwise default to 'user'
        const role = fallbackRole || 'user';
        console.log('🔄 Using fallback permissions for role:', role);
        const fallback = this.getDefaultPermissions(role);
        this.permissions = fallback;
        this.notifyListeners();
        return fallback;
      }

      if (!data) {
        console.warn('⚠️ No permissions data returned, using defaults');
        const role = fallbackRole || 'user';
        const fallback = this.getDefaultPermissions(role);
        this.permissions = fallback;
        this.notifyListeners();
        return fallback;
      }

      const permissions: UserPermissions = {
        role: data.role,
        allowedFeatures: data.allowedFeatures || [],
        permissions: data.permissions || {},
        lastUpdated: data.lastUpdated || new Date().toISOString()
      };

      console.log('✅ Permissions fetched:', permissions);
      this.permissions = permissions;
      this.notifyListeners();

      return permissions;
    } catch (error) {
      console.error('❌ Failed to fetch permissions:', error);
      // Use fallback role if provided, otherwise default to 'user'
      const role = fallbackRole || 'user';
      console.log('🔄 Using fallback permissions for role:', role);
      const fallback = this.getDefaultPermissions(role);
      this.permissions = fallback;
      this.notifyListeners();
      return fallback;
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
