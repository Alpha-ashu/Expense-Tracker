import React, { useEffect, useMemo, useState } from 'react';
import { useApp } from '@/contexts/AppContext';
import { db } from '@/lib/database';
import { saveTransactionWithBackendSync } from '@/lib/auth-sync-integration';
import {
  ChevronLeft, ArrowDownLeft, ArrowUpRight, Camera, Upload,
  CalendarDays, Wallet, Tag, AlignLeft, Store, Sparkles,
  CheckCircle2, Zap,
} from 'lucide-react';
import { toast } from 'sonner';
import { EXPENSE_CATEGORIES, INCOME_CATEGORIES, getSubcategoriesForCategory } from '@/lib/expenseCategories';
import { ReceiptScanner } from '@/app/components/ReceiptScanner';
import { CategoryDropdown } from '@/app/components/ui/CategoryDropdown';
import { motion, AnimatePresence } from 'framer-motion';
import { cn } from '@/lib/utils';

const CATEGORIES = {
  expense: Object.values(EXPENSE_CATEGORIES).map(cat => cat.name),
  income: Object.values(INCOME_CATEGORIES).map(cat => cat.name),
};

/* ─────────────── helpers ─────────────── */
const FieldRow: React.FC<{
  icon: React.ReactNode;
  label: string;
  children: React.ReactNode;
  accent?: boolean;
}> = ({ icon, label, children, accent }) => (
  <div className="flex items-center gap-3.5 px-5 py-4 group">
    <div className={cn(
      'w-9 h-9 rounded-xl flex items-center justify-center shrink-0 transition-colors',
      accent ? 'bg-black/5' : 'bg-gray-100 group-focus-within:bg-gray-200'
    )}>
      {icon}
    </div>
    <div className="flex-1 min-w-0">
      <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-0.5">{label}</p>
      {children}
    </div>
  </div>
);

