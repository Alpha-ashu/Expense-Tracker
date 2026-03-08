import type { VercelRequest, VercelResponse } from '@vercel/node';

/**
 * Proxy for Indian Stock Market API.
 * The original dependency went 404, so we're building our own seamless drop-in
 * replacement that proxies directly safely to Yahoo Finance's free APIs.
 */
export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  // Set standard CORS and Cache headers
  res.setHeader('Content-Type', 'application/json');
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Cache-Control', 'public, s-maxage=30, stale-while-revalidate=60');

  const { url } = req;
  const rawPath = (url ?? '').replace(/^\/api\/stocks/, '');
  const urlObj = new URL(rawPath, 'http://localhost');
  const pathname = urlObj.pathname;

  try {
    // ── SEARCH ENDPOINT ──────────────────────────────────────
    if (pathname === '/search') {
      const query = urlObj.searchParams.get('q') || '';
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
          symbol: String(q.symbol).replace(/\.NS$|\.BO$/, ''),
          company_name: q.shortname || q.longname || q.symbol,
          nse_url: '',
          bse_url: ''
        }));
                   
      return res.status(200).json({ status: 'success', results });
    }

    // ── QUOTE ENDPOINT ───────────────────────────────────────
    if (pathname === '/stock') {
      let symbol = urlObj.searchParams.get('symbol') || '';
      if (!symbol) return res.status(400).json({ status: 'error', message: 'symbol required' });
      
      // Auto-append .NS for Indian stocks if no suffix exists and it's not a special index/commodity
      let ySymbol = symbol;
      if (!ySymbol.includes('.') && !ySymbol.includes('=') && !ySymbol.includes('^')) {
        ySymbol = `${ySymbol}.NS`;
      }

      const yhUrl = `https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(ySymbol)}?interval=1d&range=1d`;
      const up = await fetch(yhUrl, {
        headers: { 'User-Agent': 'Mozilla/5.0' },
        signal: AbortSignal.timeout(8000),
      });

      if (!up.ok) {
         return res.status(404).json({ status: 'error', message: 'Not found' });
      }

      const data = await up.json();
      const result = data?.chart?.result?.[0];
      if (!result || !result.meta) {
         return res.status(404).json({ status: 'error', message: 'Not found' });
      }

      const m = result.meta;
      const lastPrice = m.regularMarketPrice ?? 0;
      const prevClose = m.chartPreviousClose ?? m.previousClose ?? lastPrice;
      const change = lastPrice - prevClose;
      const percentChange = prevClose ? (change / prevClose) * 100 : 0;

      return res.status(200).json({
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
      });
    }

    return res.status(404).json({ error: 'Endpoint not mapped' });

  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : 'Unknown error';
    return res.status(502).json({ error: 'Upstream fetch failed', detail: msg });
  }
}
