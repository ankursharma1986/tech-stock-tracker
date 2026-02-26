import fetch from 'node-fetch';

const BASE_URL = 'https://finnhub.io/api/v1';

function getKey() {
  const key = process.env.FINNHUB_API_KEY;
  if (!key) throw new Error('FINNHUB_API_KEY not set. Copy .env.example to .env and add your key.');
  return key;
}

export async function fetchStockPrices(symbols) {
  const apiKey = getKey();

  const results = await Promise.allSettled(
    symbols.map(symbol =>
      fetch(`${BASE_URL}/quote?symbol=${symbol}&token=${apiKey}`)
        .then(res => res.json())
        .then(data => {
          if (data.error) throw new Error(data.error);
          return { symbol, data };
        })
    )
  );

  return results.map((result, i) => {
    if (result.status === 'fulfilled') {
      const { symbol, data } = result.value;
      const change = data.c - data.pc;
      const changePct = data.pc > 0 ? (change / data.pc) * 100 : 0;
      return {
        symbol,
        price: data.c,
        change,
        changePercent: changePct,
        high: data.h,
        low: data.l,
        open: data.o,
        previousClose: data.pc,
      };
    } else {
      return { symbol: symbols[i], error: result.reason.message };
    }
  });
}

export async function fetchStockDetails(symbol) {
  const apiKey = getKey();

  const [historyRes, profileRes, metricsRes] = await Promise.allSettled([
    // Yahoo Finance chart API — free, no key, supports 1Y weekly data
    fetch(
      `https://query1.finance.yahoo.com/v8/finance/chart/${symbol}?range=1y&interval=1wk`,
      { headers: { 'User-Agent': 'Mozilla/5.0', 'Accept': 'application/json' } }
    ).then(r => r.json()),
    fetch(`${BASE_URL}/stock/profile2?symbol=${symbol}&token=${apiKey}`).then(r => r.json()),
    fetch(`${BASE_URL}/stock/metric?symbol=${symbol}&metric=all&token=${apiKey}`).then(r => r.json()),
  ]);

  // Transform Yahoo Finance response into { s, t, c, h, l, o, v } format
  let history = null;
  if (historyRes.status === 'fulfilled') {
    const result = historyRes.value?.chart?.result?.[0];
    if (result?.timestamp?.length) {
      const q = result.indicators.quote[0];
      // Filter out null data points
      const valid = result.timestamp.reduce((acc, ts, i) => {
        if (q.close[i] != null) acc.push(i);
        return acc;
      }, []);
      history = {
        s: 'ok',
        t: valid.map(i => result.timestamp[i]),
        c: valid.map(i => q.close[i]),
        h: valid.map(i => q.high[i]),
        l: valid.map(i => q.low[i]),
        o: valid.map(i => q.open[i]),
        v: valid.map(i => q.volume[i]),
      };
    }
  }

  const profile = profileRes.status === 'fulfilled' ? profileRes.value : {};
  const metrics = metricsRes.status === 'fulfilled' ? (metricsRes.value.metric || {}) : {};

  return { history, profile, metrics };
}
