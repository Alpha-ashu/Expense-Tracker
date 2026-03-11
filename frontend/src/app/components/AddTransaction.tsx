import React, { useEffect, useMemo, useRef, useState } from 'react';
import { useApp } from '@/contexts/AppContext';
import { useAuth } from '@/contexts/AuthContext';
import { db } from '@/lib/database';
import { queueTransactionInsertSync, saveTransactionWithBackendSync } from '@/lib/auth-sync-integration';
import { backendService } from '@/lib/backend-api';
import { createNotificationRecord } from '@/lib/notifications';
import {
  ChevronLeft, ArrowDownLeft, ArrowUpRight, Camera,
  CalendarDays, Wallet, Tag, AlignLeft, Store, Sparkles,
  CreditCard, Banknote, Smartphone,
  Zap, ChevronDown, Search, Check, Users, UserPlus, Mail, Phone, Trash2,
} from 'lucide-react';
import { toast } from 'sonner';
import {
  EXPENSE_CATEGORIES,
  INCOME_CATEGORIES,
  detectExpenseCategoryFromText,
  getCategoryForExpenseSubcategory,
  getSubcategoriesForCategory,
  loadCustomExpenseSubcategories,
  normalizeCategorySelection,
  noteExpenseSubcategoryUsage,
  saveCustomExpenseSubcategory,
  searchExpenseSubcategories,
  type CustomExpenseSubcategory,
  type ExpenseSubcategorySuggestion,
} from '@/lib/expenseCategories';
import { ReceiptScanner, type ReceiptScanPayload } from '@/app/components/ReceiptScanner';
import { getCategoryCartoonIcon } from '@/app/components/ui/CartoonCategoryIcons';
import { CategoryDropdown } from '@/app/components/ui/CategoryDropdown';
import { motion, AnimatePresence } from 'framer-motion';
import { cn } from '@/lib/utils';
import { parseDateInputValue, toLocalDateKey } from '@/lib/dateUtils';
import {
  markSmsTransactionImported,
  resolvePendingSmsTransactionDraft,
} from '@/services/smsTransactionDetectionService';

const CATEGORIES = {
  expense: Object.values(EXPENSE_CATEGORIES).map(cat => cat.name),
  income: Object.values(INCOME_CATEGORIES).map(cat => cat.name),
};

const DEFAULT_CATEGORY = {
  expense: CATEGORIES.expense.includes('Food & Dining') ? 'Food & Dining' : CATEGORIES.expense[0],
  income: CATEGORIES.income.includes('Salary') ? 'Salary' : CATEGORIES.income[0],
};

/* ─────────────── helpers ─────────────── */
const FieldRow: React.FC<{
  icon: React.ReactNode;
  label: string;
  children: React.ReactNode;
  accent?: boolean;
}> = ({ icon, label, children, accent }) => (
  <div className="flex items-center gap-3 px-4 py-3 group">
    <div className={cn(
      'w-8 h-8 rounded-lg flex items-center justify-center shrink-0 transition-colors',
      accent ? 'bg-black/5' : 'bg-gray-100 group-focus-within:bg-gray-200'
    )}>
      {icon}
    </div>
    <div className="flex-1 min-w-0">
      <p className="text-[9px] font-bold text-gray-400 uppercase tracking-[0.24em] mb-0.5">{label}</p>
      {children}
    </div>
  </div>
);

const DropdownCaret: React.FC<{ open?: boolean; size?: number; className?: string }> = ({
  open = false,
  size = 16,
  className,
}) => (
  <span
    className={cn(
      'flex h-9 w-9 shrink-0 items-center justify-center rounded-xl border border-gray-200 bg-white text-gray-400 shadow-sm',
      className,
    )}
  >
    <ChevronDown size={size} className={cn('transition-transform', open && 'rotate-180')} />
  </span>
);

type ExpenseEntryMode = 'individual' | 'group' | 'loan';
type LoanEntryType = 'borrowed' | 'lent';

interface GroupParticipantDraft {
  id: string;
  friendId?: number;
  name: string;
  email: string;
  phone: string;
  share: number;
}

