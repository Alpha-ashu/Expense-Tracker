// GoldEntry interface for gold assets
export interface GoldEntry {
  id?: number;
  type: 'gold' | 'jewelry' | 'coin';
  quantity: number;
  unit: 'gram' | 'ounce' | 'kg';
  purchasePrice: number;
  currentPrice: number;
  purchaseDate: Date;
  purityPercentage: number;
  location: string;
  certificateNumber?: string;
  notes?: string;
  createdAt: Date;
  updatedAt?: Date;
}
import Dexie, { Table } from 'dexie';

// Database Interfaces
export interface Account {
  id?: number;
  name: string;
  type: 'bank' | 'card' | 'cash' | 'wallet';
  balance: number;
  currency: string;
  isActive: boolean;
  createdAt: Date;
  updatedAt?: Date;
  deletedAt?: Date;
}

export interface Friend {
  id?: number;
  name: string;
  email?: string;
  phone?: string;
  avatar?: string;
  notes?: string;
  createdAt: Date;
  updatedAt?: Date;
}

export interface Transaction {
  id?: number;
  type: 'expense' | 'income' | 'transfer';
  amount: number;
  accountId: number;
  category: string;
  subcategory?: string;
  description: string;
  merchant?: string;
  date: Date;
  tags?: string[];
  attachment?: string;
  expenseMode?: 'individual' | 'group';
  groupExpenseId?: number;
  groupName?: string;
  splitType?: 'equal' | 'custom';
  // Transfer specific fields
  transferToAccountId?: number;
  transferType?: 'self-transfer' | 'other-transfer'; // self-transfer is between own accounts
  createdAt?: Date;
  updatedAt?: Date;
  deletedAt?: Date;
}

export interface Loan {
  id?: number;
  type: 'borrowed' | 'lent' | 'emi';
  name: string;
  principalAmount: number;
  outstandingBalance: number;
  interestRate?: number;
  totalPayable?: number;
  emiAmount?: number;
  dueDate?: Date;
  loanDate?: Date;
  frequency?: 'monthly' | 'weekly' | 'custom';
  status: 'active' | 'overdue' | 'completed';
  contactPerson?: string;
  friendId?: number; // Reference to Friend
  contactEmail?: string;
  contactPhone?: string;
  accountId?: number;
  notes?: string;
  createdAt: Date;
  updatedAt?: Date;
  deletedAt?: Date;
}

export interface LoanPayment {
  id?: number;
  loanId: number;
  amount: number;
  accountId: number;
  date: Date;
  notes?: string;
}

export interface Goal {
  id?: number;
  name: string;
  targetAmount: number;
  currentAmount: number;
  targetDate: Date;
  category: string;
  isGroupGoal: boolean;
  createdAt: Date;
  updatedAt?: Date;
  deletedAt?: Date;
}

export interface GoalContribution {
  id?: number;
  goalId: number;
  amount: number;
  accountId: number;
  date: Date;
  notes?: string;
}

export interface GroupExpense {
  id?: number;
  name: string;
  totalAmount: number;
  paidBy: number; // accountId
  date: Date;
  members: GroupMember[];
  items?: GroupItem[];
  description?: string;
  category?: string;
  subcategory?: string;
  splitType?: 'equal' | 'custom';
  yourShare?: number;
  expenseTransactionId?: number;
  createdBy?: string;
  createdByName?: string;
  status?: 'pending' | 'settled';
  notificationStatus?: 'pending' | 'partial' | 'sent' | 'failed';
  createdAt: Date;
  updatedAt?: Date;
  deletedAt?: Date;
}

export interface GroupMember {
  name: string;
  share: number;
  paid: boolean;
  friendId?: number;
  email?: string;
  phone?: string;
  isCurrentUser?: boolean;
  paidAmount?: number;
  paymentStatus?: 'pending' | 'partial' | 'paid';
  reminderSentAt?: Date;
}

