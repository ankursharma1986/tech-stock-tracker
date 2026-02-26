const REFRESH_MS = 30000;

// ─── Company logos ────────────────────────────────────────────
// Primary: Google favicon service (reliable, always works)
// Fallback: colored SVG letter avatar
const DOMAINS = {
  AAPL:  'apple.com',
  GOOGL: 'google.com',
  MSFT:  'microsoft.com',
  AMZN:  'amazon.com',
  NVDA:  'nvidia.com',
  META:  'meta.com',
  TSLA:  'tesla.com',
  JPM:   'jpmorganchase.com',
  V:     'visa.com',
  JNJ:   'jnj.com',
  WMT:   'walmart.com',
  UNH:   'unitedhealthgroup.com',
  XOM:   'exxonmobil.com',
  LLY:   'lilly.com',
  AVGO:  'broadcom.com',
  PG:    'pg.com',
  HD:    'homedepot.com',
  MA:    'mastercard.com',
  ORCL:  'oracle.com',
  NFLX:  'netflix.com',
  COST:  'costco.com',
};

// Palette for letter avatars
const AVATAR_COLORS = [
  '#00b0ff','#00e676','#ff6d00','#7c4dff',
  '#ff1744','#00bcd4','#ffab00','#4caf50',
];

function avatarSVG(symbol, size = 28) {
  const color = AVATAR_COLORS[symbol.charCodeAt(0) % AVATAR_COLORS.length];
  const letter = symbol[0];
  const half = size / 2;
  const fontSize = Math.round(size * 0.5);
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 ${size} ${size}"><rect width="${size}" height="${size}" rx="${Math.round(size * 0.22)}" fill="${color}"/><text x="${half}" y="${half + fontSize * 0.36}" font-family="monospace" font-size="${fontSize}" font-weight="800" text-anchor="middle" fill="white">${letter}</text></svg>`;
  return `data:image/svg+xml,${encodeURIComponent(svg)}`;
}

function logoImgTag(symbol, cssClass) {
  const domain = DOMAINS[symbol];
  const primary = domain
    ? `https://www.google.com/s2/favicons?domain=${domain}&sz=64`
    : null;
  const fallback = avatarSVG(symbol, cssClass === 't-logo' ? 18 : 28);
  if (primary) {
    return `<img class="${cssClass}" src="${primary}" alt="${symbol}" onerror="this.onerror=null;this.src='${fallback}'">`;
  }
  return `<img class="${cssClass}" src="${fallback}" alt="${symbol}">`;
}

let stocks = [];
let alerts = [];
let countdownTimer = null;
let secondsLeft = REFRESH_MS / 1000;
let dismissed = false;
let prevPrices = {};

// ─── Fetch ───────────────────────────────────────────────────

async function fetchData() {
  try {
    const res = await fetch('/api/stocks');
    if (!res.ok) throw new Error(`Server error ${res.status}`);
    const data = await res.json();
    if (data.error) throw new Error(data.error);

    stocks = data.stocks;
    alerts = data.alerts;

    render();
    updateHeader(new Date(data.lastUpdated));
    resetCountdown();
  } catch (err) {
    showError(err.message);
  }
}

// ─── Render ──────────────────────────────────────────────────

function render() {
  renderSummary();
  renderGrid();
  renderTicker();
  renderAlerts();
}

function renderSummary() {
  const valid = stocks.filter(s => !s.error);
  const upCount   = valid.filter(s => s.change >= 0).length;
  const downCount = valid.filter(s => s.change < 0).length;
  document.getElementById('summary-stats').innerHTML =
    `<span class="up-count">▲ ${upCount} up</span>  ·  <span class="down-count">▼ ${downCount} down</span>`;
}

function renderGrid() {
  const grid = document.getElementById('stock-grid');
  const alertedSymbols = new Set(alerts.map(a => a.symbol));

  // First render: build all cards
  if (!grid.querySelector('.stock-card')) {
    grid.innerHTML = '';
    stocks.forEach((s, i) => {
      const card = buildCard(s, alertedSymbols.has(s.symbol), i * 60);
      grid.appendChild(card);
    });
    return;
  }

  // Subsequent renders: update in place with flash animation
  stocks.forEach(stock => {
    const existing = grid.querySelector(`[data-symbol="${stock.symbol}"]`);
    if (!existing) return;

    if (!stock.error) {
      const prev = prevPrices[stock.symbol];
      if (prev != null && prev !== stock.price) {
        const flashClass = stock.price > prev ? 'flash-up' : 'flash-down';
        existing.classList.remove('flash-up', 'flash-down');
        void existing.offsetWidth; // force reflow
        existing.classList.add(flashClass);
      }
      updateCard(existing, stock, alertedSymbols.has(stock.symbol));
      prevPrices[stock.symbol] = stock.price;
    }
  });
}

function buildCard(stock, hasAlert, delay = 0) {
  const card = document.createElement('div');
  card.setAttribute('data-symbol', stock.symbol);
  card.style.animationDelay = `${delay}ms`;
  card.addEventListener('click', () => {
    location.href = `/stock.html?symbol=${stock.symbol}`;
  });

  if (stock.error) {
    card.className = 'stock-card error';
    card.innerHTML = `
      <div class="card-top">
        <div class="card-symbol">${stock.symbol}</div>
      </div>
      <div class="card-price" style="font-size:1rem;color:var(--text-dim)">Unavailable</div>`;
    return card;
  }

  const up = stock.change >= 0;
  card.className = `stock-card ${up ? 'up' : 'down'}`;
  card.innerHTML = cardHTML(stock, hasAlert, up);
  prevPrices[stock.symbol] = stock.price;
  return card;
}

