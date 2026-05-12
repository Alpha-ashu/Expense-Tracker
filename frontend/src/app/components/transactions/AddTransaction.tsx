
import React, { useEffect, useMemo, useRef, useState } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { useApp } from '@/contexts/AppContext';
import { useAuth } from '@/contexts/AuthContext';
import { db } from '@/lib/database';
import { queueTransactionInsertSync, saveTransactionWithBackendSync } from '@/lib/auth-sync-integration';
import { DocumentManagementService } from '@/services/documentManagementService';
import { backendService } from '@/lib/backend-api';
import {
  ChevronLeft, ArrowDownLeft, ArrowUpRight, Camera,
  CalendarDays, Wallet, Tag, AlignLeft, Store, Sparkles,
  CreditCard, Banknote, Smartphone,
  Zap, ChevronDown, Search, Check, Users, UserPlus, Mail, Phone, Trash2,
  Plus, Loader2, ArrowRightLeft, Menu, ArrowDown, Info, HelpCircle, Settings, ArrowLeft,
  ArrowUp, User
} from 'lucide-react';
import { toast } from 'sonner';
import {
  EXPENSE_CATEGORIES,
  INCOME_CATEGORIES,
  normalizeCategorySelection,
} from '@/lib/expenseCategories';
import { ReceiptScanner, type ReceiptScanPayload } from '@/app/components/transactions/ReceiptScanner';
import { getCategoryCartoonIcon } from '@/app/components/ui/CartoonCategoryIcons';
import { SearchableDropdown } from '@/app/components/ui/SearchableDropdown';
import { motion, AnimatePresence } from 'framer-motion';
import { cn } from '@/lib/utils';
import { parseDateInputValue, toLocalDateKey } from '@/lib/dateUtils';

import '@/styles/premium-transactions.css';

// --- Types ---
type TransactionType = 'expense' | 'income' | 'transfer';
type ExpenseMode = 'individual' | 'group' | 'loan';
type LoanType = 'borrowed' | 'lent';
type TransferSubType = 'self' | 'others';

interface GroupParticipantDraft {
  id: string;
  friendId?: number;
  name: string;
  share: number;
}

// --- Constants & Helpers ---
const BUILTIN_CATEGORIES = {
  expense: Object.values(EXPENSE_CATEGORIES as Record<string, any>).map(cat => cat.name as string),
  income: Object.values(INCOME_CATEGORIES as Record<string, any>).map(cat => cat.name as string),
};

const DEFAULT_CATEGORY = {
  expense: 'Food & Dining',
  income: 'Salary',
};

