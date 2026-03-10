import React, { createContext, useContext, useState, useEffect, ReactNode, useCallback } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { useLocation, useNavigate } from 'react-router-dom';
import { db, Account, Transaction, Loan, Goal, Investment, GroupExpense, Friend } from '@/lib/database';
import { useAuth } from '@/contexts/AuthContext';
import { getVisibleFeaturesForRole, mergeVisibleFeatures, normalizeFeatures, FeatureVisibility } from '@/lib/featureFlags';

interface AppContextType {
  currentPage: string;
  setCurrentPage: (page: string) => void;
  accounts: Account[];
  friends: Friend[];
  transactions: Transaction[];
  loans: Loan[];
  goals: Goal[];
  investments: Investment[];
  groupExpenses: GroupExpense[];
  totalBalance: number;
  currency: string;
  setCurrency: (currency: string) => void;
  language: string;
  setLanguage: (language: string) => void;
  refreshData: () => void;
  isOnline: boolean;
  addTransaction: (transaction: Omit<Transaction, 'id'>) => Promise<void>;
  updateAccount: (accountId: number, updates: Partial<Account>) => Promise<void>;
  addAccount: (account: Omit<Account, 'id'>) => Promise<void>;
  visibleFeatures: FeatureVisibility;
  setVisibleFeatures: (features: FeatureVisibility) => void;
}

const AppContext = createContext<AppContextType | undefined>(undefined);

