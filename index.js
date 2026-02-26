import 'dotenv/config';
import { fetchStockPrices } from './src/fetcher.js';
import { render } from './src/dashboard.js';
import { checkAlerts } from './src/alerts.js';
import { createRequire } from 'module';

const require = createRequire(import.meta.url);
const config = require('./config.json');

const alertLog = [];

async function run() {
  try {
    const stocks = await fetchStockPrices(config.stocks);
    const newAlerts = checkAlerts(stocks, config.alerts);

    alertLog.push(...newAlerts);
    if (alertLog.length > 50) alertLog.splice(0, alertLog.length - 50);

    render(stocks, alertLog);
  } catch (err) {
    console.error(err.message);
    process.exit(1);
  }
}

async function main() {
  process.stdout.write('\x1Bc');
  console.log('Fetching stock data...');
  await run();
  setInterval(run, config.refreshInterval * 1000);
}

main().catch(err => {
  console.error('Fatal error:', err.message);
  process.exit(1);
});
