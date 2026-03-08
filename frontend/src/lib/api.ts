/**
 * API Utilities
 * Standardized API client with error handling
 */

import { toast } from 'sonner';
import type { ApiResponse, ApiError } from '@/types';

// ==================== Configuration ====================

const API_BASE_URL = import.meta.env.VITE_API_URL || '/api/v1';
const DEFAULT_TIMEOUT = 30000; // 30 seconds

// ==================== Token Management ====================

export const TokenManager = {
  getAccessToken: (): string | null => {
    return localStorage.getItem('accessToken');
  },

  setAccessToken: (token: string): void => {
    localStorage.setItem('accessToken', token);
  },

  getRefreshToken: (): string | null => {
    return localStorage.getItem('refreshToken');
  },

  setRefreshToken: (token: string): void => {
    localStorage.setItem('refreshToken', token);
  },

  clearTokens: (): void => {
    localStorage.removeItem('accessToken');
    localStorage.removeItem('refreshToken');
  },

  setTokens: (accessToken: string, refreshToken: string): void => {
    TokenManager.setAccessToken(accessToken);
    TokenManager.setRefreshToken(refreshToken);
  },
};

// ==================== Error Handler ====================

class APIError extends Error {
  constructor(
    public code: string,
    message: string,
    public status: number,
    public details?: any
  ) {
    super(message);
    this.name = 'APIError';
  }
}

function handleAPIError(error: any): never {
  if (error instanceof APIError) {
    throw error;
  }

  if (error.response) {
    // The request was made and the server responded with a status code
    // that falls out of the range of 2xx
    const { status, data } = error.response;
    const message = data?.message || 'An error occurred';
    const code = data?.code || 'UNKNOWN_ERROR';
    
    throw new APIError(code, message, status, data?.details);
  } else if (error.request) {
    // The request was made but no response was received
    throw new APIError(
      'NETWORK_ERROR',
      'Network error. Please check your connection.',
      0
    );
  } else {
    // Something happened in setting up the request that triggered an Error
    throw new APIError(
      'REQUEST_ERROR',
      error.message || 'Failed to make request',
      0
    );
  }
}

// ==================== HTTP Client ====================

interface RequestConfig extends RequestInit {
  timeout?: number;
  showErrorToast?: boolean;
  showSuccessToast?: boolean;
  successMessage?: string;
}

class HTTPClient {
  private baseURL: string;
  private defaultConfig: RequestConfig;

  constructor(baseURL: string = API_BASE_URL) {
    this.baseURL = baseURL;
    this.defaultConfig = {
      headers: {
        'Content-Type': 'application/json',
      },
      showErrorToast: true,
      showSuccessToast: false,
    };
  }

  private async request<T>(
    endpoint: string,
    config: RequestConfig = {}
  ): Promise<ApiResponse<T>> {
    const {
      timeout = DEFAULT_TIMEOUT,
      showErrorToast = true,
      showSuccessToast = false,
      successMessage,
      ...fetchConfig
    } = { ...this.defaultConfig, ...config };

    // Add auth token if available
    const token = TokenManager.getAccessToken();
    const headers = {
      ...this.defaultConfig.headers,
      ...fetchConfig.headers,
      ...(token && { Authorization: `Bearer ${token}` }),
    };

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), timeout);

    try {
      const response = await fetch(`${this.baseURL}${endpoint}`, {
        ...fetchConfig,
        headers,
        signal: controller.signal,
      });

      clearTimeout(timeoutId);

      const data = await response.json();

      if (!response.ok) {
        const error: ApiError = {
          code: data.code || `HTTP_${response.status}`,
          message: data.message || response.statusText,
          details: data.details,
        };

        if (showErrorToast) {
          toast.error(error.message);
        }

        // Handle 401 Unauthorized
        if (response.status === 401) {
          TokenManager.clearTokens();
          window.location.href = '/login';
        }

        throw new APIError(error.code, error.message, response.status, error.details);
      }

      if (showSuccessToast && successMessage) {
        toast.success(successMessage);
      }

      return {
        success: true,
        data: data.data || data,
        message: data.message,
      };
    } catch (error: any) {
      clearTimeout(timeoutId);

      if (error.name === 'AbortError') {
        const timeoutError = new APIError(
          'TIMEOUT_ERROR',
          'Request timeout. Please try again.',
          0        );
        if (showErrorToast) {
          toast.error(timeoutError.message);
        }
        throw timeoutError;
      }

      return handleAPIError(error);
    }
  }

  async get<T>(endpoint: string, config?: RequestConfig): Promise<ApiResponse<T>> {
    return this.request<T>(endpoint, { ...config, method: 'GET' });
  }

  async post<T>(
    endpoint: string,
    data?: any,
    config?: RequestConfig
  ): Promise<ApiResponse<T>> {
    return this.request<T>(endpoint, {
      ...config,
      method: 'POST',
      body: JSON.stringify(data),
    });
  }

  async put<T>(
    endpoint: string,
    data?: any,
    config?: RequestConfig
  ): Promise<ApiResponse<T>> {
    return this.request<T>(endpoint, {
      ...config,
      method: 'PUT',
      body: JSON.stringify(data),
    });
  }

  async patch<T>(
    endpoint: string,
    data?: any,
    config?: RequestConfig
  ): Promise<ApiResponse<T>> {
    return this.request<T>(endpoint, {
      ...config,
      method: 'PATCH',
      body: JSON.stringify(data),
    });
  }

  async delete<T>(endpoint: string, config?: RequestConfig): Promise<ApiResponse<T>> {
    return this.request<T>(endpoint, { ...config, method: 'DELETE' });
  }
}

