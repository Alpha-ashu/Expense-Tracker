import React, { useState, useEffect, useMemo } from 'react';
import { useApp } from '@/contexts/AppContext';
import { saveAccountWithBackendSync } from '@/lib/auth-sync-integration';
import { Wallet, Landmark, CreditCard, Banknote, Smartphone, CheckCircle2, ArrowRight, Globe2, MapPin, ArrowLeft } from 'lucide-react';
import { toast } from 'sonner';
import { Card } from '@/app/components/ui/card';
import { PageHeader } from '@/app/components/ui/PageHeader';
import { SearchableDropdown } from '@/app/components/ui/SearchableDropdown';
import { cn } from '@/lib/utils';

const accountTypes = [
  { id: 'bank', label: 'Bank Account', helper: 'Savings and current accounts', icon: Landmark, color: 'text-blue-600', bg: 'bg-blue-50', border: 'border-blue-200', active: 'ring-blue-500' },
  { id: 'card', label: 'Credit Card', helper: 'Track card spending and bills', icon: CreditCard, color: 'text-purple-600', bg: 'bg-purple-50', border: 'border-purple-200', active: 'ring-purple-500' },
  { id: 'cash', label: 'Cash', helper: 'Offline wallet and petty cash', icon: Banknote, color: 'text-green-600', bg: 'bg-green-50', border: 'border-green-200', active: 'ring-green-500' },
  { id: 'wallet', label: 'Digital Wallet', helper: 'UPI and digital payment apps', icon: Smartphone, color: 'text-orange-600', bg: 'bg-orange-50', border: 'border-orange-200', active: 'ring-orange-500' },
];

type ProviderBucket = { local: string[]; international: string[] };

const COUNTRY_ALIASES: Record<string, string> = {
  in: 'India',
  india: 'India',
  us: 'United States',
  usa: 'United States',
  'united states': 'United States',
  uk: 'United Kingdom',
  'united kingdom': 'United Kingdom',
  gb: 'United Kingdom',
  ca: 'Canada',
  canada: 'Canada',
  au: 'Australia',
  australia: 'Australia',
};

const BANK_PROVIDER_LISTS: Record<string, ProviderBucket> = {
  'India': {
    local: ['State Bank of India (SBI)', 'HDFC Bank', 'ICICI Bank', 'Axis Bank', 'Kotak Mahindra Bank', 'Punjab National Bank (PNB)', 'Bank of Baroda', 'Canara Bank', 'Yes Bank'],
    international: ['HSBC', 'Standard Chartered', 'Citibank India', 'Deutsche Bank India'],
  },
  'United States': {
    local: ['Chase', 'Bank of America', 'Wells Fargo', 'Citibank', 'Capital One'],
    international: ['HSBC US', 'Santander US', 'Barclays US', 'Deutsche Bank'],
  },
  'United Kingdom': {
    local: ['Barclays', 'HSBC UK', 'Lloyds', 'NatWest', 'Santander UK'],
    international: ['Citibank UK', 'Deutsche Bank UK', 'Bank of America UK', 'JPMorgan UK'],
  },
  'Canada': {
    local: ['RBC Royal Bank', 'TD Bank', 'Scotiabank', 'BMO', 'CIBC'],
    international: ['HSBC Canada', 'Citibank Canada', 'Deutsche Bank Canada', 'Scotia International'],
  },
  'Australia': {
    local: ['Commonwealth Bank', 'Westpac', 'ANZ', 'NAB'],
    international: ['HSBC Australia', 'Citibank Australia', 'Deutsche Bank Australia', 'Bank of China Australia'],
  },
  'Default': {
    local: ['Primary Local Bank'],
    international: ['International Bank'],
  },
};

