const triggered = new Set();

export function checkAlerts(stocks, alertConfig) {
  const newAlerts = [];

  for (const stock of stocks) {
    if (stock.error || stock.price == null) continue;

    const config = alertConfig[stock.symbol];
    if (!config) continue;

    const keyAbove = `${stock.symbol}_above`;
    const keyBelow = `${stock.symbol}_below`;

    if (config.above != null) {
      if (stock.price > config.above && !triggered.has(keyAbove)) {
        triggered.add(keyAbove);
        newAlerts.push({
          type: 'above',
          symbol: stock.symbol,
          price: stock.price,
          threshold: config.above,
          time: new Date().toLocaleTimeString(),
        });
      } else if (stock.price <= config.above) {
        triggered.delete(keyAbove);
      }
    }

    if (config.below != null) {
      if (stock.price < config.below && !triggered.has(keyBelow)) {
        triggered.add(keyBelow);
        newAlerts.push({
          type: 'below',
          symbol: stock.symbol,
          price: stock.price,
          threshold: config.below,
          time: new Date().toLocaleTimeString(),
        });
      } else if (stock.price >= config.below) {
        triggered.delete(keyBelow);
      }
    }
  }

  return newAlerts;
}
