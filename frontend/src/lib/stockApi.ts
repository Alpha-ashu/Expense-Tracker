/**
 * Indian Stock Market API integration
 * Now routed through our own backend proxy to Yahoo Finance, bypassing CORS.
 *
 * NSE: symbol = "RELIANCE" or "RELIANCE.NS"
 * BSE: symbol = "RELIANCE.BO"
 */
import { API_CONFIG } from '@/constants';

// All requests go to our own backend
const PROXY_BASE = `${API_CONFIG.BASE_URL}/stocks`;

export interface StockQuote {
  symbol: string;
  companyName: string;
  exchange: 'NSE' | 'BSE';
  lastPrice: number;
  change: number;
  percentChange: number;
  previousClose: number;
  open: number;
  dayHigh: number;
  dayLow: number;
  yearHigh: number;
  yearLow: number;
  volume: number;
  marketCap: number;
  peRatio: number;
  dividendYield: number;
  eps: number;
  sector: string;
  lastUpdate: string;
}

export interface StockSearchResult {
  symbol: string;
  companyName: string;
  nseUrl: string;
  bseUrl: string;
}

function mapApiResponse(data: any, symbol: string): StockQuote {
  const d = data.data;
  return {
    symbol: data.symbol ?? symbol,
    companyName: d.company_name ?? symbol,
    exchange: (data.exchange as 'NSE' | 'BSE') ?? 'NSE',
    lastPrice: Number(d.last_price) || 0,
    change: Number(d.change) || 0,
    percentChange: Number(d.percent_change) || 0,
    previousClose: Number(d.previous_close) || 0,
    open: Number(d.open) || 0,
    dayHigh: Number(d.day_high) || 0,
    dayLow: Number(d.day_low) || 0,
    yearHigh: Number(d.year_high) || 0,
    yearLow: Number(d.year_low) || 0,
    volume: Number(d.volume) || 0,
    marketCap: Number(d.market_cap) || 0,
    peRatio: Number(d.pe_ratio) || 0,
    dividendYield: Number(d.dividend_yield) || 0,
    eps: Number(d.earnings_per_share) || 0,
    sector: d.sector ?? 'Unknown',
    lastUpdate: d.last_update ?? new Date().toISOString(),
  };
}

/**
 * Fetch live quote for a single stock.
 * Routes through /api/stocks proxy to avoid CORS.
 * @param symbol e.g. "RELIANCE", "TCS.BO", "INFY.NS"
 */
export async function fetchStockQuote(symbol: string): Promise<StockQuote | null> {
  try {
    const url = `${PROXY_BASE}/stock?symbol=${encodeURIComponent(symbol)}&res=num`;
    const res = await fetch(url, { signal: AbortSignal.timeout(10_000) });
    if (!res.ok) return null;
    const json = await res.json();
    if (json.status !== 'success') return null;
    return mapApiResponse(json, symbol);
  } catch {
    return null;
  }
}

/**
 * Fetch live quotes for multiple symbols in parallel.
 * Gracefully returns null for failed symbols.
 */
export async function fetchMultipleQuotes(
  symbols: string[]
): Promise<Record<string, StockQuote | null>> {
  const results = await Promise.allSettled(
    symbols.map(async (s) => ({ symbol: s, quote: await fetchStockQuote(s) }))
  );
  const map: Record<string, StockQuote | null> = {};
  for (const r of results) {
    if (r.status === 'fulfilled') {
      map[r.value.symbol] = r.value.quote;
    }
  }
  return map;
}

/**
 * Search for stocks by company name.
 * Routes through /api/stocks proxy to avoid CORS.
 */
export async function searchStocks(query: string): Promise<StockSearchResult[]> {
  try {
    const url = `${PROXY_BASE}/search?q=${encodeURIComponent(query)}`;
    const res = await fetch(url, { signal: AbortSignal.timeout(8_000) });
    if (!res.ok) return [];
    const json = await res.json();
    if (json.status !== 'success' || !Array.isArray(json.results)) return [];
    return json.results.map((r: any) => ({
      symbol: r.symbol,
      companyName: r.company_name,
      nseUrl: r.nse_url ?? '',
      bseUrl: r.bse_url ?? '',
    }));
  } catch {
    return [];
  }
}

/** Format large numbers to Indian style (1,23,456) */
export function formatIndianNumber(n: number): string {
  return new Intl.NumberFormat('en-IN').format(Math.round(n));
}

/** Format market cap in Crores */
export function formatMarketCap(n: number): string {
  const crore = n / 1e7;
  if (crore >= 1e5) return `₹${(crore / 1e5).toFixed(2)}L Cr`;
  if (crore >= 1e3) return `₹${(crore / 1e3).toFixed(2)}K Cr`;
  return `₹${crore.toFixed(0)} Cr`;
}
