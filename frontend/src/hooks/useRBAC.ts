/**
 * RBAC Hooks
 * Custom hooks for role-based access control in components
 */

import { useAuth } from '@/contexts/AuthContext';
import {
  hasFeatureAccess,
  canPerformAction,
  isAdminRole,
  isAdvisorRole,
  isUserRole,
} from '@/lib/rbac';

/**
 * Hook to check feature access
 */
export const useFeatureAccess = (feature: string): boolean => {
  const { role } = useAuth();
  return hasFeatureAccess(role, feature);
};

/**
 * Hook to check action permission
 */
export const useActionPermission = (action: string): boolean => {
  const { role } = useAuth();
  return canPerformAction(role, action);
};

/**
 * Hook to check if user is admin
 */
export const useIsAdmin = (): boolean => {
  const { role } = useAuth();
  return isAdminRole(role);
};

/**
 * Hook to check if user is advisor
 */
export const useIsAdvisor = (): boolean => {
  const { role } = useAuth();
  return isAdvisorRole(role);
};

/**
 * Hook to check if user is regular user
 */
export const useIsUser = (): boolean => {
  const { role } = useAuth();
  return isUserRole(role);
};

/**
 * Hook to check multiple feature access
 */
export const useMultipleFeatureAccess = (features: string[]): Record<string, boolean> => {
  const { role } = useAuth();
  
  const access: Record<string, boolean> = {};
  features.forEach((feature) => {
    access[feature] = hasFeatureAccess(role, feature);
  });
  
  return access;
};

/**
 * Hook to require specific role
 * Returns true only if user has exactly the specified role
 */
export const useRequireRole = (requiredRole: string | string[]): boolean => {
  const { role } = useAuth();
  
  if (Array.isArray(requiredRole)) {
    return requiredRole.includes(role);
  }
  
  return role === requiredRole;
};
