import { useCallback, useState, useEffect } from 'react';
import { FeatureKey, FeatureVisibility, getVisibleFeaturesForRole, UserRole } from '@/lib/featureFlags';

const FEATURE_FLAG_STORAGE_KEY = 'featureFlagsOverride';
const FEATURE_FLAG_CHANGE_EVENT = 'featureFlagsChanged';

export interface FeatureFlagState {
  [key: string]: {
    admin: boolean;
    advisor: boolean;
    user: boolean;
  };
}

const DEFAULT_FEATURE_FLAGS: FeatureFlagState = {
  accounts: { admin: true, advisor: true, user: true },
  transactions: { admin: true, advisor: true, user: true },
  loans: { admin: true, advisor: true, user: true },
  goals: { admin: true, advisor: true, user: true },
  groups: { admin: true, advisor: true, user: true },
  investments: { admin: true, advisor: true, user: true },
  reports: { admin: true, advisor: true, user: true },
  calendar: { admin: true, advisor: true, user: true },
  todoLists: { admin: true, advisor: true, user: true },
  transfer: { admin: true, advisor: true, user: true },
  taxCalculator: { admin: true, advisor: true, user: true },
  bookAdvisor: { admin: true, advisor: true, user: true },
};

export const useFeatureFlags = () => {
  const [flags, setFlags] = useState<FeatureFlagState>(() => {
    const stored = localStorage.getItem(FEATURE_FLAG_STORAGE_KEY);
    return stored ? JSON.parse(stored) : DEFAULT_FEATURE_FLAGS;
  });

  // Sync with localStorage and dispatch custom event for same-tab updates
  useEffect(() => {
    localStorage.setItem(FEATURE_FLAG_STORAGE_KEY, JSON.stringify(flags));
    // Dispatch custom event so same-tab components can listen
    window.dispatchEvent(new CustomEvent(FEATURE_FLAG_CHANGE_EVENT, { detail: flags }));
  }, [flags]);

  // Listen for storage events from other tabs
  useEffect(() => {
    const handleStorageChange = (e: StorageEvent) => {
      if (e.key === FEATURE_FLAG_STORAGE_KEY && e.newValue) {
        try {
          setFlags(JSON.parse(e.newValue));
        } catch (error) {
          console.error('Failed to parse feature flags from storage event:', error);
        }
      }
    };
    
    window.addEventListener('storage', handleStorageChange);
    return () => window.removeEventListener('storage', handleStorageChange);
  }, []);

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
    window.dispatchEvent(new CustomEvent(FEATURE_FLAG_CHANGE_EVENT, { detail: DEFAULT_FEATURE_FLAGS }));
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
