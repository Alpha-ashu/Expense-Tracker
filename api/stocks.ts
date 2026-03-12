import type { VercelRequest, VercelResponse } from '@vercel/node';

type MarketCategory = 'nse' | 'bse' | 'us' | 'forex' | 'crypto';

interface CachedPayload {
  data: unknown;
  expiry: number;
}

const cache = new Map<string, CachedPayload>();
const CACHE_TTL_MS = 60_000;

const MARKET_DEFAULTS: Record<MarketCategory, string[]> = {
  nse: ['RELIANCE.NS', 'TCS.NS', 'INFY.NS', 'HDFCBANK.NS', 'ICICIBANK.NS'],
  bse: ['RELIANCE.BO', 'TCS.BO', 'INFY.BO', 'HDFCBANK.BO', 'ICICIBANK.BO'],
  us: ['AAPL', 'TSLA', 'MSFT', 'NVDA', 'GOOGL'],
  forex: ['USDINR=X', 'EURUSD=X', 'GBPUSD=X', 'USDJPY=X'],
  crypto: ['BTC-USD', 'ETH-USD', 'SOL-USD', 'BNB-USD', 'XRP-USD'],
};

function setHeaders(res: VercelResponse) {
  res.setHeader('Content-Type', 'application/json');
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET,OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  res.setHeader('Cache-Control', 'public, s-maxage=20, stale-while-revalidate=40');
}

function getRequestPath(req: VercelRequest) {
  const endpoint = req.query.endpoint;
  if (typeof endpoint === 'string' && endpoint.trim()) {
    const searchParams = new URLSearchParams();
    for (const [key, value] of Object.entries(req.query)) {
      if (key === 'endpoint' || value == null) {
        continue;
      }

      if (Array.isArray(value)) {
        for (const item of value) {
          searchParams.append(key, String(item));
        }
      } else {
        searchParams.set(key, String(value));
      }
    }

    return {
      pathname: `/${endpoint.replace(/^\/+/, '')}`,
      searchParams,
    };
  }

  const rawUrl = req.url ?? '/api/v1/stocks';
  const rawPath = rawUrl.replace(/^\/api\/(?:v1\/)?stocks/, '');
  const url = new URL(rawPath || '/', 'https://expense-tracker.local');
  return {
    pathname: url.pathname || '/',
    searchParams: url.searchParams,
  };
}

function getCached<T>(key: string): T | null {
  const cached = cache.get(key);
  if (!cached) {
    return null;
  }

  if (Date.now() >= cached.expiry) {
    cache.delete(key);
    return null;
  }

  return cached.data as T;
}

function setCached(key: string, data: unknown, ttlMs = CACHE_TTL_MS) {
  cache.set(key, {
    data,
    expiry: Date.now() + ttlMs,
  });
}

function isQualifiedSymbol(symbol: string) {
  return symbol.includes('.') || symbol.includes('=') || symbol.includes('^') || symbol.includes('-');
}

function toYahooSymbol(symbol: string, market?: string) {
  const normalized = symbol.trim().toUpperCase();

  if (normalized.endsWith('.US')) {
    return normalized.replace(/\.US$/, '');
  }

  if (isQualifiedSymbol(normalized)) {
    return normalized;
  }

  if (market === 'bse') {
    return `${normalized}.BO`;
  }

  if (market === 'nse') {
    return `${normalized}.NS`;
  }

  return normalized;
}

function detectExchange(meta: any, symbol: string): string {
  const exchangeName = String(meta?.exchangeName || '').toUpperCase();

  if (exchangeName.includes('BSE') || symbol.endsWith('.BO')) {
    return 'BSE';
  }

  if (exchangeName.includes('NSE') || exchangeName.includes('NSI') || symbol.endsWith('.NS')) {
    return 'NSE';
  }

  if (
    exchangeName.includes('NAS') ||
    exchangeName.includes('NYS') ||
    exchangeName.includes('NYSE') ||
    exchangeName.includes('NASDAQ') ||
    exchangeName === 'NMS' ||
    exchangeName === 'NGM' ||
    exchangeName === 'NYQ' ||
    exchangeName === 'PCX'
  ) {
    return 'US';
  }

  if (exchangeName.includes('CCY') || symbol.includes('=X')) {
    return 'FOREX';
  }

  if (exchangeName.includes('CCC') || symbol.includes('-USD')) {
    return 'CRYPTO';
  }

  return exchangeName || 'NSE';
}

function currencyCodeToSymbol(code?: string, exchange?: string) {
  const normalized = String(code || '').toUpperCase();
  const symbols: Record<string, string> = {
    INR: '₹',
    USD: '$',
    EUR: '€',
    GBP: '£',
    JPY: '¥',
    AUD: 'A$',
    CAD: 'C$',
    SGD: 'S$',
    CHF: 'CHF',
  };

  if (symbols[normalized]) {
    return symbols[normalized];
  }

  if (exchange === 'NSE' || exchange === 'BSE') {
    return '₹';
  }

  return '$';
}

