import { Router } from 'express';

const router = Router();

// In-memory cache to reduce API calls and avoid Yahoo Finance rate limits
const cache = new Map<string, { data: any; expiry: number }>();
const CACHE_TTL_MS = 60 * 1000; // 1 minute cache for faster updates

// ── Market category definitions ────────────────────────────────────────
type MarketCategory = 'nse' | 'bse' | 'us' | 'forex' | 'crypto';

const MARKET_DEFAULTS: Record<MarketCategory, string[]> = {
  nse: ['RELIANCE', 'TCS', 'INFY', 'HDFCBANK', 'ICICIBANK', 'WIPRO', 'SBIN', 'BAJFINANCE', 'AXISBANK', 'MARUTI'],
  bse: ['RELIANCE.BO', 'TCS.BO', 'INFY.BO', 'HDFCBANK.BO', 'ICICIBANK.BO'],
  us: ['AAPL', 'TSLA', 'MSFT', 'NVDA', 'GOOGL', 'AMZN', 'META', 'NFLX'],
  forex: ['INR=X', 'EURUSD=X', 'GBPUSD=X', 'USDJPY=X'],
  crypto: ['BTC-USD', 'ETH-USD', 'SOL-USD', 'BNB-USD', 'XRP-USD', 'ADA-USD'],
};

/** Map a symbol to the correct Yahoo Finance symbol */
function toYahooSymbol(symbol: string, market?: string): string {
  // Already has a suffix/special char → use as-is
  if (symbol.includes('.') || symbol.includes('=') || symbol.includes('^') || symbol.includes('-')) {
    return symbol;
  }
  if (market === 'bse') return `${symbol}.BO`;
  if (market === 'nse') return `${symbol}.NS`;
  if (market === 'us' || market === 'forex' || market === 'crypto') return symbol;
  // No market specified ("all" mode) → return as-is; caller must provide
  // fully-qualified symbols (e.g. RELIANCE.NS, AAPL, BTC-USD)
  if (!market) return symbol;
  return `${symbol}.NS`;
}

/** Detect exchange from Yahoo Finance metadata */
function detectExchange(meta: any, symbol: string): string {
  const eName = (meta.exchangeName || '').toUpperCase();
  if (eName.includes('BSE') || symbol.endsWith('.BO')) return 'BSE';
  if (eName.includes('NSE') || eName.includes('NSI') || symbol.endsWith('.NS')) return 'NSE';
  if (
    eName.includes('NAS') ||
    eName.includes('NYS') ||
    eName.includes('NYSE') ||
    eName.includes('NASDAQ') ||
    eName === 'NMS' ||
    eName === 'NGM' ||
    eName === 'NYQ' ||
    eName === 'PCX'
  ) return 'US';
  if (eName.includes('CCY') || symbol.includes('=X')) return 'FOREX';
  if (eName.includes('CCC') || symbol.includes('-USD')) return 'CRYPTO';
  return eName || 'NSE';
}

function getMarketState(meta: any): string {
  if (!meta.currentTradingPeriod?.regular) {
    return 'unknown';
  }

  const nowSec = Math.floor(Date.now() / 1000);
  const start = meta.currentTradingPeriod.regular.start;
  const end = meta.currentTradingPeriod.regular.end;
  return nowSec >= start && nowSec <= end ? 'open' : 'closed';
}

/** Detect currency symbol */
function currencySymbol(exchange: string): string {
  if (exchange === 'US' || exchange === 'CRYPTO' || exchange === 'FOREX') return '$';
  return '₹';
}

// ── GET /stocks/markets — return default symbols for a market ──
router.get('/markets', (req, res) => {
  const market = ((req.query.market as string) || 'nse').toLowerCase() as MarketCategory;
  const symbols = MARKET_DEFAULTS[market] || MARKET_DEFAULTS.nse;
  res.json({ status: 'success', market, symbols });
});

