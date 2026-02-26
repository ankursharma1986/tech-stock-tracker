import chalk from 'chalk';
import Table from 'cli-table3';

function formatPrice(num) {
  return num != null && num !== 0 ? `$${num.toFixed(2)}` : 'N/A';
}

export function render(stocks, alertLog) {
  console.clear();

  const now = new Date().toLocaleTimeString();
  const width = process.stdout.columns || 100;
  const title = ' TECH STOCK TRACKER ';
  const pad = Math.max(0, Math.floor((width - title.length) / 2));

  console.log('\n' + chalk.bold.cyan(' '.repeat(pad) + title));
  console.log(chalk.gray(` Last updated: ${now}   Refreshing every 30s   Press Ctrl+C to exit\n`));

  const table = new Table({
    head: [
      chalk.bold.white('Symbol'),
      chalk.bold.white('Price'),
      chalk.bold.white('Change'),
      chalk.bold.white('Change %'),
      chalk.bold.white('Day High'),
      chalk.bold.white('Day Low'),
      chalk.bold.white('Open'),
      chalk.bold.white('Prev Close'),
    ],
    style: { border: ['gray'] },
    colAligns: ['left', 'right', 'right', 'right', 'right', 'right', 'right', 'right'],
  });

  for (const stock of stocks) {
    if (stock.error) {
      table.push([
        chalk.yellow(stock.symbol),
        { colSpan: 7, content: chalk.red(stock.error) },
      ]);
      continue;
    }

    const up = stock.change >= 0;
    const color = up ? chalk.green : chalk.red;
    const arrow = up ? '▲' : '▼';
    const pct = stock.changePercent != null
      ? `${up ? '+' : ''}${stock.changePercent.toFixed(2)}%`
      : 'N/A';

    table.push([
      chalk.bold.white(stock.symbol),
      chalk.bold.white(formatPrice(stock.price)),
      color(`${arrow} ${Math.abs(stock.change ?? 0).toFixed(2)}`),
      color(pct),
      chalk.gray(formatPrice(stock.high)),
      chalk.gray(formatPrice(stock.low)),
      chalk.gray(formatPrice(stock.open)),
      chalk.gray(formatPrice(stock.previousClose)),
    ]);
  }

  console.log(table.toString());

  // Alert log
  if (alertLog.length > 0) {
    console.log(chalk.bold.yellow('\n PRICE ALERTS\n'));
    for (const entry of alertLog.slice(-10)) {
      const icon = entry.type === 'above' ? chalk.red('[ABOVE]') : chalk.blue('[BELOW]');
      console.log(
        ` ${chalk.gray(entry.time)}  ${icon}  ` +
        chalk.bold(entry.symbol) +
        ` crossed ${entry.type} $${entry.threshold} — now at ${formatPrice(entry.price)}`
      );
    }
  } else {
    console.log(chalk.gray('\n No alerts triggered yet.'));
  }

  console.log('');
}
