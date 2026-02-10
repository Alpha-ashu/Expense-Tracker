/**
 * Role-Based Access Control (RBAC) System
 * Implements secure role hierarchy for Admin, Advisor, and User roles
 */

import { UserRole } from './featureFlags';

// Admin email - hardcoded as per requirements
const ADMIN_EMAIL = 'shaik.job.details@gmail.com';

/**
 * Feature Permissions by Role
 * Defines what each role can access and do
 */
export const ROLE_PERMISSIONS = {
  admin: {
    // Can access everything
    features: [
      'accounts',
      'transactions',
      'loans',
      'goals',
      'groups',
      'investments',
      'reports',
      'calendar',
      'todoLists',
      'transfer',
      'taxCalculator',
      'bookAdvisor',
      'adminPanel', // Admin-only
      'featureControl', // Admin-only
    ],
    canAccessAdminPanel: true,
    canControlFeatures: true,
    canViewAllUsers: true,
    canManageAdvisors: true,
    canApproveFeatures: true,
    canTestNewFeatures: true,
  },

  advisor: {
    // Can access user features EXCEPT booking themselves
    features: [
      'accounts',
      'transactions',
      'loans',
      'goals',
      'groups',
      'investments',
      'reports',
      'calendar',
      'todoLists',
      'transfer',
      'taxCalculator',
      // 'bookAdvisor' - REMOVED, advisors don't book themselves
      'advisorPanel', // Advisor-specific
      'manageAvailability',
      'viewBookings',
      'manageSessions',
      'receivePayments',
    ],
    canAccessAdvisorPanel: true,
    canSetAvailability: true,
    canStartSessions: true,
    canReceiveBookings: true,
    canManageSessions: true,
    canReceivePayments: true,
    canViewClients: true,
  },

  user: {
    // Standard user features
    features: [
      'accounts',
      'transactions',
      'loans',
      'goals',
      'groups',
      'investments',
      'reports',
      'calendar',
      'todoLists',
      'transfer',
      'taxCalculator',
      'bookAdvisor',
    ],
    canBookAdvisors: true,
    canPayForSessions: true,
    canJoinSessions: true,
    canViewSessionHistory: true,
    canRateAdvisors: true,
  },
};

/**
 * Check if email is admin
 */
export const isAdminEmail = (email: string | undefined): boolean => {
  if (!email) return false;
  const isAdmin = email.toLowerCase() === ADMIN_EMAIL.toLowerCase();
  console.log('🔐 Admin check:', {
    inputEmail: email,
    adminEmail: ADMIN_EMAIL,
    inputLowercase: email.toLowerCase(),
    adminLowercase: ADMIN_EMAIL.toLowerCase(),
    isAdmin: isAdmin,
  });
  return isAdmin;
};

/**
 * Check if user has permission for a feature
 */
export const hasFeatureAccess = (
  role: UserRole,
  feature: string
): boolean => {
  const permissions = ROLE_PERMISSIONS[role];
  if (!permissions) return false;
  return (permissions.features as string[]).includes(feature);
};

/**
 * Check if user can perform a specific action
 */
export const canPerformAction = (
  role: UserRole,
  action: string
): boolean => {
  const permissions = ROLE_PERMISSIONS[role] as Record<string, boolean | string[]>;
  if (!permissions) return false;

  // Check if action permission exists and is true
  const actionKey = `can${action.charAt(0).toUpperCase()}${action.slice(1)}`;
  return permissions[actionKey] === true;
};

/**
 * Get all allowed features for a role
 */
export const getAllowedFeatures = (role: UserRole): string[] => {
  const permissions = ROLE_PERMISSIONS[role];
  return permissions?.features || [];
};

/**
 * Check if role has admin privileges
 */
export const isAdminRole = (role: UserRole): boolean => role === 'admin';

/**
 * Check if role is advisor
 */
export const isAdvisorRole = (role: UserRole): boolean => role === 'advisor';

/**
 * Check if role is regular user
 */
export const isUserRole = (role: UserRole): boolean => role === 'user';

/**
 * Get role display name
 */
export const getRoleDisplayName = (role: UserRole): string => {
  const names: Record<UserRole, string> = {
    admin: 'Administrator',
    advisor: 'Financial Advisor',
    user: 'User',
  };
  return names[role];
};

/**
 * Check if user can access admin features
 */
export const canAccessAdminPanel = (role: UserRole): boolean => {
  const permissions = ROLE_PERMISSIONS[role] as Record<string, boolean>;
  return permissions?.canAccessAdminPanel === true;
};

/**
 * Check if user can access advisor panel
 */
export const canAccessAdvisorPanel = (role: UserRole): boolean => {
  const permissions = ROLE_PERMISSIONS[role] as Record<string, boolean>;
  return permissions?.canAccessAdvisorPanel === true;
};

/**
 * Feature readiness status (Admin can control)
 */
export const FEATURE_READINESS = {
  unreleased: 'unreleased', // Admin only
  beta: 'beta', // Admin + selected users
  released: 'released', // All users
  deprecated: 'deprecated', // Scheduled for removal
} as const;

export type FeatureReadiness = typeof FEATURE_READINESS[keyof typeof FEATURE_READINESS];

/**
 * Check if feature should be visible based on readiness and role
 */
export const isFeatureVisible = (
  readiness: FeatureReadiness,
  role: UserRole
): boolean => {
  switch (readiness) {
    case 'unreleased':
      return role === 'admin';
    case 'beta':
      return role === 'admin' || role === 'advisor';
    case 'released':
      return true;
    case 'deprecated':
      return false;
    default:
      return false;
  }
};