// ── GET /stocks/search — multi-market search ──────────────────────────
router.get('/search', async (req, res) => {
  try {
    const query = (req.query.q as string) || '';
    const market = (req.query.market as string) || '';
    if (!query) {
      res.status(200).json({ status: 'success', results: [] });
      return;
    }

    const cacheKey = `search_${query.toLowerCase()}_${market}`;
    const now = Date.now();

    if (cache.has(cacheKey)) {
      const cached = cache.get(cacheKey)!;
      if (now < cached.expiry) {
        res.status(200).json(cached.data);
        return;
      }
    }

    const yhUrl = `https://query1.finance.yahoo.com/v1/finance/search?q=${encodeURIComponent(query)}&quotesCount=15`;

    const up = await fetch(yhUrl, {
      headers: { 'User-Agent': 'Mozilla/5.0' },
      signal: AbortSignal.timeout(8000),
    });

    const data = await up.json();
    const quotes = data.quotes || [];

    // Filter by market if specified
    const results = quotes
      .filter((q: any) => {
        if (!market) return true; // no filter
        const ex = (q.exchange || '').toUpperCase();
        const sym = (q.symbol || '').toUpperCase();
        switch (market.toLowerCase()) {
          case 'nse': return ex === 'NSI' || ex === 'NSE' || sym.endsWith('.NS');
          case 'bse': return ex === 'BSE' || sym.endsWith('.BO');
          case 'us': return ex === 'NMS' || ex === 'NYQ' || ex === 'NYS' || ex === 'NAS' || ex === 'NASDAQ' || ex === 'NYSE';
          case 'forex': return ex === 'CCY' || sym.includes('=X');
          case 'crypto': return ex === 'CCC' || sym.includes('-USD');
          default: return true;
        }
      })
      .slice(0, 10)
      .map((q: any) => ({
        // Keep full symbol (e.g. RELIANCE.NS) when in multi-market mode (no specific market),
        // so the client can fetch the correct quote without a market hint.
        // Only strip .NS when the market is explicitly 'nse' (user is in NSE tab).
        symbol: market.toLowerCase() === 'nse'
          ? String(q.symbol).replace(/\.NS$/, '')
          : String(q.symbol),
        company_name: q.shortname || q.longname || q.symbol,
        exchange: q.exchange || '',
        nse_url: '',
        bse_url: '',
      }));

    const responseData = { status: 'success', results };
    cache.set(cacheKey, { data: responseData, expiry: now + CACHE_TTL_MS * 5 });

    res.status(200).json(responseData);
  } catch (err: any) {
    res.status(502).json({ error: 'Upstream fetch failed', detail: err.message });
  }
});

/** Fetch a single chart from Yahoo Finance. Returns result.meta or null. */
async function fetchYahooChart(ySymbol: string): Promise<{ meta: any, ySymbol: string } | null> {
  try {
    const yhUrl = `https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(ySymbol)}?interval=1d&range=1d`;
    const up = await fetch(yhUrl, {
      headers: { 'User-Agent': 'Mozilla/5.0' },
      signal: AbortSignal.timeout(8000),
    });
    if (!up.ok) return null;
    const data = await up.json();
    const result = data?.chart?.result?.[0];
    if (!result?.meta || !result.meta.regularMarketPrice) return null;
    return { meta: result.meta, ySymbol };
  } catch {
    return null;
  }
}

// ── GET /stocks/stock — single quote (multi-market) ───────────────────
router.get('/stock', async (req, res) => {
  try {
    let symbol = (req.query.symbol as string) || '';
    const market = (req.query.market as string) || '';
    if (!symbol) {
      res.status(400).json({ status: 'error', message: 'symbol required' });
      return;
    }

    const ySymbol = toYahooSymbol(symbol, market);

    const cacheKey = `quote_${ySymbol}`;
    const now = Date.now();

    if (cache.has(cacheKey)) {
      const cached = cache.get(cacheKey)!;
      if (now < cached.expiry) {
        res.status(200).json(cached.data);
        return;
      }
    }

    // Try primary symbol, then fallback to .NS if no market specified and plain symbol
    let chartResult = await fetchYahooChart(ySymbol);

    // If failed and no market was specified and symbol has no suffix, try .NS (Indian stock)
    if (!chartResult && !market && !symbol.includes('.') && !symbol.includes('=') && !symbol.includes('^') && !symbol.includes('-')) {
      const nsSym = `${symbol}.NS`;
      chartResult = await fetchYahooChart(nsSym);
    }

    if (!chartResult) {
      res.status(404).json({ status: 'error', message: 'Not found' });
      return;
    }

    const m = chartResult.meta;
    const lastPrice = m.regularMarketPrice ?? 0;
    const prevClose = m.chartPreviousClose ?? m.previousClose ?? lastPrice;
    const change = lastPrice - prevClose;
    const percentChange = prevClose ? (change / prevClose) * 100 : 0;

    const exchange = detectExchange(m, chartResult.ySymbol);
    const marketState = getMarketState(m);

    const responseData = {
      status: 'success',
      symbol: symbol,
      exchange,
      currency: currencySymbol(exchange),
      marketState,
      data: {
        company_name: m.longName || m.shortName || symbol,
        last_price: lastPrice,
        change: change,
        percent_change: percentChange,
        previous_close: prevClose,
        open: m.regularMarketOpen ?? m.regularMarketDayHigh ?? 0,
        day_high: m.regularMarketDayHigh ?? 0,
        day_low: m.regularMarketDayLow ?? 0,
        year_high: m.fiftyTwoWeekHigh ?? 0,
        year_low: m.fiftyTwoWeekLow ?? 0,
        volume: m.regularMarketVolume ?? 0,
        market_cap: 0,
        pe_ratio: 0,
        dividend_yield: 0,
        earnings_per_share: 0,
        sector: 'Unknown',
        last_update: new Date().toISOString(),
      },
    };

    cache.set(cacheKey, { data: responseData, expiry: now + CACHE_TTL_MS });
    res.status(200).json(responseData);
  } catch (err: any) {
    res.status(502).json({ error: 'Upstream fetch failed', detail: err.message });
  }
});