function getMarketState(meta: any, exchange: string) {
  if (exchange === 'CRYPTO') {
    return 'open';
  }

  const regularSession = meta?.currentTradingPeriod?.regular;
  if (!regularSession?.start || !regularSession?.end) {
    return 'unknown';
  }

  const nowSeconds = Math.floor(Date.now() / 1000);
  return nowSeconds >= regularSession.start && nowSeconds <= regularSession.end ? 'open' : 'closed';
}

async function fetchYahooChart(yahooSymbol: string) {
  const headers = {
    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
    'Accept': 'application/json, text/plain, */*',
    'Accept-Language': 'en-US,en;q=0.9',
    'Referer': 'https://finance.yahoo.com/',
    'Origin': 'https://finance.yahoo.com',
  };
  const path = `/v8/finance/chart/${encodeURIComponent(yahooSymbol)}?interval=1d&range=1d`;

  for (const host of ['query1.finance.yahoo.com', 'query2.finance.yahoo.com']) {
    try {
      const response = await fetch(`https://${host}${path}`, {
        headers,
        signal: AbortSignal.timeout(8_000),
      });

      if (!response.ok) {
        continue;
      }

      const payload = await response.json();
      const result = payload?.chart?.result?.[0];

      if (!result?.meta || result.meta.regularMarketPrice == null) {
        continue;
      }

      return {
        meta: result.meta,
        yahooSymbol,
      };
    } catch {
      continue;
    }
  }

  return null;
}

async function resolveChart(symbol: string, market?: string) {
  const primarySymbol = toYahooSymbol(symbol, market);
  const primaryResult = await fetchYahooChart(primarySymbol);
  if (primaryResult) {
    return primaryResult;
  }

  const normalized = symbol.trim().toUpperCase();
  if (!market && !isQualifiedSymbol(normalized)) {
    return fetchYahooChart(`${normalized}.NS`);
  }

  return null;
}

function toQuotePayload(symbol: string, yahooSymbol: string, meta: any) {
  const exchange = detectExchange(meta, yahooSymbol);
  const lastPrice = Number(meta?.regularMarketPrice ?? 0);
  const previousClose = Number(meta?.chartPreviousClose ?? meta?.previousClose ?? lastPrice);
  const change = lastPrice - previousClose;
  const percentChange = previousClose ? (change / previousClose) * 100 : 0;
  const marketState = getMarketState(meta, exchange);

  return {
    status: 'success',
    symbol,
    exchange,
    currency: currencyCodeToSymbol(meta?.currency, exchange),
    marketState,
    data: {
      company_name: meta?.longName || meta?.shortName || symbol,
      last_price: lastPrice,
      change,
      percent_change: percentChange,
      previous_close: previousClose,
      open: Number(meta?.regularMarketOpen ?? meta?.regularMarketPrice ?? 0),
      day_high: Number(meta?.regularMarketDayHigh ?? meta?.regularMarketPrice ?? 0),
      day_low: Number(meta?.regularMarketDayLow ?? meta?.regularMarketPrice ?? 0),
      year_high: Number(meta?.fiftyTwoWeekHigh ?? 0),
      year_low: Number(meta?.fiftyTwoWeekLow ?? 0),
      volume: Number(meta?.regularMarketVolume ?? 0),
      market_cap: 0,
      pe_ratio: 0,
      dividend_yield: 0,
      earnings_per_share: 0,
      sector: 'Unknown',
      last_update: new Date().toISOString(),
    },
  };
}

function matchesMarket(result: any, market?: string) {
  if (!market) {
    return true;
  }

  const exchange = String(result?.exchange || '').toUpperCase();
  const symbol = String(result?.symbol || '').toUpperCase();

  switch (market) {
    case 'nse':
      return exchange === 'NSI' || exchange === 'NSE' || symbol.endsWith('.NS');
    case 'bse':
      return exchange === 'BSE' || exchange === 'XBOM' || symbol.endsWith('.BO');
    case 'us':
      return exchange === 'NMS' || exchange === 'NYQ' || exchange === 'NYS' || exchange === 'NAS' || exchange === 'NASDAQ' || exchange === 'NYSE';
    case 'forex':
      return exchange === 'CCY' || symbol.includes('=X');
    case 'crypto':
      return exchange === 'CCC' || symbol.includes('-USD');
    default:
      return true;
  }
}

async function handleMarkets(req: VercelRequest, res: VercelResponse) {
  const market = String(req.query.market || 'nse').toLowerCase() as MarketCategory;
  res.status(200).json({
    status: 'success',
    market,
    symbols: MARKET_DEFAULTS[market] || MARKET_DEFAULTS.nse,
  });
}