const WALLET_PROVIDER_LISTS: Record<string, ProviderBucket> = {
  'India': {
    local: ['Paytm', 'PhonePe', 'MobiKwik', 'Amazon Pay'],
    international: ['Apple Pay', 'Google Pay', 'PayPal', 'Wise'],
  },
  'United States': {
    local: ['Venmo', 'Cash App', 'Zelle', 'Apple Cash'],
    international: ['Apple Pay', 'Google Pay', 'PayPal', 'Wise'],
  },
  'United Kingdom': {
    local: ['Monzo', 'Revolut', 'Starling', 'Curve'],
    international: ['Apple Pay', 'Google Pay', 'PayPal', 'Wise'],
  },
  'Canada': {
    local: ['Interac e-Transfer', 'KOHO', 'Wealthsimple'],
    international: ['Apple Pay', 'Google Pay', 'PayPal', 'Wise'],
  },
  'Australia': {
    local: ['Beem It', 'Up Bank', 'CommBank Tap & Pay'],
    international: ['Apple Pay', 'Google Pay', 'PayPal', 'Wise'],
  },
  'Default': {
    local: ['Local Wallet'],
    international: ['Apple Pay', 'Google Pay', 'PayPal'],
  },
};

const QUICK_BALANCE_PRESETS = [0, 1000, 5000, 10000];

function normalizeCountry(country?: string) {
  const normalized = (country || '').trim().toLowerCase();
  if (!normalized) {
    return 'Default';
  }
  return COUNTRY_ALIASES[normalized] || country || 'Default';
}

function inferCountryFromCurrency(currency?: string) {
  const code = (currency || '').trim().toUpperCase();
  if (code === 'INR') return 'India';
  if (code === 'USD') return 'United States';
  if (code === 'GBP') return 'United Kingdom';
  if (code === 'CAD') return 'Canada';
  if (code === 'AUD') return 'Australia';
  return 'Default';
}

function normalizeAccountName(name: string) {
  return name.trim().replace(/\s+/g, ' ').toLowerCase();
}

function toValidBalance(value: string) {
  if (!value || !value.trim()) return 0;
  const parsed = Number(value.replace(/,/g, '').trim());
  if (!Number.isFinite(parsed)) return NaN;
  return parsed;
}