// ── GET /stocks/batch — fetch multiple quotes at once ─────────────────
router.get('/batch', async (req, res) => {
  try {
    const symbolsParam = (req.query.symbols as string) || '';
    const market = (req.query.market as string) || '';
    if (!symbolsParam) {
      res.status(400).json({ status: 'error', message: 'symbols required' });
      return;
    }

    const symbols = symbolsParam.split(',').map(s => s.trim()).filter(Boolean).slice(0, 20);
    const results: Record<string, any> = {};

    await Promise.allSettled(
      symbols.map(async (symbol) => {
        const ySymbol = toYahooSymbol(symbol, market);
        const cacheKey = `quote_${ySymbol}`;
        const now = Date.now();

        if (cache.has(cacheKey)) {
          const cached = cache.get(cacheKey)!;
          if (now < cached.expiry) {
            results[symbol] = cached.data;
            return;
          }
        }

        try {
          // Use fetchYahooChart with .NS fallback for unqualified symbols
          let chartResult = await fetchYahooChart(ySymbol);

          // If failed and no market specified and plain symbol, try .NS suffix
          if (!chartResult && !market && !symbol.includes('.') && !symbol.includes('=') && !symbol.includes('^') && !symbol.includes('-')) {
            const nsSym = `${symbol}.NS`;
            chartResult = await fetchYahooChart(nsSym);
          }

          if (!chartResult) { results[symbol] = null; return; }

          const m = chartResult.meta;
          const lastPrice = m.regularMarketPrice ?? 0;
          const prevClose = m.chartPreviousClose ?? m.previousClose ?? lastPrice;
          const change = lastPrice - prevClose;
          const percentChange = prevClose ? (change / prevClose) * 100 : 0;
          const exchange = detectExchange(m, chartResult.ySymbol);
          const marketState = getMarketState(m);

          const responseData = {
            status: 'success',
            symbol,
            exchange,
            currency: currencySymbol(exchange),
            marketState,
            data: {
              company_name: m.longName || m.shortName || symbol,
              last_price: lastPrice,
              change,
              percent_change: percentChange,
              previous_close: prevClose,
              open: m.regularMarketOpen ?? 0,
              day_high: m.regularMarketDayHigh ?? 0,
              day_low: m.regularMarketDayLow ?? 0,
              year_high: m.fiftyTwoWeekHigh ?? 0,
              year_low: m.fiftyTwoWeekLow ?? 0,
              volume: m.regularMarketVolume ?? 0,
              market_cap: 0,
              pe_ratio: 0,
              dividend_yield: 0,
              earnings_per_share: 0,
              sector: 'Unknown',
              last_update: new Date().toISOString(),
            },
          };

          cache.set(cacheKey, { data: responseData, expiry: now + CACHE_TTL_MS });
          results[symbol] = responseData;
        } catch {
          results[symbol] = null;
        }
      })
    );

    res.json({ status: 'success', results });
  } catch (err: any) {
    res.status(502).json({ error: 'Batch fetch failed', detail: err.message });
  }
});

export { router as stockRoutes };
