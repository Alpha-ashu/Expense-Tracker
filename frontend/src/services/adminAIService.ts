import { TokenManager } from '@/lib/api';

const API_BASE = (import.meta.env.VITE_API_URL || '/api/v1').replace(/\/+$/, '');

export interface AIOverviewDto {
  usersAnalyzed: number;
  activeModels: number;
  lastTrainingTime: string | null;
  dataProcessed: number;
  insightsGenerated: number;
  riskAlerts: number;
}

export interface AIUserIntelligenceDto {
  userId: string;
  email: string;
  name: string;
  spendScore: number;
  riskScore: number;
  savingsRate: number;
  topCategory: string;
  avgSpend: number;
}

export interface AIInsightFeedDto {
  id: string;
  userId: string;
  userEmail: string;
  insightType: string;
  insightData: Record<string, unknown>;
  confidenceScore: number;
  createdAt: string;
}

export interface AIPatternAnalyticsDto {
  categoryDistribution: Array<{ category: string; users: number }>;
  insightTrends: Array<{ insightType: string; total: number }>;
  monthlyGrowth: Array<{ month: string; income: number; expense: number; net: number }>;
}

export interface AIAccuracyDto {
  totalPredictions: number;
  averageConfidence: number;
  highConfidenceRate: number;
  falsePositiveRate: number;
  successRate: number;
}

export interface AIRawUserDataDto {
  features: {
    userId: string;
    avgSpend: number;
    monthlyIncome: number;
    savingsRate: number;
    topCategory: string;
    riskScore: number;
    peakDay: string;
    featureData: Record<string, unknown>;
    updatedAt: string;
  } | null;
  insights: Array<{
    id: string;
    insightType: string;
    insightData: Record<string, unknown>;
    confidenceScore: number;
    createdAt: string;
  }>;
  events: Array<{
    id: string;
    eventType: string;
    metadata: Record<string, unknown>;
    createdAt: string;
  }>;
}

const getToken = () => TokenManager.getAccessToken() || '';

const request = async <T>(endpoint: string, options?: RequestInit): Promise<T> => {
  const token = getToken();
  const response = await fetch(`${API_BASE}${endpoint}`, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...(options?.headers || {}),
    },
  });

  const payload = (await response.json().catch(() => ({}))) as { success?: boolean; data?: T; error?: string };

  if (!response.ok || payload.success === false) {
    throw new Error(payload.error || `Request failed: ${response.status}`);
  }

  return (payload.data ?? payload) as T;
};

export const adminAIService = {
  getOverview: () => request<AIOverviewDto>('/admin/ai/overview'),
  getUsers: (limit = 50) => request<AIUserIntelligenceDto[]>(`/admin/ai/users?limit=${limit}`),
  getInsights: (limit = 80) => request<AIInsightFeedDto[]>(`/admin/ai/insights?limit=${limit}`),
  getPatterns: () => request<AIPatternAnalyticsDto>('/admin/ai/patterns'),
  getAccuracy: () => request<AIAccuracyDto>('/admin/ai/accuracy'),
  getRawUserData: (userId: string) => request<AIRawUserDataDto>(`/admin/ai/raw/${userId}`),
  runFeatureEngine: () => request<{ processedUsers: number }>('/admin/ai/run/features', { method: 'POST', body: JSON.stringify({}) }),
  runPredictionEngine: () => request<{ processedUsers: number }>('/admin/ai/run/predictions', { method: 'POST', body: JSON.stringify({}) }),
};
