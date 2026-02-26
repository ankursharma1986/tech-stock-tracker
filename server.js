import express from 'express';
import { fileURLToPath } from 'url';
import { join, dirname } from 'path';
import 'dotenv/config';
import { fetchStockPrices, fetchStockDetails } from './src/fetcher.js';
import { checkAlerts } from './src/alerts.js';
import { createRequire } from 'module';

const require = createRequire(import.meta.url);
const config = require('./config.json');

const __dirname = dirname(fileURLToPath(import.meta.url));
const app = express();
const PORT = process.env.PORT || 3000;

app.use(express.static(join(__dirname, 'public')));

let cachedStocks = null;
let alertLog = [];
let lastFetch = null;

async function refreshData() {
  try {
    const stocks = await fetchStockPrices(config.stocks);
    const newAlerts = checkAlerts(stocks, config.alerts);
    alertLog.push(...newAlerts);
    if (alertLog.length > 50) alertLog.splice(0, alertLog.length - 50);
    cachedStocks = stocks;
    lastFetch = new Date();
    console.log(`[${lastFetch.toLocaleTimeString()}] Data refreshed (${stocks.length} stocks)`);
  } catch (err) {
    console.error('Refresh error:', err.message);
  }
}

// Dashboard data
app.get('/api/stocks', async (req, res) => {
  if (!cachedStocks) await refreshData();
  if (!cachedStocks) return res.status(503).json({ error: 'Data not available yet' });
  res.json({ stocks: cachedStocks, alerts: alertLog, lastUpdated: lastFetch });
});

// Stock detail: history + profile + metrics
app.get('/api/stock/:symbol/details', async (req, res) => {
  const symbol = req.params.symbol.toUpperCase();
  try {
    // Also grab the current live quote from cache if available
    const liveQuote = cachedStocks?.find(s => s.symbol === symbol) || null;
    const details = await fetchStockDetails(symbol);
    res.json({ ...details, liveQuote });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.listen(PORT, () => {
  console.log(`\n  Tech Stock Tracker → http://localhost:${PORT}\n`);
  refreshData();
  setInterval(refreshData, config.refreshInterval * 1000);
});
