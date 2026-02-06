import { useCallback, useState, useEffect } from 'react';
import { FeatureKey, FeatureVisibility, getVisibleFeaturesForRole, UserRole } from '@/lib/featureFlags';

const FEATURE_FLAG_STORAGE_KEY = 'featureFlagsOverride';

export interface FeatureFlagState {
  [key: string]: {
    admin: boolean;
    advisor: boolean;
    user: boolean;
  };
}

const DEFAULT_FEATURE_FLAGS: FeatureFlagState = {
  accounts: { admin: true, advisor: false, user: true },
  transactions: { admin: true, advisor: false, user: true },
  loans: { admin: true, advisor: false, user: true },
  goals: { admin: true, advisor: false, user: true },
  groups: { admin: true, advisor: false, user: true },
  investments: { admin: true, advisor: false, user: true },
  reports: { admin: true, advisor: true, user: true },
  calendar: { admin: true, advisor: true, user: true },
  todoLists: { admin: true, advisor: false, user: true },
  transfer: { admin: true, advisor: false, user: true },
  taxCalculator: { admin: true, advisor: false, user: true },
  financeAdvisor: { admin: true, advisor: true, user: true },
};

export const useFeatureFlags = () => {
  const [flags, setFlags] = useState<FeatureFlagState>(() => {
    const stored = localStorage.getItem(FEATURE_FLAG_STORAGE_KEY);
    return stored ? JSON.parse(stored) : DEFAULT_FEATURE_FLAGS;
  });

  // Sync with localStorage
  useEffect(() => {
    localStorage.setItem(FEATURE_FLAG_STORAGE_KEY, JSON.stringify(flags));
  }, [flags]);

  const toggleFeature = useCallback(
    (feature: FeatureKey, role: UserRole, enabled: boolean) => {
      setFlags((prev) => ({
        ...prev,
        [feature]: {
          ...prev[feature],
          [role]: enabled,
        },
      }));
    },
    []
  );

  const resetToDefaults = useCallback(() => {
    setFlags(DEFAULT_FEATURE_FLAGS);
    localStorage.removeItem(FEATURE_FLAG_STORAGE_KEY);
  }, []);

  const getFeatureStatus = useCallback(
    (feature: FeatureKey) => {
      return flags[feature] || DEFAULT_FEATURE_FLAGS[feature];
    },
    [flags]
  );

  return {
    flags,
    toggleFeature,
    resetToDefaults,
    getFeatureStatus,
  };
};
