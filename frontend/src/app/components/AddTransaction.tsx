
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
  Plus, Loader2, ArrowRightLeft, Menu, ArrowDown, Info, HelpCircle, Settings, ArrowLeft
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
import { SearchableDropdown } from '@/app/components/ui/SearchableDropdown';
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

import '@/styles/premium-transactions.css';

// --- Types ---
type TransactionType = 'expense' | 'income' | 'transfer';
type ExpenseMode = 'individual' | 'group' | 'loan';
type LoanType = 'borrowed' | 'lent';

interface GroupParticipantDraft {
  id: string;
  friendId?: number;
  name: string;
  email: string;
  phone: string;
  share: number;
}

// --- Constants & Helpers ---
const BUILTIN_CATEGORIES = {
  expense: Object.values(EXPENSE_CATEGORIES as Record<string, any>).map(cat => cat.name as string),
  income: Object.values(INCOME_CATEGORIES as Record<string, any>).map(cat => cat.name as string),
};

const DEFAULT_CATEGORY = {
  expense: BUILTIN_CATEGORIES.expense.includes('Food & Dining') ? 'Food & Dining' : BUILTIN_CATEGORIES.expense[0],
  income: BUILTIN_CATEGORIES.income.includes('Salary') ? 'Salary' : BUILTIN_CATEGORIES.income[0],
};

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

const formatAccountBalance = (v: number, currency: string) =>
  new Intl.NumberFormat('en-US', { style: 'currency', currency, maximumFractionDigits: 2 }).format(v);

// --- Sub-components ---

const PremiumModeSelector = ({ 
  options, 
  activeId, 
  onChange,
  className
}: { 
  options: { id: string, label: string }[], 
  activeId: string, 
  onChange: (id: any) => void,
  className?: string
}) => {
  const activeIndex = options.findIndex(o => o.id === activeId);
  return (
    <div className={cn("mode-selector-pill", className)}>
      <motion.div 
        className="mode-active-pill"
        initial={false}
        animate={{ 
          left: `calc(${activeIndex * (100 / options.length)}% + 4px)`,
          width: `calc(${100 / options.length}% - 8px)`
        }}
        transition={{ type: "spring", stiffness: 400, damping: 30 }}
      />
      {options.map(opt => (
        <button
          key={opt.id}
          onClick={() => onChange(opt.id)}
          className={cn("mode-selector-btn flex-1", activeId === opt.id && "active")}
        >
          {opt.label}
        </button>
      ))}
    </div>
  );
};

const CategoryGrid = ({ 
  type, 
  selectedCategory, 
  onSelect, 
  aiSuggested 
}: { 
  type: 'expense' | 'income', 
  selectedCategory: string, 
  onSelect: (cat: string) => void,
  aiSuggested?: string
}) => {
  const categories = type === 'expense' ? BUILTIN_CATEGORIES.expense : BUILTIN_CATEGORIES.income;
  
  return (
    <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4 max-h-[400px] overflow-y-auto no-scrollbar p-2">
      {categories.map(cat => (
        <div 
          key={cat}
          onClick={() => onSelect(cat)}
          className={cn(
            "category-card",
            selectedCategory === cat && "selected",
            aiSuggested === cat && "ai-highlight"
          )}
        >
          <div className={cn("w-12 h-12 flex items-center justify-center rounded-2xl bg-slate-50 transition-colors", selectedCategory === cat && "bg-white/10")}>
            {getCategoryCartoonIcon(cat, 32)}
          </div>
          <span className={cn("text-[11px] font-black uppercase tracking-wider text-slate-500 text-center", selectedCategory === cat && "text-white")}>
            {cat}
          </span>
        </div>
      ))}
    </div>
  );
};

const AIDetectionCard = ({ confidence, category, subcategory }: { confidence: number, category: string, subcategory?: string }) => (
  <motion.div 
    initial={{ opacity: 0, y: 10 }}
    animate={{ opacity: 1, y: 0 }}
    className="ai-summary-card"
  >
    <div className="w-10 h-10 rounded-full bg-indigo-500/10 flex items-center justify-center">
      <Sparkles className="text-indigo-600" size={20} />
    </div>
    <div className="flex-1">
      <div className="flex items-center justify-between mb-1">
        <span className="text-[10px] font-black text-indigo-600 uppercase tracking-widest">AI Intelligence</span>
        <span className="text-[10px] font-bold text-slate-400">Confidence: {(confidence * 100).toFixed(0)}%</span>
      </div>
      <div className="confidence-bar mb-2 w-full">
        <motion.div 
          className="confidence-progress"
          initial={{ width: 0 }}
          animate={{ width: `${confidence * 100}%` }}
          transition={{ duration: 1, ease: "easeOut" }}
        />
      </div>
      <p className="text-xs font-bold text-slate-700">
        Detected <span className="text-indigo-600">{category}</span> {subcategory && <>&rarr; <span className="text-indigo-600">{subcategory}</span></>}
      </p>
    </div>
  </motion.div>
);

