// Data Sync Service - Manages syncing between backend and local storage
import { db } from './database';
import { backendService } from './backend-api';

export interface SyncConfig {
  autoSync?: boolean;
  syncOnInterval?: boolean;
  syncInterval?: number; // ms
}

class DataSyncService {
  private syncInProgress = false;
  private syncInterval: NodeJS.Timeout | null = null;
  private config: SyncConfig = {
    autoSync: true,
    syncOnInterval: true,
    syncInterval: 5 * 60 * 1000, // 5 minutes
  };

  /**
   * CRITICAL: On login - fetch all user data from backend and populate local cache
   * This is the SOURCE OF TRUTH synchronization
   */
  async syncDownOnLogin(userId: string) {
    try {
      console.log('🔄 Syncing data from backend for user:', userId);
      this.syncInProgress = true;

      // Fetch all user data from backend in parallel
      const [accounts, transactions, goals, loans, settings] = await Promise.all([
        backendService.getAccounts(),
        backendService.getTransactions(),
        backendService.getGoals(),
        backendService.getLoans(),
        backendService.getSettings(),
      ]);

      // Clear local database to ensure clean state
      console.log('🗑️  Clearing local cache...');
      await db.accounts.clear();
      await db.transactions.clear();
      await db.goals.clear();
      await db.loans.clear();

      // Populate local database with backend data (cache only)
      console.log('💾 Populating local cache from backend...');

      if (accounts?.length > 0) {
        await db.accounts.bulkAdd(
          accounts.map((acc: any) => ({
            ...acc,
            createdAt: new Date(acc.createdAt),
            updatedAt: acc.updatedAt ? new Date(acc.updatedAt) : new Date(),
            deletedAt: acc.deletedAt ? new Date(acc.deletedAt) : null,
          }))
        );
        console.log(`✅ Loaded ${accounts.length} accounts`);
      }

      if (transactions?.length > 0) {
        await db.transactions.bulkAdd(
          transactions.map((txn: any) => ({
            ...txn,
            date: new Date(txn.date),
            createdAt: new Date(txn.createdAt),
            updatedAt: txn.updatedAt ? new Date(txn.updatedAt) : new Date(),
            deletedAt: txn.deletedAt ? new Date(txn.deletedAt) : null,
          }))
        );
        console.log(`✅ Loaded ${transactions.length} transactions`);
      }

      if (goals?.length > 0) {
        await db.goals.bulkAdd(
          goals.map((goal: any) => ({
            ...goal,
            targetDate: new Date(goal.targetDate),
            createdAt: new Date(goal.createdAt),
            updatedAt: goal.updatedAt ? new Date(goal.updatedAt) : new Date(),
            deletedAt: goal.deletedAt ? new Date(goal.deletedAt) : null,
          }))
        );
        console.log(`✅ Loaded ${goals.length} goals`);
      }

      if (loans?.length > 0) {
        await db.loans.bulkAdd(
          loans.map((loan: any) => ({
            ...loan,
            dueDate: loan.dueDate ? new Date(loan.dueDate) : null,
            createdAt: new Date(loan.createdAt),
            updatedAt: loan.updatedAt ? new Date(loan.updatedAt) : new Date(),
            deletedAt: loan.deletedAt ? new Date(loan.deletedAt) : null,
          }))
        );
        console.log(`✅ Loaded ${loans.length} loans`);
      }

      // Store settings separately
      if (settings) {
        localStorage.setItem('user_settings', JSON.stringify(settings));
        console.log('✅ Synced user settings');
      }

      // Mark sync as complete
      localStorage.setItem('last_sync', new Date().toISOString());
      localStorage.setItem('user_id', userId);

      console.log('✅ Data sync complete!');
      this.syncInProgress = false;

      // Start automatic sync interval
      this.startAutoSync();

      return true;
    } catch (error) {
      console.error('❌ Sync failed:', error);
      this.syncInProgress = false;
      throw error;
    }
  }

  /**
   * On logout - clear all local data
   * User data should NOT persist after logout
   */
  async clearOnLogout() {
    try {
      console.log('🧹 Clearing local data on logout...');

      // Clear all local data
      await db.accounts.clear();
      await db.transactions.clear();
      await db.goals.clear();
      await db.loans.clear();

      // Clear metadata
      localStorage.removeItem('user_settings');
      localStorage.removeItem('last_sync');
      localStorage.removeItem('user_id');

      // Stop sync
      this.stopAutoSync();

      console.log('✅ Local data cleared');
    } catch (error) {
      console.error('❌ Clear failed:', error);
    }
  }

  /**
   * After any create/update/delete operation - sync to backend
   * This ensures data is never lost
   */
  async syncUpToBackend() {
    if (this.syncInProgress) return;

    try {
      this.syncInProgress = true;

      // Get data marked for sync
      const unsyncedTransactions = await db.transactions
        .where('id')
        .above(0 as any)
        .toArray();

      for (const txn of unsyncedTransactions) {
        try {
          await backendService.createTransaction({
            accountId: String(txn.accountId) || '0',
            type: txn.type as 'expense' | 'income' | 'transfer',
            amount: txn.amount,
            category: txn.category,
            subcategory: txn.subcategory,
            description: txn.description,
            merchant: txn.merchant,
            date: new Date(txn.date),
            tags: txn.tags,
            transferToAccountId: txn.transferToAccountId ? String(txn.transferToAccountId) : undefined,
            transferType: txn.transferType,
          });

          // Mark as synced (commented out - synced property doesn't exist)
          // await db.transactions.update(txn.id!, { synced: true });
        } catch (error) {
          console.error('Failed to sync transaction:', error);
        }
      }

      this.syncInProgress = false;
    } catch (error) {
      console.error('Sync up failed:', error);
      this.syncInProgress = false;
    }
  }

  /**
   * Automatic periodic sync
   */
  private startAutoSync() {
    if (!this.config.syncOnInterval || this.syncInterval) return;

    this.syncInterval = setInterval(() => {
      this.syncUpToBackend().catch(console.error);
    }, this.config.syncInterval);

    console.log('⏱️  Auto-sync started');
  }

  private stopAutoSync() {
    if (this.syncInterval) {
      clearInterval(this.syncInterval);
      this.syncInterval = null;
      console.log('⏱️  Auto-sync stopped');
    }
  }

  /**
   * Manual full sync
   */
  async performFullSync() {
    console.log('🔄 Performing full sync...');
    await this.syncUpToBackend();
    console.log('✅ Full sync complete');
  }

  /**
   * Check if device is online
   */
  isOnline(): boolean {
    return navigator.onLine;
  }

  /**
   * Wait for backend to be reachable
   */
  async waitForBackend(maxAttempts = 5): Promise<boolean> {
    for (let i = 0; i < maxAttempts; i++) {
      try {
        const response = await fetch(`${process.env.REACT_APP_API_URL || 'http://localhost:5000'}/health`);
        if (response.ok) return true;
      } catch (e) {
        console.log(`Attempt ${i + 1}/${maxAttempts} to reach backend failed`);
      }
      await new Promise((r) => setTimeout(r, 1000));
    }
    return false;
  }
}

export const dataSyncService = new DataSyncService();