/* ─────────────── main component ─────────────── */
export const AddTransaction: React.FC = () => {
  const { accounts, setCurrentPage, currency, refreshData } = useApp();

  const [formData, setFormData] = useState(() => ({
    type: 'expense' as 'expense' | 'income',
    amount: 0,
    accountId: accounts[0]?.id || 0,
    category: CATEGORIES['expense'][0],
    subcategory: '',
    description: '',
    merchant: '',
    date: new Date().toISOString().split('T')[0],
  }));
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [showScanner, setShowScanner] = useState(false);
  const [amountStr, setAmountStr] = useState('');

  /* ── pre-fill from localStorage ── */
  useEffect(() => {
    const rawFormType = localStorage.getItem('quickFormType');
    if (rawFormType === 'income' || rawFormType === 'expense') {
      setFormData(prev => ({
        ...prev,
        type: rawFormType as 'expense' | 'income',
        category: CATEGORIES[rawFormType as 'expense' | 'income'][0],
      }));
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
      const nextCategory = draft.category && categoryList.includes(draft.category)
        ? draft.category : categoryList[0];
      setFormData(prev => ({
        ...prev, type: nextType,
        amount: draft.amount ?? prev.amount,
        category: nextCategory,
        description: draft.description ?? prev.description,
        date: draft.date ?? prev.date,
      }));
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

  const handleAmountChange = (val: string) => {
    setAmountStr(val);
    setFormData(prev => ({ ...prev, amount: parseFloat(val) || 0 }));
  };

  const switchType = (t: 'expense' | 'income') => {
    setFormData(prev => ({ ...prev, type: t, category: CATEGORIES[t][0], subcategory: '' }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedAccount) { toast.error('Please select an account'); return; }
    if (!formData.amount || formData.amount <= 0) { toast.error('Enter a valid amount'); return; }
    setIsSubmitting(true);
    try {
      await saveTransactionWithBackendSync({
        ...formData,
        date: new Date(formData.date),
        tags: [],
      });
      const newBalance = isExpense
        ? selectedAccount.balance - formData.amount
        : selectedAccount.balance + formData.amount;
      await db.accounts.update(formData.accountId, { balance: newBalance, updatedAt: new Date() });
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
    ? { bg: 'from-rose-600 via-rose-500 to-pink-500', glow: 'shadow-rose-500/30', ring: 'ring-rose-400', pill: 'bg-rose-500 text-white', pillOff: 'text-rose-200 hover:bg-rose-500/20', btn: 'from-rose-500 to-pink-500 hover:from-rose-600 hover:to-pink-600 shadow-rose-300' }
    : { bg: 'from-emerald-600 via-emerald-500 to-teal-500', glow: 'shadow-emerald-500/30', ring: 'ring-emerald-400', pill: 'bg-emerald-500 text-white', pillOff: 'text-emerald-200 hover:bg-emerald-500/20', btn: 'from-emerald-500 to-teal-500 hover:from-emerald-600 hover:to-teal-600 shadow-emerald-300' };

  const formEl = (
    <form onSubmit={handleSubmit} className="flex flex-col flex-1">
      {/* ── Immersive Header ── */}
      <div className={cn('relative bg-gradient-to-br', accent.bg, 'px-5 pt-5 pb-8 overflow-hidden')}>
        {/* Decorative circles */}
        <div className="absolute -top-12 -right-12 w-44 h-44 rounded-full bg-white/10 blur-2xl pointer-events-none" />
        <div className="absolute -bottom-6 -left-8 w-36 h-36 rounded-full bg-black/10 blur-2xl pointer-events-none" />

        {/* Top bar */}
        <div className="relative flex items-center gap-3 mb-6">
          <button
            type="button"
            onClick={() => setCurrentPage('transactions')}
            className="w-9 h-9 rounded-xl flex items-center justify-center bg-white/15 hover:bg-white/25 backdrop-blur-sm transition-colors"
          >
            <ChevronLeft size={20} className="text-white" />
          </button>
          <div className="flex-1">
            <h1 className="text-white font-display font-bold text-lg leading-tight">Add Transaction</h1>
            <p className="text-white/60 text-xs">Record a new {formData.type}</p>
          </div>
          {/* Scan / Upload quick actions */}
          <button type="button" onClick={() => setShowScanner(true)}
            className="w-9 h-9 rounded-xl flex items-center justify-center bg-white/15 hover:bg-white/25 backdrop-blur-sm transition-colors" title="Scan receipt">
            <Camera size={17} className="text-white" />
          </button>
          <button type="button" onClick={() => setShowScanner(true)}
            className="w-9 h-9 rounded-xl flex items-center justify-center bg-white/15 hover:bg-white/25 backdrop-blur-sm transition-colors" title="Upload bill">
            <Upload size={17} className="text-white" />
          </button>
        </div>

        {/* Type switcher pill */}
        <div className="relative flex bg-black/20 rounded-2xl p-1 mb-5 backdrop-blur-sm">
          <button type="button" onClick={() => switchType('expense')}
            className={cn('flex-1 flex items-center justify-center gap-2 py-2.5 rounded-xl text-sm font-bold transition-all', isExpense ? 'bg-white text-rose-600 shadow-sm' : 'text-white/70 hover:text-white')}>
            <ArrowDownLeft size={16} /><span>Expense</span>
          </button>
          <button type="button" onClick={() => switchType('income')}
            className={cn('flex-1 flex items-center justify-center gap-2 py-2.5 rounded-xl text-sm font-bold transition-all', !isExpense ? 'bg-white text-emerald-600 shadow-sm' : 'text-white/70 hover:text-white')}>
            <ArrowUpRight size={16} /><span>Income</span>
          </button>
        </div>

        {/* Amount hero */}
        <div className="relative">
          <p className="text-white/60 text-xs font-bold uppercase tracking-widest mb-1">Amount</p>
          <div className="flex items-center gap-2">
            <span className="text-white/70 text-2xl font-bold shrink-0">{currency}</span>
            <input
              type="number"
              step="0.01"
              min="0"
              value={amountStr}
              onChange={e => handleAmountChange(e.target.value)}
              className="flex-1 bg-transparent text-white text-4xl sm:text-5xl font-display font-bold focus:outline-none placeholder:text-white/30 w-full"
              placeholder="0.00"
              required
              autoFocus
            />
          </div>
          {selectedAccount && (
            <p className="text-white/50 text-xs mt-1.5">
              {selectedAccount.name} &middot; Balance: {currency} {selectedAccount.balance.toFixed(2)}
            </p>
          )}
        </div>
      </div>

      {/* ── Form Fields Card ── */}
      <div className="flex-1 bg-white -mt-4 rounded-t-3xl shadow-xl divide-y divide-gray-100 overflow-hidden">
        {/* Account */}
        <FieldRow icon={<Wallet size={16} className="text-gray-500" />} label="Account">
          <select
            value={formData.accountId}
            onChange={e => setFormData(p => ({ ...p, accountId: parseInt(e.target.value) }))}
            className="w-full bg-transparent text-sm font-semibold text-gray-900 focus:outline-none appearance-none"
            required title="Select account"
          >
            <option value="">Select an account</option>
            {accounts.map(a => (
              <option key={a.id} value={a.id}>{a.name} ({currency} {a.balance.toFixed(2)})</option>
            ))}
          </select>
        </FieldRow>

        {/* Category */}
        <FieldRow icon={<Tag size={16} className="text-gray-500" />} label="Category">
          <CategoryDropdown
            value={formData.category}
            onChange={v => setFormData(p => ({ ...p, category: v, subcategory: '' }))}
            options={CATEGORIES[formData.type]}
            label=""
            required
          />
        </FieldRow>

        {/* Subcategory */}
        <AnimatePresence>
          {subcategories.length > 0 && (
            <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: 'auto', opacity: 1 }} exit={{ height: 0, opacity: 0 }} className="overflow-hidden">
              <FieldRow icon={<Sparkles size={16} className="text-gray-500" />} label="Subcategory">
                <select
                  value={formData.subcategory}
                  onChange={e => setFormData(p => ({ ...p, subcategory: e.target.value }))}
                  className="w-full bg-transparent text-sm font-medium text-gray-900 focus:outline-none appearance-none"
                  title="Select subcategory"
                >
                  <option value="">Select a subcategory</option>
                  {subcategories.map(s => <option key={s} value={s}>{s}</option>)}
                </select>
              </FieldRow>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Note */}
        <FieldRow icon={<AlignLeft size={16} className="text-gray-500" />} label="Note">
          <input
            type="text"
            value={formData.description}
            onChange={e => setFormData(p => ({ ...p, description: e.target.value }))}
            className="w-full bg-transparent text-sm text-gray-900 focus:outline-none placeholder:text-gray-300"
            placeholder="e.g., Grocery shopping"
          />
        </FieldRow>

        {/* Merchant */}
        <FieldRow icon={<Store size={16} className="text-gray-500" />} label="Merchant">
          <input
            type="text"
            value={formData.merchant}
            onChange={e => setFormData(p => ({ ...p, merchant: e.target.value }))}
            className="w-full bg-transparent text-sm text-gray-900 focus:outline-none placeholder:text-gray-300"
            placeholder="e.g., Amazon, Swiggy"
          />
        </FieldRow>

        {/* Date */}
        <FieldRow icon={<CalendarDays size={16} className="text-gray-500" />} label="Date">
          <input
            type="date"
            value={formData.date}
            onChange={e => setFormData(p => ({ ...p, date: e.target.value }))}
            className="w-full bg-transparent text-sm font-semibold text-gray-900 focus:outline-none"
            required title="Select date"
          />
        </FieldRow>

        {/* Scan / Upload — prominent row */}
        <div className="px-5 py-4 grid grid-cols-2 gap-3">
          <button type="button" onClick={() => setShowScanner(true)}
            className="flex items-center gap-2.5 px-4 py-3 rounded-2xl bg-gray-50 border border-gray-200 text-sm font-semibold text-gray-700 hover:bg-gray-100 transition-all hover:scale-[1.02] active:scale-[0.97]">
            <div className="w-7 h-7 rounded-lg bg-black flex items-center justify-center shrink-0">
              <Camera size={14} className="text-white" />
            </div>
            <div className="text-left">
              <p className="text-xs font-bold text-gray-800">Scan Bill</p>
              <p className="text-[10px] text-gray-400">Camera</p>
            </div>
          </button>
          <button type="button" onClick={() => setShowScanner(true)}
            className="flex items-center gap-2.5 px-4 py-3 rounded-2xl bg-gray-50 border border-gray-200 text-sm font-semibold text-gray-700 hover:bg-gray-100 transition-all hover:scale-[1.02] active:scale-[0.97]">
            <div className="w-7 h-7 rounded-lg bg-gray-700 flex items-center justify-center shrink-0">
              <Upload size={14} className="text-white" />
            </div>
            <div className="text-left">
              <p className="text-xs font-bold text-gray-800">Upload Bill</p>
              <p className="text-[10px] text-gray-400">From device</p>
            </div>
          </button>
        </div>
      </div>

      {/* ── Fixed Bottom Bar ── */}
      <div className="bg-white border-t border-gray-100 px-5 py-4 flex gap-3 shrink-0">
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
      <div className="hidden lg:flex items-start justify-center min-h-screen bg-gray-100 py-10 px-4">
        <div className="w-full max-w-[900px] flex gap-6 items-start">

          {/* Main form */}
          <motion.div
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            className="flex-1 rounded-3xl overflow-hidden shadow-2xl flex flex-col bg-white"
            style={{ minHeight: 680 }}
          >
            {formEl}
          </motion.div>

          {/* Sidebar */}
          <motion.div
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: 0.1 }}
            className="w-72 shrink-0 flex flex-col gap-4"
          >
            {/* Summary */}
            <div className={cn('rounded-2xl overflow-hidden shadow-lg', `bg-gradient-to-br ${accent.bg}`)}>
              <div className="p-5">
                <div className="flex items-center gap-2 mb-4">
                  <div className="w-6 h-6 rounded-lg bg-white/20 flex items-center justify-center">
                    <CheckCircle2 size={13} className="text-white" />
                  </div>
                  <p className="text-white/80 text-xs font-bold uppercase tracking-widest">Summary</p>
                </div>
                <div className="space-y-3">
                  {[
                    { label: 'Type', value: formData.type.charAt(0).toUpperCase() + formData.type.slice(1) },
                    { label: 'Amount', value: `${currency} ${formData.amount.toFixed(2)}` },
                    { label: 'Account', value: selectedAccount?.name || '—' },
                    { label: 'Category', value: formData.category },
                    { label: 'Date', value: new Date(formData.date + 'T00:00:00').toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' }) },
                  ].map(({ label, value }) => (
                    <div key={label} className="flex justify-between items-center">
                      <span className="text-white/60 text-xs font-medium">{label}</span>
                      <span className="text-white text-xs font-bold truncate ml-3 max-w-[130px] text-right">{value}</span>
                    </div>
                  ))}
                </div>
              </div>
            </div>

            {/* Tips */}
            <div className="bg-white rounded-2xl border border-gray-200 shadow-sm p-4">
              <p className="text-xs font-bold text-gray-400 uppercase tracking-widest mb-3">Auto-fill from receipt</p>
              <div className="space-y-2">
                <button type="button" onClick={() => setShowScanner(true)}
                  className="w-full flex items-center gap-3 p-3 rounded-xl hover:bg-gray-50 border border-gray-100 transition-all group">
                  <div className="w-9 h-9 rounded-xl bg-black flex items-center justify-center shrink-0 group-hover:scale-105 transition-transform">
                    <Camera size={16} className="text-white" />
                  </div>
                  <div className="text-left">
                    <p className="text-sm font-bold text-gray-800">Scan Bill</p>
                    <p className="text-xs text-gray-400">Use your camera</p>
                  </div>
                </button>
                <button type="button" onClick={() => setShowScanner(true)}
                  className="w-full flex items-center gap-3 p-3 rounded-xl hover:bg-gray-50 border border-gray-100 transition-all group">
                  <div className="w-9 h-9 rounded-xl bg-gray-800 flex items-center justify-center shrink-0 group-hover:scale-105 transition-transform">
                    <Upload size={16} className="text-white" />
                  </div>
                  <div className="text-left">
                    <p className="text-sm font-bold text-gray-800">Upload Bill</p>
                    <p className="text-xs text-gray-400">Pick from device</p>
                  </div>
                </button>
              </div>
            </div>

            <p className="text-center text-xs text-gray-400 px-2">
              Tip: Use <strong>Scan Bill</strong> to auto-fill amount, merchant & date from a photo of your receipt.
            </p>
          </motion.div>
        </div>
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
