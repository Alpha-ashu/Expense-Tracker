import { API_CONFIG } from '@/constants';
import { getCurrencySymbol, normalizeCurrencyCode } from '@/lib/currencyUtils';

const API_BASE = (import.meta.env.VITE_API_URL || API_CONFIG.BASE_URL || '/api/v1').replace(/\/+$/, '');
const TWELVE_DATA_BASE = (import.meta.env.VITE_TWELVEDATA_BASE_URL || 'https://api.twelvedata.com').replace(/\/+$/, '');
const TWELVE_DATA_API_KEY = (import.meta.env.VITE_TWELVEDATA_API_KEY || '').trim();
const ALLOW_DIRECT_BACKEND_FALLBACK = (import.meta.env.VITE_ALLOW_DIRECT_BACKEND_FALLBACK || 'false').toLowerCase() === 'true';

const CACHE_KEY = 'stock_quotes_cache';
const CACHE_TS_KEY = 'stock_quotes_cache_ts';
const PROXY_BACKOFF_MS = 60_000;

const proxyUnavailableUntil = new Map<string, number>();

export type MarketCategory = 'all' | 'nse' | 'bse' | 'us' | 'forex' | 'crypto';

type ProviderMarket = Exclude<MarketCategory, 'all'>;

interface BackendTarget {
  symbol: string;
  market?: ProviderMarket;
}

interface TwelveDataTarget {
  requestSymbol: string;
  symbol: string;
  market: ProviderMarket;
  exchange?: string;
}

const US_EXCHANGES = new Set([
  'NASDAQ',
  'NYSE',
  'AMEX',
  'ARCA',
  'CBOE',
  'NYSE ARCA',
  'NMS',
  'NYQ',
  'NYS',
  'NAS',
  'XNAS',
  'XNYS',
  'XNCM',
  'BATS',
]);

export const MARKET_LABELS: Record<MarketCategory, string> = {
  all: 'All',
  nse: 'NSE',
  bse: 'BSE',
  us: 'US',
  forex: 'Forex',
  crypto: 'Crypto',
};

export const DEFAULT_WATCHLISTS: Record<ProviderMarket, string[]> = {
  nse: ['RELIANCE.NS', 'TCS.NS', 'INFY.NS', 'HDFCBANK.NS', 'ICICIBANK.NS', 'WIPRO.NS', 'SBIN.NS', 'BAJFINANCE.NS', 'AXISBANK.NS', 'MARUTI.NS'],
  bse: ['RELIANCE.BO', 'TCS.BO', 'INFY.BO', 'HDFCBANK.BO', 'ICICIBANK.BO'],
  us: ['AAPL.US', 'TSLA.US', 'MSFT.US', 'NVDA.US', 'GOOGL.US', 'AMZN.US', 'META.US', 'NFLX.US'],
  forex: ['USDINR=X', 'EURUSD=X', 'GBPUSD=X', 'USDJPY=X'],
  crypto: ['BTC-USD', 'ETH-USD', 'SOL-USD', 'BNB-USD', 'XRP-USD', 'ADA-USD'],
};

export interface StockQuote {
  symbol: string;
  companyName: string;
  exchange: string;
  currency: string;
  currencyCode?: string;
  marketState?: string;
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
  exchange: string;
  nseUrl: string;
  bseUrl: string;
}

export function getCacheAge(): number | null {
  const ts = localStorage.getItem(CACHE_TS_KEY);
  if (!ts) return null;
  return Date.now() - Number(ts);
}

export function getCachedQuotes(symbols?: string[]): Record<string, StockQuote | null> {
  const cached = readCache();

  if (!symbols?.length) {
    return cached;
  }

  const map: Record<string, StockQuote | null> = {};
  for (const symbol of symbols) {
    map[symbol] = cached[symbol] ?? null;
  }

  return map;
}

export function hasDirectStockProvider(): boolean {
  return Boolean(TWELVE_DATA_API_KEY);
}