async function handleSearch(searchParams: URLSearchParams, res: VercelResponse) {
  const query = searchParams.get('q')?.trim() || '';
  const market = searchParams.get('market')?.trim().toLowerCase();

  if (!query) {
    res.status(200).json({ status: 'success', results: [] });
    return;
  }

  const cacheKey = `search:${market || 'all'}:${query.toUpperCase()}`;
  const cached = getCached(cacheKey);
  if (cached) {
    res.status(200).json(cached);
    return;
  }

  const url = `https://query1.finance.yahoo.com/v1/finance/search?q=${encodeURIComponent(query)}&quotesCount=15`;
  const response = await fetch(url, {
    headers: {
      'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
      'Accept': 'application/json, text/plain, */*',
      'Referer': 'https://finance.yahoo.com/',
    },
    signal: AbortSignal.timeout(8_000),
  });

  if (!response.ok) {
    res.status(502).json({ error: 'Upstream fetch failed', detail: `Yahoo search returned ${response.status}` });
    return;
  }

  const payload = await response.json();
  const results = Array.isArray(payload?.quotes)
    ? payload.quotes
      .filter((result: any) => matchesMarket(result, market))
      .slice(0, 12)
      .map((result: any) => ({
        symbol: String(result.symbol || ''),
        company_name: result.shortname || result.longname || result.symbol,
        exchange: result.exchange || '',
        nse_url: '',
        bse_url: '',
      }))
    : [];

  const responsePayload = {
    status: 'success',
    results,
  };

  setCached(cacheKey, responsePayload, CACHE_TTL_MS * 5);
  res.status(200).json(responsePayload);
}

async function handleStock(searchParams: URLSearchParams, res: VercelResponse) {
  const symbol = searchParams.get('symbol')?.trim() || '';
  const market = searchParams.get('market')?.trim().toLowerCase() || undefined;

  if (!symbol) {
    res.status(400).json({ status: 'error', message: 'symbol required' });
    return;
  }

  const yahooSymbol = toYahooSymbol(symbol, market);
  const cacheKey = `quote:${market || 'all'}:${yahooSymbol}`;
  const cached = getCached(cacheKey);
  if (cached) {
    res.status(200).json(cached);
    return;
  }

  const chart = await resolveChart(symbol, market);
  if (!chart) {
    res.status(404).json({ status: 'error', message: 'Not found' });
    return;
  }

  const payload = toQuotePayload(symbol, chart.yahooSymbol, chart.meta);
  setCached(cacheKey, payload);
  res.status(200).json(payload);
}

async function handleBatch(searchParams: URLSearchParams, res: VercelResponse) {
  const symbolsParam = searchParams.get('symbols')?.trim() || '';
  const market = searchParams.get('market')?.trim().toLowerCase() || undefined;

  if (!symbolsParam) {
    res.status(400).json({ status: 'error', message: 'symbols required' });
    return;
  }

  const symbols = symbolsParam
    .split(',')
    .map(symbol => symbol.trim())
    .filter(Boolean)
    .slice(0, 20);

  const results: Record<string, unknown> = {};

  await Promise.allSettled(symbols.map(async symbol => {
    const yahooSymbol = toYahooSymbol(symbol, market);
    const cacheKey = `quote:${market || 'all'}:${yahooSymbol}`;
    const cached = getCached(cacheKey);

    if (cached) {
      results[symbol] = cached;
      return;
    }

    try {
      const chart = await resolveChart(symbol, market);
      if (!chart) {
        results[symbol] = null;
        return;
      }

      const payload = toQuotePayload(symbol, chart.yahooSymbol, chart.meta);
      setCached(cacheKey, payload);
      results[symbol] = payload;
    } catch {
      results[symbol] = null;
    }
  }));

  res.status(200).json({
    status: 'success',
    results,
  });
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  setHeaders(res);

  if (req.method === 'OPTIONS') {
    res.status(200).end();
    return;
  }

  if (req.method !== 'GET') {
    res.status(405).json({ error: 'Method not allowed' });
    return;
  }

  const { pathname, searchParams } = getRequestPath(req);

  try {
    if (pathname === '/markets') {
      await handleMarkets(req, res);
      return;
    }

    if (pathname === '/search') {
      await handleSearch(searchParams, res);
      return;
    }

    if (pathname === '/stock') {
      await handleStock(searchParams, res);
      return;
    }

    if (pathname === '/batch') {
      await handleBatch(searchParams, res);
      return;
    }

    res.status(404).json({ error: 'Endpoint not mapped' });
  } catch (error) {
    const detail = error instanceof Error ? error.message : 'Unknown error';
    res.status(502).json({ error: 'Upstream fetch failed', detail });
  }
}
