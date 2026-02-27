# Tech Stock Tracker

A live tech stock dashboard **plus** a background alert agent that emails you when any monitored stock drops 5% or more from its opening price.

---

## Services

| Service | What it does | Start command |
|---|---|---|
| Web dashboard | Express server, live prices, charts | `node server.js` |
| Alert agent | Background worker, email alerts | `node agent/index.js` |

---

## Setup

### 1. Clone and install

```bash
# Root dependencies (Express dashboard)
npm install

# Agent dependencies (Resend email SDK)
cd agent && npm install && cd ..
```

### 2. Configure environment variables

Copy `.env.example` to `.env` and fill in your keys:

```bash
cp .env.example .env
```

| Variable | Required by | Description |
|---|---|---|
| `FINNHUB_API_KEY` | Dashboard + Agent | Free key from [finnhub.io](https://finnhub.io) |
| `RESEND_API_KEY` | Agent | API key from [resend.com/api-keys](https://resend.com/api-keys) |
| `ALERT_EMAIL_TO` | Agent | Recipient address for alert emails |
| `ALERT_EMAIL_FROM` | Agent | Verified sender address in your Resend account |

---

## Running locally

```bash
# Start the web dashboard (http://localhost:3000)
node server.js

# Start the stock alert agent (separate terminal)
node agent/index.js
```

Both processes read from the same `.env` file in the project root.

---

## How the alert agent works

```
Startup
  └─ Fetch opening prices for all 11 stocks (Finnhub /quote → field "o")
  └─ Schedule midnight ET reset

Every 3 minutes (9:30 AM – 4:00 PM ET, Mon–Fri)
  └─ Fetch current prices for all 11 stocks
  └─ For each stock: dropPct = (current − open) / open × 100
  └─ If dropPct ≤ −5% AND not already alerted today → send email
  └─ Log all prices to console

Midnight ET
  └─ Clear the "already alerted" set
  └─ Refresh opening prices for the new day
```

**Stocks monitored:**

| Group | Tickers |
|---|---|
| FAANG | META, AAPL, AMZN, NFLX, GOOGL |
| Semiconductors | NVDA, AMD, INTC |
| Enterprise Tech | MSFT, CRM, ORCL |

**Deduplication:** Each stock fires at most **one alert per trading day**, tracked with an in-memory Set that resets at midnight ET.

**Email:** Sent via [Resend](https://resend.com). If multiple stocks drop simultaneously, a single combined email is sent listing all affected stocks.

**Error handling:** Finnhub or Resend failures are logged and skipped — the agent keeps running.

---

## Deploying to Render

This repo includes a `render.yaml` Blueprint that defines both services.

### Steps

1. Push this repo to GitHub (or GitLab).
2. In the [Render dashboard](https://dashboard.render.com), click **New → Blueprint** and connect your repo.
3. Render will detect `render.yaml` and create both services automatically.
4. For each service, go to **Environment** and fill in the env vars marked `sync: false`:
   - `FINNHUB_API_KEY` (both services)
   - `RESEND_API_KEY`, `ALERT_EMAIL_TO`, `ALERT_EMAIL_FROM` (agent only)
5. Deploy. The alert agent runs as a **Background Worker** — no HTTP port, persistent process.

### Render service types

| Type | Used for |
|---|---|
| `web` | Dashboard — gets a public URL, handles HTTP |
| `worker` | Alert agent — no URL, runs indefinitely in the background |