export function getStockDataSetupHint(): string | null {
  if (!navigator.onLine) {
    return 'You are offline. Live quotes will resume automatically once you reconnect.';
  }

  if (hasDirectStockProvider()) {
    return null;
  }

  const backendCandidates = getBackendBaseCandidates();
  if (backendCandidates.length > 0 && backendCandidates.every(base => !canUseProxy(base))) {
    if (typeof window !== 'undefined' && window.location.protocol === 'https:' && !['localhost', '127.0.0.1'].includes(window.location.hostname)) {
      return 'Live market data is temporarily unavailable. Please retry in a moment.';
    }

    return 'Start the backend with `npm run dev` in /backend or add VITE_TWELVEDATA_API_KEY to frontend/.env.local.';
  }

  return null;
}

function readCache(): Record<string, StockQuote> {
  try {
    const raw = localStorage.getItem(CACHE_KEY);
    return raw ? JSON.parse(raw) : {};
  } catch {
    return {};
  }
}

function writeCache(quotes: Record<string, StockQuote | null>) {
  try {
    const existing = readCache();
    let wroteQuote = false;
    for (const [symbol, quote] of Object.entries(quotes)) {
      if (quote) {
        existing[symbol] = quote;
        wroteQuote = true;
      }
    }
    if (!wroteQuote) {
      return;
    }
    localStorage.setItem(CACHE_KEY, JSON.stringify(existing));
    localStorage.setItem(CACHE_TS_KEY, String(Date.now()));
  } catch {
    // Ignore cache write failures.
  }
}

function isAbsoluteUrl(value: string) {
  return /^https?:\/\//i.test(value);
}

function uniq(values: string[]) {
  return Array.from(new Set(values.filter(Boolean)));
}

function getBackendBaseCandidates() {
  const candidates = [API_BASE];

  if (!isAbsoluteUrl(API_BASE) && typeof window !== 'undefined') {
    const { hostname, origin, protocol } = window.location;
    const isSecureOrigin = protocol === 'https:';
    const isLocalHost = hostname === 'localhost' || hostname === '127.0.0.1';

    if (protocol === 'http:' || protocol === 'https:') {
      candidates.push(`${origin}${API_BASE}`);
      if (!isSecureOrigin && ALLOW_DIRECT_BACKEND_FALLBACK) {
        candidates.push(`http://${hostname}:3000/api/v1`);
      }
    }

    if ((!isSecureOrigin || isLocalHost) && ALLOW_DIRECT_BACKEND_FALLBACK) {
      candidates.push('http://localhost:3000/api/v1');
      candidates.push('http://127.0.0.1:3000/api/v1');
    }

    if ((protocol === 'capacitor:' || protocol === 'ionic:' || protocol === 'file:') && ALLOW_DIRECT_BACKEND_FALLBACK) {
      candidates.push('http://10.0.2.2:3000/api/v1');
    }
  }

  const normalized = uniq(candidates.map(candidate => candidate.replace(/\/+$/, '')));

  if (typeof window !== 'undefined' && window.location.protocol === 'https:') {
    return normalized.filter(candidate => !candidate.startsWith('http://'));
  }

  return normalized;
}

function getStockProxyBases() {
  return getBackendBaseCandidates().map(base => `${base}/stocks`);
}

function isUsExchange(exchange?: string) {
  return US_EXCHANGES.has((exchange || '').toUpperCase());
}

function isNseExchange(exchange?: string) {
  const normalized = (exchange || '').toUpperCase();
  return normalized === 'NSE' || normalized === 'NSI' || normalized === 'XNSE';
}

function isBseExchange(exchange?: string) {
  const normalized = (exchange || '').toUpperCase();
  return normalized === 'BSE' || normalized === 'XBOM';
}

