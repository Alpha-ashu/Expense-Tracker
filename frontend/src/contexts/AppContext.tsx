import React, { createContext, useContext, useState, useEffect, ReactNode, useCallback, useMemo, useRef } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { useLocation, useNavigate } from 'react-router-dom';
import { db, Account, Transaction, Loan, Goal, Investment, GroupExpense, Friend } from '@/lib/database';
import { isBoilerplateDescription } from '@/services/smartExpenseImportService';
import { useAuth } from '@/contexts/AuthContext';
import { getVisibleFeaturesForRole, mergeVisibleFeatures, normalizeFeatures, FeatureVisibility } from '@/lib/featureFlags';
import type { SyncStats } from '@/lib/offline-sync-engine';
import { saveAccountWithBackendSync, saveTransactionWithBackendSync, syncUserDataFromCloud, updateAccountWithBackendSync } from '@/lib/auth-sync-integration';

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
  addAccount: (account: Omit<Account, 'id'>) => Promise<number>;
  visibleFeatures: FeatureVisibility;
  setVisibleFeatures: (features: FeatureVisibility) => void;
  // Offline-first sync
  syncStats: SyncStats;
  triggerSync: () => void;
}

const AppContext = createContext<AppContextType | undefined>(undefined);

export const AppProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const location = useLocation();
  const navigate = useNavigate();

  const currentPage = location.pathname.length > 1
    ? location.pathname.substring(1).split('?')[0].split('#')[0]
    : 'dashboard';

  const setCurrentPage = useCallback((page: string) => {
    const targetPath = page === 'dashboard' ? '/' : `/${page}`;
    if (location.pathname !== targetPath) {
      navigate(targetPath);
    }
  }, [navigate, location.pathname]);

  const [currency, setCurrency] = useState(() => localStorage.getItem('currency') || 'INR');
  const [language, setLanguage] = useState(() => localStorage.getItem('language') || 'en');
  const [isOnline, setIsOnline] = useState(navigator.onLine);
  const [manualRefreshToken, setManualRefreshToken] = useState(0);
  const [visibleFeatures, setVisibleFeaturesState] = useState<FeatureVisibility>(() => {
    const stored = localStorage.getItem('visibleFeatures');
    const parsed = stored ? JSON.parse(stored) : {};
    return normalizeFeatures(parsed);
  });
  const { role, user } = useAuth();
  const attemptedBalanceRepairKeyRef = useRef<string | null>(null);
  const syncStats = useMemo<SyncStats>(() => ({
    pendingCount: 0,
    lastSyncedAt: null,
    status: isOnline ? 'synced' : 'offline',
  }), [isOnline]);

  const accounts = useLiveQuery(
    () => db.accounts.filter(acc => !acc.deletedAt && acc.isActive !== false).toArray(),
    [manualRefreshToken]
  ) || [];
  const friends = useLiveQuery(
    () => db.friends.filter(f => !f.deletedAt).toArray(),
    [manualRefreshToken]
  ) || [];
  const transactions = useLiveQuery(
    () => db.transactions.orderBy('date').reverse().filter(txn => !txn.deletedAt).toArray(),
    [manualRefreshToken]
  ) || [];
  const loans = useLiveQuery(
    () => db.loans.filter(loan => !loan.deletedAt).toArray(),
    [manualRefreshToken]
  ) || [];
  const goals = useLiveQuery(
    () => db.goals.filter(goal => !goal.deletedAt).toArray(),
    [manualRefreshToken]
  ) || [];
  const investments = useLiveQuery(
    () => db.investments.filter(inv => !inv.deletedAt).toArray(),
    [manualRefreshToken]
  ) || [];
  const groupExpenses = useLiveQuery(
    () => db.groupExpenses.filter(ge => !ge.deletedAt).toArray(),
    [manualRefreshToken]
  ) || [];

  const totalBalance = useMemo(() => (
    accounts.filter(acc => acc.isActive).reduce((sum, acc) => sum + acc.balance, 0)
  ), [accounts]);

  // One-time: repair imported transaction titles that have boilerplate descriptions.
  // Uses the stored merchant field that was saved alongside the transaction.
  useEffect(() => {
    if (transactions.length === 0) return;
    const REPAIR_KEY = 'finora_description_repair_v2';
    if (localStorage.getItem(REPAIR_KEY)) return;

    const toRepair = transactions.filter(
      (txn) =>
        !txn.deletedAt &&
        isBoilerplateDescription(txn.description) &&
        Boolean(txn.merchant?.trim() || txn.importSource),
    );

    localStorage.setItem(REPAIR_KEY, 'done');
    if (toRepair.length === 0) return;

    void db.transaction('rw', db.transactions, async () => {
      const now = new Date();
      for (const txn of toRepair) {
        if (!txn.id) continue;
        const repaired = txn.merchant?.trim() || txn.category || 'Imported expense';
        await db.transactions.update(txn.id, { description: repaired, updatedAt: now });
      }
    });
  }, [transactions]);

  useEffect(() => {
    if (accounts.length === 0 || transactions.length === 0) return;

    const activeAccounts = accounts.filter((account) => account.isActive !== false && !account.deletedAt);
    if (activeAccounts.length === 0) return;

    const allZeroBalances = activeAccounts.every((account) => Math.abs(account.balance) < 0.000001);

    const importedNegativeNonCardAccounts = activeAccounts.filter(
      (account) => account.type !== 'card' && account.balance < 0,
    );

    const shouldAttemptNegativeImportRepair = importedNegativeNonCardAccounts.some((account) => {
      if (!account.id) return false;
      return transactions.some(
        (txn) => txn.accountId === account.id && !txn.deletedAt && Boolean(txn.importSource || txn.importedAt),
      );
    });

    if (!allZeroBalances && !shouldAttemptNegativeImportRepair) return;

    const repairKey = `${activeAccounts.map((account) => `${account.id}:${Number(account.balance).toFixed(2)}`).join(',')}::${transactions.length}`;
    if (attemptedBalanceRepairKeyRef.current === repairKey) return;
    attemptedBalanceRepairKeyRef.current = repairKey;

    const balanceByAccountId = new Map<number, number>();
    const flowByAccountId = new Map<number, { inflow: number; outflow: number }>();
    const latestSnapshotByAccountId = new Map<number, { date: Date; balance: number }>();

    for (const txn of transactions) {
      if (!txn.accountId || txn.deletedAt) continue;

      const snapshotValue = txn.importMetadata?.['Account Balance'];
      if (snapshotValue) {
        const parsedSnapshot = Number.parseFloat(
          String(snapshotValue)
            .replace(/[()]/g, '')
            .replace(/[^\d.,-]/g, '')
            .replace(/,(?=\d{3}\b)/g, ''),
        );
        const txDate = new Date(txn.date);
        if (Number.isFinite(parsedSnapshot) && !Number.isNaN(txDate.getTime())) {
          const existing = latestSnapshotByAccountId.get(txn.accountId);
          if (!existing || txDate.getTime() >= existing.date.getTime()) {
            latestSnapshotByAccountId.set(txn.accountId, {
              date: txDate,
              balance: parsedSnapshot,
            });
          }
        }
      }

      const currentFlow = flowByAccountId.get(txn.accountId) ?? { inflow: 0, outflow: 0 };

      if (txn.type === 'income') {
        balanceByAccountId.set(txn.accountId, (balanceByAccountId.get(txn.accountId) ?? 0) + txn.amount);
        currentFlow.inflow += txn.amount;
        flowByAccountId.set(txn.accountId, currentFlow);
        continue;
      }

      if (txn.type === 'expense') {
        balanceByAccountId.set(txn.accountId, (balanceByAccountId.get(txn.accountId) ?? 0) - txn.amount);
        currentFlow.outflow += txn.amount;
        flowByAccountId.set(txn.accountId, currentFlow);
        continue;
      }

      if (txn.type === 'transfer') {
        balanceByAccountId.set(txn.accountId, (balanceByAccountId.get(txn.accountId) ?? 0) - txn.amount);
        currentFlow.outflow += txn.amount;
        flowByAccountId.set(txn.accountId, currentFlow);
        if (txn.transferToAccountId) {
          balanceByAccountId.set(
            txn.transferToAccountId,
            (balanceByAccountId.get(txn.transferToAccountId) ?? 0) + txn.amount,
          );
          const destinationFlow = flowByAccountId.get(txn.transferToAccountId) ?? { inflow: 0, outflow: 0 };
          destinationFlow.inflow += txn.amount;
          flowByAccountId.set(txn.transferToAccountId, destinationFlow);
        }
      }

    }

    const hasNonZeroDerivedBalance = Array.from(balanceByAccountId.values()).some((value) => Math.abs(value) > 0.000001);
    if (!hasNonZeroDerivedBalance && !shouldAttemptNegativeImportRepair) return;

    void db.transaction('rw', db.accounts, async () => {
      const now = new Date();
      for (const account of activeAccounts) {
        if (!account.id) continue;

        const latestSnapshot = latestSnapshotByAccountId.get(account.id);
        if (latestSnapshot) {
          await db.accounts.update(account.id, {
            balance: Number(latestSnapshot.balance.toFixed(2)),
            updatedAt: now,
          });
          continue;
        }

        const derivedBalance = balanceByAccountId.get(account.id);
        if (derivedBalance == null) continue;

        const flows = flowByAccountId.get(account.id) ?? { inflow: 0, outflow: 0 };
        const hasImportedRows = transactions.some(
          (txn) => txn.accountId === account.id && !txn.deletedAt && Boolean(txn.importSource || txn.importedAt),
        );

        let repairedBalance = derivedBalance;
        if (
          hasImportedRows
          && account.type !== 'card'
          && repairedBalance < 0
          && flows.inflow <= 0
        ) {
          repairedBalance = 0;
        }

        await db.accounts.update(account.id, {
          balance: Number(repairedBalance.toFixed(2)),
          updatedAt: now,
        });
      }
    });
  }, [accounts, transactions]);

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

  const triggerSync = useCallback(() => {
    if (user?.id) {
      void syncUserDataFromCloud(user.id);
    }
  }, [user?.id]);

  const addTransaction = useCallback(async (transaction: Omit<Transaction, 'id'>) => {
    try {
      await saveTransactionWithBackendSync(transaction);
    } catch (error) {
      console.error('Failed to add transaction:', error);
      throw error;
    }
  }, []);

  const updateAccount = useCallback(async (accountId: number, updates: Partial<Account>) => {
    try {
      await updateAccountWithBackendSync(accountId, updates);
    } catch (error) {
      console.error('Failed to update account:', error);
      throw error;
    }
  }, []);

  const addAccount = useCallback(async (account: Omit<Account, 'id'>) => {
    try {
      const saved = await saveAccountWithBackendSync(account);
      return saved.id as number;
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

  const contextValue = useMemo(() => ({
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
    syncStats,
    triggerSync,
  }), [
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
    syncStats,
    triggerSync,
  ]);

  return (
    <AppContext.Provider value={contextValue}>
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
      setCurrentPage: () => { },
      accounts: [],
      friends: [],
      transactions: [],
      loans: [],
      goals: [],
      investments: [],
      groupExpenses: [],
      totalBalance: 0,
      currency: 'INR',
      setCurrency: () => { },
      language: 'en',
      setLanguage: () => { },
      refreshData: () => { },
      isOnline: true,
      addTransaction: async () => { },
      updateAccount: async () => { },
      addAccount: async () => 0,
      visibleFeatures: getVisibleFeaturesForRole('user', import.meta.env.MODE),
      setVisibleFeatures: () => { },
      syncStats: { pendingCount: 0, lastSyncedAt: null, status: 'idle' as const },
      triggerSync: () => { },
    } as AppContextType;
  }

  throw new Error('useApp must be used within an AppProvider');
};

export const useOptionalApp = () => useContext(AppContext);
