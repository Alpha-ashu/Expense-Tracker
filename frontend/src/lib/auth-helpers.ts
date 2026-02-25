// Unified Auth Helpers - Centralized authentication operations
import supabase from '@/utils/supabase/client';
import { handleLogout } from './auth-sync-integration';
import { db } from './database';
import { permissionService } from '@/services/permissionService';

/**
 * Unified signout function that handles all logout scenarios consistently.
 * NOTE: This app has no React Router — navigation uses window.location only.
 */
export async function unifiedSignOut(_navigate?: (path: string) => void): Promise<void> {
  try {
    console.log('🔐 Starting unified signout process...');

    // Step 1: Clear backend tokens and local cache
    await handleLogout();

    // Step 2: Sign out from Supabase (invalidates server-side session globally)
    await supabase.auth.signOut({ scope: 'global' });

    // Step 3: Clear permissions
    permissionService.clearPermissions();

    // Step 4: Manually remove all Supabase token keys
    Object.keys(localStorage)
      .filter(k => k.startsWith('sb-') || k === 'supabase.auth.token')
      .forEach(k => localStorage.removeItem(k));

    // Step 5: Clear all storage
    localStorage.clear();
    sessionStorage.clear();

    // Step 6: Delete local IndexedDB (non-blocking)
    try { window.indexedDB.deleteDatabase('FinanceLifeDB'); } catch { }

    console.log('✅ Unified signout completed successfully');

    // Step 7: Hard redirect with cache-bust — AuthContext skips session restore on ?logged_out=1
    window.location.replace(window.location.origin + '?logged_out=1');

  } catch (error) {
    console.error('❌ Unified signout failed:', error);
    // Force cleanup even on error
    try {
      localStorage.clear();
      sessionStorage.clear();
      window.indexedDB.deleteDatabase('FinanceLifeDB');
    } catch { }
    window.location.replace(window.location.origin + '?logged_out=1');
  }
}

/**
 * Legacy signout function for backward compatibility
 * This maintains the old behavior for Settings.tsx
 */
export async function legacySignOut(): Promise<void> {
  try {
    console.log('🔐 Starting legacy signout process...');

    // Sign out from Supabase
    const { error } = await supabase.auth.signOut();
    if (error) throw error;

    // Clear permissions
    permissionService.clearPermissions();

    // Clear all local storage
    localStorage.clear();
    sessionStorage.clear();

    // Delete local IndexedDB (non-blocking)
    try {
      window.indexedDB.deleteDatabase('FinanceLifeDB');
    } catch (err) {
      console.warn('Failed to delete IndexedDB:', err);
    }

    // Reload the page to ensure clean state
    window.location.href = window.location.origin + '/login';

    console.log('✅ Legacy signout completed successfully');
  } catch (error) {
    console.error('❌ Legacy signout failed:', error);

    // Force cleanup even if there's an error
    localStorage.clear();
    window.location.href = window.location.origin;
  }
}