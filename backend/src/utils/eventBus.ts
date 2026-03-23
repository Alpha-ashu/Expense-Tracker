import { EventEmitter } from 'events';

// ── Domain event types ──────────────────────────────────────────────
export type AppEvent =
  | { type: 'TRANSACTION_CREATED'; payload: { userId: string; transactionId: string; accountId: string; amount: number; category: string } }
  | { type: 'TRANSACTION_UPDATED'; payload: { userId: string; transactionId: string } }
  | { type: 'TRANSACTION_DELETED'; payload: { userId: string; transactionId: string; accountId: string } }
  | { type: 'ACCOUNT_BALANCE_CHANGED'; payload: { userId: string; accountId: string; newBalance: number } }
  | { type: 'SYNC_COMPLETED'; payload: { userId: string; deviceId: string; entityCount: number } }
  | { type: 'SYNC_CONFLICT'; payload: { userId: string; entityType: string; entityId: string } }
  | { type: 'AI_SCAN_COMPLETED'; payload: { userId: string; billId: string; success: boolean } }
  | { type: 'PROFILE_COMPLETED'; payload: { userId: string } }
  | { type: 'GOAL_PROGRESS'; payload: { userId: string; goalId: string; currentAmount: number; targetAmount: number } }
  | { type: 'LOAN_DUE_SOON'; payload: { userId: string; loanId: string; dueDate: string } };

export type AppEventType = AppEvent['type'];
type EventOfType<T extends AppEventType> = Extract<AppEvent, { type: T }>;

// ── Type-safe event bus ─────────────────────────────────────────────
class AppEventBus {
  private emitter = new EventEmitter();

  constructor() {
    // Prevent memory leak warnings for many listeners
    this.emitter.setMaxListeners(50);
  }

  emit<T extends AppEventType>(event: EventOfType<T>): void {
    this.emitter.emit(event.type, event.payload);
  }

  on<T extends AppEventType>(
    type: T,
    handler: (payload: EventOfType<T>['payload']) => void,
  ): void {
    this.emitter.on(type, handler);
  }

  off<T extends AppEventType>(
    type: T,
    handler: (payload: EventOfType<T>['payload']) => void,
  ): void {
    this.emitter.off(type, handler);
  }

  once<T extends AppEventType>(
    type: T,
    handler: (payload: EventOfType<T>['payload']) => void,
  ): void {
    this.emitter.once(type, handler);
  }
}

export const eventBus = new AppEventBus();