function isCryptoInstrument(exchange?: string, instrumentType?: string, micCode?: string, symbol?: string) {
  const normalizedExchange = (exchange || '').toUpperCase();
  const normalizedType = (instrumentType || '').toUpperCase();
  const normalizedMic = (micCode || '').toUpperCase();
  const normalizedSymbol = (symbol || '').toUpperCase();

  return normalizedType === 'DIGITAL CURRENCY' ||
    normalizedMic === 'DIGITAL_CURRENCY' ||
    normalizedSymbol.includes('-USD') ||
    (/^[A-Z0-9]+\/[A-Z]{3,4}$/.test(normalizedSymbol) && normalizedExchange !== 'CCY');
}

function isForexInstrument(exchange?: string, instrumentType?: string, micCode?: string, symbol?: string) {
  const normalizedExchange = (exchange || '').toUpperCase();
  const normalizedType = (instrumentType || '').toUpperCase();
  const normalizedMic = (micCode || '').toUpperCase();
  const normalizedSymbol = (symbol || '').toUpperCase();

  return normalizedExchange === 'CCY' ||
    normalizedExchange === 'FX' ||
    normalizedMic === 'FOREX' ||
    normalizedType === 'FOREX' ||
    normalizedSymbol.endsWith('=X') ||
    /^[A-Z]{3}\/[A-Z]{3}$/.test(normalizedSymbol);
}

function resolveQuoteCurrencyCode(currency?: string, market?: ProviderMarket, symbol?: string) {
  const normalizedSymbol = (symbol || '').trim().toUpperCase();

  if (normalizedSymbol.endsWith('=F')) {
    return 'USD';
  }

  if (normalizedSymbol.endsWith('=X')) {
    const pair = normalizedSymbol.replace(/=X$/, '');
    if (pair.length === 3) {
      return normalizeCurrencyCode(pair, 'USD');
    }

    if (pair.length >= 6) {
      return normalizeCurrencyCode(pair.slice(-3), 'USD');
    }
  }

  const normalized = normalizeCurrencyCode(currency, '');
  if (normalized) {
    return normalized;
  }

  if (market === 'crypto') {
    return 'USD';
  }

  if (market === 'forex' && symbol?.includes('/')) {
    return normalizeCurrencyCode(symbol.split('/')[1], 'USD');
  }

  if (market === 'nse' || market === 'bse') {
    return 'INR';
  }

  return 'USD';
}

function normalizeAppSymbol(symbol: string, exchange?: string, instrumentType?: string, micCode?: string) {
  const normalized = symbol.trim().toUpperCase();

  if (normalized.endsWith('.NS') || isNseExchange(exchange)) {
    return `${normalized.replace(/\.NS$/, '')}.NS`;
  }

  if (normalized.endsWith('.BO') || isBseExchange(exchange)) {
    return `${normalized.replace(/\.BO$/, '')}.BO`;
  }

  if (normalized.endsWith('.US') || isUsExchange(exchange)) {
    return `${normalized.replace(/\.US$/, '')}.US`;
  }

  if (normalized.endsWith('-USD') || isCryptoInstrument(exchange, instrumentType, micCode, normalized)) {
    return normalized.replace('/', '-');
  }

  if (normalized.endsWith('=X') || isForexInstrument(exchange, instrumentType, micCode, normalized)) {
    if (normalized.endsWith('=X')) {
      return normalized;
    }

    const pair = normalized.includes('/')
      ? normalized
      : normalized.length === 3
        ? `USD/${normalized}`
        : normalized;

    if (/^[A-Z]{3}\/[A-Z]{3}$/.test(pair)) {
      return `${pair.replace('/', '')}=X`;
    }
  }

  return normalized;
}

function resolveBackendTarget(symbol: string, market?: string): BackendTarget {
  const normalized = symbol.trim().toUpperCase();

  if (normalized.endsWith('.NS') || normalized.endsWith('.BO') || normalized.endsWith('-USD') || normalized.endsWith('=X') || normalized.startsWith('^')) {
    return { symbol: normalized };
  }

  if (normalized.endsWith('.US')) {
    return { symbol: normalized.replace(/\.US$/, ''), market: 'us' };
  }

  if (market === 'nse' || market === 'bse' || market === 'us' || market === 'crypto' || market === 'forex') {
    return { symbol: normalized, market };
  }

  return { symbol: normalized };
}

