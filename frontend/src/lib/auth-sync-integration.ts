// Updated Auth Context integration guide for backend sync
// This shows how to integrate dataSyncService into your authentication flow

import { dataSyncService } from '@/lib/data-sync';
import { backendService } from '@/lib/backend-api';

/**
 * Call this after successful login
 * This syncs all user data from backend to local cache
 */
export async function handleLoginSuccess(userId: string, token: string) {
  console.log('🔓 Login successful for user:', userId);

  // 1. Set the token in backend service for all API calls
  backendService.setToken(token);

  // 2. Sync all backend data to local cache
  try {
    await dataSyncService.syncDownOnLogin(userId);
    console.log('✅ All data synced from backend');
  } catch (error) {
    console.error('⚠️  Initial sync failed, but continuing with cached data:', error);
  }

  // Note: User will see cached data if sync fails, which is better than no data
}

/**
 * Call this on logout
 * This clears all local user data
 */
export async function handleLogout() {
  console.log('🔐 User logging out');

  // 1. Clear token
  backendService.clearToken();

  // 2. Clear all local data
  await dataSyncService.clearOnLogout();

  console.log('✅ Local data cleared on logout');
}

/**
 * For any new transaction, call this instead of directly saving to local db
 * This ensures data is saved to backend (source of truth) first
 */
export async function saveTransactionWithBackendSync(transaction: any) {
  try {
    // 1. Save to backend first (source of truth)
    const savedTransaction = await backendService.createTransaction(transaction);
    console.log('✅ Transaction saved to backend:', savedTransaction.id);

    // 2. Update local cache (optional - can refresh on next sync)
    // const { db } = await import('@/lib/database');
    // await db.transactions.add({
    //   ...savedTransaction,
    //   synced: true,
    // });

    return savedTransaction;
  } catch (error) {
    console.error('❌ Failed to save transaction:', error);
    throw error;
  }
}

/**
 * For any new account, call this
 */
export async function saveAccountWithBackendSync(account: any) {
  try {
    const savedAccount = await backendService.createAccount(account);
    console.log('✅ Account saved to backend:', savedAccount.id);
    return savedAccount;
  } catch (error) {
    console.error('❌ Failed to save account:', error);
    throw error;
  }
}

/**
 * For any new goal, call this
 */
export async function saveGoalWithBackendSync(goal: any) {
  try {
    const savedGoal = await backendService.createGoal(goal);
    console.log('✅ Goal saved to backend:', savedGoal.id);
    return savedGoal;
  } catch (error) {
    console.error('❌ Failed to save goal:', error);
    throw error;
  }
}

/**
 * Check backend connectivity
 */
export async function checkBackendConnectivity(): Promise<boolean> {
  return dataSyncService.waitForBackend();
}
