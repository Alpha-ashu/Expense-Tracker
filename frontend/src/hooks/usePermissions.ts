/**
 * Permission Hooks - Backend-Driven Access Control
 * Uses permissionService for all permission checks
 */

import { useState, useEffect } from 'react';
import { permissionService, UserPermissions } from '@/services/permissionService';
import { UserRole } from '@/lib/featureFlags';

/**
 * Hook for backend-driven permission management
 */
export const usePermissions = () => {
  const [permissions, setPermissions] = useState<UserPermissions | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // Subscribe to permission changes
    const unsubscribe = permissionService.subscribe((newPermissions) => {
      setPermissions(newPermissions);
      setLoading(false);
    });

    return unsubscribe;
  }, []);

  const hasFeatureAccess = (feature: string): boolean => {
    if (!permissions) return false;
    return permissions.allowedFeatures.includes(feature);
  };

  const canPerformAction = (action: string): boolean => {
    if (!permissions) return false;
    const permissionKey = `can${action.charAt(0).toUpperCase()}${action.slice(1)}`;
    return permissions.permissions[permissionKey as keyof typeof permissions.permissions] === true;
  };

  const refreshPermissions = async () => {
    setLoading(true);
    await permissionService.refreshPermissions();
  };

  return {
    permissions,
    loading,
    role: permissions?.role || null,
    hasFeatureAccess,
    canPerformAction,
    refreshPermissions,
    isAdmin: permissions?.role === 'admin',
    isAdvisor: permissions?.role === 'advisor',
    isUser: permissions?.role === 'user',
    allowedFeatures: permissions?.allowedFeatures || [],
  };
};

/**
 * Hook for checking specific feature access
 */
export const useFeatureAccess = (feature: string): boolean => {
  const { hasFeatureAccess } = usePermissions();
  return hasFeatureAccess(feature);
};

/**
 * Hook for checking specific action permission
 */
export const useActionPermission = (action: string): boolean => {
  const { canPerformAction } = usePermissions();
  return canPerformAction(action);
};

/**
 * Hook for role-based rendering
 */
export const useRequireRole = (requiredRole: UserRole | UserRole[]): boolean => {
  const { role } = usePermissions();
  if (!role) return false;
  
  if (Array.isArray(requiredRole)) {
    return requiredRole.includes(role);
  }
  
  return role === requiredRole;
};

/**
 * Hook for admin-only features
 */
export const useAdminOnly = (): boolean => {
  const { isAdmin } = usePermissions();
  return isAdmin;
};

/**
 * Hook for advisor-only features
 */
export const useAdvisorOnly = (): boolean => {
  const { isAdvisor } = usePermissions();
  return isAdvisor;
};

/**
 * Hook for user-only features
 */
export const useUserOnly = (): boolean => {
  const { isUser } = usePermissions();
  return isUser;
};

/**
 * Hook for multiple feature access check
 */
export const useMultipleFeatureAccess = (features: string[]): Record<string, boolean> => {
  const { allowedFeatures } = usePermissions();
  
  const access: Record<string, boolean> = {};
  features.forEach((feature) => {
    access[feature] = allowedFeatures.includes(feature);
  });
  
  return access;
};

export default usePermissions;