export const AddAccount: React.FC = () => {
  const { setCurrentPage, currency, refreshData, accounts } = useApp();
  const [formData, setFormData] = useState({
    name: '',
    type: 'bank' as 'bank' | 'card' | 'cash' | 'wallet',
    balance: '',
  });
  const [userCountry, setUserCountry] = useState('Default');
  const [provider, setProvider] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const isCashSelected = formData.type === 'cash';

  useEffect(() => {
    let resolvedCountry = 'Default';

    try {
      const rawProfile = localStorage.getItem('user_profile');
      if (rawProfile) {
        const profile = JSON.parse(rawProfile);
        if (profile?.country) {
          resolvedCountry = normalizeCountry(profile.country);
        }
      }

      if (resolvedCountry === 'Default') {
        const rawSettings = localStorage.getItem('user_settings');
        if (rawSettings) {
          const settings = JSON.parse(rawSettings);
          if (settings?.country) {
            resolvedCountry = normalizeCountry(settings.country);
          }
        }
      }
    } catch {
      // Use currency fallback if local storage cannot be parsed.
    }

    if (resolvedCountry === 'Default') {
      resolvedCountry = inferCountryFromCurrency(currency);
    }

    setUserCountry(resolvedCountry);
  }, [currency]);

  useEffect(() => {
    setProvider('');
    setFormData(prev => ({ ...prev, name: '' }));
  }, [formData.type, userCountry]);

  const applyProviderValue = (value: string) => {
    setProvider(value);
    if (!value) {
      setFormData(prev => ({ ...prev, name: '' }));
      return;
    }

    let generatedName = `${value} Account`;
    if (formData.type === 'card') {
      generatedName = `${value} Credit Card`;
    } else if (formData.type === 'wallet') {
      generatedName = `${value} Wallet`;
    }
    setFormData(prev => ({ ...prev, name: generatedName }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const resolvedName = formData.name.trim() || (isCashSelected ? 'Cash Wallet' : '');

    if (!resolvedName) {
      toast.error('Please enter an account name');
      return;
    }

    const parsedBalance = toValidBalance(formData.balance);
    if (Number.isNaN(parsedBalance)) {
      toast.error('Please enter a valid balance amount');
      return;
    }

    if (parsedBalance < 0) {
      toast.error('Account balance cannot be negative');
      return;
    }

    const baseName = resolvedName;
    const existingNames = new Set(
      accounts
        .filter((acc) => acc.type === formData.type && (acc.currency || currency) === currency)
        .map((acc) => normalizeAccountName(acc.name))
    );

    let finalName = baseName;
    if (existingNames.has(normalizeAccountName(baseName))) {
      let suffix = 2;
      while (existingNames.has(normalizeAccountName(`${baseName} (${suffix})`))) {
        suffix += 1;
      }
      finalName = `${baseName} (${suffix})`;
      toast.info(`Account name already exists. Saved as ${finalName}.`);
    }

    setIsSubmitting(true);
    try {
      const saved = await saveAccountWithBackendSync({
        name: finalName,
        type: formData.type,
        provider: isCashSelected ? null : (provider.trim() || null),
        country: userCountry === 'Default' ? null : userCountry,
        balance: parsedBalance,
        currency,
        isActive: true,
        createdAt: new Date(),
        updatedAt: new Date(),
      });

      if ((saved as any)?.syncStatus === 'pending') {
        toast.success('Account saved locally. It will sync to the cloud when your connection is restored.', { icon: '📶' });
      } else {
        toast.success('Account created successfully', { icon: '✅' });
      }

      refreshData();
      setCurrentPage('accounts');
    } catch (error: any) {
      console.error('[AddAccount] Failed to add account:', error);
      if (error?.status === 400 || error?.code === 'MISSING_FIELDS' || error?.code === 'INVALID_BALANCE') {
        toast.error(error.message || 'Please check the account details and try again.');
      } else if (error?.status === 401 || error?.status === 403) {
        toast.error('Your session has expired. Please sign in again.');
      } else {
        toast.error('Could not save the account. Please try again.');
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  const availableOptions = useMemo(() => {
    if (formData.type === 'cash') return [];
    const providerMap = formData.type === 'wallet' ? WALLET_PROVIDER_LISTS : BANK_PROVIDER_LISTS;
    const providerSet = providerMap[userCountry] || providerMap['Default'];
    const uniqueProviders = Array.from(new Set([...providerSet.local, ...providerSet.international]));
    if (formData.type !== 'wallet') {
      uniqueProviders.push(
        'Industrial and Commercial Bank of China',
        'Agricultural Bank of China',
        'China Construction Bank',
        'JPMorgan Chase',
        'Bank of America',
        'HSBC'
      );
    }
    return Array.from(new Set(uniqueProviders));
  }, [formData.type, userCountry]);

  const providerDropdownOptions = useMemo(() => {
    if (formData.type === 'cash') return [];
    const providerMap = formData.type === 'wallet' ? WALLET_PROVIDER_LISTS : BANK_PROVIDER_LISTS;
    const providerSet = providerMap[userCountry] || providerMap['Default'];
    const local = new Set(providerSet.local);
    const international = new Set(providerSet.international);

    return availableOptions.map((option) => ({
      value: option,
      label: option,
      icon: <div className="w-6 h-6 rounded bg-slate-100 flex items-center justify-center text-slate-500"><Landmark size={12} /></div>,
      description: formData.type === 'wallet' ? 'Wallet provider' : 'Bank or financial institution',
      group: local.has(option)
        ? `${userCountry === 'Default' ? 'Local' : userCountry} providers`
        : international.has(option)
          ? 'International providers'
          : 'Global banks',
    }));
  }, [availableOptions, formData.type, userCountry]);

  const showNameField = formData.type === 'cash' || provider !== '';

  return (
    <div className="min-h-screen bg-[#F8FAFC] pb-20">
      {/* Premium Header */}
      <header className="bg-white/80 backdrop-blur-md border-b border-slate-100 sticky top-0 z-20 px-4 lg:px-8 py-4">
        <div className="max-w-5xl mx-auto flex items-center justify-between">
          <div className="flex items-center gap-4">
            <button
              onClick={() => setCurrentPage('accounts')}
              className="p-2 hover:bg-slate-100 rounded-full transition-all text-slate-500"
            >
              <ArrowLeft size={20} />
            </button>
            <div>
              <h1 className="text-xl font-black text-slate-900 tracking-tight flex items-center gap-2">
                <Wallet className="text-indigo-600" size={22} />
                New Account
              </h1>
              <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mt-0.5">Setup your financial landscape</p>
            </div>
          </div>
          
          <div className="flex items-center gap-3">
            <div className="hidden md:flex items-center gap-2 bg-indigo-50 px-3 py-1.5 rounded-xl border border-indigo-100">
               <Globe2 size={12} className="text-indigo-500" />
               <span className="text-[10px] font-bold text-indigo-700 uppercase tracking-wider">{userCountry} Mode</span>
            </div>
          </div>
        </div>
      </header>

      <main className="max-w-5xl mx-auto px-4 mt-8">
        <div className="grid lg:grid-cols-12 gap-8">
          {/* Main Form Area */}
          <div className="lg:col-span-8 space-y-6">
            {/* Step 1: Account Type */}
            <section className="bg-white rounded-3xl p-6 shadow-xl shadow-slate-200/50 border border-slate-100 overflow-hidden relative">
              <div className="flex items-center justify-between mb-6">
                <div>
                  <h3 className="text-sm font-black text-slate-900 uppercase tracking-wider">1. Account Type</h3>
                  <p className="text-xs text-slate-400 font-medium">Where is this money sitting?</p>
                </div>
                <div className="bg-indigo-50 text-indigo-600 px-3 py-1 rounded-full text-[10px] font-black uppercase tracking-widest">
                  Required
                </div>
              </div>

              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                {accountTypes.map((type) => {
                  const isSelected = formData.type === type.id;
                  const Icon = type.icon;
                  return (
                    <button
                      key={type.id}
                      type="button"
                      onClick={() => setFormData({ ...formData, type: type.id as any })}
                      className={cn(
                        "group flex flex-col items-center justify-center gap-3 p-4 rounded-2xl border-2 transition-all relative overflow-hidden",
                        isSelected
                          ? "border-indigo-500 bg-indigo-50/30 ring-4 ring-indigo-500/10"
                          : "border-slate-50 bg-slate-50/50 hover:border-slate-200 hover:bg-white"
                      )}
                    >
                      <div className={cn(
                        "w-12 h-12 rounded-2xl flex items-center justify-center transition-all duration-300",
                        isSelected ? "bg-indigo-600 text-white scale-110 rotate-3 shadow-lg shadow-indigo-200" : "bg-white text-slate-400 group-hover:text-slate-600"
                      )}>
                        <Icon size={24} />
                      </div>
                      <div className="text-center">
                        <p className={cn("text-xs font-black uppercase tracking-wider", isSelected ? "text-indigo-900" : "text-slate-500")}>
                          {type.label.split(' ')[0]}
                        </p>
                      </div>
                      {isSelected && (
                        <div className="absolute top-2 right-2">
                          <CheckCircle2 className="text-indigo-600" size={14} />
                        </div>
                      )}
                    </button>
                  );
                })}
              </div>
            </section>

            {/* Step 2: Details */}
            <section className="bg-white rounded-3xl p-6 shadow-xl shadow-slate-200/50 border border-slate-100">
               <div className="flex items-center justify-between mb-6">
                <div>
                  <h3 className="text-sm font-black text-slate-900 uppercase tracking-wider">2. Account Details</h3>
                  <p className="text-xs text-slate-400 font-medium">Let's get the particulars right</p>
                </div>
              </div>

              <div className="space-y-6">
                {/* Provider Search */}
                {!isCashSelected && (
                  <div className="space-y-2">
                    <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest px-1">Provider / Institution</label>
                    <SearchableDropdown
                      options={providerDropdownOptions}
                      value={provider}
                      onChange={applyProviderValue}
                      placeholder={formData.type === 'wallet' ? 'Search wallet provider' : 'Search bank or institution'}
                      searchPlaceholder="Type name of bank, card or wallet..."
                      grouped
                      className="h-14"
                    />
                  </div>
                )}

                {/* Conditional Name Field */}
                {showNameField && (
                  <div className="space-y-2 animate-in fade-in slide-in-from-top-2">
                    <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest px-1">
                      {isCashSelected ? 'Wallet Label' : 'Custom Account Name'}
                    </label>
                    <input
                      type="text"
                      value={formData.name}
                      onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                      className="w-full h-14 px-5 bg-slate-50 border-none rounded-2xl focus:ring-4 focus:ring-indigo-500/10 transition-all font-bold text-slate-900 placeholder:text-slate-300"
                      placeholder={isCashSelected ? 'e.g. Daily Expenses, Office Cash' : 'e.g. Salary Account, Emergency Fund'}
                    />
                  </div>
                )}

                {/* Balance Section */}
                <div className="space-y-2">
                  <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest px-1">Current Balance</label>
                  <div className="relative group">
                    <div className="absolute left-4 top-1/2 -translate-y-1/2 w-12 h-10 rounded-xl bg-slate-100 flex items-center justify-center font-black text-slate-500 text-sm">
                      {currency}
                    </div>
                    <input
                      type="number"
                      step="0.01"
                      value={formData.balance}
                      onChange={(e) => setFormData({ ...formData, balance: e.target.value })}
                      className="w-full h-16 pl-20 pr-6 text-2xl font-black border-none bg-slate-50 rounded-2xl focus:ring-4 focus:ring-indigo-500/10 text-slate-900 transition-all"
                      placeholder="0.00"
                    />
                  </div>
                  <div className="flex flex-wrap gap-2 mt-3">
                    {QUICK_BALANCE_PRESETS.map((amount) => (
                      <button
                        key={amount}
                        type="button"
                        onClick={() => setFormData((prev) => ({ ...prev, balance: amount === 0 ? '' : String(amount) }))}
                        className="px-4 py-2 rounded-xl bg-slate-100 text-slate-600 text-[10px] font-black uppercase tracking-wider hover:bg-slate-900 hover:text-white transition-all active:scale-95 border border-slate-200"
                      >
                        {amount === 0 ? 'Clear' : `+ ${amount.toLocaleString()}`}
                      </button>
                    ))}
                  </div>
                </div>
              </div>
            </section>
          </div>

          {/* Sidebar / Preview Area */}
          <div className="lg:col-span-4 space-y-6">
            <div className="bg-gradient-to-br from-indigo-600 to-violet-700 rounded-3xl p-6 text-white shadow-2xl shadow-indigo-200 sticky top-24">
              <div className="flex justify-between items-start mb-12">
                <div className="w-10 h-10 rounded-xl bg-white/20 backdrop-blur-md flex items-center justify-center">
                  {React.createElement(accountTypes.find(t => t.id === formData.type)?.icon || Wallet, { size: 20 })}
                </div>
                <div className="px-2 py-1 bg-white/10 rounded-lg text-[8px] font-black uppercase tracking-[0.2em] border border-white/10">
                  Card Preview
                </div>
              </div>
              
              <div className="space-y-1">
                <p className="text-white/60 text-[10px] font-black uppercase tracking-widest">
                  {formData.name || (isCashSelected ? 'Cash Wallet' : 'Unnamed Account')}
                </p>
                <h2 className="text-4xl font-black tracking-tight truncate">
                  <span className="text-white/40 mr-1">{currency}</span>
                  {Number(formData.balance || 0).toLocaleString(undefined, { minimumFractionDigits: 2 })}
                </h2>
              </div>
              
              <div className="mt-12 flex items-center justify-between">
                <div className="flex -space-x-2">
                  <div className="w-6 h-6 rounded-full bg-white/20 border-2 border-indigo-600"></div>
                  <div className="w-6 h-6 rounded-full bg-white/10 border-2 border-indigo-600"></div>
                </div>
                <div className="text-[10px] font-bold text-white/40 uppercase tracking-widest">
                  {userCountry}
                </div>
              </div>
            </div>

            <button
              onClick={handleSubmit}
              disabled={isSubmitting || (!isCashSelected && !formData.name.trim())}
              className="w-full h-16 bg-slate-900 text-white rounded-3xl font-black uppercase tracking-widest flex items-center justify-center gap-3 shadow-xl hover:bg-slate-800 transition-all active:scale-[0.98] disabled:opacity-50 group"
            >
              {isSubmitting ? (
                <div className="w-5 h-5 border-2 border-white/20 border-t-white rounded-full animate-spin"></div>
              ) : (
                <>
                  <span>Create Account</span>
                  <ArrowRight size={18} className="group-hover:translate-x-1 transition-transform" />
                </>
              )}
            </button>
            
            <p className="text-center text-[10px] font-bold text-slate-400 uppercase tracking-[0.2em] px-4">
              Protected by military-grade encryption & biometric security
            </p>
          </div>
        </div>
      </main>
    </div>
  );
};