function updateCard(card, stock, hasAlert) {
  const up = stock.change >= 0;
  card.className = `stock-card ${up ? 'up' : 'down'}`;
  card.innerHTML = cardHTML(stock, hasAlert, up);
}

function cardHTML(stock, hasAlert, up) {
  const sign     = up ? '+' : '';
  const arrow    = up ? '▲' : '▼';
  const dirClass = up ? 'up' : 'down';

  // High/Low position bar
  const range    = stock.high - stock.low;
  const pos      = range > 0 ? ((stock.price - stock.low) / range) * 100 : 50;
  const barLeft  = Math.min(Math.max(pos - 10, 0), 80);
  const barWidth = 20;

  const logoHTML = logoImgTag(stock.symbol, 'card-logo');

  return `
    <div class="card-top">
      <div class="card-symbol-row">
        ${logoHTML}
        <span class="card-symbol">${stock.symbol}</span>
      </div>
      <div class="card-badge-row">
        ${hasAlert ? '<span class="alert-badge">ALERT</span>' : ''}
      </div>
    </div>
    <div class="card-price">$${fmt(stock.price)}</div>
    <div class="card-change ${dirClass}">
      <span class="change-arrow">${arrow}</span>
      <span>${sign}${fmt(stock.change)} (${sign}${stock.changePercent.toFixed(2)}%)</span>
    </div>
    <div class="card-divider"></div>
    <div class="card-stats">
      <div class="stat">
        <span class="stat-label">Open</span>
        <span class="stat-value">$${fmt(stock.open)}</span>
      </div>
      <div class="stat">
        <span class="stat-label">Prev Close</span>
        <span class="stat-value">$${fmt(stock.previousClose)}</span>
      </div>
      <div class="hl-bar-wrap">
        <div class="hl-bar-labels">
          <span>L $${fmt(stock.low)}</span>
          <span>H $${fmt(stock.high)}</span>
        </div>
        <div class="hl-bar-track">
          <div class="hl-bar-fill" style="left:0%;width:100%"></div>
          <div class="hl-bar-marker" style="left:${pos.toFixed(1)}%"></div>
        </div>
      </div>
    </div>`;
}

// ─── Ticker ──────────────────────────────────────────────────

function renderTicker() {
  const valid = stocks.filter(s => !s.error);
  if (!valid.length) return;

  const itemHTML = valid.map(s => {
    const up   = s.change >= 0;
    const sign = up ? '+' : '';
    const tLogo = logoImgTag(s.symbol, 't-logo');
    return `
      <span class="ticker-item">
        ${tLogo}
        <span class="t-symbol">${s.symbol}</span>
        <span class="t-price">$${fmt(s.price)}</span>
        <span class="t-change ${up ? 'up' : 'down'}">${sign}${s.changePercent.toFixed(2)}%</span>
      </span>`;
  }).join('');

  const el = document.getElementById('ticker-items');
  el.innerHTML = itemHTML + itemHTML; // duplicate for seamless loop
  el.style.animationDuration = `${Math.max(20, valid.length * 5)}s`;
}

// ─── Alerts ──────────────────────────────────────────────────

function renderAlerts() {
  const panel = document.getElementById('alerts-panel');
  const list  = document.getElementById('alerts-list');

  if (!alerts.length || dismissed) {
    panel.classList.add('hidden');
    return;
  }

  panel.classList.remove('hidden');
  list.innerHTML = alerts.slice(-5).reverse().map(a => `
    <div class="alert-entry">
      <span class="alert-time">${a.time}</span>
      <span class="${a.type === 'above' ? 'alert-above' : 'alert-below'}">
        ${a.symbol} ${a.type === 'above' ? 'rose above' : 'dropped below'} $${a.threshold}
        — now $${fmt(a.price)}
      </span>
    </div>`).join('');
}

// ─── Header / Countdown ──────────────────────────────────────

function updateHeader(date) {
  document.getElementById('last-updated').textContent =
    `Updated ${date.toLocaleTimeString()}`;
}

function resetCountdown() {
  clearInterval(countdownTimer);
  secondsLeft = REFRESH_MS / 1000;

  countdownTimer = setInterval(() => {
    secondsLeft -= 1;
    const el = document.getElementById('countdown');
    if (secondsLeft > 0) {
      el.textContent = `Refresh in ${secondsLeft}s`;
    } else {
      el.textContent = 'Refreshing...';
      clearInterval(countdownTimer);
      fetchData();
    }
  }, 1000);
}

function showError(msg) {
  document.getElementById('stock-grid').innerHTML = `
    <div class="loading-state">
      <span style="color:var(--down)">ERROR: ${msg}</span>
    </div>`;
}

// ─── Init ────────────────────────────────────────────────────

document.getElementById('dismiss-alerts').addEventListener('click', () => {
  dismissed = true;
  document.getElementById('alerts-panel').classList.add('hidden');
});

fetchData();

function fmt(n) {
  return n != null ? n.toFixed(2) : 'N/A';
}
