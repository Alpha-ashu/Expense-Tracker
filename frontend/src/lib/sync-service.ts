/**
 * Sync Service - Local-first data synchronization
 * 
 * This service handles:
 * - Local data storage (IndexedDB via Dexie)
 * - Cloud sync when online and verified
 * - Conflict resolution using timestamps
 * - Offline queue for pending operations
 */

import { db } from './database';
import supabase from '@/utils/supabase/client';
import { toast } from 'sonner';

// Sync status types
export type SyncStatus = 'synced' | 'pending' | 'conflict' | 'offline';

// Sync queue item
interface SyncQueueItem {
  id?: number;
  table: string;
  operation: 'create' | 'update' | 'delete';
  data: any;
  timestamp: Date;
  retries: number;
}

// Sync configuration
const SYNC_CONFIG = {
  maxRetries: 3,
  retryDelay: 5000, // 5 seconds
  batchSize: 50,
  syncInterval: 30000, // 30 seconds
};

class SyncService {
  private isOnline: boolean = navigator.onLine;
  private isSyncing: boolean = false;
  private syncIntervalId: NodeJS.Timeout | null = null;
  private listeners: Set<(status: SyncStatus) => void> = new Set();

  constructor() {
    this.setupNetworkListeners();
    this.setupVisibilityListener();
  }

  // Check if sync is allowed
  canSync(): boolean {
    const emailVerified = localStorage.getItem('email_verified') === 'true';
    const userStatus = localStorage.getItem('user_status');
    const isVerified = userStatus === 'verified' || emailVerified;
    
    return this.isOnline && isVerified;
  }

  // Network listeners
  private setupNetworkListeners() {
    window.addEventListener('online', () => {
      this.isOnline = true;
      toast.success('Back online! Syncing data...');
      this.syncAll();
    });

    window.addEventListener('offline', () => {
      this.isOnline = false;
      toast.warning('You are offline. Changes will sync when reconnected.');
      this.notifyListeners('offline');
    });
  }

  // Sync when app becomes visible
  private setupVisibilityListener() {
    document.addEventListener('visibilitychange', () => {
      if (document.visibilityState === 'visible' && this.canSync()) {
        this.syncAll();
      }
    });
  }

  // Start periodic sync
  startPeriodicSync() {
    if (this.syncIntervalId) return;
    
    this.syncIntervalId = setInterval(() => {
      if (this.canSync()) {
        this.syncAll();
      }
    }, SYNC_CONFIG.syncInterval);
  }

  // Stop periodic sync
  stopPeriodicSync() {
    if (this.syncIntervalId) {
      clearInterval(this.syncIntervalId);
      this.syncIntervalId = null;
    }
  }

  // Subscribe to sync status changes
  subscribe(callback: (status: SyncStatus) => void): () => void {
    this.listeners.add(callback);
    return () => this.listeners.delete(callback);
  }

  // Notify all listeners
  private notifyListeners(status: SyncStatus) {
    this.listeners.forEach(callback => callback(status));
  }

  // Main sync function
  async syncAll(): Promise<void> {
    if (this.isSyncing || !this.canSync()) return;
    
    this.isSyncing = true;
    this.notifyListeners('pending');

    try {
      // Process pending operations
      await this.processSyncQueue();
      
      // Pull latest data from cloud
      await this.pullFromCloud();
      
      this.notifyListeners('synced');
    } catch (error) {
      console.error('Sync failed:', error);
      this.notifyListeners('conflict');
    } finally {
      this.isSyncing = false;
    }
  }

  // Add operation to sync queue
  async addToQueue(table: string, operation: 'create' | 'update' | 'delete', data: any): Promise<void> {
    const queueItem: SyncQueueItem = {
      table,
      operation,
      data,
      timestamp: new Date(),
      retries: 0,
    };

    // Store in local queue
    await this.storeQueueItem(queueItem);

    // Try to sync immediately if online
    if (this.canSync()) {
      this.syncAll();
    }
  }

  // Store queue item in IndexedDB
  private async storeQueueItem(item: SyncQueueItem): Promise<void> {
    // Using a separate store for sync queue
    const queueData = JSON.parse(localStorage.getItem('sync_queue') || '[]');
    queueData.push({ ...item, id: Date.now() });
    localStorage.setItem('sync_queue', JSON.stringify(queueData));
  }

  // Get pending items from queue
  private getQueueItems(): SyncQueueItem[] {
    return JSON.parse(localStorage.getItem('sync_queue') || '[]');
  }

  // Process sync queue
  private async processSyncQueue(): Promise<void> {
    const queue = this.getQueueItems();
    if (queue.length === 0) return;

    const processedIds: number[] = [];
    const failedItems: SyncQueueItem[] = [];

    for (const item of queue) {
      try {
        await this.syncItem(item);
        if (item.id) processedIds.push(item.id);
      } catch (error) {
        console.error('Failed to sync item:', item, error);
        if (item.retries < SYNC_CONFIG.maxRetries) {
          failedItems.push({ ...item, retries: item.retries + 1 });
        }
      }
    }

    // Update queue - remove processed, keep failed
    const remainingQueue = queue.filter(
      item => !processedIds.includes(item.id!) || failedItems.some(f => f.id === item.id)
    );
    localStorage.setItem('sync_queue', JSON.stringify(remainingQueue));
  }

  // Sync individual item
  private async syncItem(item: SyncQueueItem): Promise<void> {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) throw new Error('Not authenticated');

    const tableName = this.getSupabaseTableName(item.table);
    const recordData = {
      ...item.data,
      user_id: user.id,
      updated_at: new Date().toISOString(),
    };