const createDraftId = () =>
  typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function'
    ? crypto.randomUUID()
    : `${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;

const createEmptyParticipant = (seed: Partial<GroupParticipantDraft> = {}): GroupParticipantDraft => ({
  id: createDraftId(),
  name: '',
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
  className,
  variant = 'pill'
}: { 
  options: { id: string, label: string, icon?: React.ReactNode }[], 
  activeId: string, 
  onChange: (id: any) => void,
  className?: string,
  variant?: 'pill' | 'ghost'
}) => {
  return (
    <div className={cn(
      variant === 'pill' ? "mode-selector-pill" : "flex gap-1 bg-slate-100/50 p-1 rounded-xl", 
      className
    )}>
      {options.map(opt => {
        const isActive = activeId === opt.id;
        return (
          <button
            key={opt.id}
            onClick={() => onChange(opt.id)}
            className={cn(
              "flex-1 relative flex items-center justify-center gap-2 py-2.5 sm:py-3 rounded-xl font-black text-[10px] uppercase tracking-widest transition-colors z-10",
              isActive ? "text-white" : "text-slate-500 hover:text-slate-700"
            )}
          >
            {isActive && variant === 'pill' && (
              <motion.div
                layoutId="mode-active-pill"
                className="absolute inset-0 bg-slate-900 rounded-[14px] -z-10 shadow-lg shadow-slate-200"
                transition={{ type: "spring", stiffness: 400, damping: 35 }}
              />
            )}
            {opt.icon && <span className={cn("transition-transform", isActive && "scale-110")}>{opt.icon}</span>}
            {opt.label}
          </button>
        );
      })}
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
    <div className="grid grid-cols-4 sm:grid-cols-5 md:grid-cols-4 xl:grid-cols-5 gap-2 max-h-[180px] overflow-y-auto no-scrollbar p-1">
      {categories.map(cat => (
        <div 
          key={cat}
          onClick={() => onSelect(cat)}
          className={cn(
            "flex flex-col items-center gap-1.5 p-2 rounded-xl transition-all cursor-pointer group",
            selectedCategory === cat ? "bg-indigo-600 shadow-lg shadow-indigo-200" : "bg-slate-50 hover:bg-slate-100",
            aiSuggested === cat && !selectedCategory && "ring-2 ring-indigo-400 ring-offset-2 animate-pulse"
          )}
        >
          <div className={cn("w-8 h-8 flex items-center justify-center rounded-lg transition-colors", selectedCategory === cat ? "bg-white/20" : "bg-white group-hover:bg-slate-50")}>
            {getCategoryCartoonIcon(cat, 20)}
          </div>
          <span className={cn("text-[9px] font-black uppercase tracking-tight text-center leading-none", selectedCategory === cat ? "text-white" : "text-slate-500")}>
            {cat.split(' ')[0]}
          </span>
        </div>
      ))}
    </div>
  );
};

// --- Main Component ---

export function AddTransaction() {
  const { accounts, friends, setCurrentPage, currency, refreshData } = useApp();
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
  }));

  const [isSubmitting, setIsSubmitting] = useState(false);
  const [showScanner, setShowScanner] = useState(false);
  const [scanDocumentId, setScanDocumentId] = useState<number | null>(null);
  const [amountStr, setAmountStr] = useState('');
  const [expenseMode, setExpenseMode] = useState<ExpenseMode>('individual');
  const [loanType, setLoanType] = useState<LoanType>('borrowed');
  const [transferSubType, setTransferSubType] = useState<TransferSubType>('self');
  const [loanDraft, setLoanDraft] = useState({ contactName: '', interestRate: 0, dueDate: defaultDateKey });
  const [groupParticipants, setGroupParticipants] = useState<GroupParticipantDraft[]>([]);
  const [returnPage] = useState(() => localStorage.getItem('quickBackPage') || 'transactions');
  const [remoteCategorySuggestion, setRemoteCategorySuggestion] = useState<any>(null);
  const [manualExpenseCategory, setManualExpenseCategory] = useState(false);

  // Logic
  const isExpense = formData.type === 'expense';
  const isTransfer = formData.type === 'transfer';
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

  // AI Categorization
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

      if (isTransfer) {
        if (transferSubType === 'self' && !targetAccount) { toast.error('Select target account'); return; }
        result = await saveTransactionWithBackendSync({
          type: 'transfer',
          amount: formData.amount,
          accountId: formData.accountId,
          category: 'Transfer',
          subcategory: transferSubType === 'self' ? 'Self Transfer' : 'Payment',
          description: formData.description || (transferSubType === 'self' ? `Transfer to ${targetAccount?.name}` : 'Transfer to Other'),
          date: transactionDate,
          transferToAccountId: transferSubType === 'self' ? formData.toAccountId : undefined,
          transferType: transferSubType === 'self' ? 'self-transfer' : 'external-payment',
          updatedAt: now,
        });
        if (transferSubType === 'self') {
          await db.accounts.update(formData.accountId, { balance: selectedAccount.balance - formData.amount, updatedAt: now });
          await db.accounts.update(formData.toAccountId, { balance: targetAccount!.balance + formData.amount, updatedAt: now });
        } else {
          await db.accounts.update(formData.accountId, { balance: selectedAccount.balance - formData.amount, updatedAt: now });
        }
      } else {
        let payload: any = {
          ...formData,
          category: normalizeCategorySelection(formData.category, formData.type as 'expense' | 'income'),
          date: transactionDate,
          expenseMode: isExpense ? expenseMode : undefined,
          updatedAt: now,
        };

        if (isExpense && expenseMode === 'group') {
          payload.participants = groupParticipants.map(p => ({
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
    }));
    setAmountStr((scan.amount || 0).toString());
    setScanDocumentId(scan.scanDocumentId || null);
  };

  return (
    <div className="flex flex-col h-screen bg-[#F8FAFC] overflow-hidden">

      {/* Optimized Header - High Density */}
      <header className="bg-white border-b border-slate-100 flex flex-col sticky top-0 z-30">
        <div className="flex flex-row items-center justify-between gap-3 w-full px-4 lg:px-6 py-4 h-16 sm:h-20">
          <div className="flex items-center gap-2 sm:gap-3 min-w-0">
            <button onClick={() => setCurrentPage(returnPage)} className="lg:hidden p-2 text-slate-600 hover:bg-slate-50 rounded-xl transition-all shrink-0">
              <ArrowLeft size={20} />
            </button>
            <h1 className="text-lg sm:text-xl font-black text-slate-900 tracking-tight leading-none truncate uppercase">Add Transaction</h1>
          </div>
          
          {/* Desktop Mode Selector */}
          <div className="hidden lg:block flex-1 max-w-md mx-auto px-4">
            <PremiumModeSelector 
              options={[
                { id: 'expense', label: 'Expense', icon: <ArrowUpRight size={14} /> },
                { id: 'income', label: 'Income', icon: <ArrowDownLeft size={14} /> },
                { id: 'transfer', label: 'Transfer', icon: <ArrowRightLeft size={14} /> }
              ]} 
              activeId={formData.type} 
              onChange={switchType}
            />
          </div>

          <div className="flex items-center gap-2 shrink-0">
            <button onClick={() => setShowScanner(true)} className="p-2.5 bg-slate-50 text-slate-400 hover:text-indigo-600 rounded-xl transition-all">
              <Camera size={20} />
            </button>
            <button 
              onClick={handleSubmit}
              disabled={isSubmitting || !formData.amount}
              className="bg-slate-900 text-white px-5 sm:px-6 py-2.5 rounded-xl font-black text-[10px] uppercase tracking-widest shadow-lg shadow-slate-200 hover:bg-slate-800 active:scale-95 transition-all flex items-center gap-2 disabled:opacity-50"
            >
              {isSubmitting ? <Loader2 className="animate-spin" size={14} /> : <Check size={14} />}
              Save
            </button>
          </div>
        </div>

        {/* Mobile Mode Selector Panel */}
        <div className="lg:hidden px-4 pb-4 animate-in slide-in-from-top-2 duration-300">
          <PremiumModeSelector 
            options={[
              { id: 'expense', label: 'Expense', icon: <ArrowUpRight size={14} /> },
              { id: 'income', label: 'Income', icon: <ArrowDownLeft size={14} /> },
              { id: 'transfer', label: 'Transfer', icon: <ArrowRightLeft size={14} /> }
            ]} 
            activeId={formData.type} 
            onChange={switchType}
            className="mode-selector-pill w-full shadow-sm border border-slate-100"
          />
        </div>
      </header>

      {/* Main Single-Page Content Area */}
      <main className="flex-1 p-3 lg:p-6 grid grid-cols-1 lg:grid-cols-12 gap-4 lg:gap-6 overflow-y-auto pb-32 lg:pb-6">
        
        {/* Left Column: Context & categorization (lg:col-7) */}
        <div className="lg:col-span-7 flex flex-col gap-4">
          
          {/* Sub-mode Selection for Expense/Transfer */}
          {(isExpense || isTransfer) && (
            <div className="premium-glass-card p-1 flex gap-1">
              {isExpense ? [
                { id: 'individual', label: 'Individual', icon: <Tag size={12} /> },
                { id: 'group', label: 'Split', icon: <Users size={12} /> },
                { id: 'loan', label: 'Loan', icon: <Banknote size={12} /> }
              ].map(m => (
                <button key={m.id} onClick={() => setExpenseMode(m.id as any)} className={cn("flex-1 flex items-center justify-center gap-1.5 py-2 rounded-lg font-black text-[8px] uppercase tracking-wider transition-all", expenseMode === m.id ? "bg-white text-slate-900 shadow-sm" : "text-slate-400 hover:text-slate-600")}>
                  {m.icon} {m.label}
                </button>
              )) : [
                { id: 'self', label: 'Self', icon: <Wallet size={12} /> },
                { id: 'others', label: 'Others', icon: <UserPlus size={12} /> }
              ].map(m => (
                <button key={m.id} onClick={() => setTransferSubType(m.id as any)} className={cn("flex-1 flex items-center justify-center gap-1.5 py-2 rounded-lg font-black text-[8px] uppercase tracking-wider transition-all", transferSubType === m.id ? "bg-white text-slate-900 shadow-sm" : "text-slate-400 hover:text-slate-600")}>
                  {m.icon} {m.label}
                </button>
              ))}
            </div>
          )}

          {/* Intelligent Summary - Moved for higher visibility */}
          <div className="p-4 bg-slate-900 rounded-2xl text-white flex items-center justify-between shadow-xl">
             <div className="flex items-center gap-3">
                <div className="w-8 h-8 rounded-lg bg-white/10 flex items-center justify-center"><Info size={16} className="text-indigo-400" /></div>
                <div>
                  <p className="text-[8px] font-black text-white/40 uppercase">Summary</p>
                  <p className="text-[10px] font-black truncate max-w-[120px]">{formData.description || formData.category}</p>
                </div>
             </div>
             <div className="text-right">
                <p className="text-[8px] font-black text-white/40 uppercase">Final Amount</p>
                <p className="text-lg font-black tracking-tighter">{currency} {formData.amount.toLocaleString()}</p>
             </div>
          </div>

          {/* Primary Input Card */}
          <div className="premium-glass-card p-4 space-y-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div className="space-y-1">
                <label className="text-[8px] font-black text-slate-400 uppercase tracking-widest">Merchant / Payee</label>
                <div className="relative">
                  <Store className="absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-300" size={14} />
                  <input type="text" value={formData.merchant} onChange={e => setFormData(prev => ({ ...prev, merchant: e.target.value }))} className="w-full bg-slate-50 border-none rounded-xl py-2.5 pl-9 pr-3 font-bold text-slate-900 text-xs focus:ring-2 focus:ring-indigo-500/20" placeholder="Starbucks" />
                </div>
              </div>
              <div className="space-y-1">
                <label className="text-[8px] font-black text-slate-400 uppercase tracking-widest">Description</label>
                <div className="relative">
                  <AlignLeft className="absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-300" size={14} />
                  <input type="text" value={formData.description} onChange={e => setFormData(prev => ({ ...prev, description: e.target.value }))} className="w-full bg-slate-50 border-none rounded-xl py-2.5 pl-9 pr-3 font-bold text-slate-900 text-xs focus:ring-2 focus:ring-indigo-500/20" placeholder="Lunch" />
                </div>
              </div>
            </div>

            {/* AI Highlight / Detection Indicator */}
            {remoteCategorySuggestion && (
              <div className="flex items-center gap-3 p-3 bg-indigo-50 rounded-xl border border-indigo-100/50">
                 <div className="w-8 h-8 rounded-full bg-indigo-600 flex items-center justify-center text-white shrink-0">
                    <Sparkles size={14} />
                 </div>
                 <div className="flex-1">
                    <p className="text-[9px] font-black text-indigo-600 uppercase">AI Detected Category</p>
                    <p className="text-xs font-bold text-slate-700">{remoteCategorySuggestion.category} ({(remoteCategorySuggestion.confidence * 100).toFixed(0)}% confident)</p>
                 </div>
              </div>
            )}

            {/* Unified Category Selector */}
            {!isTransfer && (
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <label className="text-[9px] font-black text-slate-400 uppercase tracking-widest">Select Category</label>
                  <span className="text-[9px] font-bold text-indigo-500">Auto-Categorization Active</span>
                </div>
                <CategoryGrid 
                  type={formData.type === 'income' ? 'income' : 'expense'} 
                  selectedCategory={formData.category} 
                  onSelect={cat => { setManualExpenseCategory(true); setFormData(prev => ({ ...prev, category: cat, subcategory: '' })); }}
                  aiSuggested={remoteCategorySuggestion?.category}
                />
              </div>
            )}

            {/* Split Bill Participants - High Density */}
            {isExpense && expenseMode === 'group' && (
              <div className="space-y-3 pt-3 border-t border-slate-100">
                <div className="flex items-center justify-between">
                  <label className="text-[9px] font-black text-slate-400 uppercase tracking-widest">Participants</label>
                  <button onClick={() => setGroupParticipants(prev => [...prev, createEmptyParticipant()])} className="flex items-center gap-1 text-[9px] font-black text-indigo-600 uppercase">
                    <Plus size={12} /> Add Person
                  </button>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 lg:max-h-[120px] lg:overflow-y-auto">
                  {groupParticipants.map(p => (
                    <div key={p.id} className="flex items-center gap-2 p-2 bg-slate-50 rounded-lg group">
                      <div className="w-6 h-6 rounded-full bg-white flex items-center justify-center text-[10px] font-black text-slate-400 uppercase">{p.name?.[0] || '?'}</div>
                      <input type="text" value={p.name} onChange={e => setGroupParticipants(prev => prev.map(i => i.id === p.id ? { ...i, name: e.target.value } : i))} className="flex-1 bg-transparent border-none p-0 text-xs font-bold text-slate-900 focus:ring-0" placeholder="Name" />
                      <button onClick={() => setGroupParticipants(prev => prev.filter(i => i.id !== p.id))} className="opacity-0 group-hover:opacity-100 text-slate-300 hover:text-rose-500 transition-all">
                        <Trash2 size={14} />
                      </button>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Loan Specific - High Density */}
            {isExpense && expenseMode === 'loan' && (
              <div className="space-y-4 pt-3 border-t border-slate-100">
                 <div className="flex gap-2">
                    {['borrowed', 'lent'].map(t => (
                      <button key={t} onClick={() => setLoanType(t as any)} className={cn("flex-1 py-2.5 rounded-xl text-[9px] font-black uppercase tracking-wider transition-all", loanType === t ? "bg-slate-900 text-white shadow-md" : "bg-slate-50 text-slate-400")}>
                        {t}
                      </button>
                    ))}
                 </div>
                 <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-1">
                      <label className="text-[9px] font-black text-slate-400 uppercase tracking-widest">Counterparty</label>
                      <input type="text" value={loanDraft.contactName} onChange={e => setLoanDraft(prev => ({ ...prev, contactName: e.target.value }))} className="w-full bg-slate-50 border-none rounded-xl py-2.5 px-3 font-bold text-sm" placeholder="Who?" />
                    </div>
                    <div className="space-y-1">
                      <label className="text-[9px] font-black text-slate-400 uppercase tracking-widest">Interest (%)</label>
                      <input type="number" value={loanDraft.interestRate} onChange={e => setLoanDraft(prev => ({ ...prev, interestRate: parseFloat(e.target.value) || 0 }))} className="w-full bg-slate-50 border-none rounded-xl py-2.5 px-3 font-bold text-sm text-center" />
                    </div>
                 </div>
              </div>
            )}
          </div>
        </div>

        {/* Right Column: Financials & Action (lg:col-5) */}
        <div className="lg:col-span-5 flex flex-col gap-4">
          
          {/* Amount Display - Premium & High Density */}
          <div className="premium-glass-card p-6 bg-white relative overflow-hidden flex flex-col items-center">
             <div className="absolute -top-10 -right-10 w-32 h-32 bg-indigo-500/5 blur-[40px] rounded-full" />
             <span className="text-[9px] font-black text-slate-300 uppercase tracking-[0.2em] mb-2">Total Amount</span>
             <div className="flex items-center gap-3">
                <span className="text-3xl font-black text-slate-200 uppercase">{currency}</span>
                <input 
                  type="number" 
                  value={amountStr} 
                  onChange={e => { setAmountStr(e.target.value); setFormData(prev => ({ ...prev, amount: parseFloat(e.target.value) || 0 })); }}
                  className="bg-transparent text-5xl font-black text-slate-900 outline-none w-[180px] text-center tracking-tighter" 
                  placeholder="0.00"
                  autoFocus
                />
             </div>
              <div className="flex flex-wrap justify-center gap-2 mt-4">
                {[100, 500, 1000, 2000].map(amt => (
                  <button 
                    key={amt} 
                    type="button"
                    onClick={() => { 
                      const current = parseFloat(amountStr) || 0;
                      const next = current + amt;
                      setAmountStr(String(next));
                      setFormData(prev => ({ ...prev, amount: next }));
                    }} 
                    className="px-4 py-2 bg-slate-50 border border-slate-100 rounded-xl text-[10px] font-black text-slate-500 hover:bg-slate-900 hover:text-white hover:border-slate-900 hover:shadow-lg hover:shadow-slate-200 transition-all active:scale-95"
                  >
                    +{amt}
                  </button>
                ))}
              </div>
          </div>

          {/* Account & Meta Card */}
          <div className="premium-glass-card p-4 sm:p-6 space-y-5">
            <div className="space-y-2">
              <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest">{isTransfer ? 'From Account' : 'Account'}</label>
              <SearchableDropdown
                options={accounts.map(a => ({
                  value: String(a.id),
                  label: a.name,
                  description: formatAccountBalance(a.balance, currency),
                  icon: <div className="w-7 h-7 rounded-lg bg-slate-50 flex items-center justify-center text-slate-400 font-black text-[8px]">{(a.type || 'BK').substring(0, 2).toUpperCase()}</div>
                }))}
                value={String(formData.accountId)}
                onChange={val => setFormData(prev => ({ ...prev, accountId: parseInt(val) }))}
                placeholder="Account"
                triggerClassName="h-12 border-none bg-slate-50 font-bold text-xs shadow-none"
              />
            </div>

            {/* Conditional Transfer/Payment Target */}
            {(isTransfer && transferSubType === 'self') && (
              <div className="space-y-3 animate-in fade-in zoom-in-95 duration-200">
                <div className="flex justify-center"><ArrowDown size={14} className="text-slate-300" /></div>
                <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest">To Account</label>
                <SearchableDropdown
                  options={accounts.filter(a => a.id !== formData.accountId).map(a => ({
                    value: String(a.id),
                    label: a.name,
                    description: formatAccountBalance(a.balance, currency),
                    icon: <div className="w-8 h-8 rounded-lg bg-indigo-50 flex items-center justify-center text-indigo-400 font-black text-[9px]">{(a.type || 'BK').substring(0, 2).toUpperCase()}</div>
                  }))}
                  value={String(formData.toAccountId)}
                  onChange={val => setFormData(prev => ({ ...prev, toAccountId: parseInt(val) }))}
                  placeholder="Destination Account"
                  triggerClassName="h-12 border-none bg-slate-50 font-bold text-sm shadow-none"
                />
              </div>
            )}

            {isTransfer && transferSubType === 'others' && (
              <div className="space-y-3 animate-in fade-in zoom-in-95 duration-200">
                <div className="flex justify-center"><ArrowDown size={14} className="text-slate-300" /></div>
                <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Recipient Info</label>
                <div className="relative">
                  <User className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-300" size={14} />
                  <input type="text" className="w-full bg-slate-50 border-none rounded-xl py-2.5 pl-9 pr-3 font-bold text-xs" placeholder="Name / UPI / Account" />
                </div>
              </div>
            )}

            <div className="grid grid-cols-2 gap-4">
               <div className="space-y-2">
                  <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Date</label>
                  <div className="relative">
                    <CalendarDays className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-300" size={14} />
                    <input type="date" value={formData.date} onChange={e => setFormData(prev => ({ ...prev, date: e.target.value }))} className="w-full bg-slate-50 border-none rounded-xl py-2.5 pl-9 pr-3 font-bold text-xs" />
                  </div>
               </div>
               <div className="space-y-2">
                  <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Ref # (Optional)</label>
                  <input type="text" className="w-full bg-slate-50 border-none rounded-xl py-2.5 px-3 font-bold text-xs" placeholder="TXN123..." />
               </div>
            </div>

            <div className="space-y-2">
               <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Notes</label>
               <textarea 
                value={formData.notes} 
                onChange={e => setFormData(prev => ({ ...prev, notes: e.target.value }))}
                className="w-full bg-slate-50 border-none rounded-xl p-3 font-bold text-xs min-h-[60px] resize-none" 
                placeholder="Anything else..."
               />
            </div>
          </div>


        </div>
      </main>

      {/* Floating Scanner Overlay */}
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

