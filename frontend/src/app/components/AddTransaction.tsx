import React, { useEffect, useMemo, useRef, useState } from 'react';
import { useApp } from '@/contexts/AppContext';
import { db } from '@/lib/database';
import { saveTransactionWithBackendSync } from '@/lib/auth-sync-integration';
import {
  ChevronLeft, ArrowDownLeft, ArrowUpRight, Camera,
  CalendarDays, Wallet, Tag, AlignLeft, Store, Sparkles,
  CreditCard, Banknote, Smartphone,
  Zap, ChevronDown, Search, Check,
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
import { ReceiptScanner } from '@/app/components/ReceiptScanner';
import { getCategoryCartoonIcon } from '@/app/components/ui/CartoonCategoryIcons';
import { CategoryDropdown } from '@/app/components/ui/CategoryDropdown';
import { motion, AnimatePresence } from 'framer-motion';
import { cn } from '@/lib/utils';

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

/* ─────────────── main component ─────────────── */
export const AddTransaction: React.FC = () => {
  const { accounts, transactions, setCurrentPage, currency, refreshData } = useApp();

  const [formData, setFormData] = useState(() => ({
    type: 'expense' as 'expense' | 'income',
    amount: 0,
    accountId: accounts[0]?.id || 0,
    category: DEFAULT_CATEGORY.expense,
    subcategory: '',
    description: '',
    merchant: '',
    date: new Date().toISOString().split('T')[0],
  }));
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [showScanner, setShowScanner] = useState(false);
  const [amountStr, setAmountStr] = useState('');
  const [subcategoryQuery, setSubcategoryQuery] = useState('');
  const [showOptionalFields, setShowOptionalFields] = useState(false);
  const [showCategoryPicker, setShowCategoryPicker] = useState(false);
  const [showAccountPicker, setShowAccountPicker] = useState(false);
  const [showIncomeSubcategoryPicker, setShowIncomeSubcategoryPicker] = useState(false);
  const [manualExpenseCategory, setManualExpenseCategory] = useState(false);
  const [customExpenseSubcategories, setCustomExpenseSubcategories] = useState<CustomExpenseSubcategory[]>(() =>
    loadCustomExpenseSubcategories(),
  );
  const accountPickerRef = useRef<HTMLDivElement | null>(null);
  const incomeSubcategoryPickerRef = useRef<HTMLDivElement | null>(null);

  /* ── pre-fill from localStorage ── */
  useEffect(() => {
    const rawFormType = localStorage.getItem('quickFormType');
    if (rawFormType === 'income' || rawFormType === 'expense') {
      setFormData(prev => ({
        ...prev,
        type: rawFormType as 'expense' | 'income',
        category: DEFAULT_CATEGORY[rawFormType as 'expense' | 'income'],
        subcategory: '',
      }));
      setSubcategoryQuery('');
      setShowCategoryPicker(false);
      setManualExpenseCategory(false);
      localStorage.removeItem('quickFormType');
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

  const subcategories = useMemo(() =>
    getSubcategoriesForCategory(formData.category, formData.type),
    [formData.category, formData.type]
  );
  const selectedAccount = accounts.find(a => a.id === formData.accountId);
  const isExpense = formData.type === 'expense';

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (accountPickerRef.current && !accountPickerRef.current.contains(event.target as Node)) {
        setShowAccountPicker(false);
      }
      if (incomeSubcategoryPickerRef.current && !incomeSubcategoryPickerRef.current.contains(event.target as Node)) {
        setShowIncomeSubcategoryPicker(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

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
    if (!isExpense) return null;
    const combinedText = [subcategoryQuery, formData.description, formData.merchant]
      .filter(Boolean)
      .join(' ')
      .trim();
    if (!combinedText) return null;
    return detectExpenseCategoryFromText(combinedText, customExpenseSubcategories);
  }, [customExpenseSubcategories, formData.description, formData.merchant, isExpense, subcategoryQuery]);

  useEffect(() => {
    if (!isExpense) return;
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
    manualExpenseCategory,
    smartExpenseSuggestion,
    subcategoryQuery,
  ]);

  const expenseSuggestions = useMemo(() => {
    if (!isExpense) return [] as ExpenseSubcategorySuggestion[];

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

  const switchType = (t: 'expense' | 'income') => {
    setFormData(prev => ({ ...prev, type: t, category: DEFAULT_CATEGORY[t], subcategory: '' }));
    setSubcategoryQuery('');
    setShowCategoryPicker(false);
    setShowIncomeSubcategoryPicker(false);
    setManualExpenseCategory(false);
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

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedAccount) { toast.error('Please select an account'); return; }
    if (!formData.amount || formData.amount <= 0) { toast.error('Enter a valid amount'); return; }
    setIsSubmitting(true);
    try {
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

      await saveTransactionWithBackendSync({
        ...payload,
        date: new Date(formData.date),
        tags: [],
      });
      const newBalance = isExpense
        ? selectedAccount.balance - formData.amount
        : selectedAccount.balance + formData.amount;
      await db.accounts.update(formData.accountId, { balance: newBalance, updatedAt: new Date() });
      if (payload.type === 'expense' && payload.subcategory) {
        noteExpenseSubcategoryUsage(payload.subcategory, payload.category);
      }
      toast.success(`${isExpense ? '📉' : '📈'} ${isExpense ? 'Expense' : 'Income'} of ${currency} ${formData.amount.toFixed(2)} recorded`);
      refreshData();
      setCurrentPage('transactions');
    } catch (err) {
      console.error(err);
      toast.error('Failed to add transaction. Please try again.');
    } finally {
      setIsSubmitting(false);
    }
  };

  /* ── color system ── */
  const accent = isExpense
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
  const optionalFieldsOpen = showOptionalFields || !!formData.description.trim() || !!formData.merchant.trim();
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
  const optionalDetailsTitle = isExpense ? 'More details' : 'Income details';
  const optionalDetailsLabel = isExpense ? 'Merchant and note are optional' : 'Source / payer and note are optional';
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
              onClick={() => setCurrentPage('transactions')}
              className={cn('flex h-11 w-11 items-center justify-center rounded-2xl border shadow-sm transition-colors', accent.actionShell)}
            >
              <ChevronLeft size={19} />
            </button>
            <div className="min-w-0 flex-1">
              <h1 className="font-display text-xl font-bold leading-tight text-gray-900">Add Transaction</h1>
              <p className={cn('text-sm font-medium', accent.subtitle)}>Record a new {formData.type}</p>
            </div>
            <button
              type="button"
              onClick={() => setShowScanner(true)}
              className={cn('flex h-11 w-11 items-center justify-center rounded-2xl border shadow-sm transition-colors', accent.actionShell)}
              title="Scan receipt"
            >
              <Camera size={18} />
            </button>
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
                  <p className="text-[10px] font-bold uppercase tracking-[0.22em] text-white/70">Account</p>
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
          <FieldRow icon={<Wallet size={16} className="text-gray-500" />} label="Account">
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
                    <ChevronDown size={16} className={cn('shrink-0 text-gray-400 transition-transform', showAccountPicker && 'rotate-180')} />
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
          {(isExpense || subcategories.length > 0) && (
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
                        <ChevronDown size={14} className={cn('transition-transform', showCategoryPicker && 'rotate-180')} />
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
                          className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl shadow-inner"
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
                          <ChevronDown
                            size={16}
                            className={cn('shrink-0 text-gray-400 transition-transform', showIncomeSubcategoryPicker && 'rotate-180')}
                          />
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
                                    className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl text-[11px] font-bold"
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
        <FieldRow icon={<CalendarDays size={16} className="text-gray-500" />} label="Date">
          {isExpense ? (
            <input
              type="date"
              value={formData.date}
              onChange={e => setFormData(p => ({ ...p, date: e.target.value }))}
              className="w-full bg-transparent text-sm font-semibold text-gray-900 focus:outline-none"
              required title="Select date"
            />
          ) : (
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
          )}
        </FieldRow>

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
                  className="flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl shadow-inner"
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
            <ChevronDown size={16} className={cn('text-gray-400 transition-transform', optionalFieldsOpen && 'rotate-180')} />
          </button>
        </div>

        <AnimatePresence initial={false}>
          {optionalFieldsOpen && (
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
          onClick={() => setCurrentPage('transactions')}
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
            : <><Zap size={15} /> Add {isExpense ? 'Expense' : 'Income'}</>
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
          onTransactionCreated={() => { setShowScanner(false); refreshData(); setCurrentPage('transactions'); }}
        />
      )}
    </>
  );
};
