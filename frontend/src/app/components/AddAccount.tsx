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
      await saveAccountWithBackendSync({
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
      toast.success('Account created successfully', { icon: '' });
      refreshData();
      setCurrentPage('accounts');
    } catch (error) {
      console.error('Failed to add account:', error);
      toast.error('Failed to create account. Please try again.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const availableOptions = useMemo(() => {
    if (formData.type === 'cash') {
      return [];
    }

    const providerMap = formData.type === 'wallet' ? WALLET_PROVIDER_LISTS : BANK_PROVIDER_LISTS;
    const providerSet = providerMap[userCountry] || providerMap['Default'];
    const uniqueProviders = Array.from(new Set([...providerSet.local, ...providerSet.international]));

    // Add a few globally-known banks so search feels richer beyond country-local records.
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

  const providerSuggestions = useMemo(() => {
    if (formData.type === 'cash') {
      return [] as string[];
    }

    const query = provider.trim().toLowerCase();
    const ranked = availableOptions
      .filter((option) => option.toLowerCase().includes(query))
      .sort((a, b) => {
        const aStarts = a.toLowerCase().startsWith(query);
        const bStarts = b.toLowerCase().startsWith(query);
        if (aStarts && !bStarts) return -1;
        if (!aStarts && bStarts) return 1;
        return a.localeCompare(b);
      });

    return ranked.slice(0, 10);
  }, [availableOptions, formData.type, provider]);

  const providerDropdownOptions = useMemo(() => {
    if (formData.type === 'cash') {
      return [];
    }

    const providerMap = formData.type === 'wallet' ? WALLET_PROVIDER_LISTS : BANK_PROVIDER_LISTS;
    const providerSet = providerMap[userCountry] || providerMap['Default'];
    const local = new Set(providerSet.local);
    const international = new Set(providerSet.international);

    return availableOptions.map((option) => ({
      value: option,
      label: option,
      icon: formData.type === 'wallet' ? <Smartphone size={14} /> : <Landmark size={14} />,
      description: formData.type === 'wallet' ? 'Wallet provider' : 'Bank or financial institution',
      group: local.has(option)
        ? `${userCountry === 'Default' ? 'Local' : userCountry} providers`
        : international.has(option)
          ? 'International providers'
          : 'Global banks',
    }));
  }, [availableOptions, formData.type, userCountry]);

  const showNameField = formData.type === 'cash' || provider !== '';
              className="lg:hidden w-8 h-8 rounded-full bg-white flex items-center justify-center text-gray-600 mb-4 shadow-sm border border-gray-100"
            >
              <ArrowLeft className="w-4 h-4" />
            </button>
            <h1 className="text-2xl lg:text-3xl font-bold text-gray-900 tracking-tight flex items-center gap-2 lg:gap-3">
              <Wallet className="w-6 h-6 lg:w-8 lg:h-8 text-blue-600" /> New Account
            </h1>
            <p className="text-xs lg:text-sm text-gray-500 mt-1 lg:mt-2">Let's set up a new place to track your money</p>
          </div>
          <button 
            type="button"
            onClick={() => setCurrentPage('accounts')}
            className="hidden lg:flex items-center justify-center w-10 h-10 rounded-full bg-white shadow-sm border border-gray-100 text-gray-600 hover:bg-gray-50 transition-colors"
          >
            <ArrowLeft className="w-5 h-5" />
          </button>
        </div>

        {/* Form Card */}
        <div>
          <Card className="bg-white/95 border border-white shadow-[0_18px_40px_rgba(15,23,42,0.08)] rounded-3xl p-4 lg:p-6">
            <form onSubmit={handleSubmit} className="space-y-5">

              <div className="flex items-center justify-between rounded-xl border border-slate-200 bg-gradient-to-r from-slate-50 to-blue-50 px-3 py-2.5">
                <div>
                  <p className="text-xs font-semibold tracking-wide text-slate-500 uppercase">Quick Setup</p>
                  <p className="text-sm font-semibold text-slate-800">Create a clean account profile in seconds</p>
                </div>
                <span className="text-xs font-semibold text-blue-700 bg-blue-100 rounded-full px-2.5 py-1">Modern Flow</span>
              </div>

              {/* Account Type Selection */}
              <div className="space-y-3">
                <label className="block text-sm font-bold text-gray-700 mb-3 tracking-wide uppercase">
                  1. Choose Account Type
                </label>
                <div className="grid grid-cols-2 gap-3">
                  {accountTypes.map((type) => {
                    const isSelected = formData.type === type.id;
                    const Icon = type.icon;
                    return (
                      <button
                        key={type.id}
                        type="button"
                        onClick={() => setFormData({ ...formData, type: type.id as any })}
                        className={cn(
                          "w-full flex items-center gap-3 p-3 rounded-xl border text-left relative transition-all",
                          isSelected
                            ? `border-blue-500 bg-gradient-to-r from-white to-blue-50/80 shadow-sm`
                            : "border-gray-200 bg-white hover:border-slate-300 hover:bg-slate-50/40"
                        )}
                      >
                        <div className={cn(
                          "w-10 h-10 rounded-lg flex items-center justify-center shrink-0",
                          isSelected ? type.bg : "bg-gray-50"
                        )}>
                          <Icon size={20} className={isSelected ? type.color : "text-gray-500"} />
                        </div>
                        <div>
                          <p className={cn(
                            "font-semibold text-base leading-tight",
                            isSelected ? "text-gray-900" : "text-gray-700"
                          )}>
                            {type.label}
                          </p>
                          <p className="text-[11px] text-gray-500 mt-0.5 leading-tight">{type.helper}</p>
                        </div>
                        {isSelected && (
                          <CheckCircle2 className={type.color + ' ml-auto'} size={18} />
                        )}
                      </button>
                    );
                  })}
                </div>
                <div className="flex items-center gap-2 text-xs text-slate-600 bg-white border border-slate-200 rounded-lg px-3 py-2">
                  <MapPin size={14} className="text-blue-600" />
                  <span>
                    Country detected: <span className="font-semibold text-slate-800">{userCountry}</span>
                  </span>
                </div>
              </div>

              {/* Account Details */}
              <div className="bg-white rounded-2xl p-4 space-y-4 border border-slate-200">
                <label className="block text-sm font-bold text-gray-700 mb-2 tracking-wide uppercase">
                  2. Account Details
                </label>

                {/* Provider Selection */}
                {!isCashSelected && (
                  <>
                    <div>
                      <SearchableDropdown
                        id="accountProvider"
                        label={formData.type === 'wallet' ? 'Wallet Provider' : formData.type === 'card' ? 'Card Provider / Bank' : 'Bank / Institution'}
                        options={providerDropdownOptions}
                        value={provider}
                        onChange={applyProviderValue}
                        placeholder={formData.type === 'wallet' ? 'Search wallet provider' : 'Search bank or institution'}
                        searchPlaceholder="Search local and international providers..."
                        grouped
                        required
                      />
                      <div className="mt-2 flex items-center gap-2 text-xs text-slate-600">
                        <Globe2 size={13} />
                        <span>{providerSuggestions.length} suggestions shown. Keep typing to narrow results.</span>
                      </div>
                    </div>
                  </>
                )}

                {/* Account Name */}
                {showNameField && (
                  <div>
                    <label className="block text-sm font-medium text-gray-600 mb-2">
                      {isCashSelected ? 'Cash Label (Optional)' : 'Account Name'}
                    </label>
                    <input
                      type="text"
                      value={formData.name}
                      onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                      className="w-full px-4 py-3 text-base border border-gray-200 bg-white rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-200 focus:border-blue-500 text-gray-900 placeholder:text-gray-400 font-medium"
                      placeholder={isCashSelected ? '' : 'e.g., Main Checking'}
                      required={!isCashSelected}
                    />
                    {isCashSelected && (
                      <p className="mt-1.5 text-xs text-slate-500">Leave empty to save as Cash Wallet.</p>
                    )}
                  </div>
                )}

                <div>
                  <label className="block text-sm font-medium text-gray-600 mb-2">
                    Current Balance <span className="text-gray-400 font-normal">(Optional)</span>
                  </label>
                  <div className="relative group">
                    <div className="absolute left-4 top-1/2 -translate-y-1/2 w-10 h-10 rounded-lg bg-gray-100 flex items-center justify-center font-bold text-gray-600 group-focus-within:bg-blue-100 group-focus-within:text-blue-700 transition-colors">
                      {currency}
                    </div>
                    <input
                      type="number"
                      step="0.01"
                      min="0"
                      value={formData.balance}
                      onChange={(e) => setFormData({ ...formData, balance: e.target.value })}
                      className="w-full pl-16 pr-4 py-3 text-xl font-semibold border border-gray-200 bg-white rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-200 focus:border-blue-500 text-gray-900 placeholder:text-gray-300 tracking-tight"
                      placeholder="0.00"
                    />
                  </div>
                  <div className="mt-2 flex flex-wrap gap-2">
                    {QUICK_BALANCE_PRESETS.map((amount) => (
                      <button
                        key={amount}
                        type="button"
                        onClick={() => setFormData((prev) => ({ ...prev, balance: amount === 0 ? '' : String(amount) }))}
                        className="px-2.5 py-1.5 rounded-md bg-slate-100 text-slate-700 text-xs font-semibold hover:bg-slate-200 transition-colors"
                      >
                        {amount === 0 ? 'Clear' : `+ ${currency} ${amount.toLocaleString()}`}
                      </button>
                    ))}
                  </div>
                </div>
              </div>

              {/* Action Buttons */}
              <div className="flex gap-3 pt-2 border-t border-gray-100">
                <button
                  type="button"
                  onClick={() => setCurrentPage('accounts')}
                  className="px-5 py-3 rounded-lg font-semibold text-gray-500 hover:text-gray-800 hover:bg-gray-100 transition-all shrink-0"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isSubmitting || (!isCashSelected && !formData.name.trim())}
                  className="w-full rounded-lg bg-gradient-to-r from-slate-900 to-slate-700 text-white font-semibold py-3 px-5 flex items-center justify-center gap-2 transition-all hover:from-slate-800 hover:to-slate-700 active:scale-[0.99] disabled:opacity-70 disabled:cursor-not-allowed"
                >
                  <span>{isSubmitting ? 'Creating...' : 'Create Account'}</span>
                  {!isSubmitting && <ArrowRight size={18} />}
                </button>
              </div>
            </form>
          </Card>
        </div>
      </div>
    </div>
  );
};

