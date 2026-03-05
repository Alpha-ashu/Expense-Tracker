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

/** Sync accounts and transactions from Supabase into local Dexie DB */
const syncFromSupabase = async (userId: string) => {
  try {
    const [{ data: accounts }, { data: transactions }, { data: profile }] = await Promise.all([
      supabase.from('accounts').select('*').eq('user_id', userId),
      supabase.from('transactions').select('*').eq('user_id', userId),
      supabase.from('profiles').select('*').eq('id', userId).single(),
    ]);

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
  } catch (err) {
    // Non-blocking — app works offline with empty local DB
    console.error('Supabase sync on login failed:', err);
  }
};

/** Returns true if an error is a network/timeout fault (Supabase unreachable) */
const isNetworkError = (error: any): boolean =>
  error?.name === 'AbortError' ||
  error?.name === 'TypeError' ||
  (error?.message && (
    error.message.includes('signal is aborted') ||
    error.message.toLowerCase().includes('failed to fetch') ||
    error.message.toLowerCase().includes('network') ||
    error.message.toLowerCase().includes('timed out')
  ));

export const AuthProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);
  const [role, setRole] = useState<UserRole>('user');

  useEffect(() => {
    const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
    const supabaseKey = import.meta.env.VITE_SUPABASE_PUBLISHABLE_DEFAULT_KEY;

    if (!supabaseUrl || !supabaseKey) {
      toast.error('Supabase is not configured. Add VITE_SUPABASE_URL and VITE_SUPABASE_PUBLISHABLE_DEFAULT_KEY in Vercel.');
      setLoading(false);
      return;
    }

    // ── Silence React StrictMode AbortErrors from Supabase's navigator.locks ──
    // In dev, React mounts → unmounts → remounts every component. The first
    // unmount aborts the locks.ts lock that onAuthStateChange() acquired, which
    // surfaces as an unhandled "AbortError: signal is aborted without reason".
    // These are harmless noise — the second (real) mount re-subscribes correctly.
    const handleUnhandledRejection = (event: PromiseRejectionEvent) => {
      const err = event.reason;
      if (
        err?.name === 'AbortError' &&
        (err?.message === 'signal is aborted without reason' || err?.message === '')
      ) {
        event.preventDefault(); // Suppress from console
      }
    };
    window.addEventListener('unhandledrejection', handleUnhandledRejection);

    // Guard against setting state after the component unmounts
    let isMounted = true;

    // Check active session
    const initAuth = async () => {
      // ── Suppress the single console.error that Supabase's internal fetch.ts
      // logs before rethrowing an AbortError when our 10-second timeout fires.
      // Without this intercept, one "AbortError: signal is aborted without reason"
      // line always appears even though our code handles it gracefully below.
      const _origConsoleError = console.error;
      console.error = (...args: any[]) => {
        const first = args[0];
        const isAbort =
          first?.name === 'AbortError' ||
          first?.name === 'AuthRetryableFetchError' ||
          (first?.message && first.message.includes('aborted')) ||
          (typeof first === 'string' && (first.includes('AbortError') || first.includes('aborted')));
        if (!isAbort) _origConsoleError.apply(console, args);
      };

      try {
        // If redirected here after explicit sign out, skip session restore
        const params = new URLSearchParams(window.location.search);
        if (params.get('logged_out') === '1') {
          window.history.replaceState({}, '', window.location.pathname);
          if (isMounted) {
            setUser(null);
            setSession(null);
            setLoading(false);
          }
          return;
        }

        const { data: { session } } = await supabase.auth.getSession();
        if (!isMounted) return;

        setSession(session);
        const nextUser = session?.user ?? null;
        setUser(nextUser);
        const userRole = resolveUserRole(nextUser);
        setRole(userRole);

        // ✅ Supabase is reachable — safe to enable auto-refresh
        supabase.auth.startAutoRefresh();

        if (nextUser?.id) {
          await permissionService.fetchUserPermissions(nextUser.id, userRole);
          // Sync data and bypass onboarding if profile exists, before hiding the loading screen
          await syncFromSupabase(nextUser.id);
        }
      } catch (error: any) {
        if (!isMounted) return;

        if (isNetworkError(error)) {
          // Supabase is unreachable (paused project, no internet, etc.).
          // Stay unauthenticated and do NOT start auto-refresh — it would
          // spam the console with ERR_CONNECTION_TIMED_OUT every ~30 seconds.
          console.warn('Supabase unreachable at startup — running in offline mode.');
        } else {
          console.error('Error loading session:', error);
        }
      } finally {
        console.error = _origConsoleError; // Always restore
        if (isMounted) setLoading(false);
      }
    };

    initAuth();

    // Pause/resume auto-refresh based on actual network connectivity.
    // Note: navigator.onLine reflects browser internet access, NOT Supabase
    // reachability. The `online` handler re-calls getSession() so we only
    // start auto-refresh if Supabase responds successfully.
    const handleOffline = () => {
      supabase.auth.stopAutoRefresh();
      console.info('📴 Offline — Supabase auto-refresh paused.');
    };

    const handleOnline = async () => {
      console.info('🌐 Online — probing Supabase before resuming auto-refresh...');
      try {
        const { data: { session } } = await supabase.auth.getSession();
        if (!isMounted) return;
        // Supabase responded — update state and (re-)enable auto-refresh
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

    // Listen for auth changes
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      async (event, session) => {
        if (!isMounted) return;
        setSession(session);
        const nextUser = session?.user ?? null;
        setUser(nextUser);
        const userRole = resolveUserRole(nextUser);
        setRole(userRole);

        try {

          if (event === 'SIGNED_IN' && nextUser?.id) {
            // CRITICAL: Only clear local data when a *different* user signs in.
            // Clearing on every SIGNED_IN (including page reloads and post-onboarding
            // reloads) wipes data that was just written during onboarding.
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
            // Seed demo data only for admin; regular users start with clean DB
            await initializeDemoData(nextUser.email ?? undefined, nextUser.id);
          } else if (event === 'SIGNED_OUT') {
            // On logout, clear the stored user ID so the next login is treated
            // as a fresh start (even if same user logs back in).
            localStorage.removeItem('auth_last_user_id');
            permissionService.clearPermissions();
            // Clear local DB on logout too
            await clearLocalUserData();
          }
        } finally {
          setLoading(false);
        }
      }
    );

    return () => {
      isMounted = false;
      subscription.unsubscribe();
      supabase.auth.stopAutoRefresh();
      window.removeEventListener('offline', handleOffline);
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('unhandledrejection', handleUnhandledRejection);
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
