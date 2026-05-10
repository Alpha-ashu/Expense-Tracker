import React, { useEffect, useState } from 'react';
import { useApp } from '@/contexts/AppContext';
import { db } from '@/lib/database';
import { saveTransactionWithBackendSync } from '@/lib/auth-sync-integration';
import { useLiveQuery } from 'dexie-react-hooks';
import { toast } from 'sonner';
import {
  ArrowRightLeft, ArrowRight, ShieldCheck, Loader2,
  ArrowDownLeft, ArrowUpRight, Check, Zap,
  CreditCard, Banknote, Smartphone, Wallet,
} from 'lucide-react';
import type { Account } from '@/lib/database';
import { cn } from '@/lib/utils';
import { motion } from 'framer-motion';
import { SearchableDropdown } from '@/app/components/ui/SearchableDropdown';

const accountTypeMeta: Record<string, { icon: React.FC<{ size?: number; className?: string }>; shell: string }> = {
  bank:    { icon: CreditCard,  shell: 'bg-blue-50 text-blue-600' },
  cash:    { icon: Banknote,    shell: 'bg-emerald-50 text-emerald-600' },
  wallet:  { icon: Wallet,      shell: 'bg-violet-50 text-violet-600' },
  upi:     { icon: Smartphone,  shell: 'bg-orange-50 text-orange-600' },
  credit:  { icon: CreditCard,  shell: 'bg-rose-50 text-rose-600' },
};

