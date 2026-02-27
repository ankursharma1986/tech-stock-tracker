'use strict';

const { Resend } = require('resend');

// Lazy-initialised Resend client (created once on first send)
let resend = null;

function getClient() {
  if (!resend) {
    const key = process.env.RESEND_API_KEY;
    if (!key) throw new Error('RESEND_API_KEY is not set');
    resend = new Resend(key);
  }
  return resend;
}

// ── Formatting helpers ────────────────────────────────────────────────────────

function fmtPrice(n) {
  return `$${n.toFixed(2)}`;
}

function fmtPct(n) {
  // n is already negative for drops; show sign explicitly
  return `${n >= 0 ? '+' : ''}${n.toFixed(2)}%`;
}

function getAlertTime() {
  return new Intl.DateTimeFormat('en-US', {
    timeZone: 'America/New_York',
    month:    'short',
    day:      'numeric',
    year:     'numeric',
    hour:     '2-digit',
    minute:   '2-digit',
    timeZoneName: 'short',
  }).format(new Date());
}

// ── HTML email template ───────────────────────────────────────────────────────

function buildHTML(drops, alertTime) {
  const rows = drops
    .map(
      d => `
      <tr>
        <td style="padding:12px 16px;font-weight:700;font-size:15px">${d.symbol}</td>
        <td style="padding:12px 16px;color:#4b5563">${d.name}</td>
        <td style="padding:12px 16px">${fmtPrice(d.openPrice)}</td>
        <td style="padding:12px 16px">${fmtPrice(d.currentPrice)}</td>
        <td style="padding:12px 16px;color:#dc2626;font-weight:700;font-size:15px">${fmtPct(d.dropPct)}</td>
      </tr>`
    )
    .join('');

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width,initial-scale=1.0">
</head>
<body style="margin:0;padding:24px;background:#f1f5f9;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif">
  <div style="max-width:640px;margin:0 auto;background:#ffffff;border-radius:12px;overflow:hidden;box-shadow:0 2px 8px rgba(0,0,0,0.08)">

    <!-- Header -->
    <div style="background:#0f172a;padding:28px 32px">
      <h1 style="margin:0;color:#f8fafc;font-size:22px;font-weight:700">⚠️ Stock Drop Alert</h1>
      <p style="margin:6px 0 0;color:#94a3b8;font-size:14px">${alertTime}</p>
    </div>

    <!-- Body -->
    <div style="padding:28px 32px">
      <p style="margin:0 0 20px;color:#374151;font-size:15px;line-height:1.6">
        The following stock${drops.length > 1 ? 's have' : ' has'} dropped
        <strong style="color:#dc2626">5% or more</strong> from today's opening price:
      </p>

      <!-- Stock table -->
      <div style="overflow-x:auto;border-radius:8px;border:1px solid #e5e7eb">
        <table style="width:100%;border-collapse:collapse;font-size:14px">
          <thead>
            <tr style="background:#f9fafb">
              <th style="padding:10px 16px;text-align:left;color:#6b7280;font-weight:600;border-bottom:1px solid #e5e7eb;white-space:nowrap">Ticker</th>
              <th style="padding:10px 16px;text-align:left;color:#6b7280;font-weight:600;border-bottom:1px solid #e5e7eb;white-space:nowrap">Company</th>
              <th style="padding:10px 16px;text-align:left;color:#6b7280;font-weight:600;border-bottom:1px solid #e5e7eb;white-space:nowrap">Open</th>
              <th style="padding:10px 16px;text-align:left;color:#6b7280;font-weight:600;border-bottom:1px solid #e5e7eb;white-space:nowrap">Current</th>
              <th style="padding:10px 16px;text-align:left;color:#6b7280;font-weight:600;border-bottom:1px solid #e5e7eb;white-space:nowrap">Change</th>
            </tr>
          </thead>
          <tbody>
            ${rows}
          </tbody>
        </table>
      </div>
    </div>

    <!-- Footer -->
    <div style="padding:16px 32px;background:#f9fafb;border-top:1px solid #e5e7eb">
      <p style="margin:0;color:#9ca3af;font-size:12px">Sent by your Tech Stock Tracker Agent</p>
    </div>

  </div>
</body>
</html>`;
}

// ── Public API ────────────────────────────────────────────────────────────────

// Send an alert email for one or more stocks that dropped ≥ 5%.
// drops: array of { symbol, name, openPrice, currentPrice, dropPct }
async function sendAlertEmail(drops) {
  const from = process.env.ALERT_EMAIL_FROM;
  const to   = process.env.ALERT_EMAIL_TO;
  if (!from) throw new Error('ALERT_EMAIL_FROM is not set');
  if (!to)   throw new Error('ALERT_EMAIL_TO is not set');

  const alertTime = getAlertTime();

  // Subject: single stock vs. combined alert
  let subject;
  if (drops.length === 1) {
    const d = drops[0];
    subject = `⚠️ Stock Alert: ${d.symbol} dropped ${Math.abs(d.dropPct).toFixed(2)}% today`;
  } else {
    const tickers = drops.map(d => d.symbol).join(', ');
    subject = `⚠️ Stock Alert: ${drops.length} stocks dropped 5%+ today (${tickers})`;
  }

  const html = buildHTML(drops, alertTime);

  const client = getClient();
  const { data, error } = await client.emails.send({ from, to, subject, html });

  if (error) throw new Error(`Resend error: ${error.message}`);
  return data;
}

module.exports = { sendAlertEmail };
