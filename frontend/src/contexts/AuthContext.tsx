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
    // Also clear related localStorage flags
    localStorage.removeItem('admin_data_seeded_v2');
  } catch (err) {
    // Non-blocking — local DB clear is best-effort
    console.error('Failed to clear local DB on login:', err);
  }
};

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

    // Check active session
    const initAuth = async () => {
      try {
        const { data: { session } } = await supabase.auth.getSession();
        setSession(session);
        const nextUser = session?.user ?? null;
        setUser(nextUser);
        const userRole = resolveUserRole(nextUser);
        setRole(userRole);
        
        // Initialize permissions from backend with local role as fallback
        if (nextUser?.id) {
          await permissionService.fetchUserPermissions(nextUser.id, userRole);
        }
      } catch (error) {
        console.error('Error loading session:', error);
      } finally {
        setLoading(false);
      }
    };

    initAuth();

    // Listen for auth changes
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      async (event, session) => {
        setSession(session);
        const nextUser = session?.user ?? null;
        setUser(nextUser);
        const userRole = resolveUserRole(nextUser);
        setRole(userRole);
        setLoading(false);

        if (event === 'SIGNED_IN' && nextUser?.id) {
          // Clear previous user's local data first (data isolation)
          await clearLocalUserData();
          // Fetch permissions from server
          await permissionService.fetchUserPermissions(nextUser.id, userRole);
          // Seed demo data only for admin; regular users start with clean DB
          await initializeDemoData(nextUser.email ?? undefined, nextUser.id);
        } else if (event === 'SIGNED_OUT') {
          permissionService.clearPermissions();
          // Clear local DB on logout too
          await clearLocalUserData();
        }
      }
    );

    return () => {
      subscription.unsubscribe();
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