export const Transfer: React.FC<{ onBack?: () => void }> = ({ onBack }) => {
  const { currency, setCurrentPage, refreshData } = useApp();
  const [formData, setFormData] = useState({
    fromAccountId: 0,
    toAccountId: 0,
    amount: '',
    description: '',
    transferType: 'self-transfer' as const,
  });
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});

  useEffect(() => {
    const raw = localStorage.getItem('voiceTransferDraft');
    if (!raw) return;
    try {
      const draft = JSON.parse(raw) as { amount?: number; description?: string };
      setFormData((p) => ({
        ...p,
        amount: draft.amount ? String(draft.amount) : p.amount,
        description: draft.description ?? p.description,
      }));
    } catch { /* ignore */ } finally {
      localStorage.removeItem('voiceTransferDraft');
    }
  }, []);

  const accounts = useLiveQuery(() => db.accounts.toArray(), []) || [];
  const activeAccounts = accounts.filter((a) => a.isActive);
  const fromAcc = activeAccounts.find((a) => a.id === formData.fromAccountId);
  const toAcc   = activeAccounts.find((a) => a.id === formData.toAccountId);
  const amountNum = parseFloat(formData.amount) || 0;

  const fmt = (v: number) =>
    new Intl.NumberFormat('en-IN', { style: 'currency', currency, maximumFractionDigits: 2 }).format(v);

  const validate = () => {
    const e: Record<string, string> = {};
    if (!formData.fromAccountId) e.from = 'Select a source account';
    if (!formData.toAccountId)   e.to   = 'Select a destination account';
    if (formData.fromAccountId && formData.fromAccountId === formData.toAccountId)
      e.to = 'Cannot transfer to the same account';
    if (!amountNum || amountNum <= 0) e.amount = 'Enter a valid amount';
    if (fromAcc && amountNum > fromAcc.balance)
      e.amount = `Insufficient balance (${fmt(fromAcc.balance)} available)`;
    setErrors(e);
    return Object.keys(e).length === 0;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!validate()) return;
    setIsSubmitting(true);
    try {
      const fromAccount = await db.accounts.get(formData.fromAccountId);
      const toAccount   = await db.accounts.get(formData.toAccountId);
      if (!fromAccount || !toAccount) { toast.error('Account not found'); return; }

      await saveTransactionWithBackendSync({
        type: 'transfer',
        amount: amountNum,
        accountId: formData.fromAccountId,
        category: 'Transfer',
        subcategory: 'Transfer',
        description: formData.description || `Transfer to ${toAccount.name}`,
        date: new Date(),
        transferToAccountId: formData.toAccountId,
        transferType: formData.transferType,
        updatedAt: new Date(),
      });

      await db.accounts.update(formData.fromAccountId, { balance: fromAccount.balance - amountNum, updatedAt: new Date() });
      await db.accounts.update(formData.toAccountId,   { balance: toAccount.balance   + amountNum, updatedAt: new Date() });

      toast.success(`Transferred ${fmt(amountNum)} from ${fromAccount.name} to ${toAccount.name}`);
      refreshData();
      setFormData({ fromAccountId: 0, toAccountId: 0, amount: '', description: '', transferType: 'self-transfer' });
      setCurrentPage('accounts');
    } catch (err) {
      console.error('Transfer failed:', err);
      toast.error('Transfer failed. Please try again.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleBack = () => { if (onBack) onBack(); else setCurrentPage('accounts'); };

  /*  Shared inner form content  */
  const TypeSwitcher = () => (
    <div className="flex items-center gap-1 bg-gray-100 rounded-xl p-1 w-fit">
      <button type="button"
        onClick={() => { localStorage.setItem('quickFormType', 'expense'); setCurrentPage('add-transaction'); }}
        className="px-4 py-1.5 rounded-lg text-sm font-bold text-gray-500 hover:text-gray-700 hover:bg-white/70 transition-all flex items-center gap-1.5">
        <ArrowDownLeft size={14} /> Expense
      </button>
      <button type="button"
        onClick={() => { localStorage.setItem('quickFormType', 'income'); setCurrentPage('add-transaction'); }}
        className="px-4 py-1.5 rounded-lg text-sm font-bold text-gray-500 hover:text-gray-700 hover:bg-white/70 transition-all flex items-center gap-1.5">
        <ArrowUpRight size={14} /> Income
      </button>
      <button type="button"
        className="px-4 py-1.5 rounded-lg text-sm font-bold bg-white text-indigo-700 shadow-sm transition-all flex items-center gap-1.5">
        <ArrowRightLeft size={14} /> Transfer
      </button>
    </div>
  );

  const AccountPicker = ({
    label, fieldKey, exclude, errorKey,
  }: {
    label: string;
    fieldKey: 'fromAccountId' | 'toAccountId';
    exclude?: number;
    errorKey: string;
  }) => {
    const options = activeAccounts
      .filter((account) => account.id !== exclude)
      .map((account: Account) => {
        const meta = accountTypeMeta[account.type ?? 'bank'] ?? accountTypeMeta.bank;
        return {
          value: String(account.id),
          label: account.name,
          description: fmt(account.balance),
          icon: (
            <span className={cn('flex h-7 w-7 items-center justify-center rounded-lg', meta.shell)}>
              <meta.icon size={14} />
            </span>
          ),
          group: account.type ? `${account.type.charAt(0).toUpperCase()}${account.type.slice(1)} accounts` : 'Accounts',
        };
      });

    return (
      <SearchableDropdown
        label={label}
        options={options}
        value={formData[fieldKey] ? String(formData[fieldKey]) : ''}
        onChange={(accountId) => {
          const nextId = parseInt(accountId, 10) || 0;
          setFormData((p) => ({ ...p, [fieldKey]: nextId, ...(fieldKey === 'fromAccountId' ? { toAccountId: 0 } : {}) }));
          setErrors((p) => ({ ...p, [errorKey]: '' }));
        }}
        placeholder={options.length ? `Select ${label.toLowerCase()}` : 'No accounts available'}
        searchPlaceholder="Search accounts..."
        error={errors[errorKey]}
        grouped
      />
    );
  };

  /*  Mobile view  */
  const MobileView = () => (
    <div className="lg:hidden finora-screen-page finora-transfer-entry flex flex-col min-h-screen bg-white">
      
      <div className="flex items-center gap-3 px-4 pt-5 pb-3 border-b border-gray-100">
        <button type="button" onClick={handleBack}
          className="w-9 h-9 rounded-xl border border-gray-200 bg-white flex items-center justify-center text-gray-500 hover:bg-gray-50 shadow-sm transition-all">
          <ArrowDownLeft size={16} />
        </button>
        <div className="flex-1">
          <h1 className="text-lg font-black text-gray-900 leading-tight">Transfer Money</h1>
          <p className="text-xs text-gray-400">Move funds between accounts</p>
        </div>
        <button type="button" onClick={handleBack}
          className="px-3 py-1.5 rounded-xl border border-gray-200 text-xs font-semibold text-gray-600 hover:bg-gray-50">
          Cancel
        </button>
      </div>

      <form onSubmit={handleSubmit} className="flex-1 px-4 py-4 space-y-4 overflow-y-auto">
        {/* Tab Switcher */}
        <div className="flex rounded-2xl p-1 bg-indigo-50 border border-indigo-100">
          <button type="button"
            onClick={() => { localStorage.setItem('quickFormType', 'expense'); setCurrentPage('add-transaction'); }}
            className="flex flex-1 items-center justify-center gap-1 rounded-xl py-2.5 text-[13px] font-bold text-indigo-600/70 hover:bg-white hover:text-indigo-900 transition-all">
            <ArrowDownLeft size={14} /> Expense
          </button>
          <button type="button"
            onClick={() => { localStorage.setItem('quickFormType', 'income'); setCurrentPage('add-transaction'); }}
            className="flex flex-1 items-center justify-center gap-1 rounded-xl py-2.5 text-[13px] font-bold text-indigo-600/70 hover:bg-white hover:text-indigo-900 transition-all">
            <ArrowUpRight size={14} /> Income
          </button>
          <button type="button"
            className="flex flex-1 items-center justify-center gap-1 rounded-xl py-2.5 text-[13px] font-bold bg-white text-indigo-700 shadow-sm border border-indigo-100 transition-all">
            <ArrowRightLeft size={14} /> Transfer
          </button>
        </div>

        {/* Amount Card */}
        <div className="rounded-2xl px-5 py-4 flex items-center bg-gradient-to-r from-indigo-500 to-violet-600">
          <span className="text-xl font-black text-white/80 mr-3">{currency}</span>
          <input type="number" step="0.01" min="0" value={formData.amount}
            onChange={(e) => { setFormData((p) => ({ ...p, amount: e.target.value })); setErrors((p) => ({ ...p, amount: '' })); }}
            className="flex-1 bg-transparent text-4xl font-black text-white outline-none placeholder:text-white/40 w-full"
            placeholder="0.00" autoFocus />
        </div>
        {errors.amount && <p className="text-xs text-rose-600 font-medium">{errors.amount}</p>}
        {fromAcc && amountNum > 0 && amountNum <= fromAcc.balance && (
          <p className="text-xs text-gray-400">Remaining: {fmt(fromAcc.balance - amountNum)}</p>
        )}

        {/* Live preview bar */}
        {(fromAcc || toAcc) && (
          <div className="flex items-center gap-3 p-3 bg-indigo-50 rounded-xl border border-indigo-100">
            <div className="flex-1 min-w-0">
              <p className="text-[10px] font-bold uppercase tracking-widest text-indigo-400">From</p>
              <p className="text-sm font-bold text-indigo-900 truncate">{fromAcc?.name ?? '-'}</p>
            </div>
            <div className={cn('w-8 h-8 rounded-full flex items-center justify-center shadow-md shrink-0',
              amountNum > 0 ? 'bg-gradient-to-br from-indigo-500 to-violet-600' : 'bg-gray-200')}>
              <ArrowRight size={14} className={amountNum > 0 ? 'text-white' : 'text-gray-400'} />
            </div>
            <div className="flex-1 min-w-0 text-right">
              <p className="text-[10px] font-bold uppercase tracking-widest text-indigo-400">To</p>
              <p className="text-sm font-bold text-indigo-900 truncate">{toAcc?.name ?? '-'}</p>
            </div>
          </div>
        )}

        {/* From Account */}
        <AccountPicker label="From Account" fieldKey="fromAccountId" errorKey="from" />
        {/* To Account */}
        <AccountPicker label="To Account" fieldKey="toAccountId" exclude={formData.fromAccountId} errorKey="to" />

        {/* Description */}
        <div>
          <label className="block text-[11px] font-bold uppercase tracking-widest text-gray-400 mb-1.5">Note (optional)</label>
          <input type="text" value={formData.description}
            onChange={(e) => setFormData((p) => ({ ...p, description: e.target.value }))}
            className="w-full py-2.5 px-3 bg-gray-50 border border-gray-100 rounded-xl text-sm font-medium text-gray-900 focus:outline-none focus:ring-2 focus:ring-indigo-400/30 focus:bg-white transition-all"
            placeholder="Monthly savings, rent split..." />
        </div>

        {/* Notice */}
        <div className="flex items-start gap-2 rounded-xl bg-emerald-50 border border-emerald-100 px-3 py-2.5">
          <ShieldCheck size={14} className="text-emerald-600 mt-0.5 shrink-0" />
          <p className="text-xs text-emerald-700 font-medium">Both account balances update instantly.</p>
        </div>

        {/* Submit */}
        <motion.button type="submit" disabled={isSubmitting || !amountNum} whileTap={{ scale: 0.97 }}
          className="w-full py-3.5 rounded-xl font-black text-white text-base shadow-lg bg-gradient-to-r from-indigo-600 to-violet-600 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2 transition-all">
          {isSubmitting
            ? <><Loader2 size={16} className="animate-spin" /> Transferring...</>
            : <><Zap size={16} /> Complete Transfer</>}
        </motion.button>
      </form>
    </div>
  );

  /*  Desktop view  */
  const DesktopView = () => (
    <div className="hidden lg:flex finora-screen-page finora-transfer-entry min-h-screen flex-col bg-slate-50">
      <header className="bg-white border-b border-gray-100 px-4 lg:px-8 py-4 sticky top-0 z-10 shadow-sm flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-gray-900 tracking-tight">Transfer Money</h1>
          <p className="text-gray-400 text-xs mt-0.5">Move funds between your accounts</p>
        </div>
        <button type="button" onClick={handleBack}
          className="px-4 py-2 rounded-xl bg-white border border-gray-200 text-gray-600 text-sm font-semibold hover:bg-gray-50 shadow-sm transition-all">
          Cancel
        </button>
      </header>
      <div className="flex-1 w-full max-w-[800px] mx-auto px-6 py-6 overflow-y-auto">

        <form onSubmit={handleSubmit} className="grid grid-cols-12 gap-5">
          {/*  LEFT COLUMN  */}
          <div className="col-span-8 space-y-4">

            {/* Type + Amount */}
            <div className="bg-white rounded-2xl p-5 shadow-sm border border-gray-100">
              <TypeSwitcher />
              <div className="mt-4 rounded-2xl px-5 py-4 flex items-center bg-gradient-to-r from-indigo-500 to-violet-600">
                <span className="text-2xl font-black text-white/80 mr-3">{currency}</span>
                <input type="number" step="0.01" min="0" value={formData.amount}
                  onChange={(e) => { setFormData((p) => ({ ...p, amount: e.target.value })); setErrors((p) => ({ ...p, amount: '' })); }}
                  className="flex-1 bg-transparent text-4xl font-black text-white outline-none placeholder:text-white/40 w-full"
                  placeholder="0.00" autoFocus />
              </div>
              {errors.amount && <p className="mt-2 text-xs text-rose-600 font-medium">{errors.amount}</p>}
              {fromAcc && amountNum > 0 && amountNum <= fromAcc.balance && (
                <p className="mt-1 text-xs text-gray-400">Remaining balance: {fmt(fromAcc.balance - amountNum)}</p>
              )}
            </div>

            {/* Live Flow Preview */}
            <div className="bg-white rounded-2xl p-5 shadow-sm border border-gray-100">
              <h2 className="text-[11px] font-bold uppercase tracking-widest text-gray-400 mb-3">Transfer Preview</h2>
              <div className="flex items-center gap-4 p-4 bg-gradient-to-r from-indigo-50/60 to-violet-50/60 rounded-xl border border-indigo-100">
                <div className="flex-1 min-w-0">
                  <p className="text-[10px] font-bold uppercase tracking-widest text-indigo-400 mb-0.5">From</p>
                  <p className="font-bold text-gray-900 truncate">{fromAcc?.name ?? <span className="text-gray-400 italic font-normal">Not selected</span>}</p>
                  {fromAcc && <p className="text-xs text-indigo-600 font-semibold mt-0.5">{fmt(fromAcc.balance)}</p>}
                </div>
                <div className="flex flex-col items-center gap-1 shrink-0">
                  <div className={cn('w-10 h-10 rounded-full flex items-center justify-center shadow-md transition-all',
                    amountNum > 0 ? 'bg-gradient-to-br from-indigo-500 to-violet-600' : 'bg-gray-200')}>
                    <ArrowRight size={16} className={amountNum > 0 ? 'text-white' : 'text-gray-400'} />
                  </div>
                  {amountNum > 0 && <span className="text-[11px] font-bold text-indigo-600">{fmt(amountNum)}</span>}
                </div>
                <div className="flex-1 min-w-0 text-right">
                  <p className="text-[10px] font-bold uppercase tracking-widest text-indigo-400 mb-0.5">To</p>
                  <p className="font-bold text-gray-900 truncate">{toAcc?.name ?? <span className="text-gray-400 italic font-normal">Not selected</span>}</p>
                  {toAcc && <p className="text-xs text-indigo-600 font-semibold mt-0.5">{fmt(toAcc.balance)}</p>}
                </div>
              </div>
            </div>

            {/* Description + Notice */}
            <div className="bg-white rounded-2xl p-5 shadow-sm border border-gray-100 space-y-4">
              <div>
                <label className="block text-[11px] font-bold uppercase tracking-widest text-gray-400 mb-1.5">Note (optional)</label>
                <input type="text" value={formData.description}
                  onChange={(e) => setFormData((p) => ({ ...p, description: e.target.value }))}
                  className="w-full py-2.5 px-3 bg-gray-50 border border-gray-100 rounded-xl text-sm font-medium text-gray-900 focus:outline-none focus:ring-2 focus:ring-indigo-400/30 focus:bg-white transition-all"
                  placeholder="Monthly savings, rent split..." />
              </div>
              <div className="flex items-start gap-2 rounded-xl bg-emerald-50 border border-emerald-100 px-3 py-2.5">
                <ShieldCheck size={14} className="text-emerald-600 mt-0.5 shrink-0" />
                <p className="text-xs text-emerald-700 font-medium">
                  Transfers update both account balances instantly and keep one authoritative record.
                </p>
              </div>
            </div>
          </div>

          {/*  RIGHT COLUMN  */}
          <div className="col-span-4 space-y-4">

            {/* From Account */}
            <div className="bg-white rounded-2xl p-4 shadow-sm border border-gray-100">
              <AccountPicker label="From Account" fieldKey="fromAccountId" errorKey="from" />
            </div>

            {/* To Account */}
            <div className="bg-white rounded-2xl p-4 shadow-sm border border-gray-100">
              <AccountPicker label="To Account" fieldKey="toAccountId" exclude={formData.fromAccountId} errorKey="to" />
            </div>

            {/* Submit Card */}
            <div className="bg-white rounded-2xl p-4 shadow-sm border border-gray-100 sticky top-6">
              <p className="text-gray-400 text-[11px] font-bold uppercase tracking-widest mb-1">Transfer Amount</p>
              <p className="text-3xl font-black bg-clip-text text-transparent bg-gradient-to-r from-indigo-500 to-violet-600 mb-4">
                {currency}{amountNum > 0 ? amountNum.toFixed(2) : '0.00'}
              </p>
              <motion.button type="submit" disabled={isSubmitting || !amountNum} whileTap={{ scale: 0.97 }}
                className="w-full py-3.5 rounded-xl font-black text-white text-base shadow-lg bg-gradient-to-r from-indigo-600 to-violet-600 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2 transition-all">
                {isSubmitting
                  ? <><span className="w-4 h-4 border-2 border-white/40 border-t-white rounded-full animate-spin" /> Transferring...</>
                  : <><Zap size={16} /> Complete Transfer</>}
              </motion.button>
            </div>
          </div>
        </form>
      </div>
    </div>
  );

  const [isDesktop, setIsDesktop] = useState(false);

  useEffect(() => {
    const mediaQuery = window.matchMedia('(min-width: 1024px)');
    setIsDesktop(mediaQuery.matches);
    const handler = (e: MediaQueryListEvent) => setIsDesktop(e.matches);
    if (mediaQuery.addEventListener) {
      mediaQuery.addEventListener('change', handler);
      return () => mediaQuery.removeEventListener('change', handler);
    } else {
      mediaQuery.addListener(handler);
      return () => mediaQuery.removeListener(handler);
    }
  }, []);

  return (
    <>
      {isDesktop ? <DesktopView /> : <MobileView />}
    </>
  );
};