// --- Main Component ---

const MobileBackButton = ({ onClick }: { onClick: () => void }) => (
  <div className="fixed top-6 left-6 z-[100] lg:hidden">
    <button 
      onClick={onClick} 
      className="w-12 h-12 flex items-center justify-center bg-white/70 backdrop-blur-xl rounded-full shadow-lg border border-white/40 text-slate-900 active:scale-95 transition-all"
    >
      <ArrowLeft size={20} />
    </button>
  </div>
);

export function AddTransaction() {
  const { accounts, friends, transactions, setCurrentPage, currency, refreshData } = useApp();
  const { user } = useAuth();
  const defaultDateKey = toLocalDateKey(new Date()) ?? new Date().toISOString().split('T')[0];

  // State
  const [formData, setFormData] = useState(() => ({
    type: 'expense' as TransactionType,
    amount: 0,
    accountId: accounts[0]?.id || 0,
    toAccountId: 0,
    category: DEFAULT_CATEGORY.expense,
    subcategory: '',
    description: '',
    merchant: '',
    date: defaultDateKey,
    notes: '',
    taxDetails: { cgst: 0, sgst: 0, igst: 0, gstin: '', totalTax: 0 }
  }));

  const [isSubmitting, setIsSubmitting] = useState(false);
  const [showScanner, setShowScanner] = useState(false);
  const [scanDocumentId, setScanDocumentId] = useState<number | null>(null);
  const [amountStr, setAmountStr] = useState('');
  const [expenseMode, setExpenseMode] = useState<ExpenseMode>('individual');
  const [loanType, setLoanType] = useState<LoanType>('borrowed');
  const [loanDraft, setLoanDraft] = useState({ contactName: '', interestRate: 0, dueDate: defaultDateKey });
  const [groupName, setGroupName] = useState('');
  const [groupSplitType, setGroupSplitType] = useState<'equal' | 'custom'>('equal');
  const [groupParticipants, setGroupParticipants] = useState<GroupParticipantDraft[]>([]);
  const [returnPage] = useState(() => localStorage.getItem('quickBackPage') || 'transactions');
  const [remoteCategorySuggestion, setRemoteCategorySuggestion] = useState<any>(null);
  const [manualExpenseCategory, setManualExpenseCategory] = useState(false);
  const [mobileStep, setMobileStep] = useState(1);

  // Logic
  const isExpense = formData.type === 'expense';
  const selectedAccount = accounts.find(a => a.id === formData.accountId);
  const targetAccount = accounts.find(a => a.id === formData.toAccountId);

  const switchType = (t: TransactionType) => {
    setFormData(prev => ({
      ...prev,
      type: t,
      category: t === 'transfer' ? 'Transfer' : DEFAULT_CATEGORY[t as 'expense' | 'income'] || DEFAULT_CATEGORY.expense,
      subcategory: t === 'transfer' ? 'Transfer' : '',
      toAccountId: t === 'transfer' ? (accounts.find(a => a.id !== prev.accountId)?.id || 0) : 0
    }));
    setManualExpenseCategory(false);
  };

  // AI Categorization Effect
  useEffect(() => {
    const input = [formData.description, formData.merchant].filter(Boolean).join(' ').trim();
    if (input.length < 3 || !isExpense) {
      setRemoteCategorySuggestion(null);
      return;
    }
    const timer = setTimeout(() => {
      backendService.categorizeText(input).then(res => {
        if (res && res.confidence >= 0.45) {
          setRemoteCategorySuggestion({ ...res, text: input });
          if (!manualExpenseCategory) {
            setFormData(prev => ({ ...prev, category: normalizeCategorySelection(res.category, 'expense'), subcategory: res.subcategory || '' }));
          }
        }
      });
    }, 400);
    return () => clearTimeout(timer);
  }, [formData.description, formData.merchant, isExpense, manualExpenseCategory]);

  const handleSubmit = async () => {
    if (!selectedAccount) { toast.error('Select an account'); return; }
    if (!formData.amount || formData.amount <= 0) { toast.error('Enter amount'); return; }
    
    setIsSubmitting(true);
    try {
      const now = new Date();
      const transactionDate = parseDateInputValue(formData.date) || new Date();
      let result: any;

      if (formData.type === 'transfer') {
        if (!targetAccount) { toast.error('Select target account'); return; }
        result = await saveTransactionWithBackendSync({
          type: 'transfer',
          amount: formData.amount,
          accountId: formData.accountId,
          category: 'Transfer',
          subcategory: 'Transfer',
          description: formData.description || `Transfer to ${targetAccount.name}`,
          date: transactionDate,
          transferToAccountId: formData.toAccountId,
          transferType: 'self-transfer',
          updatedAt: now,
        });
        await db.accounts.update(formData.accountId, { balance: selectedAccount.balance - formData.amount, updatedAt: now });
        await db.accounts.update(formData.toAccountId, { balance: targetAccount.balance + formData.amount, updatedAt: now });
      } else {
        let payload: any = {
          ...formData,
          category: normalizeCategorySelection(formData.category, formData.type as 'expense' | 'income'),
          date: transactionDate,
          expenseMode: isExpense ? expenseMode : undefined,
          updatedAt: now,
        };

        if (isExpense && expenseMode === 'group') {
          payload.groupName = groupName || formData.description || 'Split Bill';
          payload.groupSplitType = groupSplitType;
          payload.participants = groupParticipants.map(p => ({
            friendId: p.friendId,
            name: p.name,
            share: p.share || (formData.amount / (groupParticipants.length || 1)),
          }));
        } else if (isExpense && expenseMode === 'loan') {
          payload.loanType = loanType;
          payload.contactName = loanDraft.contactName;
          payload.dueDate = parseDateInputValue(loanDraft.dueDate) || new Date();
          payload.interestRate = loanDraft.interestRate;
        }

        result = await saveTransactionWithBackendSync(payload);
        const newBalance = formData.type === 'expense' ? selectedAccount.balance - formData.amount : selectedAccount.balance + formData.amount;
        await db.accounts.update(formData.accountId, { balance: newBalance, updatedAt: now });
      }

      if (result?.id && scanDocumentId) {
        await new DocumentManagementService().linkTransaction(scanDocumentId, result.id);
      }

      toast.success('Transaction saved');
      refreshData();
      setCurrentPage(returnPage);
    } catch (err) {
      toast.error('Failed to save');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleScanApply = (scan: ReceiptScanPayload) => {
    setFormData(prev => ({
      ...prev,
      amount: scan.amount || prev.amount,
      description: scan.description || scan.merchantName || prev.description,
      merchant: scan.merchantName || prev.merchant,
      date: (scan.date ? toLocalDateKey(scan.date) : prev.date) as string,
      category: (scan.category || prev.category) as string,
      subcategory: (scan.subcategory || prev.subcategory) as string,
    }));
    setAmountStr((scan.amount || 0).toString());
    setScanDocumentId(scan.scanDocumentId || null);
  };

  // --- Views ---

  const Header = () => (
    <div className="premium-header-floating flex items-center justify-between px-6 py-4">
      {/* Left: Identity */}
      <div className="flex items-center gap-4">
        <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-indigo-500 to-indigo-600 flex items-center justify-center text-white shadow-lg">
          <Zap size={24} />
        </div>
        <div>
          <h1 className="text-xl font-black text-slate-900 tracking-tight leading-none">Add Transaction</h1>
          <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mt-1">Intelligent Financial OS</p>
        </div>
      </div>

      {/* Center: Progress & Mode */}
      <div className="hidden xl:flex items-center gap-8">
        <div className="flex items-center gap-3">
          {[1, 2, 3].map(s => (
            <div key={s} className={cn("w-2 h-2 rounded-full transition-all", s === 1 ? "bg-indigo-600 w-6" : "bg-slate-200")} />
          ))}
        </div>
        <div className="h-8 w-px bg-slate-100" />
        <PremiumModeSelector 
          options={[
            { id: 'expense', label: 'Expense' },
            { id: 'income', label: 'Income' },
            { id: 'transfer', label: 'Transfer' }
          ]} 
          activeId={formData.type} 
          onChange={switchType}
          className="w-[360px]"
        />
      </div>

      {/* Right: Actions */}
      <div className="flex items-center gap-3">
        <button onClick={() => toast.info('Help center coming soon')} className="p-3 text-slate-400 hover:text-indigo-600 transition-colors">
          <HelpCircle size={20} />
        </button>
        <button onClick={() => setCurrentPage('settings')} className="p-3 text-slate-400 hover:text-indigo-600 transition-colors">
          <Settings size={20} />
        </button>
        <button 
          onClick={handleSubmit}
          disabled={isSubmitting || !formData.amount}
          className="bg-slate-900 text-white px-8 py-3.5 rounded-[18px] font-black text-[11px] uppercase tracking-widest shadow-xl shadow-slate-200 hover:bg-slate-800 active:scale-95 transition-all flex items-center gap-2"
        >
          {isSubmitting ? <Loader2 className="animate-spin" size={16} /> : <Check size={16} />}
          Save Transaction
        </button>
      </div>
    </div>
  );

  const DesktopView = (
    <div className="hidden lg:flex flex-col h-screen bg-[#F8FAFC] overflow-hidden">
      <Header />
      
      <main className="flex-1 flex gap-8 px-8 pb-8 overflow-hidden">
        {/* Left Panel (60%) */}
        <div className="flex-[0.6] flex flex-col gap-6 overflow-y-auto no-scrollbar pb-10">
          {/* Sub-mode Selector for Expense */}
          {isExpense && (
            <div className="premium-glass-card p-2 flex gap-2">
              {[
                { id: 'individual', label: 'Individual Expense', icon: <Tag size={16} /> },
                { id: 'group', label: 'Split Bill', icon: <Users size={16} /> },
                { id: 'loan', label: 'Loan / Debt', icon: <Banknote size={16} /> }
              ].map(mode => (
                <button
                  key={mode.id}
                  onClick={() => setExpenseMode(mode.id as any)}
                  className={cn(
                    "flex-1 flex items-center justify-center gap-2 py-4 rounded-2xl font-bold text-sm transition-all",
                    expenseMode === mode.id ? "bg-white text-slate-900 shadow-sm" : "text-slate-400 hover:text-slate-600"
                  )}
                >
                  {mode.icon}
                  {mode.label}
                </button>
              ))}
            </div>
          )}

          {/* Details Card */}
          <div className="premium-glass-card p-8 space-y-8">
            <div className="grid grid-cols-2 gap-8">
              <div className="space-y-3">
                <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Merchant / Source</label>
                <div className="relative">
                   <Store className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
                   <input 
                    type="text" 
                    value={formData.merchant} 
                    onChange={e => setFormData(prev => ({ ...prev, merchant: e.target.value }))}
                    className="w-full bg-slate-50 border-none rounded-2xl py-4 pl-12 pr-4 font-bold text-slate-900 focus:ring-2 focus:ring-indigo-500/20 transition-all" 
                    placeholder="Where did this happen?"
                   />
                </div>
              </div>
              <div className="space-y-3">
                <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Description</label>
                <div className="relative">
                   <AlignLeft className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
                   <input 
                    type="text" 
                    value={formData.description} 
                    onChange={e => setFormData(prev => ({ ...prev, description: e.target.value }))}
                    className="w-full bg-slate-50 border-none rounded-2xl py-4 pl-12 pr-4 font-bold text-slate-900 focus:ring-2 focus:ring-indigo-500/20 transition-all" 
                    placeholder="Short note about this..."
                   />
                </div>
              </div>
            </div>

            {/* AI Insights Card */}
            {remoteCategorySuggestion && <AIDetectionCard {...remoteCategorySuggestion} />}

            {/* Category Grid */}
            {formData.type !== 'transfer' && (
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Smart Categorization</label>
                  <button onClick={() => setShowScanner(true)} className="flex items-center gap-1.5 text-[10px] font-black text-indigo-600 uppercase tracking-widest">
                    <Camera size={14} /> Scan Receipt
                  </button>
                </div>
                <CategoryGrid 
                  type={formData.type === 'income' ? 'income' : 'expense'} 
                  selectedCategory={formData.category} 
                  onSelect={cat => {
                    setManualExpenseCategory(true);
                    setFormData(prev => ({ ...prev, category: cat, subcategory: '' }));
                  }}
                  aiSuggested={remoteCategorySuggestion?.category}
                />
              </div>
            )}

            {/* Transfer Specific: Target Account */}
            {formData.type === 'transfer' && (
              <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4">
                <div className="flex items-center justify-center py-4">
                   <div className="w-12 h-12 bg-indigo-600 rounded-full flex items-center justify-center text-white shadow-xl border-4 border-white animate-bounce">
                      <ArrowDown size={24} />
                   </div>
                </div>
                <div className="space-y-3">
                  <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Target Account</label>
                  <SearchableDropdown
                    options={accounts.filter(a => a.id !== formData.accountId).map(a => ({
                      value: String(a.id),
                      label: a.name,
                      description: formatAccountBalance(a.balance, currency),
                      icon: <div className="w-10 h-10 rounded-xl bg-indigo-50 flex items-center justify-center text-indigo-600 font-black text-[10px]">{(a.type || 'BK').substring(0, 2).toUpperCase()}</div>
                    }))}
                    value={String(formData.toAccountId)}
                    onChange={val => setFormData(prev => ({ ...prev, toAccountId: parseInt(val) }))}
                    placeholder="Select Destination"
                    className="h-16 rounded-2xl border-none bg-slate-50 font-bold"
                  />
                </div>
              </div>
            )}

            {/* Split/Loan Specific Content */}
            {isExpense && expenseMode === 'group' && (
              <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 pt-6 border-t border-slate-100">
                <div className="flex items-center justify-between">
                  <h3 className="text-sm font-black text-slate-900 uppercase tracking-wider">Participant Breakdown</h3>
                  <button onClick={() => setGroupParticipants(prev => [...prev, createEmptyParticipant()])} className="p-2 bg-slate-900 text-white rounded-xl hover:bg-slate-800 transition-colors">
                    <Plus size={16} />
                  </button>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  {groupParticipants.map(p => (
                    <div key={p.id} className="premium-glass-card p-4 flex items-center justify-between bg-white/50">
                      <input 
                        type="text" 
                        value={p.name} 
                        onChange={e => setGroupParticipants(prev => prev.map(item => item.id === p.id ? { ...item, name: e.target.value } : item))}
                        className="bg-transparent border-none text-sm font-bold text-slate-900 w-full focus:ring-0 px-2"
                        placeholder="Name..."
                      />
                      <button onClick={() => setGroupParticipants(prev => prev.filter(item => item.id !== p.id))} className="text-slate-300 hover:text-rose-500 transition-colors">
                        <Trash2 size={16} />
                      </button>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {isExpense && expenseMode === 'loan' && (
              <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 pt-6 border-t border-slate-100">
                <div className="flex gap-2 p-1.5 bg-slate-100 rounded-2xl">
                  {['borrowed', 'lent'].map(type => (
                    <button 
                      key={type}
                      onClick={() => setLoanType(type as any)} 
                      className={cn(
                        "flex-1 py-3 rounded-xl text-[10px] font-black uppercase tracking-wider transition-all", 
                        loanType === type ? "bg-white text-slate-900 shadow-sm" : "text-slate-400 hover:text-slate-600"
                      )}
                    >
                      {type}
                    </button>
                  ))}
                </div>
                <div className="grid grid-cols-2 gap-6">
                   <div className="space-y-3">
                     <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Person / Source</label>
                     <input type="text" value={loanDraft.contactName} onChange={e => setLoanDraft(prev => ({ ...prev, contactName: e.target.value }))} className="w-full bg-slate-50 border-none rounded-2xl py-4 px-4 font-bold text-slate-900 focus:ring-2 focus:ring-indigo-500/20" placeholder="Who?" />
                   </div>
                   <div className="space-y-3">
                     <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Interest Rate (%)</label>
                     <input type="number" value={loanDraft.interestRate} onChange={e => setLoanDraft(prev => ({ ...prev, interestRate: parseFloat(e.target.value) || 0 }))} className="w-full bg-slate-50 border-none rounded-2xl py-4 px-4 font-bold text-slate-900 focus:ring-2 focus:ring-indigo-500/20 text-center" />
                   </div>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Right Panel (40%) */}
        <div className="flex-[0.4] flex flex-col gap-6 overflow-y-auto no-scrollbar pb-10">
          {/* Amount Card */}
          <div className="premium-glass-card p-10 bg-white relative overflow-hidden">
            <div className="absolute -top-10 -right-10 w-40 h-40 bg-indigo-500/5 blur-[50px] rounded-full" />
            <div className="flex items-center justify-between mb-8">
               <span className="text-[10px] font-black text-slate-400 uppercase tracking-[0.3em]">Total Amount</span>
               <div className="px-3 py-1 bg-indigo-600 text-white rounded-lg text-[10px] font-black uppercase">{currency}</div>
            </div>
            <div className="flex items-baseline gap-4 mb-8">
              <input 
                type="number" 
                value={amountStr} 
                onChange={e => { setAmountStr(e.target.value); setFormData(prev => ({ ...prev, amount: parseFloat(e.target.value) || 0 })); }}
                className="premium-amount-input" 
                placeholder="0.00"
                autoFocus
              />
            </div>
            <div className="flex flex-wrap gap-2">
              {[100, 500, 1000, 5000].map(amt => (
                <button 
                  key={amt} 
                  onClick={() => { setAmountStr(String(amt)); setFormData(prev => ({ ...prev, amount: amt })); }}
                  className="amount-chip"
                >
                  +{amt}
                </button>
              ))}
            </div>
          </div>

          {/* Account Selection */}
          <div className="premium-glass-card p-8 space-y-6">
            <div className="space-y-3">
              <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Source Account</label>
              <SearchableDropdown
                options={accounts.map(a => ({
                  value: String(a.id),
                  label: a.name,
                  description: formatAccountBalance(a.balance, currency),
                  icon: <div className="w-10 h-10 rounded-xl bg-slate-50 flex items-center justify-center text-slate-600 font-black text-[10px]">{(a.type || 'BK').substring(0, 2).toUpperCase()}</div>
                }))}
                value={String(formData.accountId)}
                onChange={val => setFormData(prev => ({ ...prev, accountId: parseInt(val) }))}
                placeholder="Select Account"
                className="h-16 rounded-2xl border-none bg-slate-50 font-bold"
              />
            </div>

            <div className="grid grid-cols-2 gap-6">
               <div className="space-y-3">
                 <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Transaction Date</label>
                 <div className="relative">
                   <CalendarDays className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
                   <input type="date" value={formData.date} onChange={e => setFormData(prev => ({ ...prev, date: e.target.value }))} className="w-full bg-slate-50 border-none rounded-2xl py-4 pl-12 pr-4 font-bold text-slate-900 focus:ring-2 focus:ring-indigo-500/20" />
                 </div>
               </div>
               <div className="space-y-3">
                 <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Due Date (Optional)</label>
                 <div className="relative">
                   <CalendarDays className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400 opacity-30" size={18} />
                   <input type="date" value={loanDraft.dueDate} onChange={e => setLoanDraft(prev => ({ ...prev, dueDate: e.target.value }))} className="w-full bg-slate-50/50 border-none rounded-2xl py-4 pl-12 pr-4 font-bold text-slate-900/30 focus:ring-2 focus:ring-indigo-500/20" />
                 </div>
               </div>
            </div>

            <div className="space-y-3">
              <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Additional Notes</label>
              <textarea 
                value={formData.notes} 
                onChange={e => setFormData(prev => ({ ...prev, notes: e.target.value }))}
                className="w-full bg-slate-50 border-none rounded-2xl py-4 px-4 font-bold text-slate-900 focus:ring-2 focus:ring-indigo-500/20 min-h-[100px] resize-none" 
                placeholder="Anything else we should know?"
              />
            </div>
          </div>

          {/* Quick Summary / Summary Card */}
          <div className="mt-auto p-6 bg-slate-900 rounded-[28px] text-white shadow-2xl flex items-center justify-between">
            <div className="flex items-center gap-4">
              <div className="w-10 h-10 rounded-xl bg-white/10 flex items-center justify-center">
                 <Info size={20} className="text-indigo-400" />
              </div>
              <div>
                <p className="text-[10px] font-black text-white/40 uppercase tracking-widest">Auto-Categorized</p>
                <p className="text-sm font-black tracking-tight">{formData.category} &rarr; {formData.subcategory || 'General'}</p>
              </div>
            </div>
            <div className="text-right">
              <p className="text-[10px] font-black text-white/40 uppercase tracking-widest">Final Total</p>
              <p className="text-xl font-black tracking-tighter">{currency} {formData.amount.toLocaleString(undefined, { minimumFractionDigits: 2 })}</p>
            </div>
          </div>
        </div>
      </main>
    </div>
  );

  const MobileView = (
    <div className="flex lg:hidden flex-col h-screen bg-white overflow-hidden relative">
      <MobileBackButton onClick={() => setCurrentPage(returnPage)} />
      
      {/* Mobile Sticky Header */}
      <div className="px-6 py-4 flex items-center justify-between border-b border-slate-50 pl-20">
        <div className="flex flex-col items-center flex-1">
           <h2 className="text-sm font-black text-slate-900 uppercase tracking-wider">Step {mobileStep} of 3</h2>
           <div className="flex gap-1 mt-1">
              {[1, 2, 3].map(s => <div key={s} className={cn("w-6 h-1 rounded-full", s <= mobileStep ? "bg-indigo-600" : "bg-slate-100")} />)}
           </div>
        </div>
        <button onClick={() => setShowScanner(true)} className="w-10 h-10 flex items-center justify-center bg-indigo-600 text-white rounded-full shadow-lg">
          <Camera size={18} />
        </button>
      </div>

      <div className="flex-1 overflow-y-auto px-6 py-8">
        <AnimatePresence mode="wait">
          {mobileStep === 1 && (
            <motion.div 
              key="step1"
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -20 }}
              className="space-y-8"
            >
              <div className="space-y-2">
                <h1 className="text-3xl font-black text-slate-900 tracking-tight">What's the <span className="text-indigo-600">Total?</span></h1>
                <p className="text-sm font-bold text-slate-400">Enter the transaction amount below.</p>
              </div>
              
              <div className="premium-glass-card p-8 bg-slate-50/50 border-none text-center">
                <div className="flex items-center justify-center gap-2 mb-4">
                  <span className="text-4xl font-black text-slate-300 uppercase">{currency}</span>
                  <input 
                    type="number" 
                    value={amountStr} 
                    onChange={e => { setAmountStr(e.target.value); setFormData(prev => ({ ...prev, amount: parseFloat(e.target.value) || 0 })); }}
                    className="bg-transparent text-6xl font-black text-slate-900 outline-none w-[200px] text-center" 
                    placeholder="0.00"
                    autoFocus
                  />
                </div>
                <div className="flex justify-center flex-wrap gap-2">
                  {[100, 500, 1000].map(amt => (
                    <button key={amt} onClick={() => { setAmountStr(String(amt)); setFormData(prev => ({ ...prev, amount: amt })); }} className="px-4 py-2 bg-white rounded-xl text-xs font-black text-slate-600 shadow-sm border border-slate-100">+{amt}</button>
                  ))}
                </div>
              </div>

              <div className="space-y-4 pt-4">
                <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Transaction Type</label>
                <PremiumModeSelector 
                  options={[{ id: 'expense', label: 'Expense' }, { id: 'income', label: 'Income' }, { id: 'transfer', label: 'Transfer' }]} 
                  activeId={formData.type} 
                  onChange={switchType}
                />
              </div>
            </motion.div>
          )}

          {mobileStep === 2 && (
            <motion.div 
              key="step2"
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -20 }}
              className="space-y-8"
            >
              <div className="space-y-2">
                <h1 className="text-3xl font-black text-slate-900 tracking-tight">Tell us <span className="text-indigo-600">More</span></h1>
                <p className="text-sm font-bold text-slate-400">Describe and categorize this activity.</p>
              </div>

              <div className="space-y-6">
                <div className="space-y-3">
                  <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Description</label>
                  <input 
                    type="text" 
                    value={formData.description} 
                    onChange={e => setFormData(prev => ({ ...prev, description: e.target.value }))}
                    className="w-full bg-slate-50 border-none rounded-2xl py-5 px-6 font-bold text-slate-900 focus:ring-2 focus:ring-indigo-500/20" 
                    placeholder="E.g. Lunch with team..."
                  />
                </div>

                {formData.type !== 'transfer' && (
                  <div className="space-y-4">
                    <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Select Category</label>
                    <CategoryGrid 
                      type={formData.type === 'income' ? 'income' : 'expense'} 
                      selectedCategory={formData.category} 
                      onSelect={cat => setFormData(prev => ({ ...prev, category: cat, subcategory: '' }))}
                      aiSuggested={remoteCategorySuggestion?.category}
                    />
                  </div>
                )}

                {formData.type === 'transfer' && (
                  <div className="space-y-3">
                    <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Target Account</label>
                    <SearchableDropdown
                      options={accounts.filter(a => a.id !== formData.accountId).map(a => ({ value: String(a.id), label: a.name }))}
                      value={String(formData.toAccountId)}
                      onChange={val => setFormData(prev => ({ ...prev, toAccountId: parseInt(val) }))}
                      placeholder="To Account"
                      className="h-16 rounded-2xl bg-slate-50 border-none font-bold"
                    />
                  </div>
                )}
              </div>
            </motion.div>
          )}

          {mobileStep === 3 && (
            <motion.div 
              key="step3"
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -20 }}
              className="space-y-8"
            >
              <div className="space-y-2">
                <h1 className="text-3xl font-black text-slate-900 tracking-tight">Final <span className="text-indigo-600">Review</span></h1>
                <p className="text-sm font-bold text-slate-400">Confirm and save your transaction.</p>
              </div>

              <div className="premium-glass-card p-6 space-y-6">
                <div className="flex items-center justify-between pb-6 border-b border-slate-100">
                  <div className="flex items-center gap-4">
                    <div className="w-12 h-12 rounded-2xl bg-slate-900 flex items-center justify-center text-white">
                      {getCategoryCartoonIcon(formData.category, 28)}
                    </div>
                    <div>
                      <p className="text-xs font-black text-slate-400 uppercase">{formData.type}</p>
                      <p className="text-lg font-black text-slate-900">{formData.description || formData.category}</p>
                    </div>
                  </div>
                  <p className="text-xl font-black text-slate-900">{currency} {formData.amount}</p>
                </div>

                <div className="space-y-4">
                   <div className="flex justify-between">
                     <span className="text-xs font-bold text-slate-400">Account</span>
                     <span className="text-xs font-black text-slate-900">{selectedAccount?.name}</span>
                   </div>
                   <div className="flex justify-between">
                     <span className="text-xs font-bold text-slate-400">Date</span>
                     <span className="text-xs font-black text-slate-900">{formData.date}</span>
                   </div>
                </div>

                <div className="pt-4">
                  <textarea 
                    value={formData.notes} 
                    onChange={e => setFormData(prev => ({ ...prev, notes: e.target.value }))}
                    className="w-full bg-slate-50 border-none rounded-2xl p-4 font-bold text-sm text-slate-900 placeholder:text-slate-300 min-h-[80px]" 
                    placeholder="Add notes..."
                  />
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* Mobile Navigation / Actions */}
      <div className="p-6 border-t border-slate-50 bg-white shadow-[0_-10px_30px_rgba(0,0,0,0.03)]">
        <div className="flex gap-4">
          {mobileStep > 1 && (
            <button 
              onClick={() => setMobileStep(s => s - 1)}
              className="flex-1 py-4 rounded-2xl bg-slate-50 text-slate-600 font-black text-[11px] uppercase tracking-widest transition-all active:scale-95"
            >
              Back
            </button>
          )}
          {mobileStep < 3 ? (
            <button 
              onClick={() => setMobileStep(s => s + 1)}
              disabled={mobileStep === 1 && !formData.amount}
              className="flex-[2] py-4 rounded-2xl bg-slate-900 text-white font-black text-[11px] uppercase tracking-widest shadow-xl shadow-slate-200 transition-all active:scale-95 disabled:opacity-30"
            >
              Next Step
            </button>
          ) : (
            <button 
              onClick={handleSubmit}
              disabled={isSubmitting}
              className="flex-[2] py-4 rounded-2xl bg-indigo-600 text-white font-black text-[11px] uppercase tracking-widest shadow-xl shadow-indigo-100 transition-all active:scale-95 flex items-center justify-center gap-2"
            >
              {isSubmitting ? <Loader2 className="animate-spin" size={16} /> : <Zap size={16} />}
              Complete Record
            </button>
          )}
        </div>
      </div>
    </div>
  );

  return (
    <div className="min-h-screen">
      {DesktopView}
      {MobileView}
      
      {showScanner && (
        <ReceiptScanner 
          isOpen={showScanner}
          onClose={() => setShowScanner(false)} 
          onApplyScan={handleScanApply} 
        />
      )}
    </div>
  );
}
