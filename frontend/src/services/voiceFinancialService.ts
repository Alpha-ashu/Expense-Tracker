/**
 * Voice Financial Intelligence Service
 * Calls the backend NLP endpoint to extract structured financial actions from voice transcript
 */

import { backendService } from '@/lib/backend-api';

export interface FinancialActionEntities {
  amount?: number;
  currency?: string;
  category?: string;
  subcategory?: string;
  person?: string;
  merchant?: string;
  description?: string;
  date?: string;
  paymentMethod?: string;
  goalTarget?: number;
  goalDuration?: string;
  goalMonthly?: number;
}

export interface FinancialAction {
  type: 'expense' | 'income' | 'transfer' | 'loan_borrow' | 'loan_lend' | 'goal' | 'investment' | 'unknown';
  rawSegment: string;
  entities: FinancialActionEntities;
  confidence: number;
  requiresReview: boolean;
}

export interface VoiceProcessResponse {
  success: boolean;
  transcript: string;
  actions: FinancialAction[];
  totalActions: number;
  requiresReview: boolean;
}

export async function processVoiceTranscript(transcript: string): Promise<VoiceProcessResponse> {
  const response = await backendService.post<VoiceProcessResponse>(
    '/voice/process',
    { transcript }
  );
  return response;
}

export async function submitVoiceCorrection(correction: {
  originalSegment: string;
  correctedType?: string;
  correctedCategory?: string;
  correctedAmount?: number;
}): Promise<void> {
  try {
    await backendService.post('/voice/learn', correction);
  } catch {
    // Non-critical, ignore learning failures
  }
}

export function getActionTypeLabel(type: FinancialAction['type']): string {
  const labels: Record<string, string> = {
    expense: '💸 Expense',
    income: '💰 Income',
    transfer: '↔️ Transfer',
    loan_borrow: '🏦 Borrowed',
    loan_lend: '🤝 Lent',
    goal: '🎯 Goal',
    investment: '📈 Investment',
    unknown: '❓ Unknown',
  };
  return labels[type] ?? type;
}

export function getActionTypeColor(type: FinancialAction['type']): string {
  const colors: Record<string, string> = {
    expense: 'bg-rose-50 border-rose-200 text-rose-700',
    income: 'bg-emerald-50 border-emerald-200 text-emerald-700',
    transfer: 'bg-indigo-50 border-indigo-200 text-indigo-700',
    loan_borrow: 'bg-amber-50 border-amber-200 text-amber-700',
    loan_lend: 'bg-blue-50 border-blue-200 text-blue-700',
    goal: 'bg-purple-50 border-purple-200 text-purple-700',
    investment: 'bg-teal-50 border-teal-200 text-teal-700',
    unknown: 'bg-gray-50 border-gray-200 text-gray-700',
  };
  return colors[type] ?? colors.unknown;
}

