import React, { useState, useEffect, useMemo } from 'react';
import { useApp } from '@/contexts/AppContext';
import { saveAccountWithBackendSync } from '@/lib/auth-sync-integration';
import { Wallet, Landmark, CreditCard, Banknote, Smartphone, CheckCircle2, ArrowRight, Globe2, MapPin, ArrowLeft } from 'lucide-react';
import { toast } from 'sonner';
import { Card } from '@/app/components/ui/card';
import { PageHeaderCard, HeaderActions, PrimaryActionButton } from '@/app/components/ui/PageHeader';
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
    <div className="min-h-screen bg-slate-50/50 pb-20">
      <main className="max-w-6xl mx-auto px-4 lg:px-8 mt-8">
        <PageHeaderCard
          title="New Account"
          subtitle="Setup your financial landscape"
          icon={<Wallet size={28} className="text-indigo-600" />}
        >
          <HeaderActions>
            <div className="hidden md:flex items-center gap-2 bg-indigo-50 px-4 py-2.5 rounded-xl border border-indigo-100">
               <Globe2 size={16} className="text-indigo-600" />
               <span className="text-xs font-bold text-indigo-700 uppercase tracking-wider">{userCountry} Mode</span>
            </div>
            <PrimaryActionButton
              onClick={handleSubmit}
              icon={isSubmitting ? <div className="w-4 h-4 border-2 border-white/20 border-t-white rounded-full animate-spin"></div> : <CheckCircle2 size={18} />}
            >
              {isSubmitting ? 'Creating...' : 'Create Account'}
            </PrimaryActionButton>
          </HeaderActions>
        </PageHeaderCard>

        <div className="grid lg:grid-cols-[65%_35%] gap-8">
          {/* Main Form Area */}
          <div className="space-y-6">
            {/* Step 1: Account Type */}
            <div className="bg-white rounded-[28px] p-6 lg:p-8 shadow-sm border border-slate-100 overflow-hidden relative">
              <div className="flex items-center justify-between mb-8">
                <div>
                  <h3 className="text-base font-black text-slate-900 uppercase tracking-wider">1. Account Type</h3>
                  <p className="text-sm text-slate-500 font-medium mt-1">Select the type of financial instrument</p>
                </div>
                <div className="bg-indigo-50 text-indigo-600 px-3 py-1 rounded-full text-xs font-bold tracking-widest uppercase shadow-sm">
                  Required
                </div>
              </div>

              <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
                {accountTypes.map((type) => {
                  const isSelected = formData.type === type.id;
                  const Icon = type.icon;
                  return (
                    <button
                      key={type.id}
                      type="button"
                      onClick={() => setFormData({ ...formData, type: type.id as any })}
                      className={cn(
                        "group flex flex-col items-center justify-center gap-4 p-5 rounded-[20px] transition-all relative overflow-hidden",
                        isSelected
                          ? "bg-indigo-50/80 border-2 border-indigo-500 shadow-md shadow-indigo-100/50"
                          : "bg-white border-2 border-slate-100 hover:border-indigo-200 hover:shadow-sm"
                      )}
                    >
                      <div className={cn(
                        "w-14 h-14 rounded-2xl flex items-center justify-center transition-all duration-300",
                        isSelected ? "bg-indigo-600 text-white shadow-lg shadow-indigo-200 scale-110" : "bg-slate-50 text-slate-400 group-hover:bg-indigo-50 group-hover:text-indigo-500 group-hover:scale-105"
                      )}>
                        <Icon size={26} />
                      </div>
                      <div className="text-center">
                        <p className={cn("text-sm font-bold tracking-wide", isSelected ? "text-indigo-900" : "text-slate-600")}>
                          {type.label}
                        </p>
                      </div>
                      {isSelected && (
                        <div className="absolute top-3 right-3 text-indigo-600">
                          <CheckCircle2 size={16} />
                        </div>
                      )}
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Step 2: Details */}
            <div className="bg-white rounded-[28px] p-6 lg:p-8 shadow-sm border border-slate-100">
               <div className="flex items-center justify-between mb-8">
                <div>
                  <h3 className="text-base font-black text-slate-900 uppercase tracking-wider">2. Account Details</h3>
                  <p className="text-sm text-slate-500 font-medium mt-1">Configure your account settings</p>
                </div>
              </div>

              <div className="space-y-8">
                {/* Provider Search */}
                {!isCashSelected && (
                  <div className="space-y-3">
                    <label className="text-xs font-bold text-slate-500 uppercase tracking-widest px-1">Provider / Institution</label>
                    <SearchableDropdown
                      options={providerDropdownOptions}
                      value={provider}
                      onChange={applyProviderValue}
                      placeholder={formData.type === 'wallet' ? 'Search wallet provider' : 'Search bank or institution'}
                      searchPlaceholder="Type name of bank, card or wallet..."
                      grouped
                      className="h-16 text-lg"
                    />
                  </div>
                )}

                {/* Conditional Name Field */}
                {showNameField && (
                  <div className="space-y-3 animate-in fade-in slide-in-from-top-2">
                    <label className="text-xs font-bold text-slate-500 uppercase tracking-widest px-1">
                      {isCashSelected ? 'Wallet Label' : 'Custom Account Name'}
                    </label>
                    <input
                      type="text"
                      value={formData.name}
                      onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                      className="w-full h-16 px-6 bg-slate-50 border-2 border-transparent focus:border-indigo-500/20 rounded-[20px] focus:bg-white focus:ring-4 focus:ring-indigo-500/10 transition-all text-lg font-bold text-slate-900 placeholder:text-slate-300 placeholder:font-semibold"
                      placeholder={isCashSelected ? 'e.g. Daily Expenses, Office Cash' : 'e.g. Salary Account, Emergency Fund'}
                    />
                  </div>
                )}

                {/* Balance Section */}
                <div className="space-y-3">
                  <label className="text-xs font-bold text-slate-500 uppercase tracking-widest px-1">Current Balance</label>
                  <div className="relative group">
                    <div className="absolute left-5 top-1/2 -translate-y-1/2 w-14 h-12 rounded-[14px] bg-white border border-slate-100 shadow-sm flex items-center justify-center font-black text-slate-600 text-lg">
                      {currency}
                    </div>
                    <input
                      type="number"
                      step="0.01"
                      value={formData.balance}
                      onChange={(e) => setFormData({ ...formData, balance: e.target.value })}
                      className="w-full h-20 pl-24 pr-6 text-4xl font-black border-2 border-transparent bg-slate-50 rounded-[20px] focus:bg-white focus:border-indigo-500/20 focus:ring-4 focus:ring-indigo-500/10 text-slate-900 transition-all placeholder:text-slate-300"
                      placeholder="0.00"
                    />
                  </div>
                  <div className="flex flex-wrap gap-2 mt-4">
                    {QUICK_BALANCE_PRESETS.map((amount) => (
                      <button
                        key={amount}
                        type="button"
                        onClick={() => setFormData((prev) => ({ ...prev, balance: amount === 0 ? '' : String(amount) }))}
                        className="px-5 py-2.5 rounded-xl bg-white border border-slate-200 text-slate-600 text-xs font-bold uppercase tracking-wider hover:border-indigo-300 hover:text-indigo-600 transition-all active:scale-95 shadow-sm"
                      >
                        {amount === 0 ? 'Clear' : `+ ${amount.toLocaleString()}`}
                      </button>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Sidebar / Preview Area */}
          <div className="space-y-6">
            <div className="bg-gradient-to-br from-indigo-900 via-indigo-800 to-violet-900 rounded-[28px] p-8 text-white shadow-xl shadow-indigo-900/20 sticky top-28 overflow-hidden relative">
              {/* Glassmorphism Background Decor */}
              <div className="absolute -top-24 -right-24 w-64 h-64 bg-white/5 rounded-full blur-3xl"></div>
              <div className="absolute -bottom-24 -left-24 w-64 h-64 bg-violet-500/20 rounded-full blur-3xl"></div>

              <div className="relative z-10 flex justify-between items-start mb-16">
                <div className="w-14 h-14 rounded-[18px] bg-white/10 backdrop-blur-xl border border-white/20 flex items-center justify-center shadow-inner">
                  {React.createElement(accountTypes.find(t => t.id === formData.type)?.icon || Wallet, { size: 28, className: "text-white" })}
                </div>
                <div className="px-3 py-1.5 bg-white/10 backdrop-blur-md rounded-xl text-[10px] font-bold uppercase tracking-[0.2em] border border-white/10 text-white/80">
                  Live Preview
                </div>
              </div>
              
              <div className="relative z-10 space-y-2">
                <p className="text-white/60 text-xs font-bold uppercase tracking-widest">
                  {formData.name || (isCashSelected ? 'Cash Wallet' : 'Unnamed Account')}
                </p>
                <h2 className="text-5xl font-black tracking-tight truncate pb-2">
                  <span className="text-white/40 mr-2 text-3xl">{currency}</span>
                  {Number(formData.balance || 0).toLocaleString(undefined, { minimumFractionDigits: 2 })}
                </h2>
              </div>
              
              <div className="relative z-10 mt-16 flex items-center justify-between pt-6 border-t border-white/10">
                <div className="flex -space-x-3">
                  <div className="w-8 h-8 rounded-full bg-indigo-400 border-2 border-indigo-900 mix-blend-screen opacity-80"></div>
                  <div className="w-8 h-8 rounded-full bg-violet-400 border-2 border-indigo-900 mix-blend-screen opacity-80"></div>
                </div>
                <div className="text-xs font-bold text-white/50 uppercase tracking-widest flex items-center gap-2">
                  <Globe2 size={14} />
                  {userCountry}
                </div>
              </div>
            </div>

            <p className="text-center text-xs font-bold text-slate-400 uppercase tracking-widest px-4">
              Protected by 256-bit AES encryption
            </p>
          </div>
        </div>
      </main>
    </div>
  );
};

