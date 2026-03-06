import supabase from '@/utils/supabase/client';
import { db } from '@/lib/database';

/**
 * Call this after successful login
 * This syncs all user data from backend to local cache
 */
export async function handleLoginSuccess(userId: string, token: string) {
  // Now handled correctly by AuthContext's syncFromSupabase
  console.log('🔓 Login successful for user:', userId);
}

/**
 * Call this on logout
 * This clears all local user data
 */
export async function handleLogout() {
  // Now handled correctly by AuthContext's clearLocalUserData
  console.log('🔐 User logging out');
}

/**
 * For any new transaction, save to local DB and Supabase
 */
export async function saveTransactionWithBackendSync(transaction: any) {
  try {
    // 1. Always save locally first for fast UI response
    const dbTransaction = {
      ...transaction,
      createdAt: new Date(),
      updatedAt: new Date()
    };
    const savedId = await db.transactions.add(dbTransaction);
    const savedTransaction = { ...dbTransaction, id: savedId, local_id: savedId };

    // 2. Try to save to Supabase directly if user is logged in
    const { data: { user } } = await supabase.auth.getUser();
    if (user) {
      const record = {
        local_id: savedId,
        type: transaction.type,
        amount: transaction.amount,
        description: transaction.description || '',
        category: transaction.category || 'Other',
        account_id: transaction.accountId,
        date: new Date(transaction.date).toISOString(),
        user_id: user.id
      };
      
      // Fire and forget, don't block
      supabase.from('transactions').insert([record])
        .then(({ error }) => {
           if (error) console.error('Supabase sync failed (non-blocking):', error)
        })
        .catch(err => console.error('Supabase sync error (non-blocking):', err));
    }

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
    const dbAccount = {
      ...account,
      createdAt: new Date(),
      updatedAt: new Date()
    };
    
    const savedId = await db.accounts.add(dbAccount);
    const savedAccount = { ...dbAccount, id: savedId, local_id: savedId };

    const { data: { user } } = await supabase.auth.getUser();
    if (user) {
      const record = {
        local_id: savedId,
        name: account.name,
        type: account.type,
        balance: account.balance || 0,
        currency: account.currency || 'INR',
        is_active: account.isActive ?? true,
        user_id: user.id
      };
      
      supabase.from('accounts').insert([record])
        .then(({ error }) => {
           if (error) console.error('Supabase sync failed:', error)
        })
        .catch(err => console.error('Supabase sync error:', err));
    }

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
    const dbGoal = {
      ...goal,
      createdAt: new Date(),
      updatedAt: new Date()
    };
    
    const savedId = await db.goals.add(dbGoal);
    const savedGoal = { ...dbGoal, id: savedId, local_id: savedId };

    const { data: { user } } = await supabase.auth.getUser();
    if (user) {
      const record = {
        local_id: savedId,
        name: goal.name,
        target_amount: goal.targetAmount,
        current_amount: goal.currentAmount || 0,
        target_date: new Date(goal.targetDate).toISOString(),
        category: goal.category || 'other',
        is_group_goal: goal.isGroupGoal || false,
        user_id: user.id
      };
      
      supabase.from('goals').insert([record])
        .then(({ error }) => {
           if (error) console.error('Supabase sync failed:', error)
        })
        .catch(err => console.error('Supabase sync error:', err));
    }

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
  const { data: { session } } = await supabase.auth.getSession();
  return !!session;
}