function resolveTwelveDataTarget(symbol: string, market?: string): TwelveDataTarget {
  const normalized = symbol.trim().toUpperCase();

  if (normalized.endsWith('.NS')) {
    return { requestSymbol: normalized, symbol: normalized.replace(/\.NS$/, ''), exchange: 'NSE', market: 'nse' };
  }

  if (normalized.endsWith('.BO')) {
    return { requestSymbol: normalized, symbol: normalized.replace(/\.BO$/, ''), exchange: 'BSE', market: 'bse' };
  }

  if (normalized.endsWith('.US')) {
    return { requestSymbol: normalized, symbol: normalized.replace(/\.US$/, ''), market: 'us' };
  }

  if (normalized.endsWith('-USD')) {
    return { requestSymbol: normalized, symbol: normalized.replace(/-USD$/, '/USD'), market: 'crypto' };
  }

  if (normalized.endsWith('=X')) {
    const pair = normalized.replace(/=X$/, '');
    const forexPair = pair.length === 3 ? `USD/${pair}` : `${pair.slice(0, 3)}/${pair.slice(3, 6)}`;
    return { requestSymbol: normalized, symbol: forexPair, market: 'forex' };
  }

  if (market === 'nse') {
    return { requestSymbol: normalized, symbol: normalized, exchange: 'NSE', market: 'nse' };
  }

  if (market === 'bse') {
    return { requestSymbol: normalized, symbol: normalized, exchange: 'BSE', market: 'bse' };
  }

  if (market === 'crypto') {
    return { requestSymbol: normalized, symbol: normalized.includes('/') ? normalized : `${normalized}/USD`, market: 'crypto' };
  }

  if (market === 'forex') {
    const pair = normalized.length === 3 ? `USD/${normalized}` : `${normalized.slice(0, 3)}/${normalized.slice(3, 6)}`;
    return { requestSymbol: normalized, symbol: pair, market: 'forex' };
  }

  return { requestSymbol: normalized, symbol: normalized.replace(/\.US$/, ''), market: 'us' };
}

function mapApiResponse(data: any, symbol: string): StockQuote {
  const details = data.data;
  const currencyCode = resolveQuoteCurrencyCode(data.currency, undefined, symbol);
  return {
    symbol,
    companyName: details.company_name ?? symbol,
    exchange: data.exchange ?? 'NSE',
    currency: getCurrencySymbol(currencyCode),
    currencyCode,
    marketState: data.marketState,
    lastPrice: Number(details.last_price) || 0,
    change: Number(details.change) || 0,
    percentChange: Number(details.percent_change) || 0,
    previousClose: Number(details.previous_close) || 0,
    open: Number(details.open) || 0,
    dayHigh: Number(details.day_high) || 0,
    dayLow: Number(details.day_low) || 0,
    yearHigh: Number(details.year_high) || 0,
    yearLow: Number(details.year_low) || 0,
    volume: Number(details.volume) || 0,
    marketCap: Number(details.market_cap) || 0,
    peRatio: Number(details.pe_ratio) || 0,
    dividendYield: Number(details.dividend_yield) || 0,
    eps: Number(details.earnings_per_share) || 0,
    sector: details.sector ?? 'Unknown',
    lastUpdate: details.last_update ?? new Date().toISOString(),
  };
}

