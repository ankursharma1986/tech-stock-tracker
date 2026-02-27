'use strict';

const { getETDateString } = require('./scheduler');

// Percentage drop that triggers an alert
const DROP_THRESHOLD = -5;

// ── State (in-memory, resets on process restart) ────────────────────────────

// { SYMBOL: openingPrice }
let openPrices = {};

// The ET date string ("YYYY-MM-DD") for when openPrices were last captured.
// Used to detect when we're on a new trading day and need fresh open prices.
let openPricesDate = null;

// Stocks that have already fired an alert today — one alert per stock per day.
const alertedToday = new Set();

// ── Opening price management ─────────────────────────────────────────────────

// Store opening prices from a fetchAllPrices() result.
// Only stores symbols where open > 0 (pre-market data can sometimes return 0).
function setOpenPrices(priceMap) {
  openPrices = {};
  for (const [symbol, data] of Object.entries(priceMap)) {
    if (data && data.open > 0) {
      openPrices[symbol] = data.open;
    }
  }
  openPricesDate = getETDateString();
  console.log(
    `[monitor] Opening prices stored for ${Object.keys(openPrices).length} stocks` +
    ` (${openPricesDate})`
  );
}

function getOpenPrices() {
  return openPrices;
}

// Returns true when the stored opening prices belong to a previous trading day,
// meaning we should re-fetch them before the next drop check.
function isOpenPricesStale() {
  return openPricesDate !== getETDateString();
}

// ── Drop detection ────────────────────────────────────────────────────────────

// Inspect the latest prices and return an array of drop objects for every stock
// that has fallen ≥ 5% from its opening price AND hasn't already been alerted today.
//
// Each drop object: { symbol, name, openPrice, currentPrice, dropPct }
function checkDrops(currentPrices) {
  const drops = [];

  for (const [symbol, data] of Object.entries(currentPrices)) {
    if (!data) continue;                  // skip failed fetch
    if (alertedToday.has(symbol)) continue; // one alert per stock per day

    const openPrice = openPrices[symbol];
    if (!openPrice) continue;             // no baseline to compare against

    const dropPct = ((data.current - openPrice) / openPrice) * 100;

    if (dropPct <= DROP_THRESHOLD) {
      drops.push({
        symbol,
        name: data.name,
        openPrice,
        currentPrice: data.current,
        dropPct,
      });
      alertedToday.add(symbol); // mark so we don't alert again today
    }
  }

  return drops;
}

// ── Daily reset ───────────────────────────────────────────────────────────────

// Called at midnight ET. Clears the alerted-today set so stocks can trigger
// alerts again on the new trading day.
function resetAlertedToday() {
  const count = alertedToday.size;
  alertedToday.clear();
  console.log(
    `[monitor] alertedToday reset (${count} symbol(s) cleared) — new trading day`
  );
}

module.exports = {
  setOpenPrices,
  getOpenPrices,
  isOpenPricesStale,
  checkDrops,
  resetAlertedToday,
};
