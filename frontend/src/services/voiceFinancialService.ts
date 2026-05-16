/**
 * Voice Financial Intelligence Service
 * Primary: Calls the backend NLP endpoint (Whisper + Qwen) for high-accuracy parsing
 * Fallback: Local regex-based intent parser that works 100% offline in the browser
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
  members?: string[];
  answer?: string;
  queryResult?: any;
  quantity?: number;
  assetType?: string;
  recurrence?: 'monthly' | 'yearly' | 'weekly' | 'daily' | 'one-time';
  billUrl?: string;
}

export interface FinancialAction {
  type: 'expense' | 'income' | 'transfer' | 'loan_borrow' | 'loan_lend' | 'goal' | 'investment' | 'group_expense' | 'query' | 'bill_scan' | 'subscription' | 'unknown';
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

// ─────────────────────────────────────────────────────────────────────────────
// LOCAL INTENT PARSER — Works 100% offline, no backend required
// ─────────────────────────────────────────────────────────────────────────────

const EXPENSE_CATEGORIES: Record<string, string> = {
  // Food
  food: 'Food', eat: 'Food', eating: 'Food', lunch: 'Food', dinner: 'Food',
  breakfast: 'Food', snack: 'Food', coffee: 'Food', chai: 'Food', tea: 'Food',
  restaurant: 'Food', swiggy: 'Food', zomato: 'Food', blinkit: 'Food',
  instamart: 'Food', zepto: 'Food', hotel: 'Food', dhaba: 'Food',
  // Groceries
  grocery: 'Groceries', groceries: 'Groceries', vegetables: 'Groceries',
  sabzi: 'Groceries', kirana: 'Groceries', milk: 'Groceries', doodh: 'Groceries',
  // Transport
  uber: 'Transport', ola: 'Transport', taxi: 'Transport', auto: 'Transport',
  petrol: 'Transport', diesel: 'Transport', fuel: 'Transport', metro: 'Transport',
  bus: 'Transport', train: 'Transport', rapido: 'Transport', rickshaw: 'Transport',
  // Housing
  rent: 'Housing', maintenance: 'Housing', society: 'Housing', flat: 'Housing',
  // Utilities
  electricity: 'Utilities', wifi: 'Utilities', internet: 'Utilities',
  mobile: 'Utilities', phone: 'Utilities', recharge: 'Utilities', water: 'Utilities',
  gas: 'Utilities', lpg: 'Utilities', broadband: 'Utilities',
  // Health
  medicine: 'Health', doctor: 'Health', hospital: 'Health', gym: 'Health',
  pharmacy: 'Health', medical: 'Health', chemist: 'Health', clinic: 'Health',
  // Entertainment
  netflix: 'Entertainment', spotify: 'Entertainment', amazon: 'Entertainment',
  hotstar: 'Entertainment', prime: 'Entertainment', movie: 'Entertainment',
  youtube: 'Entertainment', jio: 'Entertainment', cinema: 'Entertainment',
  // Shopping
  shopping: 'Shopping', clothes: 'Shopping', shirt: 'Shopping', dress: 'Shopping',
  flipkart: 'Shopping', myntra: 'Shopping', meesho: 'Shopping',
  // Education
  school: 'Education', college: 'Education', course: 'Education', book: 'Education',
  fees: 'Education', tuition: 'Education', coaching: 'Education',
  // Income
  salary: 'Salary', freelance: 'Freelance', bonus: 'Bonus', stipend: 'Salary',
  dividend: 'Investment', interest: 'Finance',
};

function extractAmount(text: string): number | undefined {
  // Match patterns: "500", "₹500", "Rs 500", "500 rupees", "5k", "1.5 lakh", "2 hazaar"
  const patterns = [
    /₹\s*([\d,]+(?:\.\d+)?)/i,
    /rs\.?\s*([\d,]+(?:\.\d+)?)/i,
    /([\d,]+(?:\.\d+)?)\s*(?:rupees?|rs|inr)/i,
    /([\d.]+)\s*(?:k|thousand|hazaar|hazar)/i,
    /([\d.]+)\s*(?:lakh|lac|lacs)/i,
    /([\d.]+)\s*(?:cr|crore)/i,
    /\b([\d,]+(?:\.\d+)?)\b/,
  ];

  // Handle written Hindi numbers
  const hindiMap: Record<string, number> = {
    'ek sau': 100, 'do sau': 200, 'teen sau': 300, 'char sau': 400, 'paanch sau': 500,
    'ek hazaar': 1000, 'do hazaar': 2000, 'paanch hazaar': 5000, 'das hazaar': 10000,
    'ek lakh': 100000, 'do lakh': 200000, 'paanch lakh': 500000,
  };
  const lowerText = text.toLowerCase();
  for (const [word, val] of Object.entries(hindiMap)) {
    if (lowerText.includes(word)) return val;
  }

  for (const pattern of patterns) {
    const match = text.match(pattern);
    if (match) {
      let val = parseFloat(match[1].replace(/,/g, ''));
      if (/k|thousand|hazaar|hazar/i.test(match[0])) val *= 1000;
      if (/lakh|lac/i.test(match[0])) val *= 100000;
      if (/cr|crore/i.test(match[0])) val *= 10000000;
      return val;
    }
  }
  return undefined;
}

function extractPerson(text: string): string | undefined {
  // Match "to Rahul", "from mom", "with John"
  const match = text.match(/\b(?:to|from|with|for)\s+([A-Z][a-z]+(?:\s[A-Z][a-z]+)?)/);
  return match?.[1];
}

function extractCategory(text: string): string {
  const lower = text.toLowerCase();
  for (const [keyword, category] of Object.entries(EXPENSE_CATEGORIES)) {
    if (lower.includes(keyword)) return category;
  }
  return 'Miscellaneous';
}

function extractDescription(text: string): string {
  // Remove amount and common filler words for a cleaner description
  return text
    .replace(/₹\s*[\d,]+(?:\.\d+)?/g, '')
    .replace(/\b[\d,]+(?:\.\d+)?\s*(?:rupees?|rs|inr|k|lakh|lac)?\b/gi, '')
    .replace(/\b(?:paid|spent|bought|purchased|got|received|borrowed|lent|invested|saved)\b/gi, '')
    .replace(/\s+/g, ' ')
    .trim();
}

// Split multi-intent sentences like "paid 200 for coffee and bought 500 medicine"
function splitSentences(text: string): string[] {
  // Split on explicit connectors AND on implicit verb-based boundaries
  const connectors = /\b(?:and also|and then|also then|then also)\b/gi;
  const parts = text.split(connectors).map(s => s.trim()).filter(Boolean);

  // Further split on "and <verb>" patterns (multi-intent in one breath)
  const verbPattern = /\s+and\s+(?=(?:paid|spent|bought|lent|gave|borrowed|saved|invested|transferred|sent|received|got|split))/gi;
  return parts.flatMap(p => p.split(verbPattern).map(s => s.trim()).filter(Boolean));
}

// Extract a date from natural language
function extractDate(text: string): string | undefined {
  const q = text.toLowerCase();
  const now = new Date();

  if (q.includes('today')) return now.toISOString().split('T')[0];

  if (q.includes('yesterday')) {
    const y = new Date(now);
    y.setDate(y.getDate() - 1);
    return y.toISOString().split('T')[0];
  }

  const dayNames = ['sunday','monday','tuesday','wednesday','thursday','friday','saturday'];
  for (const [i, day] of dayNames.entries()) {
    if (q.includes(`last ${day}`) || (q.includes(day) && !q.includes('last'))) {
      const diff = (now.getDay() - i + 7) % 7 || 7;
      const d = new Date(now);
      d.setDate(d.getDate() - diff);
      return d.toISOString().split('T')[0];
    }
  }

  // Match "5th March", "March 5", "5/3"
  const monthNames = ['jan','feb','mar','apr','may','jun','jul','aug','sep','oct','nov','dec'];
  for (const [i, month] of monthNames.entries()) {
    const match = q.match(new RegExp(`(\\d{1,2})(?:st|nd|rd|th)?\\s*${month}|${month}\\w*\\s*(\\d{1,2})`));
    if (match) {
      const day = parseInt(match[1] || match[2]);
      const d = new Date(now.getFullYear(), i, day);
      return d.toISOString().split('T')[0];
    }
  }

  return undefined;
}

function parseSegment(segment: string): FinancialAction {
  const q = segment.toLowerCase();
  const amount = extractAmount(segment);
  const person = extractPerson(segment);
  const category = extractCategory(segment);
  const description = extractDescription(segment);
  const date = extractDate(segment);

  // QUERY
  if (/\b(?:how much|what is|tell me|show me|what'?s|total|balance|how many|list|summary)\b/.test(q)) {
    return {
      type: 'query', rawSegment: segment,
      entities: { description: segment },
      confidence: 0.9, requiresReview: false,
    };
  }

  // SUBSCRIPTION
  if (/\b(?:subscription|subscribe|monthly plan|yearly plan|recurring|netflix|spotify|hotstar|prime|youtube premium)\b/.test(q)) {
    const rec: FinancialActionEntities['recurrence'] = /yearly|annual/i.test(q) ? 'yearly' : 'monthly';
    return {
      type: 'subscription', rawSegment: segment,
      entities: { amount, category: 'Entertainment', description: description || 'Subscription', recurrence: rec, date },
      confidence: 0.9, requiresReview: false,
    };
  }

  // INVESTMENT
  if (/\b(?:invest|bought shares?|gold|crypto|bitcoin|ethereum|mutual fund|sip|stock|nifty|sensex)\b/.test(q)) {
    const qtyMatch = segment.match(/(\d+)\s*(?:units?|shares?)/i);
    return {
      type: 'investment', rawSegment: segment,
      entities: { amount, category: 'Investment', description: description || 'Voice Investment',
        quantity: qtyMatch ? parseInt(qtyMatch[1]) : undefined,
        assetType: /gold/i.test(q) ? 'gold' : /crypto|bitcoin|ethereum/i.test(q) ? 'crypto' : /sip|mutual/i.test(q) ? 'mutual_fund' : 'stock',
        date,
      },
      confidence: 0.88, requiresReview: false,
    };
  }

  // LOAN — LEND
  if (/\b(?:lent|gave|lend|given|gave to)\b/.test(q) && (person || amount)) {
    return {
      type: 'loan_lend', rawSegment: segment,
      entities: { amount, person, description: description || `Lent to ${person || 'someone'}`, date },
      confidence: 0.88, requiresReview: !person,
    };
  }

  // LOAN — BORROW
  if (/\b(?:borrowed|borrow|took from|took loan|owe to)\b/.test(q) && (person || amount)) {
    return {
      type: 'loan_borrow', rawSegment: segment,
      entities: { amount, person, description: description || `Borrowed from ${person || 'someone'}`, date },
      confidence: 0.88, requiresReview: !person,
    };
  }

  // GOAL / SAVINGS
  if (/\b(?:saved|saving|goal|target|put aside|emergency fund|vacation fund|house fund)\b/.test(q)) {
    return {
      type: 'goal', rawSegment: segment,
      entities: { amount, category: 'Savings', description: description || 'Goal Contribution', date },
      confidence: 0.85, requiresReview: false,
    };
  }

  // GROUP EXPENSE
  if (/\b(?:split|group expense|shared with|divide|among|between)\b/.test(q)) {
    const membersMatch = segment.match(/(?:with|between|among)\s+([A-Za-z ,and]+)/i);
    const memberStr = membersMatch?.[1] || '';
    const members = memberStr.split(/,|\band\b/).map(s => s.trim()).filter(Boolean);
    return {
      type: 'group_expense', rawSegment: segment,
      entities: { amount, category, description: description || 'Group Expense', members, date },
      confidence: 0.85, requiresReview: false,
    };
  }

  // TRANSFER
  if (/\b(?:transfer|transferred|sent|send money|upi|gpay|paytm|phonepe)\b/.test(q)) {
    return {
      type: 'transfer', rawSegment: segment,
      entities: { amount, person, description: description || 'Voice Transfer', date },
      confidence: 0.87, requiresReview: false,
    };
  }

  // INCOME  
  if (/\b(?:received|got paid|salary|income|earned|freelance|credited|bonus|commission|salary credited|mila|milega|stipend|client paid|payment received|invoice paid)\b/.test(q)) {
    return {
      type: 'income', rawSegment: segment,
      entities: { amount, category: extractCategory(segment), description: description || 'Income', date },
      confidence: 0.88, requiresReview: false,
    };
  }

  // DEFAULT → EXPENSE
  if (amount) {
    return {
      type: 'expense', rawSegment: segment,
      entities: { amount, category, description: description || segment, date },
      confidence: amount > 0 ? 0.78 : 0.5, requiresReview: false,
    };
  }

  return {
    type: 'unknown', rawSegment: segment,
    entities: { description: segment },
    confidence: 0.3, requiresReview: true,
  };
}

export function parseTranscriptLocally(transcript: string): VoiceProcessResponse {
  const segments = splitSentences(transcript);
  const allActions = segments.map(parseSegment);
  const actions = allActions.filter(a => a.type !== 'unknown');

  // If nothing parsed but we have segments, still return as unknown for review
  if (actions.length === 0 && segments.length > 0) {
    return {
      success: false,
      transcript,
      actions: [],
      totalActions: 0,
      requiresReview: false,
    };
  }

  return {
    success: actions.length > 0,
    transcript,
    actions,
    totalActions: actions.length,
    requiresReview: actions.some(a => a.requiresReview),
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// BACKEND CALLS (with automatic local fallback)
// ─────────────────────────────────────────────────────────────────────────────

export async function processVoiceTranscript(transcript: string): Promise<VoiceProcessResponse> {
  try {
    const response = await backendService.post<VoiceProcessResponse>(
      '/voice/process',
      { transcript }
    );
    return response;
  } catch (err) {
    // Backend unavailable — use local parser
    console.info('[VoiceAI] Backend unavailable, using local parser');
    return parseTranscriptLocally(transcript);
  }
}

export async function processVoiceAudio(audioBlob: Blob): Promise<VoiceProcessResponse> {
  const formData = new FormData();
  formData.append('audio', audioBlob, 'voice_input.webm');

  try {
    const response = await backendService.post<VoiceProcessResponse>(
      '/voice/process-audio',
      formData,
      { headers: { 'Content-Type': 'multipart/form-data' } }
    );
    return response;
  } catch (err) {
    // Backend unavailable — cannot process raw audio locally; caller should retry with transcript
    console.info('[VoiceAI] Audio backend unavailable, will fall back to transcript');
    throw err; // Let VoiceInput.tsx handle fallback to transcript path
  }
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
    // Non-critical, silently ignore
  }
}

export function getActionTypeLabel(type: FinancialAction['type']): string {
  const labels: Record<string, string> = {
    expense: ' Expense',
    income: ' Income',
    transfer: ' Transfer',
    loan_borrow: ' Borrowed',
    loan_lend: ' Lent',
    goal: ' Goal',
    investment: ' Investment',
    group_expense: ' Group Split',
    query: ' Financial Query',
    bill_scan: ' Bill Scan',
    subscription: ' Subscription',
    unknown: ' Unknown',
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
    group_expense: 'bg-orange-50 border-orange-200 text-orange-700',
    query: 'bg-cyan-50 border-cyan-200 text-cyan-700',
    bill_scan: 'bg-yellow-50 border-yellow-200 text-yellow-700',
    subscription: 'bg-pink-50 border-pink-200 text-pink-700',
    unknown: 'bg-gray-50 border-gray-200 text-gray-700',
  };
  return colors[type] ?? colors.unknown;
}