// ==================== API Client Instance ====================

export const apiClient = new HTTPClient();

// ==================== Helper Functions ====================

export const api = {
  // Authentication
  auth: {
    login: (credentials: { email: string; password: string }) =>
      apiClient.post('/auth/login', credentials, {
        showSuccessToast: true,
        successMessage: 'Login successful',
      }),
    
    register: (data: { name: string; email: string; password: string }) =>
      apiClient.post('/auth/register', data, {
        showSuccessToast: true,
        successMessage: 'Registration successful',
      }),
    
    logout: () =>
      apiClient.post('/auth/logout', undefined, {
        showSuccessToast: true,
        successMessage: 'Logged out successfully',
      }),
    
    refreshToken: (refreshToken: string) =>
      apiClient.post('/auth/refresh', { refreshToken }),
    
    verifyEmail: (token: string) =>
      apiClient.post('/auth/verify-email', { token }),
    
    resetPassword: (email: string) =>
      apiClient.post('/auth/reset-password', { email }),
    
    changePassword: (oldPassword: string, newPassword: string) =>
      apiClient.post('/auth/change-password', { oldPassword, newPassword }),
  },

  // Accounts
  accounts: {
    getAll: () => apiClient.get('/accounts'),
    getById: (id: string) => apiClient.get(`/accounts/${id}`),
    create: (data: any) =>
      apiClient.post('/accounts', data, {
        showSuccessToast: true,
        successMessage: 'Account created successfully',
      }),
    update: (id: string, data: any) =>
      apiClient.put(`/accounts/${id}`, data, {
        showSuccessToast: true,
        successMessage: 'Account updated successfully',
      }),
    delete: (id: string) =>
      apiClient.delete(`/accounts/${id}`, {
        showSuccessToast: true,
        successMessage: 'Account deleted successfully',
      }),
  },

  // Transactions
  transactions: {
    getAll: (filters?: any) =>
      apiClient.get('/transactions', { body: JSON.stringify(filters) }),
    getById: (id: string) => apiClient.get(`/transactions/${id}`),
    create: (data: any) =>
      apiClient.post('/transactions', data, {
        showSuccessToast: true,
        successMessage: 'Transaction added successfully',
      }),
    update: (id: string, data: any) =>
      apiClient.put(`/transactions/${id}`, data, {
        showSuccessToast: true,
        successMessage: 'Transaction updated successfully',
      }),
    delete: (id: string) =>
      apiClient.delete(`/transactions/${id}`, {
        showSuccessToast: true,
        successMessage: 'Transaction deleted successfully',
      }),
  },

  // Goals
  goals: {
    getAll: () => apiClient.get('/goals'),
    getById: (id: string) => apiClient.get(`/goals/${id}`),
    create: (data: any) =>
      apiClient.post('/goals', data, {
        showSuccessToast: true,
        successMessage: 'Goal created successfully',
      }),
    update: (id: string, data: any) =>
      apiClient.put(`/goals/${id}`, data, {
        showSuccessToast: true,
        successMessage: 'Goal updated successfully',
      }),
    delete: (id: string) =>
      apiClient.delete(`/goals/${id}`, {
        showSuccessToast: true,
        successMessage: 'Goal deleted successfully',
      }),
    addContribution: (id: string, amount: number) =>
      apiClient.post(`/goals/${id}/contributions`, { amount }),
  },

  // Loans
  loans: {
    getAll: () => apiClient.get('/loans'),
    getById: (id: string) => apiClient.get(`/loans/${id}`),
    create: (data: any) =>
      apiClient.post('/loans', data, {
        showSuccessToast: true,
        successMessage: 'Loan added successfully',
      }),
    update: (id: string, data: any) =>
      apiClient.put(`/loans/${id}`, data, {
        showSuccessToast: true,
        successMessage: 'Loan updated successfully',
      }),
    delete: (id: string) =>
      apiClient.delete(`/loans/${id}`, {
        showSuccessToast: true,
        successMessage: 'Loan deleted successfully',
      }),
    addPayment: (id: string, data: any) =>
      apiClient.post(`/loans/${id}/payments`, data),
  },

  // Investments
  investments: {
    getAll: () => apiClient.get('/investments'),
    getById: (id: string) => apiClient.get(`/investments/${id}`),
    create: (data: any) =>
      apiClient.post('/investments', data, {
        showSuccessToast: true,
        successMessage: 'Investment added successfully',
      }),
    update: (id: string, data: any) =>
      apiClient.put(`/investments/${id}`, data, {
        showSuccessToast: true,
        successMessage: 'Investment updated successfully',
      }),
    delete: (id: string) =>
      apiClient.delete(`/investments/${id}`, {
        showSuccessToast: true,
        successMessage: 'Investment deleted successfully',
      }),
  },

  // Reports
  reports: {
    getSummary: (period: string) => apiClient.get(`/reports/summary?period=${period}`),
    getCategoryBreakdown: () => apiClient.get('/reports/category-breakdown'),
    getTrends: () => apiClient.get('/reports/trends'),
    export: (format: 'pdf' | 'excel' | 'csv', filters?: any) =>
      apiClient.post('/reports/export', { format, filters }),
  },

  // Admin
  admin: {
    getUsers: () => apiClient.get('/admin/users'),
    getFeatureFlags: () => apiClient.get('/admin/feature-flags'),
    updateFeatureFlag: (id: string, enabled: boolean) =>
      apiClient.put(`/admin/feature-flags/${id}`, { enabled }),
    getAnalytics: () => apiClient.get('/admin/analytics'),
  },
};

export default api;