function mapTwelveDataQuote(data: any, target: TwelveDataTarget): StockQuote {
  const lastPrice = Number(data.close ?? data.price ?? 0) || 0;
  const previousClose = Number(data.previous_close ?? data.open ?? lastPrice) || 0;
  const change = Number(data.change ?? (lastPrice - previousClose)) || 0;
  const percentChange = Number(data.percent_change ?? (previousClose ? (change / previousClose) * 100 : 0)) || 0;
  const fiftyTwoWeek = data.fifty_two_week || {};
  const quoteTimestamp = data.last_quote_at || data.timestamp;
  const currencyCode = resolveQuoteCurrencyCode(data.currency, target.market, target.symbol);

  return {
    symbol: target.requestSymbol,
    companyName: data.name ?? target.requestSymbol,
    exchange: data.exchange || target.exchange || target.market.toUpperCase(),
    currency: getCurrencySymbol(currencyCode),
    currencyCode,
    marketState: typeof data.is_market_open === 'boolean'
      ? (data.is_market_open ? 'open' : 'closed')
      : undefined,
    lastPrice,
    change,
    percentChange,
    previousClose,
    open: Number(data.open ?? previousClose) || 0,
    dayHigh: Number(data.high ?? lastPrice) || 0,
    dayLow: Number(data.low ?? lastPrice) || 0,
    yearHigh: Number(fiftyTwoWeek.high) || 0,
    yearLow: Number(fiftyTwoWeek.low) || 0,
    volume: Number(data.volume) || 0,
    marketCap: Number(data.market_cap) || 0,
    peRatio: Number(data.pe) || 0,
    dividendYield: Number(data.dividend_yield) || 0,
    eps: Number(data.eps) || 0,
    sector: data.sector ?? 'Unknown',
    lastUpdate: quoteTimestamp
      ? new Date(Number(quoteTimestamp) * 1000).toISOString()
      : new Date().toISOString(),
  };
}

async function fetchWithRetry(url: string, opts: RequestInit, retries = 2, delayMs = 1000): Promise<Response> {
  for (let attempt = 0; attempt <= retries; attempt++) {
    try {
      const res = await fetch(url, opts);
      if (res.ok || attempt === retries) {
        return res;
      }
    } catch (error) {
      if (attempt === retries) {
        throw error;
      }
    }

    await new Promise(resolve => setTimeout(resolve, delayMs * Math.pow(2, attempt)));
  }

  throw new Error('fetchWithRetry exhausted');
}

function canUseProxy(proxyBase: string) {
  return Date.now() >= (proxyUnavailableUntil.get(proxyBase) ?? 0);
}

function markProxyUnavailable(proxyBase: string) {
  proxyUnavailableUntil.set(proxyBase, Date.now() + PROXY_BACKOFF_MS);
}

async function fetchProxyQuote(symbol: string, market?: string) {
  const target = resolveBackendTarget(symbol, market);
  const origin = typeof window !== 'undefined' ? window.location.origin : 'http://localhost';

  for (const proxyBase of getStockProxyBases()) {
    if (!canUseProxy(proxyBase)) {
      continue;
    }

    const url = new URL(`${proxyBase}/stock`, origin);
    url.searchParams.set('symbol', target.symbol);
    url.searchParams.set('res', 'num');
    if (target.market) {
      url.searchParams.set('market', target.market);
    }

    try {
      const res = await fetchWithRetry(url.toString(), { signal: AbortSignal.timeout(10_000) }, 0, 500);
      if (!res.ok) {
        markProxyUnavailable(proxyBase);
        continue;
      }

      const json = await res.json();
      if (json.status === 'success') {
        return mapApiResponse(json, symbol);
      }

      markProxyUnavailable(proxyBase);
    } catch {
      markProxyUnavailable(proxyBase);
    }
  }

  return null;
}

