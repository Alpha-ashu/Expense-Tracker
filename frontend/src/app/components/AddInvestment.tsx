import React, { useCallback, useEffect, useRef, useState } from 'react';
import { useApp } from '@/contexts/AppContext';
import { PageHeader } from '@/app/components/ui/PageHeader';
import { SearchableDropdown } from '@/app/components/ui/SearchableDropdown';
import { backendService } from '@/lib/backend-api';
import { saveTransactionWithBackendSync } from '@/lib/auth-sync-integration';
import { db } from '@/lib/database';
import { TrendingUp, Loader2, RefreshCw, ChevronLeft } from 'lucide-react';
import { cn } from '@/lib/utils';

import { toast } from 'sonner';
import { searchStocks, fetchStockQuote, StockQuote, StockSearchResult, displaySymbol } from '@/lib/stockApi';
import { formatNativeMoney, getCurrencySymbol, normalizeCurrencyCode } from '@/lib/currencyUtils';
import { fetchCurrencyConversionRate } from '@/lib/investmentUtils';
import { inferInvestmentTypeFromText } from '@/lib/voiceExpenseParser';
import { takeVoiceDraft, VOICE_INVESTMENT_DRAFT_KEY, type VoiceInvestmentDraft } from '@/lib/voiceDrafts';

const PENDING_INVESTMENT_DRAFT_KEY = 'pendingInvestmentDraft';

type InvestmentFormType = 'stocks' | 'bonds' | 'mutual-funds' | 'real-estate' | 'crypto' | 'other';

const investmentTypeOptions = [
  { value: 'stocks', label: 'Stocks', description: 'Listed equity holdings', group: 'Market assets' },
  { value: 'crypto', label: 'Cryptocurrency', description: 'Crypto assets with live quotes', group: 'Market assets' },
  { value: 'bonds', label: 'Bonds', description: 'Fixed income investments', group: 'Traditional assets' },
  { value: 'mutual-funds', label: 'Mutual Funds', description: 'Funds, SIPs, and ETFs', group: 'Traditional assets' },
  { value: 'real-estate', label: 'Real Estate', description: 'Property or land investments', group: 'Physical assets' },
  { value: 'other', label: 'Other', description: 'Any custom investment', group: 'Physical assets' },
];

interface PendingInvestmentDraft {
  symbol: string;
  displayName?: string;
  companyName?: string;
  exchange?: string;
  type?: 'stocks' | 'crypto';
  currentPrice?: number;
  currency?: string;
  currencyCode?: string;
  marketState?: string;
  lastUpdate?: string;
}

interface QuoteSnapshot {
  companyName: string;
  exchange: string;
  currentPrice: number;
  currencyCode: string;
  marketState?: string;
  lastUpdate?: string;
}

const resolveSelectedType = (symbol: string, fallback: InvestmentFormType): InvestmentFormType =>
  symbol.endsWith('-USD') ? 'crypto' : (fallback === 'crypto' ? 'crypto' : 'stocks');

const buildQuoteSnapshot = (quote: StockQuote): QuoteSnapshot => ({
  companyName: quote.companyName,
  exchange: quote.exchange,
  currentPrice: quote.lastPrice,
  currencyCode: normalizeCurrencyCode(quote.currencyCode || quote.currency),
  marketState: quote.marketState,
  lastUpdate: quote.lastUpdate,
});

