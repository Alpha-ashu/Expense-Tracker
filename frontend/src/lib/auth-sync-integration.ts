import type { RealtimeChannel } from '@supabase/supabase-js';
import supabase from '@/utils/supabase/client';
import { db } from '@/lib/database';

type SyncedTableName =
  | 'accounts'
  | 'friends'
  | 'transactions'
  | 'loans'
  | 'goals'
  | 'group_expenses'
  | 'investments';

type SyncOperation = 'upsert' | 'delete';

interface SyncQueueItem {
  key: string;
  table: SyncedTableName;
  operation: SyncOperation;
  localId: number;
  remoteId?: number;
  queuedAt: string;
}

const SYNC_QUEUE_STORAGE_KEY = 'finora_sync_queue_v3';
const CORE_SYNC_TABLES: SyncedTableName[] = [
  'accounts',
  'friends',
  'transactions',
  'loans',
  'goals',
  'group_expenses',
  'investments',
];

const TABLE_PRIORITY: Record<SyncedTableName, number> = {
  accounts: 1,
  friends: 2,
  goals: 3,
  loans: 4,
  transactions: 5,
  group_expenses: 6,
  investments: 7,
};

const expandTablesForSync = (tables: SyncedTableName[]) => {
  const expanded = new Set<SyncedTableName>(tables);

  if (expanded.has('transactions')) {
    expanded.add('accounts');
    expanded.add('group_expenses');
  }

  if (expanded.has('loans')) {
    expanded.add('accounts');
    expanded.add('friends');
  }

  if (expanded.has('group_expenses')) {
    expanded.add('accounts');
    expanded.add('friends');
    expanded.add('transactions');
  }

  if (expanded.has('investments')) {
    expanded.add('accounts');
    expanded.add('transactions');
  }

  return [...expanded];
};

const syncState = {
  hooksInstalled: false,
  processingQueue: false,
  suppressionDepth: 0,
  queueTimer: null as ReturnType<typeof setTimeout> | null,
  pullTimer: null as ReturnType<typeof setTimeout> | null,
  activeChannel: null as RealtimeChannel | null,
  activeUserId: null as string | null,
  browserListenersBound: false,
  pendingPullTables: new Set<SyncedTableName>(),
};

const getLocalTable = (table: SyncedTableName) => {
  switch (table) {
    case 'accounts':
      return db.accounts;
    case 'friends':
      return db.friends;
    case 'transactions':
      return db.transactions;
    case 'loans':
      return db.loans;
    case 'goals':
      return db.goals;
    case 'group_expenses':
      return db.groupExpenses;
    case 'investments':
      return db.investments;
  }
};

const toIsoString = (value?: Date | string | null) => {
  if (!value) return null;
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) return null;
  return date.toISOString();
};

const toDate = (value?: string | Date | null) => {
  if (!value) return undefined;
  const date = value instanceof Date ? value : new Date(value);
  return Number.isNaN(date.getTime()) ? undefined : date;
};

const toNumber = (value: unknown): number | undefined => {
  if (value === null || value === undefined || value === '') return undefined;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : undefined;
};

const normalizeText = (value?: string | null) => (value || '').trim().toLowerCase();

const sameInstant = (left?: Date | string | null, right?: Date | string | null) => {
  const leftTime = toDate(left)?.getTime();
  const rightTime = toDate(right)?.getTime();
  if (!leftTime || !rightTime) return false;
  return Math.abs(leftTime - rightTime) < 60_000;
};

const isConnectivityError = (error: any) => {
  const message = String(error?.message || '').toLowerCase();
  const name = String(error?.name || '').toLowerCase();
  return (
    name.includes('abort') ||
    name.includes('network') ||
    message.includes('failed to fetch') ||
    message.includes('network') ||
    message.includes('timeout') ||
    message.includes('timed out')
  );
};

const isMissingRemoteRow = (error: any) =>
  error?.code === 'PGRST116' ||
  error?.details === 'The result contains 0 rows' ||
  String(error?.message || '').toLowerCase().includes('0 rows');

