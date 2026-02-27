'use strict';

// All 11 tracked tech stocks (symbol → company name)
const STOCKS = {
  // FAANG
  META:  'Meta Platforms',
  AAPL:  'Apple',
  AMZN:  'Amazon',
  NFLX:  'Netflix',
  GOOGL: 'Alphabet (Google)',
  // Semiconductors
  NVDA:  'NVIDIA',
  AMD:   'AMD',
  INTC:  'Intel',
  // Enterprise Tech
  MSFT:  'Microsoft',
  CRM:   'Salesforce',
  ORCL:  'Oracle',
};

const BASE_URL = 'https://finnhub.io/api/v1';

function getKey() {
  const key = process.env.FINNHUB_API_KEY;
  if (!key) throw new Error('FINNHUB_API_KEY is not set');
  return key;
}

// Fetch quote for a single symbol.
// Finnhub /quote fields:
//   c  = current price
//   o  = open price (today's opening price)
//   h  = high of the day
//   l  = low of the day
//   pc = previous close
async function fetchQuote(symbol) {
  const url = `${BASE_URL}/quote?symbol=${symbol}&token=${getKey()}`;
  const res = await fetch(url);
  if (!res.ok) throw new Error(`HTTP ${res.status} fetching ${symbol}`);
  const data = await res.json();
  if (!data || data.c === undefined) throw new Error(`No price data returned for ${symbol}`);

  return {
    symbol,
    name: STOCKS[symbol],
    current: data.c,   // live price
    open: data.o,      // today's open — used as the baseline for drop %
    high: data.h,
    low: data.l,
    prevClose: data.pc,
  };
}

// Fetch quotes for every tracked stock in parallel.
// Returns an object keyed by symbol: { AAPL: { symbol, name, current, open, ... }, ... }
// Failed fetches set the symbol's value to null so callers can skip gracefully.
async function fetchAllPrices() {
  const symbols = Object.keys(STOCKS);

  const results = await Promise.allSettled(symbols.map(fetchQuote));

  const prices = {};
  results.forEach((result, i) => {
    const symbol = symbols[i];
    if (result.status === 'fulfilled') {
      prices[symbol] = result.value;
    } else {
      console.error(`[prices] Failed to fetch ${symbol}: ${result.reason.message}`);
      prices[symbol] = null;
    }
  });

  return prices;
}

module.exports = { STOCKS, fetchAllPrices };
