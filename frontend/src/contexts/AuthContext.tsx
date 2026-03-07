import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { User, Session } from '@supabase/supabase-js';
import supabase from '@/utils/supabase/client';
import { toast } from 'sonner';
import { UserRole } from '@/lib/featureFlags';
import { isAdminEmail } from '@/lib/rbac';
import { permissionService } from '@/services/permissionService';
import { initializeDemoData } from '@/lib/demoData';
import { db } from '@/lib/database';

interface AuthContextType {
  user: User | null;
  session: Session | null;
  loading: boolean;
  role: UserRole;
  signOut: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

const parseEmailList = (value?: string) => {
  return (value || '')
    .split(',')
    .map((item) => item.trim().toLowerCase())
    .filter(Boolean);
};

const advisorEmails = parseEmailList(import.meta.env.VITE_ADVISOR_EMAILS);

/**
 * Resolve user role with strict admin email validation.
 * Admin role is ONLY granted to the specific admin email.
 * Unauthenticated users always get 'user' role — auth gate handles access control.
 */
const resolveUserRole = (user: User | null): UserRole => {
  if (!user) {
    return 'user'; // No role escalation for unauthenticated users
  }

  const email = (user.email || '').toLowerCase().trim();
  const adminEmails = ['shaik.job.details@gmail.com'];

  if (adminEmails.includes(email)) {
    return 'admin';
  }

  if (advisorEmails.includes(email)) {
    return 'advisor';
  }

  // Check user metadata as fallback (but NOT for admin - always email-based)
  const metadataRole = user.user_metadata?.role;
  if (metadataRole === 'advisor') {
    return 'advisor';
  }

  return 'user';
};

/** Clear all user data from the local IndexedDB to ensure data isolation between accounts */
const clearLocalUserData = async () => {
  try {
    await Promise.all([
      db.accounts.clear(),
      db.transactions.clear(),
      db.loans.clear(),
      db.goals.clear(),
      db.investments.clear(),
      db.notifications.clear(),
      db.groupExpenses.clear(),
      db.friends.clear(),
    ]);
    localStorage.removeItem('admin_data_seeded_v2');
  } catch (err) {
    console.error('Failed to clear local DB on login:', err);
  }
};

const fetchWithTimeout = <T,>(promise: Promise<T>, ms: number): Promise<T> => {
  return Promise.race([
    promise,
    new Promise<T>((_, reject) => setTimeout(() => reject(new Error('Timeout')), ms))
  ]);
};

/** Sync user data from Supabase into local Dexie DB on login */
const syncFromSupabase = async (userId: string) => {
  try {
    const [
      { data: accounts = null },
      { data: transactions = null },
      { data: loansData = null },
      { data: goalsData = null },
      { data: investmentsData = null },
      { data: groupExpensesData = null },
      { data: profile = null },
    ] = await fetchWithTimeout(Promise.all([
      supabase.from('accounts').select('*').eq('user_id', userId),
      supabase.from('transactions').select('*').eq('user_id', userId),
      supabase.from('loans').select('*').eq('user_id', userId),
      supabase.from('goals').select('*').eq('user_id', userId),
      supabase.from('investments').select('*').eq('user_id', userId),
      supabase.from('group_expenses').select('*').eq('user_id', userId),
      supabase.from('profiles').select('*').eq('id', userId).maybeSingle(),
    ]), 4000);

    // Bypass onboarding if profile exists in backend
    if (profile && (profile.full_name || profile.first_name)) {
      localStorage.setItem('onboarding_completed', 'true');

      const firstName = profile.first_name || profile.full_name?.split(' ')[0] || '';
      const lastName = profile.last_name || profile.full_name?.split(' ').slice(1).join(' ') || '';

      localStorage.setItem('user_profile', JSON.stringify({
        displayName: profile.full_name || `${firstName} ${lastName}`.trim(),
        firstName,
        lastName,
        mobile: profile.phone || '',
        dateOfBirth: profile.date_of_birth || '',
        jobType: profile.job_type || '',
        salary: (profile.annual_income || (profile.monthly_income ? profile.monthly_income * 12 : 0)).toString(),
        monthlyIncome: profile.monthly_income || (profile.annual_income ? Math.round(profile.annual_income / 12) : 0),
        profilePhoto: profile.avatar_url || '',
      }));
    }

    if (accounts?.length) {
      await db.accounts.bulkPut(
        accounts.map((a: any) => ({
          id: a.local_id ?? undefined,
          name: a.name,
          type: a.type,
          balance: a.balance ?? 0,
          currency: a.currency ?? 'INR',
          isActive: a.is_active ?? true,
          createdAt: new Date(a.created_at),
        }))
      );
    }

    if (transactions?.length) {
      await db.transactions.bulkPut(
        transactions.map((t: any) => ({
          id: t.local_id ?? undefined,
          type: t.type,
          amount: t.amount,
          description: t.description ?? '',
          category: t.category ?? 'Other',
          accountId: t.account_id,
          date: new Date(t.date),
          createdAt: new Date(t.created_at),
        }))
      );
    }

    if (loansData?.length) {
      await db.loans.bulkPut(
        loansData.map((l: any) => ({
          id: l.local_id ?? undefined,
          type: l.type,
          name: l.name,
          principalAmount: l.principal_amount ?? 0,
          outstandingBalance: l.outstanding_balance ?? 0,
          interestRate: l.interest_rate,
          emiAmount: l.emi_amount,
          dueDate: l.due_date ? new Date(l.due_date) : undefined,
          frequency: l.frequency,
          status: l.status ?? 'active',
          contactPerson: l.contact_person,
          createdAt: new Date(l.created_at),
        }))
      );
    }

    if (goalsData?.length) {
      await db.goals.bulkPut(
        goalsData.map((g: any) => ({
          id: g.local_id ?? undefined,
          name: g.name,
          targetAmount: g.target_amount ?? 0,
          currentAmount: g.current_amount ?? 0,
          targetDate: new Date(g.target_date),
          category: g.category ?? 'other',
          isGroupGoal: g.is_group_goal ?? false,
          createdAt: new Date(g.created_at),
        }))
      );
    }

    if (investmentsData?.length) {
      await db.investments.bulkPut(
        investmentsData.map((i: any) => ({
          id: i.local_id ?? undefined,
          assetType: i.asset_type,
          assetName: i.asset_name,
          quantity: i.quantity ?? 0,
          buyPrice: i.buy_price ?? 0,
          currentPrice: i.current_price ?? 0,
          totalInvested: i.total_invested ?? 0,
          currentValue: i.current_value ?? 0,
          profitLoss: i.profit_loss ?? 0,
          purchaseDate: new Date(i.purchase_date),
          lastUpdated: new Date(i.last_updated ?? i.created_at),
        }))
      );
    }

    if (groupExpensesData?.length) {
      await db.groupExpenses.bulkPut(
        groupExpensesData.map((g: any) => ({
          id: g.local_id ?? undefined,
          name: g.name,
          totalAmount: g.total_amount ?? 0,
          paidBy: g.paid_by ?? 0,
          date: new Date(g.date),
          members: g.members ?? [],
          items: g.items ?? [],
          createdAt: new Date(g.created_at),
        }))
      );
    }
  } catch (err) {
    // Non-blocking — app works offline with local DB data
    if (isNetworkError(err)) {
      // Supabase project is paused or unreachable — expected in offline/dev mode
      console.info('ℹ️ Supabase unreachable — running on local data.');
    } else {
      console.error('Supabase sync on login failed (non-blocking):', err);
    }
  }
};

/** Returns true if an error is a network/timeout fault (Supabase unreachable) */
const isNetworkError = (error: any): boolean =>
  error?.name === 'AbortError' ||
  error?.name === 'TypeError' ||
  (error?.message && (
    error.message === 'Timeout' ||
    error.message.includes('signal is aborted') ||
    error.message.toLowerCase().includes('failed to fetch') ||
    error.message.toLowerCase().includes('network') ||
    error.message.toLowerCase().includes('timed out') ||
    error.message.toLowerCase().includes('timeout')
  ));

export const AuthProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);
  const [role, setRole] = useState<UserRole>('user');

  useEffect(() => {
    let isMounted = true;

    // Pause/resume auto-refresh based on actual network connectivity.
    const handleOffline = () => {
      supabase.auth.stopAutoRefresh();
      console.info('📴 Offline — Supabase auto-refresh paused.');
    };

    const handleOnline = async () => {
      console.info('🌐 Online — probing Supabase before resuming auto-refresh...');
      try {
        const { data: { session } } = await supabase.auth.getSession();
        if (!isMounted) return;
        setSession(session);
        setUser(session?.user ?? null);
        setRole(resolveUserRole(session?.user ?? null));
        supabase.auth.startAutoRefresh();
        console.info('✅ Supabase reachable — auto-refresh resumed.');
      } catch {
        console.warn('Supabase still unreachable after coming online — keeping auto-refresh paused.');
      }
    };

    window.addEventListener('offline', handleOffline);
    window.addEventListener('online', handleOnline);

    let initialSyncDone = false;

    // Listen for auth changes cleanly. This fires immediately with INITIAL_SESSION, 
    // replacing the need to manually call getSession() and dodging React StrictMode lock races.
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      async (event, session) => {
        if (!isMounted) return;
        setSession(session);
        const nextUser = session?.user ?? null;
        setUser(nextUser);
        const userRole = resolveUserRole(nextUser);
        setRole(userRole);

        try {
          if (nextUser?.id) {
            const isFreshLogin = event === 'SIGNED_IN';
            const isAppLoad = event === 'INITIAL_SESSION' && !initialSyncDone;

            if (isFreshLogin || isAppLoad) {
              const lastUserId = localStorage.getItem('auth_last_user_id');
              const isUserSwitch = lastUserId && lastUserId !== nextUser.id;

              if (isUserSwitch) {
                // Different user logged in — clear previous user's local data
                await clearLocalUserData();
              }

              // Always record the current user so we can detect future switches
              localStorage.setItem('auth_last_user_id', nextUser.id);

              // Sync accounts/transactions from Supabase into local Dexie
              await syncFromSupabase(nextUser.id);
              // Fetch permissions from server
              await permissionService.fetchUserPermissions(nextUser.id, userRole);
              
              // Seed demo data only for fresh login admin; regular users start with clean DB
              if (isFreshLogin) {
                await initializeDemoData(nextUser.email ?? undefined, nextUser.id);
              }
              initialSyncDone = true;
            }
          } else if (event === 'SIGNED_OUT') {
            // On logout, clear the stored user ID so the next login is treated
            // as a fresh start (even if same user logs back in).
            localStorage.removeItem('auth_last_user_id');
            permissionService.clearPermissions();
            // Clear local DB on logout too
            await clearLocalUserData();
            initialSyncDone = false; // Reset for next login
          }
        } catch (error) {
          console.error('Error in onAuthStateChange handler:', error);
        } finally {
          if (isMounted) setLoading(false);
        }
      }
    );

    return () => {
      isMounted = false;
      subscription.unsubscribe();
      supabase.auth.stopAutoRefresh();
      window.removeEventListener('offline', handleOffline);
      window.removeEventListener('online', handleOnline);
    };
  }, []);

  const signOut = async () => {
    try {
      const { error } = await supabase.auth.signOut();
      if (error) throw error;
      setUser(null);
      setSession(null);
      setRole('user');
      permissionService.clearPermissions();
    } catch (error) {
      console.error('Error signing out:', error);
      throw error;
    }
  };

  return (
    <AuthContext.Provider value={{ user, session, loading, role, signOut }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};
