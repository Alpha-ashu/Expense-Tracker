import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { User, Session } from '@supabase/supabase-js';
import supabase from '@/utils/supabase/client';
import { toast } from 'sonner';
import { UserRole } from '@/lib/featureFlags';
import { isAdminEmail } from '@/lib/rbac';

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
 * Resolve user role with strict admin email validation
 * Admin role is ONLY for shaik.job.details@gmail.com
 */
const resolveUserRole = (user: User | null): UserRole => {
  if (!user) return 'user';

  const email = (user.email || '').toLowerCase().trim();
  
  // Direct admin email check
  const adminEmails = ['shaik.job.details@gmail.com'];
  
  console.log('🔍 Role check for email:', { 
    email, 
    isAdmin: adminEmails.includes(email),
    adminEmails 
  });
  
  if (adminEmails.includes(email)) {
    console.log('🔐 Admin role assigned to:', email);
    return 'admin';
  }

  // Check for advisor role
  if (advisorEmails.includes(email)) {
    console.log('👔 Advisor role assigned to:', email);
    return 'advisor';
  }

  // Check user metadata as fallback (but NOT for admin - that's always email-based)
  const metadataRole = user.user_metadata?.role;
  if (metadataRole === 'advisor') {
    console.log('👔 Advisor role assigned via metadata:', email);
    return 'advisor';
  }

  console.log('👤 User role assigned to:', email);
  return 'user';
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
        setRole(resolveUserRole(nextUser));
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
        console.log('Auth state changed:', event);
        setSession(session);
        const nextUser = session?.user ?? null;
        setUser(nextUser);
        setRole(resolveUserRole(nextUser));
        setLoading(false);
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