async function fetchProxyBatch(symbols: string[], market?: string) {
  if (symbols.length === 0) {
    return null;
  }

  const targets = symbols.map(symbol => ({
    requestSymbol: symbol,
    ...resolveBackendTarget(symbol, market),
  }));
  const sharedMarket = targets.every(target => target.market === targets[0]?.market)
    ? targets[0]?.market
    : undefined;
  const origin = typeof window !== 'undefined' ? window.location.origin : 'http://localhost';

  for (const proxyBase of getStockProxyBases()) {
    if (!canUseProxy(proxyBase)) {
      continue;
    }

    const url = new URL(`${proxyBase}/batch`, origin);
    url.searchParams.set('symbols', targets.map(target => target.symbol).join(','));

    if (sharedMarket) {
      url.searchParams.set('market', sharedMarket);
    }

    try {
      const res = await fetchWithRetry(url.toString(), { signal: AbortSignal.timeout(15_000) }, 0, 500);
      if (!res.ok) {
        markProxyUnavailable(proxyBase);
        continue;
      }

      const json = await res.json();
      const map: Record<string, StockQuote | null> = {};

      for (const target of targets) {
        const item = json.results?.[target.symbol];
        map[target.requestSymbol] = item?.status === 'success'
          ? mapApiResponse(item, target.requestSymbol)
          : null;
      }

      return map;
    } catch {
      markProxyUnavailable(proxyBase);
    }
  }

  return null;
}

function isTwelveDataError(payload: any) {
  return payload?.status === 'error' || typeof payload?.code === 'number';
}

async function fetchTwelveDataQuote(symbol: string, market?: string) {
  if (!hasDirectStockProvider()) {
    return null;
  }

  const target = resolveTwelveDataTarget(symbol, market);
  const url = new URL(`${TWELVE_DATA_BASE}/quote`);
  url.searchParams.set('symbol', target.symbol);
  url.searchParams.set('apikey', TWELVE_DATA_API_KEY);
  if (target.exchange) {
    url.searchParams.set('exchange', target.exchange);
  }

  try {
    const res = await fetchWithRetry(url.toString(), { signal: AbortSignal.timeout(10_000) }, 1, 500);
    if (!res.ok) {
      return null;
    }

    const json = await res.json();
    return isTwelveDataError(json) ? null : mapTwelveDataQuote(json, target);
  } catch {
    return null;
  }
}

function getBatchLookupPayload(payload: any, target: TwelveDataTarget) {
  if (!payload || typeof payload !== 'object') {
    return null;
  }

  if (payload.data && typeof payload.data === 'object') {
    return getBatchLookupPayload(payload.data, target);
  }

  const lookupKeys = [
    target.requestSymbol,
    target.requestSymbol.toUpperCase(),
    target.symbol,
    target.symbol.toUpperCase(),
    target.exchange ? `${target.symbol}:${target.exchange}` : '',
  ].filter(Boolean);

  for (const key of lookupKeys) {
    if (payload[key]) {
      return payload[key];
    }
  }

  return null;
}

async function fetchTwelveDataBatch(symbols: string[], market?: string) {
  if (!hasDirectStockProvider() || symbols.length === 0) {
    return null;
  }

  const targets = symbols.map(symbol => resolveTwelveDataTarget(symbol, market));
  const url = new URL(`${TWELVE_DATA_BASE}/quote`);
  url.searchParams.set('symbol', targets.map(target => target.exchange ? `${target.symbol}:${target.exchange}` : target.symbol).join(','));
  url.searchParams.set('apikey', TWELVE_DATA_API_KEY);

  try {
    const res = await fetchWithRetry(url.toString(), { signal: AbortSignal.timeout(15_000) }, 1, 500);
    if (!res.ok) {
      return null;
    }

    const json = await res.json();
    if (isTwelveDataError(json)) {
      return null;
    }

    const map: Record<string, StockQuote | null> = {};
    let successCount = 0;

    for (const target of targets) {
      const item = getBatchLookupPayload(json, target);
      if (item) {
        map[target.requestSymbol] = mapTwelveDataQuote(item, target);
        successCount += 1;
      } else {
        map[target.requestSymbol] = null;
      }
    }

    return successCount > 0 ? map : null;
  } catch {
    return null;
  }
}

