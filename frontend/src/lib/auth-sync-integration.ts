import supabase from '@/utils/supabase/client';
import { db } from '@/lib/database';

function mapTransactionRecord(transaction: any) {
  return {
    type: transaction.type,
    amount: transaction.amount,
    description: transaction.description || '',
    category: transaction.category || 'Other',
    account_id: transaction.accountId,
    date: new Date(transaction.date).toISOString(),
  };
}

export function queueTransactionInsertSync(localId: number, transaction: any) {
  supabase.auth.getUser()
    .then(({ data: { user } }) => {
      if (!user) return;

      const record = {
        local_id: localId,
        ...mapTransactionRecord(transaction),
        user_id: user.id,
      };

      supabase.from('transactions').upsert([record], {
        onConflict: 'local_id,user_id',
        ignoreDuplicates: true,
      })
        .then(({ error }) => {
          if (!error) return;
          const code = String(error?.code ?? '');
          const msg = error?.message ?? '';
          if (code === '23503') {
            console.info('ℹ️ TX not synced: account not yet in remote DB');
          } else if (code === '23505' || code === '409' || msg.includes('duplicate')) {
            console.info('ℹ️ TX not synced: already exists in remote DB');
          } else {
            console.warn('⚠️ TX Supabase sync failed (non-blocking):', code, msg);
          }
        })
        .catch(() => {
          console.info('ℹ️ TX sync skipped: Supabase unreachable');
        });
    })
    .catch(() => {});
}

export function queueTransactionUpdateSync(localId: number, transaction: any) {
  supabase.auth.getUser()
    .then(({ data: { user } }) => {
      if (!user) return;

      supabase.from('transactions')
        .update(mapTransactionRecord(transaction))
        .eq('local_id', localId)
        .eq('user_id', user.id)
        .then(({ error }) => {
          if (!error) return;
          console.warn('⚠️ TX update sync failed (non-blocking):', error?.code, error?.message);
        })
        .catch(() => {
          console.info('ℹ️ TX update sync skipped: Supabase unreachable');
        });
    })
    .catch(() => {});
}

export function queueTransactionDeleteSync(localId: number) {
  supabase.auth.getUser()
    .then(({ data: { user } }) => {
      if (!user) return;

      supabase.from('transactions')
        .delete()
        .eq('local_id', localId)
        .eq('user_id', user.id)
        .then(({ error }) => {
          if (!error) return;
          console.warn('⚠️ TX delete sync failed (non-blocking):', error?.code, error?.message);
        })
        .catch(() => {
          console.info('ℹ️ TX delete sync skipped: Supabase unreachable');
        });
    })
    .catch(() => {});
}

/**
 * Call this after successful login
 * This syncs all user data from backend to local cache
 */
export async function handleLoginSuccess(userId: string, token: string) {
  // Now handled correctly by AuthContext's syncFromSupabase
}

/**
 * Call this on logout
 * This clears all local user data
 */
export async function handleLogout() {
  // Now handled correctly by AuthContext's clearLocalUserData
}

/**
 * For any new transaction, save to local DB and attempt Supabase sync.
 * Local save is ALWAYS guaranteed. Supabase sync is best-effort / non-blocking.
 */
export async function saveTransactionWithBackendSync(transaction: any) {
  try {
    // 1. Always save locally first — fast, works offline
    const dbTransaction = {
      ...transaction,
      createdAt: new Date(),
      updatedAt: new Date(),
    };
    const savedId = await db.transactions.add(dbTransaction);
    const savedTransaction = { ...dbTransaction, id: savedId, local_id: savedId };

    // 2. Background Supabase sync — fire-and-forget, NEVER blocks UI or throws
    queueTransactionInsertSync(savedId, transaction);

    return savedTransaction;
  } catch (error) {
    // Only local DB failures propagate
    console.error('❌ Failed to save transaction locally:', error);
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
      updatedAt: new Date(),
    };
    const savedId = await db.accounts.add(dbAccount);
    const savedAccount = { ...dbAccount, id: savedId, local_id: savedId };

    supabase.auth.getUser()
      .then(({ data: { user } }) => {
        if (!user) return;
        const record = {
          local_id: savedId,
          name: account.name,
          type: account.type,
          balance: account.balance || 0,
          currency: account.currency || 'INR',
          is_active: account.isActive ?? true,
          user_id: user.id,
        };
        supabase.from('accounts').insert([record])
          .then(({ error }) => {
            if (error) console.warn('⚠️ Account sync failed (non-blocking):', error?.code, error?.message);
          })
          .catch(() => console.info('ℹ️ Account sync skipped: Supabase unreachable'));
      })
      .catch(() => {});

    return savedAccount;
  } catch (error) {
    console.error('❌ Failed to save account locally:', error);
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
      updatedAt: new Date(),
    };
    const savedId = await db.goals.add(dbGoal);
    const savedGoal = { ...dbGoal, id: savedId, local_id: savedId };

    supabase.auth.getUser()
      .then(({ data: { user } }) => {
        if (!user) return;
        const record = {
          local_id: savedId,
          name: goal.name,
          target_amount: goal.targetAmount,
          current_amount: goal.currentAmount || 0,
          target_date: new Date(goal.targetDate).toISOString(),
          category: goal.category || 'other',
          is_group_goal: goal.isGroupGoal || false,
          user_id: user.id,
        };
        supabase.from('goals').insert([record])
          .then(({ error }) => {
            if (error) console.warn('⚠️ Goal sync failed (non-blocking):', error?.code, error?.message);
          })
          .catch(() => console.info('ℹ️ Goal sync skipped: Supabase unreachable'));
      })
      .catch(() => {});

    return savedGoal;
  } catch (error) {
    console.error('❌ Failed to save goal locally:', error);
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
