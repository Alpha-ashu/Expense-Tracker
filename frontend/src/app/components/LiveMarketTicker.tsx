import React, { useEffect, useState } from 'react';
import { TrendingDown, TrendingUp, Activity } from 'lucide-react';
import { fetchMultipleQuotes, StockQuote } from '@/lib/stockApi';
import { cn } from '@/lib/utils';
import { useApp } from '@/contexts/AppContext';

const TICKER_SYMBOLS = [
  { symbol: '^NSEI', name: 'NIFTY 50' },
  { symbol: '^BSESN', name: 'SENSEX' },
  { symbol: 'GC=F', name: 'Gold' },
  { symbol: 'SI=F', name: 'Silver' },
  { symbol: 'INR=X', name: 'USD/INR' }
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
    const interval = setInterval(fetchQuotes, 60000); // refresh every minute it's on
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
                  {item.symbol === 'INR=X' ? '₹' : (item.symbol.includes('=F') ? '$' : '')}{fmt(quote.lastPrice)}
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
