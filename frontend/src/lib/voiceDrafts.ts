import type { VoiceIntent, VoiceInvestmentKind, VoiceParseResult } from '@/lib/voiceExpenseParser';
import { inferInvestmentTypeFromText } from '@/lib/voiceExpenseParser';

export const VOICE_GOAL_DRAFT_KEY = 'voiceGoalDraft';
export const VOICE_GROUP_DRAFT_KEY = 'voiceGroupDraft';
export const VOICE_INVESTMENT_DRAFT_KEY = 'voiceInvestmentDraft';
export const VOICE_TRANSFER_DRAFT_KEY = 'voiceTransferDraft';
export const VOICE_BATCH_DRAFT_KEY = 'voiceBatchDraft';
export const VOICE_TRANSACTION_DRAFT_KEY = 'voiceTransactionDraft';

type AppPage =
  | 'add-goal'
  | 'goals'
  | 'groups'
  | 'add-gold'
  | 'add-investment'
  | 'transfer'
  | 'add-transaction';

export interface VoiceGoalDraft {
  amount: number;
  description: string;
}

export interface VoiceGroupDraft {
  amount: number;
  description: string;
}

export interface VoiceInvestmentDraft {
  amount: number;
  description: string;
}

export interface VoiceTransferDraft {
  amount: number;
  description: string;
}

export interface VoiceTransactionDraft {
  type: Extract<VoiceIntent, 'expense' | 'income'>;
  amount: number;
  category: string | null;
  description: string;
  date: string;
}

type StoredVoiceDraft = VoiceGoalDraft | VoiceGroupDraft | VoiceInvestmentDraft | VoiceTransferDraft | VoiceTransactionDraft;

export type VoiceRoutableItem = Pick<VoiceParseResult, 'intent' | 'amount' | 'category' | 'description' | 'date'>;

const SINGLE_ITEM_DRAFT_KEYS = [
  VOICE_GOAL_DRAFT_KEY,
  VOICE_GROUP_DRAFT_KEY,
  VOICE_INVESTMENT_DRAFT_KEY,
  VOICE_TRANSFER_DRAFT_KEY,
  VOICE_TRANSACTION_DRAFT_KEY,
];

const removeQuickRouteKeys = () => {
  localStorage.removeItem('quickExpenseMode');
  localStorage.removeItem('quickBackPage');
  localStorage.removeItem('quickFormType');
};

const clearSingleItemDrafts = () => {
  SINGLE_ITEM_DRAFT_KEYS.forEach((key) => localStorage.removeItem(key));
};

const writeDraft = <T extends StoredVoiceDraft>(key: string, value: T) => {
  localStorage.setItem(key, JSON.stringify(value));
};

export const readVoiceDraft = <T,>(key: string): T | null => {
  const rawValue = localStorage.getItem(key);
  if (!rawValue) {
    return null;
  }

  try {
    return JSON.parse(rawValue) as T;
  } catch {
    return null;
  }
};

export const takeVoiceDraft = <T,>(key: string): T | null => {
  const value = readVoiceDraft<T>(key);
  localStorage.removeItem(key);
  return value;
};

export const writeVoiceBatchDraft = (items: VoiceParseResult[]) => {
  localStorage.setItem(VOICE_BATCH_DRAFT_KEY, JSON.stringify(items));
};

export const getVoiceInvestmentDestination = (
  description: string,
  explicitKind?: VoiceInvestmentKind,
): Extract<AppPage, 'add-gold' | 'add-investment'> => {
  const kind = explicitKind || inferInvestmentTypeFromText(description);
  return kind === 'gold' ? 'add-gold' : 'add-investment';
};

export const persistVoiceRouteDraft = (
  item: VoiceRoutableItem,
  options?: {
    preferGoalHub?: boolean;
    preferGroupHub?: boolean;
    transactionBackPage?: string;
  },
): AppPage => {
  if (item.amount === null || item.amount <= 0) {
    return 'add-transaction';
  }

  clearSingleItemDrafts();
  localStorage.removeItem(VOICE_BATCH_DRAFT_KEY);

  switch (item.intent) {
    case 'goal': {
      removeQuickRouteKeys();
      writeDraft<VoiceGoalDraft>(VOICE_GOAL_DRAFT_KEY, {
        amount: item.amount,
        description: item.description,
      });
      return options?.preferGoalHub ? 'goals' : 'add-goal';
    }

    case 'group': {
      writeDraft<VoiceGroupDraft>(VOICE_GROUP_DRAFT_KEY, {
        amount: item.amount,
        description: item.description,
      });
      localStorage.setItem('quickExpenseMode', 'group');
      localStorage.setItem('quickBackPage', options?.preferGroupHub ? 'groups' : 'groups');
      localStorage.setItem('quickFormType', 'expense');
      return options?.preferGroupHub ? 'groups' : 'add-transaction';
    }

    case 'investment': {
      removeQuickRouteKeys();
      writeDraft<VoiceInvestmentDraft>(VOICE_INVESTMENT_DRAFT_KEY, {
        amount: item.amount,
        description: item.description,
      });
      return getVoiceInvestmentDestination(item.description);
    }

    case 'transfer': {
      removeQuickRouteKeys();
      writeDraft<VoiceTransferDraft>(VOICE_TRANSFER_DRAFT_KEY, {
        amount: item.amount,
        description: item.description,
      });
      return 'transfer';
    }

    case 'income':
    case 'expense': {
      localStorage.setItem('quickFormType', item.intent);
      localStorage.setItem('quickBackPage', options?.transactionBackPage || 'transactions');
      localStorage.setItem('quickExpenseMode', 'individual');
      writeDraft<VoiceTransactionDraft>(VOICE_TRANSACTION_DRAFT_KEY, {
        type: item.intent,
        amount: item.amount,
        category: item.category,
        description: item.description,
        date: item.date || new Date().toISOString().split('T')[0],
      });
      return 'add-transaction';
    }
  }
};