export const AppProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const location = useLocation();
  const navigate = useNavigate();

  const currentPage = location.pathname.length > 1 ? location.pathname.substring(1).split('?')[0].split('#')[0] : 'accounts';

  const setCurrentPage = useCallback((page: string) => {
    // Standardize URL to keep it clean
    if (page === 'dashboard' && location.pathname === '/') return;
    if (page !== currentPage) {
      navigate(`/${page}`);
    }
  }, [navigate, currentPage, location.pathname]);

  const [currency, setCurrency] = useState(() => localStorage.getItem('currency') || 'INR');
  const [language, setLanguage] = useState(() => localStorage.getItem('language') || 'en');
  const [isOnline, setIsOnline] = useState(navigator.onLine);
  const [manualRefreshToken, setManualRefreshToken] = useState(0);
  const [visibleFeatures, setVisibleFeaturesState] = useState<FeatureVisibility>(() => {
    const stored = localStorage.getItem('visibleFeatures');
    const parsed = stored ? JSON.parse(stored) : {};
    return normalizeFeatures(parsed);
  });
  const { role } = useAuth();

  const accounts = useLiveQuery(() => db.accounts.toArray(), [manualRefreshToken]) || [];
  const friends = useLiveQuery(() => db.friends.toArray(), [manualRefreshToken]) || [];
  const transactions = useLiveQuery(() => db.transactions.orderBy('date').reverse().toArray(), [manualRefreshToken]) || [];
  const loans = useLiveQuery(() => db.loans.toArray(), [manualRefreshToken]) || [];
  const goals = useLiveQuery(() => db.goals.toArray(), [manualRefreshToken]) || [];
  const investments = useLiveQuery(() => db.investments.toArray(), [manualRefreshToken]) || [];
  const groupExpenses = useLiveQuery(() => db.groupExpenses.toArray(), [manualRefreshToken]) || [];

  const totalBalance = accounts
    .filter(acc => acc.isActive)
    .reduce((sum, acc) => sum + acc.balance, 0);

  useEffect(() => {
    const handleOnline = () => setIsOnline(true);
    const handleOffline = () => setIsOnline(false);

    const handleOnboardingComplete = () => {
      setManualRefreshToken(prev => prev + 1);
    };

    const handleStorageChange = (e: StorageEvent) => {
      if (e.key === 'onboarding_refresh_timestamp' && e.newValue) {
        setManualRefreshToken(prev => prev + 1);
      }
    };

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);
    window.addEventListener('ONBOARDING_COMPLETED', handleOnboardingComplete);
    window.addEventListener('storage', handleStorageChange);

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
      window.removeEventListener('ONBOARDING_COMPLETED', handleOnboardingComplete);
      window.removeEventListener('storage', handleStorageChange);
    };
  }, []);

  const refreshData = useCallback(() => {
    setManualRefreshToken(prev => prev + 1);
  }, []);

  const addTransaction = useCallback(async (transaction: Omit<Transaction, 'id'>) => {
    try {
      await db.transactions.add(transaction);
    } catch (error) {
      console.error('Failed to add transaction:', error);
      throw error;
    }
  }, []);

  const updateAccount = useCallback(async (accountId: number, updates: Partial<Account>) => {
    try {
      await db.accounts.update(accountId, updates);
    } catch (error) {
      console.error('Failed to update account:', error);
      throw error;
    }
  }, []);

  const addAccount = useCallback(async (account: Omit<Account, 'id'>) => {
    try {
      const id = await db.accounts.add(account);
      return id;
    } catch (error) {
      console.error('Failed to add account:', error);
      throw error;
    }
  }, []);

  // Save currency and language to localStorage
  useEffect(() => {
    localStorage.setItem('currency', currency);
  }, [currency]);

  useEffect(() => {
    localStorage.setItem('language', language);
  }, [language]);

  useEffect(() => {
    const roleFeatures = getVisibleFeaturesForRole(role, import.meta.env.MODE);
    
    // Read feature flag overrides from localStorage (set by admin panel)
    const overrideFlags = localStorage.getItem('featureFlagsOverride');
    let finalFeatures = roleFeatures;
    
    if (overrideFlags) {
      try {
        const parsed = JSON.parse(overrideFlags);
        const overrides: Record<string, boolean> = {};
        
        Object.entries(parsed).forEach(([feature, roleFlags]: [string, any]) => {
          if (roleFlags[role]) {
            overrides[feature] = true;
          } else {
            overrides[feature] = false;
          }
        });
        
        finalFeatures = {
          ...roleFeatures,
          ...overrides,
        };
      } catch (e) {
        console.error('Failed to parse feature flag overrides:', e);
      }
    }
    
    setVisibleFeaturesState((prev) => mergeVisibleFeatures(normalizeFeatures(prev), finalFeatures));
  }, [role]);

  // Listen for changes to feature flags from admin panel (both same-tab and cross-tab)
  useEffect(() => {
    // BroadcastChannel for cross-tab real-time sync
    let broadcastChannel: BroadcastChannel | null = null;
    try {
      broadcastChannel = new BroadcastChannel('feature_settings_channel');
    } catch {
      // BroadcastChannel not supported
    }

    const applyAdminFeatureSettings = () => {
      const adminSettings = localStorage.getItem('admin_global_feature_settings');
      if (!adminSettings) return;

      try {
        const parsed = JSON.parse(adminSettings);
        const roleFeatures = getVisibleFeaturesForRole(role, import.meta.env.MODE);
        const newVisibility: Record<string, boolean> = { ...roleFeatures };

        Object.entries(parsed).forEach(([key, value]: [string, any]) => {
          const readiness = value.readiness;
          let isVisible = false;

          switch (readiness) {
            case 'unreleased':
              isVisible = role === 'admin';
              break;
            case 'beta':
              isVisible = role === 'admin' || role === 'advisor';
              break;
            case 'released':
              isVisible = true;
              break;
            case 'deprecated':
              isVisible = false;
              break;
            default:
              isVisible = roleFeatures[key as keyof typeof roleFeatures] ?? true;
          }

          newVisibility[key] = isVisible;
        });

        console.log('🎛️ AppContext applying admin feature settings:', { role, newVisibility });
        setVisibleFeaturesState(newVisibility as unknown as FeatureVisibility);
      } catch (e) {
        console.error('Failed to apply admin feature settings:', e);
      }
    };

    // Apply on mount
    applyAdminFeatureSettings();

    const handleStorageChange = (e: StorageEvent) => {
      if (e.key === 'admin_global_feature_settings' || e.key === 'featureFlagsOverride') {
        console.log('💾 Storage change detected for feature settings');
        applyAdminFeatureSettings();
      }
    };
    
    const handleAdminFeatureUpdate = (event: CustomEvent) => {
      console.log('📡 Admin feature update event received:', event.detail);
      applyAdminFeatureSettings();
    };

    const handleBroadcastMessage = (event: MessageEvent) => {
      if (event.data.type === 'FEATURE_UPDATE') {
        console.log('📡 Broadcast feature update received:', event.data);
        applyAdminFeatureSettings();
      }
    };

    if (broadcastChannel) {
      broadcastChannel.addEventListener('message', handleBroadcastMessage);
    }

    window.addEventListener('storage', handleStorageChange);
    window.addEventListener('adminFeatureUpdate', handleAdminFeatureUpdate as EventListener);
    
    return () => {
      window.removeEventListener('storage', handleStorageChange);
      window.removeEventListener('adminFeatureUpdate', handleAdminFeatureUpdate as EventListener);
      if (broadcastChannel) {
        broadcastChannel.removeEventListener('message', handleBroadcastMessage);
        broadcastChannel.close();
      }
    };
  }, [role]);

  // Save visible features to localStorage
  useEffect(() => {
    localStorage.setItem('visibleFeatures', JSON.stringify(visibleFeatures));
  }, [visibleFeatures]);

  const setVisibleFeatures = useCallback((features: FeatureVisibility) => {
    const roleFeatures = getVisibleFeaturesForRole(role, import.meta.env.MODE);
    const normalized = normalizeFeatures(features);
    setVisibleFeaturesState(mergeVisibleFeatures(normalized, roleFeatures));
  }, [role]);

  return (
    <AppContext.Provider
      value={{
        currentPage,
        setCurrentPage,
        accounts,
        friends,
        transactions,
        loans,
        goals,
        investments,
        groupExpenses,
        totalBalance,
        currency,
        setCurrency,
        language,
        setLanguage,
        refreshData,
        isOnline,
        addTransaction,
        updateAccount,
        addAccount,
        visibleFeatures,
        setVisibleFeatures,
      }}
    >
      {children}
    </AppContext.Provider>
  );
};

export const useApp = () => {
  const context = useContext(AppContext);
  if (context !== undefined) return context;

  if (import.meta.env.DEV) {
    console.warn('useApp called without AppProvider; returning fallback context.');
    return {
      currentPage: 'dashboard',
      setCurrentPage: () => {},
      accounts: [],
      friends: [],
      transactions: [],
      loans: [],
      goals: [],
      investments: [],
      groupExpenses: [],
      totalBalance: 0,
      currency: 'INR',
      setCurrency: () => {},
      language: 'en',
      setLanguage: () => {},
      refreshData: () => {},
      isOnline: true,
      addTransaction: async () => {},
      updateAccount: async () => {},
      addAccount: async () => {},
      visibleFeatures: getVisibleFeaturesForRole('user', import.meta.env.MODE),
      setVisibleFeatures: () => {},
    } as AppContextType;
  }

  throw new Error('useApp must be used within an AppProvider');
};

export const useOptionalApp = () => useContext(AppContext);