export interface GroupItem {
  name: string;
  amount: number;
  sharedBy: string[]; // member names
}

export interface Investment {
  id?: number;
  assetType: 'stock' | 'crypto' | 'forex' | 'gold' | 'silver' | 'other';
  assetName: string;
  quantity: number;
  buyPrice: number;
  currentPrice: number;
  totalInvested: number;
  currentValue: number;
  profitLoss: number;
  purchaseDate: Date;
  lastUpdated: Date;
  broker?: string;
  description?: string;
  assetCurrency?: string;
  baseCurrency?: string;
  buyFxRate?: number;
  lastKnownFxRate?: number;
  totalInvestedNative?: number;
  currentValueNative?: number;
  valuationVersion?: number;
  positionStatus?: 'open' | 'closed';
  closedAt?: Date;
  closePrice?: number;
  closeFxRate?: number;
  grossSaleValue?: number;
  netSaleValue?: number;
  fundingAccountId?: number;
  purchaseFees?: number;
  purchaseTransactionId?: number;
  purchaseFeeTransactionId?: number;
  saleTransactionId?: number;
  saleFeeTransactionId?: number;
  closingFees?: number;
  realizedProfitLoss?: number;
  settlementAccountId?: number;
  closeNotes?: string;
  updatedAt?: Date;
  deletedAt?: Date;
}

export interface Notification {
  id?: number;
  type: 'emi' | 'loan' | 'goal' | 'group' | 'booking' | 'message' | 'session';
  title: string;
  message: string;
  dueDate?: Date;
  isRead: boolean;
  relatedId?: number;
  createdAt: Date;
  userId?: string;
  deepLink?: string; // e.g., "/calendar?session=123"
}

export interface TaxCalculation {
  id?: number;
  year: number;
  totalIncome: number;
  totalExpense: number;
  netProfit: number;
  taxableIncome: number;
  estimatedTax: number;
  taxRate: number;
  deductions: number;
  currency: string;
  notes?: string;
  createdAt: Date;
  updatedAt?: Date;
}

export interface FinanceAdvisor {
  id?: number;
  userId: string; // Linked to auth user
  name: string;
  email: string;
  phone: string;
  photo?: string;
  bio?: string;
  specialization: string[]; // tax, accounting, investment, business, etc.
  experience: number; // years
  qualifications: string[];
  rating: number; // 1-5
  totalReviews: number;
  clientsCompleted: number;
  activeClients: number;
  socialLinks?: {
    linkedin?: string;
    twitter?: string;
    website?: string;
  };
  availability: boolean; // ON/OFF toggle
  hourlyRate: number;
  verified: boolean;
  createdAt: Date;
}

export interface AdvisorSession {
  id?: number;
  advisorId: string;
  userId: string;
  date: Date;
  duration: number; // minutes
  type: 'video' | 'audio' | 'chat';
  status: 'scheduled' | 'completed' | 'cancelled' | 'rescheduled';
  notes?: string;
  meetingLink?: string;
  amount: number;
  createdAt: Date;
  updatedAt?: Date;
}

export interface ExpenseCategory {
  id?: string;
  name: string;
  subcategories: string[];
  icon?: string;
  color?: string;
  type: 'expense' | 'income';
}

export interface ExpenseBill {
  id?: number;
  transactionId: number;
  fileName: string;
  fileType: string; // 'image/jpeg', 'application/pdf', etc.
  fileSize: number;
  fileData: Blob; // Store file as blob in Dexie
  uploadedAt: Date;
  notes?: string;
}

export interface ToDoList {
  id?: number;
  name: string;
  description?: string;
  ownerId: string; // Could be userId or identifier
  createdAt: Date;
  updatedAt?: Date;
  archived: boolean;
}

export interface ToDoItem {
  id?: number;
  listId: number;
  title: string;
  description?: string;
  completed: boolean;
  priority: 'low' | 'medium' | 'high';
  dueDate?: Date;
  createdBy: string;
  createdAt: Date;
  updatedAt?: Date;
  completedAt?: Date;
}

