import React, { useEffect, useState } from 'react';
import { TrendingDown, TrendingUp, Activity } from 'lucide-react';
import { fetchMultipleQuotes, StockQuote } from '@/lib/stockApi';
import { cn } from '@/lib/utils';
import { useApp } from '@/contexts/AppContext';

const TICKER_SYMBOLS = [
  { symbol: 'RELIANCE.NS', name: 'Reliance' },
  { symbol: 'TCS.NS', name: 'TCS' },
  { symbol: 'AAPL.US', name: 'Apple' },
  { symbol: 'NVDA.US', name: 'NVIDIA' },
  { symbol: 'BTC-USD', name: 'Bitcoin' },
  { symbol: 'ETH-USD', name: 'Ethereum' },
  { symbol: 'USDINR=X', name: 'USD/INR' },
  { symbol: 'EURUSD=X', name: 'EUR/USD' },
  { symbol: 'RELIANCE.BO', name: 'Reliance BSE' },
];

export const LiveMarketTicker: React.FC = () => {
  const [quotes, setQuotes] = useState<Record<string, StockQuote | null>>({});
  const { currency } = useApp();

  useEffect(() => {
    let mounted = true;
    const fetchQuotes = async () => {
      const data = await fetchMultipleQuotes(TICKER_SYMBOLS.map(t => t.symbol));
      if (mounted) {
        setQuotes(data);
      }
    };
    fetchQuotes();
    const interval = setInterval(fetchQuotes, 10000); // refresh every 10s
    return () => {
      mounted = false;
      clearInterval(interval);
    };
  }, []);

  const fmt = (n: number) =>
    new Intl.NumberFormat('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(n);

  return (
    <div className="w-full bg-[#f8f9fc] border-b border-gray-200 border-t overflow-hidden relative flex py-3">
      <div className="flex-shrink-0 px-4 flex items-center gap-2 bg-[#f8f9fc] z-10 font-bold text-xs uppercase tracking-widest text-gray-500 border-r border-gray-200">
        <Activity size={14} className="text-gray-400" />
        Live Markets
      </div>

      {/* Marquee Container */}
      <div className="flex flex-1 overflow-hidden relative">
        <div className="flex animate-[ticker_40s_linear_infinite] whitespace-nowrap min-w-full">
          {[...TICKER_SYMBOLS, ...TICKER_SYMBOLS, ...TICKER_SYMBOLS].map((item, i) => {
            const quote = quotes[item.symbol];
            if (!quote) return null;

            const isPositive = quote.change >= 0;

            return (
              <div
                key={`${item.symbol}-${i}`}
                className="inline-flex items-center gap-3 px-6 border-r border-gray-200 last:border-0"
              >
                <span className="font-display font-bold text-gray-900 text-sm">{item.name}</span>
                <span className="text-sm font-semibold tabular-nums text-gray-700">
                  {quote.currency || (item.symbol.includes('=X') || item.symbol.includes('=F') || item.symbol.includes('-USD') ? '$' : '₹')}{fmt(quote.lastPrice)}
                </span>
                <span className={cn(
                  "flex items-center gap-1 text-xs font-bold px-2 py-0.5 rounded-md",
                  isPositive ? "bg-emerald-50 text-emerald-600" : "bg-rose-50 text-rose-600"
                )}>
                  {isPositive ? <TrendingUp size={12} /> : <TrendingDown size={12} />}
                  {isPositive ? '+' : ''}{fmt(quote.percentChange)}%
                </span>
              </div>
            );
          })}
        </div>
      </div>
      
      {/* Required CSS for animation inside the app if not in tailwind.config.js */}
      <style dangerouslySetInnerHTML={{__html: `
        @keyframes ticker {
          0% { transform: translateX(0); }
          100% { transform: translateX(-50%); }
        }
      `}} />
    </div>
  );
};
