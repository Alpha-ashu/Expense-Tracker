// Real-time data sync manager
export class RealtimeSyncManager {
  private static instance: RealtimeSyncManager;
  private syncInterval: NodeJS.Timeout | null = null;
  private isOnline: boolean = navigator.onLine;
  private pendingChanges: Map<string, any> = new Map();
  private listeners: Set<() => void> = new Set();
  private isSyncing: boolean = false;

  static getInstance(): RealtimeSyncManager {
    if (!RealtimeSyncManager.instance) {
      RealtimeSyncManager.instance = new RealtimeSyncManager();
    }
    return RealtimeSyncManager.instance;
  }

  constructor() {
    this.setupNetworkListeners();
    this.startPeriodicSync();
  }

  private setupNetworkListeners(): void {
    window.addEventListener('online', () => {
      this.isOnline = true;
      this.syncPendingChanges();
    });

    window.addEventListener('offline', () => {
      this.isOnline = false;
    });
  }

  private startPeriodicSync(): void {
    if (this.syncInterval) {
      clearInterval(this.syncInterval);
    }

    // Sync every 5 seconds when online, or when changes are detected
    this.syncInterval = setInterval(() => {
      if (this.isOnline && this.pendingChanges.size > 0) {
        this.syncPendingChanges();
      }
    }, 5000);
  }

  private async syncPendingChanges(): Promise<void> {
    if (this.isSyncing || !this.isOnline) {
      return;
    }

    this.isSyncing = true;

    try {
      // In a real implementation, this would sync to a backend
      // For now, we just notify listeners of the sync
      console.log('Syncing pending changes:', this.pendingChanges.size);
      this.pendingChanges.clear();

      // Notify all listeners that data has been synced
      this.notifyListeners();
    } catch (error) {
      console.error('Sync failed:', error);
    } finally {
      this.isSyncing = false;
    }
  }

  public addChange(key: string, data: any): void {
    this.pendingChanges.set(key, data);
    // Trigger immediate sync if online
    if (this.isOnline) {
      setTimeout(() => this.syncPendingChanges(), 100);
    }
  }

  public subscribe(listener: () => void): () => void {
    this.listeners.add(listener);
    return () => {
      this.listeners.delete(listener);
    };
  }

  private notifyListeners(): void {
    this.listeners.forEach(listener => listener());
  }

  public isConnected(): boolean {
    return this.isOnline;
  }

  public destroy(): void {
    if (this.syncInterval) {
      clearInterval(this.syncInterval);
      this.syncInterval = null;
    }
    this.listeners.clear();
    this.pendingChanges.clear();
  }
}

// Initialize real-time sync manager
export const initializeRealtimeSync = (): void => {
  RealtimeSyncManager.getInstance();
  console.log('Real-time sync manager initialized');
};

// Helper function to track changes
export const trackChange = (changeType: string, data: any): void => {
  const manager = RealtimeSyncManager.getInstance();
  manager.addChange(`${changeType}-${Date.now()}`, data);
};

// Export singleton
export const realtimeSyncManager = RealtimeSyncManager.getInstance();