export interface ToDoListShare {
  id?: number;
  listId: number;
  sharedWithUserId: string;
  permission: 'view' | 'edit';
  sharedAt: Date;
  sharedBy: string;
}

export interface AdvisorAssignment {
  id?: number;
  advisorId: string; // Supabase user ID
  userId: string; // Supabase user ID
  assignedAt: Date;
  notes?: string;
  status: 'active' | 'inactive';
}

export interface ChatConversation {
  id?: number;
  conversationId: string; // advisorId_userId  
  advisorId: string;
  userId: string;
  advisorInitiated?: boolean;
  lastMessage?: string;
  lastMessageTime?: Date;
  unreadCount?: number;
  createdAt?: Date;
}

export interface ChatMessage {
  id?: number;
  conversationId: string; // advisorId_userId
  senderId: string; // Supabase user ID
  senderRole: 'advisor' | 'user';
  message: string;
  timestamp: Date;
  isRead: boolean;
  attachmentUrl?: string;
}

export interface BookingRequest {
  id?: number;
  advisorId: string; // Supabase user ID
  userId: string; // Supabase user ID
  advisorName: string;
  userEmail: string;
  requestedDate?: Date;
  preferredTime?: string;
  topic?: string;
  message?: string;
  status: 'pending' | 'accepted' | 'rejected' | 'completed' | 'reschedule';
  sessionType: 'video' | 'audio' | 'chat';
  responseMessage?: string; // Advisor's response (e.g., for reschedule)
  createdAt: Date;
  respondedAt?: Date;
  sequenceNumber?: number; // For sorting
}

export interface Notification {
  id?: number;
  type: 'emi' | 'loan' | 'goal' | 'group' | 'booking' | 'message' | 'session';
  title: string;
  message: string;
  dueDate?: Date;
  isRead: boolean;
  relatedId?: number;
  createdAt: Date;
  userId?: string;
  deepLink?: string; // e.g., "/calendar?session=123"
}

// Database Class
export class FinoraDB extends Dexie {
  accounts!: Table<Account>;
  friends!: Table<Friend>;
  transactions!: Table<Transaction>;
  loans!: Table<Loan>;
  loanPayments!: Table<LoanPayment>;
  goals!: Table<Goal>;
  goalContributions!: Table<GoalContribution>;
  groupExpenses!: Table<GroupExpense>;
  investments!: Table<Investment>;
  notifications!: Table<Notification>;

  constructor() {
    super('FinoraDB');
    this.version(1).stores({
      accounts: '++id, type, isActive',
      transactions: '++id, type, accountId, category, date',
      loans: '++id, type, status, dueDate',
      loanPayments: '++id, loanId, date',
      goals: '++id, isGroupGoal, targetDate',
      goalContributions: '++id, goalId, date',
      groupExpenses: '++id, date',
      investments: '++id, assetType',
      notifications: '++id, type, dueDate, isRead',
    });
    // Add friends table in version 2
    this.version(2).stores({
      accounts: '++id, type, isActive',
      friends: '++id, name, createdAt',
      transactions: '++id, type, accountId, category, date',
      loans: '++id, type, status, dueDate, friendId',
      loanPayments: '++id, loanId, date',
      goals: '++id, isGroupGoal, targetDate',
      goalContributions: '++id, goalId, date',
      groupExpenses: '++id, date',
      investments: '++id, assetType',
      notifications: '++id, type, dueDate, isRead',
    });
  }
}

