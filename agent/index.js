'use strict';

// Load .env from the project root (one level up from /agent).
// On Render the env vars are injected directly — dotenv is a no-op there.
require('dotenv').config({ path: require('path').join(__dirname, '..', '.env') });

const { fetchAllPrices }   = require('./prices');
const {
  setOpenPrices,
  getOpenPrices,
  isOpenPricesStale,
  checkDrops,
  resetAlertedToday,
} = require('./monitor');
const { sendAlertEmail }   = require('./emailer');
const {
  POLL_INTERVAL_MS,
  isMarketOpen,
  msUntilMidnightET,
  formatETTimestamp,
} = require('./scheduler');

// ── Opening price snapshot ────────────────────────────────────────────────────

// Fetch and store today's opening prices for all stocks.
// Called at startup and again when the agent detects a new trading day.
async function captureOpenPrices() {
  console.log(`[${formatETTimestamp()}] Fetching opening prices for all stocks...`);
  try {
    const prices = await fetchAllPrices();
    setOpenPrices(prices);
  } catch (err) {
    console.error(`[${formatETTimestamp()}] ERROR capturing opening prices: ${err.message}`);
    // Non-fatal — will retry on next poll via isOpenPricesStale()
  }
}

// ── Poll cycle ────────────────────────────────────────────────────────────────

// Runs every POLL_INTERVAL_MS. Skips silently outside market hours.
async function poll() {
  const ts = formatETTimestamp();

  if (!isMarketOpen()) {
    // Quiet no-op outside market hours — avoids log noise overnight
    return;
  }

  // If we're on a new trading day and still have yesterday's open prices,
  // refresh them before running the drop check.
  if (isOpenPricesStale()) {
    await captureOpenPrices();
  }

  // ── Fetch current prices ──────────────────────────────────────────────────
  let currentPrices;
  try {
    currentPrices = await fetchAllPrices();
  } catch (err) {
    console.error(`[${ts}] ERROR fetching prices — will retry next cycle: ${err.message}`);
    return; // skip this cycle; don't crash
  }

  // ── Log every stock ───────────────────────────────────────────────────────
  const openPrices = getOpenPrices();

  for (const [symbol, data] of Object.entries(currentPrices)) {
    if (!data) {
      console.log(`[${ts}] ${symbol}: ERROR (skipped)`);
      continue;
    }

    const open = openPrices[symbol];
    if (open) {
      const dropPct = ((data.current - open) / open) * 100;
      const sign    = dropPct >= 0 ? '+' : '';
      const flag    = dropPct <= -5 ? ' ⚠️' : '';
      console.log(
        `[${ts}] ${symbol}: $${data.current.toFixed(2)} ` +
        `(${sign}${dropPct.toFixed(2)}% from open)${flag}`
      );
    } else {
      console.log(`[${ts}] ${symbol}: $${data.current.toFixed(2)} (no open price yet)`);
    }
  }

  // ── Drop detection ────────────────────────────────────────────────────────
  const drops = checkDrops(currentPrices);

  if (drops.length === 0) return;

  // Log the drops that crossed the threshold
  drops.forEach(d => {
    console.log(
      `[${ts}] ${d.symbol}: $${d.currentPrice.toFixed(2)} ` +
      `(${d.dropPct.toFixed(2)}% from open) ⚠️  ALERT SENDING...`
    );
  });

  // ── Send combined alert email ─────────────────────────────────────────────
  try {
    await sendAlertEmail(drops);
    drops.forEach(d => {
      console.log(`[${ts}] ${d.symbol}: ⚠️  ALERT SENT`);
    });
  } catch (err) {
    console.error(`[${ts}] ERROR sending alert email: ${err.message}`);
    // Non-fatal — monitoring continues even if email delivery fails
  }
}

// ── Midnight reset ────────────────────────────────────────────────────────────

// Schedule the alertedToday reset at midnight ET, then reschedule for the next
// midnight. This cascades indefinitely without drift because we recalculate
// the delay each time rather than using a fixed 24-hour interval.
function scheduleMidnightReset() {
  const ms = msUntilMidnightET();
  const minutesUntil = Math.round(ms / 1000 / 60);
  console.log(`[agent] Next midnight reset in ~${minutesUntil} minutes`);

  setTimeout(async () => {
    const ts = formatETTimestamp();
    console.log(`[${ts}] Midnight reset — clearing alertedToday`);
    resetAlertedToday();

    // Capture fresh opening prices for the new trading day.
    // (The actual open won't exist until 9:30 AM, but we prime the cache
    //  with any pre-market data available; isOpenPricesStale() handles the rest.)
    await captureOpenPrices();

    scheduleMidnightReset(); // schedule next midnight
  }, ms);
}

// ── Entry point ───────────────────────────────────────────────────────────────

async function main() {
  console.log('');
  console.log('  Tech Stock Tracker — Alert Agent');
  console.log('  ─────────────────────────────────────────');
  console.log(`  FINNHUB_API_KEY : ${process.env.FINNHUB_API_KEY  ? 'SET ✓' : 'NOT SET ✗'}`);
  console.log(`  RESEND_API_KEY  : ${process.env.RESEND_API_KEY   ? 'SET ✓' : 'NOT SET ✗'}`);
  console.log(`  ALERT_EMAIL_TO  : ${process.env.ALERT_EMAIL_TO   || 'NOT SET ✗'}`);
  console.log(`  ALERT_EMAIL_FROM: ${process.env.ALERT_EMAIL_FROM || 'NOT SET ✗'}`);
  console.log(`  Poll interval   : every ${POLL_INTERVAL_MS / 1000 / 60} minutes during market hours`);
  console.log('  ─────────────────────────────────────────');
  console.log('');

  // Capture opening prices at startup
  await captureOpenPrices();

  // Schedule daily midnight reset
  scheduleMidnightReset();

  // Run the first poll immediately, then on a fixed interval
  await poll();
  setInterval(poll, POLL_INTERVAL_MS);

  console.log(`[agent] Polling started. Waiting for market hours (9:30 AM – 4:00 PM ET)...`);
}

main().catch(err => {
  console.error('[agent] Fatal startup error:', err);
  process.exit(1);
});
