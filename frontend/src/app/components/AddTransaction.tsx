import React, { useEffect, useMemo, useRef, useState } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { useApp } from '@/contexts/AppContext';
import { useAuth } from '@/contexts/AuthContext';
import { db } from '@/lib/database';
import { queueTransactionInsertSync, saveTransactionWithBackendSync } from '@/lib/auth-sync-integration';
import { DocumentManagementService } from '@/services/documentManagementService';
import { backendService } from '@/lib/backend-api';
import { createNotificationRecord } from '@/lib/notifications';
import {
  ChevronLeft, ArrowDownLeft, ArrowUpRight, Camera,
  CalendarDays, Wallet, Tag, AlignLeft, Store, Sparkles,
  CreditCard, Banknote, Smartphone,
  Zap, ChevronDown, Search, Check, Users, UserPlus, Mail, Phone, Trash2,
  Plus, Loader2, ArrowRightLeft, Menu, ArrowDown
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
import { SearchableDropdown } from '@/app/components/ui/SearchableDropdown';
import { AutoSuggestTag } from '@/app/components/ui/AutoSuggestTag';
import { categorizeText, learnCategorization } from '@/lib/smartCategorization';
import { motion, AnimatePresence } from 'framer-motion';
import { cn } from '@/lib/utils';
import { parseDateInputValue, toLocalDateKey } from '@/lib/dateUtils';
import {
  markSmsTransactionImported,
  resolvePendingSmsTransactionDraft,
} from '@/services/smsTransactionDetectionService';
import { extractGroupParticipantNames } from '@/lib/voiceExpenseParser';
import {
  takeVoiceDraft,
  VOICE_GROUP_DRAFT_KEY,
  VOICE_TRANSACTION_DRAFT_KEY,
  type VoiceGroupDraft,
  type VoiceTransactionDraft,
} from '@/lib/voiceDrafts';

const BUILTIN_CATEGORIES = {
  expense: Object.values(EXPENSE_CATEGORIES as Record<string, any>).map(cat => cat.name as string),
  income: Object.values(INCOME_CATEGORIES as Record<string, any>).map(cat => cat.name as string),
};

const DEFAULT_CATEGORY = {
  expense: BUILTIN_CATEGORIES.expense.includes('Food & Dining') ? 'Food & Dining' : BUILTIN_CATEGORIES.expense[0],
  income: BUILTIN_CATEGORIES.income.includes('Salary') ? 'Salary' : BUILTIN_CATEGORIES.income[0],
};

const accountTypeMeta: Record<string, { icon: React.FC<{ size?: number; className?: string }>; shell: string }> = {
  bank:    { icon: CreditCard,  shell: 'bg-blue-50 text-blue-600' },
  cash:    { icon: Banknote,    shell: 'bg-emerald-50 text-emerald-600' },
  wallet:  { icon: Wallet,      shell: 'bg-violet-50 text-violet-600' },
  upi:     { icon: Smartphone,  shell: 'bg-orange-50 text-orange-600' },
  credit:  { icon: CreditCard,  shell: 'bg-rose-50 text-rose-600' },
};

const formatAccountBalance = (v: number) =>
  new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 2 }).format(v);

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

