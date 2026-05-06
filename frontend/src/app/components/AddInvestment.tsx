import React, { useCallback, useEffect, useRef, useState } from 'react';
import { useApp } from '@/contexts/AppContext';
import { PageHeader } from '@/app/components/ui/PageHeader';
import { SearchableDropdown } from '@/app/components/ui/SearchableDropdown';
import { backendService } from '@/lib/backend-api';
import { saveTransactionWithBackendSync } from '@/lib/auth-sync-integration';
import { db } from '@/lib/database';
import { TrendingUp, Loader2, RefreshCw, ChevronLeft } from 'lucide-react';

import { toast } from 'sonner';
import { searchStocks, fetchStockQuote, StockQuote, StockSearchResult, displaySymbol } from '@/lib/stockApi';
import { formatNativeMoney, getCurrencySymbol, normalizeCurrencyCode } from '@/lib/currencyUtils';
import { fetchCurrencyConversionRate } from '@/lib/investmentUtils';

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
  const [formData, setFormData] = useState({
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
  });

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
        <div className="w-full min-h-[100dvh] bg-[radial-gradient(circle_at_top_left,#dbeafe_0%,#eef2ff_28%,#f8fafc_56%,#f8fafc_100%)] py-4 lg:py-7 font-sans flex flex-col">

        {/* Header */}
        <div className="flex items-center justify-between px-4 pt-5 pb-4 border-b border-gray-100">
          <button type="button" onClick={() => setCurrentPage('investments')}
            className="w-9 h-9 rounded-xl border border-gray-200 bg-white flex items-center justify-center text-gray-500 hover:bg-gray-50 transition-all shadow-sm">
            <TrendingUp size={16} className="rotate-180" />
          </button>
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-xl bg-gradient-to-br from-indigo-500 to-violet-600 flex items-center justify-center shadow-sm">
              <TrendingUp size={15} className="text-white" />
            </div>
            <div>
              <h1 className="text-base font-black text-gray-900 leading-tight">Add Investment</h1>
              <p className="text-[11px] text-gray-400">Add this asset to your portfolio</p>
            </div>
          </div>
          <button type="button" onClick={() => setCurrentPage('investments')}
            className="px-3 py-1.5 rounded-xl border border-gray-200 text-xs font-semibold text-gray-500 hover:bg-gray-50">
            Cancel
          </button>
        </div>

        <form onSubmit={handleSubmit} className="flex-1 flex flex-col overflow-y-auto">
          <div className="flex-1 px-4 py-4 space-y-4">

            {/* Type */}
            <div className="backdrop-blur-xl border border-white/40 shadow-glass rounded-[30px] p-4">
              <SearchableDropdown
                label="Asset Type"
                options={investmentTypeOptions}
                value={formData.type}
                onChange={handleInvestmentTypeChange}
                placeholder="Select asset type"
                searchPlaceholder="Search investment type..."
                grouped
                required
              />
            </div>

            {/* Asset Name / Search */}
            <div className="backdrop-blur-xl border border-white/40 shadow-glass rounded-[30px] p-4">
              {isMarketAsset ? (
                <div className="relative">
                  <label className="block text-[11px] font-bold uppercase tracking-widest text-gray-400 mb-2">
                    {formData.type === 'crypto' ? 'Crypto Asset *' : 'Stock *'}
                  </label>
                  <div className="relative">
                    <input type="text" value={formData.name}
                      onChange={(e) => { setSelectedSymbol(null); setQuoteSnapshot(null); setFormData(prev => ({ ...prev, name: e.target.value, currentPrice: 0 })); setShowSuggestions(true); }}
                      onFocus={() => { if (formData.name.length >= 2) setShowSuggestions(true); }}
                      className="w-full px-3 py-2.5 bg-gray-50 border border-gray-100 rounded-xl text-sm font-medium text-gray-900 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:bg-white transition-all placeholder:text-gray-300"
                      placeholder={formData.type === 'crypto' ? 'Search BTC, ETH, SOL...' : 'Search AAPL, INFY, RELIANCE...'} required />
                    {fetchingPrice && <Loader2 size={16} className="absolute right-3 top-1/2 -translate-y-1/2 animate-spin text-gray-400" />}
                  </div>
                  {showSuggestions && (searchResults.length > 0 || searching) && (
                    <div className="absolute z-10 w-full mt-1 bg-white border border-gray-200 rounded-xl shadow-lg max-h-52 overflow-y-auto">
                      {searching ? (
                        <div className="p-4 text-center text-sm text-gray-500 flex items-center justify-center gap-2"><Loader2 size={14} className="animate-spin" /> Searching...</div>
                      ) : searchResults.map(r => (
                        <button key={r.symbol} type="button" onClick={() => handleSelectStock(r)}
                          className="w-full text-left px-4 py-3 hover:bg-gray-50 flex flex-col border-b border-gray-50 last:border-0">
                          <span className="font-bold text-sm text-gray-900">{displaySymbol(r.symbol)}</span>
                          <span className="text-xs text-gray-500">{r.companyName}{r.exchange ? '  ' + r.exchange : ''}</span>
                        </button>
                      ))}
                    </div>
                  )}
                  {(selectedSymbol || quoteSnapshot) && (
                    <div className="mt-3 rounded-xl border border-gray-100 bg-indigo-50/50 p-3">
                      <div className="flex items-start justify-between gap-2">
                        <div className="min-w-0">
                          <p className="font-bold text-sm text-gray-900 truncate">{displaySymbol(selectedSymbol || formData.name)}</p>
                          <p className="text-xs text-gray-500 truncate">{quoteSnapshot?.companyName || formData.name}{quoteSnapshot?.exchange ? '  ' + quoteSnapshot.exchange : ''}</p>
                        </div>
                        {selectedSymbol && (
                          <button type="button" onClick={() => loadLiveQuote(selectedSymbol, formData.type === 'crypto' ? 'crypto' : 'stocks')}
                            className="shrink-0 flex items-center gap-1 rounded-lg border border-gray-200 bg-white px-2.5 py-1.5 text-xs font-semibold text-gray-700 hover:bg-gray-50">
                            <RefreshCw size={12} className={fetchingPrice ? 'animate-spin' : ''} /> Refresh
                          </button>
                        )}
                      </div>
                      {quoteSnapshot?.currentPrice && (
                        <div className="mt-2 flex items-center gap-2">
                          <div className="bg-white rounded-lg px-3 py-1.5 border border-gray-100">
                            <p className="text-[10px] font-bold uppercase tracking-wide text-gray-400">Live</p>
                            <p className="text-sm font-black text-gray-900">{formatNativeMoney(quoteSnapshot.currentPrice, assetCurrencyCode)}</p>
                          </div>
                          <div className="bg-white rounded-lg px-3 py-1.5 border border-gray-100">
                            <p className="text-[10px] font-bold uppercase tracking-wide text-gray-400">Market</p>
                            <p className="text-sm font-semibold text-gray-900">{quoteSnapshot.marketState === 'open' ? 'Open' : quoteSnapshot.marketState === 'closed' ? 'Closed' : quoteSnapshot.exchange || '-'}</p>
                          </div>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              ) : (
                <div>
                  <label className="block text-[11px] font-bold uppercase tracking-widest text-gray-400 mb-2">Investment Name *</label>
                  <input type="text" value={formData.name}
                    onChange={(e) => setFormData(prev => ({ ...prev, name: e.target.value }))}
                    className="w-full px-3 py-2.5 bg-gray-50 border border-gray-100 rounded-xl text-sm font-medium text-gray-900 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:bg-white transition-all placeholder:text-gray-300"
                    placeholder="e.g., Gold, Bonds, Real Estate" required />
                </div>
              )}
            </div>

            {/* Qty + Price */}
            <div className="backdrop-blur-xl border border-white/40 shadow-glass rounded-[30px] p-4">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-[11px] font-bold uppercase tracking-widest text-gray-400 mb-2">Quantity *</label>
                  <input type="number" step="0.0001" value={formData.quantity || ''}
                    onChange={(e) => setFormData(prev => ({ ...prev, quantity: parseFloat(e.target.value) || 0 }))}
                    className="w-full px-3 py-2.5 bg-gray-50 border border-gray-100 rounded-xl text-sm font-bold text-gray-900 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:bg-white transition-all"
                    placeholder="0.00" required />
                </div>
                <div>
                  <label className="block text-[11px] font-bold uppercase tracking-widest text-gray-400 mb-2">Buy Price *</label>
                  <div className="flex items-center gap-2 bg-gray-50 border border-gray-100 rounded-xl px-3 py-2.5 focus-within:ring-2 focus-within:ring-indigo-500/20 focus-within:bg-white transition-all">
                    <span className="text-xs font-bold text-gray-400">{assetCurrency}</span>
                    <input type="number" step="0.01" value={formData.purchasePrice || ''}
                      onChange={(e) => setFormData(prev => ({ ...prev, purchasePrice: parseFloat(e.target.value) || 0 }))}
                      className="flex-1 bg-transparent text-sm font-bold text-gray-900 outline-none" placeholder="0.00" required />
                  </div>
                </div>
              </div>
              {!isMarketAsset && (
                <div className="mt-3">
                  <label className="block text-[11px] font-bold uppercase tracking-widest text-gray-400 mb-2">Current Price *</label>
                  <div className="flex items-center gap-2 bg-gray-50 border border-gray-100 rounded-xl px-3 py-2.5 focus-within:ring-2 focus-within:ring-indigo-500/20 focus-within:bg-white transition-all">
                    <span className="text-xs font-bold text-gray-400">{assetCurrency}</span>
                    <input type="number" step="0.01" value={formData.currentPrice || ''}
                      onChange={(e) => setFormData(prev => ({ ...prev, currentPrice: parseFloat(e.target.value) || 0 }))}
                      className="flex-1 bg-transparent text-sm font-bold text-gray-900 outline-none" placeholder="0.00" required />
                  </div>
                </div>
              )}
            </div>

            {/* Portfolio preview */}
            {formData.quantity > 0 && formData.purchasePrice > 0 && (
              <div className="grid grid-cols-3 gap-2">
                {[
                  { label: 'Invested', value: formatNativeMoney(totalInvested, assetCurrencyCode), cls: 'bg-indigo-50 border-indigo-100 text-indigo-900' },
                  { label: 'Current', value: formatNativeMoney(currentValue, assetCurrencyCode), cls: 'bg-white border-gray-100 text-gray-900' },
                  { label: investmentGain >= 0 ? 'Profit' : 'Loss', value: (investmentGain >= 0 ? '+' : '-') + formatNativeMoney(Math.abs(investmentGain), assetCurrencyCode), cls: investmentGain >= 0 ? 'bg-emerald-50 border-emerald-100 text-emerald-800' : 'bg-rose-50 border-rose-100 text-rose-800' },
                ].map(({ label, value, cls }) => (
                  <div key={label} className={'rounded-xl border p-3 ' + cls}>
                    <p className="text-[10px] font-bold uppercase tracking-wide opacity-70">{label}</p>
                    <p className="text-xs font-black mt-0.5 break-all">{value}</p>
                  </div>
                ))}
              </div>
            )}

            {/* Account + Fees + Date + Notes */}
            <div className="backdrop-blur-xl border border-white/40 shadow-glass rounded-[30px] p-4 space-y-3">
              <div>
                <label className="block text-[11px] font-bold uppercase tracking-widest text-gray-400 mb-2">Payment Account *</label>
                <SearchableDropdown
                  options={fundingAccountOptions}
                  value={formData.fundingAccountId ? String(formData.fundingAccountId) : ''}
                  onChange={(accountId) => setFormData(prev => ({ ...prev, fundingAccountId: parseInt(accountId, 10) || 0 }))}
                  placeholder="Select an account"
                  searchPlaceholder="Search accounts..."
                  grouped
                  required
                />
                {activeAccounts.length === 0 && <p className="mt-1 text-xs text-rose-600">Add an active account first.</p>}
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-[11px] font-bold uppercase tracking-widest text-gray-400 mb-2">Fees</label>
                  <div className="flex items-center gap-2 bg-gray-50 border border-gray-100 rounded-xl px-3 py-2.5 focus-within:ring-2 focus-within:ring-indigo-500/20 focus-within:bg-white transition-all">
                    <span className="text-xs font-bold text-gray-400">{currency}</span>
                    <input type="number" step="0.01" min="0" value={formData.purchaseFees || ''}
                      onChange={(e) => setFormData(prev => ({ ...prev, purchaseFees: parseFloat(e.target.value) || 0 }))}
                      className="flex-1 bg-transparent text-sm font-bold text-gray-900 outline-none" placeholder="0.00" />
                  </div>
                </div>
                <div>
                  <label className="block text-[11px] font-bold uppercase tracking-widest text-gray-400 mb-2">Purchase Date *</label>
                  <input type="date" value={formData.date}
                    onChange={(e) => setFormData(prev => ({ ...prev, date: e.target.value }))}
                    className="w-full px-3 py-2.5 bg-gray-50 border border-gray-100 rounded-xl text-sm font-medium text-gray-900 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:bg-white transition-all"
                    required aria-label="Investment Date" title="Investment Date" />
                </div>
              </div>
              <div>
                <label className="block text-[11px] font-bold uppercase tracking-widest text-gray-400 mb-2">Broker <span className="normal-case font-normal">(optional)</span></label>
                <input type="text" value={formData.broker}
                  onChange={(e) => setFormData(prev => ({ ...prev, broker: e.target.value }))}
                  className="w-full px-3 py-2.5 bg-gray-50 border border-gray-100 rounded-xl text-sm font-medium text-gray-900 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:bg-white transition-all placeholder:text-gray-300"
                  placeholder="e.g., Zerodha, Fidelity, Groww" />
              </div>
              <div>
                <label className="block text-[11px] font-bold uppercase tracking-widest text-gray-400 mb-2">Notes <span className="normal-case font-normal">(optional)</span></label>
                <textarea value={formData.description}
                  onChange={(e) => setFormData(prev => ({ ...prev, description: e.target.value }))}
                  className="w-full px-3 py-2.5 bg-gray-50 border border-gray-100 rounded-xl text-sm font-medium text-gray-900 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:bg-white resize-none transition-all placeholder:text-gray-300"
                  placeholder="Add a note if needed" rows={2} />
              </div>
            </div>
          </div>

          {/* Bottom action bar */}
          <div className="sticky bottom-0 bg-white border-t border-gray-100 px-4 py-4 flex gap-3">
            <button type="button" onClick={() => setCurrentPage('investments')}
              className="px-5 py-3 rounded-xl border-2 border-gray-200 text-sm font-bold text-gray-600 hover:bg-gray-50 transition-all">
              Cancel
            </button>
            <button type="submit"
              className="flex-1 py-3 rounded-xl bg-gradient-to-r from-indigo-600 to-violet-600 text-white text-sm font-black shadow-md flex items-center justify-center gap-2">
              <TrendingUp size={15} /> Add to Portfolio
            </button>
          </div>
        </form>
      </div>
      ) : (
        <div className="w-full min-h-[100dvh] bg-[radial-gradient(circle_at_top_left,#dbeafe_0%,#eef2ff_28%,#f8fafc_56%,#f8fafc_100%)] py-4 lg:py-7 font-sans flex flex-col items-start justify-start p-8">
          <div className="w-full max-w-[800px] mx-auto">
            <div className="mb-6 flex items-center gap-3">
              <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-indigo-500 to-violet-600 flex items-center justify-center shadow-md">
                <TrendingUp size={16} className="text-white" />
              </div>
              <div>
                <h1 className="text-xl font-bold text-gray-900">Add Investment</h1>
                <p className="text-xs text-gray-500">Smart entry for stocks, crypto, and real estate.</p>
              </div>
            </div>

            <div className="bg-white rounded-lg p-8 shadow-xl shadow-gray-200/40 border border-gray-100">
              <form onSubmit={handleSubmit} className="flex flex-col gap-6">
                
                {/* Primary Horizontal Action Bar */}
                <div className="flex flex-wrap items-end gap-4">
                  
                  {/* 1. Asset Type */}
                  <div className="w-[180px] shrink-0">
                    <SearchableDropdown
                      label="Asset Type"
                      options={investmentTypeOptions}
                      value={formData.type}
                      onChange={handleInvestmentTypeChange}
                      placeholder="Select type"
                      searchPlaceholder="Search investment type..."
                      grouped
                    />
                  </div>

                  {/* 2. Asset Name / Search */}
                  <div className="flex-1 min-w-[200px] relative">
                    <label className="block text-xs font-bold uppercase tracking-widest text-gray-400 mb-2 ml-1">Asset Search</label>
                    <div className="flex items-center bg-white border border-gray-200 focus-within:ring-2 focus-within:ring-black focus-within:border-black rounded-2xl px-4 py-4 transition-all">
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
                        className="w-full bg-transparent text-sm font-bold text-gray-900 border-none outline-none placeholder:text-gray-400"
                        placeholder={formData.type === 'crypto' ? "Search BTC, ETH..." : "Search AAPL, INFY..."}
                        required
                      />
                      {fetchingPrice && <Loader2 size={16} className="animate-spin text-gray-400 ml-2" />}
                    </div>
                    {/* Suggestions Dropdown */}
                    {showSuggestions && (searchResults.length > 0 || searching) && (
                      <div className="absolute z-20 w-full mt-2 bg-white border border-gray-200 rounded-xl shadow-2xl max-h-60 overflow-y-auto">
                        {searching ? (
                          <div className="p-4 text-center text-sm text-gray-500 flex items-center justify-center gap-2">
                            <Loader2 size={14} className="animate-spin" /> Searching...
                          </div>
                        ) : (
                          searchResults.map(result => (
                            <button
                              key={result.symbol}
                              type="button"
                              className="w-full text-left px-4 py-3 hover:bg-white flex flex-col border-b border-gray-50 last:border-0"
                              onClick={() => handleSelectStock(result)}
                            >
                              <span className="font-bold text-sm text-gray-900">{displaySymbol(result.symbol)}</span>
                              <span className="text-xs text-gray-500">{result.companyName}{result.exchange ? `  ${result.exchange}` : ''}</span>
                            </button>
                          ))
                        )}
                      </div>
                    )}
                  </div>

                  {/* 3. Quantity */}
                  <div className="w-[140px] shrink-0">
                    <label className="block text-xs font-bold uppercase tracking-widest text-gray-400 mb-2 ml-1">Quantity</label>
                    <input
                      type="number"
                      step="0.0001"
                      min="0"
                      value={formData.quantity || ''}
                      onChange={(e) => setFormData(prev => ({ ...prev, quantity: parseFloat(e.target.value) || 0 }))}
                      className="w-full bg-white border border-gray-200 focus:ring-2 focus:ring-black focus:border-black rounded-2xl py-4 px-4 text-sm font-bold text-gray-900 outline-none"
                      placeholder="0.00"
                      required
                    />
                  </div>

                  {/* 4. Buy Price Per Unit */}
                  <div className="w-[160px] shrink-0">
                    <label className="block text-xs font-bold uppercase tracking-widest text-gray-400 mb-2 ml-1">Buy Price</label>
                    <div className="flex items-center bg-white border border-gray-200 focus-within:ring-2 focus-within:ring-black focus-within:border-black rounded-2xl px-4 py-4 transition-all">
                      <span className="text-gray-500 font-bold mr-2 text-xs">{assetCurrency}</span>
                      <input
                        type="number"
                        step="0.01"
                        min="0"
                        value={formData.purchasePrice || ''}
                        onChange={(e) => setFormData(prev => ({ ...prev, purchasePrice: parseFloat(e.target.value) || 0 }))}
                        className="w-full bg-transparent text-sm font-bold text-gray-900 border-none outline-none placeholder:text-gray-300"
                        placeholder="0.00"
                        required
                      />
                    </div>
                  </div>

                  {/* 5. Submit Action */}
                  <div className="shrink-0 pt-6">
                    <button
                      type="submit"
                      className="h-14 px-8 rounded-2xl bg-gradient-to-r from-indigo-600 to-violet-600 text-white font-bold shadow-lg hover:from-indigo-700 hover:to-violet-700 hover:shadow-xl transition-all active:scale-95 flex items-center gap-2"
                    >
                      <TrendingUp size={18} />
                      Add
                    </button>
                  </div>
                </div>

                {/* Secondary Options Bar */}
                <div className="flex flex-wrap gap-4 border-t border-gray-100 pt-6">
                   {/* Payment Account */}
                   <div className="w-[200px] shrink-0">
                      <SearchableDropdown
                        label="Payment Account"
                        options={fundingAccountOptions}
                        value={formData.fundingAccountId ? String(formData.fundingAccountId) : ''}
                        onChange={(accountId) => setFormData(prev => ({ ...prev, fundingAccountId: parseInt(accountId, 10) || 0 }))}
                        placeholder="Select account"
                        searchPlaceholder="Search accounts..."
                        grouped
                        required
                      />
                   </div>
                   
                   {/* Fees */}
                   <div className="w-[140px] shrink-0">
                      <label className="block text-xs font-bold uppercase tracking-widest text-gray-400 mb-2 ml-1">Fees</label>
                      <div className="flex items-center bg-white border border-gray-200 focus-within:ring-2 focus-within:ring-black focus-within:border-black rounded-xl px-3 py-3 transition-all">
                        <span className="text-gray-500 font-bold mr-2 text-xs">{currency}</span>
                        <input
                          type="number"
                          step="0.01"
                          min="0"
                          value={formData.purchaseFees || ''}
                          onChange={(e) => setFormData({ ...formData, purchaseFees: parseFloat(e.target.value) || 0 })}
                          className="w-full bg-transparent text-sm font-bold text-gray-900 border-none outline-none placeholder:text-gray-300"
                          placeholder="0.00"
                        />
                      </div>
                   </div>

                   {/* Date */}
                   <div className="w-[140px] shrink-0">
                      <label className="block text-xs font-bold uppercase tracking-widest text-gray-400 mb-2 ml-1">Date</label>
                      <input
                        type="date"
                        value={formData.date}
                        onChange={(e) => setFormData({ ...formData, date: e.target.value })}
                        className="w-full bg-white border border-gray-200 focus:ring-2 focus:ring-black focus:border-black rounded-xl py-3 px-3 text-sm font-bold text-gray-900 outline-none"
                        required
                      />
                   </div>

                   {/* Description / Broker */}
                   <div className="flex-1">
                      <label className="block text-xs font-bold uppercase tracking-widest text-gray-400 mb-2 ml-1">Broker / Notes</label>
                      <input
                        type="text"
                        value={formData.broker}
                        onChange={(e) => setFormData({ ...formData, broker: e.target.value })}
                        className="w-full bg-white border border-gray-200 focus:ring-2 focus:ring-black focus:border-black rounded-xl py-3 px-3 text-sm font-bold text-gray-900 outline-none transition-all placeholder:font-medium placeholder:text-gray-400"
                        placeholder="e.g., Fidelity, Zerodha..."
                      />
                   </div>
                </div>

                {/* Smart Portfolio Preview UI */}
                {(selectedSymbol || quoteSnapshot || (formData.quantity > 0 && formData.purchasePrice > 0)) && (
                  <div className="mt-2 rounded-2xl border border-gray-200 bg-white p-6">
                    <div className="flex items-start justify-between">
                      <div className="flex flex-col gap-1">
                        <p className="text-[11px] font-bold uppercase tracking-[0.2em] text-gray-400">Live Preview</p>
                        <p className="text-xl font-bold text-gray-900">
                           {displaySymbol(selectedSymbol || formData.name)}
                           {quoteSnapshot?.currentPrice && (
                              <span className="text-sm font-semibold text-gray-500 ml-2 border-l border-gray-300 pl-2">
                                 {formatNativeMoney(quoteSnapshot.currentPrice, assetCurrencyCode)} / unit
                              </span>
                           )}
                        </p>
                      </div>
                      <div className="text-right">
                         <p className="text-[11px] font-bold uppercase tracking-[0.2em] text-gray-400">Total Invested</p>
                         <p className="text-xl font-bold text-gray-900">
                            {currency} {((formData.quantity || 0) * (formData.purchasePrice || 0) + (formData.purchaseFees || 0)).toFixed(2)}
                         </p>
                      </div>
                    </div>
                  </div>
                )}
              </form>
            </div>
          </div>
        </div>
      )}
    </>
  );
};

