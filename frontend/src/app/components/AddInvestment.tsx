import React, { useCallback, useEffect, useRef, useState } from 'react';
import { useApp } from '@/contexts/AppContext';
import { CenteredLayout } from '@/app/components/CenteredLayout';
import { PageHeader } from '@/app/components/ui/PageHeader';
import { backendService } from '@/lib/backend-api';
import { TrendingUp, Loader2, RefreshCw } from 'lucide-react';
import { toast } from 'sonner';
import { searchStocks, fetchStockQuote, StockQuote, StockSearchResult, displaySymbol } from '@/lib/stockApi';

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
  marketState?: string;
  lastUpdate?: string;
}

interface QuoteSnapshot {
  companyName: string;
  exchange: string;
  currentPrice: number;
  currency: string;
  marketState?: string;
  lastUpdate?: string;
}

const APP_CURRENCY_SYMBOLS: Record<string, string> = {
  INR: '₹',
  USD: '$',
  EUR: '€',
  GBP: '£',
};

const getAppCurrencySymbol = (currency: string) => APP_CURRENCY_SYMBOLS[currency] ?? currency;

const resolveSelectedType = (symbol: string, fallback: InvestmentFormType): InvestmentFormType =>
  symbol.endsWith('-USD') ? 'crypto' : (fallback === 'crypto' ? 'crypto' : 'stocks');

const buildQuoteSnapshot = (quote: StockQuote): QuoteSnapshot => ({
  companyName: quote.companyName,
  exchange: quote.exchange,
  currentPrice: quote.lastPrice,
  currency: quote.currency,
  marketState: quote.marketState,
  lastUpdate: quote.lastUpdate,
});

const formatAssetMoney = (amount: number, currencySymbol: string) => {
  const locale = currencySymbol === '$' ? 'en-US' : 'en-IN';
  return `${currencySymbol}${new Intl.NumberFormat(locale, {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(Number.isFinite(amount) ? amount : 0)}`;
};

export const AddInvestment: React.FC = () => {
  const { setCurrentPage, currency, refreshData } = useApp();
  const [formData, setFormData] = useState({
    name: '',
    type: 'stocks' as InvestmentFormType,
    quantity: 0,
    purchasePrice: 0,
    currentPrice: 0,
    date: new Date().toISOString().split('T')[0],
    broker: '',
    description: '',
  });

  const [searchResults, setSearchResults] = useState<StockSearchResult[]>([]);
  const [searching, setSearching] = useState(false);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [fetchingPrice, setFetchingPrice] = useState(false);
  const [selectedSymbol, setSelectedSymbol] = useState<string | null>(null);
  const [quoteSnapshot, setQuoteSnapshot] = useState<QuoteSnapshot | null>(null);
  const searchTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const isMarketAsset = formData.type === 'stocks' || formData.type === 'crypto';
  const assetCurrency = quoteSnapshot?.currency || getAppCurrencySymbol(currency);
  const livePrice = quoteSnapshot?.currentPrice || formData.currentPrice;
  const totalInvested = formData.purchasePrice * formData.quantity;
  const currentValue = livePrice * formData.quantity;
  const investmentGain = (livePrice - formData.purchasePrice) * formData.quantity;
  const gainPercentage = totalInvested > 0 ? (investmentGain / totalInvested) * 100 : 0;

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

    if (parsedDraft.currentPrice && parsedDraft.currency) {
      applyQuoteSnapshot({
        companyName: parsedDraft.companyName || draftName,
        exchange: parsedDraft.exchange || '',
        currentPrice: parsedDraft.currentPrice,
        currency: parsedDraft.currency,
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

    try {
      const assetSymbol = await resolveAssetSymbol();
      let effectiveCurrentPrice = livePrice;

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
      const nextCurrentValue = effectiveCurrentPrice * formData.quantity;
      const nextProfitLoss = (effectiveCurrentPrice - formData.purchasePrice) * formData.quantity;

      const savedInvestment = await backendService.createInvestment({
        assetType: mapInvestmentType(formData.type),
        assetName: assetSymbol,
        quantity: formData.quantity,
        buyPrice: formData.purchasePrice,
        currentPrice: effectiveCurrentPrice,
        totalInvested: nextTotalInvested,
        currentValue: nextCurrentValue,
        profitLoss: nextProfitLoss,
        purchaseDate: new Date(formData.date),
        lastUpdated: new Date(),
        updatedAt: new Date(),
        deletedAt: undefined,
        broker: formData.broker,
        description: formData.description,
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
                          {quoteSnapshot?.currentPrice ? formatAssetMoney(quoteSnapshot.currentPrice, assetCurrency) : 'Unavailable'}
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
                    <p className="mt-1 text-lg font-bold text-gray-900">{formatAssetMoney(totalInvested, assetCurrency)}</p>
                  </div>
                  <div>
                    <p className="text-xs font-semibold uppercase tracking-wide text-gray-500">Current Value</p>
                    <p className="mt-1 text-lg font-bold text-gray-900">{formatAssetMoney(currentValue, assetCurrency)}</p>
                  </div>
                  <div>
                    <p className="text-xs font-semibold uppercase tracking-wide text-gray-500">Profit / Loss</p>
                    <p className={`mt-1 text-lg font-bold ${investmentGain >= 0 ? 'text-emerald-600' : 'text-rose-600'}`}>
                      {investmentGain >= 0 ? '+' : '-'}{formatAssetMoney(Math.abs(investmentGain), assetCurrency)}
                    </p>
                    <p className={`text-sm ${investmentGain >= 0 ? 'text-emerald-600' : 'text-rose-600'}`}>
                      {gainPercentage >= 0 ? '+' : ''}{gainPercentage.toFixed(2)}%
                    </p>
                  </div>
                </div>
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
