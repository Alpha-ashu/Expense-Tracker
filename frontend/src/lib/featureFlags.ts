export type UserRole = 'admin' | 'manager' | 'advisor' | 'user';

export type FeatureKey =
  | 'accounts'
  | 'transactions'
  | 'loans'
  | 'goals'
  | 'groups'
  | 'investments'
  | 'reports'
  | 'calendar'
  | 'todoLists'
  | 'transfer'
  | 'taxCalculator'
  | 'bookAdvisor'
  | 'adminPanel'
  | 'managerPanel'
  | 'advisorPanel'
  | 'notifications'
  | 'userProfile'
  | 'settings'
  | 'dashboard';

export interface FeatureVisibility extends Record<FeatureKey, boolean> {
  accounts: boolean;
  transactions: boolean;
  loans: boolean;
  goals: boolean;
  groups: boolean;
  investments: boolean;
  reports: boolean;
  calendar: boolean;
  todoLists: boolean;
  transfer: boolean;
  taxCalculator: boolean;
  bookAdvisor: boolean;
  adminPanel: boolean;
  managerPanel: boolean;
  advisorPanel: boolean;
  notifications: boolean;
  userProfile: boolean;
  settings: boolean;
  dashboard: boolean;
}

const DEFAULT_FEATURES: FeatureVisibility = {
  accounts: true,
  transactions: true,
  loans: true,
  goals: true,
  groups: true,
  investments: true,
  reports: true,
  calendar: true,
  todoLists: true,
  transfer: true,
  taxCalculator: true,
  bookAdvisor: true,
  adminPanel: true,
  managerPanel: true,
  advisorPanel: true,
  notifications: true,
  userProfile: true,
  settings: true,
  dashboard: true,
};

const ROLE_FEATURES: Record<UserRole, FeatureVisibility> = {
  admin: {
    accounts: true,
    transactions: true,
    loans: true,
    goals: true,
    groups: true,
    investments: true,
    reports: true,
    calendar: true,
    todoLists: true,
    transfer: true,
    taxCalculator: true,
    bookAdvisor: true,
    adminPanel: true,
    managerPanel: true,
    advisorPanel: false,
    notifications: true,
    userProfile: true,
    settings: true,
    dashboard: true,
  },
  manager: {
    accounts: false,
    transactions: false,
    loans: false,
    goals: false,
    groups: false,
    investments: false,
    reports: false,
    calendar: false,
    todoLists: false,
    transfer: false,
    taxCalculator: false,
    bookAdvisor: false,
    adminPanel: false,
    managerPanel: true,
    advisorPanel: false,
    notifications: true,
    userProfile: true,
    settings: true,
    dashboard: false,
  },
  advisor: {
    accounts: true,
    transactions: true,
    loans: true,
    goals: true,
    groups: true,
    investments: true,
    reports: true,
    calendar: true,
    todoLists: true,
    transfer: true,
    taxCalculator: true,
    bookAdvisor: true,
    adminPanel: false,
    managerPanel: false,
    advisorPanel: true,
    notifications: true,
    userProfile: true,
    settings: true,
    dashboard: true,
  },
  user: {
    accounts: true,
    transactions: true,
    loans: true,
    goals: true,
    groups: true,
    investments: true,
    reports: true,
    calendar: true,
    todoLists: true,
    transfer: true,
    taxCalculator: true,
    bookAdvisor: true,
    adminPanel: false,
    managerPanel: false,
    advisorPanel: false,
    notifications: true,
    userProfile: true,
    settings: true,
    dashboard: true,
  },
};

export function normalizeFeatures(
  features?: Partial<Record<FeatureKey, boolean>>,
): FeatureVisibility {
  return {
    ...DEFAULT_FEATURES,
    ...(features || {}),
  } as FeatureVisibility;
}

export function getVisibleFeaturesForRole(
  role: UserRole,
  env = 'development',
): FeatureVisibility {
  const base = ROLE_FEATURES[role] || ROLE_FEATURES.user;

  // In production, all roles have access to bookAdvisor
  return base;
}

export function mergeVisibleFeatures(
  base: FeatureVisibility,
  roleFeatures: FeatureVisibility,
): FeatureVisibility {
  const result: Partial<FeatureVisibility> = {};

  (Object.keys(base) as FeatureKey[]).forEach((key) => {
    result[key] = Boolean(base[key]) && Boolean(roleFeatures[key]);
  });

  return result as FeatureVisibility;
}