// Add additional tables for production features
export class ProductionDB extends FinoraDB {
    gold!: Table<GoldEntry>;
  logs!: Table<{ id: string; level: string; message: string; timestamp: Date }>;
  errorReports!: Table<{ id: string; report: string; timestamp: Date }>;
  backups!: Table<{ id: string; data: string; timestamp: Date; size: number }>;
  settings!: Table<{ key: string; value: any; timestamp: Date }>;
  categories!: Table<{ id: string; name: string; type: string; color: string; icon: string }>;
  budgets!: Table<{ id: string; category: string; amount: number; period: string; spent: number; createdAt: Date }>;
  groups!: Table<{ id: string; name: string; members: string[]; createdAt: Date }>;
  taxCalculations!: Table<TaxCalculation>;
  financeAdvisors!: Table<FinanceAdvisor>;
  advisorSessions!: Table<AdvisorSession>;
  expenseCategories!: Table<ExpenseCategory>;
  expenseBills!: Table<ExpenseBill>;
  toDoLists!: Table<ToDoList>;
  toDoItems!: Table<ToDoItem>;
  toDoListShares!: Table<ToDoListShare>;
  advisorAssignments!: Table<AdvisorAssignment>;
  chatMessages!: Table<ChatMessage>;
  chatConversations!: Table<ChatConversation>;
  bookingRequests!: Table<BookingRequest>;

