/**
 * RBAC Hooks
 * Custom hooks for role-based access control in components
 */

import { usePermissions } from './usePermissions';

/**
 * Hook to check feature access
 */
export const useFeatureAccess = (feature: string): boolean => {
  const { hasFeatureAccess } = usePermissions();
  return hasFeatureAccess(feature);
};

/**
 * Hook to check action permission
 */
export const useActionPermission = (action: string): boolean => {
  const { canPerformAction } = usePermissions();
  return canPerformAction(action);
};

/**
 * Hook to check if user is admin
 */
export const useIsAdmin = (): boolean => {
  const { isAdmin } = usePermissions();
  return isAdmin;
};

/**
 * Hook to check if user is advisor
 */
export const useIsAdvisor = (): boolean => {
  const { isAdvisor } = usePermissions();
  return isAdvisor;
};

/**
 * Hook to check if user is regular user
 */
export const useIsUser = (): boolean => {
  const { isUser } = usePermissions();
  return isUser;
};

/**
 * Hook to check multiple feature access
 */
export const useMultipleFeatureAccess = (features: string[]): Record<string, boolean> => {
  const { hasFeatureAccess } = usePermissions();
  
  const access: Record<string, boolean> = {};
  features.forEach((feature) => {
    access[feature] = hasFeatureAccess(feature);
  });
  
  return access;
};

/**
 * Hook to require specific role
 * Returns true only if user has exactly the specified role
 */
export const useRequireRole = (requiredRole: string | string[]): boolean => {
  const { role } = usePermissions();
  if (!role) {
    return false;
  }
  
  if (Array.isArray(requiredRole)) {
    return requiredRole.includes(role);
  }
  
  return role === requiredRole;
};
