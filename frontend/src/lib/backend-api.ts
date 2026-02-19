// Backend API Service - Replaces local-only storage with cloud-based persistence
import axios, { AxiosInstance } from 'axios';

// Use a default API URL for development, can be overridden by environment variables
const API_BASE_URL = 'http://localhost:5000/api/v1';

class BackendService {
  // ===== GOLD =====
  async createGold(gold: {
    type: string;
    quantity: number;
    unit: string;
    purchasePrice: number;
    currentPrice: number;
    purchaseDate: Date;
    purityPercentage: number;
    location: string;
    certificateNumber?: string;
    notes?: string;
    createdAt: Date;
    updatedAt: Date;
  }) {
    const response = await this.api.post('/gold', {
      ...gold,
      purchaseDate: gold.purchaseDate.toISOString(),
      createdAt: gold.createdAt.toISOString(),
      updatedAt: gold.updatedAt.toISOString(),
    });
    return response.data;
  }

  // ===== GROUPS =====
  async createGroup(group: {
    id?: string;
    name: string;
    members: string[];
    createdAt: Date;
    description?: string;
    totalAmount?: number;
    amountPerPerson?: number;
    category?: string;
    date?: Date;
  }) {
    const response = await this.api.post('/groups', {
      ...group,
      createdAt: group.createdAt.toISOString(),
      date: group.date ? group.date.toISOString() : undefined,
    });
    return response.data;
  }

  // ===== INVESTMENTS =====
  async createInvestment(investment: {
    assetType: string;
    assetName: string;
    quantity: number;
    buyPrice: number;
    currentPrice: number;
    totalInvested: number;
    currentValue: number;
    profitLoss: number;
    purchaseDate: Date;
    lastUpdated: Date;
    updatedAt: Date;
    deletedAt?: Date;
    broker?: string;
    description?: string;
  }) {
    const response = await this.api.post('/investments', {
      ...investment,
      purchaseDate: investment.purchaseDate.toISOString(),
      lastUpdated: investment.lastUpdated.toISOString(),
      updatedAt: investment.updatedAt.toISOString(),
      deletedAt: investment.deletedAt ? investment.deletedAt.toISOString() : undefined,
    });
    return response.data;
  }
  private api: AxiosInstance;
  private token: string | null = null;

  constructor() {
    this.api = axios.create({
      baseURL: API_BASE_URL,
      headers: {
        'Content-Type': 'application/json',
      },
    });

    // Add token to every request
    this.api.interceptors.request.use((config) => {
      if (this.token) {
        config.headers.Authorization = `Bearer ${this.token}`;
      }
      return config;
    });
  }

  // Auth Methods
  setToken(token: string) {
    this.token = token;
  }

  clearToken() {
    this.token = null;
  }

  // ===== TRANSACTIONS =====
  async getTransactions(filters?: {
    accountId?: string;
    startDate?: Date;
    endDate?: Date;
    category?: string;
  }) {
    const params = new URLSearchParams();
    if (filters?.accountId) params.append('accountId', filters.accountId);
    if (filters?.startDate) params.append('startDate', filters.startDate.toISOString());
    if (filters?.endDate) params.append('endDate', filters.endDate.toISOString());
    if (filters?.category) params.append('category', filters.category);

    const response = await this.api.get('/transactions', { params });
    return response.data;
  }

  async createTransaction(transaction: {
    accountId: string;
    type: 'expense' | 'income' | 'transfer';
    amount: number;
    category: string;
    subcategory?: string;
    description?: string;
    merchant?: string;
    date: Date;
    tags?: string[];
    transferToAccountId?: string;
    transferType?: string;
  }) {
    const response = await this.api.post('/transactions', {
      ...transaction,
      date: transaction.date.toISOString(),
    });
    return response.data;
  }

  async updateTransaction(id: string, updates: any) {
    const response = await this.api.put(`/transactions/${id}`, updates);
    return response.data;
  }

  async deleteTransaction(id: string) {
    await this.api.delete(`/transactions/${id}`);
  }

  async getAccountTransactions(accountId: string) {
    const response = await this.api.get(`/transactions/account/${accountId}`);
    return response.data;
  }

  // ===== ACCOUNTS =====
  async getAccounts() {
    const response = await this.api.get('/accounts');
    return response.data;
  }

  async createAccount(account: {
    name: string;
    type: string;
    balance?: number;
    currency?: string;
  }) {
    const response = await this.api.post('/accounts', account);
    return response.data;
  }

  async getAccount(id: string) {
    const response = await this.api.get(`/accounts/${id}`);
    return response.data;
  }

  async updateAccount(id: string, updates: any) {
    const response = await this.api.put(`/accounts/${id}`, updates);
    return response.data;
  }

  async deleteAccount(id: string) {
    await this.api.delete(`/accounts/${id}`);
  }

  // ===== GOALS =====
  async getGoals() {
    const response = await this.api.get('/goals');
    return response.data;
  }

  async createGoal(goal: {
    name: string;
    targetAmount: number;
    currentAmount?: number;
    targetDate: Date;
    category?: string;
    isGroupGoal?: boolean;
  }) {
    const response = await this.api.post('/goals', {
      ...goal,
      targetDate: goal.targetDate.toISOString(),
    });
    return response.data;
  }

