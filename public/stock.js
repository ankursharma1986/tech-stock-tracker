const symbol = new URLSearchParams(location.search).get('symbol')?.toUpperCase();
if (!symbol) location.href = '/';

document.title = `${symbol} — Tech Stock Tracker`;

let chartInstance = null;
let allCandles = null;

// ─── Boot ─────────────────────────────────────────────────────

async function init() {
  document.getElementById('detail-symbol').textContent = symbol;
  await loadDetails();
}

// ─── Fetch ────────────────────────────────────────────────────

async function loadDetails() {
  try {
    const res = await fetch(`/api/stock/${symbol}/details`);
    if (!res.ok) throw new Error(`Server error ${res.status}`);
    const data = await res.json();
    if (data.error) throw new Error(data.error);
    render(data);
  } catch (err) {
    showError(err.message);
  }
}

// ─── Render ───────────────────────────────────────────────────

function render({ history, profile, metrics, liveQuote }) {
  renderHeader(profile, liveQuote, metrics);
  renderBanner(profile);
  renderChart(history);
  renderMetrics(metrics, profile, liveQuote);
  renderAbout(profile);

  document.getElementById('detail-loading').classList.add('hidden');
  document.getElementById('detail-content').classList.remove('hidden');
}

function renderHeader(profile, liveQuote, metrics) {
  const name = profile?.name || symbol;
  document.getElementById('detail-name').textContent   = name;
  document.title = `${symbol} · ${name} — Tech Stock Tracker`;

  if (liveQuote && !liveQuote.error) {
    const up   = liveQuote.change >= 0;
    const sign = up ? '+' : '';
    const priceEl  = document.getElementById('detail-price');
    const changeEl = document.getElementById('detail-change');

    priceEl.textContent  = `$${fmt(liveQuote.price)}`;
    changeEl.textContent = `${sign}${fmt(liveQuote.change)} (${sign}${liveQuote.changePercent.toFixed(2)}%)`;
    changeEl.className   = `detail-header-change ${up ? 'up' : 'down'}`;
  }
}

function renderBanner(profile) {
  if (!profile) return;
  setText('banner-name', profile.name || symbol);
  setText('banner-exchange', profile.exchange || '—');
  setText('banner-industry', profile.finnhubIndustry || '—');
  setText('banner-ipo', profile.ipo ? `IPO ${profile.ipo}` : '');

  if (profile.logo) {
    const img = document.createElement('img');
    img.src = profile.logo;
    img.alt = profile.name;
    img.className = 'logo-img';
    img.onerror = () => img.remove();
    document.getElementById('banner-logo').appendChild(img);
  }

  if (profile.weburl) {
    const a = document.createElement('a');
    a.href   = profile.weburl;
    a.target = '_blank';
    a.rel    = 'noopener noreferrer';
    a.textContent = profile.weburl.replace(/^https?:\/\/(www\.)?/, '').replace(/\/$/, '');
    a.className   = 'web-link';
    document.getElementById('banner-weburl').appendChild(a);
  }
}

function renderChart(history) {
  allCandles = history;
  if (!history || history.s !== 'ok' || !history.t?.length) {
    document.querySelector('.chart-wrap').innerHTML =
      '<div class="chart-empty">Historical data unavailable for this symbol.</div>';
    return;
  }
  drawChart(history, '1Y');
}

function drawChart(history, range) {
  const { t, c } = history;

  const now    = Date.now() / 1000;
  const ranges = { '1Y': 365, '6M': 180, '3M': 90, '1M': 30 };
  const days   = ranges[range] || 365;
  const cutoff = now - days * 86400;

  const indices = t.reduce((acc, ts, i) => { if (ts >= cutoff) acc.push(i); return acc; }, []);
  const labels  = indices.map(i => new Date(t[i] * 1000).toLocaleDateString('en-US', { month: 'short', day: 'numeric' }));
  const prices  = indices.map(i => c[i]);

  const up    = prices[prices.length - 1] >= prices[0];
  const color = up ? '#00e676' : '#ff1744';

  if (chartInstance) chartInstance.destroy();

  const canvas = document.getElementById('price-chart');
  const ctx    = canvas.getContext('2d');

  const gradient = ctx.createLinearGradient(0, 0, 0, canvas.offsetHeight || 300);
  gradient.addColorStop(0, up ? 'rgba(0,230,118,0.3)' : 'rgba(255,23,68,0.3)');
  gradient.addColorStop(1, 'rgba(0,0,0,0)');

  chartInstance = new Chart(ctx, {
    type: 'line',
    data: {
      labels,
      datasets: [{
        data: prices,
        borderColor: color,
        borderWidth: 2,
        backgroundColor: gradient,
        fill: true,
        pointRadius: 0,
        pointHoverRadius: 5,
        pointHoverBackgroundColor: color,
        tension: 0.3,
      }],
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      interaction: { intersect: false, mode: 'index' },
      plugins: {
        legend: { display: false },
        tooltip: {
          backgroundColor: '#0e1623',
          borderColor: color,
          borderWidth: 1,
          titleColor: '#cdd9f0',
          bodyColor: color,
          padding: 10,
          callbacks: {
            label: ctx => ` $${ctx.parsed.y.toFixed(2)}`,
          },
        },
      },
      scales: {
        x: {
          grid: { color: 'rgba(28,42,66,0.6)', drawBorder: false },
          ticks: {
            color: '#4a6080',
            font: { family: "'SF Mono','Fira Code',monospace", size: 11 },
            maxTicksLimit: 8,
            maxRotation: 0,
          },
        },
        y: {
          position: 'right',
          grid: { color: 'rgba(28,42,66,0.6)', drawBorder: false },
          ticks: {
            color: '#4a6080',
            font: { family: "'SF Mono','Fira Code',monospace", size: 11 },
            callback: v => `$${v.toFixed(0)}`,
          },
        },
      },
    },
  });
}