  constructor() {
    super();
    this.version(3).stores({
      accounts: '++id, type, isActive',
      friends: '++id, name, createdAt',
      transactions: '++id, type, accountId, category, date',
      loans: '++id, type, status, dueDate, friendId',
      loanPayments: '++id, loanId, date',
      goals: '++id, isGroupGoal, targetDate',
      goalContributions: '++id, goalId, date',
      groupExpenses: '++id, date',
      investments: '++id, assetType',
      notifications: '++id, type, userId, isRead, createdAt',
      gold: '++id, type, unit, purchaseDate',
      logs: 'id, level, timestamp',
      errorReports: 'id, timestamp',
      backups: 'id, timestamp',
      settings: 'key',
      categories: 'id, type',
      budgets: 'id, category, period',
      groups: 'id',
      taxCalculations: '++id, year',
      financeAdvisors: '++id, verified, rating',
      advisorSessions: '++id, advisorId, date, status',
      expenseCategories: 'id, type',
      expenseBills: '++id, transactionId, uploadedAt',
      toDoLists: '++id, ownerId, createdAt, archived',
      toDoItems: '++id, listId, completed, dueDate, priority',
      toDoListShares: '++id, listId, sharedWithUserId',
      advisorAssignments: '++id, advisorId, userId, status',
      chatMessages: '++id, conversationId, timestamp, isRead',
      chatConversations: '++id, conversationId, advisorId, userId',
      bookingRequests: '++id, advisorId, userId, status, createdAt, sequenceNumber',
    });
    
    this.version(4).stores({
      accounts: '++id, type, isActive',
      friends: '++id, name, createdAt',
      transactions: '++id, type, accountId, category, date',
      loans: '++id, type, status, dueDate, friendId',
      loanPayments: '++id, loanId, date',
      goals: '++id, isGroupGoal, targetDate',
      goalContributions: '++id, goalId, date',
      groupExpenses: '++id, date',
      investments: '++id, assetType',
      notifications: '++id, type, userId, isRead, createdAt',
      gold: '++id, type, unit, purchaseDate',
      logs: 'id, level, timestamp',
      errorReports: 'id, timestamp',
      backups: 'id, timestamp',
      settings: 'key',
      categories: 'id, type',
      budgets: 'id, category, period',
      groups: 'id',
      taxCalculations: '++id, year',
      financeAdvisors: '++id, verified, rating',
      advisorSessions: '++id, advisorId, date, status',
      expenseCategories: 'id, type',
      expenseBills: '++id, transactionId, uploadedAt',
      toDoLists: '++id, ownerId, createdAt, archived',
      toDoItems: '++id, listId, completed, dueDate, priority',
      toDoListShares: '++id, listId, sharedWithUserId',
      advisorAssignments: '++id, advisorId, userId, status',
      chatMessages: '++id, conversationId, timestamp, isRead',
      chatConversations: '++id, conversationId, advisorId, userId',
      bookingRequests: '++id, advisorId, userId, status, createdAt, sequenceNumber',
    });

    this.version(5).stores({
      accounts: '++id, type, isActive',
      friends: '++id, name, createdAt',
      transactions: '++id, type, accountId, category, date',
      loans: '++id, type, status, dueDate, friendId',
      loanPayments: '++id, loanId, date',
      goals: '++id, isGroupGoal, targetDate',
      goalContributions: '++id, goalId, date',
      groupExpenses: '++id, date',
      investments: '++id, assetType, positionStatus, assetCurrency, baseCurrency',
      notifications: '++id, type, userId, isRead, createdAt',
      gold: '++id, type, unit, purchaseDate',
      logs: 'id, level, timestamp',
      errorReports: 'id, timestamp',
      backups: 'id, timestamp',
      settings: 'key',
      categories: 'id, type',
      budgets: 'id, category, period',
      groups: 'id',
      taxCalculations: '++id, year',
      financeAdvisors: '++id, verified, rating',
      advisorSessions: '++id, advisorId, date, status',
      expenseCategories: 'id, type',
      expenseBills: '++id, transactionId, uploadedAt',
      toDoLists: '++id, ownerId, createdAt, archived',
      toDoItems: '++id, listId, completed, dueDate, priority',
      toDoListShares: '++id, listId, sharedWithUserId',
      advisorAssignments: '++id, advisorId, userId, status',
      chatMessages: '++id, conversationId, timestamp, isRead',
      chatConversations: '++id, conversationId, advisorId, userId',
      bookingRequests: '++id, advisorId, userId, status, createdAt, sequenceNumber',
    }).upgrade(async (tx) => {
      const investmentTable = tx.table('investments');
      const legacyInvestments = await investmentTable.toArray();

      for (const record of legacyInvestments as Array<Record<string, any>>) {
        const assetName = String(record.assetName || '').toUpperCase();
        const assetType = String(record.assetType || '').toLowerCase();
        let inferredCurrency = 'USD';

        if (assetName.endsWith('.NS') || assetName.endsWith('.BO')) {
          inferredCurrency = 'INR';
        } else if (assetName.endsWith('-USD') || assetType === 'crypto') {
          inferredCurrency = 'USD';
        } else if (assetName.endsWith('=X') && assetName.length >= 6) {
          inferredCurrency = assetName.slice(3, 6);
        } else if (assetType === 'gold' || assetType === 'silver' || assetType === 'other') {
          inferredCurrency = record.baseCurrency || 'USD';
        }

        await investmentTable.put({
          ...record,
          broker: record.broker ?? '',
          description: record.description ?? '',
          assetCurrency: record.assetCurrency ?? inferredCurrency,
          baseCurrency: record.baseCurrency ?? inferredCurrency,
          buyFxRate: record.buyFxRate ?? 1,
          lastKnownFxRate: record.lastKnownFxRate ?? 1,
          totalInvestedNative: record.totalInvestedNative ?? (Number(record.buyPrice) || 0) * (Number(record.quantity) || 0),
          currentValueNative: record.currentValueNative ?? (Number(record.currentPrice) || 0) * (Number(record.quantity) || 0),
          positionStatus: record.positionStatus ?? 'open',
          fundingAccountId: record.fundingAccountId ?? undefined,
          purchaseFees: record.purchaseFees ?? 0,
          purchaseTransactionId: record.purchaseTransactionId ?? undefined,
          purchaseFeeTransactionId: record.purchaseFeeTransactionId ?? undefined,
          saleTransactionId: record.saleTransactionId ?? undefined,
          saleFeeTransactionId: record.saleFeeTransactionId ?? undefined,
          closeNotes: record.closeNotes ?? '',
        });
      }
    });
  }
}

export const db = new ProductionDB();
