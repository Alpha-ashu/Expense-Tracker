// Backend API Service - Replaces local-only storage with cloud-based persistence
import axios, { AxiosInstance } from 'axios';

const API_BASE_URL = process.env.REACT_APP_API_URL || 'http://localhost:5000/api/v1';

class BackendService {
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
    interestRate?: number;
    emiAmount?: number;
    dueDate?: Date;
    frequency?: string;
    contactPerson?: string;
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
}

export const backendService = new BackendService();