function shouldKeepSearchResult(result: any, market?: string) {
  const exchange = (result.exchange || '').toUpperCase();
  const instrumentType = (result.instrument_type || '').toUpperCase();
  const micCode = (result.mic_code || '').toUpperCase();
  const symbol = (result.symbol || '').toUpperCase();

  if (market === 'nse') {
    return isNseExchange(exchange);
  }

  if (market === 'bse') {
    return isBseExchange(exchange);
  }

  if (market === 'us') {
    return isUsExchange(exchange);
  }

  if (market === 'forex') {
    return isForexInstrument(exchange, instrumentType, micCode, symbol);
  }

  if (market === 'crypto') {
    return isCryptoInstrument(exchange, instrumentType, micCode, symbol);
  }

  return isNseExchange(exchange) ||
    isBseExchange(exchange) ||
    isUsExchange(exchange) ||
    isForexInstrument(exchange, instrumentType, micCode, symbol) ||
    isCryptoInstrument(exchange, instrumentType, micCode, symbol);
}

function dedupeSearchResults(results: StockSearchResult[]) {
  const seen = new Set<string>();

  return results.filter(result => {
    if (seen.has(result.symbol)) {
      return false;
    }

    seen.add(result.symbol);
    return true;
  });
}

async function searchProxy(query: string, market?: string) {
  const origin = typeof window !== 'undefined' ? window.location.origin : 'http://localhost';

  for (const proxyBase of getStockProxyBases()) {
    if (!canUseProxy(proxyBase)) {
      continue;
    }

    const url = new URL(`${proxyBase}/search`, origin);
    url.searchParams.set('q', query);
    if (market) {
      url.searchParams.set('market', market);
    }

    try {
      const res = await fetchWithRetry(url.toString(), { signal: AbortSignal.timeout(8_000) }, 0, 500);
      if (!res.ok) {
        markProxyUnavailable(proxyBase);
        continue;
      }

      const json = await res.json();
      if (json.status !== 'success' || !Array.isArray(json.results)) {
        markProxyUnavailable(proxyBase);
        continue;
      }

      return dedupeSearchResults(
        json.results
          .map((result: any) => ({
            symbol: normalizeAppSymbol(result.symbol, result.exchange),
            companyName: result.company_name,
            exchange: result.exchange ?? '',
            nseUrl: result.nse_url ?? '',
            bseUrl: result.bse_url ?? '',
          }))
          .filter((result: StockSearchResult) => shouldKeepSearchResult(result, market))
          .slice(0, 12),
      );
    } catch {
      markProxyUnavailable(proxyBase);
    }
  }

  return [];
}

async function searchTwelveData(query: string, market?: string) {
  if (!hasDirectStockProvider()) {
    return [];
  }

  const url = new URL(`${TWELVE_DATA_BASE}/symbol_search`);
  url.searchParams.set('symbol', query);
  url.searchParams.set('apikey', TWELVE_DATA_API_KEY);

  try {
    const res = await fetchWithRetry(url.toString(), { signal: AbortSignal.timeout(8_000) }, 1, 500);
    if (!res.ok) {
      return [];
    }

    const json = await res.json();
    if (!Array.isArray(json.data)) {
      return [];
    }

    return dedupeSearchResults(
      json.data
        .filter((result: any) => shouldKeepSearchResult(result, market))
        .map((result: any) => ({
          symbol: normalizeAppSymbol(result.symbol, result.exchange, result.instrument_type, result.mic_code),
          companyName: result.instrument_name,
          exchange: result.exchange ?? '',
          nseUrl: '',
          bseUrl: '',
        }))
        .slice(0, 12),
    );
  } catch {
    return [];
  }
}

