import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { User, Session } from '@supabase/supabase-js';
import supabase from '@/utils/supabase/client';
import { UserRole } from '@/lib/featureFlags';
import { permissionService } from '@/services/permissionService';
import { initializeDemoData } from '@/lib/demoData';
import { db } from '@/lib/database';
import {
  handleLogout as handleBackendLogout,
  initializeBackendSync,
  runWithCloudSyncSuppressed,
  subscribeToUserCloudSync,
  syncUserDataFromCloud,
} from '@/lib/auth-sync-integration';

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
    await runWithCloudSyncSuppressed(async () => {
      await Promise.all([
        db.accounts.clear(),
        db.transactions.clear(),
        db.loans.clear(),
        db.goals.clear(),
        db.investments.clear(),
        db.notifications.clear(),
        db.groupExpenses.clear(),
        db.friends.clear(),
        db.merchantProfiles.clear(),
        db.userCategoryPreferences.clear(),
        db.documents.clear(),
        db.smsTransactions.clear(),
      ]);
    });
    localStorage.removeItem('admin_data_seeded_v2');
  } catch (err) {
    console.error('Failed to clear local DB on login:', err);
  }
};

const fetchWithTimeout = <T,>(promise: Promise<T>, ms: number): Promise<T> => {
  return Promise.race([
    promise,
    new Promise<T>((_, reject) => {
      const timeoutError = new Error(`Supabase sync timeout after ${ms}ms`);
      (timeoutError as any).name = 'TimeoutError';
      (timeoutError as any).timeoutMs = ms;
      setTimeout(() => reject(timeoutError), ms);
    })
  ]);
};

const formatSupabaseError = (error: any) => {
  if (!error) return 'unknown error';
  const parts: string[] = [];

  if (error.name) parts.push(`name=${error.name}`);
  if (error.message) parts.push(`message=${error.message}`);
  if (error.code) parts.push(`code=${error.code}`);
  if (error.status) parts.push(`status=${error.status}`);
  if (error.details) parts.push(`details=${error.details}`);
  if (error.hint) parts.push(`hint=${error.hint}`);

  return parts.length > 0 ? parts.join(', ') : 'unknown error';
};

const isTimeoutError = (error: any) =>
  error?.name === 'TimeoutError' ||
  (error?.message && String(error.message).toLowerCase().includes('timeout'));

const syncProfileFromSupabase = async (userId: string) => {
  const { data: profile = null } = await supabase
    .from('profiles')
    .select('*')
    .eq('id', userId)
    .maybeSingle();

  if (!profile || (!profile.full_name && !profile.first_name)) {
    return;
  }

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
};

/** Sync user data from Supabase into local Dexie DB on login */
const syncFromSupabase = async (userId: string) => {
  try {
    const timeouts = [12000, 30000];
    let lastError: any = null;

    for (let attempt = 0; attempt < timeouts.length; attempt += 1) {
      try {
        await fetchWithTimeout(Promise.all([
          syncUserDataFromCloud(userId),
          syncProfileFromSupabase(userId),
        ]), timeouts[attempt]);
        return;
      } catch (err) {
        lastError = err;
        if (isTimeoutError(err) && attempt < timeouts.length - 1) {
          console.info(`Supabase sync timed out after ${timeouts[attempt]}ms. Retrying...`);
          continue;
        }
        throw err;
      }
    }

    if (lastError) {
      throw lastError;
    }
  } catch (err) {
    // Non-blocking — app works offline with local DB data
    const errorDetails = formatSupabaseError(err);
    if (isNetworkError(err)) {
      // Supabase project is paused or unreachable — expected in offline/dev mode
      console.info(`ℹ️ Supabase unreachable — running on local data. (${errorDetails})`);
    } else {
      console.error('Supabase sync on login failed (non-blocking):', errorDetails, err);
    }
  }
};

/** Returns true if an error is a network/timeout fault (Supabase unreachable) */
const isNetworkError = (error: any): boolean =>
  error?.name === 'AbortError' ||
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
    let unsubscribeUserCloudSync: (() => void) | null = null;
    let subscribedUserId: string | null = null;

    initializeBackendSync();

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
        if (session?.user?.id) {
          await syncFromSupabase(session.user.id);
        }
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
            if (!unsubscribeUserCloudSync || subscribedUserId !== nextUser.id) {
              if (unsubscribeUserCloudSync) {
                unsubscribeUserCloudSync();
              }
              unsubscribeUserCloudSync = subscribeToUserCloudSync(nextUser.id);
              subscribedUserId = nextUser.id;
            }

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
                await runWithCloudSyncSuppressed(() => initializeDemoData(nextUser.email ?? undefined, nextUser.id));
              }
              initialSyncDone = true;
            }
          } else if (event === 'SIGNED_OUT') {
            if (unsubscribeUserCloudSync) {
              unsubscribeUserCloudSync();
              unsubscribeUserCloudSync = null;
            }
            subscribedUserId = null;
            // On logout, clear the stored user ID so the next login is treated
            // as a fresh start (even if same user logs back in).
            localStorage.removeItem('auth_last_user_id');
            permissionService.clearPermissions();
            await handleBackendLogout();
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
      if (unsubscribeUserCloudSync) {
        unsubscribeUserCloudSync();
      }
      subscribedUserId = null;
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
