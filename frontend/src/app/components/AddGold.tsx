import React, { useState } from 'react';
import { useApp } from '@/contexts/AppContext';
import { db } from '@/lib/database';
import { backendService } from '@/lib/backend-api';
import { CenteredLayout } from '@/app/components/CenteredLayout';
import { PageHeader } from '@/app/components/ui/PageHeader';
import { ChevronLeft, Loader2, TrendingUp, TrendingDown, Sparkles } from 'lucide-react';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';

const GOLD_TYPES = [
  { id: 'gold', label: 'Pure Gold' },
  { id: 'jewelry', label: 'Jewelry' },
  { id: 'coin', label: 'Gold Coin' },
] as const;

const PURITY_PRESETS = [
  { label: '24K', value: 99.9 },
  { label: '22K', value: 91.67 },
  { label: '18K', value: 75 },
  { label: '14K', value: 58.5 },
];

export const AddGold: React.FC = () => {
  const { setCurrentPage, currency, refreshData } = useApp();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [formData, setFormData] = useState({
    type: 'gold' as 'gold' | 'jewelry' | 'coin',
    quantity: 0,
    unit: 'gram' as 'gram' | 'ounce' | 'kg',
    purchasePrice: 0,
    currentPrice: 0,
    purchaseDate: new Date().toISOString().split('T')[0],
    purityPercentage: 99.9,
    location: 'safe-deposit-box',
    certificateNumber: '',
    notes: '',
  });

  const totalValue = formData.quantity * formData.currentPrice;
  const totalInvestment = formData.quantity * formData.purchasePrice;
  const gainLoss = totalValue - totalInvestment;
  const gainPct = totalInvestment > 0 ? (gainLoss / totalInvestment) * 100 : 0;
  const hasGain = gainLoss >= 0;
  const fmt = (v: number) => new Intl.NumberFormat('en-IN', { style: 'currency', currency, maximumFractionDigits: 2 }).format(v);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (formData.quantity <= 0) { toast.error('Quantity must be greater than 0'); return; }
    if (formData.purchasePrice <= 0) { toast.error('Purchase price must be greater than 0'); return; }
    setIsSubmitting(true);
    try {
      await backendService.createGold({
        ...formData,
        purchaseDate: new Date(formData.purchaseDate),
        createdAt: new Date(),
        updatedAt: new Date(),
      });
      toast.success(`Gold entry added! Current value: ${fmt(totalValue)}`);
      refreshData();
      setCurrentPage('investments');
    } catch (error) {
      console.error('Failed to add gold entry:', error);
      toast.error('Failed to add gold entry');
    } finally {
      setIsSubmitting(false);
    }
  };

  /*  Mobile Form  */
  const mobileForm = (
    <form onSubmit={handleSubmit} className="space-y-5">
      <div>
        <label className="block text-sm font-semibold text-gray-700 mb-2">Gold Type *</label>
        <select value={formData.type} onChange={(e) => setFormData({ ...formData, type: e.target.value as any })}
          className="w-full px-4 py-3 border border-gray-200 rounded-xl bg-gray-50 text-sm font-semibold focus:outline-none focus:ring-2 focus:ring-amber-500">
          {GOLD_TYPES.map(t => <option key={t.id} value={t.id}>{t.label}</option>)}
        </select>
      </div>
      <div className="grid grid-cols-2 gap-4">
        <div>
          <label className="block text-sm font-semibold text-gray-700 mb-2">Quantity *</label>
          <input type="number" step="0.01" min="0" value={formData.quantity || ''} onChange={(e) => setFormData({ ...formData, quantity: parseFloat(e.target.value) || 0 })}
            className="w-full px-4 py-3 border border-gray-200 rounded-xl bg-gray-50 text-sm font-semibold focus:outline-none focus:ring-2 focus:ring-amber-500" placeholder="0.00" required />
        </div>
        <div>
          <label className="block text-sm font-semibold text-gray-700 mb-2">Unit</label>
          <select value={formData.unit} onChange={(e) => setFormData({ ...formData, unit: e.target.value as any })}
            className="w-full px-4 py-3 border border-gray-200 rounded-xl bg-gray-50 text-sm font-semibold focus:outline-none focus:ring-2 focus:ring-amber-500">
            <option value="gram">Gram</option><option value="ounce">Ounce</option><option value="kg">Kilogram</option>
          </select>
        </div>
      </div>
      <div className="grid grid-cols-2 gap-4">
        <div>
          <label className="block text-sm font-semibold text-gray-700 mb-2">Buy Price / {formData.unit} *</label>
          <div className="flex items-center gap-2 border border-gray-200 rounded-xl bg-gray-50 px-3 py-3 focus-within:ring-2 focus-within:ring-amber-500">
            <span className="text-gray-500 text-sm font-bold">{currency}</span>
            <input type="number" step="0.01" min="0" value={formData.purchasePrice || ''} onChange={(e) => setFormData({ ...formData, purchasePrice: parseFloat(e.target.value) || 0 })}
              className="flex-1 bg-transparent text-sm font-semibold text-gray-900 focus:outline-none" placeholder="0.00" required />
          </div>
        </div>
        <div>
          <label className="block text-sm font-semibold text-gray-700 mb-2">Current Price / {formData.unit}</label>
          <div className="flex items-center gap-2 border border-gray-200 rounded-xl bg-gray-50 px-3 py-3 focus-within:ring-2 focus-within:ring-amber-500">
            <span className="text-gray-500 text-sm font-bold">{currency}</span>
            <input type="number" step="0.01" min="0" value={formData.currentPrice || ''} onChange={(e) => setFormData({ ...formData, currentPrice: parseFloat(e.target.value) || 0 })}
              className="flex-1 bg-transparent text-sm font-semibold text-gray-900 focus:outline-none" placeholder="0.00" />
          </div>
        </div>
      </div>
      <div>
        <label className="block text-sm font-semibold text-gray-700 mb-2">Purity</label>
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-2 border border-gray-200 rounded-xl bg-gray-50 px-3 py-3 focus-within:ring-2 focus-within:ring-amber-500 flex-1">
            <input type="number" step="0.1" min="0" max="100" value={formData.purityPercentage || ''} onChange={(e) => setFormData({ ...formData, purityPercentage: parseFloat(e.target.value) || 0 })}
              className="flex-1 bg-transparent text-sm font-semibold text-gray-900 focus:outline-none" placeholder="99.9" />
            <span className="text-sm font-bold text-gray-500">%</span>
          </div>
          <div className="flex gap-1.5">
            {PURITY_PRESETS.map(p => (
              <button key={p.label} type="button" onClick={() => setFormData({ ...formData, purityPercentage: p.value })}
                className={cn('px-2 py-1.5 rounded-lg text-xs font-bold transition-all', formData.purityPercentage === p.value ? 'bg-amber-500 text-white' : 'bg-gray-100 text-gray-600 hover:bg-gray-200')}>
                {p.label}
              </button>
            ))}
          </div>
        </div>
      </div>
      <div className="grid grid-cols-2 gap-4">
        <div>
          <label className="block text-sm font-semibold text-gray-700 mb-2">Purchase Date *</label>
          <input type="date" value={formData.purchaseDate} onChange={(e) => setFormData({ ...formData, purchaseDate: e.target.value })}
            className="w-full px-4 py-3 border border-gray-200 rounded-xl bg-gray-50 text-sm font-semibold focus:outline-none focus:ring-2 focus:ring-amber-500" required />
        </div>
        <div>
          <label className="block text-sm font-semibold text-gray-700 mb-2">Location</label>
          <select value={formData.location} onChange={(e) => setFormData({ ...formData, location: e.target.value })}
            className="w-full px-4 py-3 border border-gray-200 rounded-xl bg-gray-50 text-sm font-semibold focus:outline-none focus:ring-2 focus:ring-amber-500">
            <option value="safe-deposit-box">Safe Deposit Box</option><option value="home-safe">Home Safe</option><option value="locker">Bank Locker</option><option value="other">Other</option>
          </select>
        </div>
      </div>
      <div className="flex gap-3 pt-2">
        <button type="button" onClick={() => setCurrentPage('investments')} className="px-5 py-3 rounded-xl font-semibold text-gray-500 hover:bg-gray-100 transition-all text-sm">Cancel</button>
        <button type="submit" disabled={isSubmitting} className="flex-1 bg-amber-500 hover:bg-amber-600 text-white py-3 rounded-xl font-semibold transition-colors shadow-lg text-sm disabled:opacity-60 flex items-center justify-center gap-2">
          {isSubmitting ? <><Loader2 size={15} className="animate-spin" /> Adding...</> : ' Add Gold'}
        </button>
      </div>
    </form>
  );

  const selectStyle = { backgroundImage: 'url("data:image/svg+xml;charset=US-ASCII,%3Csvg%20xmlns%3D%22http%3A%2F%2Fwww.w3.org%2F2000%2Fsvg%22%20width%3D%22292.4%22%20height%3D%22292.4%22%3E%3Cpath%20fill%3D%22%23111827%22%20d%3D%22M287%2069.4a17.6%2017.6%200%200%200-13-5.4H18.4c-5%200-9.3%201.8-12.9%205.4A17.6%2017.6%200%200%200%200%2082.2c0%205%201.8%209.3%205.4%2012.9l128%20127.9c3.6%203.6%207.8%205.4%2012.8%205.4s9.2-1.8%2012.8-5.4L287%2095c3.5-3.5%205.4-7.8%205.4-12.8%200-5-1.9-9.2-5.5-12.8z%22%2F%3E%3C%2Fsvg%3E")', backgroundRepeat: 'no-repeat', backgroundPosition: 'right 1rem top 50%', backgroundSize: '0.65rem auto' };

  const [isDesktop, setIsDesktop] = useState(false);

  React.useEffect(() => {
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
        <div className="block">
          <CenteredLayout>
            <div className="space-y-6 max-w-lg w-full mx-auto pb-8">
              <PageHeader title="Add Gold Investment" subtitle="Track your physical gold holdings" icon={<Sparkles size={20} />} showBack backTo="investments" />
              <div className="bg-white rounded-2xl border border-gray-200 p-5 shadow-sm">{mobileForm}</div>
            </div>
          </CenteredLayout>
        </div>
      ) : (
        
        <div className="block">
        <div className="w-full max-w-6xl mx-auto px-8 py-6">
          <div className="mb-6 flex items-center gap-3">
            <button type="button" onClick={() => setCurrentPage('investments')} className="flex h-9 w-9 items-center justify-center rounded-xl border border-gray-200 bg-white text-gray-500 hover:bg-gray-50 transition-colors shadow-sm">
              <ChevronLeft size={18} />
            </button>
            <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-amber-400 to-amber-600 flex items-center justify-center shadow-md text-white text-lg"></div>
            <div>
              <h1 className="text-xl font-bold text-gray-900">Add Gold Investment</h1>
              <p className="text-xs text-gray-500">Track your physical gold holdings</p>
            </div>
          </div>

          <div className="bg-white rounded-[32px] p-8 shadow-xl shadow-gray-200/40 border border-gray-100">
            <form onSubmit={handleSubmit} className="flex flex-col gap-6">
              {/* Primary Row */}
              <div className="flex items-end gap-4">
                <div className="w-[150px] shrink-0">
                  <label className="block text-xs font-bold uppercase tracking-widest text-gray-400 mb-2 ml-1">Type</label>
                  <select value={formData.type} onChange={(e) => setFormData({ ...formData, type: e.target.value as any })}
                    className="w-full bg-gray-50 border border-gray-200 focus:ring-2 focus:ring-amber-500 focus:border-amber-500 rounded-2xl py-4 px-4 text-sm font-bold text-gray-900 outline-none appearance-none cursor-pointer" style={selectStyle}>
                    {GOLD_TYPES.map(t => <option key={t.id} value={t.id}>{t.label}</option>)}
                  </select>
                </div>
                <div className="w-[120px] shrink-0">
                  <label className="block text-xs font-bold uppercase tracking-widest text-gray-400 mb-2 ml-1">Quantity</label>
                  <input type="number" step="0.01" min="0" value={formData.quantity || ''} onChange={(e) => setFormData({ ...formData, quantity: parseFloat(e.target.value) || 0 })}
                    className="w-full bg-gray-50 border border-gray-200 focus:ring-2 focus:ring-amber-500 focus:border-amber-500 rounded-2xl py-4 px-4 text-sm font-bold text-gray-900 outline-none" placeholder="0.00" required />
                </div>
                <div className="w-[100px] shrink-0">
                  <label className="block text-xs font-bold uppercase tracking-widest text-gray-400 mb-2 ml-1">Unit</label>
                  <select value={formData.unit} onChange={(e) => setFormData({ ...formData, unit: e.target.value as any })}
                    className="w-full bg-gray-50 border border-gray-200 focus:ring-2 focus:ring-amber-500 focus:border-amber-500 rounded-2xl py-4 px-4 text-sm font-bold text-gray-900 outline-none appearance-none cursor-pointer" style={selectStyle}>
                    <option value="gram">Gram</option><option value="ounce">Ounce</option><option value="kg">KG</option>
                  </select>
                </div>
                <div className="w-[160px] shrink-0">
                  <label className="block text-xs font-bold uppercase tracking-widest text-gray-400 mb-2 ml-1">Buy Price</label>
                  <div className="flex items-center bg-gray-50 border border-gray-200 focus-within:ring-2 focus-within:ring-amber-500 focus-within:border-amber-500 rounded-2xl px-4 py-4 transition-all">
                    <span className="text-gray-500 font-bold mr-2 text-xs">{currency}</span>
                    <input type="number" step="0.01" min="0" value={formData.purchasePrice || ''} onChange={(e) => setFormData({ ...formData, purchasePrice: parseFloat(e.target.value) || 0 })}
                      className="w-full bg-transparent text-sm font-bold text-gray-900 outline-none placeholder:text-gray-300" placeholder="0.00" required />
                  </div>
                </div>
                <div className="w-[160px] shrink-0">
                  <label className="block text-xs font-bold uppercase tracking-widest text-gray-400 mb-2 ml-1">Current Price</label>
                  <div className="flex items-center bg-gray-50 border border-gray-200 focus-within:ring-2 focus-within:ring-amber-500 focus-within:border-amber-500 rounded-2xl px-4 py-4 transition-all">
                    <span className="text-gray-500 font-bold mr-2 text-xs">{currency}</span>
                    <input type="number" step="0.01" min="0" value={formData.currentPrice || ''} onChange={(e) => setFormData({ ...formData, currentPrice: parseFloat(e.target.value) || 0 })}
                      className="w-full bg-transparent text-sm font-bold text-gray-900 outline-none placeholder:text-gray-300" placeholder="0.00" />
                  </div>
                </div>
                <div className="shrink-0">
                  <button type="submit" disabled={isSubmitting}
                    className="h-14 px-8 rounded-2xl bg-gradient-to-r from-amber-500 to-amber-600 text-white font-bold shadow-lg hover:from-amber-600 hover:to-amber-700 transition-all active:scale-95 flex items-center gap-2 disabled:opacity-50">
                    {isSubmitting ? <Loader2 size={18} className="animate-spin" /> : <> Add</>}
                  </button>
                </div>
              </div>

              {/* Secondary Row */}
              <div className="flex gap-4 border-t border-gray-100 pt-6">
                <div className="w-[140px] shrink-0">
                  <label className="block text-xs font-bold uppercase tracking-widest text-gray-400 mb-2 ml-1">Purity</label>
                  <div className="flex items-center bg-gray-50 border border-gray-200 focus-within:ring-2 focus-within:ring-amber-500 rounded-xl px-3 py-3 transition-all">
                    <input type="number" step="0.1" min="0" max="100" value={formData.purityPercentage || ''} onChange={(e) => setFormData({ ...formData, purityPercentage: parseFloat(e.target.value) || 0 })}
                      className="w-full bg-transparent text-sm font-bold text-gray-900 outline-none placeholder:text-gray-300" placeholder="99.9" />
                    <span className="text-gray-500 font-bold text-sm ml-1">%</span>
                  </div>
                  <div className="flex gap-1 mt-2">
                    {PURITY_PRESETS.map(p => (
                      <button key={p.label} type="button" onClick={() => setFormData({ ...formData, purityPercentage: p.value })}
                        className={cn('px-2 py-1 rounded-lg text-[10px] font-bold transition-all', formData.purityPercentage === p.value ? 'bg-amber-500 text-white' : 'bg-gray-100 text-gray-500 hover:bg-gray-200')}>
                        {p.label}
                      </button>
                    ))}
                  </div>
                </div>
                <div className="w-[140px] shrink-0">
                  <label className="block text-xs font-bold uppercase tracking-widest text-gray-400 mb-2 ml-1">Date</label>
                  <input type="date" value={formData.purchaseDate} onChange={(e) => setFormData({ ...formData, purchaseDate: e.target.value })}
                    className="w-full bg-gray-50 border border-gray-200 focus:ring-2 focus:ring-amber-500 rounded-xl py-3 px-3 text-sm font-bold text-gray-900 outline-none" required />
                </div>
                <div className="w-[160px] shrink-0">
                  <label className="block text-xs font-bold uppercase tracking-widest text-gray-400 mb-2 ml-1">Location</label>
                  <select value={formData.location} onChange={(e) => setFormData({ ...formData, location: e.target.value })}
                    className="w-full bg-gray-50 border border-gray-200 focus:ring-2 focus:ring-amber-500 rounded-xl py-3 px-3 text-sm font-bold text-gray-900 outline-none appearance-none cursor-pointer" style={selectStyle}>
                    <option value="safe-deposit-box">Safe Deposit Box</option><option value="home-safe">Home Safe</option><option value="locker">Bank Locker</option><option value="other">Other</option>
                  </select>
                </div>
                <div className="flex-1">
                  <label className="block text-xs font-bold uppercase tracking-widest text-gray-400 mb-2 ml-1">Certificate / Notes</label>
                  <input type="text" value={formData.certificateNumber || ''} onChange={(e) => setFormData({ ...formData, certificateNumber: e.target.value })}
                    className="w-full bg-gray-50 border border-gray-200 focus:ring-2 focus:ring-amber-500 rounded-xl py-3 px-3 text-sm font-bold text-gray-900 outline-none placeholder:font-medium placeholder:text-gray-400" placeholder="e.g., CERT-2024-001" />
                </div>
              </div>

              {/* Smart Preview */}
              {formData.quantity > 0 && formData.purchasePrice > 0 && (
                <div className="rounded-2xl border border-gray-200 bg-gray-50/50 p-5 flex items-center justify-between gap-6">
                  <div><p className="text-[11px] font-bold uppercase tracking-widest text-gray-400">Total Invested</p><p className="text-lg font-bold text-gray-900 mt-1">{fmt(totalInvestment)}</p></div>
                  {formData.currentPrice > 0 && (
                    <>
                      <div><p className="text-[11px] font-bold uppercase tracking-widest text-gray-400">Current Value</p><p className="text-lg font-bold text-gray-900 mt-1">{fmt(totalValue)}</p></div>
                      <div className={cn('rounded-xl px-4 py-3', hasGain ? 'bg-emerald-50' : 'bg-rose-50')}>
                        <p className={cn('text-[11px] font-bold uppercase tracking-widest flex items-center gap-1', hasGain ? 'text-emerald-500' : 'text-rose-500')}>
                          {hasGain ? <TrendingUp size={12} /> : <TrendingDown size={12} />} {hasGain ? 'Gain' : 'Loss'}
                        </p>
                        <p className={cn('text-lg font-bold mt-1', hasGain ? 'text-emerald-700' : 'text-rose-700')}>{hasGain ? '+' : ''}{fmt(gainLoss)} ({gainPct.toFixed(1)}%)</p>
                      </div>
                    </>
                  )}
                </div>
              )}
            </form>
          </div>
        </div>
      </div>
    </>
  );
};
