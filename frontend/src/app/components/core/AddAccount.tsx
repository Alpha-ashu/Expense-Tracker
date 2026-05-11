
import React, { useState, useEffect, useMemo } from 'react';
import { useApp } from '@/contexts/AppContext';
import { saveAccountWithBackendSync } from '@/lib/auth-sync-integration';
import { Wallet, Landmark, CreditCard, Banknote, Smartphone, Check, ArrowLeft, Globe2, Loader2, Info } from 'lucide-react';
import { toast } from 'sonner';
import { SearchableDropdown } from '@/app/components/ui/SearchableDropdown';
import { cn } from '@/lib/utils';

import '@/styles/premium-transactions.css';

// --- Constants ---
const accountTypes = [
  { id: 'bank', label: 'Bank', icon: Landmark },
  { id: 'card', label: 'Credit Card', icon: CreditCard },
  { id: 'cash', label: 'Cash', icon: Banknote },
  { id: 'wallet', label: 'Wallet', icon: Smartphone },
];

const QUICK_BALANCE_PRESETS = [0, 1000, 5000, 10000];

export const AddAccount: React.FC = () => {
  const { setCurrentPage, currency, refreshData, accounts } = useApp();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [formData, setFormData] = useState({
    name: '',
    type: 'bank' as 'bank' | 'card' | 'cash' | 'wallet',
    balance: '',
  });
  const [provider, setProvider] = useState('');
  const [userCountry, setUserCountry] = useState('Default');

  // Logic from original file for country detection
  useEffect(() => {
    let resolved = 'Default';
    try {
      const profile = JSON.parse(localStorage.getItem('user_profile') || '{}');
      resolved = profile?.country || 'Default';
    } catch {}
    setUserCountry(resolved);
  }, []);

  const handleSubmit = async () => {
    const resolvedName = formData.name.trim() || (formData.type === 'cash' ? 'Cash Wallet' : provider);
    if (!resolvedName) { toast.error('Enter an account name'); return; }
    
    setIsSubmitting(true);
    try {
      await saveAccountWithBackendSync({
        name: resolvedName,
        type: formData.type,
        provider: provider || null,
        country: userCountry === 'Default' ? null : userCountry,
        balance: parseFloat(formData.balance) || 0,
        currency,
        isActive: true,
        updatedAt: new Date(),
      });
      toast.success('Account created');
      refreshData();
      setCurrentPage('accounts');
    } catch (e) {
      toast.error('Failed to create account');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="flex flex-col h-auto lg:h-screen bg-[#F8FAFC] lg:overflow-hidden">

      {/* Header */}
      <header className="flex items-center justify-between px-4 lg:px-6 py-4 bg-white border-b border-slate-100">
        <div className="flex items-center gap-3">
          <button onClick={() => setCurrentPage('accounts')} className="lg:hidden p-2 text-slate-600 hover:bg-slate-50 rounded-xl transition-all">
            <ArrowLeft size={20} />
          </button>
          <h1 className="text-xl font-black text-slate-900 tracking-tight leading-none">New Account</h1>
        </div>
        <div className="flex items-center gap-3">
          <button 
            onClick={handleSubmit}
            disabled={isSubmitting}
            className="bg-indigo-600 text-white px-6 py-2.5 rounded-xl font-black text-[10px] uppercase tracking-widest shadow-lg shadow-indigo-100 hover:bg-indigo-700 active:scale-95 transition-all flex items-center gap-2 disabled:opacity-50"
          >
            {isSubmitting ? <Loader2 className="animate-spin" size={14} /> : <Check size={14} />}
            Create Account
          </button>
        </div>
      </header>

      {/* Main Single-Page Content Area */}
      <main className="flex-1 p-3 lg:p-5 grid grid-cols-1 lg:grid-cols-12 gap-3 lg:gap-5 lg:overflow-hidden lg:overflow-y-auto pb-32 lg:pb-5">
        
        {/* Left Column: context (lg:col-7) */}
        <div className="lg:col-span-7 flex flex-col gap-3 lg:overflow-y-auto">
          <div className="premium-glass-card p-4 space-y-4">
            <div className="space-y-2">
              <label className="text-[8px] font-black text-slate-400 uppercase tracking-widest">1. Asset Type</label>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                {accountTypes.map(t => (
                  <button key={t.id} onClick={() => setFormData(prev => ({ ...prev, type: t.id as any }))} className={cn("flex flex-col items-center gap-2 p-3 rounded-xl transition-all", formData.type === t.id ? "bg-indigo-600 text-white shadow-lg shadow-indigo-100" : "bg-slate-50 text-slate-400 hover:bg-slate-100")}>
                    <t.icon size={20} />
                    <span className="text-[9px] font-black uppercase">{t.label}</span>
                  </button>
                ))}
              </div>
            </div>

            <div className="space-y-4 pt-2">
              <div className="space-y-1">
                <label className="text-[8px] font-black text-slate-400 uppercase tracking-widest">2. Institution / Provider</label>
                <div className="relative">
                   <Landmark className="absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-300" size={14} />
                   <input type="text" value={provider} onChange={e => setProvider(e.target.value)} className="w-full bg-slate-50 border-none rounded-xl py-2.5 pl-9 pr-3 font-bold text-slate-900 text-xs" placeholder="Bank or Wallet Name" />
                </div>
              </div>

              <div className="space-y-1">
                <label className="text-[8px] font-black text-slate-400 uppercase tracking-widest">3. Custom Label (Optional)</label>
                <div className="relative">
                   <Wallet className="absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-300" size={14} />
                   <input type="text" value={formData.name} onChange={e => setFormData(prev => ({ ...prev, name: e.target.value }))} className="w-full bg-slate-50 border-none rounded-xl py-2.5 pl-9 pr-3 font-bold text-slate-900 text-xs" placeholder="e.g. My Savings" />
                </div>
              </div>
            </div>
          </div>
          
          <div className="p-4 bg-slate-900 rounded-2xl text-white flex items-center gap-3">
             <div className="w-8 h-8 rounded-lg bg-white/10 flex items-center justify-center shrink-0"><Globe2 size={16} className="text-indigo-400" /></div>
             <div>
                <p className="text-[8px] font-black text-white/40 uppercase tracking-widest">Security Note</p>
                <p className="text-[10px] font-bold">This account is encrypted locally using AES-256 before syncing.</p>
             </div>
          </div>
        </div>

        {/* Right Column: Financials (lg:col-5) */}
        <div className="lg:col-span-5 flex flex-col gap-3 lg:overflow-y-auto">
          
          {/* Balance Input Card */}
          <div className="premium-glass-card p-6 bg-white relative overflow-hidden flex flex-col items-center">
             <div className="absolute -top-10 -right-10 w-32 h-32 bg-indigo-500/5 blur-[40px] rounded-full" />
             <span className="text-[9px] font-black text-slate-300 uppercase tracking-[0.2em] mb-2">Opening Balance</span>
             <div className="flex items-center gap-3">
                <span className="text-3xl font-black text-slate-200 uppercase">{currency}</span>
                <input 
                  type="number" 
                  value={formData.balance} 
                  onChange={e => setFormData(prev => ({ ...prev, balance: e.target.value }))}
                  className="bg-transparent text-5xl font-black text-slate-900 outline-none w-[180px] text-center tracking-tighter" 
                  placeholder="0"
                  autoFocus
                />
             </div>
             <div className="flex gap-1.5 mt-4">
                {QUICK_BALANCE_PRESETS.filter(p => p > 0).map(amt => (
                  <button key={amt} onClick={() => setFormData(prev => ({ ...prev, balance: String(amt) }))} className="px-3 py-1.5 bg-slate-50 border border-slate-100 rounded-lg text-[10px] font-black text-slate-500 hover:bg-white hover:shadow-sm transition-all">+{amt.toLocaleString()}</button>
                ))}
             </div>
          </div>

          {/* Large Preview Card */}
          <div className="premium-glass-card p-6 bg-indigo-900 text-white relative overflow-hidden flex flex-col justify-between min-h-[160px] shadow-xl shadow-indigo-100">
             <div className="absolute -top-10 -right-10 w-32 h-32 bg-white/10 blur-[40px] rounded-full" />
             <div className="flex justify-between items-start">
                <div className="w-10 h-10 rounded-xl bg-white/10 flex items-center justify-center">
                   {React.createElement(accountTypes.find(t => t.id === formData.type)?.icon || Wallet, { size: 20 })}
                </div>
                <div className="text-[8px] font-black uppercase tracking-[0.2em] opacity-40">Virtual Card</div>
             </div>
             
             <div className="space-y-1">
                <p className="text-[10px] font-black uppercase tracking-widest opacity-60 truncate">{formData.name || provider || 'New Account'}</p>
                <div className="flex items-baseline gap-2">
                   <span className="text-sm font-black opacity-30">{currency}</span>
                   <span className="text-3xl font-black tracking-tighter">{Number(formData.balance || 0).toLocaleString()}</span>
                </div>
             </div>
          </div>

          <div className="mt-auto p-4 bg-slate-100 rounded-2xl flex items-center justify-between">
             <div className="flex items-center gap-3">
                <div className="w-8 h-8 rounded-lg bg-white flex items-center justify-center border border-slate-200"><Info size={16} className="text-slate-400" /></div>
                <div>
                  <p className="text-[8px] font-black text-slate-400 uppercase">Verification</p>
                  <p className="text-[10px] font-black text-slate-600">Manual tracking only</p>
                </div>
             </div>
             <div className="text-right">
                <p className="text-[8px] font-black text-slate-400 uppercase">Region</p>
                <p className="text-[10px] font-black text-slate-600">{userCountry}</p>
             </div>
          </div>
        </div>
      </main>
    </div>
  );
};