export async function fetchStockQuote(symbol: string, market?: string): Promise<StockQuote | null> {
  if (!navigator.onLine) {
    return readCache()[symbol] ?? null;
  }

  const proxyQuote = await fetchProxyQuote(symbol, market);
  if (proxyQuote) {
    writeCache({ [symbol]: proxyQuote });
    return proxyQuote;
  }

  const directQuote = await fetchTwelveDataQuote(symbol, market);
  if (directQuote) {
    writeCache({ [symbol]: directQuote });
    return directQuote;
  }

  return readCache()[symbol] ?? null;
}

export async function fetchMultipleQuotes(symbols: string[], market?: string): Promise<Record<string, StockQuote | null>> {
  const cachedData = readCache();
  const map: Record<string, StockQuote | null> = {};

  for (const symbol of symbols) {
    map[symbol] = cachedData[symbol] ?? null;
  }

  if (!navigator.onLine) {
    return map;
  }

  const proxyMap = await fetchProxyBatch(symbols, market);
  if (proxyMap) {
    Object.assign(map, proxyMap);
  }

  const missingSymbols = symbols.filter(symbol => !map[symbol]);
  if (missingSymbols.length > 0) {
    const directBatch = await fetchTwelveDataBatch(missingSymbols, market);
    if (directBatch) {
      Object.assign(map, directBatch);
    }
  }

  const unresolvedSymbols = symbols.filter(symbol => !map[symbol]);
  if (unresolvedSymbols.length > 0 && hasDirectStockProvider()) {
    const results = await Promise.allSettled(
      unresolvedSymbols.map(async symbol => ({ symbol, quote: await fetchTwelveDataQuote(symbol, market) })),
    );

    for (const result of results) {
      if (result.status === 'fulfilled') {
        map[result.value.symbol] = result.value.quote;
      }
    }
  }

  writeCache(map);
  return map;
}

export async function searchStocks(query: string, market?: string): Promise<StockSearchResult[]> {
  if (!navigator.onLine || !query.trim()) {
    return [];
  }

  const proxyResults = await searchProxy(query, market);
  if (proxyResults.length > 0) {
    return proxyResults;
  }

  return searchTwelveData(query, market);
}

export function formatIndianNumber(n: number): string {
  return new Intl.NumberFormat('en-IN').format(Math.round(n));
}

export function formatPrice(n: number, currency: string = '₹'): string {
  if (currency === '$') {
    return `$${new Intl.NumberFormat('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(n)}`;
  }
  return `${currency}${formatIndianNumber(n)}`;
}

export function formatMarketCap(n: number, currency: string = '₹'): string {
  if (currency === '$') {
    const billion = n / 1e9;
    if (billion >= 1000) return `$${(billion / 1000).toFixed(2)}T`;
    if (billion >= 1) return `$${billion.toFixed(2)}B`;
    return `$${(n / 1e6).toFixed(0)}M`;
  }

  const crore = n / 1e7;
  if (crore >= 1e5) return `₹${(crore / 1e5).toFixed(2)}L Cr`;
  if (crore >= 1e3) return `₹${(crore / 1e3).toFixed(2)}K Cr`;
  return `₹${crore.toFixed(0)} Cr`;
}

export function getDefaultWatchlist(market: MarketCategory): string[] {
  if (market === 'all') {
    return [
      'RELIANCE.NS',
      'TCS.NS',
      'RELIANCE.BO',
      'AAPL.US',
      'MSFT.US',
      'EURUSD=X',
      'USDJPY=X',
      'BTC-USD',
      'ETH-USD',
    ];
  }

  return DEFAULT_WATCHLISTS[market] ?? DEFAULT_WATCHLISTS.nse;
}

export function displaySymbol(symbol: string): string {
  if (symbol.endsWith('=X')) {
    const pair = symbol.replace(/=X$/, '');
    if (pair.length === 3) {
      return `USD/${pair}`;
    }
    if (pair.length === 6) {
      return `${pair.slice(0, 3)}/${pair.slice(3, 6)}`;
    }
  }

  return symbol
    .replace(/\.(NS|BO|US)$/, '')
    .replace(/-USD$/, '');
}
