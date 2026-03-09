import React, { useCallback, useEffect, useRef, useState } from 'react';
import { useApp } from '@/contexts/AppContext';
import { CenteredLayout } from '@/app/components/CenteredLayout';
import { PageHeader } from '@/app/components/ui/PageHeader';
import { backendService } from '@/lib/backend-api';
import { queueTransactionInsertSync } from '@/lib/auth-sync-integration';
import { db } from '@/lib/database';
import { TrendingUp, Loader2, RefreshCw } from 'lucide-react';
import { toast } from 'sonner';
import { searchStocks, fetchStockQuote, StockQuote, StockSearchResult, displaySymbol } from '@/lib/stockApi';
import { formatNativeMoney, getCurrencySymbol, normalizeCurrencyCode } from '@/lib/currencyUtils';
import { fetchCurrencyConversionRate } from '@/lib/investmentUtils';

const PENDING_INVESTMENT_DRAFT_KEY = 'pendingInvestmentDraft';

type InvestmentFormType = 'stocks' | 'bonds' | 'mutual-funds' | 'real-estate' | 'crypto' | 'other';

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

  useEffect(() => {
    if (formData.fundingAccountId || !activeAccounts.length) {
      return;
    }

    setFormData((prev) => ({
      ...prev,
      fundingAccountId: activeAccounts[0]?.id || 0,
    }));
  }, [activeAccounts, formData.fundingAccountId]);

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

      await db.transaction('rw', db.accounts, db.transactions, db.investments, async () => {
        purchaseTransactionId = await db.transactions.add({
          type: 'expense',
          amount: assetCostInBaseCurrency,
          accountId: fundingAccount.id!,
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
            accountId: fundingAccount.id!,
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

        await db.accounts.update(fundingAccount.id!, {
          balance: fundingAccount.balance - totalPurchaseCost,
          updatedAt: createdAt,
        });

        if (Number.isFinite(localInvestmentId)) {
          await db.investments.update(localInvestmentId, {
            purchaseTransactionId,
            purchaseFeeTransactionId,
          });
        }
      });

      if (purchaseTransactionId) {
        queueTransactionInsertSync(purchaseTransactionId, {
          type: 'expense',
          amount: assetCostInBaseCurrency,
          accountId: fundingAccount.id!,
          category: 'Investment Purchase',
          subcategory: mapInvestmentType(formData.type),
          description: `Bought ${investmentLabel}`,
          merchant: formData.broker,
          date: transactionDate,
        });
      }

      if (purchaseFeeTransactionId) {
        queueTransactionInsertSync(purchaseFeeTransactionId, {
          type: 'expense',
          amount: formData.purchaseFees,
          accountId: fundingAccount.id!,
          category: 'Investment Fees',
          subcategory: mapInvestmentType(formData.type),
          description: `Purchase fees for ${investmentLabel}`,
          merchant: formData.broker,
          date: transactionDate,
        });
      }

      if (Number.isFinite(localInvestmentId)) {
        try {
          await backendService.updateInvestment(String(localInvestmentId), {
            purchaseTransactionId,
            purchaseFeeTransactionId,
            fundingAccountId: fundingAccount.id,
            purchaseFees: formData.purchaseFees,
          });
        } catch (syncError) {
          console.error('Failed to sync purchase transaction metadata:', syncError);
        }
      }

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

  return (
    <CenteredLayout>
      <div className="space-y-6 max-w-[560px] w-full mx-auto pb-8">
        <PageHeader
          title="Add Investment"
          subtitle="Add this asset to your portfolio"
          icon={<TrendingUp size={20} className="sm:w-6 sm:h-6" />}
          showBack
          backTo="investments"
        />

        <div className="bg-white rounded-2xl border border-gray-200 p-6 sm:p-8 shadow-sm">
          <form onSubmit={handleSubmit} className="space-y-6">
            <div>
              <label className="block text-sm font-semibold text-gray-900 mb-3">Type *</label>
              <select
                value={formData.type}
                onChange={(e) => {
                  const nextType = e.target.value as InvestmentFormType;
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
                }}
                className="w-full px-4 py-3 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500 bg-gray-50"
                aria-label="Investment Type"
                title="Investment Type"
              >
                <option value="stocks">Stocks</option>
                <option value="crypto">Cryptocurrency</option>
                <option value="bonds">Bonds</option>
                <option value="mutual-funds">Mutual Funds</option>
                <option value="real-estate">Real Estate</option>
                <option value="other">Other</option>
              </select>
            </div>

            {isMarketAsset ? (
              <>
                <div className="relative">
                  <label className="block text-sm font-semibold text-gray-900 mb-3">
                    {formData.type === 'crypto' ? 'Crypto Asset *' : 'Stock *'}
                  </label>
                  <div className="relative">
                    <input
                      type="text"
                      value={formData.name}
                      onChange={(e) => {
                        setSelectedSymbol(null);
                        setQuoteSnapshot(null);
                        setFormData(prev => ({
                          ...prev,
                          name: e.target.value,
                          currentPrice: 0,
                        }));
                        setShowSuggestions(true);
                      }}
                      onFocus={() => {
                        if (formData.name.length >= 2) {
                          setShowSuggestions(true);
                        }
                      }}
                      className="w-full px-4 py-3 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500 bg-gray-50"
                      placeholder={formData.type === 'crypto' ? 'Search BTC, ETH, SOL…' : 'Search AAPL, INFY, RELIANCE…'}
                      required
                    />
                    {fetchingPrice && (
                      <Loader2 size={16} className="absolute right-3 top-1/2 -translate-y-1/2 animate-spin text-gray-400" />
                    )}
                  </div>

                  {showSuggestions && (searchResults.length > 0 || searching) && (
                    <div className="absolute z-10 w-full mt-1 bg-white border border-gray-200 rounded-xl shadow-lg max-h-60 overflow-y-auto">
                      {searching ? (
                        <div className="p-4 text-center text-sm text-gray-500 flex items-center justify-center gap-2">
                          <Loader2 size={14} className="animate-spin" /> Searching...
                        </div>
                      ) : (
                        searchResults.map(result => (
                          <button
                            key={result.symbol}
                            type="button"
                            className="w-full text-left px-4 py-3 hover:bg-gray-50 flex flex-col border-b border-gray-50 last:border-0"
                            onClick={() => handleSelectStock(result)}
                          >
                            <span className="font-bold text-sm text-gray-900">{displaySymbol(result.symbol)}</span>
                            <span className="text-xs text-gray-500">{result.companyName}{result.exchange ? ` · ${result.exchange}` : ''}</span>
                          </button>
                        ))
                      )}
                    </div>
                  )}
                </div>

                {(selectedSymbol || quoteSnapshot) && (
                  <div className="rounded-2xl border border-gray-200 bg-gray-50 p-4">
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <p className="text-lg font-bold text-gray-900 truncate">
                          {displaySymbol(selectedSymbol || formData.name)}
                        </p>
                        <p className="text-sm text-gray-500 truncate">
                          {quoteSnapshot?.companyName || formData.name}
                          {quoteSnapshot?.exchange ? ` · ${quoteSnapshot.exchange}` : ''}
                        </p>
                      </div>
                      {selectedSymbol && (
                        <button
                          type="button"
                          onClick={() => loadLiveQuote(selectedSymbol, formData.type === 'crypto' ? 'crypto' : 'stocks')}
                          className="inline-flex items-center gap-2 rounded-xl border border-gray-200 bg-white px-3 py-2 text-sm font-medium text-gray-700 hover:bg-gray-100 transition-colors"
                        >
                          <RefreshCw size={14} className={fetchingPrice ? 'animate-spin' : ''} />
                          Refresh
                        </button>
                      )}
                    </div>

                    <div className="mt-4 grid grid-cols-1 sm:grid-cols-3 gap-3">
                      <div className="rounded-xl border border-gray-200 bg-white px-3 py-3">
                        <p className="text-[11px] font-semibold uppercase tracking-wide text-gray-500">Live Price</p>
                        <p className="mt-1 text-lg font-bold text-gray-900">
                          {quoteSnapshot?.currentPrice ? formatNativeMoney(quoteSnapshot.currentPrice, assetCurrencyCode) : 'Unavailable'}
                        </p>
                      </div>
                      <div className="rounded-xl border border-gray-200 bg-white px-3 py-3">
                        <p className="text-[11px] font-semibold uppercase tracking-wide text-gray-500">Market</p>
                        <p className="mt-1 text-sm font-semibold text-gray-900">
                          {quoteSnapshot?.marketState === 'open'
                            ? 'Open'
                            : quoteSnapshot?.marketState === 'closed'
                              ? 'Closed'
                              : quoteSnapshot?.exchange || 'Unknown'}
                        </p>
                      </div>
                      <div className="rounded-xl border border-gray-200 bg-white px-3 py-3">
                        <p className="text-[11px] font-semibold uppercase tracking-wide text-gray-500">Updated</p>
                        <p className="mt-1 text-sm font-semibold text-gray-900">
                          {quoteSnapshot?.lastUpdate
                            ? new Date(quoteSnapshot.lastUpdate).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
                            : 'Waiting'}
                        </p>
                      </div>
                    </div>
                  </div>
                )}

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-semibold text-gray-900 mb-3">Quantity *</label>
                    <input
                      type="number"
                      step="0.01"
                      value={formData.quantity || ''}
                      onChange={(e) => setFormData(prev => ({ ...prev, quantity: parseFloat(e.target.value) || 0 }))}
                      className="w-full px-4 py-3 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500 bg-gray-50"
                      placeholder="0.00"
                      required
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-semibold text-gray-900 mb-3">Buy Price Per Unit *</label>
                    <div className="flex items-center gap-3 rounded-xl border border-gray-200 bg-gray-50 px-4 py-3">
                      <span className="text-gray-600 font-medium">{assetCurrency}</span>
                      <input
                        type="number"
                        step="0.01"
                        value={formData.purchasePrice || ''}
                        onChange={(e) => setFormData(prev => ({ ...prev, purchasePrice: parseFloat(e.target.value) || 0 }))}
                        className="w-full bg-transparent focus:outline-none"
                        placeholder="0.00"
                        required
                      />
                    </div>
                  </div>
                </div>
              </>
            ) : (
              <>
                <div>
                  <label className="block text-sm font-semibold text-gray-900 mb-3">Investment Name *</label>
                  <input
                    type="text"
                    value={formData.name}
                    onChange={(e) => setFormData(prev => ({ ...prev, name: e.target.value }))}
                    className="w-full px-4 py-3 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500 bg-gray-50"
                    placeholder="e.g., Gold, Bonds, Real Estate"
                    required
                  />
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-semibold text-gray-900 mb-3">Quantity *</label>
                    <input
                      type="number"
                      step="0.01"
                      value={formData.quantity || ''}
                      onChange={(e) => setFormData(prev => ({ ...prev, quantity: parseFloat(e.target.value) || 0 }))}
                      className="w-full px-4 py-3 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500 bg-gray-50"
                      placeholder="0.00"
                      required
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-semibold text-gray-900 mb-3">Current Price *</label>
                    <div className="flex items-center gap-3 rounded-xl border border-gray-200 bg-gray-50 px-4 py-3">
                      <span className="text-gray-600 font-medium">{assetCurrency}</span>
                      <input
                        type="number"
                        step="0.01"
                        value={formData.currentPrice || ''}
                        onChange={(e) => setFormData(prev => ({ ...prev, currentPrice: parseFloat(e.target.value) || 0 }))}
                        className="w-full bg-transparent focus:outline-none"
                        placeholder="0.00"
                        required
                      />
                    </div>
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-semibold text-gray-900 mb-3">Buy Price *</label>
                  <div className="flex items-center gap-3 rounded-xl border border-gray-200 bg-gray-50 px-4 py-3">
                    <span className="text-gray-600 font-medium">{assetCurrency}</span>
                    <input
                      type="number"
                      step="0.01"
                      value={formData.purchasePrice || ''}
                      onChange={(e) => setFormData(prev => ({ ...prev, purchasePrice: parseFloat(e.target.value) || 0 }))}
                      className="w-full bg-transparent focus:outline-none"
                      placeholder="0.00"
                      required
                    />
                  </div>
                </div>
              </>
            )}

            <div>
              <label className="block text-sm font-semibold text-gray-900 mb-3">Payment Account *</label>
              <select
                value={formData.fundingAccountId || ''}
                onChange={(e) => setFormData(prev => ({ ...prev, fundingAccountId: parseInt(e.target.value, 10) || 0 }))}
                className="w-full px-4 py-3 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500 bg-gray-50"
                required
              >
                <option value="">Select an account</option>
                {activeAccounts.map((account) => (
                  <option key={account.id} value={account.id}>
                    {account.name} ({formatNativeMoney(account.balance, currency)})
                  </option>
                ))}
              </select>
              {activeAccounts.length === 0 && (
                <p className="mt-2 text-sm text-rose-600">
                  Add an active account first so the buy amount can be deducted correctly.
                </p>
              )}
              {activeAccounts.length > 0 && (
                <p className="mt-2 text-sm text-gray-500">
                  The stock purchase and any buy-side fees will be recorded against this account.
                </p>
              )}
            </div>

            <div>
              <label className="block text-sm font-semibold text-gray-900 mb-3">Buy-side Fees (Optional)</label>
              <div className="flex items-center gap-3 rounded-xl border border-gray-200 bg-gray-50 px-4 py-3">
                <span className="text-gray-600 font-medium">{currency}</span>
                <input
                  type="number"
                  step="0.01"
                  min="0"
                  value={formData.purchaseFees || ''}
                  onChange={(e) => setFormData(prev => ({ ...prev, purchaseFees: parseFloat(e.target.value) || 0 }))}
                  className="w-full bg-transparent focus:outline-none"
                  placeholder="0.00"
                />
              </div>
              <p className="mt-2 text-sm text-gray-500">
                Brokerage, platform charges, taxes, or any buy-side execution cost.
              </p>
            </div>

            <div>
              <label className="block text-sm font-semibold text-gray-900 mb-3">Purchase Date *</label>
              <input
                type="date"
                value={formData.date}
                onChange={(e) => setFormData(prev => ({ ...prev, date: e.target.value }))}
                className="w-full px-4 py-3 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500 bg-gray-50"
                required
                aria-label="Investment Date"
                title="Investment Date"
                placeholder="Investment Date"
              />
            </div>

            <div>
              <label className="block text-sm font-semibold text-gray-900 mb-3">Broker (Optional)</label>
              <input
                type="text"
                value={formData.broker}
                onChange={(e) => setFormData(prev => ({ ...prev, broker: e.target.value }))}
                className="w-full px-4 py-3 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500 bg-gray-50"
                placeholder="e.g., Zerodha, Fidelity, Groww"
              />
            </div>

            <div>
              <label className="block text-sm font-semibold text-gray-900 mb-3">Notes (Optional)</label>
              <textarea
                value={formData.description}
                onChange={(e) => setFormData(prev => ({ ...prev, description: e.target.value }))}
                className="w-full px-4 py-3 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none bg-gray-50"
                placeholder="Add a note if needed"
                rows={3}
              />
            </div>

            {formData.quantity > 0 && formData.purchasePrice > 0 && (
              <div className="rounded-2xl border border-gray-200 bg-gray-50 p-5">
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                  <div>
                    <p className="text-xs font-semibold uppercase tracking-wide text-gray-500">Invested</p>
                    <p className="mt-1 text-lg font-bold text-gray-900">{formatNativeMoney(totalInvested, assetCurrencyCode)}</p>
                  </div>
                  <div>
                    <p className="text-xs font-semibold uppercase tracking-wide text-gray-500">Current Value</p>
                    <p className="mt-1 text-lg font-bold text-gray-900">{formatNativeMoney(currentValue, assetCurrencyCode)}</p>
                  </div>
                  <div>
                    <p className="text-xs font-semibold uppercase tracking-wide text-gray-500">Profit / Loss</p>
                    <p className={`mt-1 text-lg font-bold ${investmentGain >= 0 ? 'text-emerald-600' : 'text-rose-600'}`}>
                      {investmentGain >= 0 ? '+' : '-'}{formatNativeMoney(Math.abs(investmentGain), assetCurrencyCode)}
                    </p>
                    <p className={`text-sm ${investmentGain >= 0 ? 'text-emerald-600' : 'text-rose-600'}`}>
                      {gainPercentage >= 0 ? '+' : ''}{gainPercentage.toFixed(2)}%
                    </p>
                  </div>
                </div>
                {showConversionHint && (
                  <p className="mt-4 text-sm text-gray-500">
                    Portfolio totals and account deduction will be converted to {currency} using the latest FX rate when this holding is saved.
                  </p>
                )}
                {!!formData.fundingAccountId && (
                  <p className="mt-2 text-sm text-gray-500">
                    Payment account: {activeAccounts.find((account) => account.id === formData.fundingAccountId)?.name || 'Selected account'}
                  </p>
                )}
                {!!formData.purchaseFees && (
                  <p className="mt-2 text-sm text-gray-500">
                    Additional buy-side fees recorded: {formatNativeMoney(formData.purchaseFees, currency)}
                  </p>
                )}
              </div>
            )}

            <div className="flex gap-4 pt-2">
              <button
                type="button"
                onClick={() => setCurrentPage('investments')}
                className="flex-1 px-6 py-3 border border-gray-200 rounded-xl hover:bg-gray-50 transition-colors font-semibold text-gray-700 bg-white"
              >
                Cancel
              </button>
              <button
                type="submit"
                className="flex-1 px-6 py-3 bg-black text-white rounded-xl hover:bg-gray-900 transition-colors font-semibold shadow-lg"
              >
                Add to Portfolio
              </button>
            </div>
          </form>
        </div>
      </div>
    </CenteredLayout>
  );
};