    switch (item.operation) {
      case 'create':
        await supabase.from(tableName).insert(recordData);
        break;
      case 'update':
        await supabase
          .from(tableName)
          .update(recordData)
          .eq('id', item.data.id)
          .eq('user_id', user.id);
        break;
      case 'delete':
        await supabase
          .from(tableName)
          .delete()
          .eq('id', item.data.id)
          .eq('user_id', user.id);
        break;
    }
  }

  // Pull latest data from cloud
  private async pullFromCloud(): Promise<void> {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;

    // Sync each table
    const tables = ['accounts', 'transactions', 'goals', 'loans', 'investments'];
    
    for (const table of tables) {
      try {
        const { data, error } = await supabase
          .from(this.getSupabaseTableName(table))
          .select('*')
          .eq('user_id', user.id)
          .order('updated_at', { ascending: false });

        if (error) throw error;

        // Merge with local data
        await this.mergeData(table, data || []);
      } catch (error) {
        console.error(`Failed to pull ${table}:`, error);
      }
    }
  }

  // Merge cloud data with local data
  private async mergeData(table: string, cloudData: any[]): Promise<void> {
    for (const cloudRecord of cloudData) {
      try {
        const localRecord = await this.getLocalRecord(table, cloudRecord.id);
        
        if (!localRecord) {
          // New record from cloud - add to local
          await this.insertLocalRecord(table, cloudRecord);
        } else {
          // Compare timestamps and keep newer
          const localTime = new Date(localRecord.updatedAt || localRecord.created_at || 0).getTime();
          const cloudTime = new Date(cloudRecord.updated_at || 0).getTime();
          
          if (cloudTime > localTime) {
            // Cloud is newer - update local
            await this.updateLocalRecord(table, cloudRecord);
          }
          // If local is newer, it will be pushed in processSyncQueue
        }
      } catch (error) {
        console.error('Failed to merge record:', error);
      }
    }
  }

  // Get local record by ID
  private async getLocalRecord(table: string, id: number): Promise<any> {
    const tableMap: Record<string, any> = {
      accounts: db.accounts,
      transactions: db.transactions,
      goals: db.goals,
      loans: db.loans,
      investments: db.investments,
    };

    const dexieTable = tableMap[table];
    if (!dexieTable) return null;

    return dexieTable.where('cloud_id').equals(id).first();
  }

  // Insert record to local DB
  private async insertLocalRecord(table: string, record: any): Promise<void> {
    const tableMap: Record<string, any> = {
      accounts: db.accounts,
      transactions: db.transactions,
      goals: db.goals,
      loans: db.loans,
      investments: db.investments,
    };

    const dexieTable = tableMap[table];
    if (!dexieTable) return;

    const localRecord = {
      ...this.mapCloudToLocal(table, record),
      cloud_id: record.id,
      synced: true,
    };

    await dexieTable.add(localRecord);
  }

  // Update local record
  private async updateLocalRecord(table: string, record: any): Promise<void> {
    const tableMap: Record<string, any> = {
      accounts: db.accounts,
      transactions: db.transactions,
      goals: db.goals,
      loans: db.loans,
      investments: db.investments,
    };

    const dexieTable = tableMap[table];
    if (!dexieTable) return;

    const localRecord = await this.getLocalRecord(table, record.id);
    if (localRecord) {
      await dexieTable.update(localRecord.id, {
        ...this.mapCloudToLocal(table, record),
        synced: true,
        updatedAt: new Date(),
      });
    }
  }

  // Map cloud record to local format
  private mapCloudToLocal(table: string, record: any): any {
    const baseMapping = {
      createdAt: new Date(record.created_at),
      updatedAt: new Date(record.updated_at),
    };

    switch (table) {
      case 'accounts':
        return {
          ...baseMapping,
          name: record.name,
          type: record.type,
          balance: record.balance,
          currency: record.currency || 'INR',
          isActive: record.is_active ?? true,
        };
      case 'transactions':
        return {
          ...baseMapping,
          type: record.type,
          amount: record.amount,
          accountId: record.account_id,
          category: record.category,
          description: record.description,
          date: new Date(record.date),
        };
      case 'goals':
        return {
          ...baseMapping,
          name: record.name,
          targetAmount: record.target_amount,
          currentAmount: record.current_amount,
          targetDate: new Date(record.target_date),
          category: record.category,
          isGroupGoal: record.is_group_goal ?? false,
        };
      default:
        return { ...record, ...baseMapping };
    }
  }

  // Map local table name to Supabase table name
  private getSupabaseTableName(table: string): string {
    const tableMap: Record<string, string> = {
      accounts: 'accounts',
      transactions: 'transactions',
      goals: 'goals',
      loans: 'loans',
      investments: 'investments',
    };
    return tableMap[table] || table;
  }

  // Force sync (manual trigger)
  async forceSync(): Promise<boolean> {
    if (!this.canSync()) {
      toast.error('Cannot sync. Check your connection and verify your email.');
      return false;
    }

    try {
      await this.syncAll();
      toast.success('Data synced successfully!');
      return true;
    } catch (error) {
      toast.error('Sync failed. Please try again.');
      return false;
    }
  }

  // Get sync status
  getStatus(): SyncStatus {
    if (!this.isOnline) return 'offline';
    if (this.isSyncing) return 'pending';
    
    const queue = this.getQueueItems();
    if (queue.length > 0) return 'pending';
    
    return 'synced';
  }

  // Get pending operations count
  getPendingCount(): number {
    return this.getQueueItems().length;
  }
}

// Export singleton instance
export const syncService = new SyncService();

// Hook for components
import { useState, useEffect } from 'react';

export function useSyncStatus(): SyncStatus {
  const [status, setStatus] = useState<SyncStatus>(syncService.getStatus());

  useEffect(() => {
    const unsubscribe = syncService.subscribe(setStatus);
    return unsubscribe;
  }, []);

  return status;
}