const createDraftId = () =>
  typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function'
    ? crypto.randomUUID()
    : `${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;

const createEmptyParticipant = (seed: Partial<GroupParticipantDraft> = {}): GroupParticipantDraft => ({
  id: createDraftId(),
  name: '',
  email: '',
  phone: '',
  share: 0,
  ...seed,
});

const roundCurrencyAmount = (value: number) => Number((Number.isFinite(value) ? value : 0).toFixed(2));

const toDateInputValue = (date: Date) => {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
};

const getLoanStatusFromDates = (dueDateInput: string, referenceDate = new Date()) => {
  const dueDate = parseDateInputValue(dueDateInput) ?? new Date(dueDateInput);
  const todayKey = toDateInputValue(referenceDate);
  const dueKey = toDateInputValue(dueDate);
  return dueKey < todayKey ? 'overdue' as const : 'active' as const;
};

interface LoanDraft {
  friendId?: number;
  contactName: string;
  contactEmail: string;
  contactPhone: string;
  dueDate: string;
  interestRate: number;
  notes: string;
}

const createDefaultLoanDraft = (baseDate: string): LoanDraft => ({
  contactName: '',
  contactEmail: '',
  contactPhone: '',
  dueDate: baseDate,
  interestRate: 0,
  notes: '',
});

/* ─────────────── main component ─────────────── */
export const AddTransaction: React.FC = () => {
  const { accounts, friends, transactions, setCurrentPage, currency, refreshData } = useApp();
  const { user } = useAuth();

  const [formData, setFormData] = useState(() => ({
    type: 'expense' as 'expense' | 'income',
    amount: 0,
    accountId: accounts[0]?.id || 0,
    category: DEFAULT_CATEGORY.expense,
    subcategory: '',
    description: '',
    merchant: '',
    date: toLocalDateKey(new Date()) ?? new Date().toISOString().split('T')[0],
  }));
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [showScanner, setShowScanner] = useState(false);
  const [amountStr, setAmountStr] = useState('');
  const [subcategoryQuery, setSubcategoryQuery] = useState('');
  const [showOptionalFields, setShowOptionalFields] = useState(false);
  const [showCategoryPicker, setShowCategoryPicker] = useState(false);
  const [showAccountPicker, setShowAccountPicker] = useState(false);
  const [showIncomeSubcategoryPicker, setShowIncomeSubcategoryPicker] = useState(false);
  const [expenseMode, setExpenseMode] = useState<ExpenseEntryMode>('individual');
  const [loanType, setLoanType] = useState<LoanEntryType>('borrowed');
  const [loanDraft, setLoanDraft] = useState<LoanDraft>(() =>
    createDefaultLoanDraft(toLocalDateKey(new Date()) ?? new Date().toISOString().split('T')[0])
  );
  const [showLoanFriendPicker, setShowLoanFriendPicker] = useState(false);
  const [returnPage, setReturnPage] = useState('transactions');
  const [groupName, setGroupName] = useState('');
  const [groupSplitType, setGroupSplitType] = useState<'equal' | 'custom'>('equal');
  const [groupParticipants, setGroupParticipants] = useState<GroupParticipantDraft[]>([]);
  const [showGroupFriendPicker, setShowGroupFriendPicker] = useState(false);
  const [manualExpenseCategory, setManualExpenseCategory] = useState(false);
  const [pendingSmsTransactionId, setPendingSmsTransactionId] = useState<number | null>(null);
  const [customExpenseSubcategories, setCustomExpenseSubcategories] = useState<CustomExpenseSubcategory[]>(() =>
    loadCustomExpenseSubcategories(),
  );
  const accountPickerRef = useRef<HTMLDivElement | null>(null);
  const incomeSubcategoryPickerRef = useRef<HTMLDivElement | null>(null);
  const groupFriendPickerRef = useRef<HTMLDivElement | null>(null);
  const loanFriendPickerRef = useRef<HTMLDivElement | null>(null);
  const loanDateInputRef = useRef<HTMLInputElement | null>(null);
  const loanDueDateInputRef = useRef<HTMLInputElement | null>(null);

  /* ── pre-fill from localStorage ── */
  useEffect(() => {
    const rawFormType = localStorage.getItem('quickFormType');
    const rawExpenseMode = localStorage.getItem('quickExpenseMode');
    const rawBackPage = localStorage.getItem('quickBackPage');
    if (rawFormType === 'income' || rawFormType === 'expense') {
      const nextExpenseMode = rawFormType === 'expense'
        ? (rawExpenseMode === 'group' || rawExpenseMode === 'loan' ? rawExpenseMode : 'individual')
        : 'individual';
      setFormData(prev => ({
        ...prev,
        type: rawFormType as 'expense' | 'income',
        category: DEFAULT_CATEGORY[rawFormType as 'expense' | 'income'],
        subcategory: '',
      }));
      setExpenseMode(nextExpenseMode);
      setSubcategoryQuery('');
      setShowCategoryPicker(false);
      setManualExpenseCategory(false);
      localStorage.removeItem('quickFormType');
      localStorage.removeItem('quickExpenseMode');
    }
    if (rawBackPage) {
      setReturnPage(rawBackPage);
      localStorage.removeItem('quickBackPage');
    }
    const rawAccountId = localStorage.getItem('quickAccountId');
    if (rawAccountId) {
      const accountId = parseInt(rawAccountId, 10);
      if (!isNaN(accountId)) setFormData(prev => ({ ...prev, accountId }));
      localStorage.removeItem('quickAccountId');
    }
  }, []);

  /* ── voice draft ── */
  useEffect(() => {
    const rawDraft = localStorage.getItem('voiceTransactionDraft');
    if (!rawDraft) return;
    try {
      const draft = JSON.parse(rawDraft) as {
        type?: 'expense' | 'income'; amount?: number;
        category?: string | null; description?: string; date?: string;
      };
      const nextType = draft.type ?? 'expense';
      const categoryList = CATEGORIES[nextType];
      const normalizedDraftCategory = draft.category
        ? normalizeCategorySelection(draft.category, nextType)
        : DEFAULT_CATEGORY[nextType];
      const nextCategory = normalizedDraftCategory && categoryList.includes(normalizedDraftCategory)
        ? normalizedDraftCategory
        : DEFAULT_CATEGORY[nextType];
      setFormData(prev => ({
        ...prev, type: nextType,
        amount: draft.amount ?? prev.amount,
        category: nextCategory,
        subcategory: '',
        description: draft.description ?? prev.description,
        date: draft.date ?? prev.date,
      }));
      setExpenseMode(nextType === 'expense' ? 'individual' : 'individual');
      setSubcategoryQuery('');
      setShowCategoryPicker(false);
      setManualExpenseCategory(false);
      if (draft.amount) setAmountStr(String(draft.amount));
    } catch (e) {
      console.error('Failed to parse voice draft:', e);
    } finally {
      localStorage.removeItem('voiceTransactionDraft');
    }
  }, []);

  useEffect(() => {
    let isMounted = true;

    const applySmsDraft = async () => {
      const draft = await resolvePendingSmsTransactionDraft();
      if (!draft || !isMounted) return;

      setPendingSmsTransactionId(draft.smsTransactionId);
      setFormData((prev) => ({
        ...prev,
        type: draft.type,
        amount: draft.amount,
        accountId: draft.accountId || prev.accountId,
        category: normalizeCategorySelection(draft.category, draft.type),
        subcategory: draft.subcategory || '',
        description: draft.description || prev.description,
        merchant: draft.merchant || prev.merchant,
        date: draft.date || prev.date,
      }));
      setExpenseMode('individual');
      setAmountStr(String(draft.amount));
      setSubcategoryQuery(draft.subcategory || '');
      setShowCategoryPicker(false);
      setShowIncomeSubcategoryPicker(false);
      setShowGroupFriendPicker(false);
      setShowLoanFriendPicker(false);
      setShowOptionalFields(Boolean(draft.merchant || draft.description || draft.subcategory));
      setManualExpenseCategory(false);

      if (draft.duplicateTransactionId) {
        toast.warning('Possible duplicate transaction detected. Review the details before saving.');
      }
    };

    void applySmsDraft();

    return () => {
      isMounted = false;
    };
  }, []);

  const subcategories = useMemo(() =>
    getSubcategoriesForCategory(formData.category, formData.type),
    [formData.category, formData.type]
  );
  const selectedAccount = accounts.find(a => a.id === formData.accountId);
  const isExpense = formData.type === 'expense';
  const isGroupExpense = isExpense && expenseMode === 'group';
  const isLoanExpense = isExpense && expenseMode === 'loan';
  const currentUserDisplayName = useMemo(() => {
    const fullName = user?.user_metadata?.full_name
      || [user?.user_metadata?.first_name, user?.user_metadata?.last_name].filter(Boolean).join(' ')
      || user?.email?.split('@')[0];
    return fullName || 'You';
  }, [user]);
  const activeGroupParticipants = useMemo(
    () => groupParticipants.filter((participant) =>
      participant.name.trim() || participant.email.trim() || participant.phone.trim()
    ),
    [groupParticipants],
  );
  const participantCountForSplit = activeGroupParticipants.length + 1;
  const equalPerPersonShare = participantCountForSplit > 0
    ? roundCurrencyAmount(formData.amount / participantCountForSplit)
    : 0;
  const normalizedFriendShares = useMemo(
    () => activeGroupParticipants.map((participant) => ({
      ...participant,
      share: groupSplitType === 'equal'
        ? equalPerPersonShare
        : roundCurrencyAmount(participant.share),
    })),
    [activeGroupParticipants, equalPerPersonShare, groupSplitType],
  );
  const totalFriendShares = normalizedFriendShares.reduce((sum, participant) => sum + participant.share, 0);
  const currentUserShare = roundCurrencyAmount(Math.max(formData.amount - totalFriendShares, 0));
  const hasOverAllocatedGroupShares = groupSplitType === 'custom' && roundCurrencyAmount(totalFriendShares) > roundCurrencyAmount(formData.amount);
  const totalAmountToCollect = normalizedFriendShares
    .filter((participant) => participant.share > 0)
    .reduce((sum, participant) => sum + participant.share, 0);
  const availableSavedFriends = useMemo(
    () => friends.filter((friend) => !activeGroupParticipants.some((participant) => participant.friendId === friend.id)),
    [activeGroupParticipants, friends],
  );
  const loanInterestAmount = useMemo(
    () => roundCurrencyAmount(formData.amount * ((loanDraft.interestRate || 0) / 100)),
    [formData.amount, loanDraft.interestRate],
  );
  const loanTotalDue = useMemo(
    () => roundCurrencyAmount(formData.amount + loanInterestAmount),
    [formData.amount, loanInterestAmount],
  );
  const loanAccountLabel = loanType === 'borrowed' ? 'Received in' : 'Paid from';

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (accountPickerRef.current && !accountPickerRef.current.contains(event.target as Node)) {
        setShowAccountPicker(false);
      }
      if (incomeSubcategoryPickerRef.current && !incomeSubcategoryPickerRef.current.contains(event.target as Node)) {
        setShowIncomeSubcategoryPicker(false);
      }
      if (groupFriendPickerRef.current && !groupFriendPickerRef.current.contains(event.target as Node)) {
        setShowGroupFriendPicker(false);
      }
      if (loanFriendPickerRef.current && !loanFriendPickerRef.current.contains(event.target as Node)) {
        setShowLoanFriendPicker(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  useEffect(() => {
    if (!isLoanExpense) {
      setShowLoanFriendPicker(false);
      return;
    }

    setShowScanner(false);
    setShowCategoryPicker(false);
    setShowIncomeSubcategoryPicker(false);
    setShowOptionalFields(false);
    setLoanDraft((prev) => ({
      ...prev,
      dueDate: prev.dueDate || formData.date,
    }));
  }, [formData.date, isLoanExpense]);

  const recentExpenseSuggestions = useMemo(() => {
    const recent: Array<{ name: string; category: string }> = [];
    const seen = new Set<string>();

    [...transactions]
      .filter((transaction) => transaction.type === 'expense' && (transaction.subcategory || transaction.category))
      .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())
      .forEach((transaction) => {
        const suggestedName = transaction.subcategory?.trim() || transaction.category?.trim();
        if (!suggestedName) return;

        const mappedCategory = transaction.subcategory
          ? getCategoryForExpenseSubcategory(transaction.subcategory, customExpenseSubcategories)
          : null;
        const category = mappedCategory || normalizeCategorySelection(transaction.category, 'expense');
        const dedupeKey = `${suggestedName.toLowerCase()}::${category.toLowerCase()}`;
        if (seen.has(dedupeKey)) return;
        seen.add(dedupeKey);
        recent.push({ name: suggestedName, category });
      });

    return recent.slice(0, 6);
  }, [transactions, customExpenseSubcategories]);

  const frequentExpenseSuggestions = useMemo(() => {
    const counts = new Map<string, { name: string; category: string; count: number }>();

    transactions
      .filter((transaction) => transaction.type === 'expense' && (transaction.subcategory || transaction.category))
      .forEach((transaction) => {
        const suggestedName = transaction.subcategory?.trim() || transaction.category?.trim();
        if (!suggestedName) return;

        const mappedCategory = transaction.subcategory
          ? getCategoryForExpenseSubcategory(transaction.subcategory, customExpenseSubcategories)
          : null;
        const category = mappedCategory || normalizeCategorySelection(transaction.category, 'expense');
        const key = `${suggestedName.toLowerCase()}::${category.toLowerCase()}`;
        const existing = counts.get(key);

        counts.set(key, {
          name: suggestedName,
          category,
          count: (existing?.count ?? 0) + 1,
        });
      });

    return [...counts.values()]
      .sort((a, b) => b.count - a.count || a.name.localeCompare(b.name))
      .slice(0, 6);
  }, [transactions, customExpenseSubcategories]);

  const smartExpenseSuggestion = useMemo(() => {
    if (!isExpense || isLoanExpense) return null;
    const combinedText = [subcategoryQuery, formData.description, formData.merchant]
      .filter(Boolean)
      .join(' ')
      .trim();
    if (!combinedText) return null;
    return detectExpenseCategoryFromText(combinedText, customExpenseSubcategories);
  }, [customExpenseSubcategories, formData.description, formData.merchant, isExpense, isLoanExpense, subcategoryQuery]);

  useEffect(() => {
    if (!isExpense || isLoanExpense) return;
    if (!subcategoryQuery.trim()) return;
    if (formData.subcategory.trim()) return;
    if (!smartExpenseSuggestion) return;
    if (manualExpenseCategory) return;

    const suggestedCategory = normalizeCategorySelection(smartExpenseSuggestion.category, 'expense');
    if (!suggestedCategory || formData.category === suggestedCategory) return;

    setFormData((prev) => {
      if (prev.type !== 'expense' || prev.subcategory.trim()) return prev;
      if (prev.category === suggestedCategory) return prev;
      return {
        ...prev,
        category: suggestedCategory,
      };
    });
  }, [
    formData.category,
    formData.subcategory,
    isExpense,
    isLoanExpense,
    manualExpenseCategory,
    smartExpenseSuggestion,
    subcategoryQuery,
  ]);

  const expenseSuggestions = useMemo(() => {
    if (!isExpense || isLoanExpense) return [] as ExpenseSubcategorySuggestion[];

    const recentNames = recentExpenseSuggestions.map((item) => item.name);
    const frequentNames = frequentExpenseSuggestions.map((item) => item.name);
    const query = subcategoryQuery.trim();

    if (query) {
      return searchExpenseSubcategories(query, {
        limit: 8,
        preferredCategory: formData.category,
        recentNames,
        frequentNames,
        customSubcategories: customExpenseSubcategories,
      });
    }

    const seededSuggestions: ExpenseSubcategorySuggestion[] = [
      ...recentExpenseSuggestions.map((item) => ({
        name: item.name,
        category: item.category,
        keywords: [item.name],
        score: 0,
      })),
      ...frequentExpenseSuggestions.map((item) => ({
        name: item.name,
        category: item.category,
        keywords: [item.name],
        score: 0,
      })),
      ...subcategories.slice(0, 6).map((subcategory) => ({
        name: subcategory,
        category: formData.category,
        keywords: [subcategory],
        score: 0,
      })),
    ];

    const deduped: ExpenseSubcategorySuggestion[] = [];
    const seen = new Set<string>();

    seededSuggestions.forEach((suggestion) => {
      const key = `${suggestion.name.toLowerCase()}::${suggestion.category.toLowerCase()}`;
      if (seen.has(key)) return;
      seen.add(key);
      deduped.push(suggestion);
    });

    return deduped.slice(0, 8);
  }, [
    customExpenseSubcategories,
    formData.category,
    frequentExpenseSuggestions,
    isExpense,
    isLoanExpense,
    recentExpenseSuggestions,
    subcategories,
    subcategoryQuery,
  ]);

  const customCategoryCandidate = smartExpenseSuggestion?.category || formData.category || DEFAULT_CATEGORY.expense;
  const hasExactExpenseMatch = !!(
    subcategoryQuery.trim() &&
    getCategoryForExpenseSubcategory(subcategoryQuery.trim(), customExpenseSubcategories)
  );

  const handleAmountChange = (val: string) => {
    setAmountStr(val);
    setFormData(prev => ({ ...prev, amount: parseFloat(val) || 0 }));
  };

  const openDateInputPicker = (input: HTMLInputElement | null) => {
    if (!input) return;
    if (typeof input.showPicker === 'function') {
      input.showPicker();
      return;
    }
    input.click();
  };

  const addGroupParticipant = (seed: Partial<GroupParticipantDraft> = {}) => {
    setGroupParticipants((prev) => [...prev, createEmptyParticipant(seed)]);
  };

  const updateGroupParticipant = (id: string, updates: Partial<GroupParticipantDraft>) => {
    setGroupParticipants((prev) => prev.map((participant) =>
      participant.id === id ? { ...participant, ...updates } : participant
    ));
  };

  const removeGroupParticipant = (id: string) => {
    setGroupParticipants((prev) => prev.filter((participant) => participant.id !== id));
  };

  const addSavedFriendToGroup = (friend: typeof friends[number]) => {
    if (activeGroupParticipants.some((participant) => participant.friendId === friend.id)) {
      toast.error(`${friend.name} is already added`);
      return;
    }

    addGroupParticipant({
      friendId: friend.id,
      name: friend.name,
      email: friend.email ?? '',
      phone: friend.phone ?? '',
    });
    setShowGroupFriendPicker(false);
  };

  const addSavedFriendToLoan = (friend: typeof friends[number]) => {
    setLoanDraft((prev) => ({
      ...prev,
      friendId: friend.id,
      contactName: friend.name,
      contactEmail: friend.email ?? '',
      contactPhone: friend.phone ?? '',
    }));
    setShowLoanFriendPicker(false);
  };

  const notifyGroupParticipants = async (
    groupExpenseId: number,
    expenseName: string,
    totalAmount: number,
    participants: Array<{ name: string; email?: string; phone?: string; share: number }>,
  ) => {
    let sentCount = 0;
    let failedCount = 0;

    await createNotificationRecord({
      type: 'group',
      title: 'Group expense created',
      message: `${expenseName} has been split with ${participants.length} friend${participants.length === 1 ? '' : 's'}.`,
      relatedId: groupExpenseId,
      createdAt: new Date(),
      deepLink: '/groups',
    });

    await Promise.allSettled(participants.map(async (participant) => {
      if (!participant.email?.trim()) {
        failedCount += 1;
        return;
      }

      try {
        const notificationResult = await backendService.createNotification({
          type: 'group',
          title: 'New Group Expense Added',
          message: `Hello ${participant.name}, you have been added to "${expenseName}". Total ${currency} ${totalAmount.toFixed(2)}. Your share is ${currency} ${participant.share.toFixed(2)}. Added by ${currentUserDisplayName}.`,
          email: participant.email.trim(),
          phone: participant.phone?.trim() || undefined,
          relatedId: groupExpenseId,
          createdAt: new Date().toISOString(),
          deepLink: '/groups',
        });
        if (notificationResult?.delivery === 'skipped') {
          failedCount += 1;
          return;
        }
        sentCount += 1;
      } catch (error) {
        // Group expense notification skipped
        failedCount += 1;
      }
    }));

    if (sentCount === 0) return 'pending' as const;
    if (failedCount > 0) return 'partial' as const;
    return 'sent' as const;
  };

  const switchType = (t: 'expense' | 'income') => {
    setFormData(prev => ({ ...prev, type: t, category: DEFAULT_CATEGORY[t], subcategory: '' }));
    setSubcategoryQuery('');
    setShowCategoryPicker(false);
    setShowIncomeSubcategoryPicker(false);
    setShowGroupFriendPicker(false);
    setShowLoanFriendPicker(false);
    if (t === 'income') {
      setExpenseMode('individual');
    }
    setManualExpenseCategory(false);
  };

  const switchExpenseMode = (mode: ExpenseEntryMode) => {
    setExpenseMode(mode);
    setShowGroupFriendPicker(false);
    setShowLoanFriendPicker(false);
    setShowCategoryPicker(false);
    if (mode === 'loan') {
      setShowScanner(false);
      setLoanDraft((prev) => ({
        ...prev,
        dueDate: prev.dueDate || formData.date,
      }));
    }
  };

  const applyExpenseSuggestion = (subcategory: string, category: string) => {
    const canonicalCategory = normalizeCategorySelection(category, 'expense');
    setFormData(prev => ({
      ...prev,
      category: canonicalCategory,
      subcategory,
    }));
    setSubcategoryQuery(subcategory);
    setShowCategoryPicker(false);
    setManualExpenseCategory(false);
  };

  const handleSaveCustomSubcategory = () => {
    const trimmedQuery = subcategoryQuery.trim();
    if (!trimmedQuery) return;

    const saved = saveCustomExpenseSubcategory(
      trimmedQuery,
      customCategoryCandidate,
      [trimmedQuery, formData.description, formData.merchant].filter(Boolean),
    );

    if (!saved) return;

    setCustomExpenseSubcategories(loadCustomExpenseSubcategories());
    applyExpenseSuggestion(saved.name, saved.category);
    toast.success(`Saved "${saved.name}" under ${saved.category}`);
  };

  const handleApplyReceiptScan = (scan: ReceiptScanPayload) => {
    const nextCategory = normalizeCategorySelection(scan.category || formData.category || DEFAULT_CATEGORY.expense, 'expense');
    const nextSubcategory = scan.subcategory?.trim() || '';
    const nextDate = scan.date instanceof Date && !Number.isNaN(scan.date.getTime())
      ? toDateInputValue(scan.date)
      : formData.date;

    setFormData((prev) => ({
      ...prev,
      type: 'expense',
      amount: scan.amount || prev.amount,
      accountId: scan.accountId || prev.accountId,
      category: nextCategory,
      subcategory: nextSubcategory,
      merchant: scan.merchantName?.trim() || prev.merchant,
      description: prev.description || '',
      date: nextDate,
    }));
    setAmountStr(scan.amount ? String(scan.amount) : amountStr);
    setSubcategoryQuery(nextSubcategory);
    setManualExpenseCategory(false);
    setShowCategoryPicker(false);
    setShowScanner(false);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedAccount) { toast.error('Please select an account'); return; }
    if (!formData.amount || formData.amount <= 0) { toast.error('Enter a valid amount'); return; }
    const transactionDate = parseDateInputValue(formData.date);
    if (!transactionDate) {
      toast.error('Please select a valid date');
      return;
    }
    if (isLoanExpense) {
      if (!loanDraft.contactName.trim()) {
        toast.error('Please enter a friend or contact name');
        return;
      }
      if (!loanDraft.dueDate) {
        toast.error('Please select a due date');
        return;
      }
      const parsedDueDate = parseDateInputValue(loanDraft.dueDate);
      if (!parsedDueDate) {
        toast.error('Please enter a valid due date');
        return;
      }
      if (loanType === 'lent' && selectedAccount.balance < formData.amount) {
        toast.error(`Not enough balance in ${selectedAccount.name}`);
        return;
      }
    }
    if (isGroupExpense) {
      if (!groupName.trim()) {
        toast.error('Please add a group name');
        return;
      }
      if (activeGroupParticipants.length === 0) {
        toast.error('Add at least one friend to split this expense');
        return;
      }
      if (activeGroupParticipants.some((participant) => !participant.name.trim())) {
        toast.error('Add a name for each participant');
        return;
      }
      if (groupSplitType === 'custom') {
        if (normalizedFriendShares.some((participant) => participant.share <= 0)) {
          toast.error('Each friend needs a share amount greater than 0');
          return;
        }
        if (hasOverAllocatedGroupShares) {
          toast.error('Friend shares cannot exceed the total amount');
          return;
        }
      }
    }
    setIsSubmitting(true);
    try {
      if (isLoanExpense) {
        const now = new Date();
        const dueDate = parseDateInputValue(loanDraft.dueDate) ?? new Date(loanDraft.dueDate);
        const contactName = loanDraft.contactName.trim();
        const newBalance = loanType === 'borrowed'
          ? selectedAccount.balance + formData.amount
          : selectedAccount.balance - formData.amount;

        await db.transaction('rw', db.loans, db.accounts, async () => {
          await db.loans.add({
            type: loanType,
            name: contactName,
            principalAmount: formData.amount,
            outstandingBalance: loanTotalDue,
            interestRate: loanDraft.interestRate > 0 ? loanDraft.interestRate : undefined,
            dueDate,
            frequency: 'custom',
            status: getLoanStatusFromDates(loanDraft.dueDate, now),
            contactPerson: contactName,
            friendId: loanDraft.friendId,
            contactEmail: loanDraft.contactEmail.trim() || undefined,
            contactPhone: loanDraft.contactPhone.trim() || undefined,
            accountId: formData.accountId,
            loanDate: transactionDate,
            notes: loanDraft.notes.trim() || undefined,
            totalPayable: loanTotalDue,
            createdAt: now,
            updatedAt: now,
          });

          await db.accounts.update(formData.accountId, {
            balance: newBalance,
            updatedAt: now,
          });
        });

        toast.success(
          loanType === 'borrowed'
            ? `Borrowed ${currency} ${formData.amount.toFixed(2)} recorded`
            : `Lent ${currency} ${formData.amount.toFixed(2)} recorded`,
        );
        if (pendingSmsTransactionId) {
          await markSmsTransactionImported(pendingSmsTransactionId);
        }
        refreshData();
        setCurrentPage('loans');
        return;
      }

      let nextCategory = formData.category;
      let nextSubcategory = formData.subcategory.trim();

      if (isExpense) {
        const typedSubcategory = subcategoryQuery.trim();
        const searchText = [typedSubcategory, formData.description, formData.merchant]
          .filter(Boolean)
          .join(' ')
          .trim();

        if (!nextSubcategory && typedSubcategory) {
          nextSubcategory = typedSubcategory;
        }

        if (nextSubcategory) {
          const mappedCategory = getCategoryForExpenseSubcategory(nextSubcategory, customExpenseSubcategories);
          if (mappedCategory) {
            nextCategory = mappedCategory;
          } else if (searchText && !manualExpenseCategory) {
            const detected = detectExpenseCategoryFromText(searchText, customExpenseSubcategories);
            if (detected) {
              nextCategory = detected.category;
              if (!formData.subcategory.trim()) {
                nextSubcategory = nextSubcategory || detected.subcategory;
              }
            }
          }
        } else if (searchText && !manualExpenseCategory) {
          const detected = detectExpenseCategoryFromText(searchText, customExpenseSubcategories);
          if (detected) {
            nextCategory = detected.category;
            nextSubcategory = detected.subcategory;
          }
        }
      }

      const payload = {
        ...formData,
        category: normalizeCategorySelection(nextCategory, formData.type),
        subcategory: nextSubcategory,
      };

      const now = new Date();
      const newBalance = isExpense
        ? selectedAccount.balance - formData.amount
        : selectedAccount.balance + formData.amount;

      if (isGroupExpense) {
        const expenseName = groupName.trim();
        const friendParticipants = normalizedFriendShares.map((participant) => ({
          friendId: participant.friendId,
          name: participant.name.trim(),
          email: participant.email.trim(),
          phone: participant.phone.trim(),
          share: participant.share,
          paid: false,
          paidAmount: 0,
          paymentStatus: 'pending' as const,
        }));
        const memberRecords = [
          {
            name: currentUserDisplayName,
            email: user?.email?.trim(),
            share: currentUserShare,
            paid: true,
            isCurrentUser: true,
            paidAmount: currentUserShare,
            paymentStatus: 'paid' as const,
          },
          ...friendParticipants,
        ];
        const transactionRecord = {
          ...payload,
          description: payload.description.trim() || expenseName,
          date: transactionDate,
          tags: [],
          expenseMode: 'group' as const,
          groupName: expenseName,
          splitType: groupSplitType,
          importSource: pendingSmsTransactionId ? 'sms' : undefined,
          importMetadata: pendingSmsTransactionId
            ? { smsTransactionId: String(pendingSmsTransactionId) }
            : undefined,
          importedAt: pendingSmsTransactionId ? now : undefined,
          createdAt: now,
          updatedAt: now,
        };

        let transactionId = 0;
        let groupExpenseId = 0;

        await db.transaction('rw', db.transactions, db.accounts, db.groupExpenses, async () => {
          transactionId = await db.transactions.add(transactionRecord);
          await db.accounts.update(formData.accountId, { balance: newBalance, updatedAt: now });
          groupExpenseId = await db.groupExpenses.add({
            name: expenseName,
            totalAmount: payload.amount,
            paidBy: formData.accountId,
            date: transactionDate,
            members: memberRecords,
            description: payload.description.trim() || undefined,
            category: payload.category,
            subcategory: payload.subcategory || undefined,
            splitType: groupSplitType,
            yourShare: currentUserShare,
            expenseTransactionId: transactionId,
            createdBy: user?.id,
            createdByName: currentUserDisplayName,
            status: friendParticipants.some((participant) => participant.share > 0) ? 'pending' : 'settled',
            notificationStatus: 'pending',
            createdAt: now,
            updatedAt: now,
          });
          await db.transactions.update(transactionId, { groupExpenseId });
        });

        queueTransactionInsertSync(transactionId, transactionRecord);

        let notificationStatus: 'pending' | 'partial' | 'sent' | 'failed' = 'pending';
        try {
          notificationStatus = await notifyGroupParticipants(
            groupExpenseId,
            expenseName,
            payload.amount,
            friendParticipants,
          );
        } catch (error) {
          console.info('ℹ️ Group expense notifications skipped:', error);
          notificationStatus = 'failed';
        }

        await db.groupExpenses.update(groupExpenseId, {
          notificationStatus,
          updatedAt: new Date(),
        });

        try {
          await backendService.createGroup({
            id: String(groupExpenseId),
            name: expenseName,
            members: friendParticipants.map((participant) => participant.name),
            createdAt: now,
            description: payload.description.trim() || undefined,
            totalAmount: payload.amount,
            amountPerPerson: roundCurrencyAmount(payload.amount / (friendParticipants.length + 1)),
            category: payload.category,
            date: transactionDate,
          });
        } catch (error) {
          console.info('ℹ️ Group expense backend sync skipped:', error);
        }

        if (payload.subcategory) {
          noteExpenseSubcategoryUsage(payload.subcategory, payload.category);
        }
        if (pendingSmsTransactionId) {
          await markSmsTransactionImported(pendingSmsTransactionId, transactionId);
        }
        toast.success(`Group expense created. ${friendParticipants.length} share request${friendParticipants.length === 1 ? '' : 's'} ready.`);
        refreshData();
        setCurrentPage('groups');
        return;
      }

      const savedTransaction = await saveTransactionWithBackendSync({
        ...payload,
        date: transactionDate,
        tags: [],
        expenseMode: 'individual',
        importSource: pendingSmsTransactionId ? 'sms' : undefined,
        importMetadata: pendingSmsTransactionId
          ? { smsTransactionId: String(pendingSmsTransactionId) }
          : undefined,
        importedAt: pendingSmsTransactionId ? now : undefined,
      });
      await db.accounts.update(formData.accountId, { balance: newBalance, updatedAt: now });
      if (payload.type === 'expense' && payload.subcategory) {
        noteExpenseSubcategoryUsage(payload.subcategory, payload.category);
      }
      if (pendingSmsTransactionId) {
        await markSmsTransactionImported(pendingSmsTransactionId, savedTransaction.id);
      }
      toast.success(`${isExpense ? '📉' : '📈'} ${isExpense ? 'Expense' : 'Income'} of ${currency} ${formData.amount.toFixed(2)} recorded`);
      refreshData();
      setCurrentPage(returnPage);
    } catch (err) {
      console.error(err);
      toast.error('Failed to add transaction. Please try again.');
    } finally {
      setIsSubmitting(false);
    }
  };

  /* ── color system ── */
  const accent = isLoanExpense
    ? {
        heroSurface: 'from-sky-50 via-white to-cyan-50',
        heroLine: 'from-sky-500 via-sky-500 to-cyan-500',
        iconShell: 'bg-sky-100 text-sky-600',
        actionShell: 'border-sky-100 bg-white text-sky-500 hover:bg-sky-50',
        subtitle: 'text-sky-500',
        switchShell: 'bg-sky-50 border border-sky-100',
        switchActive: 'bg-white text-sky-600 shadow-sm',
        switchInactive: 'text-sky-500 hover:text-sky-700',
        amountCard: 'from-sky-500 via-sky-500 to-cyan-500',
        amountMeta: 'bg-white/15 text-white/85',
        btn: 'from-sky-500 to-cyan-500 hover:from-sky-600 hover:to-cyan-600 shadow-sky-300',
      }
    : isExpense
    ? {
        heroSurface: 'from-rose-50 via-white to-pink-50',
        heroLine: 'from-rose-500 via-rose-500 to-pink-500',
        iconShell: 'bg-rose-100 text-rose-600',
        actionShell: 'border-rose-100 bg-white text-rose-500 hover:bg-rose-50',
        subtitle: 'text-rose-400',
        switchShell: 'bg-rose-50 border border-rose-100',
        switchActive: 'bg-white text-rose-600 shadow-sm',
        switchInactive: 'text-rose-400 hover:text-rose-600',
        amountCard: 'from-rose-500 via-rose-500 to-pink-500',
        amountMeta: 'bg-white/15 text-white/85',
        btn: 'from-rose-500 to-pink-500 hover:from-rose-600 hover:to-pink-600 shadow-rose-300',
      }
    : {
        heroSurface: 'from-emerald-50 via-white to-teal-50',
        heroLine: 'from-emerald-500 via-emerald-500 to-teal-500',
        iconShell: 'bg-emerald-100 text-emerald-600',
        actionShell: 'border-emerald-100 bg-white text-emerald-500 hover:bg-emerald-50',
        subtitle: 'text-emerald-500',
        switchShell: 'bg-emerald-50 border border-emerald-100',
        switchActive: 'bg-white text-emerald-600 shadow-sm',
        switchInactive: 'text-emerald-500 hover:text-emerald-700',
        amountCard: 'from-emerald-500 via-emerald-500 to-teal-500',
        amountMeta: 'bg-white/15 text-white/85',
        btn: 'from-emerald-500 to-teal-500 hover:from-emerald-600 hover:to-teal-600 shadow-emerald-300',
      };
  const optionalFieldsOpen = !isLoanExpense && (showOptionalFields || !!formData.description.trim() || !!formData.merchant.trim());
  const pageTitle = isLoanExpense
    ? (loanType === 'borrowed' ? 'Record Borrowed Money' : 'Record Lent Money')
    : isGroupExpense
      ? 'Create Group Expense'
      : 'Add Transaction';
  const pageSubtitle = isLoanExpense
    ? 'Track money you owe and money others owe you'
    : isGroupExpense
      ? 'Split a bill and track who owes what'
      : `Record a new ${formData.type}`;
  const resolvedExpenseCategory = normalizeCategorySelection(
    isExpense && !manualExpenseCategory && !formData.subcategory.trim()
      ? (smartExpenseSuggestion?.category || formData.category || DEFAULT_CATEGORY.expense)
      : formData.category,
    'expense',
  );
  const selectedIncomeCategory = !isExpense
    ? Object.values(INCOME_CATEGORIES).find((category) => category.name === formData.category) ?? null
    : null;
  const incomeAccentColor = selectedIncomeCategory?.color ?? '#10B981';
  const formattedTransactionDate = useMemo(() => {
    const parsedDate = new Date(`${formData.date}T00:00:00`);
    if (Number.isNaN(parsedDate.getTime())) return formData.date;
    return parsedDate.toLocaleDateString('en-IN', {
      day: 'numeric',
      month: 'short',
      year: 'numeric',
    });
  }, [formData.date]);
  const optionalDetailsTitle = isLoanExpense ? 'Loan notes' : isExpense ? 'More details' : 'Income details';
  const optionalDetailsLabel = isLoanExpense ? 'Add optional context for this loan' : isExpense ? 'Merchant and note are optional' : 'Source / payer and note are optional';
  const visibleExpenseSuggestions = expenseSuggestions.slice(0, 5);
  const formatAccountBalance = (amount: number) => {
    try {
      return new Intl.NumberFormat('en-IN', {
        style: 'currency',
        currency,
        minimumFractionDigits: 2,
        maximumFractionDigits: 2,
      }).format(amount);
    } catch {
      return `${currency} ${amount.toFixed(2)}`;
    }
  };
  const accountTypeMeta = {
    bank: {
      label: 'Bank',
      icon: Wallet,
      shell: 'bg-blue-50 text-blue-600',
      badge: 'bg-blue-100 text-blue-700',
    },
    card: {
      label: 'Card',
      icon: CreditCard,
      shell: 'bg-violet-50 text-violet-600',
      badge: 'bg-violet-100 text-violet-700',
    },
    cash: {
      label: 'Cash',
      icon: Banknote,
      shell: 'bg-emerald-50 text-emerald-600',
      badge: 'bg-emerald-100 text-emerald-700',
    },
    wallet: {
      label: 'Wallet',
      icon: Smartphone,
      shell: 'bg-amber-50 text-amber-600',
      badge: 'bg-amber-100 text-amber-700',
    },
  } as const;
  const selectedAccountMeta = accountTypeMeta[selectedAccount?.type ?? 'bank'];

  const formEl = (
    <form onSubmit={handleSubmit} className="flex flex-col flex-1">
      {/* ── Immersive Header ── */}
      <div className={cn('relative overflow-hidden border-b border-gray-100 bg-gradient-to-br px-4 pt-4 pb-5', accent.heroSurface)}>
        <div className={cn('absolute inset-x-0 top-0 h-1 bg-gradient-to-r', accent.heroLine)} />
        <div className="absolute -top-10 right-2 h-24 w-24 rounded-full bg-white/70 blur-3xl pointer-events-none" />

        <div className="relative rounded-[28px] border border-white/80 bg-white/85 p-4 shadow-[0_18px_48px_rgba(15,23,42,0.08)] backdrop-blur-xl">
          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={() => setCurrentPage(returnPage)}
              aria-label="Go back"
              title="Go back"
              className={cn('flex h-11 w-11 items-center justify-center rounded-2xl border shadow-sm transition-colors', accent.actionShell)}
            >
              <ChevronLeft size={19} />
            </button>
            <div className="min-w-0 flex-1">
              <h1 className="font-display text-xl font-bold leading-tight text-gray-900">{pageTitle}</h1>
              <p className={cn('text-sm font-medium', accent.subtitle)}>{pageSubtitle}</p>
            </div>
            {isExpense && !isLoanExpense && (
              <button
                type="button"
                onClick={() => setShowScanner(true)}
                className={cn('flex h-11 w-11 items-center justify-center rounded-2xl border shadow-sm transition-colors', accent.actionShell)}
                title="Scan receipt"
              >
                <Camera size={18} />
              </button>
            )}
          </div>

          <div className={cn('mt-4 flex rounded-2xl p-1', accent.switchShell)}>
            <button
              type="button"
              onClick={() => switchType('expense')}
              className={cn(
                'flex flex-1 items-center justify-center gap-2 rounded-xl py-2.5 text-sm font-bold transition-all',
                isExpense ? accent.switchActive : accent.switchInactive,
              )}
            >
              <ArrowDownLeft size={16} />
              <span>Expense</span>
            </button>
            <button
              type="button"
              onClick={() => switchType('income')}
              className={cn(
                'flex flex-1 items-center justify-center gap-2 rounded-xl py-2.5 text-sm font-bold transition-all',
                !isExpense ? accent.switchActive : accent.switchInactive,
              )}
            >
              <ArrowUpRight size={16} />
              <span>Income</span>
            </button>
          </div>

          {isExpense && (
            <div className="mt-4 rounded-2xl border border-gray-200 bg-white/90 p-1.5 shadow-sm">
              <p className="px-2 pb-2 text-[10px] font-bold uppercase tracking-[0.22em] text-gray-400">
                Expense mode
              </p>
              <div className="grid gap-2 md:grid-cols-3">
                <label
                  className={cn(
                    'relative flex cursor-pointer items-start gap-3 rounded-2xl border px-3 py-3 transition-all',
                    expenseMode === 'individual'
                      ? 'border-gray-900 bg-gray-900 text-white shadow-sm'
                      : 'border-gray-200 bg-white text-gray-700 hover:border-gray-300',
                  )}
                >
                  <input
                    type="radio"
                    name="expense-mode"
                    className="sr-only"
                    checked={expenseMode === 'individual'}
                    onChange={() => switchExpenseMode('individual')}
                  />
                  <span
                    className={cn(
                      'mt-0.5 flex h-4 w-4 shrink-0 items-center justify-center rounded-full border',
                      expenseMode === 'individual'
                        ? 'border-white bg-white text-gray-900'
                        : 'border-gray-300 bg-white',
                    )}
                  >
                    {expenseMode === 'individual' && <span className="h-2 w-2 rounded-full bg-current" />}
                  </span>
                  <span className="min-w-0">
                    <span className="block text-sm font-semibold">Individual</span>
                    <span className={cn('mt-0.5 block text-xs', expenseMode === 'individual' ? 'text-white/75' : 'text-gray-500')}>
                      Regular expense for yourself
                    </span>
                  </span>
                </label>
                <label
                  className={cn(
                    'relative flex cursor-pointer items-start gap-3 rounded-2xl border px-3 py-3 transition-all',
                    expenseMode === 'group'
                      ? 'border-gray-900 bg-gray-900 text-white shadow-sm'
                      : 'border-gray-200 bg-white text-gray-700 hover:border-gray-300',
                  )}
                >
                  <input
                    type="radio"
                    name="expense-mode"
                    className="sr-only"
                    checked={expenseMode === 'group'}
                    onChange={() => switchExpenseMode('group')}
                  />
                  <span
                    className={cn(
                      'mt-0.5 flex h-4 w-4 shrink-0 items-center justify-center rounded-full border',
                      expenseMode === 'group'
                        ? 'border-white bg-white text-gray-900'
                        : 'border-gray-300 bg-white',
                    )}
                  >
                    {expenseMode === 'group' && <span className="h-2 w-2 rounded-full bg-current" />}
                  </span>
                  <span className="min-w-0">
                    <span className="block text-sm font-semibold">Group</span>
                    <span className={cn('mt-0.5 block text-xs', expenseMode === 'group' ? 'text-white/75' : 'text-gray-500')}>
                      Split this bill with friends
                    </span>
                  </span>
                </label>
                <label
                  className={cn(
                    'relative flex cursor-pointer items-start gap-3 rounded-2xl border px-3 py-3 transition-all',
                    expenseMode === 'loan'
                      ? 'border-gray-900 bg-gray-900 text-white shadow-sm'
                      : 'border-gray-200 bg-white text-gray-700 hover:border-gray-300',
                  )}
                >
                  <input
                    type="radio"
                    name="expense-mode"
                    className="sr-only"
                    checked={expenseMode === 'loan'}
                    onChange={() => switchExpenseMode('loan')}
                  />
                  <span
                    className={cn(
                      'mt-0.5 flex h-4 w-4 shrink-0 items-center justify-center rounded-full border',
                      expenseMode === 'loan'
                        ? 'border-white bg-white text-gray-900'
                        : 'border-gray-300 bg-white',
                    )}
                  >
                    {expenseMode === 'loan' && <span className="h-2 w-2 rounded-full bg-current" />}
                  </span>
                  <span className="min-w-0">
                    <span className="block text-sm font-semibold">Loan</span>
                    <span className={cn('mt-0.5 block text-xs', expenseMode === 'loan' ? 'text-white/75' : 'text-gray-500')}>
                      Borrow or lend money
                    </span>
                  </span>
                </label>
              </div>
            </div>
          )}

          <div className={cn('mt-4 rounded-[26px] bg-gradient-to-br px-4 py-4 text-white shadow-lg', accent.amountCard)}>
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0 flex-1">
                <p className="text-[11px] font-bold uppercase tracking-[0.24em] text-white/70">Amount</p>
                <div className="mt-2 flex items-center gap-2">
                  <span className="shrink-0 text-lg font-bold text-white/80">{currency}</span>
                  <input
                    type="number"
                    step="0.01"
                    min="0"
                    value={amountStr}
                    onChange={e => handleAmountChange(e.target.value)}
                    className="w-full flex-1 bg-transparent text-3xl sm:text-4xl font-display font-bold text-white focus:outline-none placeholder:text-white/35"
                    placeholder="0.00"
                    required
                    autoFocus
                  />
                </div>
              </div>
              {selectedAccount && (
                <div className={cn('max-w-[46%] rounded-2xl px-3 py-2 text-right backdrop-blur-sm', accent.amountMeta)}>
                  <p className="text-[10px] font-bold uppercase tracking-[0.22em] text-white/70">
                    {isGroupExpense ? 'Paid from' : isLoanExpense ? loanAccountLabel : 'Account'}
                  </p>
                  <p className="truncate text-xs font-semibold text-white">{selectedAccount.name}</p>
                </div>
              )}
            </div>
            {selectedAccount && (
              <p className="mt-3 text-xs font-medium text-white/80">
                Available balance {formatAccountBalance(selectedAccount.balance)}
              </p>
            )}
          </div>
        </div>
      </div>

      {/* ── Form Fields Card ── */}
      <div className="flex-1 bg-white -mt-3 rounded-t-[28px] shadow-xl divide-y divide-gray-100 overflow-hidden">
        {/* Account */}
        {selectedAccount && (
          <FieldRow
            icon={<Wallet size={16} className="text-gray-500" />}
            label={isGroupExpense ? 'Payment account' : isLoanExpense ? loanAccountLabel : 'Account'}
          >
            <div className="space-y-2" ref={accountPickerRef}>
              <button
                type="button"
                onClick={() => accounts.length > 1 && setShowAccountPicker((prev) => !prev)}
                className={cn(
                  'w-full rounded-2xl border border-gray-200 bg-gradient-to-br from-white to-gray-50 px-3 py-3 text-left shadow-sm transition-all',
                  accounts.length > 1 ? 'hover:border-gray-300 hover:bg-gray-50' : 'cursor-default'
                )}
              >
                <div className="flex items-center gap-3">
                  <div className={cn('flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl', selectedAccountMeta.shell)}>
                    <selectedAccountMeta.icon size={18} />
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      <p className="truncate text-sm font-semibold text-gray-900">{selectedAccount.name}</p>
                      <span className={cn('shrink-0 rounded-full px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide', selectedAccountMeta.badge)}>
                        {selectedAccountMeta.label}
                      </span>
                    </div>
                    <p className="mt-1 text-xs font-medium text-gray-500">
                      Available balance {formatAccountBalance(selectedAccount.balance)}
                    </p>
                  </div>
                  {accounts.length > 1 && (
                    <DropdownCaret open={showAccountPicker} />
                  )}
                </div>
              </button>

              <AnimatePresence>
                {showAccountPicker && accounts.length > 1 && (
                  <motion.div
                    initial={{ opacity: 0, y: -8 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -8 }}
                    className="overflow-hidden rounded-2xl border border-gray-200 bg-white shadow-lg"
                  >
                    <div className="border-b border-gray-100 bg-gray-50 px-3 py-2.5">
                      <p className="text-[10px] font-bold uppercase tracking-[0.22em] text-gray-400">Choose account</p>
                    </div>
                    <div className="divide-y divide-gray-100">
                      {accounts.map((account) => {
                        const meta = accountTypeMeta[account.type ?? 'bank'];
                        const isSelected = account.id === formData.accountId;
                        return (
                          <button
                            key={account.id}
                            type="button"
                            onClick={() => {
                              setFormData((prev) => ({ ...prev, accountId: account.id ?? prev.accountId }));
                              setShowAccountPicker(false);
                            }}
                            className={cn(
                              'flex w-full items-center gap-3 px-3 py-3 text-left transition-colors',
                              isSelected ? 'bg-gray-50' : 'hover:bg-gray-50'
                            )}
                          >
                            <div className={cn('flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl', meta.shell)}>
                              <meta.icon size={17} />
                            </div>
                            <div className="min-w-0 flex-1">
                              <p className="truncate text-sm font-semibold text-gray-900">{account.name}</p>
                              <div className="mt-1 flex items-center gap-2">
                                <span className={cn('rounded-full px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide', meta.badge)}>
                                  {meta.label}
                                </span>
                                <span className="truncate text-xs text-gray-500">{formatAccountBalance(account.balance)}</span>
                              </div>
                            </div>
                            {isSelected && (
                              <div className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-gray-900 text-white">
                                <Check size={13} />
                              </div>
                            )}
                          </button>
                        );
                      })}
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          </FieldRow>
        )}

        {isLoanExpense && (
          <>
            <FieldRow icon={<CreditCard size={16} className="text-gray-500" />} label="Loan type">
              <div className="grid grid-cols-2 gap-2">
                <button
                  type="button"
                  onClick={() => setLoanType('borrowed')}
                  className={cn(
                    'rounded-2xl border px-3 py-3 text-left transition-all',
                    loanType === 'borrowed'
                      ? 'border-sky-600 bg-sky-600 text-white shadow-sm'
                      : 'border-gray-200 bg-white text-gray-700 hover:border-gray-300',
                  )}
                >
                  <div className="flex items-center gap-2">
                    <ArrowDownLeft size={16} />
                    <p className="text-sm font-semibold">Borrow</p>
                  </div>
                  <p className={cn('mt-1 text-xs', loanType === 'borrowed' ? 'text-white/80' : 'text-gray-500')}>
                    Money received into your account
                  </p>
                </button>
                <button
                  type="button"
                  onClick={() => setLoanType('lent')}
                  className={cn(
                    'rounded-2xl border px-3 py-3 text-left transition-all',
                    loanType === 'lent'
                      ? 'border-sky-600 bg-sky-600 text-white shadow-sm'
                      : 'border-gray-200 bg-white text-gray-700 hover:border-gray-300',
                  )}
                >
                  <div className="flex items-center gap-2">
                    <ArrowUpRight size={16} />
                    <p className="text-sm font-semibold">Lend</p>
                  </div>
                  <p className={cn('mt-1 text-xs', loanType === 'lent' ? 'text-white/80' : 'text-gray-500')}>
                    Money paid out from your account
                  </p>
                </button>
              </div>
            </FieldRow>

            <FieldRow icon={<Users size={16} className="text-gray-500" />} label={loanType === 'borrowed' ? 'Lender' : 'Borrower'}>
              <div className="space-y-3">
                {friends.length > 0 && (
                  <div className="space-y-2" ref={loanFriendPickerRef}>
                    <button
                      type="button"
                      onClick={() => setShowLoanFriendPicker((prev) => !prev)}
                      className="inline-flex items-center gap-2 rounded-2xl border border-gray-200 bg-white px-3 py-2 text-xs font-semibold text-gray-700 shadow-sm transition-colors hover:bg-gray-50"
                    >
                      <Users size={14} />
                      Pick saved friend
                      <DropdownCaret open={showLoanFriendPicker} size={14} className="h-7 w-7 rounded-lg border-gray-100 text-gray-500 shadow-none" />
                    </button>

                    <AnimatePresence>
                      {showLoanFriendPicker && (
                        <motion.div
                          initial={{ opacity: 0, y: -8 }}
                          animate={{ opacity: 1, y: 0 }}
                          exit={{ opacity: 0, y: -8 }}
                          className="overflow-hidden rounded-2xl border border-gray-200 bg-white shadow-lg"
                        >
                          <div className="border-b border-gray-100 bg-gray-50 px-3 py-2.5">
                            <p className="text-[10px] font-bold uppercase tracking-[0.22em] text-gray-400">Saved friends</p>
                          </div>
                          <div className="max-h-56 divide-y divide-gray-100 overflow-y-auto">
                            {friends.map((friend) => (
                              <button
                                key={friend.id}
                                type="button"
                                onClick={() => addSavedFriendToLoan(friend)}
                                className="flex w-full items-center gap-3 px-3 py-3 text-left transition-colors hover:bg-gray-50"
                              >
                                <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-gray-100 text-sm font-semibold text-gray-700">
                                  {friend.name.charAt(0).toUpperCase()}
                                </div>
                                <div className="min-w-0 flex-1">
                                  <p className="truncate text-sm font-semibold text-gray-900">{friend.name}</p>
                                  <p className="truncate text-xs text-gray-500">
                                    {[friend.email, friend.phone].filter(Boolean).join(' · ') || 'No contact saved'}
                                  </p>
                                </div>
                              </button>
                            ))}
                          </div>
                        </motion.div>
                      )}
                    </AnimatePresence>
                  </div>
                )}

                <input
                  type="text"
                  value={loanDraft.contactName}
                  onChange={(e) => setLoanDraft((prev) => ({
                    ...prev,
                    friendId: undefined,
                    contactName: e.target.value,
                  }))}
                  className="w-full rounded-2xl border border-gray-200 bg-gray-50 px-4 py-3 text-sm font-semibold text-gray-900 focus:border-gray-400 focus:outline-none focus:ring-0"
                  placeholder={loanType === 'borrowed' ? 'Who gave you this loan?' : 'Who received this loan?'}
                  required={isLoanExpense}
                />

                <div className="grid gap-2 sm:grid-cols-2">
                  <label className="flex items-center gap-2 rounded-2xl border border-gray-200 bg-gray-50 px-3 py-3">
                    <Mail size={14} className="text-gray-400" />
                    <input
                      type="email"
                      value={loanDraft.contactEmail}
                      onChange={(e) => setLoanDraft((prev) => ({
                        ...prev,
                        friendId: undefined,
                        contactEmail: e.target.value,
                      }))}
                      className="w-full bg-transparent text-sm text-gray-900 focus:outline-none placeholder:text-gray-300"
                      placeholder="Email (optional)"
                    />
                  </label>
                  <label className="flex items-center gap-2 rounded-2xl border border-gray-200 bg-gray-50 px-3 py-3">
                    <Phone size={14} className="text-gray-400" />
                    <input
                      type="tel"
                      value={loanDraft.contactPhone}
                      onChange={(e) => setLoanDraft((prev) => ({
                        ...prev,
                        friendId: undefined,
                        contactPhone: e.target.value,
                      }))}
                      className="w-full bg-transparent text-sm text-gray-900 focus:outline-none placeholder:text-gray-300"
                      placeholder="Phone (optional)"
                    />
                  </label>
                </div>
              </div>
            </FieldRow>

            <FieldRow icon={<CalendarDays size={16} className="text-gray-500" />} label="Timeline">
              <div className="grid gap-3 sm:grid-cols-2">
                <div className="relative">
                  <button
                    type="button"
                    onClick={() => openDateInputPicker(loanDateInputRef.current)}
                    className="block w-full rounded-2xl border border-gray-200 bg-gradient-to-br from-white to-gray-50 px-4 py-3 text-left shadow-sm transition-colors hover:border-gray-300"
                  >
                    <p className="text-[10px] font-bold uppercase tracking-[0.22em] text-gray-400">
                      {loanType === 'borrowed' ? 'Borrow date' : 'Lend date'}
                    </p>
                    <p className="mt-1 text-sm font-semibold text-gray-900">{formattedTransactionDate}</p>
                  </button>
                  <input
                    ref={loanDateInputRef}
                    type="date"
                    value={formData.date}
                    onChange={(e) => setFormData((prev) => ({ ...prev, date: e.target.value }))}
                    className="pointer-events-none absolute inset-0 opacity-0"
                    required
                    title="Select loan date"
                  />
                </div>

                <div className="relative">
                  <button
                    type="button"
                    onClick={() => openDateInputPicker(loanDueDateInputRef.current)}
                    className="block w-full rounded-2xl border border-gray-200 bg-gradient-to-br from-white to-gray-50 px-4 py-3 text-left shadow-sm transition-colors hover:border-gray-300"
                  >
                    <p className="text-[10px] font-bold uppercase tracking-[0.22em] text-gray-400">Due date</p>
                    <p className="mt-1 text-sm font-semibold text-gray-900">
                      {loanDraft.dueDate ? new Intl.DateTimeFormat('en-IN', {
                        day: 'numeric',
                        month: 'short',
                        year: 'numeric',
                      }).format(new Date(loanDraft.dueDate)) : 'Select due date'}
                    </p>
                  </button>
                  <input
                    ref={loanDueDateInputRef}
                    type="date"
                    value={loanDraft.dueDate}
                    onChange={(e) => setLoanDraft((prev) => ({ ...prev, dueDate: e.target.value }))}
                    className="pointer-events-none absolute inset-0 opacity-0"
                    required={isLoanExpense}
                    min={formData.date}
                    title="Select due date"
                  />
                </div>
              </div>
            </FieldRow>

            <FieldRow icon={<Banknote size={16} className="text-gray-500" />} label="Interest">
              <div className="space-y-3">
                <label className="flex items-center gap-3 rounded-2xl border border-gray-200 bg-gray-50 px-4 py-3">
                  <input
                    type="number"
                    min="0"
                    step="0.01"
                    value={loanDraft.interestRate ? String(loanDraft.interestRate) : ''}
                    onChange={(e) => setLoanDraft((prev) => ({
                      ...prev,
                      interestRate: parseFloat(e.target.value) || 0,
                    }))}
                    className="w-full bg-transparent text-sm font-semibold text-gray-900 focus:outline-none placeholder:text-gray-300"
                    placeholder="Interest rate (optional)"
                  />
                  <span className="text-sm font-semibold text-gray-500">%</span>
                </label>

                <div className="grid gap-2 rounded-2xl border border-sky-100 bg-sky-50/70 p-3 sm:grid-cols-3">
                  <div>
                    <p className="text-[10px] font-bold uppercase tracking-[0.22em] text-sky-500">Principal</p>
                    <p className="mt-1 text-sm font-semibold text-gray-900">{formatAccountBalance(formData.amount)}</p>
                  </div>
                  <div>
                    <p className="text-[10px] font-bold uppercase tracking-[0.22em] text-sky-500">Interest</p>
                    <p className="mt-1 text-sm font-semibold text-gray-900">{formatAccountBalance(loanInterestAmount)}</p>
                  </div>
                  <div>
                    <p className="text-[10px] font-bold uppercase tracking-[0.22em] text-sky-500">Total due</p>
                    <p className="mt-1 text-sm font-semibold text-gray-900">{formatAccountBalance(loanTotalDue)}</p>
                  </div>
                </div>
              </div>
            </FieldRow>

            <FieldRow icon={<AlignLeft size={16} className="text-gray-500" />} label="Notes">
              <div className="rounded-2xl border border-gray-200 bg-gray-50 px-4 py-3">
                <input
                  type="text"
                  value={loanDraft.notes}
                  onChange={(e) => setLoanDraft((prev) => ({ ...prev, notes: e.target.value }))}
                  className="w-full bg-transparent text-sm text-gray-900 focus:outline-none placeholder:text-gray-300"
                  placeholder="Optional note about this loan"
                />
              </div>
            </FieldRow>
          </>
        )}

        {isGroupExpense && (
          <>
            <FieldRow icon={<Users size={16} className="text-gray-500" />} label="Group">
              <div className="space-y-3">
                <input
                  type="text"
                  value={groupName}
                  onChange={(e) => setGroupName(e.target.value)}
                  className="w-full rounded-2xl border border-gray-200 bg-gray-50 px-4 py-3 text-sm font-semibold text-gray-900 focus:border-gray-400 focus:outline-none focus:ring-0"
                  placeholder="Dinner, Goa trip, team lunch..."
                  required={isGroupExpense}
                />

                <div className="grid grid-cols-2 gap-2">
                  <button
                    type="button"
                    onClick={() => setGroupSplitType('equal')}
                    className={cn(
                      'rounded-2xl border px-3 py-3 text-left transition-all',
                      groupSplitType === 'equal'
                        ? 'border-gray-900 bg-gray-900 text-white shadow-sm'
                        : 'border-gray-200 bg-white text-gray-700 hover:border-gray-300',
                    )}
                  >
                    <p className="text-sm font-semibold">Equal split</p>
                    <p className={cn('mt-1 text-xs', groupSplitType === 'equal' ? 'text-white/75' : 'text-gray-500')}>
                      Everyone pays the same share
                    </p>
                  </button>
                  <button
                    type="button"
                    onClick={() => setGroupSplitType('custom')}
                    className={cn(
                      'rounded-2xl border px-3 py-3 text-left transition-all',
                      groupSplitType === 'custom'
                        ? 'border-gray-900 bg-gray-900 text-white shadow-sm'
                        : 'border-gray-200 bg-white text-gray-700 hover:border-gray-300',
                    )}
                  >
                    <p className="text-sm font-semibold">Custom split</p>
                    <p className={cn('mt-1 text-xs', groupSplitType === 'custom' ? 'text-white/75' : 'text-gray-500')}>
                      Set each friend&apos;s share manually
                    </p>
                  </button>
                </div>

                <div className="grid gap-2 rounded-2xl border border-gray-200 bg-gray-50 p-3 sm:grid-cols-3">
                  <div>
                    <p className="text-[10px] font-bold uppercase tracking-[0.22em] text-gray-400">Friends</p>
                    <p className="mt-1 text-sm font-semibold text-gray-900">{activeGroupParticipants.length}</p>
                  </div>
                  <div>
                    <p className="text-[10px] font-bold uppercase tracking-[0.22em] text-gray-400">Your share</p>
                    <p className="mt-1 text-sm font-semibold text-gray-900">{formatAccountBalance(currentUserShare)}</p>
                  </div>
                  <div>
                    <p className="text-[10px] font-bold uppercase tracking-[0.22em] text-gray-400">To collect</p>
                    <p className="mt-1 text-sm font-semibold text-gray-900">{formatAccountBalance(totalAmountToCollect)}</p>
                  </div>
                </div>
              </div>
            </FieldRow>

            <FieldRow icon={<UserPlus size={16} className="text-gray-500" />} label="Participants">
              <div className="space-y-3">
                <div className="space-y-3" ref={groupFriendPickerRef}>
                  <div className="flex flex-wrap gap-2">
                    <button
                      type="button"
                      onClick={() => {
                        if (friends.length > 0) {
                          setShowGroupFriendPicker((prev) => !prev);
                        } else {
                          setCurrentPage('add-friends');
                        }
                      }}
                      className="inline-flex items-center gap-2 rounded-2xl border border-gray-200 bg-white px-3 py-2 text-xs font-semibold text-gray-700 shadow-sm transition-colors hover:bg-gray-50"
                    >
                      <Users size={14} />
                      {friends.length > 0 ? 'Add from friends' : 'Add friends first'}
                      {friends.length > 0 && (
                        <DropdownCaret open={showGroupFriendPicker} size={14} className="h-7 w-7 rounded-lg border-gray-100 text-gray-500 shadow-none" />
                      )}
                    </button>
                    <button
                      type="button"
                      onClick={() => addGroupParticipant()}
                      className="inline-flex items-center gap-2 rounded-2xl border border-gray-200 bg-white px-3 py-2 text-xs font-semibold text-gray-700 shadow-sm transition-colors hover:bg-gray-50"
                    >
                      <UserPlus size={14} />
                      Add participant
                    </button>
                  </div>

                  <AnimatePresence>
                    {showGroupFriendPicker && availableSavedFriends.length > 0 && (
                      <motion.div
                        initial={{ opacity: 0, y: -8 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0, y: -8 }}
                        className="overflow-hidden rounded-2xl border border-gray-200 bg-white shadow-lg"
                      >
                        <div className="border-b border-gray-100 bg-gray-50 px-3 py-2.5">
                          <p className="text-[10px] font-bold uppercase tracking-[0.22em] text-gray-400">Saved friends</p>
                        </div>
                        <div className="max-h-56 divide-y divide-gray-100 overflow-y-auto">
                          {availableSavedFriends.map((friend) => (
                            <button
                              key={friend.id}
                              type="button"
                              onClick={() => addSavedFriendToGroup(friend)}
                              className="flex w-full items-center gap-3 px-3 py-3 text-left transition-colors hover:bg-gray-50"
                            >
                              <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-gray-100 text-sm font-semibold text-gray-700">
                                {friend.name.charAt(0).toUpperCase()}
                              </div>
                              <div className="min-w-0 flex-1">
                                <p className="truncate text-sm font-semibold text-gray-900">{friend.name}</p>
                                <p className="truncate text-xs text-gray-500">
                                  {[friend.email, friend.phone].filter(Boolean).join(' · ') || 'No contact saved'}
                                </p>
                              </div>
                            </button>
                          ))}
                        </div>
                      </motion.div>
                    )}
                  </AnimatePresence>
                </div>

                {groupParticipants.length === 0 && (
                  <div className="rounded-2xl border border-dashed border-gray-300 bg-gray-50 px-4 py-4 text-sm text-gray-500">
                    Add at least one friend. You are included automatically as the payer.
                  </div>
                )}

                <div className="space-y-3">
                  {groupParticipants.map((participant, index) => {
                    const resolvedShare = groupSplitType === 'equal'
                      ? equalPerPersonShare
                      : roundCurrencyAmount(participant.share);

                    return (
                      <div key={participant.id} className="rounded-2xl border border-gray-200 bg-white p-3 shadow-sm">
                        <div className="mb-3 flex items-start justify-between gap-3">
                          <div>
                            <p className="text-sm font-semibold text-gray-900">Friend {index + 1}</p>
                            <p className="mt-1 text-xs text-gray-500">
                              {groupSplitType === 'equal'
                                ? `Share ${formatAccountBalance(resolvedShare)}`
                                : 'Set contact info and custom share'}
                            </p>
                          </div>
                          <button
                            type="button"
                            onClick={() => removeGroupParticipant(participant.id)}
                            className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl border border-red-100 bg-red-50 text-red-500 transition-colors hover:bg-red-100"
                            title="Remove participant"
                          >
                            <Trash2 size={15} />
                          </button>
                        </div>

                        <div className="grid gap-2">
                          <input
                            type="text"
                            value={participant.name}
                            onChange={(e) => updateGroupParticipant(participant.id, { name: e.target.value })}
                            className="w-full rounded-2xl border border-gray-200 bg-gray-50 px-4 py-3 text-sm font-medium text-gray-900 focus:border-gray-400 focus:outline-none focus:ring-0"
                            placeholder="Friend name"
                          />
                          <div className="grid gap-2 sm:grid-cols-2">
                            <label className="flex items-center gap-2 rounded-2xl border border-gray-200 bg-gray-50 px-3 py-3">
                              <Mail size={14} className="text-gray-400" />
                              <input
                                type="email"
                                value={participant.email}
                                onChange={(e) => updateGroupParticipant(participant.id, { email: e.target.value })}
                                className="w-full bg-transparent text-sm text-gray-900 focus:outline-none placeholder:text-gray-300"
                                placeholder="Email"
                              />
                            </label>
                            <label className="flex items-center gap-2 rounded-2xl border border-gray-200 bg-gray-50 px-3 py-3">
                              <Phone size={14} className="text-gray-400" />
                              <input
                                type="tel"
                                value={participant.phone}
                                onChange={(e) => updateGroupParticipant(participant.id, { phone: e.target.value })}
                                className="w-full bg-transparent text-sm text-gray-900 focus:outline-none placeholder:text-gray-300"
                                placeholder="Phone"
                              />
                            </label>
                          </div>
                          {groupSplitType === 'custom' && (
                            <label className="flex items-center gap-3 rounded-2xl border border-gray-200 bg-gray-50 px-4 py-3">
                              <span className="text-sm font-semibold text-gray-500">{currency}</span>
                              <input
                                type="number"
                                min="0"
                                step="0.01"
                                value={participant.share ? String(participant.share) : ''}
                                onChange={(e) => updateGroupParticipant(participant.id, {
                                  share: roundCurrencyAmount(parseFloat(e.target.value) || 0),
                                })}
                                className="w-full bg-transparent text-sm font-semibold text-gray-900 focus:outline-none placeholder:text-gray-300"
                                placeholder="Share amount"
                              />
                            </label>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>

                <div className={cn(
                  'rounded-2xl border px-4 py-3 text-sm',
                  hasOverAllocatedGroupShares
                    ? 'border-red-200 bg-red-50 text-red-700'
                    : 'border-gray-200 bg-gray-50 text-gray-600'
                )}>
                  <p className="font-semibold text-gray-900">Split preview</p>
                  <p className="mt-1">
                    You paid {formatAccountBalance(formData.amount)} from {selectedAccount?.name}. Your share is {formatAccountBalance(currentUserShare)}.
                  </p>
                  <p className="mt-1">
                    {groupSplitType === 'equal'
                      ? `Each friend owes ${formatAccountBalance(equalPerPersonShare)}.`
                      : `Friends owe ${formatAccountBalance(totalFriendShares)} in total.`}
                  </p>
                </div>
              </div>
            </FieldRow>
          </>
        )}

        {/* Category */}
        {!isExpense && (
          <FieldRow icon={<Tag size={16} className="text-gray-500" />} label="Category">
            <CategoryDropdown
              value={formData.category}
              onChange={v => {
                setShowIncomeSubcategoryPicker(false);
                setFormData(p => ({ ...p, category: v, subcategory: '' }));
              }}
              options={CATEGORIES[formData.type]}
              label=""
            />
          </FieldRow>
        )}

        {/* Subcategory */}
        <AnimatePresence>
          {((isExpense && !isLoanExpense) || (!isExpense && subcategories.length > 0)) && (
            <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: 'auto', opacity: 1 }} exit={{ height: 0, opacity: 0 }} className="overflow-hidden">
              <FieldRow
                icon={isExpense ? <Sparkles size={16} className="text-gray-500" /> : <Tag size={16} className="text-gray-500" />}
                label={isExpense ? 'Expense Type' : 'Subcategory'}
              >
                {isExpense ? (
                  <div className="space-y-3">
                    <div className="relative">
                      <Search size={16} className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-gray-400" />
                      <input
                        type="text"
                        value={subcategoryQuery}
                        onChange={(e) => {
                          const value = e.target.value;
                          setSubcategoryQuery(value);
                          if (!value.trim()) {
                            setManualExpenseCategory(false);
                          }
                          const exactCategory = getCategoryForExpenseSubcategory(value, customExpenseSubcategories);

                          if (exactCategory) {
                            setManualExpenseCategory(false);
                            setFormData((prev) => ({
                              ...prev,
                              category: exactCategory,
                              subcategory: value.trim(),
                            }));
                            return;
                          }

                          setFormData((prev) => ({
                            ...prev,
                            subcategory: '',
                          }));
                        }}
                        className="w-full rounded-2xl border border-gray-200 bg-gray-50 pl-11 pr-20 py-3 text-sm font-medium text-gray-900 focus:border-gray-400 focus:outline-none focus:ring-0"
                        placeholder="Groceries, Uber, Netflix, pizza..."
                      />
                      {(formData.subcategory || smartExpenseSuggestion) && (
                        <span className="absolute right-3 top-1/2 -translate-y-1/2 rounded-full bg-white px-2.5 py-1 text-[10px] font-bold uppercase tracking-wide text-gray-500 shadow-sm ring-1 ring-gray-200">
                          {formData.subcategory ? 'Matched' : 'Smart'}
                        </span>
                      )}
                    </div>

                    <div className="flex flex-wrap items-center gap-2.5">
                      <div className="inline-flex items-center gap-2 rounded-2xl border border-gray-200 bg-gradient-to-br from-white to-gray-50 px-3 py-2 shadow-sm">
                        <div className="shrink-0">
                          {getCategoryCartoonIcon(resolvedExpenseCategory, 26)}
                        </div>
                        <div className="min-w-0">
                          <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-gray-400">Category</p>
                          <p className="text-xs font-semibold text-gray-800">{resolvedExpenseCategory}</p>
                        </div>
                      </div>
                      <button
                        type="button"
                        onClick={() => setShowCategoryPicker((prev) => !prev)}
                        className="inline-flex items-center gap-2 rounded-2xl border border-gray-200 bg-white px-3 py-2 text-xs font-semibold text-gray-600 shadow-sm transition-colors hover:bg-gray-50"
                      >
                        {showCategoryPicker ? 'Hide category' : 'Change category'}
                        <DropdownCaret open={showCategoryPicker} size={14} className="h-7 w-7 rounded-lg border-gray-100 text-gray-500 shadow-none" />
                      </button>
                      {(formData.subcategory || smartExpenseSuggestion) && (
                        <span className="text-xs text-gray-500">
                          {formData.subcategory
                            ? `Auto-mapped from ${formData.subcategory}`
                            : 'Suggested from text'}
                        </span>
                      )}
                    </div>

                    <AnimatePresence>
                      {showCategoryPicker && (
                        <motion.div
                          initial={{ height: 0, opacity: 0 }}
                          animate={{ height: 'auto', opacity: 1 }}
                          exit={{ height: 0, opacity: 0 }}
                          className="overflow-hidden"
                        >
                          <CategoryDropdown
                            value={formData.category}
                            onChange={(value) => {
                              setManualExpenseCategory(true);
                              setFormData((prev) => ({ ...prev, category: value, subcategory: '' }));
                            }}
                            options={CATEGORIES.expense}
                            label=""
                          />
                        </motion.div>
                      )}
                    </AnimatePresence>

                    <div className="overflow-hidden rounded-2xl border border-gray-200 bg-white shadow-sm">
                      <div className="flex items-center justify-between border-b border-gray-100 bg-gray-50/80 px-3 py-2.5">
                        <div>
                          <p className="text-[10px] font-bold uppercase tracking-[0.22em] text-gray-400">
                            {subcategoryQuery.trim() ? 'Best Matches' : 'Recent Picks'}
                          </p>
                          <p className="mt-0.5 text-xs text-gray-500">
                            Choose the closest expense type
                          </p>
                        </div>
                        {visibleExpenseSuggestions.length > 0 && (
                          <span className="rounded-full bg-white px-2 py-1 text-[10px] font-bold text-gray-500 ring-1 ring-gray-200">
                            {visibleExpenseSuggestions.length}
                          </span>
                        )}
                      </div>

                      <div className="max-h-64 overflow-y-auto divide-y divide-gray-100">
                        {visibleExpenseSuggestions.length > 0 ? visibleExpenseSuggestions.map((suggestion) => (
                          <button
                            key={`${suggestion.name}-${suggestion.category}`}
                            type="button"
                            onClick={() => applyExpenseSuggestion(suggestion.name, suggestion.category)}
                            className={cn(
                              'flex w-full items-center gap-3 px-3 py-3 text-left transition-colors',
                              formData.subcategory === suggestion.name
                                ? 'bg-gray-50'
                                : 'hover:bg-gray-50'
                            )}
                          >
                            <div className="shrink-0">
                              {getCategoryCartoonIcon(suggestion.category, 28)}
                            </div>
                            <div className="min-w-0 flex-1">
                              <p className="truncate text-sm font-semibold text-gray-900">{suggestion.name}</p>
                              <div className="mt-0.5 flex items-center gap-2">
                                <span className="truncate text-xs text-gray-500">{suggestion.category}</span>
                                {suggestion.isCustom && (
                                  <span className="rounded-full bg-gray-100 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-gray-500">
                                    Custom
                                  </span>
                                )}
                              </div>
                            </div>
                            {formData.subcategory === suggestion.name && (
                              <div className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-gray-900 text-white">
                                <Check size={13} />
                              </div>
                            )}
                          </button>
                        )) : (
                          <p className="px-3 py-3 text-xs text-gray-500">
                            No close matches yet.
                          </p>
                        )}
                      </div>

                      {!!subcategoryQuery.trim() && !hasExactExpenseMatch && (
                        <button
                          type="button"
                          onClick={handleSaveCustomSubcategory}
                          className="mt-2 w-full rounded-xl border border-dashed border-gray-300 bg-white px-3 py-2 text-left transition-colors hover:border-gray-400 hover:bg-gray-100"
                        >
                          <p className="text-xs font-semibold text-gray-900">
                            Save &quot;{subcategoryQuery.trim()}&quot; under {customCategoryCandidate}
                          </p>
                        </button>
                      )}
                    </div>
                  </div>
                ) : (
                  <div className="space-y-3" ref={incomeSubcategoryPickerRef}>
                    <button
                      type="button"
                      onClick={() => subcategories.length > 0 && setShowIncomeSubcategoryPicker((prev) => !prev)}
                      className={cn(
                        'w-full rounded-2xl border border-gray-200 bg-gradient-to-br from-white to-gray-50 px-3 py-3 text-left shadow-sm transition-all',
                        subcategories.length > 0 ? 'hover:border-gray-300 hover:bg-gray-50' : 'cursor-default'
                      )}
                    >
                      <div className="flex items-center gap-3">
                        <div
                          className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl shadow-inner`}
                          style={{ backgroundColor: `${incomeAccentColor}18`, color: incomeAccentColor }}
                        >
                          <span className="text-lg leading-none">{selectedIncomeCategory?.icon ?? '💵'}</span>
                        </div>
                        <div className="min-w-0 flex-1">
                          <p className="text-[10px] font-bold uppercase tracking-[0.22em] text-gray-400">Income source</p>
                          <p
                            className={cn(
                              'truncate text-sm font-semibold',
                              formData.subcategory ? 'text-gray-900' : 'text-gray-400'
                            )}
                          >
                            {formData.subcategory || 'Select a subcategory'}
                          </p>
                          <p className="mt-1 text-xs text-gray-500">
                            {selectedIncomeCategory?.name ?? 'Income'} · {subcategories.length} options
                          </p>
                        </div>
                        {subcategories.length > 0 && (
                          <DropdownCaret open={showIncomeSubcategoryPicker} />
                        )}
                      </div>
                    </button>

                    <AnimatePresence>
                      {showIncomeSubcategoryPicker && subcategories.length > 0 && (
                        <motion.div
                          initial={{ opacity: 0, y: -8 }}
                          animate={{ opacity: 1, y: 0 }}
                          exit={{ opacity: 0, y: -8 }}
                          className="overflow-hidden rounded-2xl border border-gray-200 bg-white shadow-lg"
                        >
                          <div className="border-b border-gray-100 bg-gray-50 px-3 py-2.5">
                            <p className="text-[10px] font-bold uppercase tracking-[0.22em] text-gray-400">Choose income source</p>
                            <p className="mt-1 text-xs text-gray-500">Keeps this income entry organized under {formData.category}</p>
                          </div>
                          <div className="max-h-64 divide-y divide-gray-100 overflow-y-auto">
                            {subcategories.map((subcategory) => {
                              const isSelected = formData.subcategory === subcategory;
                              const initials = subcategory
                                .split(' ')
                                .map((word) => word[0])
                                .join('')
                                .slice(0, 2)
                                .toUpperCase();

                              return (
                                <button
                                  key={subcategory}
                                  type="button"
                                  onClick={() => {
                                    setFormData((prev) => ({ ...prev, subcategory }));
                                    setShowIncomeSubcategoryPicker(false);
                                  }}
                                  className={cn(
                                    'flex w-full items-center gap-3 px-3 py-3 text-left transition-colors',
                                    isSelected ? 'bg-gray-50' : 'hover:bg-gray-50'
                                  )}
                                >
                                  <div
                                    className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-xl text-[11px] font-bold`}
                                    style={{ backgroundColor: `${incomeAccentColor}18`, color: incomeAccentColor }}
                                  >
                                    {initials}
                                  </div>
                                  <div className="min-w-0 flex-1">
                                    <p className="truncate text-sm font-semibold text-gray-900">{subcategory}</p>
                                    <p className="mt-0.5 text-xs text-gray-500">{formData.category}</p>
                                  </div>
                                  {isSelected && (
                                    <div className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-gray-900 text-white">
                                      <Check size={13} />
                                    </div>
                                  )}
                                </button>
                              );
                            })}
                          </div>
                        </motion.div>
                      )}
                    </AnimatePresence>
                  </div>
                )}
              </FieldRow>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Date */}
        {!isLoanExpense && (
          <FieldRow icon={<CalendarDays size={16} className="text-gray-500" />} label="Date">
          <label className="relative block cursor-pointer">
            <div className="rounded-2xl border border-gray-200 bg-gradient-to-br from-white to-gray-50 px-4 py-3 shadow-sm transition-colors hover:border-gray-300">
              <div className="flex items-center justify-between gap-3">
                <div>
                  <p className="text-[10px] font-bold uppercase tracking-[0.22em] text-gray-400">Transaction date</p>
                  <p className="mt-1 text-sm font-semibold text-gray-900">{formattedTransactionDate}</p>
                </div>
                <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl border border-gray-200 bg-white text-gray-500 shadow-sm">
                  <CalendarDays size={16} />
                </div>
              </div>
            </div>
            <input
              type="date"
              value={formData.date}
              onChange={e => setFormData(p => ({ ...p, date: e.target.value }))}
              className="absolute inset-0 cursor-pointer opacity-0"
              required
              title="Select date"
            />
          </label>
          </FieldRow>
        )}

        {!isLoanExpense && (
        <div className="px-4 py-3">
          <button
            type="button"
            onClick={() => setShowOptionalFields((prev) => !prev)}
            className={cn(
              'flex w-full items-center justify-between rounded-2xl border px-4 py-3 text-left transition-all',
              isExpense
                ? 'border-gray-200 bg-gray-50 hover:bg-gray-100'
                : 'border-gray-200 bg-gradient-to-br from-white to-gray-50 shadow-sm hover:border-gray-300 hover:bg-gray-50'
            )}
          >
            <div className="flex items-center gap-3">
              {!isExpense && (
                <div
                  className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl shadow-inner`}
                  style={{ backgroundColor: `${incomeAccentColor}18`, color: incomeAccentColor }}
                >
                  <AlignLeft size={16} />
                </div>
              )}
              <div>
                <p className="text-sm font-semibold text-gray-900">{optionalDetailsTitle}</p>
                <p className="text-xs text-gray-500">{optionalDetailsLabel}</p>
              </div>
            </div>
            <DropdownCaret open={optionalFieldsOpen} />
          </button>
        </div>
        )}

        <AnimatePresence initial={false}>
          {!isLoanExpense && optionalFieldsOpen && (
            <motion.div
              initial={{ height: 0, opacity: 0 }}
              animate={{ height: 'auto', opacity: 1 }}
              exit={{ height: 0, opacity: 0 }}
              className="overflow-hidden"
            >
              <div className="grid gap-3 px-4 pb-4 sm:grid-cols-2">
                <div className="rounded-2xl border border-gray-200 bg-gray-50 px-4 py-3">
                  <div className="mb-2 flex items-center gap-2 text-gray-500">
                    <Store size={14} />
                    <p className="text-[10px] font-bold uppercase tracking-[0.24em] text-gray-400">
                      {isExpense ? 'Merchant' : 'Source / Payer'}
                    </p>
                  </div>
                  <input
                    type="text"
                    value={formData.merchant}
                    onChange={e => setFormData(p => ({ ...p, merchant: e.target.value }))}
                    className="w-full bg-transparent text-sm text-gray-900 focus:outline-none placeholder:text-gray-300"
                    placeholder={isExpense ? 'Amazon, Swiggy' : 'Employer, client, bank'}
                  />
                </div>
                <div className="rounded-2xl border border-gray-200 bg-gray-50 px-4 py-3 sm:col-span-2">
                  <div className="mb-2 flex items-center gap-2 text-gray-500">
                    <AlignLeft size={14} />
                    <p className="text-[10px] font-bold uppercase tracking-[0.24em] text-gray-400">Note</p>
                  </div>
                  <input
                    type="text"
                    value={formData.description}
                    onChange={e => setFormData(p => ({ ...p, description: e.target.value }))}
                    className="w-full bg-transparent text-sm text-gray-900 focus:outline-none placeholder:text-gray-300"
                    placeholder={isExpense ? 'Optional note' : 'Optional note or reference'}
                  />
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* ── Fixed Bottom Bar ── */}
      <div className="bg-white border-t border-gray-100 px-4 py-3 flex gap-3 shrink-0">
        <button
          type="button"
          onClick={() => setCurrentPage(returnPage)}
          className="flex-[0.4] py-3.5 rounded-2xl border-2 border-gray-200 text-sm font-bold text-gray-600 hover:bg-gray-50 transition-colors"
        >
          Cancel
        </button>
        <motion.button
          type="submit"
          disabled={isSubmitting || !formData.amount}
          whileTap={{ scale: 0.97 }}
          className={cn(
            'flex-1 py-3.5 rounded-2xl font-bold text-white text-sm shadow-lg bg-gradient-to-r transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2',
            accent.btn
          )}
        >
          {isSubmitting
            ? <><span className="w-4 h-4 border-2 border-white/40 border-t-white rounded-full animate-spin" /> Saving…</>
            : <><Zap size={15} /> {
              isLoanExpense
                ? (loanType === 'borrowed' ? 'Create Borrow Record' : 'Create Lend Record')
                : isGroupExpense
                  ? 'Create Group Expense'
                  : `Add ${isExpense ? 'Expense' : 'Income'}`
            }</>
          }
        </motion.button>
      </div>
    </form>
  );

  return (
    <>
      {/* ─── Mobile: Full page stack ─── */}
      <div className="lg:hidden flex flex-col min-h-screen bg-white">
        {formEl}
      </div>

      {/* ─── Desktop: Centered card ─── */}
      <div className="hidden lg:flex items-start justify-center min-h-screen bg-gray-100 py-8 px-4">
        <motion.div
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          className="w-full max-w-[980px] rounded-3xl overflow-hidden shadow-2xl flex flex-col bg-white"
          style={{ minHeight: 640 }}
        >
          {formEl}
        </motion.div>
      </div>

      {/* Modals */}
      {showScanner && (
        <ReceiptScanner
          isOpen={showScanner}
          onClose={() => setShowScanner(false)}
          initialAccountId={formData.accountId}
          expenseMode={expenseMode === 'group' ? 'group' : 'individual'}
          onApplyScan={handleApplyReceiptScan}
        />
      )}
    </>
  );
};
