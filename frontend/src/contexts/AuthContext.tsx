import React, { createContext, useContext, useState, useEffect, ReactNode, useRef } from 'react';
import { User, Session } from '@supabase/supabase-js';
import supabase from '@/utils/supabase/client';
import { UserRole } from '@/lib/featureFlags';
import { permissionService } from '@/services/permissionService';
import { db } from '@/lib/database';
import { resolveAvatarSelection } from '@/lib/avatar-gallery';
import { api } from '@/lib/api';
import {
  handleLogout as handleBackendLogout,
  initializeBackendSync,
  runWithCloudSyncSuppressed,
  subscribeToUserCloudSync,
  syncUserDataFromCloud,
} from '@/lib/auth-sync-integration';
import { shouldSkipOptionalBackendRequests } from '@/lib/apiBase';

interface AuthContextType {
  user: User | null;
  session: Session | null;
  loading: boolean;
  role: UserRole;
  dataReady: boolean;
  dataSyncing: boolean;
  dataSyncError: string | null;
  triggerDataSync: () => Promise<void>;
  signOut: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

type LocalProfile = {
  displayName?: string;
  firstName?: string;
  lastName?: string;
  mobile?: string;
  dateOfBirth?: string;
  jobType?: string;
  salary?: string | number;
  monthlyIncome?: number;
  profilePhoto?: string;
  avatarUrl?: string;
  avatarId?: string;
  country?: string;
  language?: string;
  createdAt?: string;
  updatedAt?: string;
};

const PROFILE_SYNC_COOLDOWN_MS = 60_000;
const profileSyncInFlight = new Map<string, Promise<void>>();
const profileSyncCooldownUntil = new Map<string, number>();
const profileSyncLastPayload = new Map<string, string>();

const parseNumber = (value: unknown): number | undefined => {
  if (value === null || value === undefined || value === '') return undefined;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : undefined;
};

const readLocalProfile = (): LocalProfile | null => {
  try {
    const raw = localStorage.getItem('user_profile');
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    return parsed && typeof parsed === 'object' ? (parsed as LocalProfile) : null;
  } catch {
    return null;
  }
};

const getLocalProfileUpdatedAt = (profile: LocalProfile | null): string | null => {
  return (
    profile?.updatedAt ||
    localStorage.getItem('profile_updated_at') ||
    profile?.createdAt ||
    localStorage.getItem('user_setup_date') ||
    localStorage.getItem('onboarding_date')
  );
};

const hasPendingLocalProfileSync = (): boolean =>
  localStorage.getItem('profile_sync_pending') === 'true';

const toEpoch = (value?: string | null): number | null => {
  if (!value) return null;
  const ts = Date.parse(value);
  return Number.isNaN(ts) ? null : ts;
};

const isAfter = (left?: string | null, right?: string | null): boolean => {
  const l = toEpoch(left);
  const r = toEpoch(right);
  if (l === null || r === null) return false;
  return l > r;
};

const hasLocalProfileData = (profile: LocalProfile | null): boolean => {
  if (!profile) return false;
  return Boolean(
    profile.displayName ||
    profile.firstName ||
    profile.lastName ||
    profile.mobile ||
    profile.dateOfBirth ||
    profile.jobType ||
    profile.salary ||
    profile.monthlyIncome ||
    profile.profilePhoto ||
    profile.avatarUrl ||
    profile.avatarId
  );
};

/**
 * Start from a non-privileged role locally. Profile-based permissions are
 * fetched separately so admin/advisor capabilities come from backend-backed
 * profile data instead of client-visible auth metadata.
 */
const resolveUserRole = (_user: User | null): UserRole => 'user';

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

const syncProfileFromBackend = async (user: User) => {
  const cooldownUntil = profileSyncCooldownUntil.get(user.id) ?? 0;
  if (cooldownUntil > Date.now()) {
    return;
  }

  const existingSync = profileSyncInFlight.get(user.id);
  if (existingSync) {
    await existingSync;
    return;
  }

  const run = async () => {
  // SECURITY FIX (Bug #1): Route through backend API instead of direct Supabase call
    let profile: any = null;
    try {
      const response = await api.auth.getProfile();
      profile = response.success ? response.data : null;
    } catch (err) {
      console.warn('Failed to fetch profile from backend:', err);
    }

    let localProfile = readLocalProfile();
    const localUpdatedAt = getLocalProfileUpdatedAt(localProfile);

    if (localProfile) {
      const resolvedAvatar = resolveAvatarSelection({
        avatarId: localProfile.avatarId,
        avatarUrl: localProfile.profilePhoto || localProfile.avatarUrl || null,
      });
      if (
        resolvedAvatar.url !== localProfile.profilePhoto ||
        resolvedAvatar.url !== localProfile.avatarUrl ||
        resolvedAvatar.id !== localProfile.avatarId
      ) {
        const patched = {
          ...localProfile,
          profilePhoto: resolvedAvatar.url,
          avatarUrl: resolvedAvatar.url,
          avatarId: resolvedAvatar.id,
        };
        localStorage.setItem('user_profile', JSON.stringify(patched));
        localProfile = patched;
      }
    }

    const pendingLocalSync = hasPendingLocalProfileSync();

    const hasRealProfile = profile && (
      profile.full_name ||
      profile.first_name ||
      profile.last_name ||
      profile.phone ||
      profile.date_of_birth ||
      profile.job_type ||
      profile.monthly_income ||
      profile.annual_income ||
      profile.avatar_url
    );

    const remoteUpdatedAt = profile?.updated_at || null;
    const remoteIsNewer = !!(remoteUpdatedAt && localUpdatedAt && isAfter(remoteUpdatedAt, localUpdatedAt));

    const writeLocalFromRemote = () => {
      const remoteFirstName = profile.first_name || '';
      const remoteLastName = profile.last_name || '';
      const remoteFullName = profile.full_name || `${remoteFirstName} ${remoteLastName}`.trim();
      const fallbackDisplayName = localProfile?.displayName ||
        `${localProfile?.firstName || ''} ${localProfile?.lastName || ''}`.trim();
      const displayName = remoteFullName || fallbackDisplayName;
      const nameParts = displayName.split(/\s+/).filter(Boolean);
      const firstName = remoteFirstName || localProfile?.firstName || nameParts[0] || '';
      const lastName = remoteLastName || localProfile?.lastName || nameParts.slice(1).join(' ') || '';
      const monthlyIncome = profile.monthly_income || (profile.annual_income ? Math.round(profile.annual_income / 12) : 0);
      const updatedAt = remoteUpdatedAt || new Date().toISOString();
      const resolvedAvatar = resolveAvatarSelection({
        avatarUrl: profile.avatar_url || null,
        avatarId: (profile as any)?.avatar_id || null,
      });

      localStorage.setItem('onboarding_completed', 'true');
      localStorage.setItem('profile_updated_at', updatedAt);
      localStorage.setItem('user_profile', JSON.stringify({
        ...localProfile,
        displayName,
        firstName,
        lastName,
        mobile: profile.phone || '',
        dateOfBirth: profile.date_of_birth || '',
        jobType: profile.job_type || '',
        salary: ((profile.annual_income || (monthlyIncome * 12)) || 0).toString(),
        monthlyIncome,
        profilePhoto: resolvedAvatar.url,
        avatarUrl: resolvedAvatar.url,
        avatarId: resolvedAvatar.id,
        updatedAt,
      }));
    };

    if (hasRealProfile) {
      const shouldUseRemote =
        (!pendingLocalSync &&
          (!localUpdatedAt || (remoteUpdatedAt && !isAfter(localUpdatedAt, remoteUpdatedAt)))) ||
        (pendingLocalSync && remoteIsNewer);

      if (shouldUseRemote) {
        writeLocalFromRemote();
        localStorage.removeItem('profile_sync_pending');
        return;
      }
    }

    if (!hasLocalProfileData(localProfile)) {
      return;
    }

    const displayName = (localProfile?.displayName || `${localProfile?.firstName || ''} ${localProfile?.lastName || ''}`.trim()).trim();
    const nameParts = displayName.split(/\s+/).filter(Boolean);
    const firstName = localProfile?.firstName || nameParts[0] || '';
    const lastName = localProfile?.lastName || nameParts.slice(1).join(' ') || '';
    const salaryNumber = parseNumber(localProfile?.salary);
    let monthlyIncome = parseNumber(localProfile?.monthlyIncome);
    if (monthlyIncome === undefined && salaryNumber !== undefined) {
      monthlyIncome = Math.round(salaryNumber / 12);
    }
    const annualIncome = salaryNumber ?? (monthlyIncome !== undefined ? Math.round(monthlyIncome * 12) : undefined);
    const resolvedAvatar = resolveAvatarSelection({
      avatarId: localProfile?.avatarId || null,
      avatarUrl: localProfile?.profilePhoto || localProfile?.avatarUrl || null,
    });

    const profilePayload = {
      full_name: displayName || null,
      first_name: firstName || null,
      last_name: lastName || null,
      phone: localProfile?.mobile || null,
      date_of_birth: localProfile?.dateOfBirth || null,
      job_type: localProfile?.jobType || null,
      monthly_income: monthlyIncome ?? null,
      annual_income: annualIncome ?? null,
      avatar_url: resolvedAvatar.url,
    };

    const payloadKey = JSON.stringify(profilePayload);
    if (profileSyncLastPayload.get(user.id) === payloadKey && pendingLocalSync) {
      return;
    }

    try {
      const response = await api.auth.updateProfile(profilePayload);

      if (response.success) {
        profileSyncLastPayload.set(user.id, payloadKey);
        localStorage.setItem('onboarding_completed', 'true');
        localStorage.setItem('profile_updated_at', new Date().toISOString());
        localStorage.removeItem('profile_sync_pending');
        profileSyncCooldownUntil.delete(user.id);
      } else {
        console.warn('Profile sync to backend failed (local cache retained):', response.message);
        localStorage.setItem('profile_sync_pending', 'true');
      }
    } catch (error: any) {
      if (typeof error?.status === 'number' && error.status === 429) {
        profileSyncCooldownUntil.set(user.id, Date.now() + PROFILE_SYNC_COOLDOWN_MS);
      }
      console.warn('Local profile sync to backend failed (non-blocking):', error);
      localStorage.setItem('profile_sync_pending', 'true');
    }
  };

  const promise = run().finally(() => {
    profileSyncInFlight.delete(user.id);
  });
  profileSyncInFlight.set(user.id, promise);
  await promise;
};

/** Sync user data from Supabase into local Dexie DB on login */
const syncFromSupabase = async (user: User) => {
  try {
    if (shouldSkipOptionalBackendRequests()) {
      await syncProfileFromBackend(user);
      return;
    }

    const timeouts = [12000, 30000];
    let lastError: any = null;

    for (let attempt = 0; attempt < timeouts.length; attempt += 1) {
      try {
        await fetchWithTimeout(Promise.all([
          syncUserDataFromCloud(user.id),
          syncProfileFromBackend(user),
        ]), timeouts[attempt]);
        return;
      } catch (err) {
        lastError = err;
        if (isTimeoutError(err) && shouldSkipOptionalBackendRequests()) {
          console.info(`Supabase sync skipped while backend is in degraded mode after ${timeouts[attempt]}ms.`);
          return;
        }
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
  const [dataReady, setDataReady] = useState(false);
  const [dataSyncing, setDataSyncing] = useState(false);
  const [dataSyncError, setDataSyncError] = useState<string | null>(null);
  const activeSyncUserId = useRef<string | null>(null);

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
        const provisionalRole = resolveUserRole(session?.user ?? null);
        setRole(provisionalRole);
        if (session?.user?.id) {
          activeSyncUserId.current = session.user.id;
          setDataSyncing(true);
          setDataSyncError(null);
          void (async () => {
            try {
              const permissions = await permissionService.fetchUserPermissions(session.user.id, provisionalRole);
              if (activeSyncUserId.current === session.user.id) {
                setRole(permissions.role);
              }
              await syncFromSupabase(session.user);
              if (activeSyncUserId.current === session.user.id) {
                setDataReady(true);
              }
            } catch (err) {
              if (activeSyncUserId.current === session.user.id) {
                setDataSyncError(formatSupabaseError(err));
                setDataReady(true);
              }
            } finally {
              if (activeSyncUserId.current === session.user.id) {
                setDataSyncing(false);
              }
            }
          })();
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
        const provisionalRole = resolveUserRole(nextUser);
        setRole(provisionalRole);

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
              activeSyncUserId.current = nextUser.id;
              setDataReady(false);
              setDataSyncing(true);
              setDataSyncError(null);

              const lastUserId = localStorage.getItem('auth_last_user_id');
              const isUserSwitch = lastUserId && lastUserId !== nextUser.id;

              if (isUserSwitch) {
                // Different user logged in — clear previous user's local data
                await clearLocalUserData();
              }

              // Always record the current user so we can detect future switches
              localStorage.setItem('auth_last_user_id', nextUser.id);

              // Run cloud sync + permissions in background to avoid blocking initial render
              void (async () => {
                try {
                  const permissions = await permissionService.fetchUserPermissions(nextUser.id, provisionalRole);
                  if (activeSyncUserId.current === nextUser.id) {
                    setRole(permissions.role);
                  }
                  await syncFromSupabase(nextUser);
                  if (activeSyncUserId.current === nextUser.id) {
                    setDataReady(true);
                  }
                } catch (syncError) {
                  console.warn('Background sync failed (non-blocking):', syncError);
                  if (activeSyncUserId.current === nextUser.id) {
                    setDataSyncError(formatSupabaseError(syncError));
                    setDataReady(true);
                  }
                } finally {
                  if (activeSyncUserId.current === nextUser.id) {
                    setDataSyncing(false);
                  }
                  initialSyncDone = true;
                }
              })();
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
            activeSyncUserId.current = null;
            setDataReady(false);
            setDataSyncing(false);
            setDataSyncError(null);
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

  const triggerDataSync = async () => {
    if (!user?.id || dataSyncing) {
      return;
    }

    const targetUserId = user.id;
    activeSyncUserId.current = targetUserId;
    setDataSyncing(true);
    setDataSyncError(null);

    try {
      const permissions = await permissionService.fetchUserPermissions(targetUserId, resolveUserRole(user));
      setRole(permissions.role);
      await syncFromSupabase(user);
      if (activeSyncUserId.current === targetUserId) {
        setDataReady(true);
      }
    } catch (err) {
      if (activeSyncUserId.current === targetUserId) {
        setDataSyncError(formatSupabaseError(err));
        setDataReady(true);
      }
    } finally {
      if (activeSyncUserId.current === targetUserId) {
        setDataSyncing(false);
      }
    }
  };

  return (
    <AuthContext.Provider value={{ user, session, loading, role, dataReady, dataSyncing, dataSyncError, triggerDataSync, signOut }}>
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
