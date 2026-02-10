import React, { createContext, useContext, useState, useEffect, ReactNode, useCallback } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { db, Account, Transaction, Loan, Goal, Investment, GroupExpense, Friend } from '@/lib/database';
import { realtimeSyncManager, trackChange } from '@/lib/realTime';
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
  const [currentPage, setCurrentPage] = useState('accounts');
  const [currency, setCurrency] = useState(() => localStorage.getItem('currency') || 'USD');
  const [language, setLanguage] = useState(() => localStorage.getItem('language') || 'en');
  const [isOnline, setIsOnline] = useState(navigator.onLine);
  const [forceUpdate, setForceUpdate] = useState(0);
  const [visibleFeatures, setVisibleFeaturesState] = useState<FeatureVisibility>(() => {
    const stored = localStorage.getItem('visibleFeatures');
    const parsed = stored ? JSON.parse(stored) : {};
    return normalizeFeatures(parsed);
  });
  const { role } = useAuth();

  const accounts = useLiveQuery(() => db.accounts.toArray(), [forceUpdate]) || [];
  const friends = useLiveQuery(() => db.friends.toArray(), [forceUpdate]) || [];
  const transactions = useLiveQuery(() => db.transactions.orderBy('date').reverse().toArray(), [forceUpdate]) || [];
  const loans = useLiveQuery(() => db.loans.toArray(), [forceUpdate]) || [];
  const goals = useLiveQuery(() => db.goals.toArray(), [forceUpdate]) || [];
  const investments = useLiveQuery(() => db.investments.toArray(), [forceUpdate]) || [];
  const groupExpenses = useLiveQuery(() => db.groupExpenses.toArray(), [forceUpdate]) || [];

  const totalBalance = accounts
    .filter(acc => acc.isActive)
    .reduce((sum, acc) => sum + acc.balance, 0);

  // Setup real-time sync listeners
  useEffect(() => {
    const unsubscribe = realtimeSyncManager.subscribe(() => {
      setForceUpdate(prev => prev + 1);
    });

    const handleOnline = () => setIsOnline(true);
    const handleOffline = () => setIsOnline(false);

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    return () => {
      unsubscribe();
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);

  const refreshData = useCallback(() => {
    setForceUpdate(prev => prev + 1);
  }, []);

  const addTransaction = useCallback(async (transaction: Omit<Transaction, 'id'>) => {
    try {
      await db.transactions.add(transaction);
      trackChange('transaction-add', transaction);
      refreshData();
    } catch (error) {
      console.error('Failed to add transaction:', error);
      throw error;
    }
  }, [refreshData]);

  const updateAccount = useCallback(async (accountId: number, updates: Partial<Account>) => {
    try {
      await db.accounts.update(accountId, updates);
      trackChange('account-update', { accountId, updates });
      refreshData();
    } catch (error) {
      console.error('Failed to update account:', error);
      throw error;
    }
  }, [refreshData]);

  const addAccount = useCallback(async (account: Omit<Account, 'id'>) => {
    try {
      const id = await db.accounts.add(account);
      trackChange('account-add', { ...account, id });
      refreshData();
      return id;
    } catch (error) {
      console.error('Failed to add account:', error);
      throw error;
    }
  }, [refreshData]);

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
    const handleStorageChange = (e: StorageEvent) => {
      if (e.key === 'featureFlagsOverride' && e.storageArea === localStorage) {
        // Force a re-read of feature flags from storage
        const roleFeatures = getVisibleFeaturesForRole(role, import.meta.env.MODE);
        
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
          } catch (error) {
            console.error('Failed to parse feature flag overrides:', error);
          }
        }
        
        setVisibleFeaturesState(finalFeatures);
      }
    };
    
    const handleFeatureFlagsChanged = (event: any) => {
      // Handle custom event from same-tab feature flag changes
      const roleFeatures = getVisibleFeaturesForRole(role, import.meta.env.MODE);
      
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
        } catch (error) {
          console.error('Failed to parse feature flag overrides:', error);
        }
      }
      
      setVisibleFeaturesState(finalFeatures);
    };

    window.addEventListener('storage', handleStorageChange);
    window.addEventListener('featureFlagsChanged', handleFeatureFlagsChanged);
    
    return () => {
      window.removeEventListener('storage', handleStorageChange);
      window.removeEventListener('featureFlagsChanged', handleFeatureFlagsChanged);
    };
  }, [role]);

  // Save visible features to localStorage
  useEffect(() => {
    localStorage.setItem('visibleFeatures', JSON.stringify(visibleFeatures));
  }, [visibleFeatures]);

  const setVisibleFeatures = useCallback((features: Record<string, boolean>) => {
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
  if (context === undefined) {
    throw new Error('useApp must be used within an AppProvider');
  }
  return context;
};