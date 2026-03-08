import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  TrendingUp, TrendingDown, RefreshCw, Search, X,
  Activity, BarChart2, ChevronRight, Wifi, WifiOff,
} from 'lucide-react';
import {
  fetchStockQuote, fetchMultipleQuotes, searchStocks,
  formatMarketCap, StockQuote, StockSearchResult,
} from '@/lib/stockApi';
import { cn } from '@/lib/utils';
import { motion, AnimatePresence } from 'framer-motion';

/* ── Default watchlist ─────────────────────────────────── */
const DEFAULT_WATCHLIST = [
  'RELIANCE', 'TCS', 'INFY', 'HDFCBANK', 'ICICIBANK',
  'WIPRO', 'SBIN', 'BAJFINANCE', 'AXISBANK', 'MARUTI',
];

const AUTO_REFRESH_MS = 60_000; // 60 s

/* ── Helpers ──────────────────────────────────────────── */
const fmt = (n: number) =>
  new Intl.NumberFormat('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(n);

const PriceTag: React.FC<{ value: number; suffix?: string; size?: 'sm' | 'md' | 'lg' }> = ({
  value, suffix = '', size = 'md',
}) => {
  const positive = value >= 0;
  const cls = cn(
    'font-bold tabular-nums',
    positive ? 'text-emerald-600' : 'text-rose-600',
    size === 'lg' && 'text-xl',
    size === 'md' && 'text-sm',
    size === 'sm' && 'text-xs',
  );
  return (
    <span className={cls}>
      {positive ? '+' : ''}{fmt(value)}{suffix}
    </span>
  );
};

/* ── Stock card (list row) ────────────────────────────── */
const StockRow: React.FC<{
  quote: StockQuote;
  onClick: (q: StockQuote) => void;
}> = ({ quote, onClick }) => {
  const positive = quote.change >= 0;
  return (
    <motion.button
      layout
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      onClick={() => onClick(quote)}
      className="w-full flex items-center gap-3 px-4 py-3 hover:bg-gray-50 transition-colors text-left group"
    >
      {/* Icon */}
      <div className={cn(
        'w-10 h-10 rounded-xl flex items-center justify-center shrink-0 text-xs font-bold',
        positive ? 'bg-emerald-50 text-emerald-700' : 'bg-rose-50 text-rose-700'
      )}>
        {quote.symbol.slice(0, 2)}
      </div>

      {/* Name */}
      <div className="flex-1 min-w-0">
        <p className="font-bold text-gray-900 text-sm truncate">{quote.symbol}</p>
        <p className="text-xs text-gray-400 truncate">{quote.exchange} · {quote.sector}</p>
      </div>

      {/* Price */}
      <div className="text-right shrink-0">
        <p className="font-bold text-gray-900 text-sm tabular-nums">₹{fmt(quote.lastPrice)}</p>
        <div className="flex items-center justify-end gap-1">
          {positive ? (
            <TrendingUp size={11} className="text-emerald-500" />
          ) : (
            <TrendingDown size={11} className="text-rose-500" />
          )}
          <PriceTag value={quote.percentChange} suffix="%" size="sm" />
        </div>
      </div>

      <ChevronRight size={14} className="text-gray-300 group-hover:text-gray-500 shrink-0 transition-colors" />
    </motion.button>
  );
};

/* ── Detail panel ─────────────────────────────────────── */
const StockDetail: React.FC<{ quote: StockQuote; onClose: () => void }> = ({ quote, onClose }) => {
  const positive = quote.change >= 0;
  const pct52 = quote.yearHigh > 0
    ? ((quote.lastPrice - quote.yearLow) / (quote.yearHigh - quote.yearLow)) * 100
    : 0;

  const rows = [
    { label: 'Open', value: `₹${fmt(quote.open)}` },
    { label: 'Prev Close', value: `₹${fmt(quote.previousClose)}` },
    { label: "Day's High", value: `₹${fmt(quote.dayHigh)}` },
    { label: "Day's Low", value: `₹${fmt(quote.dayLow)}` },
    { label: '52W High', value: `₹${fmt(quote.yearHigh)}` },
    { label: '52W Low', value: `₹${fmt(quote.yearLow)}` },
    { label: 'P/E Ratio', value: quote.peRatio ? `${fmt(quote.peRatio)}x` : '—' },
    { label: 'EPS', value: quote.eps ? `₹${fmt(quote.eps)}` : '—' },
    { label: 'Div Yield', value: quote.dividendYield ? `${fmt(quote.dividendYield)}%` : '—' },
    { label: 'Market Cap', value: formatMarketCap(quote.marketCap) },
    {
      label: 'Volume',
      value: new Intl.NumberFormat('en-IN').format(quote.volume)
    },
  ];

  return (
    <motion.div
      key="detail"
      initial={{ opacity: 0, x: 20 }}
      animate={{ opacity: 1, x: 0 }}
      exit={{ opacity: 0, x: 20 }}
      className="flex flex-col h-full"
    >
      {/* Header */}
      <div className={cn(
        'px-5 pt-5 pb-6 relative overflow-hidden',
        positive ? 'bg-gradient-to-br from-emerald-600 to-teal-500' : 'bg-gradient-to-br from-rose-600 to-pink-500'
      )}>
        <div className="absolute -top-8 -right-8 w-32 h-32 rounded-full bg-white/10 blur-2xl pointer-events-none" />
        <div className="flex items-center gap-3 mb-4 relative">
          <button onClick={onClose}
            className="w-8 h-8 rounded-xl bg-white/20 hover:bg-white/30 flex items-center justify-center transition-colors">
            <X size={16} className="text-white" />
          </button>
          <div className="flex-1 min-w-0">
            <p className="text-white/70 text-xs font-bold">{quote.exchange} · {quote.sector}</p>
            <h3 className="text-white font-display font-bold text-lg leading-tight truncate">{quote.companyName}</h3>
          </div>
          <span className="text-xs font-bold bg-white/20 text-white px-2 py-1 rounded-lg">{quote.symbol}</span>
        </div>
        <div className="relative">
          <p className="text-white/60 text-xs font-bold uppercase tracking-widest mb-0.5">Current Price</p>
          <p className="text-white text-4xl font-display font-bold">₹{fmt(quote.lastPrice)}</p>
          <div className="flex items-center gap-2 mt-1">
            {positive ? <TrendingUp size={14} className="text-white/80" /> : <TrendingDown size={14} className="text-white/80" />}
            <span className="text-white/80 text-sm font-semibold">
              {positive ? '+' : ''}₹{fmt(quote.change)} ({positive ? '+' : ''}{fmt(quote.percentChange)}%)
            </span>
          </div>
        </div>
      </div>

      {/* 52W Range bar */}
      <div className="px-5 py-4 border-b border-gray-100">
        <div className="flex justify-between text-xs text-gray-400 mb-1.5">
          <span>52W Low ₹{fmt(quote.yearLow)}</span>
          <span>52W High ₹{fmt(quote.yearHigh)}</span>
        </div>
        <div className="h-2 bg-gray-100 rounded-full overflow-hidden">
          <div
            className={cn('h-full rounded-full transition-all', positive ? 'bg-emerald-500' : 'bg-rose-500')}
            style={{ width: `${Math.min(100, Math.max(2, pct52))}%` }}
          />
        </div>
        <p className="text-xs text-gray-400 mt-1 text-center">
          ₹{fmt(quote.lastPrice)} — {pct52.toFixed(0)}% from 52W low
        </p>
      </div>

      {/* Stats grid */}
      <div className="flex-1 overflow-y-auto p-5">
        <div className="grid grid-cols-2 gap-3">
          {rows.map(({ label, value }) => (
            <div key={label} className="bg-gray-50 rounded-xl px-3 py-2.5">
              <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">{label}</p>
              <p className="text-sm font-bold text-gray-900 mt-0.5">{value}</p>
            </div>
          ))}
        </div>
        <p className="text-xs text-gray-400 text-center mt-4">
          Last updated: {quote.lastUpdate} · Data via Yahoo Finance
        </p>
      </div>
    </motion.div>
  );
};

/* ── Main component ───────────────────────────────────── */
export const LiveMarket: React.FC = () => {
  const [quotes, setQuotes] = useState<Record<string, StockQuote | null>>({});
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [lastRefreshed, setLastRefreshed] = useState<Date | null>(null);
  const [selected, setSelected] = useState<StockQuote | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<StockSearchResult[]>([]);
  const [searching, setSearching] = useState(false);
  const [isOnline, setIsOnline] = useState(navigator.onLine);
  const [watchlist, setWatchlist] = useState<string[]>(DEFAULT_WATCHLIST);

  const refreshTimer = useRef<ReturnType<typeof setInterval> | null>(null);
  const searchTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  /* ── Online/offline ── */
  useEffect(() => {
    const on = () => setIsOnline(true);
    const off = () => setIsOnline(false);
    window.addEventListener('online', on);
    window.addEventListener('offline', off);
    return () => { window.removeEventListener('online', on); window.removeEventListener('offline', off); };
  }, []);

  /* ── Fetch quotes ── */
  const loadQuotes = useCallback(async (symbols: string[], isRefresh = false) => {
    if (isRefresh) setRefreshing(true);
    else setLoading(true);
    try {
      const data = await fetchMultipleQuotes(symbols);
      setQuotes(prev => ({ ...prev, ...data }));
      setLastRefreshed(new Date());
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    loadQuotes(watchlist);
    refreshTimer.current = setInterval(() => loadQuotes(watchlist, true), AUTO_REFRESH_MS);
    return () => { if (refreshTimer.current) clearInterval(refreshTimer.current); };
  }, [watchlist, loadQuotes]);

  /* ── Search debounce ── */
  useEffect(() => {
    if (searchTimer.current) clearTimeout(searchTimer.current);
    if (!searchQuery.trim()) { setSearchResults([]); return; }
    setSearching(true);
    searchTimer.current = setTimeout(async () => {
      const results = await searchStocks(searchQuery.trim());
      setSearchResults(results);
      setSearching(false);
    }, 400);
    return () => { if (searchTimer.current) clearTimeout(searchTimer.current); };
  }, [searchQuery]);

  /* ── Add stock from search ── */
  const handleAddToWatchlist = async (result: StockSearchResult) => {
    const sym = result.symbol;
    setSearchQuery('');
    setSearchResults([]);
    if (watchlist.includes(sym)) return;
    setWatchlist(prev => [...prev, sym]);
    await loadQuotes([sym]);
  };

  /* ── Remove from watchlist ── */
  const handleRemove = (symbol: string) => {
    setWatchlist(prev => prev.filter(s => s !== symbol));
    setQuotes(prev => { const c = { ...prev }; delete c[symbol]; return c; });
    if (selected?.symbol === symbol) setSelected(null);
  };

  const loadedQuotes = watchlist
    .map(s => quotes[s])
    .filter((q): q is StockQuote => q !== null && q !== undefined);

  const timeSince = lastRefreshed
    ? Math.round((Date.now() - lastRefreshed.getTime()) / 1000)
    : null;

  return (
    <div className="h-full flex flex-col bg-white rounded-2xl border border-gray-200 shadow-sm overflow-hidden">
      {/* Top bar */}
      <div className="px-4 py-3 border-b border-gray-100 flex items-center gap-3 shrink-0">
        <div className="w-8 h-8 rounded-xl bg-black flex items-center justify-center">
          <Activity size={15} className="text-white" />
        </div>
        <div className="flex-1">
          <h2 className="font-display font-bold text-gray-900 text-sm">Live Market</h2>
          <div className="flex items-center gap-1.5">
            {isOnline ? (
              <Wifi size={10} className="text-emerald-500" />
            ) : (
              <WifiOff size={10} className="text-red-400" />
            )}
            <p className="text-[10px] text-gray-400">
              {isOnline ? (
                timeSince !== null ? `Updated ${timeSince}s ago` : 'Connecting…'
              ) : 'Offline — cached data'}
            </p>
          </div>
        </div>
        <button
          onClick={() => loadQuotes(watchlist, true)}
          disabled={refreshing || loading}
          className="w-8 h-8 rounded-xl border border-gray-200 hover:bg-gray-50 flex items-center justify-center transition-colors disabled:opacity-40"
          title="Refresh"
        >
          <RefreshCw size={14} className={cn('text-gray-500', refreshing && 'animate-spin')} />
        </button>
      </div>

      {/* Search bar */}
      <div className="px-4 py-2.5 border-b border-gray-100 shrink-0">
        <div className="relative">
          <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
          <input
            type="text"
            value={searchQuery}
            onChange={e => setSearchQuery(e.target.value)}
            placeholder="Search stocks… e.g. HDFC, Infosys"
            className="w-full pl-8 pr-8 py-2 text-xs bg-gray-50 border border-gray-200 rounded-xl focus:outline-none focus:ring-1 focus:ring-gray-300 focus:bg-white transition-colors"
          />
          {searchQuery && (
            <button onClick={() => { setSearchQuery(''); setSearchResults([]); }}
              className="absolute right-3 top-1/2 -translate-y-1/2">
              <X size={13} className="text-gray-400" />
            </button>
          )}
        </div>

        {/* Search dropdown */}
        <AnimatePresence>
          {(searchResults.length > 0 || searching) && (
            <motion.div
              initial={{ opacity: 0, y: -4 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -4 }}
              className="absolute z-20 left-4 right-4 bg-white border border-gray-200 rounded-xl shadow-xl mt-1 overflow-hidden"
            >
              {searching && (
                <div className="p-3 text-xs text-gray-400 flex items-center gap-2">
                  <RefreshCw size={11} className="animate-spin" /> Searching…
                </div>
              )}
              {searchResults.slice(0, 6).map(r => {
                const isAdded = watchlist.includes(r.symbol);
                return (
                  <button
                    key={r.symbol}
                    onClick={() => handleAddToWatchlist(r)}
                    className={cn(
                      "w-full flex items-center justify-between px-4 py-2.5 transition-colors",
                      isAdded ? "bg-emerald-50/50 cursor-default" : "hover:bg-gray-50"
                    )}
                  >
                    <div className="text-left">
                      <p className={cn("text-sm font-bold", isAdded ? "text-emerald-700" : "text-gray-900")}>
                        {r.symbol}
                      </p>
                      <p className="text-xs text-gray-400 truncate">{r.companyName}</p>
                    </div>
                    {isAdded ? (
                      <span className="text-[10px] text-emerald-600 font-bold uppercase tracking-wider px-2 py-0.5">
                        Added
                      </span>
                    ) : (
                      <span className="text-xs bg-gray-100 text-gray-600 px-2 py-0.5 rounded-full font-medium">
                        + Add
                      </span>
                    )}
                  </button>
                );
              })}
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* Content */}
      <div className="flex-1 relative overflow-hidden">
        <AnimatePresence mode="wait">
          {selected ? (
            <StockDetail
              key="detail"
              quote={selected}
              onClose={() => setSelected(null)}
            />
          ) : (
            <motion.div key="list" className="h-full overflow-y-auto" initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
              {loading && loadedQuotes.length === 0 ? (
                <div className="flex flex-col items-center justify-center h-48 gap-3">
                  <div className="w-8 h-8 border-2 border-gray-200 border-t-gray-800 rounded-full animate-spin" />
                  <p className="text-xs text-gray-400">Fetching live prices…</p>
                </div>
              ) : (
                <div className="divide-y divide-gray-50 relative">
                  {watchlist.map(symbol => {
                    const q = quotes[symbol];
                    if (!q) return (
                      <div key={symbol}
                        className="flex items-center justify-between px-4 py-3 opacity-50">
                        <div className="flex items-center gap-3">
                          <div className="w-10 h-10 rounded-xl bg-gray-100 animate-pulse" />
                          <div>
                            <div className="h-3 w-20 bg-gray-200 rounded animate-pulse mb-1.5" />
                            <div className="h-2 w-14 bg-gray-100 rounded animate-pulse" />
                          </div>
                        </div>
                        <button onClick={() => handleRemove(symbol)}
                          className="text-gray-300 hover:text-gray-500 p-1">
                          <X size={12} />
                        </button>
                      </div>
                    );
                    return (
                      <div key={symbol} className="flex items-center group">
                        <div className="flex-1 min-w-0">
                          <StockRow quote={q} onClick={setSelected} />
                        </div>
                        {!DEFAULT_WATCHLIST.includes(symbol) && (
                          <button
                            onClick={() => handleRemove(symbol)}
                            className="px-2 opacity-0 group-hover:opacity-100 transition-opacity"
                          >
                            <X size={13} className="text-gray-400 hover:text-red-500" />
                          </button>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}

              {/* Footer */}
              <div className="px-4 py-3 border-t border-gray-100 flex items-center gap-2">
                <BarChart2 size={12} className="text-gray-300" />
                <p className="text-[10px] text-gray-400">
                  NSE/BSE data via Yahoo Finance · Delayed ~15 min outside market hours
                </p>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
};