  async getGoal(id: string) {
    const response = await this.api.get(`/goals/${id}`);
    return response.data;
  }

  async updateGoal(id: string, updates: any) {
    const response = await this.api.put(`/goals/${id}`, updates);
    return response.data;
  }

  async deleteGoal(id: string) {
    await this.api.delete(`/goals/${id}`);
  }

  // ===== LOANS =====
  async getLoans() {
    const response = await this.api.get('/loans');
    return response.data;
  }

  async createLoan(loan: {
    type: string;
    name: string;
    principalAmount: number;
    outstandingBalance?: number;
    interestRate?: number;
    emiAmount?: number;
    dueDate?: Date;
    frequency?: string;
    contactPerson?: string;
    friendId?: string;
    status?: string;
    createdAt?: Date;
    updatedAt?: Date;
    deletedAt?: Date;
  }) {
    const response = await this.api.post('/loans', {
      ...loan,
      dueDate: loan.dueDate?.toISOString(),
    });
    return response.data;
  }

  async getLoan(id: string) {
    const response = await this.api.get(`/loans/${id}`);
    return response.data;
  }

  async updateLoan(id: string, updates: any) {
    const response = await this.api.put(`/loans/${id}`, updates);
    return response.data;
  }

  async deleteLoan(id: string) {
    await this.api.delete(`/loans/${id}`);
  }

  async addLoanPayment(loanId: string, payment: {
    amount: number;
    accountId?: string;
    notes?: string;
  }) {
    const response = await this.api.post(`/loans/${loanId}/payment`, payment);
    return response.data;
  }

  // ===== SETTINGS =====
  async getSettings() {
    const response = await this.api.get('/settings');
    return response.data;
  }

  async updateSettings(settings: {
    theme?: string;
    language?: string;
    currency?: string;
    timezone?: string;
    settings?: Record<string, any>;
  }) {
    const response = await this.api.put('/settings', settings);
    return response.data;
  }

  // ===== FRIENDS =====
  async createFriend(friend: {
    name: string;
    email?: string;
    phone?: string;
    createdAt: Date;
    updatedAt: Date;
  }) {
    const response = await this.api.post('/friends', {
      ...friend,
      createdAt: friend.createdAt.toISOString(),
      updatedAt: friend.updatedAt.toISOString(),
    });
    return response.data;
  }

  // ===== INVESTMENTS =====
  async updateInvestment(id: string, updates: any) {
    const response = await this.api.put(`/investments/${id}`, updates);
    return response.data;
  }

  // ===== BILLS =====
  async getExpenseBills(transactionId?: string) {
    const url = transactionId ? `/bills?transactionId=${transactionId}` : '/bills';
    const response = await this.api.get(url);
    return response.data;
  }

  async uploadExpenseBill(bill: any) {
    const response = await this.api.post('/bills', bill);
    return response.data;
  }

  async deleteExpenseBill(id: string) {
    await this.api.delete(`/bills/${id}`);
  }

  // ===== ADVISOR =====
  async getAdvisorProfile(advisorId?: string) {
    const url = advisorId ? `/advisor/profile/${advisorId}` : '/advisor/profile';
    const response = await this.api.get(url);
    return response.data;
  }

  async getAdvisorAssignments(advisorId?: string) {
    const url = advisorId ? `/advisor/assignments/${advisorId}` : '/advisor/assignments';
    const response = await this.api.get(url);
    return response.data;
  }

  async getAdvisorBookingRequests(advisorId?: string) {
    const url = advisorId ? `/advisor/bookings/${advisorId}` : '/advisor/bookings';
    const response = await this.api.get(url);
    return response.data;
  }

  async getBookingRequest(id: string) {
    const response = await this.api.get(`/advisor/bookings/${id}`);
    return response.data;
  }

  async updateBookingRequest(id: string, updates: any) {
    const response = await this.api.put(`/advisor/bookings/${id}`, updates);
    return response.data;
  }

  async createBookingRequest(booking: any) {
    const response = await this.api.post('/advisor/bookings', booking);
    return response.data;
  }

  async getChatMessages(conversationId: string, advisorId?: string) {
    const url = advisorId ? `/advisor/chat/${conversationId}?advisorId=${advisorId}` : `/advisor/chat/${conversationId}`;
    const response = await this.api.get(url);
    return response.data;
  }

  async sendChatMessage(conversationId: string, message: any, advisorId?: string) {
    const url = advisorId ? `/advisor/chat/${conversationId}?advisorId=${advisorId}` : `/advisor/chat/${conversationId}`;
    const response = await this.api.post(url, message);
    return response.data;
  }

  async createOrUpdateChatConversation(conversation: any, advisorId?: string) {
    const url = advisorId ? `/advisor/chat?advisorId=${advisorId}` : '/advisor/chat';
    const response = await this.api.post(url, conversation);
    return response.data;
  }

  async updateAdvisorAvailability(availability: any, advisorId?: string) {
    const url = advisorId ? `/advisor/availability/${advisorId}` : '/advisor/availability';
    const response = await this.api.put(url, availability);
    return response.data;
  }

  async createNotification(notification: any, advisorId?: string) {
    const url = advisorId ? `/notifications/${advisorId}` : '/notifications';
    const response = await this.api.post(url, notification);
    return response.data;
  }
}

export const backendService = new BackendService();