export function AddTransaction() {
  const { accounts, friends, transactions, setCurrentPage, currency, refreshData } = useApp();
  const { user } = useAuth();
  const defaultDateKey = toLocalDateKey(new Date()) ?? new Date().toISOString().split('T')[0];

  const [formData, setFormData] = useState(() => ({
    type: 'expense' as 'expense' | 'income' | 'transfer',
    amount: 0,
    accountId: accounts[0]?.id || 0,
    toAccountId: 0,
    category: DEFAULT_CATEGORY.expense,
    subcategory: '',
    description: '',
    merchant: '',
    date: defaultDateKey,
    taxDetails: {
      cgst: 0,
      sgst: 0,
      igst: 0,
      gstin: '',
      totalTax: 0,
    }
  }));

  const [isSubmitting, setIsSubmitting] = useState(false);
  const [showScanner, setShowScanner] = useState(false);
  const [scanDocumentId, setScanDocumentId] = useState<number | null>(null);
  const [amountStr, setAmountStr] = useState(() => '');
  const [subcategoryQuery, setSubcategoryQuery] = useState('');
  const [expenseMode, setExpenseMode] = useState<ExpenseEntryMode>(() => {
    const storedMode = localStorage.getItem('quickExpenseMode');
    return storedMode === 'group' || storedMode === 'loan' ? storedMode : 'individual';
  });
  const [loanType, setLoanType] = useState<LoanEntryType>('borrowed');
  const [loanDraft, setLoanDraft] = useState<LoanDraft>(() =>
    createDefaultLoanDraft(defaultDateKey)
  );
  const [returnPage, setReturnPage] = useState(() => localStorage.getItem('quickBackPage') || 'transactions');
  const [groupName, setGroupName] = useState('');
  const [groupSplitType, setGroupSplitType] = useState<'equal' | 'custom'>('equal');
  const [groupParticipants, setGroupParticipants] = useState<GroupParticipantDraft[]>([]);
  const [manualExpenseCategory, setManualExpenseCategory] = useState(false);
  const [pendingSmsTransactionId, setPendingSmsTransactionId] = useState<number | null>(null);
  const [remoteCategorySuggestion, setRemoteCategorySuggestion] = useState<{
    text: string;
    category: string;
    subcategory: string;
    confidence: number;
  } | null>(null);
  const aiDebounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [customExpenseSubcategories, setCustomExpenseSubcategories] = useState<CustomExpenseSubcategory[]>(() =>
    loadCustomExpenseSubcategories(),
  );

  const dbCustomCategories = useLiveQuery(() => db.categories.filter((c) => !c.deletedAt).toArray(), []) ?? [];
  const liveCategories = useMemo(() => {
    const customExpense = dbCustomCategories
      .filter((c) => c.type === 'expense' && !BUILTIN_CATEGORIES.expense.includes(c.name))
      .map((c) => c.name);
    const customIncome = dbCustomCategories
      .filter((c) => c.type === 'income' && !BUILTIN_CATEGORIES.income.includes(c.name))
      .map((c) => c.name);
    return {
      expense: [...BUILTIN_CATEGORIES.expense, ...customExpense],
      income: [...BUILTIN_CATEGORIES.income, ...customIncome],
    };
  }, [dbCustomCategories]);

  useEffect(() => {
    const rawFormType = localStorage.getItem('quickFormType');
    if (rawFormType) {
      switchType(rawFormType as any);
      localStorage.removeItem('quickFormType');
    }
  }, []);

  useEffect(() => {
    const rawVoiceTransactionDraft = takeVoiceDraft<VoiceTransactionDraft>(VOICE_TRANSACTION_DRAFT_KEY);
    if (rawVoiceTransactionDraft?.amount) {
      setFormData((prev) => ({
        ...prev,
        type: rawVoiceTransactionDraft.type,
        amount: rawVoiceTransactionDraft.amount,
        category: rawVoiceTransactionDraft.category || DEFAULT_CATEGORY[rawVoiceTransactionDraft.type],
        description: rawVoiceTransactionDraft.description,
        date: rawVoiceTransactionDraft.date || prev.date,
      }));
      setExpenseMode('individual');
      setAmountStr(String(rawVoiceTransactionDraft.amount));
    }

    const rawVoiceGroupDraft = takeVoiceDraft<VoiceGroupDraft>(VOICE_GROUP_DRAFT_KEY);
    if (rawVoiceGroupDraft?.amount) {
      const participantNames = extractGroupParticipantNames(rawVoiceGroupDraft.description || '');
      setFormData((prev) => ({
        ...prev,
        type: 'expense',
        amount: rawVoiceGroupDraft.amount,
        description: rawVoiceGroupDraft.description,
      }));
      setAmountStr(String(rawVoiceGroupDraft.amount));
      setExpenseMode('group');
      setGroupName(rawVoiceGroupDraft.description || 'Voice Group Expense');
      if (participantNames.length > 0) {
        setGroupParticipants(participantNames.map((name) => createEmptyParticipant({ name })));
      }
    }

    localStorage.removeItem('quickExpenseMode');
    localStorage.removeItem('quickBackPage');
  }, []);

  const switchType = (t: 'expense' | 'income' | 'transfer') => {
    setFormData(prev => ({
      ...prev,
      type: t,
      category: t === 'transfer' ? 'Transfer' : DEFAULT_CATEGORY[t as 'expense' | 'income'] || DEFAULT_CATEGORY.expense,
      subcategory: t === 'transfer' ? 'Transfer' : '',
      toAccountId: t === 'transfer' ? (accounts.find(a => a.id !== prev.accountId)?.id || 0) : 0
    }));
    setSubcategoryQuery('');
    setManualExpenseCategory(false);
  };

  const isExpense = formData.type === 'expense';
  const isLoanExpense = isExpense && expenseMode === 'loan';
  const isGroupExpense = isExpense && expenseMode === 'group';
  const selectedAccount = accounts.find(a => a.id === formData.accountId);

  const smartCategoryInput = useMemo(() => {
    if (!isExpense || isLoanExpense) return null;
    const combinedText = [subcategoryQuery, formData.description, formData.merchant]
      .filter(Boolean).join(' ').trim();
    return combinedText.length >= 3 ? combinedText : null;
  }, [subcategoryQuery, formData.description, formData.merchant, isExpense, isLoanExpense]);

  useEffect(() => {
    if (!smartCategoryInput) {
      setRemoteCategorySuggestion(null);
      return;
    }
    const timer = window.setTimeout(() => {
      backendService.categorizeText(smartCategoryInput)
        .then((result) => {
          if (result && result.confidence >= 0.45) {
            setRemoteCategorySuggestion({
              text: smartCategoryInput,
              category: normalizeCategorySelection(result.category, 'expense'),
              subcategory: result.subcategory || '',
              confidence: result.confidence,
            });
          }
        }).catch(() => {});
    }, 400);
    return () => window.clearTimeout(timer);
  }, [smartCategoryInput]);

  const smartCatResult = useMemo(() => {
    if (!smartCategoryInput) return null;
    if (remoteCategorySuggestion?.text === smartCategoryInput) return remoteCategorySuggestion;
    const result = categorizeText(smartCategoryInput);
    return result.confidence >= 0.45 ? result : null;
  }, [remoteCategorySuggestion, smartCategoryInput]);

  const handleAmountChange = (val: string) => {
    setAmountStr(val);
    setFormData(prev => ({ ...prev, amount: parseFloat(val) || 0 }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedAccount) { toast.error('Please select an account'); return; }
    if (!formData.amount || formData.amount <= 0) { toast.error('Enter a valid amount'); return; }
    const transactionDate = parseDateInputValue(formData.date) || new Date();
    
    setIsSubmitting(true);
    try {
      const now = new Date();
      let result: any;

      if (formData.type === 'transfer') {
        const fromAccount = await db.accounts.get(formData.accountId);
        const toAccount   = await db.accounts.get(formData.toAccountId);
        if (!fromAccount || !toAccount) { toast.error('Accounts not found'); return; }
        if (fromAccount.id === toAccount.id) { toast.error('Same account transfer'); return; }
        if (fromAccount.balance < formData.amount) { toast.error('Insufficient balance'); return; }

        result = await saveTransactionWithBackendSync({
          type: 'transfer',
          amount: formData.amount,
          accountId: formData.accountId,
          category: 'Transfer',
          subcategory: 'Transfer',
          description: formData.description || `Transfer to ${toAccount.name}`,
          date: transactionDate,
          transferToAccountId: formData.toAccountId,
          transferType: 'self-transfer',
          updatedAt: now,
        });

        await db.accounts.update(formData.accountId, { balance: fromAccount.balance - formData.amount, updatedAt: now });
        await db.accounts.update(formData.toAccountId, { balance: toAccount.balance + formData.amount, updatedAt: now });
        toast.success(`Transferred ${currency} ${formData.amount.toFixed(2)}`);
      } else {
        // Logic for regular Expense/Income/Loan/Group...
        let payload: any = {
          ...formData,
          category: normalizeCategorySelection(formData.category, formData.type as 'expense' | 'income'),
          subcategory: subcategoryQuery || formData.subcategory,
          date: transactionDate,
          expenseMode: expenseMode as any,
          tags: [],
          updatedAt: now,
        };

        if (isExpense && expenseMode === 'group') {
          payload = {
            ...payload,
            groupName: groupName || formData.description || 'New Group Expense',
            groupSplitType,
            participants: groupParticipants.map(p => ({
              friendId: p.friendId,
              name: p.name,
              share: p.share || (formData.amount / (groupParticipants.length || 1)),
            })),
          };
        } else if (isExpense && expenseMode === 'loan') {
          payload = {
            ...payload,
            loanType,
            contactName: loanDraft.contactName,
            dueDate: parseDateInputValue(loanDraft.dueDate) || new Date(),
            interestRate: loanDraft.interestRate,
          };
        }

        result = await saveTransactionWithBackendSync(payload);

        const newBalance = formData.type === 'expense' ? selectedAccount.balance - formData.amount : selectedAccount.balance + formData.amount;
        await db.accounts.update(formData.accountId, { balance: newBalance, updatedAt: now });
        
        toast.success(`${formData.type === 'expense' ? (expenseMode === 'individual' ? 'Expense' : expenseMode.charAt(0).toUpperCase() + expenseMode.slice(1)) : 'Income'} of ${currency} ${formData.amount.toFixed(2)} recorded`);
      }

      if (result?.id && scanDocumentId) {
        const docService = new DocumentManagementService();
        await docService.linkTransaction(scanDocumentId, result.id);
      }

      refreshData();
      setCurrentPage(returnPage);
    } catch (err) {
      console.error(err);
      toast.error('Failed to record transaction');
    } finally {
      setIsSubmitting(false);
    }
  };

  const accent = useMemo(() => (
    formData.type === 'income' ? {
      amountCard: 'bg-gradient-to-br from-emerald-500 to-teal-600',
      btn: 'bg-gradient-to-r from-emerald-500 to-teal-600',
      switchShell: 'bg-emerald-500/20'
    } : {
      amountCard: 'bg-gradient-to-br from-rose-500 to-pink-600',
      btn: 'bg-gradient-to-r from-rose-500 to-pink-600',
      switchShell: 'bg-rose-500/20'
    }
  ), [formData.type]);

  const handleScanApply = (scan: ReceiptScanPayload) => {
    const taxObj = {
      cgst: 0,
      sgst: 0,
      igst: 0,
      gstin: '',
      totalTax: scan.taxAmount || 0,
    };

    if (scan.taxBreakdown) {
      scan.taxBreakdown.forEach(t => {
        const name = t.name.toUpperCase();
        if (name.includes('CGST')) taxObj.cgst = t.amount;
        if (name.includes('SGST')) taxObj.sgst = t.amount;
        if (name.includes('IGST')) taxObj.igst = t.amount;
      });
    }

    setFormData(prev => {
      const newDate = scan.date ? toLocalDateKey(scan.date) : null;
      return {
        ...prev,
        amount: scan.amount || prev.amount,
        description: scan.description || scan.merchantName || prev.description,
        merchant: scan.merchantName || prev.merchant,
        date: (newDate || prev.date) as string,
        category: (scan.category || prev.category) as string,
        subcategory: (scan.subcategory || prev.subcategory) as string,
        taxDetails: taxObj,
      };
    });
    setAmountStr((scan.amount || 0).toString());
    setScanDocumentId(scan.scanDocumentId || null);
  };

  const desktopView = (
    <div className="hidden lg:flex flex-col h-fit bg-[#F8FAFC]">
      {/* Premium Header */}
      <header className="layout-header-secondary sticky top-0 z-20 shrink-0">
        <div className="layout-container layout-header">
          <div className="flex items-center gap-8">
            <div className="flex items-center gap-4">
              <div className="w-10 h-10 rounded-xl bg-indigo-50 flex items-center justify-center">
                <Zap className="text-indigo-600" size={20} />
              </div>
              <div>
                <h1 className="page-title">Add Transaction</h1>
                <p className="page-subtitle">Module Entry</p>
              </div>
            </div>
            
            <div className="segment-control">
              {(['expense', 'income', 'transfer'] as const).map((t) => (
                <button
                  key={t}
                  onClick={() => switchType(t)}
                  className={cn(
                    "segment-btn",
                    formData.type === t ? "segment-btn-active" : "segment-btn-inactive"
                  )}
                >
                  {t}
                </button>
              ))}
            </div>
          </div>

          <div className="flex items-center gap-3">
            <button 
              onClick={() => setShowScanner(true)}
              className="finora-btn finora-btn-secondary"
            >
              <Camera size={14} />
              <span>Scan Receipt</span>
            </button>
            <button 
              onClick={handleSubmit} 
              disabled={isSubmitting || !formData.amount} 
              className={cn("finora-btn text-white", accent.btn)}
            >
              {isSubmitting ? <Loader2 className="animate-spin" size={14} /> : <Zap size={14} />}
              <span>Save Transaction</span>
            </button>
          </div>
        </div>
      </header>

      <main className="layout-container py-8 flex-1 overflow-y-auto scrollbar-hide pb-20">
        <div className="flex flex-col gap-8">
          {/* Amount Card Section */}
          <section className={cn("rounded-[40px] p-12 shadow-2xl relative overflow-hidden shrink-0 text-white transition-all duration-500 min-h-[200px] flex flex-col justify-center", accent.amountCard)}>
            {/* Background Sparkles */}
            <div className="absolute top-0 left-0 w-full h-full pointer-events-none opacity-20">
              <div className="absolute top-1/4 left-1/4 w-64 h-64 bg-white blur-[100px] rounded-full"></div>
              <div className="absolute bottom-1/4 right-1/4 w-64 h-64 bg-white blur-[100px] rounded-full"></div>
            </div>

            <div className="flex justify-between items-start mb-2 relative z-10">
              <div className="flex items-center gap-2">
                 <div className="w-2 h-2 rounded-full bg-white/50 animate-pulse"></div>
                 <p className="text-white/60 text-[10px] font-black uppercase tracking-[0.3em]">Transaction Amount</p>
              </div>
              <button className="p-2 bg-white/10 hover:bg-white/20 backdrop-blur-md rounded-xl transition-all border border-white/10">
                <AlignLeft size={18} />
              </button>
            </div>
            
            <div className="flex items-baseline gap-4 relative z-10">
              <span className="text-4xl font-black text-white/30 tracking-tighter uppercase">{currency}</span>
              <input 
                type="number" 
                step="0.01" 
                value={amountStr} 
                onChange={(e) => handleAmountChange(e.target.value)} 
                className="bg-transparent text-7xl font-black text-white outline-none placeholder:text-white/10 w-full tracking-tighter" 
                placeholder="0.00" 
                autoFocus 
              />
            </div>
          </section>

          {/* Form Content Area */}
          <div className="layout-grid">
            {/* Left Panel: Primary Details */}
            <div className="finora-card">
              {formData.type === 'expense' && (
                <div className="flex gap-1.5 p-1 bg-slate-50 rounded-2xl mb-8 w-fit border border-slate-100 animate-in fade-in zoom-in-95">
                  {(['individual', 'group', 'loan'] as const).map(mode => (
                    <button
                      key={mode}
                      onClick={() => setExpenseMode(mode)}
                      className={cn(
                        "px-8 py-2 rounded-xl text-[10px] font-black uppercase tracking-[0.15em] transition-all",
                        expenseMode === mode ? "bg-white text-slate-900 shadow-md scale-100" : "text-slate-400 hover:text-slate-600 scale-95"
                      )}
                    >
                      {mode}
                    </button>
                  ))}
                </div>
              )}

              <div className="space-y-8">
                {/* Description - Common for all but styled differently for Transfer */}
                <div className="space-y-3">
                  <label className="finora-label">
                    {formData.type === 'transfer' ? 'Transfer Reference' : 'Description'}
                  </label>
                  <input 
                    type="text" 
                    value={formData.description} 
                    onChange={(e) => setFormData(prev => ({ ...prev, description: e.target.value }))} 
                    className="finora-input text-lg h-16" 
                    placeholder={formData.type === 'transfer' ? "Rent, Monthly Savings..." : "What was this for?"} 
                  />
                  {formData.type === 'expense' && smartCatResult && (
                    <div className="flex items-center gap-3 bg-indigo-50/50 px-4 py-2.5 rounded-2xl border border-indigo-100 animate-in fade-in slide-in-from-top-2">
                      <Sparkles size={16} className="text-indigo-500" />
                      <span className="text-xs font-black text-indigo-700 uppercase tracking-wider">Suggestion: {smartCatResult.category}</span>
                      <button onClick={() => setFormData(prev => ({ ...prev, category: smartCatResult.category }))} className="text-[10px] font-black bg-indigo-600 text-white px-4 py-1 rounded-xl ml-auto hover:bg-indigo-700 transition-colors">APPLY</button>
                    </div>
                  )}
                </div>

                {/* Expense/Income Specific: Categories */}
                {formData.type !== 'transfer' && (
                  <div className="space-y-4 animate-in fade-in slide-in-from-left-4">
                    <label className="finora-label">Quick Category</label>
                    <div className="grid grid-cols-4 gap-3">
                      {(liveCategories[formData.type as 'expense' | 'income'] || []).slice(0, 8).map((cat: string) => (
                        <button
                          key={cat}
                          type="button"
                          onClick={() => setFormData(prev => ({ ...prev, category: cat, subcategory: '' }))}
                          className={cn(
                            "flex flex-col items-center gap-2 p-4 rounded-[28px] border-2 transition-all group relative overflow-hidden",
                            formData.category === cat
                              ? "bg-slate-900 text-white border-slate-900 shadow-xl scale-105"
                              : "bg-slate-50/50 text-slate-500 border-transparent hover:border-slate-200 hover:bg-white"
                          )}
                        >
                          <span className="text-2xl group-hover:scale-125 transition-transform duration-300">{getCategoryCartoonIcon(cat)}</span>
                          <span className="text-[9px] font-black uppercase tracking-tighter text-center leading-none px-1">{cat}</span>
                        </button>
                      ))}
                    </div>
                  </div>
                )}

                {/* Merchant/Source - Hide for Transfer */}
                {formData.type !== 'transfer' && (
                  <div className="space-y-3 animate-in fade-in slide-in-from-bottom-4">
                    <label className="finora-label">
                      {formData.type === 'income' ? 'Income Source' : 'Merchant / Vendor'}
                    </label>
                    <input 
                      type="text" 
                      value={formData.merchant} 
                      onChange={(e) => setFormData(prev => ({ ...prev, merchant: e.target.value }))} 
                      className="finora-input" 
                      placeholder={formData.type === 'income' ? "Company, Client, Interest..." : "e.g. Starbucks, Amazon..."} 
                    />
                  </div>
                )}
              </div>
            </div>

            {/* Right Panel: Transaction Configuration */}
            <div className="finora-card">
              <div className="space-y-8 flex-1">
                {/* Account Selection */}
                <div className="space-y-3">
                  <label className="finora-label">
                    {formData.type === 'transfer' ? 'Source Account' : 'Debit Account'}
                  </label>
                  <SearchableDropdown
                    options={accounts.map(a => ({
                      value: String(a.id),
                      label: a.name,
                      description: formatAccountBalance(a.balance),
                      icon: <div className="w-8 h-8 rounded-xl bg-slate-100 flex items-center justify-center text-slate-600 font-black text-[10px]">{(a.type || 'BK').substring(0, 2).toUpperCase()}</div>
                    }))}
                    value={String(formData.accountId)}
                    onChange={(val) => setFormData(prev => ({ ...prev, accountId: parseInt(val) }))}
                    placeholder="Select Account"
                    className="h-16"
                  />
                </div>

                {formData.type === 'transfer' ? (
                  <div className="space-y-8 animate-in fade-in slide-in-from-right-4">
                    <div className="flex justify-center -my-4 relative z-10">
                       <div className="w-10 h-10 bg-indigo-600 rounded-full flex items-center justify-center text-white shadow-xl border-4 border-white">
                          <ArrowDown size={20} />
                       </div>
                    </div>
                    <div className="space-y-3">
                      <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest px-1">Target Account</label>
                      <SearchableDropdown
                        options={accounts.filter(a => a.id !== formData.accountId).map(a => ({
                          value: String(a.id),
                          label: a.name,
                          description: formatAccountBalance(a.balance),
                          icon: <div className="w-8 h-8 rounded-xl bg-indigo-50 flex items-center justify-center text-indigo-600 font-black text-[10px]">{(a.type || 'BK').substring(0, 2).toUpperCase()}</div>
                        }))}
                        value={String(formData.toAccountId)}
                        onChange={(val) => setFormData(prev => ({ ...prev, toAccountId: parseInt(val) }))}
                        placeholder="Select Destination"
                        className="h-16"
                      />
                    </div>
                  </div>
                ) : (
                  <div className="grid grid-cols-1 gap-8 animate-in fade-in slide-in-from-right-4">
                    <div className="space-y-3">
                      <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest px-1">Primary Category</label>
                      <div className="flex gap-3">
                        <CategoryDropdown 
                          options={liveCategories[formData.type as 'expense' | 'income'] || []} 
                          value={formData.category} 
                          onChange={(val) => setFormData(prev => ({ ...prev, category: val, subcategory: '' }))} 
                          className="flex-1 bg-slate-50/50 border-none rounded-2xl h-14 font-bold" 
                        />
                        <input 
                          type="text" 
                          value={subcategoryQuery} 
                          onChange={(e) => setSubcategoryQuery(e.target.value)} 
                          className="flex-shrink-0 w-32 bg-slate-50/50 border-none rounded-2xl px-4 h-14 text-sm font-bold text-slate-900 placeholder:text-slate-300" 
                          placeholder="Sub..." 
                        />
                      </div>
                    </div>

                    {formData.type === 'expense' && (
                      <div className="space-y-3 animate-in fade-in slide-in-from-bottom-4">
                        <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest px-1">GST / Tax Details</label>
                        <div className="grid grid-cols-3 gap-2">
                           <div className="space-y-1">
                             <p className="text-[8px] font-black text-slate-400 text-center uppercase">CGST</p>
                             <input type="number" step="0.01" value={formData.taxDetails.cgst || ''} onChange={(e) => setFormData(prev => ({ ...prev, taxDetails: { ...prev.taxDetails, cgst: parseFloat(e.target.value) || 0 } }))} className="w-full bg-slate-50 rounded-xl px-2 h-10 text-[10px] font-black border-none text-center" placeholder="0.00" />
                           </div>
                           <div className="space-y-1">
                             <p className="text-[8px] font-black text-slate-400 text-center uppercase">SGST</p>
                             <input type="number" step="0.01" value={formData.taxDetails.sgst || ''} onChange={(e) => setFormData(prev => ({ ...prev, taxDetails: { ...prev.taxDetails, sgst: parseFloat(e.target.value) || 0 } }))} className="w-full bg-slate-50 rounded-xl px-2 h-10 text-[10px] font-black border-none text-center" placeholder="0.00" />
                           </div>
                           <div className="space-y-1">
                             <p className="text-[8px] font-black text-slate-400 text-center uppercase">IGST</p>
                             <input type="number" step="0.01" value={formData.taxDetails.igst || ''} onChange={(e) => setFormData(prev => ({ ...prev, taxDetails: { ...prev.taxDetails, igst: parseFloat(e.target.value) || 0 } }))} className="w-full bg-slate-50 rounded-xl px-2 h-10 text-[10px] font-black border-none text-center" placeholder="0.00" />
                           </div>
                        </div>
                      </div>
                    )}
                  </div>
                )}

                <div className="space-y-3">
                  <label className="finora-label">Date</label>
                  <input 
                    type="date" 
                    value={formData.date} 
                    onChange={(e) => setFormData(prev => ({ ...prev, date: e.target.value }))} 
                    className="finora-input" 
                  />
                </div>

                {/* Conditional Sections: Group/Loan */}
                {isExpense && expenseMode === 'group' && (
                  <div className="p-6 bg-indigo-50/30 rounded-[32px] border border-indigo-100/50 space-y-6 animate-in fade-in slide-in-from-bottom-4">
                    <div className="space-y-3">
                      <label className="text-[10px] font-black text-indigo-400 uppercase tracking-widest">Group Title</label>
                      <input type="text" value={groupName} onChange={(e) => setGroupName(e.target.value)} className="w-full h-12 px-5 bg-white border-none rounded-2xl font-bold text-slate-900 placeholder:text-indigo-200" placeholder="Trip Name..." />
                    </div>
                    <div className="space-y-4">
                       <div className="flex items-center justify-between">
                         <p className="text-[10px] font-black text-indigo-400 uppercase tracking-widest">Participants</p>
                         <button onClick={() => setGroupParticipants(prev => [...prev, createEmptyParticipant()])} className="p-1.5 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition-colors"><Plus size={14} /></button>
                       </div>
                       <div className="grid grid-cols-2 gap-2">
                         {groupParticipants.map((p) => (
                           <div key={p.id} className="bg-white/80 p-2 rounded-xl flex items-center justify-between border border-indigo-50 shadow-sm">
                             <input 
                               type="text" 
                               value={p.name} 
                               onChange={(e) => setGroupParticipants(prev => prev.map(item => item.id === p.id ? { ...item, name: e.target.value } : item))}
                               className="bg-transparent border-none text-[10px] font-black text-indigo-900 w-full focus:ring-0 p-0 px-1"
                               placeholder="Name"
                             />
                             <button onClick={() => setGroupParticipants(prev => prev.filter(item => item.id !== p.id))} className="text-rose-400 hover:text-rose-600"><Trash2 size={12} /></button>
                           </div>
                         ))}
                       </div>
                    </div>
                  </div>
                )}

                {isExpense && expenseMode === 'loan' && (
                  <div className="p-6 bg-rose-50/30 rounded-[32px] border border-rose-100/50 space-y-6 animate-in fade-in slide-in-from-bottom-4">
                    <div className="flex gap-2 p-1 bg-white/50 rounded-xl border border-rose-100/30 mb-2">
                      <button onClick={() => setLoanType('borrowed')} className={cn("flex-1 py-1.5 rounded-lg text-[9px] font-black uppercase transition-all", loanType === 'borrowed' ? "bg-white text-rose-600 shadow-sm" : "text-rose-400")}>Borrowed</button>
                      <button onClick={() => setLoanType('lent')} className={cn("flex-1 py-1.5 rounded-lg text-[9px] font-black uppercase transition-all", loanType === 'lent' ? "bg-white text-emerald-600 shadow-sm" : "text-emerald-400")}>Lent</button>
                    </div>
                    <div className="space-y-3">
                      <label className="text-[10px] font-black text-rose-400 uppercase tracking-widest">Person Name</label>
                      <input type="text" value={loanDraft.contactName} onChange={(e) => setLoanDraft(prev => ({ ...prev, contactName: e.target.value }))} className="w-full h-12 px-5 bg-white border-none rounded-2xl font-bold text-slate-900" placeholder="Who?" />
                    </div>
                    <div className="grid grid-cols-2 gap-4">
                       <div className="space-y-2">
                         <p className="text-[9px] font-black text-rose-400 uppercase tracking-widest text-center">Interest %</p>
                         <input type="number" value={loanDraft.interestRate} onChange={(e) => setLoanDraft(prev => ({ ...prev, interestRate: parseFloat(e.target.value) || 0 }))} className="w-full h-10 bg-white border-none rounded-xl text-center font-black text-xs" />
                       </div>
                       <div className="space-y-2">
                         <p className="text-[9px] font-black text-rose-400 uppercase tracking-widest text-center">Due Date</p>
                         <input type="date" value={loanDraft.dueDate} onChange={(e) => setLoanDraft(prev => ({ ...prev, dueDate: e.target.value }))} className="w-full h-10 bg-white border-none rounded-xl text-[10px] font-bold" />
                       </div>
                    </div>
                  </div>
                )}
              </div>

              {/* Ultra-Compact Summary Footer */}
              <div className="pt-6 border-t border-slate-50 mt-4">
                 <div className="bg-slate-900 rounded-2xl p-3 text-white shadow-lg flex items-center justify-between transition-all hover:bg-slate-800">
                    <div className="flex items-center gap-2">
                       <div className="w-8 h-8 rounded-lg bg-white/10 flex items-center justify-center border border-white/10">
                          <Zap size={14} className="text-indigo-400" />
                       </div>
                       <div className="flex items-baseline gap-1.5">
                          <span className="text-[10px] font-black uppercase tracking-tight text-white/90">{formData.type}</span>
                          {formData.type === 'expense' && (
                             <span className="text-[9px] font-bold uppercase tracking-tight text-white/40 italic">{expenseMode}</span>
                          )}
                       </div>
                    </div>
                    <div className="flex items-baseline gap-1">
                       <span className="text-white/30 text-[10px] font-black uppercase">{currency}</span>
                       <span className="text-lg font-black tracking-tighter">{formData.amount.toLocaleString(undefined, { minimumFractionDigits: 2 })}</span>
                    </div>
                 </div>
              </div>
            </div>
          </div>
        </div>
      </main>
    </div>
  );

  const mobileView = (
    <div className="flex lg:hidden flex-col bg-slate-50 relative min-h-screen mobile-safe-bottom">
      <div className={cn("px-4 pb-8 rounded-b-[40px] shadow-2xl relative overflow-hidden shrink-0 text-white transition-all duration-500 mobile-safe-top-spacious", accent.amountCard)}>
        {/* Background Sparkles */}
        <div className="absolute top-0 left-0 w-full h-full pointer-events-none opacity-20">
          <div className="absolute top-1/4 left-1/4 w-32 h-32 bg-white blur-[60px] rounded-full"></div>
          <div className="absolute bottom-1/4 right-1/4 w-32 h-32 bg-white blur-[60px] rounded-full"></div>
        </div>

        <div className="flex items-center justify-between mb-6 relative z-10">
          <button 
            onClick={() => setCurrentPage(returnPage)} 
            className="w-10 h-10 flex items-center justify-center bg-white/10 hover:bg-white/20 backdrop-blur-md rounded-full transition-all"
          >
            <ChevronLeft size={20} />
          </button>
          
          <div className="flex items-center gap-2">
            <button onClick={() => setShowScanner(true)} className="w-10 h-10 flex items-center justify-center bg-white/10 hover:bg-white/20 backdrop-blur-md rounded-xl transition-all">
              <Camera size={18} />
            </button>
            <button 
              onClick={handleSubmit} 
              disabled={isSubmitting || !formData.amount}
              className="bg-white text-slate-900 px-6 h-10 rounded-xl text-[10px] font-black flex items-center gap-2 shadow-xl active:scale-95 transition-all uppercase tracking-widest"
            >
              {isSubmitting ? <Loader2 size={14} className="animate-spin" /> : <Zap size={14} />}
              SAVE
            </button>
          </div>
        </div>

        <div className="mb-6 relative z-10 px-2">
          <div className="flex items-center gap-2 mb-1">
             <div className="w-1.5 h-1.5 rounded-full bg-white/50 animate-pulse"></div>
             <p className="text-white/60 text-[9px] font-black uppercase tracking-[0.3em]">{formData.type}</p>
          </div>
          <div className="flex items-baseline gap-2 overflow-hidden">
            <span className="text-xl font-black text-white/30 shrink-0">{currency}</span>
            <input 
              type="number" 
              step="0.01" 
              value={amountStr} 
              onChange={(e) => handleAmountChange(e.target.value)} 
              className="bg-transparent text-4xl sm:text-5xl font-black text-white outline-none w-full placeholder:text-white/10" 
              placeholder="0.00" 
              autoFocus 
            />
          </div>
        </div>

        <div className={cn("flex rounded-2xl p-1 backdrop-blur-md relative z-10 border border-white/10", accent.switchShell)}>
          {(['expense', 'income', 'transfer'] as const).map(t => (
            <button 
              key={t} 
              onClick={() => switchType(t)} 
              className={cn(
                "flex-1 py-2 rounded-xl text-[10px] font-black uppercase tracking-wider transition-all duration-300", 
                formData.type === t ? "bg-white text-slate-900 shadow-lg scale-100" : "text-white/60 hover:text-white/90 scale-95"
              )}
            >
              {t}
            </button>
          ))}
        </div>
      </div>

      {/* Main Content - No gap, high density */}
      <div className="px-4 py-4 space-y-4">
        {/* Single Cohesive Form Card */}
        <div className="bg-white rounded-[32px] p-5 shadow-sm border border-slate-100 space-y-6">
          {/* Description & Mode Container */}
          <div className="space-y-3">
            <input 
              type="text" 
              value={formData.description} 
              onChange={(e) => setFormData(prev => ({ ...prev, description: e.target.value }))} 
              className="w-full min-h-[2.75rem] sm:min-h-[3rem] px-5 bg-slate-50 border-none rounded-2xl focus:ring-4 focus:ring-indigo-500/10 transition-all font-bold text-slate-900 placeholder:text-slate-400 text-sm" 
              placeholder="What was this for?" 
            />
            
            {isExpense && formData.type === 'expense' && (
              <input 
                type="text" 
                value={formData.merchant} 
                onChange={(e) => setFormData(prev => ({ ...prev, merchant: e.target.value }))} 
                className="w-full min-h-[2.5rem] sm:min-h-[2.75rem] px-5 bg-slate-50 border-none rounded-2xl focus:ring-4 focus:ring-indigo-500/10 transition-all font-bold text-slate-900 placeholder:text-slate-400 text-[11px]" 
                placeholder="Merchant / Vendor" 
              />
            )}

            {isExpense && (
              <div className="flex gap-1 p-1 bg-slate-50 rounded-2xl">
                {(['individual', 'group', 'loan'] as const).map(mode => (
                  <button
                    key={mode}
                    type="button"
                    onClick={() => setExpenseMode(mode)}
                    className={cn(
                      "flex-1 py-2 rounded-xl text-[9px] font-black uppercase tracking-widest transition-all",
                      expenseMode === mode ? "bg-white text-slate-900 shadow-sm" : "text-slate-400"
                    )}
                  >
                    {mode}
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* Mode Specific Sections (Nested inside main card) */}
          {isExpense && expenseMode === 'group' && (
            <div className="animate-in fade-in slide-in-from-top-2 space-y-4">
              <div className="p-4 bg-indigo-50/50 rounded-2xl border border-indigo-100 space-y-4">
                <div>
                  <p className="text-[10px] font-black text-indigo-400 uppercase tracking-widest mb-2">Group Title</p>
                  <input type="text" value={groupName} onChange={(e) => setGroupName(e.target.value)} className="w-full h-10 bg-white border-none rounded-xl px-4 text-sm text-slate-900 font-bold" placeholder="Trip to Goa..." />
                </div>
                <div>
                  <div className="flex items-center justify-between mb-2">
                    <p className="text-[10px] font-black text-indigo-400 uppercase tracking-widest">Participants</p>
                    <button type="button" onClick={() => setGroupParticipants(prev => [...prev, createEmptyParticipant()])} className="text-[9px] font-black text-indigo-600 flex items-center gap-1 bg-indigo-100 px-2 py-1 rounded-lg">ADD</button>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    {groupParticipants.map((p) => (
                      <div key={p.id} className="bg-white px-3 py-1.5 rounded-xl flex items-center gap-2 shadow-sm border border-indigo-50">
                        <input 
                          type="text" 
                          value={p.name} 
                          onChange={(e) => {
                            const val = e.target.value;
                            setGroupParticipants(prev => prev.map(item => item.id === p.id ? { ...item, name: val } : item));
                          }}
                          className="bg-transparent border-none text-[10px] font-bold text-indigo-900 w-full min-w-0 focus:ring-0 p-0"
                          placeholder="Name"
                        />
                        <button type="button" onClick={() => setGroupParticipants(prev => prev.filter(item => item.id !== p.id))} className="text-rose-400"><Trash2 size={12} /></button>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          )}

          {isExpense && expenseMode === 'loan' && (
            <div className="animate-in fade-in slide-in-from-top-2">
              <div className="p-4 bg-rose-50/50 rounded-2xl border border-rose-100 space-y-4">
                <div className="flex gap-2 p-1 bg-white/50 rounded-xl border border-rose-100">
                  <button type="button" onClick={() => setLoanType('borrowed')} className={cn("flex-1 py-2 rounded-lg text-[9px] font-black uppercase transition-all", loanType === 'borrowed' ? "bg-white text-rose-600 shadow-sm" : "text-rose-400")}>Borrowed</button>
                  <button type="button" onClick={() => setLoanType('lent')} className={cn("flex-1 py-2 rounded-lg text-[9px] font-black uppercase transition-all", loanType === 'lent' ? "bg-white text-emerald-600 shadow-sm" : "text-emerald-400")}>Lent</button>
                </div>
                <div>
                  <p className="text-[10px] font-black text-rose-400 uppercase tracking-widest mb-1.5">Person Name</p>
                  <input type="text" value={loanDraft.contactName} onChange={(e) => setLoanDraft(prev => ({ ...prev, contactName: e.target.value }))} className="w-full h-10 bg-white border-none rounded-xl px-4 text-sm text-slate-900 font-bold" placeholder="Who?" />
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <p className="text-[10px] font-black text-rose-400 uppercase tracking-widest mb-1.5">Interest %</p>
                    <input type="number" value={loanDraft.interestRate} onChange={(e) => setLoanDraft(prev => ({ ...prev, interestRate: parseFloat(e.target.value) || 0 }))} className="w-full h-10 bg-white border-none rounded-xl px-4 text-sm text-slate-900 font-bold" placeholder="0" />
                  </div>
                  <div>
                    <p className="text-[10px] font-black text-rose-400 uppercase tracking-widest mb-1.5">Due Date</p>
                    <input type="date" value={loanDraft.dueDate} onChange={(e) => setLoanDraft(prev => ({ ...prev, dueDate: e.target.value }))} className="w-full h-10 bg-white border-none rounded-xl px-4 text-xs text-slate-900 font-bold" />
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Account & Date Selection Row */}
          <div className="pt-2 border-t border-slate-50 space-y-6">
            {formData.type === 'transfer' ? (
              <div className="space-y-4">
                <div>
                  <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2 px-1">Source Account</p>
                  <SearchableDropdown
                    options={accounts.map(a => ({
                      value: String(a.id),
                      label: a.name,
                      description: formatAccountBalance(a.balance),
                      icon: <div className="w-8 h-8 rounded-xl bg-slate-100 flex items-center justify-center text-slate-600 font-black text-[10px]">{(a.type || 'BK').substring(0, 2).toUpperCase()}</div>
                    }))}
                    value={String(formData.accountId)}
                    onChange={(val) => setFormData(prev => ({ ...prev, accountId: parseInt(val, 10) }))}
                    placeholder="From..."
                    className="h-14"
                  />
                </div>
                <div className="flex justify-center -my-2 relative z-10">
                  <div className="w-8 h-8 bg-indigo-600 rounded-full flex items-center justify-center text-white shadow-lg border-2 border-white">
                    <ArrowDown size={14} />
                  </div>
                </div>
                <div>
                  <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2 px-1">Target Account</p>
                  <SearchableDropdown
                    options={accounts.filter(a => a.id !== formData.accountId).map(a => ({
                      value: String(a.id),
                      label: a.name,
                      description: formatAccountBalance(a.balance),
                      icon: <div className="w-8 h-8 rounded-xl bg-indigo-50 flex items-center justify-center text-indigo-600 font-black text-[10px]">{(a.type || 'BK').substring(0, 2).toUpperCase()}</div>
                    }))}
                    value={String(formData.toAccountId)}
                    onChange={(val) => setFormData(prev => ({ ...prev, toAccountId: parseInt(val, 10) }))}
                    placeholder="To..."
                    className="h-14"
                  />
                </div>
              </div>
            ) : (
              <div className="flex flex-col sm:grid sm:grid-cols-2 gap-4">
                <div className="w-full">
                  <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2 px-1">Debit Account</p>
                  <SearchableDropdown
                    options={accounts.map(a => ({
                      value: String(a.id),
                      label: a.name,
                      description: formatAccountBalance(a.balance),
                      icon: <div className="w-8 h-8 rounded-xl bg-slate-100 flex items-center justify-center text-slate-600 font-black text-[10px]">{(a.type || 'BK').substring(0, 2).toUpperCase()}</div>
                    }))}
                    value={String(formData.accountId)}
                    onChange={(val) => setFormData(prev => ({ ...prev, accountId: parseInt(val, 10) }))}
                    placeholder="Select..."
                    className="min-h-[3.5rem]"
                  />
                </div>
                <div className="w-full">
                  <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2 px-1">Date</p>
                    <input 
                      type="date" 
                      value={formData.date} 
                      onChange={(e) => setFormData(prev => ({...prev, date: e.target.value}))} 
                      className="w-full min-h-[3.5rem] px-4 bg-slate-50 border-none rounded-2xl font-black text-[11px] text-slate-900" 
                    />
                  </div>
                </div>
             )}
          </div>
        </div>

        {/* Categorization Card */}
        {formData.type !== 'transfer' && (
          <div className="bg-white rounded-3xl p-5 shadow-sm border border-slate-100 space-y-6">
            <div>
              <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-3 px-1">Categorization</p>
              <div className="grid grid-cols-4 gap-2">
                {(liveCategories[formData.type as 'expense' | 'income'] || []).slice(0, 12).map((cat: string) => (
                  <button
                    key={cat}
                    type="button"
                    onClick={() => setFormData(prev => ({ ...prev, category: cat, subcategory: '' }))}
                    className={cn(
                      "flex flex-col items-center gap-1.5 p-2 rounded-2xl border transition-all",
                      formData.category === cat
                        ? "bg-slate-900 text-white border-slate-900 shadow-md scale-105"
                        : "bg-slate-50 text-slate-600 border-slate-100 active:bg-slate-200"
                    )}
                  >
                    <span className="text-lg">{getCategoryCartoonIcon(cat)}</span>
                    <span className="text-[8px] font-black uppercase tracking-tighter text-center leading-none truncate w-full">{cat.split(' ')[0]}</span>
                  </button>
                ))}
              </div>
              <div className="mt-4">
                <CategoryDropdown 
                  options={liveCategories[formData.type as 'expense' | 'income'] || []} 
                  value={formData.category} 
                  onChange={(val) => setFormData(prev => ({ ...prev, category: val, subcategory: '' }))} 
                  className="min-h-[3rem] rounded-2xl border-none bg-slate-50 font-black text-xs" 
                />
              </div>
            </div>

            <div>
              <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-3 px-1">Tax Details (GST)</p>
              <div className="flex flex-wrap sm:grid sm:grid-cols-3 gap-2">
                 <div className="flex-1 min-w-[80px] space-y-1">
                   <p className="text-[8px] font-black text-slate-400 text-center uppercase tracking-tighter">CGST</p>
                   <input type="number" step="0.01" value={formData.taxDetails.cgst || ''} onChange={(e) => setFormData(prev => ({ ...prev, taxDetails: { ...prev.taxDetails, cgst: parseFloat(e.target.value) || 0 } }))} className="w-full min-h-[2.25rem] bg-slate-50 rounded-xl text-[10px] font-black border-none text-center" placeholder="0.00" />
                 </div>
                 <div className="flex-1 min-w-[80px] space-y-1">
                   <p className="text-[8px] font-black text-slate-400 text-center uppercase tracking-tighter">SGST</p>
                   <input type="number" step="0.01" value={formData.taxDetails.sgst || ''} onChange={(e) => setFormData(prev => ({ ...prev, taxDetails: { ...prev.taxDetails, sgst: parseFloat(e.target.value) || 0 } }))} className="w-full min-h-[2.25rem] bg-slate-50 rounded-xl text-[10px] font-black border-none text-center" placeholder="0.00" />
                 </div>
                 <div className="flex-1 min-w-[80px] space-y-1">
                   <p className="text-[8px] font-black text-slate-400 text-center uppercase tracking-tighter">IGST</p>
                   <input type="number" step="0.01" value={formData.taxDetails.igst || ''} onChange={(e) => setFormData(prev => ({ ...prev, taxDetails: { ...prev.taxDetails, igst: parseFloat(e.target.value) || 0 } }))} className="w-full min-h-[2.25rem] bg-slate-50 rounded-xl text-[10px] font-black border-none text-center" placeholder="0.00" />
                 </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );

  return (
    <>
      {desktopView}
      {mobileView}
      <AnimatePresence>
        {showScanner && (
          <ReceiptScanner isOpen={showScanner} onClose={() => setShowScanner(false)} initialAccountId={formData.accountId} expenseMode={expenseMode === 'group' ? 'group' : 'individual'} onApplyScan={(scan) => {
            setFormData(prev => ({ ...prev, amount: scan.amount || prev.amount, description: scan.description || prev.description, merchant: scan.merchantName || prev.merchant }));
            setAmountStr(scan.amount ? String(scan.amount) : amountStr);
            setShowScanner(false);
          }} />
        )}
      </AnimatePresence>
    </>
  );
}