export const AddInvestment: React.FC = () => {
  const { accounts, setCurrentPage, currency, refreshData } = useApp();
  const activeAccounts = accounts.filter((account) => account.isActive);
  const [formData, setFormData] = useState(() => ({
    name: '',
    type: 'stocks' as InvestmentFormType,
    quantity: 0,
    purchasePrice: 0,
    currentPrice: 0,
    date: new Date().toISOString().split('T')[0],
    broker: '',
    description: '',
    fundingAccountId: activeAccounts[0]?.id || 0,
    purchaseFees: 0,
  }));

  const [searchResults, setSearchResults] = useState<StockSearchResult[]>([]);
  const [searching, setSearching] = useState(false);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [fetchingPrice, setFetchingPrice] = useState(false);
  const [selectedSymbol, setSelectedSymbol] = useState<string | null>(null);
  const [quoteSnapshot, setQuoteSnapshot] = useState<QuoteSnapshot | null>(null);
  const searchTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const isMarketAsset = formData.type === 'stocks' || formData.type === 'crypto';
  const assetCurrencyCode = quoteSnapshot?.currencyCode || normalizeCurrencyCode(currency);
  const assetCurrency = getCurrencySymbol(assetCurrencyCode);
  const showConversionHint = assetCurrencyCode !== normalizeCurrencyCode(currency);
  const livePrice = quoteSnapshot?.currentPrice || formData.currentPrice;
  const totalInvested = formData.purchasePrice * formData.quantity;
  const currentValue = livePrice * formData.quantity;
  const investmentGain = (livePrice - formData.purchasePrice) * formData.quantity;
  const gainPercentage = totalInvested > 0 ? (investmentGain / totalInvested) * 100 : 0;
  const fundingAccountOptions = activeAccounts.map((account) => ({
    value: String(account.id),
    label: account.name,
    description: `${formatNativeMoney(account.balance, currency)} available`,
    group: account.type ? `${account.type.charAt(0).toUpperCase()}${account.type.slice(1)} accounts` : 'Accounts',
  }));

  useEffect(() => {
    if (formData.fundingAccountId || !activeAccounts.length) {
      return;
    }

    setFormData((prev) => ({
      ...prev,
      fundingAccountId: activeAccounts[0]?.id || 0,
    }));
  }, [activeAccounts, formData.fundingAccountId]);

  useEffect(() => {
    const draft = takeVoiceDraft<VoiceInvestmentDraft>(VOICE_INVESTMENT_DRAFT_KEY);
    if (!draft) {
      return;
    }

    const inferredType = (() => {
      switch (inferInvestmentTypeFromText(draft.description || '')) {
        case 'crypto':
          return 'crypto' as const;
        case 'mutual-funds':
          return 'mutual-funds' as const;
        case 'bonds':
          return 'bonds' as const;
        case 'stocks':
          return 'stocks' as const;
        default:
          return 'other' as const;
      }
    })();

    setFormData((prev) => ({
      ...prev,
      name: draft.description || prev.name,
      type: inferredType,
      quantity: prev.quantity > 0 ? prev.quantity : 1,
      purchasePrice: draft.amount || prev.purchasePrice,
      currentPrice: draft.amount || prev.currentPrice,
      description: draft.description || prev.description,
    }));
  }, []);

  const handleInvestmentTypeChange = (value: string) => {
    const nextType = value as InvestmentFormType;
    setSelectedSymbol(null);
    setQuoteSnapshot(null);
    setSearchResults([]);
    setShowSuggestions(false);
    setFormData({
      name: '',
      type: nextType,
      quantity: 0,
      purchasePrice: 0,
      currentPrice: 0,
      date: formData.date,
      broker: formData.broker,
      description: formData.description,
      fundingAccountId: formData.fundingAccountId,
      purchaseFees: formData.purchaseFees,
    });
  };

  const applyQuoteSnapshot = useCallback((quote: QuoteSnapshot, prefillBuyPrice = false) => {
    setQuoteSnapshot(quote);
    setFormData(prev => ({
      ...prev,
      currentPrice: quote.currentPrice,
      purchasePrice: prev.purchasePrice === 0 || prefillBuyPrice ? quote.currentPrice : prev.purchasePrice,
    }));
  }, []);

  const loadLiveQuote = useCallback(async (
    symbol: string,
    type: 'stocks' | 'crypto',
    options?: { prefillBuyPrice?: boolean; silent?: boolean; }
  ) => {
    setFetchingPrice(true);
    try {
      const quote = await fetchStockQuote(symbol, type === 'crypto' ? 'crypto' : undefined);
      if (!quote) {
        if (!options?.silent) {
          toast.error('Live market price unavailable for this asset');
        }
        return null;
      }

      const snapshot = buildQuoteSnapshot(quote);
      applyQuoteSnapshot(snapshot, options?.prefillBuyPrice);
      return snapshot;
    } catch {
      if (!options?.silent) {
        toast.error('Failed to fetch live market price');
      }
      return null;
    } finally {
      setFetchingPrice(false);
    }
  }, [applyQuoteSnapshot]);

  useEffect(() => {
    const rawDraft = localStorage.getItem(PENDING_INVESTMENT_DRAFT_KEY);
    if (!rawDraft) {
      return;
    }

    localStorage.removeItem(PENDING_INVESTMENT_DRAFT_KEY);

    let cancelled = false;
    let parsedDraft: PendingInvestmentDraft | null = null;

    try {
      parsedDraft = JSON.parse(rawDraft) as PendingInvestmentDraft;
    } catch {
      return;
    }

    if (!parsedDraft?.symbol) {
      return;
    }

    const draftType = parsedDraft.type === 'crypto' ? 'crypto' : 'stocks';
    const draftName = parsedDraft.displayName || displaySymbol(parsedDraft.symbol);

    setSelectedSymbol(parsedDraft.symbol);
    setShowSuggestions(false);
    setFormData(prev => ({
      ...prev,
      name: draftName,
      type: draftType,
    }));

    if (parsedDraft.currentPrice && (parsedDraft.currency || parsedDraft.currencyCode)) {
      applyQuoteSnapshot({
        companyName: parsedDraft.companyName || draftName,
        exchange: parsedDraft.exchange || '',
        currentPrice: parsedDraft.currentPrice,
        currencyCode: normalizeCurrencyCode(parsedDraft.currencyCode || parsedDraft.currency, normalizeCurrencyCode(currency)),
        marketState: parsedDraft.marketState,
        lastUpdate: parsedDraft.lastUpdate,
      }, true);
    }

    loadLiveQuote(parsedDraft.symbol, draftType, {
      prefillBuyPrice: !parsedDraft.currentPrice,
      silent: true,
    }).then((snapshot) => {
      if (cancelled || snapshot || parsedDraft?.currentPrice) {
        return;
      }
      setQuoteSnapshot(null);
    });

    return () => {
      cancelled = true;
    };
  }, [applyQuoteSnapshot, loadLiveQuote]);

  useEffect(() => {
    if (!isMarketAsset) {
      setShowSuggestions(false);
      setSearchResults([]);
      return;
    }

    if (searchTimer.current) clearTimeout(searchTimer.current);
    if (!formData.name.trim() || formData.name.length < 2) {
      setSearchResults([]);
      return;
    }

    if (!showSuggestions) return;

    setSearching(true);
    searchTimer.current = setTimeout(async () => {
      const market = formData.type === 'crypto' ? 'crypto' : undefined;
      const results = await searchStocks(formData.name.trim(), market);
      setSearchResults(results);
      setSearching(false);
    }, 300);

    return () => {
      if (searchTimer.current) clearTimeout(searchTimer.current);
    };
  }, [formData.name, formData.type, isMarketAsset, showSuggestions]);

  const handleSelectStock = async (stock: StockSearchResult) => {
    const nextType = resolveSelectedType(stock.symbol, formData.type);
    setSelectedSymbol(stock.symbol);
    setFormData(prev => ({
      ...prev,
      name: displaySymbol(stock.symbol),
      type: nextType,
    }));
    setShowSuggestions(false);

    const quote = await loadLiveQuote(stock.symbol, nextType === 'crypto' ? 'crypto' : 'stocks', {
      prefillBuyPrice: true,
    });

    if (quote) {
      toast.success(`Fetched live price for ${displaySymbol(stock.symbol)}`);
    }
  };

  const resolveAssetSymbol = async () => {
    if (selectedSymbol) {
      return selectedSymbol;
    }

    const typedName = formData.name.trim();
    if (!typedName || !isMarketAsset) {
      return typedName;
    }

    const market = formData.type === 'crypto' ? 'crypto' : undefined;
    const matches = await searchStocks(typedName, market);
    const exactMatch = matches.find(match =>
      displaySymbol(match.symbol).toUpperCase() === typedName.toUpperCase() ||
      match.symbol.toUpperCase() === typedName.toUpperCase(),
    );

    return exactMatch?.symbol ?? typedName;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!formData.name.trim()) {
      toast.error('Investment name is required');
      return;
    }

    if (formData.quantity <= 0) {
      toast.error('Quantity must be greater than 0');
      return;
    }

    if (formData.purchasePrice <= 0) {
      toast.error('Buy price must be greater than 0');
      return;
    }

    if (!formData.fundingAccountId) {
      toast.error('Select a payment account for this purchase');
      return;
    }

    try {
      const assetSymbol = await resolveAssetSymbol();
      let effectiveCurrentPrice = livePrice;
      const resolvedAssetCurrency = normalizeCurrencyCode(quoteSnapshot?.currencyCode || currency);
      const fundingAccount = activeAccounts.find((account) => account.id === formData.fundingAccountId);

      if (isMarketAsset && selectedSymbol && effectiveCurrentPrice <= 0) {
        const quote = await loadLiveQuote(selectedSymbol, formData.type === 'crypto' ? 'crypto' : 'stocks', {
          silent: true,
        });
        effectiveCurrentPrice = quote?.currentPrice ?? effectiveCurrentPrice;
      }

      if (isMarketAsset && effectiveCurrentPrice <= 0) {
        toast.error('Live market price is unavailable. Refresh the quote and try again.');
        return;
      }

      if (!fundingAccount?.id) {
        toast.error('Selected payment account is unavailable');
        return;
      }

      function mapInvestmentType(type: InvestmentFormType): 'stock' | 'crypto' | 'forex' | 'gold' | 'silver' | 'other' {
        switch (type) {
          case 'stocks': return 'stock';
          case 'crypto': return 'crypto';
          case 'bonds': return 'other';
          case 'mutual-funds': return 'other';
          case 'real-estate': return 'other';
          default: return 'other';
        }
      }

      const nextTotalInvested = formData.purchasePrice * formData.quantity;
      const nextCurrentValueNative = effectiveCurrentPrice * formData.quantity;
      const buyFxRate = await fetchCurrencyConversionRate(resolvedAssetCurrency, currency);
      const currentFxRate = await fetchCurrencyConversionRate(resolvedAssetCurrency, currency);
      const assetCostInBaseCurrency = nextTotalInvested * buyFxRate;
      const totalPurchaseCost = assetCostInBaseCurrency + formData.purchaseFees;
      const nextCurrentValue = nextCurrentValueNative * currentFxRate;
      const nextProfitLoss = nextCurrentValue - totalPurchaseCost;

      if (fundingAccount.balance < totalPurchaseCost) {
        toast.error('Selected account does not have enough balance for this purchase');
        return;
      }

      const savedInvestment = await backendService.createInvestment({
        assetType: mapInvestmentType(formData.type),
        assetName: assetSymbol,
        quantity: formData.quantity,
        buyPrice: formData.purchasePrice,
        currentPrice: effectiveCurrentPrice,
        totalInvested: totalPurchaseCost,
        currentValue: nextCurrentValue,
        profitLoss: nextProfitLoss,
        purchaseDate: new Date(formData.date),
        lastUpdated: new Date(),
        updatedAt: new Date(),
        deletedAt: undefined,
        broker: formData.broker,
        description: formData.description,
        assetCurrency: resolvedAssetCurrency,
        baseCurrency: currency,
        buyFxRate,
        lastKnownFxRate: currentFxRate,
        totalInvestedNative: nextTotalInvested,
        currentValueNative: nextCurrentValueNative,
        valuationVersion: 2,
        positionStatus: 'open',
        fundingAccountId: fundingAccount.id,
        purchaseFees: formData.purchaseFees,
      });

      const localInvestmentId = Number(savedInvestment?.localId ?? savedInvestment?.id);
      const investmentLabel = displaySymbol(assetSymbol);
      const transactionDate = new Date(formData.date);
      const createdAt = new Date();
      let purchaseTransactionId: number | undefined;
      let purchaseFeeTransactionId: number | undefined;

      if (savedInvestment?.storage === 'local') {
        purchaseTransactionId = await db.transactions.add({
          type: 'expense',
          amount: assetCostInBaseCurrency,
          accountId: fundingAccount.id as number,
          category: 'Investment Purchase',
          subcategory: mapInvestmentType(formData.type),
          description: `Bought ${investmentLabel}`,
          merchant: formData.broker,
          date: transactionDate,
          tags: ['investment', 'purchase'],
          createdAt,
          updatedAt: createdAt,
        });

        if (formData.purchaseFees > 0) {
          purchaseFeeTransactionId = await db.transactions.add({
            type: 'expense',
            amount: formData.purchaseFees,
            accountId: fundingAccount.id as number,
            category: 'Investment Fees',
            subcategory: mapInvestmentType(formData.type),
            description: `Purchase fees for ${investmentLabel}`,
            merchant: formData.broker,
            date: transactionDate,
            tags: ['investment', 'fee'],
            createdAt,
            updatedAt: createdAt,
          });
        }
      } else {
        const savedPurchaseTransaction = await saveTransactionWithBackendSync({
          type: 'expense',
          amount: assetCostInBaseCurrency,
          accountId: fundingAccount.id as number,
          category: 'Investment Purchase',
          subcategory: mapInvestmentType(formData.type),
          description: `Bought ${investmentLabel}`,
          merchant: formData.broker,
          date: transactionDate,
          tags: ['investment', 'purchase'],
          createdAt,
          updatedAt: createdAt,
        });
        purchaseTransactionId = savedPurchaseTransaction.id;

        if (formData.purchaseFees > 0) {
          const savedFeeTransaction = await saveTransactionWithBackendSync({
            type: 'expense',
            amount: formData.purchaseFees,
            accountId: fundingAccount.id as number,
            category: 'Investment Fees',
            subcategory: mapInvestmentType(formData.type),
            description: `Purchase fees for ${investmentLabel}`,
            merchant: formData.broker,
            date: transactionDate,
            tags: ['investment', 'fee'],
            createdAt,
            updatedAt: createdAt,
          });
          purchaseFeeTransactionId = savedFeeTransaction.id;
        }
      }

      await db.transaction('rw', db.accounts, db.investments, async () => {
        await db.accounts.update(fundingAccount.id!, {
          balance: fundingAccount.balance - totalPurchaseCost,
          updatedAt: createdAt,
        });

        if (Number.isFinite(localInvestmentId)) {
          await db.investments.update(localInvestmentId, {
            cloudId: savedInvestment?.id ?? undefined,
            purchaseTransactionId,
            purchaseFeeTransactionId,
          });
        }
      });

      toast.success(savedInvestment?.storage === 'local'
        ? 'Investment added to your local portfolio'
        : 'Investment added successfully');
      refreshData();
      setCurrentPage('investments');
    } catch (error) {
      console.error('Failed to add investment:', error);
      toast.error('Failed to add investment');
    }
  };

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
      {!isDesktop ? (
        <div className="flex-1 flex flex-col bg-slate-50 relative min-h-screen mobile-safe-bottom">
          {/* Amount Card - Integrated and Premium */}
          <div className={cn("px-4 pb-8 rounded-b-[48px] shadow-2xl relative overflow-hidden shrink-0 text-white transition-all duration-500 mobile-safe-top-spacious", "bg-gradient-to-br from-[#FF2D85] via-[#FF1A75] to-[#E6005C]")}>
            {/* Background Sparkles */}
            <div className="absolute top-0 left-0 w-full h-full pointer-events-none opacity-20">
              <div className="absolute top-1/4 left-1/4 w-32 h-32 bg-white blur-[60px] rounded-full"></div>
              <div className="absolute bottom-1/4 right-1/4 w-32 h-32 bg-white blur-[60px] rounded-full"></div>
            </div>

            <div className="flex items-center justify-between mb-6 relative z-10">
              <button 
                type="button"
                onClick={() => setCurrentPage('investments')} 
                className="w-10 h-10 flex items-center justify-center bg-white/10 hover:bg-white/20 backdrop-blur-md rounded-full transition-all"
              >
                <ChevronLeft size={20} />
              </button>
              
              <div className="flex items-center gap-2">
                <button 
                  type="button"
                  onClick={handleSubmit} 
                  className="bg-white text-slate-900 px-6 h-10 rounded-xl text-[10px] font-black flex items-center gap-2 shadow-xl active:scale-95 transition-all uppercase tracking-[0.2em]"
                >
                  SAVE
                </button>
              </div>
            </div>

            <div className="mb-6 relative z-10 px-2">
              <div className="flex items-center gap-2 mb-1">
                 <div className="w-1.5 h-1.5 rounded-full bg-white/50 animate-pulse"></div>
                 <p className="text-white/60 text-[9px] font-black uppercase tracking-[0.3em]">INVESTMENT ENTRY</p>
              </div>
              <div className="flex items-baseline gap-2">
                <span className="text-2xl font-black text-white/30 tracking-tighter">{currency}</span>
                <div className="text-5xl font-black text-white outline-none w-full tracking-tighter">
                  {((formData.quantity || 0) * (formData.purchasePrice || 0) + (formData.purchaseFees || 0)).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                </div>
              </div>
            </div>

            {/* Quick Summary Bar */}
            <div className="flex gap-2 relative z-10 px-1">
              <div className="flex-1 bg-white/10 backdrop-blur-md rounded-2xl p-3 border border-white/10">
                <p className="text-[8px] font-black text-white/50 uppercase tracking-widest mb-1">Quantity</p>
                <p className="text-xs font-black text-white">{formData.quantity.toLocaleString()}</p>
              </div>
              <div className="flex-1 bg-white/10 backdrop-blur-md rounded-2xl p-3 border border-white/10">
                <p className="text-[8px] font-black text-white/50 uppercase tracking-widest mb-1">Asset Currency</p>
                <p className="text-xs font-black text-white">{assetCurrencyCode}</p>
              </div>
            </div>
          </div>

          {/* Main Content Area */}
          <form onSubmit={handleSubmit} className="flex-1 px-4 py-4 space-y-4 pb-24">
            {/* Core Details Card */}
            <div className="bg-white rounded-3xl p-5 shadow-sm border border-slate-100 space-y-6">
              <div className="space-y-4">
                <div className="space-y-2">
                  <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest px-1">Asset Type</p>
                  <SearchableDropdown
                    options={investmentTypeOptions}
                    value={formData.type}
                    onChange={handleInvestmentTypeChange}
                    placeholder="Select asset type"
                    searchPlaceholder="Search..."
                    grouped
                    className="min-h-[3.5rem]"
                  />
                </div>

                <div className="space-y-2 relative">
                  <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest px-1">Search Asset</p>
                  <div className="relative">
                    <input 
                      type="text" 
                      value={formData.name} 
                      onChange={(e) => { setSelectedSymbol(null); setQuoteSnapshot(null); setFormData(prev => ({ ...prev, name: e.target.value, currentPrice: 0 })); setShowSuggestions(true); }} 
                      onFocus={() => { if (formData.name.length >= 2) setShowSuggestions(true); }}
                      className="w-full min-h-[3.5rem] px-5 bg-slate-50 border-none rounded-2xl font-bold text-slate-900 placeholder:text-slate-300 focus:ring-4 focus:ring-indigo-500/5 transition-all" 
                      placeholder={formData.type === 'crypto' ? 'BTC, ETH...' : 'AAPL, INFY...'} 
                    />
                    {fetchingPrice && <Loader2 size={16} className="absolute right-4 top-1/2 -translate-y-1/2 animate-spin text-slate-400" />}
                  </div>
                  
                  {showSuggestions && (searchResults.length > 0 || searching) && (
                    <div className="absolute z-20 w-full mt-2 bg-white border border-slate-100 rounded-2xl shadow-2xl max-h-60 overflow-y-auto p-2">
                      {searching ? (
                        <div className="p-4 text-center text-[10px] font-black text-slate-400 uppercase tracking-widest flex items-center justify-center gap-2">
                          <Loader2 size={12} className="animate-spin" /> Searching...
                        </div>
                      ) : (
                        searchResults.map(result => (
                          <button
                            key={result.symbol}
                            type="button"
                            className="w-full text-left p-3 hover:bg-slate-50 rounded-xl transition-all border-b border-slate-50 last:border-0 group"
                            onClick={() => handleSelectStock(result)}
                          >
                            <p className="font-black text-xs text-slate-900 group-hover:text-indigo-600 transition-colors">{displaySymbol(result.symbol)}</p>
                            <p className="text-[9px] font-bold text-slate-400 uppercase tracking-tight truncate">{result.companyName}{result.exchange ? ` · ${result.exchange}` : ''}</p>
                          </button>
                        ))
                      )}
                    </div>
                  )}
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest px-1">Quantity</p>
                    <input 
                      type="number" 
                      step="0.0001" 
                      value={formData.quantity || ''} 
                      onChange={(e) => setFormData(prev => ({ ...prev, quantity: parseFloat(e.target.value) || 0 }))} 
                      className="w-full h-14 px-5 bg-slate-50 border-none rounded-2xl font-black text-sm text-slate-900" 
                      placeholder="0.00" 
                    />
                  </div>
                  <div className="space-y-2">
                    <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest px-1">Buy Price ({assetCurrency})</p>
                    <input 
                      type="number" 
                      step="0.01" 
                      value={formData.purchasePrice || ''} 
                      onChange={(e) => setFormData(prev => ({ ...prev, purchasePrice: parseFloat(e.target.value) || 0 }))} 
                      className="w-full h-14 px-5 bg-slate-50 border-none rounded-2xl font-black text-sm text-slate-900" 
                      placeholder="0.00" 
                    />
                  </div>
                </div>
              </div>
            </div>

            {/* Financial Details Card */}
            <div className="bg-white rounded-3xl p-5 shadow-sm border border-slate-100 space-y-6">
              <div className="space-y-5">
                <div className="space-y-2">
                  <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest px-1">Funding Account</p>
                  <SearchableDropdown
                    options={fundingAccountOptions}
                    value={formData.fundingAccountId ? String(formData.fundingAccountId) : ''}
                    onChange={(accountId) => setFormData(prev => ({ ...prev, fundingAccountId: parseInt(accountId, 10) || 0 }))}
                    placeholder="Select account"
                    className="h-14"
                  />
                </div>
                
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest px-1">Fees ({currency})</p>
                    <input 
                      type="number" 
                      step="0.01" 
                      value={formData.purchaseFees || ''} 
                      onChange={(e) => setFormData({ ...formData, purchaseFees: parseFloat(e.target.value) || 0 })} 
                      className="w-full h-14 px-5 bg-slate-50 border-none rounded-2xl font-black text-sm text-slate-900" 
                      placeholder="0.00" 
                    />
                  </div>
                  <div className="space-y-2">
                    <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest px-1">Date</p>
                    <input 
                      type="date" 
                      value={formData.date} 
                      onChange={(e) => setFormData({ ...formData, date: e.target.value })} 
                      className="w-full h-14 px-5 bg-slate-50 border-none rounded-2xl font-black text-sm text-slate-900 uppercase" 
                    />
                  </div>
                </div>

                <div className="space-y-2">
                  <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest px-1">Broker / Notes</p>
                  <input 
                    type="text" 
                    value={formData.broker} 
                    onChange={(e) => setFormData({ ...formData, broker: e.target.value })} 
                    className="w-full h-14 px-5 bg-slate-50 border-none rounded-2xl font-bold text-slate-900 placeholder:text-slate-300" 
                    placeholder="e.g. Fidelity, Zerodha" 
                  />
                </div>
              </div>
            </div>

            {/* Live Preview / Stats Card */}
            {(selectedSymbol || quoteSnapshot || (formData.quantity > 0 && formData.purchasePrice > 0)) && (
              <div className="bg-slate-900 rounded-[32px] p-6 shadow-2xl relative overflow-hidden text-white">
                <div className="absolute top-0 right-0 w-32 h-32 bg-white/5 blur-3xl rounded-full translate-x-1/2 -translate-y-1/2"></div>
                <div className="flex justify-between items-end relative z-10">
                   <div className="space-y-1">
                     <p className="text-[9px] font-black text-white/40 uppercase tracking-[0.2em]">Asset Preview</p>
                     <p className="text-2xl font-black tracking-tighter">{displaySymbol(selectedSymbol || formData.name)}</p>
                     {quoteSnapshot?.currentPrice && (
                       <p className="text-[10px] font-bold text-emerald-400 uppercase tracking-widest">Live: {formatNativeMoney(quoteSnapshot.currentPrice, assetCurrencyCode)}</p>
                     )}
                   </div>
                   <div className="text-right">
                     <p className="text-[9px] font-black text-white/40 uppercase tracking-[0.2em]">Total Cost</p>
                     <p className="text-2xl font-black tracking-tighter">
                       <span className="text-white/30 mr-1">{currency}</span>
                       {((formData.quantity || 0) * (formData.purchasePrice || 0) + (formData.purchaseFees || 0)).toLocaleString(undefined, { minimumFractionDigits: 2 })}
                     </p>
                   </div>
                </div>
              </div>
            )}
          </form>
        </div>
      ) : (
        <div className="flex-1 w-full bg-slate-50 min-h-screen flex flex-col items-center">
          <header className="w-full bg-white border-b border-slate-100 sticky top-0 z-30">
            <div className="layout-container layout-header">
              <div className="flex items-center gap-4">
                <div className="w-10 h-10 rounded-xl bg-slate-900 flex items-center justify-center shadow-lg">
                  <TrendingUp size={18} className="text-white" />
                </div>
                <div>
                  <h1 className="text-lg font-black text-slate-900 tracking-tighter uppercase">Add Investment</h1>
                </div>
              </div>
              <div className="flex items-center gap-3">
                <button 
                  type="button" 
                  onClick={() => setCurrentPage('investments')}
                  className="finora-btn finora-btn-secondary"
                >
                  <span>Cancel</span>
                </button>
                <button 
                  type="button"
                  onClick={handleSubmit}
                  className="finora-btn finora-btn-primary !bg-slate-900"
                >
                  <span>Save Asset</span>
                </button>
              </div>
            </div>
          </header>

          <main className="layout-container py-8">
            <div className="grid grid-cols-12 gap-8">
              {/* Left Column: Form Details */}
              <div className="lg:col-span-8 space-y-6">
                <div className="finora-card">
                <form onSubmit={handleSubmit} className="space-y-8">
                  {/* Row 1: Type & Search */}
                  <div className="grid grid-cols-12 gap-6">
                    <div className="col-span-4 space-y-3">
                      <p className="finora-label">Asset Category</p>
                      <SearchableDropdown
                        options={investmentTypeOptions}
                        value={formData.type}
                        onChange={handleInvestmentTypeChange}
                        placeholder="Select type"
                        grouped
                        className="h-16"
                      />
                    </div>
                    <div className="col-span-8 space-y-3 relative">
                      <p className="finora-label">Asset Search (Stock/Crypto)</p>
                      <div className="relative">
                        <input
                          type="text"
                          value={formData.name}
                          onChange={(e) => {
                            setSelectedSymbol(null);
                            setQuoteSnapshot(null);
                            setFormData(prev => ({ ...prev, name: e.target.value, currentPrice: 0 }));
                            setShowSuggestions(true);
                          }}
                          onFocus={() => { if (formData.name.length >= 2) setShowSuggestions(true); }}
                          className="finora-input h-16 text-lg"
                          placeholder={formData.type === 'crypto' ? "Search BTC, ETH, SOL..." : "Search AAPL, TSLA, RELIANCE..."}
                          required
                        />
                        {fetchingPrice && <Loader2 size={20} className="absolute right-6 top-1/2 -translate-y-1/2 animate-spin text-slate-400" />}
                      </div>

                      {/* Desktop Suggestions */}
                      {showSuggestions && (searchResults.length > 0 || searching) && (
                        <div className="absolute z-40 w-full mt-2 bg-white border border-slate-100 rounded-[32px] shadow-2xl max-h-80 overflow-y-auto p-3 ring-1 ring-black/5">
                          {searching ? (
                            <div className="p-8 text-center text-[11px] font-black text-slate-400 uppercase tracking-[0.2em] flex items-center justify-center gap-3">
                              <Loader2 size={16} className="animate-spin text-indigo-500" /> Searching Markets...
                            </div>
                          ) : (
                            searchResults.map(result => (
                              <button
                                key={result.symbol}
                                type="button"
                                className="w-full text-left p-4 hover:bg-slate-50 rounded-2xl transition-all border-b border-slate-50 last:border-0 group flex items-center justify-between"
                                onClick={() => handleSelectStock(result)}
                              >
                                <div>
                                  <p className="font-black text-base text-slate-900 group-hover:text-indigo-600 transition-colors">{displaySymbol(result.symbol)}</p>
                                  <p className="text-[10px] font-bold text-slate-400 uppercase tracking-tight">{result.companyName}{result.exchange ? ` · ${result.exchange}` : ''}</p>
                                </div>
                                <div className="w-8 h-8 rounded-full bg-slate-100 flex items-center justify-center group-hover:bg-indigo-600 group-hover:text-white transition-all">
                                   <TrendingUp size={14} />
                                </div>
                              </button>
                            ))
                          )}
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Row 2: Qty & Price */}
                  <div className="grid grid-cols-2 gap-8 pt-2">
                    <div className="space-y-3">
                      <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest px-1">Holdings Quantity</p>
                      <input
                        type="number"
                        step="0.0001"
                        value={formData.quantity || ''}
                        onChange={(e) => setFormData(prev => ({ ...prev, quantity: parseFloat(e.target.value) || 0 }))}
                        className="w-full h-16 px-6 bg-slate-50 border-none rounded-[24px] font-black text-xl text-slate-900 focus:ring-4 focus:ring-indigo-500/5 transition-all"
                        placeholder="0.0000"
                        required
                      />
                    </div>
                    <div className="space-y-3">
                      <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest px-1">Buy Price Per Unit ({assetCurrency})</p>
                      <div className="relative">
                         <span className="absolute left-6 top-1/2 -translate-y-1/2 text-slate-300 font-black text-lg">{assetCurrency}</span>
                         <input
                          type="number"
                          step="0.01"
                          value={formData.purchasePrice || ''}
                          onChange={(e) => setFormData(prev => ({ ...prev, purchasePrice: parseFloat(e.target.value) || 0 }))}
                          className="w-full h-16 pl-14 pr-6 bg-slate-50 border-none rounded-[24px] font-black text-xl text-slate-900 focus:ring-4 focus:ring-indigo-500/5 transition-all"
                          placeholder="0.00"
                          required
                        />
                      </div>
                    </div>
                  </div>

                  {/* Row 3: Account & Date */}
                  <div className="grid grid-cols-2 gap-8">
                    <div className="space-y-3">
                      <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest px-1">Payment Source</p>
                      <SearchableDropdown
                        options={fundingAccountOptions}
                        value={formData.fundingAccountId ? String(formData.fundingAccountId) : ''}
                        onChange={(accountId) => setFormData(prev => ({ ...prev, fundingAccountId: parseInt(accountId, 10) || 0 }))}
                        placeholder="Select funding account"
                        className="h-16"
                      />
                    </div>
                    <div className="space-y-3">
                      <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest px-1">Acquisition Date</p>
                      <input
                        type="date"
                        value={formData.date}
                        onChange={(e) => setFormData(prev => ({ ...prev, date: e.target.value }))}
                        className="w-full h-16 px-6 bg-slate-50 border-none rounded-[24px] font-black text-sm text-slate-900 focus:ring-4 focus:ring-indigo-500/5 transition-all uppercase"
                        required
                      />
                    </div>
                  </div>

                  {/* Row 4: Fees & Broker */}
                  <div className="grid grid-cols-2 gap-8">
                    <div className="space-y-3">
                      <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest px-1">Transaction Fees ({currency})</p>
                      <input
                        type="number"
                        step="0.01"
                        value={formData.purchaseFees || ''}
                        onChange={(e) => setFormData(prev => ({ ...prev, purchaseFees: parseFloat(e.target.value) || 0 }))}
                        className="w-full h-16 px-6 bg-slate-50 border-none rounded-[24px] font-black text-sm text-slate-900 focus:ring-4 focus:ring-indigo-500/5 transition-all"
                        placeholder="0.00"
                      />
                    </div>
                    <div className="space-y-3">
                      <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest px-1">Brokerage / Platform</p>
                      <input
                        type="text"
                        value={formData.broker}
                        onChange={(e) => setFormData(prev => ({ ...prev, broker: e.target.value }))}
                        className="w-full h-16 px-6 bg-slate-50 border-none rounded-[24px] font-bold text-sm text-slate-900 placeholder:text-slate-300 focus:ring-4 focus:ring-indigo-500/5 transition-all"
                        placeholder="e.g. Fidelity, Zerodha, Binance"
                      />
                    </div>
                  </div>
                </form>
              </div>
            </div>

            {/* Right Column: Summaries & Live Data */}
            <div className="lg:col-span-4 space-y-6">
              {/* Asset Snapshot Card */}
              <div className="bg-slate-900 rounded-[40px] p-8 shadow-2xl relative overflow-hidden text-white min-h-[300px] flex flex-col justify-between">
                <div className="absolute top-0 right-0 w-64 h-64 bg-white/5 blur-[100px] rounded-full translate-x-1/2 -translate-y-1/2"></div>
                
                <div className="relative z-10 space-y-6">
                   <div>
                     <p className="text-[10px] font-black text-white/40 uppercase tracking-[0.3em] mb-2">Live Valuation</p>
                     <div className="flex items-baseline gap-2">
                       <span className="text-3xl font-black text-white/30 tracking-tighter">{currency}</span>
                       <p className="text-5xl font-black tracking-tighter">
                         {((formData.quantity || 0) * (formData.purchasePrice || 0) + (formData.purchaseFees || 0)).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                       </p>
                     </div>
                   </div>

                   <div className="h-[1px] bg-white/10 w-full"></div>

                   <div className="space-y-4">
                      <div className="flex justify-between items-center">
                        <p className="text-[9px] font-black text-white/40 uppercase tracking-widest">Asset Name</p>
                        <p className="text-xs font-black uppercase tracking-tight">{displaySymbol(selectedSymbol || formData.name || '---')}</p>
                      </div>
                      <div className="flex justify-between items-center">
                        <p className="text-[9px] font-black text-white/40 uppercase tracking-widest">Current Unit Price</p>
                        <p className="text-xs font-black text-emerald-400">
                          {quoteSnapshot?.currentPrice ? formatNativeMoney(quoteSnapshot.currentPrice, assetCurrencyCode) : '---'}
                        </p>
                      </div>
                      <div className="flex justify-between items-center">
                        <p className="text-[9px] font-black text-white/40 uppercase tracking-widest">Total Quantity</p>
                        <p className="text-xs font-black">{formData.quantity.toLocaleString()}</p>
                      </div>
                   </div>
                </div>

                <div className="relative z-10 pt-4">
                  <div className="bg-white/10 backdrop-blur-md rounded-2xl p-4 border border-white/10 flex items-center gap-4">
                    <div className="w-10 h-10 rounded-xl bg-white/10 flex items-center justify-center">
                      <TrendingUp size={18} className="text-indigo-400" />
                    </div>
                    <div>
                      <p className="text-[9px] font-black text-white/40 uppercase tracking-widest leading-none mb-1">Potential Gain</p>
                      <p className={cn("text-base font-black tracking-tight", investmentGain >= 0 ? "text-emerald-400" : "text-rose-400")}>
                        {investmentGain >= 0 ? '+' : ''}{investmentGain.toLocaleString(undefined, { style: 'currency', currency: assetCurrencyCode })}
                      </p>
                    </div>
                  </div>
                </div>
              </div>

              {/* Action Helper */}
              <div className="bg-indigo-50 rounded-[32px] p-6 border border-indigo-100/50">
                 <p className="text-[10px] font-black text-indigo-400 uppercase tracking-widest mb-3 px-1">Smart Tip</p>
                 <p className="text-xs font-bold text-indigo-900/70 leading-relaxed italic">
                   "Investing regularly in small amounts is often safer than trying to time the market. Ensure your funding account has enough liquidity before proceeding."
                 </p>
              </div>
            </div>
          </div>
        </main>
      </div>
    )}
  </>
  );
};