const readSyncQueue = (): SyncQueueItem[] => {
  if (typeof window === 'undefined') return [];

  try {
    const parsed = JSON.parse(localStorage.getItem(SYNC_QUEUE_STORAGE_KEY) || '[]');
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
};

const writeSyncQueue = (items: SyncQueueItem[]) => {
  if (typeof window === 'undefined') return;
  localStorage.setItem(SYNC_QUEUE_STORAGE_KEY, JSON.stringify(items));
};

const enqueueSyncItem = (item: SyncQueueItem) => {
  const items = readSyncQueue();
  const index = items.findIndex((entry) => entry.key === item.key);

  if (index >= 0) {
    const previous = items[index];
    items[index] = {
      ...previous,
      ...item,
      remoteId: item.remoteId ?? previous.remoteId,
    };
  } else {
    items.push(item);
  }

  writeSyncQueue(items);
  scheduleQueueProcessing();
};

const removeSyncQueueKeys = (keys: string[]) => {
  if (keys.length === 0) return;
  const keySet = new Set(keys);
  writeSyncQueue(readSyncQueue().filter((item) => !keySet.has(item.key)));
};

export const isCloudSyncSuppressed = () => syncState.suppressionDepth > 0;

export async function runWithCloudSyncSuppressed<T>(work: () => Promise<T>): Promise<T> {
  syncState.suppressionDepth += 1;

  try {
    return await work();
  } finally {
    syncState.suppressionDepth = Math.max(0, syncState.suppressionDepth - 1);
  }
}

function scheduleQueueProcessing(delay = 250) {
  if (syncState.queueTimer) {
    clearTimeout(syncState.queueTimer);
  }

  syncState.queueTimer = setTimeout(() => {
    syncState.queueTimer = null;
    void processPendingSyncQueue();
  }, delay);
}

export function queueRecordUpsertSync(table: SyncedTableName, localId: number, remoteId?: number) {
  enqueueSyncItem({
    key: `${table}:${localId}`,
    table,
    operation: 'upsert',
    localId,
    remoteId,
    queuedAt: new Date().toISOString(),
  });
}

export function queueRecordDeleteSync(table: SyncedTableName, localId: number, remoteId?: number) {
  enqueueSyncItem({
    key: `${table}:${localId}`,
    table,
    operation: 'delete',
    localId,
    remoteId,
    queuedAt: new Date().toISOString(),
  });
}

function bindTableHooks(table: SyncedTableName) {
  const localTable: any = getLocalTable(table);

  localTable.hook('creating', function (_primKey, obj: any) {
    if (isCloudSyncSuppressed()) return;

    this.onsuccess = (primaryKey: number) => {
      queueRecordUpsertSync(table, Number(primaryKey), toNumber(obj?.remoteId));
    };
  });

  localTable.hook('updating', function (_mods, primKey, obj: any) {
    if (isCloudSyncSuppressed()) return;

    this.onsuccess = () => {
      queueRecordUpsertSync(table, Number(primKey), toNumber(obj?.remoteId));
    };
  });

  localTable.hook('deleting', function (primKey, obj: any) {
    if (isCloudSyncSuppressed()) return;

    this.onsuccess = () => {
      queueRecordDeleteSync(table, Number(primKey), toNumber(obj?.remoteId));
    };
  });
}

export function initializeBackendSync() {
  if (syncState.hooksInstalled) return;

  CORE_SYNC_TABLES.forEach(bindTableHooks);
  syncState.hooksInstalled = true;

  if (!syncState.browserListenersBound && typeof window !== 'undefined') {
    window.addEventListener('online', () => {
      scheduleQueueProcessing(100);

      if (syncState.activeUserId) {
        scheduleCloudPull(syncState.activeUserId, CORE_SYNC_TABLES, 350);
      }
    });

    document.addEventListener('visibilitychange', () => {
      if (document.visibilityState !== 'visible') return;

      scheduleQueueProcessing(100);

      if (syncState.activeUserId) {
        scheduleCloudPull(syncState.activeUserId, CORE_SYNC_TABLES, 350);
      }
    });

    syncState.browserListenersBound = true;
  }
}

async function resolveRemoteAccountId(localId?: number): Promise<number | null | undefined> {
  if (!localId) return null;
  const account = await db.accounts.get(localId);
  if (!account) return undefined;

  const remoteId = toNumber(account.remoteId);
  if (remoteId) return remoteId;

  queueRecordUpsertSync('accounts', localId);
  return undefined;
}

async function resolveRemoteFriendId(localId?: number): Promise<number | null | undefined> {
  if (!localId) return null;
  const friend = await db.friends.get(localId);
  if (!friend) return undefined;

  const remoteId = toNumber(friend.remoteId);
  if (remoteId) return remoteId;

  queueRecordUpsertSync('friends', localId);
  return undefined;
}

async function resolveRemoteTransactionId(localId?: number): Promise<number | null | undefined> {
  if (!localId) return null;
  const transaction = await db.transactions.get(localId);
  if (!transaction) return undefined;

  const remoteId = toNumber(transaction.remoteId);
  if (remoteId) return remoteId;

  queueRecordUpsertSync('transactions', localId);
  return undefined;
}

async function resolveRemoteGroupExpenseId(localId?: number): Promise<number | null | undefined> {
  if (!localId) return null;
  const groupExpense = await db.groupExpenses.get(localId);
  if (!groupExpense) return undefined;

  const remoteId = toNumber(groupExpense.remoteId);
  if (remoteId) return remoteId;

  queueRecordUpsertSync('group_expenses', localId);
  return undefined;
}

async function mapGroupMembersToRemote(members: any[] | undefined) {
  if (!Array.isArray(members)) return [];

  const mappedMembers = [];

  for (const member of members) {
    if (member?.friendId) {
      const remoteFriendId = await resolveRemoteFriendId(Number(member.friendId));
      if (remoteFriendId === undefined) return null;

      mappedMembers.push({
        ...member,
        friendId: remoteFriendId ?? undefined,
      });
    } else {
      mappedMembers.push(member);
    }
  }

  return mappedMembers;
}

async function mapLocalRecordToRemote(table: SyncedTableName, record: any, userId: string) {
  switch (table) {
    case 'accounts':
      return {
        user_id: userId,
        name: record.name,
        type: record.type,
        balance: Number(record.balance ?? 0),
        currency: record.currency || 'INR',
        is_active: record.isActive ?? true,
        created_at: toIsoString(record.createdAt) ?? new Date().toISOString(),
        updated_at: toIsoString(record.updatedAt) ?? new Date().toISOString(),
        deleted_at: toIsoString(record.deletedAt),
      };

    case 'friends':
      return {
        user_id: userId,
        name: record.name,
        email: record.email ?? null,
        phone: record.phone ?? null,
        avatar: record.avatar ?? null,
        notes: record.notes ?? null,
        created_at: toIsoString(record.createdAt) ?? new Date().toISOString(),
        updated_at: toIsoString(record.updatedAt) ?? new Date().toISOString(),
        deleted_at: toIsoString(record.deletedAt),
      };

    case 'transactions': {
      const remoteAccountId = await resolveRemoteAccountId(record.accountId);
      if (!remoteAccountId) return null;

      const remoteTransferAccountId = record.transferToAccountId
        ? await resolveRemoteAccountId(record.transferToAccountId)
        : null;

      if (record.transferToAccountId && remoteTransferAccountId === undefined) {
        return null;
      }

      const remoteGroupExpenseId = record.groupExpenseId
        ? await resolveRemoteGroupExpenseId(record.groupExpenseId)
        : null;

      if (record.groupExpenseId && remoteGroupExpenseId === undefined) {
        return null;
      }

      return {
        user_id: userId,
        type: record.type,
        amount: Number(record.amount ?? 0),
        account_id: remoteAccountId,
        category: record.category || 'Other',
        subcategory: record.subcategory ?? null,
        description: record.description ?? '',
        merchant: record.merchant ?? null,
        date: toIsoString(record.date) ?? new Date().toISOString(),
        tags: Array.isArray(record.tags) ? record.tags : null,
        attachment: record.attachment ?? null,
        transfer_to_account_id: remoteTransferAccountId ?? null,
        transfer_type: record.transferType ?? null,
        expense_mode: record.expenseMode ?? null,
        group_expense_id: remoteGroupExpenseId ?? null,
        group_name: record.groupName ?? null,
        split_type: record.splitType ?? null,
        import_source: record.importSource ?? null,
        import_metadata: record.importMetadata ?? null,
        original_category: record.originalCategory ?? null,
        imported_at: toIsoString(record.importedAt),
        created_at: toIsoString(record.createdAt) ?? new Date().toISOString(),
        updated_at: toIsoString(record.updatedAt) ?? new Date().toISOString(),
        deleted_at: toIsoString(record.deletedAt),
      };
    }

    case 'loans': {
      const remoteFriendId = record.friendId ? await resolveRemoteFriendId(record.friendId) : null;
      if (record.friendId && remoteFriendId === undefined) return null;

      const remoteAccountId = record.accountId ? await resolveRemoteAccountId(record.accountId) : null;
      if (record.accountId && remoteAccountId === undefined) return null;

      return {
        user_id: userId,
        type: record.type,
        name: record.name,
        principal_amount: Number(record.principalAmount ?? 0),
        outstanding_balance: Number(record.outstandingBalance ?? 0),
        interest_rate: record.interestRate ?? null,
        total_payable: record.totalPayable ?? null,
        emi_amount: record.emiAmount ?? null,
        due_date: toIsoString(record.dueDate),
        loan_date: toIsoString(record.loanDate),
        frequency: record.frequency ?? null,
        status: record.status ?? 'active',
        contact_person: record.contactPerson ?? null,
        friend_id: remoteFriendId ?? null,
        contact_email: record.contactEmail ?? null,
        contact_phone: record.contactPhone ?? null,
        account_id: remoteAccountId ?? null,
        notes: record.notes ?? null,
        created_at: toIsoString(record.createdAt) ?? new Date().toISOString(),
        updated_at: toIsoString(record.updatedAt) ?? new Date().toISOString(),
        deleted_at: toIsoString(record.deletedAt),
      };
    }

    case 'goals':
      return {
        user_id: userId,
        name: record.name,
        target_amount: Number(record.targetAmount ?? 0),
        current_amount: Number(record.currentAmount ?? 0),
        target_date: toIsoString(record.targetDate),
        category: record.category ?? 'other',
        is_group_goal: record.isGroupGoal ?? false,
        created_at: toIsoString(record.createdAt) ?? new Date().toISOString(),
        updated_at: toIsoString(record.updatedAt) ?? new Date().toISOString(),
        deleted_at: toIsoString(record.deletedAt),
      };

    case 'group_expenses': {
      const remotePaidBy = await resolveRemoteAccountId(record.paidBy);
      if (!remotePaidBy) return null;

      const remoteMembers = await mapGroupMembersToRemote(record.members);
      if (remoteMembers === null) return null;

      const remoteExpenseTransactionId = record.expenseTransactionId
        ? await resolveRemoteTransactionId(record.expenseTransactionId)
        : null;

      if (record.expenseTransactionId && remoteExpenseTransactionId === undefined) {
        return null;
      }

      return {
        user_id: userId,
        name: record.name,
        total_amount: Number(record.totalAmount ?? 0),
        paid_by: remotePaidBy,
        date: toIsoString(record.date) ?? new Date().toISOString(),
        members: remoteMembers,
        items: Array.isArray(record.items) ? record.items : null,
        description: record.description ?? null,
        category: record.category ?? null,
        subcategory: record.subcategory ?? null,
        split_type: record.splitType ?? null,
        your_share: record.yourShare ?? null,
        expense_transaction_id: remoteExpenseTransactionId ?? null,
        created_by: record.createdBy ?? null,
        created_by_name: record.createdByName ?? null,
        status: record.status ?? null,
        notification_status: record.notificationStatus ?? null,
        created_at: toIsoString(record.createdAt) ?? new Date().toISOString(),
        updated_at: toIsoString(record.updatedAt) ?? new Date().toISOString(),
        deleted_at: toIsoString(record.deletedAt),
      };
    }

    case 'investments': {
      const remoteFundingAccountId = record.fundingAccountId
        ? await resolveRemoteAccountId(record.fundingAccountId)
        : null;
      if (record.fundingAccountId && remoteFundingAccountId === undefined) return null;

      const remoteSettlementAccountId = record.settlementAccountId
        ? await resolveRemoteAccountId(record.settlementAccountId)
        : null;
      if (record.settlementAccountId && remoteSettlementAccountId === undefined) return null;

      const remotePurchaseTransactionId = record.purchaseTransactionId
        ? await resolveRemoteTransactionId(record.purchaseTransactionId)
        : null;
      if (record.purchaseTransactionId && remotePurchaseTransactionId === undefined) return null;

      const remotePurchaseFeeTransactionId = record.purchaseFeeTransactionId
        ? await resolveRemoteTransactionId(record.purchaseFeeTransactionId)
        : null;
      if (record.purchaseFeeTransactionId && remotePurchaseFeeTransactionId === undefined) return null;

      const remoteSaleTransactionId = record.saleTransactionId
        ? await resolveRemoteTransactionId(record.saleTransactionId)
        : null;
      if (record.saleTransactionId && remoteSaleTransactionId === undefined) return null;

      const remoteSaleFeeTransactionId = record.saleFeeTransactionId
        ? await resolveRemoteTransactionId(record.saleFeeTransactionId)
        : null;
      if (record.saleFeeTransactionId && remoteSaleFeeTransactionId === undefined) return null;

      return {
        user_id: userId,
        asset_type: record.assetType,
        asset_name: record.assetName,
        quantity: Number(record.quantity ?? 0),
        buy_price: Number(record.buyPrice ?? 0),
        current_price: Number(record.currentPrice ?? 0),
        total_invested: Number(record.totalInvested ?? 0),
        current_value: Number(record.currentValue ?? 0),
        profit_loss: Number(record.profitLoss ?? 0),
        purchase_date: toIsoString(record.purchaseDate) ?? new Date().toISOString(),
        last_updated: toIsoString(record.lastUpdated) ?? new Date().toISOString(),
        broker: record.broker ?? null,
        description: record.description ?? null,
        asset_currency: record.assetCurrency ?? null,
        base_currency: record.baseCurrency ?? null,
        buy_fx_rate: record.buyFxRate ?? null,
        last_known_fx_rate: record.lastKnownFxRate ?? null,
        total_invested_native: record.totalInvestedNative ?? null,
        current_value_native: record.currentValueNative ?? null,
        valuation_version: record.valuationVersion ?? null,
        position_status: record.positionStatus ?? null,
        closed_at: toIsoString(record.closedAt),
        close_price: record.closePrice ?? null,
        close_fx_rate: record.closeFxRate ?? null,
        gross_sale_value: record.grossSaleValue ?? null,
        net_sale_value: record.netSaleValue ?? null,
        funding_account_id: remoteFundingAccountId ?? null,
        purchase_fees: record.purchaseFees ?? null,
        purchase_transaction_id: remotePurchaseTransactionId ?? null,
        purchase_fee_transaction_id: remotePurchaseFeeTransactionId ?? null,
        sale_transaction_id: remoteSaleTransactionId ?? null,
        sale_fee_transaction_id: remoteSaleFeeTransactionId ?? null,
        closing_fees: record.closingFees ?? null,
        realized_profit_loss: record.realizedProfitLoss ?? null,
        settlement_account_id: remoteSettlementAccountId ?? null,
        close_notes: record.closeNotes ?? null,
        created_at: toIsoString(record.createdAt) ?? new Date().toISOString(),
        updated_at: toIsoString(record.updatedAt) ?? new Date().toISOString(),
        deleted_at: toIsoString(record.deletedAt),
      };
    }
  }
}

async function syncLocalRecordToCloud(userId: string, table: SyncedTableName, localId: number) {
  const localTable: any = getLocalTable(table);
  const localRecord = await localTable.get(localId);
  if (!localRecord) return true;

  const payload = await mapLocalRecordToRemote(table, localRecord, userId);
  if (!payload) return false;

  const currentRemoteId = toNumber(localRecord.remoteId);
  let remoteRecord: any = null;

  if (currentRemoteId) {
    const { data, error } = await supabase
      .from(table)
      .update(payload)
      .eq('id', currentRemoteId)
      .eq('user_id', userId)
      .select()
      .maybeSingle();

    if (error && !isMissingRemoteRow(error)) {
      throw error;
    }

    remoteRecord = data;
  }

  if (!remoteRecord) {
    const { data, error } = await supabase
      .from(table)
      .insert(payload)
      .select()
      .single();

    if (error) {
      throw error;
    }

    remoteRecord = data;
  }

  const remoteId = toNumber(remoteRecord?.id);
  if (!remoteId) return true;

  await runWithCloudSyncSuppressed(async () => {
    await localTable.update(localId, {
      remoteId,
      updatedAt: toDate(remoteRecord.updated_at) ?? localRecord.updatedAt ?? new Date(),
    });
  });

  return true;
}

async function deleteRemoteRecord(userId: string, item: SyncQueueItem) {
  const remoteId = item.remoteId;
  if (!remoteId) return true;

  const { error } = await supabase
    .from(item.table)
    .delete()
    .eq('id', remoteId)
    .eq('user_id', userId);

  if (error && !isMissingRemoteRow(error)) {
    throw error;
  }

  return true;
}

export async function processPendingSyncQueue() {
  initializeBackendSync();

  if (syncState.processingQueue || isCloudSyncSuppressed()) return;
  if (typeof navigator !== 'undefined' && !navigator.onLine) return;

  const pendingItems = readSyncQueue();
  if (pendingItems.length === 0) return;

  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return;

  syncState.processingQueue = true;

  try {
    const queue = [...pendingItems].sort((left, right) => {
      const byPriority = TABLE_PRIORITY[left.table] - TABLE_PRIORITY[right.table];
      if (byPriority !== 0) return byPriority;
      return left.queuedAt.localeCompare(right.queuedAt);
    });

    const completedKeys: string[] = [];
    const deferredItems: SyncQueueItem[] = [];

    for (let index = 0; index < queue.length; index += 1) {
      const item = queue[index];

      try {
        const synced = item.operation === 'delete'
          ? await deleteRemoteRecord(user.id, item)
          : await syncLocalRecordToCloud(user.id, item.table, item.localId);

        if (synced) {
          completedKeys.push(item.key);
        } else {
          deferredItems.push(item);
        }
      } catch (error) {
        if (isConnectivityError(error)) {
          deferredItems.push(...queue.slice(index));
          break;
        }

        console.warn(`Cloud sync failed for ${item.table}:${item.localId}`, error);
        deferredItems.push(item);
      }
    }

    if (completedKeys.length > 0) {
      removeSyncQueueKeys(completedKeys);
    }

    if (deferredItems.length > 0) {
      const currentQueue = readSyncQueue().filter((item) => !completedKeys.includes(item.key));
      writeSyncQueue(
        [...currentQueue, ...deferredItems].reduce<SyncQueueItem[]>((items, item) => {
          const existingIndex = items.findIndex((entry) => entry.key === item.key);
          if (existingIndex >= 0) {
            items[existingIndex] = {
              ...items[existingIndex],
              ...item,
              remoteId: item.remoteId ?? items[existingIndex].remoteId,
            };
          } else {
            items.push(item);
          }
          return items;
        }, [])
      );

      scheduleQueueProcessing(500);
    }
  } finally {
    syncState.processingQueue = false;
  }
}

function findMatchingAccount(remote: any, localAccounts: any[]) {
  return localAccounts.find((account) =>
    !account.remoteId &&
    normalizeText(account.name) === normalizeText(remote.name) &&
    account.type === remote.type &&
    normalizeText(account.currency) === normalizeText(remote.currency)
  );
}

function findMatchingFriend(remote: any, localFriends: any[]) {
  return localFriends.find((friend) =>
    !friend.remoteId &&
    normalizeText(friend.name) === normalizeText(remote.name) &&
    normalizeText(friend.email) === normalizeText(remote.email) &&
    normalizeText(friend.phone) === normalizeText(remote.phone)
  );
}

function findMatchingGoal(remote: any, localGoals: any[]) {
  return localGoals.find((goal) =>
    !goal.remoteId &&
    normalizeText(goal.name) === normalizeText(remote.name) &&
    Number(goal.targetAmount ?? 0) === Number(remote.target_amount ?? 0)
  );
}

function findMatchingLoan(remote: any, localLoans: any[]) {
  return localLoans.find((loan) =>
    !loan.remoteId &&
    normalizeText(loan.name) === normalizeText(remote.name) &&
    loan.type === remote.type &&
    Number(loan.principalAmount ?? 0) === Number(remote.principal_amount ?? 0)
  );
}

function findMatchingTransaction(remote: any, localTransactions: any[], accountId?: number) {
  return localTransactions.find((transaction) =>
    !transaction.remoteId &&
    transaction.type === remote.type &&
    Number(transaction.amount ?? 0) === Number(remote.amount ?? 0) &&
    normalizeText(transaction.category) === normalizeText(remote.category) &&
    normalizeText(transaction.description) === normalizeText(remote.description) &&
    (!accountId || transaction.accountId === accountId) &&
    sameInstant(transaction.date, remote.date)
  );
}

function findMatchingGroupExpense(remote: any, localGroups: any[], paidBy?: number) {
  return localGroups.find((group) =>
    !group.remoteId &&
    normalizeText(group.name) === normalizeText(remote.name) &&
    Number(group.totalAmount ?? 0) === Number(remote.total_amount ?? 0) &&
    (!paidBy || group.paidBy === paidBy) &&
    sameInstant(group.date, remote.date)
  );
}

function findMatchingInvestment(remote: any, localInvestments: any[]) {
  return localInvestments.find((investment) =>
    !investment.remoteId &&
    normalizeText(investment.assetName) === normalizeText(remote.asset_name) &&
    investment.assetType === remote.asset_type &&
    Number(investment.quantity ?? 0) === Number(remote.quantity ?? 0) &&
    sameInstant(investment.purchaseDate, remote.purchase_date)
  );
}

function resolveLocalId(remoteId: number, existingRows: any[], matcher?: (rows: any[]) => any) {
  const byRemoteId = existingRows.find((row) => toNumber(row.remoteId) === remoteId);
  if (byRemoteId?.id) return Number(byRemoteId.id);

  const matched = matcher ? matcher(existingRows) : undefined;
  if (matched?.id) return Number(matched.id);

  return undefined;
}

async function mergeRemoteTable(table: SyncedTableName, remoteRows: any[], nextRows: any[], existingRows: any[]) {
  const remoteIds = new Set(remoteRows.map((row) => Number(row.id)).filter(Number.isFinite));
  const staleLocalIds = existingRows
    .filter((row) => {
      const remoteId = toNumber(row.remoteId);
      return remoteId && !remoteIds.has(remoteId);
    })
    .map((row) => Number(row.id))
    .filter(Number.isFinite);

  const localTable: any = getLocalTable(table);

  if (nextRows.length > 0) {
    await localTable.bulkPut(nextRows);
  }

  if (staleLocalIds.length > 0) {
    await localTable.bulkDelete(staleLocalIds);
  }
}

export async function syncUserDataFromCloud(
  userId: string,
  requestedTables: SyncedTableName[] = CORE_SYNC_TABLES
) {
  initializeBackendSync();
  await processPendingSyncQueue();

  const targetTables = requestedTables.length > 0 ? requestedTables : CORE_SYNC_TABLES;
  const expandedTables = expandTablesForSync(targetTables);
  const mergeTargets = new Set<SyncedTableName>(targetTables);
  const shouldFetch = (table: SyncedTableName) => expandedTables.includes(table);

  const [
    { data: remoteAccounts = [] },
    { data: remoteFriends = [] },
    { data: remoteTransactions = [] },
    { data: remoteLoans = [] },
    { data: remoteGoals = [] },
    { data: remoteInvestments = [] },
    { data: remoteGroupExpenses = [] },
    localAccounts,
    localFriends,
    localTransactions,
    localLoans,
    localGoals,
    localInvestments,
    localGroupExpenses,
  ] = await Promise.all([
    shouldFetch('accounts')
      ? supabase.from('accounts').select('*').eq('user_id', userId).is('deleted_at', null)
      : Promise.resolve({ data: [] }),
    shouldFetch('friends')
      ? supabase.from('friends').select('*').eq('user_id', userId).is('deleted_at', null)
      : Promise.resolve({ data: [] }),
    shouldFetch('transactions')
      ? supabase.from('transactions').select('*').eq('user_id', userId).is('deleted_at', null)
      : Promise.resolve({ data: [] }),
    shouldFetch('loans')
      ? supabase.from('loans').select('*').eq('user_id', userId).is('deleted_at', null)
      : Promise.resolve({ data: [] }),
    shouldFetch('goals')
      ? supabase.from('goals').select('*').eq('user_id', userId).is('deleted_at', null)
      : Promise.resolve({ data: [] }),
    shouldFetch('investments')
      ? supabase.from('investments').select('*').eq('user_id', userId).is('deleted_at', null)
      : Promise.resolve({ data: [] }),
    shouldFetch('group_expenses')
      ? supabase.from('group_expenses').select('*').eq('user_id', userId).is('deleted_at', null)
      : Promise.resolve({ data: [] }),
    shouldFetch('accounts') ? db.accounts.toArray() : Promise.resolve([]),
    shouldFetch('friends') ? db.friends.toArray() : Promise.resolve([]),
    shouldFetch('transactions') ? db.transactions.toArray() : Promise.resolve([]),
    shouldFetch('loans') ? db.loans.toArray() : Promise.resolve([]),
    shouldFetch('goals') ? db.goals.toArray() : Promise.resolve([]),
    shouldFetch('investments') ? db.investments.toArray() : Promise.resolve([]),
    shouldFetch('group_expenses') ? db.groupExpenses.toArray() : Promise.resolve([]),
  ]);

  const accountRemoteToLocal = new Map<number, number>();
  const friendRemoteToLocal = new Map<number, number>();
  const groupExpenseRemoteToLocal = new Map<number, number>();
  const transactionRemoteToLocal = new Map<number, number>();

  const mappedAccounts = remoteAccounts.map((account: any) => {
    const localId = resolveLocalId(Number(account.id), localAccounts, (rows) => findMatchingAccount(account, rows)) ?? Number(account.id);
    accountRemoteToLocal.set(Number(account.id), localId);

    return {
      id: localId,
      remoteId: Number(account.id),
      name: account.name,
      type: account.type,
      balance: Number(account.balance ?? 0),
      currency: account.currency ?? 'INR',
      isActive: account.is_active ?? true,
      createdAt: toDate(account.created_at) ?? new Date(),
      updatedAt: toDate(account.updated_at),
      deletedAt: toDate(account.deleted_at),
    };
  });

  const mappedFriends = remoteFriends.map((friend: any) => {
    const localId = resolveLocalId(Number(friend.id), localFriends, (rows) => findMatchingFriend(friend, rows)) ?? Number(friend.id);
    friendRemoteToLocal.set(Number(friend.id), localId);

    return {
      id: localId,
      remoteId: Number(friend.id),
      name: friend.name,
      email: friend.email ?? undefined,
      phone: friend.phone ?? undefined,
      avatar: friend.avatar ?? undefined,
      notes: friend.notes ?? undefined,
      createdAt: toDate(friend.created_at) ?? new Date(),
      updatedAt: toDate(friend.updated_at),
      deletedAt: toDate(friend.deleted_at),
    };
  });

  remoteGroupExpenses.forEach((group: any) => {
    const localPaidBy = accountRemoteToLocal.get(Number(group.paid_by)) ?? Number(group.paid_by);
    const localId = resolveLocalId(
      Number(group.id),
      localGroupExpenses,
      (rows) => findMatchingGroupExpense(group, rows, localPaidBy)
    ) ?? Number(group.id);

    groupExpenseRemoteToLocal.set(Number(group.id), localId);
  });

  const mappedTransactions = remoteTransactions.map((transaction: any) => {
    const localAccountId = accountRemoteToLocal.get(Number(transaction.account_id)) ?? Number(transaction.account_id);
    const localTransferAccountId = transaction.transfer_to_account_id
      ? accountRemoteToLocal.get(Number(transaction.transfer_to_account_id)) ?? Number(transaction.transfer_to_account_id)
      : undefined;
    const localGroupExpenseId = transaction.group_expense_id
      ? groupExpenseRemoteToLocal.get(Number(transaction.group_expense_id)) ?? undefined
      : undefined;
    const localId = resolveLocalId(
      Number(transaction.id),
      localTransactions,
      (rows) => findMatchingTransaction(transaction, rows, localAccountId)
    ) ?? Number(transaction.id);

    transactionRemoteToLocal.set(Number(transaction.id), localId);

    return {
      id: localId,
      remoteId: Number(transaction.id),
      type: transaction.type,
      amount: Number(transaction.amount ?? 0),
      accountId: localAccountId,
      category: transaction.category ?? 'Other',
      subcategory: transaction.subcategory ?? undefined,
      description: transaction.description ?? '',
      merchant: transaction.merchant ?? undefined,
      date: toDate(transaction.date) ?? new Date(),
      tags: Array.isArray(transaction.tags) ? transaction.tags : undefined,
      attachment: transaction.attachment ?? undefined,
      transferToAccountId: localTransferAccountId,
      transferType: transaction.transfer_type ?? undefined,
      expenseMode: transaction.expense_mode ?? undefined,
      groupExpenseId: localGroupExpenseId,
      groupName: transaction.group_name ?? undefined,
      splitType: transaction.split_type ?? undefined,
      importSource: transaction.import_source ?? undefined,
      importMetadata: transaction.import_metadata ?? undefined,
      originalCategory: transaction.original_category ?? undefined,
      importedAt: toDate(transaction.imported_at),
      createdAt: toDate(transaction.created_at) ?? new Date(),
      updatedAt: toDate(transaction.updated_at),
      deletedAt: toDate(transaction.deleted_at),
    };
  });

  const mappedLoans = remoteLoans.map((loan: any) => {
    const localFriendId = loan.friend_id
      ? friendRemoteToLocal.get(Number(loan.friend_id)) ?? undefined
      : undefined;
    const localAccountId = loan.account_id
      ? accountRemoteToLocal.get(Number(loan.account_id)) ?? undefined
      : undefined;
    const localId = resolveLocalId(Number(loan.id), localLoans, (rows) => findMatchingLoan(loan, rows)) ?? Number(loan.id);

    return {
      id: localId,
      remoteId: Number(loan.id),
      type: loan.type,
      name: loan.name,
      principalAmount: Number(loan.principal_amount ?? 0),
      outstandingBalance: Number(loan.outstanding_balance ?? 0),
      interestRate: loan.interest_rate ?? undefined,
      totalPayable: loan.total_payable ?? undefined,
      emiAmount: loan.emi_amount ?? undefined,
      dueDate: toDate(loan.due_date),
      loanDate: toDate(loan.loan_date),
      frequency: loan.frequency ?? undefined,
      status: loan.status ?? 'active',
      contactPerson: loan.contact_person ?? undefined,
      friendId: localFriendId,
      contactEmail: loan.contact_email ?? undefined,
      contactPhone: loan.contact_phone ?? undefined,
      accountId: localAccountId,
      notes: loan.notes ?? undefined,
      createdAt: toDate(loan.created_at) ?? new Date(),
      updatedAt: toDate(loan.updated_at),
      deletedAt: toDate(loan.deleted_at),
    };
  });

  const mappedGoals = remoteGoals.map((goal: any) => {
    const localId = resolveLocalId(Number(goal.id), localGoals, (rows) => findMatchingGoal(goal, rows)) ?? Number(goal.id);

    return {
      id: localId,
      remoteId: Number(goal.id),
      name: goal.name,
      targetAmount: Number(goal.target_amount ?? 0),
      currentAmount: Number(goal.current_amount ?? 0),
      targetDate: toDate(goal.target_date) ?? new Date(),
      category: goal.category ?? 'other',
      isGroupGoal: goal.is_group_goal ?? false,
      createdAt: toDate(goal.created_at) ?? new Date(),
      updatedAt: toDate(goal.updated_at),
      deletedAt: toDate(goal.deleted_at),
    };
  });

  const mappedGroupExpenses = remoteGroupExpenses.map((group: any) => {
    const localPaidBy = accountRemoteToLocal.get(Number(group.paid_by)) ?? Number(group.paid_by);
    const localId = groupExpenseRemoteToLocal.get(Number(group.id)) ?? Number(group.id);

    const members = Array.isArray(group.members)
      ? group.members.map((member: any) => ({
          ...member,
          friendId: member?.friendId
            ? friendRemoteToLocal.get(Number(member.friendId)) ?? undefined
            : undefined,
        }))
      : [];

    return {
      id: localId,
      remoteId: Number(group.id),
      name: group.name,
      totalAmount: Number(group.total_amount ?? 0),
      paidBy: localPaidBy,
      date: toDate(group.date) ?? new Date(),
      members,
      items: Array.isArray(group.items) ? group.items : [],
      description: group.description ?? undefined,
      category: group.category ?? undefined,
      subcategory: group.subcategory ?? undefined,
      splitType: group.split_type ?? undefined,
      yourShare: group.your_share ?? undefined,
      expenseTransactionId: group.expense_transaction_id
        ? transactionRemoteToLocal.get(Number(group.expense_transaction_id)) ?? undefined
        : undefined,
      createdBy: group.created_by ?? undefined,
      createdByName: group.created_by_name ?? undefined,
      status: group.status ?? undefined,
      notificationStatus: group.notification_status ?? undefined,
      createdAt: toDate(group.created_at) ?? new Date(),
      updatedAt: toDate(group.updated_at),
      deletedAt: toDate(group.deleted_at),
    };
  });

  const mappedInvestments = remoteInvestments.map((investment: any) => {
    const localId = resolveLocalId(
      Number(investment.id),
      localInvestments,
      (rows) => findMatchingInvestment(investment, rows)
    ) ?? Number(investment.id);

    return {
      id: localId,
      remoteId: Number(investment.id),
      assetType: investment.asset_type,
      assetName: investment.asset_name,
      quantity: Number(investment.quantity ?? 0),
      buyPrice: Number(investment.buy_price ?? 0),
      currentPrice: Number(investment.current_price ?? 0),
      totalInvested: Number(investment.total_invested ?? 0),
      currentValue: Number(investment.current_value ?? 0),
      profitLoss: Number(investment.profit_loss ?? 0),
      purchaseDate: toDate(investment.purchase_date) ?? new Date(),
      lastUpdated: toDate(investment.last_updated) ?? new Date(),
      broker: investment.broker ?? undefined,
      description: investment.description ?? undefined,
      assetCurrency: investment.asset_currency ?? undefined,
      baseCurrency: investment.base_currency ?? undefined,
      buyFxRate: investment.buy_fx_rate ?? undefined,
      lastKnownFxRate: investment.last_known_fx_rate ?? undefined,
      totalInvestedNative: investment.total_invested_native ?? undefined,
      currentValueNative: investment.current_value_native ?? undefined,
      valuationVersion: investment.valuation_version ?? undefined,
      positionStatus: investment.position_status ?? undefined,
      closedAt: toDate(investment.closed_at),
      closePrice: investment.close_price ?? undefined,
      closeFxRate: investment.close_fx_rate ?? undefined,
      grossSaleValue: investment.gross_sale_value ?? undefined,
      netSaleValue: investment.net_sale_value ?? undefined,
      fundingAccountId: investment.funding_account_id
        ? accountRemoteToLocal.get(Number(investment.funding_account_id)) ?? undefined
        : undefined,
      purchaseFees: investment.purchase_fees ?? undefined,
      purchaseTransactionId: investment.purchase_transaction_id
        ? transactionRemoteToLocal.get(Number(investment.purchase_transaction_id)) ?? undefined
        : undefined,
      purchaseFeeTransactionId: investment.purchase_fee_transaction_id
        ? transactionRemoteToLocal.get(Number(investment.purchase_fee_transaction_id)) ?? undefined
        : undefined,
      saleTransactionId: investment.sale_transaction_id
        ? transactionRemoteToLocal.get(Number(investment.sale_transaction_id)) ?? undefined
        : undefined,
      saleFeeTransactionId: investment.sale_fee_transaction_id
        ? transactionRemoteToLocal.get(Number(investment.sale_fee_transaction_id)) ?? undefined
        : undefined,
      closingFees: investment.closing_fees ?? undefined,
      realizedProfitLoss: investment.realized_profit_loss ?? undefined,
      settlementAccountId: investment.settlement_account_id
        ? accountRemoteToLocal.get(Number(investment.settlement_account_id)) ?? undefined
        : undefined,
      closeNotes: investment.close_notes ?? undefined,
      createdAt: toDate(investment.created_at) ?? new Date(),
      updatedAt: toDate(investment.updated_at),
      deletedAt: toDate(investment.deleted_at),
    };
  });

  await runWithCloudSyncSuppressed(async () => {
    if (mergeTargets.has('accounts')) {
      await mergeRemoteTable('accounts', remoteAccounts, mappedAccounts, localAccounts);
    }
    if (mergeTargets.has('friends')) {
      await mergeRemoteTable('friends', remoteFriends, mappedFriends, localFriends);
    }
    if (mergeTargets.has('transactions')) {
      await mergeRemoteTable('transactions', remoteTransactions, mappedTransactions, localTransactions);
    }
    if (mergeTargets.has('loans')) {
      await mergeRemoteTable('loans', remoteLoans, mappedLoans, localLoans);
    }
    if (mergeTargets.has('goals')) {
      await mergeRemoteTable('goals', remoteGoals, mappedGoals, localGoals);
    }
    if (mergeTargets.has('group_expenses')) {
      await mergeRemoteTable('group_expenses', remoteGroupExpenses, mappedGroupExpenses, localGroupExpenses);
    }
    if (mergeTargets.has('investments')) {
      await mergeRemoteTable('investments', remoteInvestments, mappedInvestments, localInvestments);
    }
  });
}

function scheduleCloudPull(userId: string, tables: SyncedTableName[] = CORE_SYNC_TABLES, delay = 400) {
  tables.forEach((table) => syncState.pendingPullTables.add(table));

  if (syncState.pullTimer) {
    clearTimeout(syncState.pullTimer);
  }

  syncState.pullTimer = setTimeout(() => {
    syncState.pullTimer = null;
    const pendingTables = syncState.pendingPullTables.size > 0
      ? [...syncState.pendingPullTables]
      : [...CORE_SYNC_TABLES];
    syncState.pendingPullTables.clear();

    void (async () => {
      try {
        await syncUserDataFromCloud(userId, pendingTables);
      } catch (error) {
        if (!isConnectivityError(error)) {
          console.warn('Cloud pull failed:', error);
        }
      }
    })();
  }, delay);
}

export function subscribeToUserCloudSync(userId: string) {
  initializeBackendSync();
  syncState.activeUserId = userId;

  if (syncState.activeChannel) {
    void supabase.removeChannel(syncState.activeChannel);
    syncState.activeChannel = null;
  }

  const channel = supabase.channel(`finora-user-sync-${userId}`);

  for (const table of CORE_SYNC_TABLES) {
    channel.on(
      'postgres_changes',
      {
        event: '*',
        schema: 'public',
        table,
        filter: `user_id=eq.${userId}`,
      },
      () => {
        scheduleCloudPull(userId, [table], 250);
      }
    );
  }

  channel.subscribe((status) => {
    if (status === 'SUBSCRIBED') {
      scheduleCloudPull(userId, CORE_SYNC_TABLES, 200);
    }
  });

  syncState.activeChannel = channel;

  return () => {
    if (syncState.activeChannel === channel) {
      void supabase.removeChannel(channel);
      syncState.activeChannel = null;
    }

    if (syncState.activeUserId === userId) {
      syncState.activeUserId = null;
    }
  };
}

export function queueTransactionInsertSync(localId: number, transaction?: any) {
  queueRecordUpsertSync('transactions', localId, toNumber(transaction?.remoteId));
}

export function queueTransactionUpdateSync(localId: number, transaction?: any) {
  queueRecordUpsertSync('transactions', localId, toNumber(transaction?.remoteId));
}

export function queueTransactionDeleteSync(localId: number, remoteId?: number) {
  queueRecordDeleteSync('transactions', localId, remoteId);
}

export async function handleLoginSuccess(userId: string, _token: string) {
  initializeBackendSync();
  await processPendingSyncQueue();
  await syncUserDataFromCloud(userId);
}

export async function handleLogout() {
  if (syncState.queueTimer) {
    clearTimeout(syncState.queueTimer);
    syncState.queueTimer = null;
  }

  if (syncState.pullTimer) {
    clearTimeout(syncState.pullTimer);
    syncState.pullTimer = null;
  }

  if (syncState.activeChannel) {
    await supabase.removeChannel(syncState.activeChannel);
    syncState.activeChannel = null;
  }

  syncState.activeUserId = null;
  writeSyncQueue([]);
}

export async function saveTransactionWithBackendSync(transaction: any) {
  initializeBackendSync();

  const now = new Date();
  const dbTransaction = {
    ...transaction,
    createdAt: transaction.createdAt ?? now,
    updatedAt: now,
  };

  const savedId = await db.transactions.add(dbTransaction);
  queueRecordUpsertSync('transactions', savedId, toNumber(transaction?.remoteId));

  return { ...dbTransaction, id: savedId };
}

export async function saveAccountWithBackendSync(account: any) {
  initializeBackendSync();

  const now = new Date();
  const dbAccount = {
    ...account,
    createdAt: account.createdAt ?? now,
    updatedAt: now,
  };

  const savedId = await db.accounts.add(dbAccount);
  queueRecordUpsertSync('accounts', savedId, toNumber(account?.remoteId));

  return { ...dbAccount, id: savedId };
}

export async function updateAccountWithBackendSync(accountId: number, updates: any) {
  initializeBackendSync();

  await db.accounts.update(accountId, {
    ...updates,
    updatedAt: new Date(),
  });

  queueRecordUpsertSync('accounts', accountId, toNumber(updates?.remoteId));
}

export async function saveGoalWithBackendSync(goal: any) {
  initializeBackendSync();

  const now = new Date();
  const dbGoal = {
    ...goal,
    createdAt: goal.createdAt ?? now,
    updatedAt: now,
  };

  const savedId = await db.goals.add(dbGoal);
  queueRecordUpsertSync('goals', savedId, toNumber(goal?.remoteId));

  return { ...dbGoal, id: savedId };
}

export async function checkBackendConnectivity(): Promise<boolean> {
  try {
    const { data: { session } } = await supabase.auth.getSession();
    return !!session;
  } catch {
    return false;
  }
}