function renderMetrics(m, profile, liveQuote) {
  const marketCapRaw = profile?.marketCapitalization;
  const marketCap    = marketCapRaw ? fmtBig(marketCapRaw * 1e6) : '—';

  const items = [
    { label: 'Market Cap',     value: marketCap },
    { label: 'P/E Ratio',      value: fmtMetric(m?.peBasicExclExtraTTM  ?? m?.peNormalizedAnnual) },
    { label: '52W High',       value: m?.['52WeekHigh']  ? `$${m['52WeekHigh'].toFixed(2)}`  : '—' },
    { label: '52W Low',        value: m?.['52WeekLow']   ? `$${m['52WeekLow'].toFixed(2)}`   : '—' },
    { label: 'Beta',           value: fmtMetric(m?.beta) },
    { label: 'EPS (TTM)',      value: m?.epsBasicExclExtraTTM ? `$${m.epsBasicExclExtraTTM.toFixed(2)}` : '—' },
    { label: 'Dividend Yield', value: m?.dividendYieldIndicatedAnnual ? `${m.dividendYieldIndicatedAnnual.toFixed(2)}%` : '—' },
    { label: 'Revenue (TTM)',  value: m?.revenueTTM ? fmtBig(m.revenueTTM) : '—' },
    { label: 'Gross Margin',   value: m?.grossMarginTTM ? `${(m.grossMarginTTM).toFixed(1)}%` : '—' },
    { label: 'ROE',            value: m?.roeTTM ? `${(m.roeTTM).toFixed(1)}%` : '—' },
    { label: 'Day High',       value: liveQuote?.high  ? `$${fmt(liveQuote.high)}`  : '—' },
    { label: 'Day Low',        value: liveQuote?.low   ? `$${fmt(liveQuote.low)}`   : '—' },
  ];

  const grid = document.getElementById('metrics-grid');
  grid.innerHTML = items.map(({ label, value }) => `
    <div class="metric-card">
      <div class="metric-label">${label}</div>
      <div class="metric-value">${value}</div>
    </div>`).join('');
}

function renderAbout(profile) {
  if (!profile?.name) return;
  const section = document.getElementById('about-section');
  const text    = document.getElementById('about-text');
  const info    = [
    profile.name && `${profile.name} trades on ${profile.exchange || 'N/A'} under the ticker ${symbol}.`,
    profile.finnhubIndustry && `Industry: ${profile.finnhubIndustry}.`,
    profile.ipo && `IPO date: ${profile.ipo}.`,
    profile.shareOutstanding && `Shares outstanding: ${fmtBig(profile.shareOutstanding * 1e6)}.`,
  ].filter(Boolean).join(' ');

  if (info) {
    text.textContent = info;
    section.classList.remove('hidden');
  }
}

// ─── Range Buttons ────────────────────────────────────────────

document.querySelectorAll('.range-btn').forEach(btn => {
  btn.addEventListener('click', () => {
    document.querySelectorAll('.range-btn').forEach(b => b.classList.remove('active'));
    btn.classList.add('active');
    if (allCandles) drawChart(allCandles, btn.dataset.range);
  });
});

// ─── Helpers ──────────────────────────────────────────────────

function fmt(n)    { return n != null ? n.toFixed(2) : '—'; }
function fmtMetric(n) { return n != null ? n.toFixed(2) : '—'; }
function setText(id, val) { const el = document.getElementById(id); if (el) el.textContent = val; }

function fmtBig(n) {
  if (n == null) return '—';
  if (n >= 1e12) return `$${(n / 1e12).toFixed(2)}T`;
  if (n >= 1e9)  return `$${(n / 1e9).toFixed(2)}B`;
  if (n >= 1e6)  return `$${(n / 1e6).toFixed(2)}M`;
  return `$${n.toLocaleString()}`;
}

function showError(msg) {
  document.getElementById('detail-loading').innerHTML =
    `<span style="color:var(--down)">Error: ${msg}</span>`;
}

// ─── Init ─────────────────────────────────────────────────────
init();
