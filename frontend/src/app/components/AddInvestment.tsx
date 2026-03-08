import React, { useState, useEffect, useRef } from 'react';
import { useApp } from '@/contexts/AppContext'; import { CenteredLayout } from '@/app/components/CenteredLayout';
import { PageHeader } from '@/app/components/ui/PageHeader';
import { db } from '@/lib/database';
import { backendService } from '@/lib/backend-api';
import { TrendingUp, Search, Loader2 } from 'lucide-react';
import { toast } from 'sonner';
import { searchStocks, fetchStockQuote, StockSearchResult, displaySymbol } from '@/lib/stockApi';

const PENDING_INVESTMENT_DRAFT_KEY = 'pendingInvestmentDraft';

interface PendingInvestmentDraft {
  symbol: string;
  displayName?: string;
  companyName?: string;
  exchange?: string;
  type?: 'stocks' | 'crypto';
}

export const AddInvestment: React.FC = () => {
  const { setCurrentPage, currency, refreshData } = useApp();
  const [formData, setFormData] = useState({
    name: '',
    type: 'stocks' as 'stocks' | 'bonds' | 'mutual-funds' | 'real-estate' | 'crypto' | 'other',
    amount: 0,
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
  const searchTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

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

    setFetchingPrice(true);
    fetchStockQuote(parsedDraft.symbol, draftType === 'crypto' ? 'crypto' : undefined)
      .then((quote) => {
        if (cancelled || !quote) {
          return;
        }

        setFormData(prev => ({
          ...prev,
          currentPrice: quote.lastPrice,
          purchasePrice: prev.purchasePrice === 0 ? quote.lastPrice : prev.purchasePrice,
        }));
      })
      .finally(() => {
        if (!cancelled) {
          setFetchingPrice(false);
        }
      });

    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    if (formData.type !== 'stocks' && formData.type !== 'crypto') {
      setShowSuggestions(false);
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
    
    return () => { if (searchTimer.current) clearTimeout(searchTimer.current); };
  }, [formData.name, formData.type, showSuggestions]);

  const handleSelectStock = async (stock: StockSearchResult) => {
    setSelectedSymbol(stock.symbol);
    setFormData(prev => ({ ...prev, name: displaySymbol(stock.symbol) }));
    setShowSuggestions(false);
    
    setFetchingPrice(true);
    try {
      const quote = await fetchStockQuote(stock.symbol);
      if (quote) {
        setFormData(prev => ({ 
          ...prev, 
          currentPrice: quote.lastPrice,
          purchasePrice: prev.purchasePrice === 0 ? quote.lastPrice : prev.purchasePrice
        }));
        toast.success(`Fetched live price for ${displaySymbol(stock.symbol)}`);
      }
    } catch (e) {
      toast.error('Failed to fetch live price');
    } finally {
      setFetchingPrice(false);
    }
  };

  const resolveAssetSymbol = async () => {
    if (selectedSymbol) {
      return selectedSymbol;
    }

    const typedName = formData.name.trim();
    if (!typedName || (formData.type !== 'stocks' && formData.type !== 'crypto')) {
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

    if (formData.amount <= 0) {
      toast.error('Investment amount must be greater than 0');
      return;
    }

    try {
      const assetSymbol = await resolveAssetSymbol();

      // Helper to map UI type to DB assetType
      function mapInvestmentType(type: string): 'stock' | 'crypto' | 'forex' | 'gold' | 'silver' | 'other' {
        switch (type) {
          case 'stocks': return 'stock';
          case 'crypto': return 'crypto';
          case 'bonds': return 'other';
          case 'mutual-funds': return 'other';
          case 'real-estate': return 'other';
          default: return 'other';
        }
      }
      await backendService.createInvestment({
        assetType: mapInvestmentType(formData.type),
        assetName: assetSymbol,
        quantity: formData.quantity,
        buyPrice: formData.purchasePrice,
        currentPrice: formData.currentPrice,
        totalInvested: formData.purchasePrice * formData.quantity,
        currentValue: formData.currentPrice * formData.quantity,
        profitLoss: (formData.currentPrice - formData.purchasePrice) * formData.quantity,
        purchaseDate: new Date(formData.date),
        lastUpdated: new Date(),
        updatedAt: new Date(),
        deletedAt: undefined,
        broker: formData.broker,
        description: formData.description,
      });
      toast.success('Investment added successfully');
      refreshData();
      setCurrentPage('investments');
    } catch (error) {
      console.error('Failed to add investment:', error);
      toast.error('Failed to add investment');
    }
  };

  const currentValue = formData.currentPrice * formData.quantity;
  const investmentGain = (formData.currentPrice - formData.purchasePrice) * formData.quantity;
  const gainPercentage = formData.purchasePrice > 0 ? (investmentGain / (formData.purchasePrice * formData.quantity)) * 100 : 0;

  return (
    <CenteredLayout>
      <div className="space-y-6 max-w-[480px] w-full mx-auto pb-8">
        <PageHeader
          title="Add Investment"
          subtitle="Track your investment portfolio"
          icon={<TrendingUp size={20} className="sm:w-6 sm:h-6" />}
          showBack
          backTo="investments"
        />

        {/* Form */}
        <div className="bg-white rounded-xl border border-gray-200 p-8 max-w-2xl">
          <form onSubmit={handleSubmit} className="space-y-6">
            <div className="relative">
              <label className="block text-sm font-semibold text-gray-900 mb-3">Investment Name *</label>
              <div className="relative">
                <input
                  type="text"
                  value={formData.name}
                  onChange={(e) => {
                    setSelectedSymbol(null);
                    setFormData({ ...formData, name: e.target.value });
                    setShowSuggestions(true);
                  }}
                  onFocus={() => { if ((formData.type === 'stocks' || formData.type === 'crypto') && formData.name.length >= 2) setShowSuggestions(true); }}
                  className="w-full px-4 py-3 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500 bg-gray-50"
                  placeholder="e.g., RELIANCE"
                  required
                />
                {fetchingPrice && (
                  <Loader2 size={16} className="absolute right-3 top-1/2 -translate-y-1/2 animate-spin text-gray-400" />
                )}
              </div>
              
              {showSuggestions && (formData.type === 'stocks' || formData.type === 'crypto') && (searchResults.length > 0 || searching) && (
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

            <div>
              <label className="block text-sm font-semibold text-gray-900 mb-3">Type *</label>
              <select
                value={formData.type}
                onChange={(e) => {
                  setSelectedSymbol(null);
                  setFormData({ ...formData, type: e.target.value as any });
                }}
                className="w-full px-4 py-3 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500 bg-gray-50"
                aria-label="Investment Type"
                title="Investment Type"
              >
                <option value="stocks">Stocks</option>
                <option value="bonds">Bonds</option>
                <option value="mutual-funds">Mutual Funds</option>
                <option value="real-estate">Real Estate</option>
                <option value="crypto">Cryptocurrency</option>
                <option value="other">Other</option>
              </select>
            </div>

            <div>
              <label className="block text-sm font-semibold text-gray-900 mb-3">Quantity</label>
              <input
                type="number"
                step="0.01"
                value={formData.quantity || ''}
                onChange={(e) => setFormData({ ...formData, quantity: parseFloat(e.target.value) || 0 })}
                className="w-full px-4 py-3 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500 bg-gray-50"
                placeholder="0.00"
              />
            </div>

            <div>
              <label className="block text-sm font-semibold text-gray-900 mb-3">Purchase Price Per Unit</label>
              <div className="flex items-center">
                <span className="text-gray-600 mr-3 text-lg">{currency}</span>
                <input
                  type="number"
                  step="0.01"
                  value={formData.purchasePrice || ''}
                  onChange={(e) => setFormData({ ...formData, purchasePrice: parseFloat(e.target.value) || 0 })}
                  className="flex-1 px-4 py-3 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500 bg-gray-50"
                  placeholder="0.00"
                />
              </div>
            </div>

            <div>
              <label className="block text-sm font-semibold text-gray-900 mb-3">Current Price Per Unit</label>
              <div className="flex items-center">
                <span className="text-gray-600 mr-3 text-lg">{currency}</span>
                <input
                  type="number"
                  step="0.01"
                  value={formData.currentPrice || ''}
                  onChange={(e) => setFormData({ ...formData, currentPrice: parseFloat(e.target.value) || 0 })}
                  className="flex-1 px-4 py-3 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500 bg-gray-50"
                  placeholder="0.00"
                />
              </div>
            </div>

            <div>
              <label className="block text-sm font-semibold text-gray-900 mb-3">Initial Investment Amount *</label>
              <div className="flex items-center">
                <span className="text-gray-600 mr-3 text-lg">{currency}</span>
                <input
                  type="number"
                  step="0.01"
                  value={formData.amount || ''}
                  onChange={(e) => setFormData({ ...formData, amount: parseFloat(e.target.value) || 0 })}
                  className="flex-1 px-4 py-3 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500 bg-gray-50"
                  placeholder="0.00"
                  required
                />
              </div>
            </div>

            <div>
              <label className="block text-sm font-semibold text-gray-900 mb-3">Date *</label>
              <input
                type="date"
                value={formData.date}
                onChange={(e) => setFormData({ ...formData, date: e.target.value })}
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
                onChange={(e) => setFormData({ ...formData, broker: e.target.value })}
                className="w-full px-4 py-3 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500 bg-gray-50"
                placeholder="e.g., Fidelity, Vanguard"
              />
            </div>

            <div>
              <label className="block text-sm font-semibold text-gray-900 mb-3">Description</label>
              <textarea
                value={formData.description}
                onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                className="w-full px-4 py-3 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none bg-gray-50"
                placeholder="Add any notes about this investment"
                rows={3}
              />
            </div>

            {/* Summary */}
            {formData.quantity > 0 && formData.currentPrice > 0 && (
              <div className="bg-gray-50 border border-gray-200 rounded-xl p-6">
                <div className="space-y-3">
                  <div className="flex justify-between text-sm">
                    <span className="text-gray-700">Current Value:</span>
                    <span className="font-bold text-gray-900">{currency} {currentValue.toFixed(2)}</span>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span className="text-gray-700">Gain/Loss:</span>
                    <span className={`font-bold ${investmentGain >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                      {investmentGain >= 0 ? '+' : ''}{currency} {investmentGain.toFixed(2)} ({gainPercentage.toFixed(2)}%)
                    </span>
                  </div>
                </div>
              </div>
            )}

            <div className="flex gap-4 pt-6">
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
                Add Investment
              </button>
            </div>
          </form>
        </div>
      </div>
    </CenteredLayout>
  );
};;
