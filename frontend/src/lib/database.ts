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
  // Transfer specific fields
  transferToAccountId?: number;
  transferType?: 'self-transfer' | 'other-transfer'; // self-transfer is between own accounts
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
  emiAmount?: number;
  dueDate?: Date;
  frequency?: 'monthly' | 'weekly' | 'custom';
  status: 'active' | 'overdue' | 'completed';
  contactPerson?: string;
  friendId?: number; // Reference to Friend
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
  createdAt: Date;
}

export interface GroupMember {
  name: string;
  share: number;
  paid: boolean;
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
  updatedAt?: Date;
  deletedAt?: Date;
}

export interface Notification {
  id?: number;
  type: 'emi' | 'loan' | 'goal' | 'group';
  title: string;
  message: string;
  dueDate: Date;
  isRead: boolean;
  relatedId?: number;
  createdAt: Date;
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
  name: string;
  email: string;
  phone: string;
  specialization: string[];
  qualifications: string[];
  experience: number; // years
  rating: number; // 1-5
  availability: string[];
  hourlyRate: number;
  bio?: string;
  verified: boolean;
  createdAt: Date;
}

export interface AdvisorSession {
  id?: number;
  advisorId: number;
  date: Date;
  duration: number; // minutes
  type: 'video' | 'audio' | 'chat';
  status: 'scheduled' | 'completed' | 'cancelled';
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

export interface Notification {
  id?: number;
  type: 'emi' | 'loan' | 'goal' | 'group';
  title: string;
  message: string;
  dueDate: Date;
  isRead: boolean;
  relatedId?: number;
  createdAt: Date;
}

// Database Class
export class FinanceLifeDB extends Dexie {
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
    super('FinanceLifeDB');
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
export class ProductionDB extends FinanceLifeDB {
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
      notifications: '++id, type, dueDate, isRead',
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
      toDoListShares: '++id, listId, sharedWithUserId'
    });
  }
}

export const db = new ProductionDB();
