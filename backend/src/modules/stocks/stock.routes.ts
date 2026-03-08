import { Router } from 'express';

const router = Router();

// In-memory cache to reduce API calls and avoid Yahoo Finance rate limits
// Best Architecture: Stock API -> Backend -> In-Memory Cache -> Mobile App
const cache = new Map<string, { data: any; expiry: number }>();
const CACHE_TTL_MS = 5 * 60 * 1000; // 5 minutes cache

// Search stocks using Yahoo Finance
router.get('/search', async (req, res) => {
  try {
    const query = (req.query.q as string) || '';
    if (!query) {
      res.status(200).json({ status: 'success', results: [] });
      return;
    }

    const cacheKey = `search_${query.toLowerCase()}`;
    const now = Date.now();

    if (cache.has(cacheKey)) {
      const cached = cache.get(cacheKey)!;
      if (now < cached.expiry) {
        res.status(200).json(cached.data);
        return;
      }
    }

    const yhUrl = `https://query1.finance.yahoo.com/v1/finance/search?q=${encodeURIComponent(query)}`;
    
    const up = await fetch(yhUrl, {
      headers: { 'User-Agent': 'Mozilla/5.0' },
      signal: AbortSignal.timeout(8000),
    });

    const data = await up.json();
    const quotes = data.quotes || [];
    const results = quotes
      .filter((q: any) => q.exchange === 'NSI' || q.exchange === 'BSE')
      .map((q: any) => ({
        // We only strip .NS so default symbols still look clean like "TCS".
        // We intentionally KEEP .BO so we can correctly fetch BSE stocks without 404 errors.
        symbol: String(q.symbol).replace(/\.NS$/, ''),
        company_name: q.shortname || q.longname || q.symbol,
        nse_url: '',
        bse_url: ''
      }));
                   
    const responseData = { status: 'success', results };
    
    // Save to cache
    cache.set(cacheKey, { data: responseData, expiry: now + CACHE_TTL_MS });

    res.status(200).json(responseData);
  } catch (err: any) {
    res.status(502).json({ error: 'Upstream fetch failed', detail: err.message });
  }
});

// Get stock quote using Yahoo Finance
router.get('/stock', async (req, res) => {
  try {
    let symbol = (req.query.symbol as string) || '';
    if (!symbol) {
      res.status(400).json({ status: 'error', message: 'symbol required' });
      return;
    }
    
    // Auto-append .NS for Indian stocks if no suffix exists and it's not a special index/commodity
    let ySymbol = symbol;
    if (!ySymbol.includes('.') && !ySymbol.includes('=') && !ySymbol.includes('^')) {
      ySymbol = `${ySymbol}.NS`;
    }

    const cacheKey = `quote_${ySymbol}`;
    const now = Date.now();

    if (cache.has(cacheKey)) {
      const cached = cache.get(cacheKey)!;
      if (now < cached.expiry) {
        res.status(200).json(cached.data);
        return;
      }
    }

    const yhUrl = `https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(ySymbol)}?interval=1d&range=1d`;
    const up = await fetch(yhUrl, {
      headers: { 'User-Agent': 'Mozilla/5.0' },
      signal: AbortSignal.timeout(8000),
    });

    if (!up.ok) {
       res.status(404).json({ status: 'error', message: 'Not found' });
       return;
    }

    const data = await up.json();
    const result = data?.chart?.result?.[0];
    if (!result || !result.meta) {
       res.status(404).json({ status: 'error', message: 'Not found' });
       return;
    }

    const m = result.meta;
    const lastPrice = m.regularMarketPrice ?? 0;
    const prevClose = m.chartPreviousClose ?? m.previousClose ?? lastPrice;
    const change = lastPrice - prevClose;
    const percentChange = prevClose ? (change / prevClose) * 100 : 0;

    const responseData = {
      status: 'success',
      symbol: symbol,
      exchange: m.exchangeName === 'BSE' ? 'BSE' : 'NSE',
      data: {
        company_name: m.longName || m.shortName || symbol,
        last_price: lastPrice,
        change: change,
        percent_change: percentChange,
        previous_close: prevClose,
        open: m.regularMarketDayHigh ?? 0, // Fallback
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
        last_update: new Date().toISOString()
      }
    };

    // Save to cache
    cache.set(cacheKey, { data: responseData, expiry: now + CACHE_TTL_MS });

    res.status(200).json(responseData);
  } catch (err: any) {
    res.status(502).json({ error: 'Upstream fetch failed', detail: err.message });
  }
});

export { router as stockRoutes };
