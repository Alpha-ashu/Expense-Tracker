export type UserRole = 'admin' | 'advisor' | 'user';

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
  | 'financeAdvisor';

export type FeatureVisibility = Record<FeatureKey, boolean>;

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
  financeAdvisor: true,
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
    financeAdvisor: true,
  },
  advisor: {
    accounts: false,
    transactions: false,
    loans: false,
    goals: false,
    groups: false,
    investments: false,
    reports: true,
    calendar: true,
    todoLists: false,
    transfer: false,
    taxCalculator: false,
    financeAdvisor: true,
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
    financeAdvisor: true,
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

  // Example: In production, keep finance advisor behind admin-only until ready
  if (env === 'production') {
    return {
      ...base,
      financeAdvisor: role === 'admin' ? base.financeAdvisor : false,
    };
  }

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
