'use strict';

// How often to poll prices during market hours
const POLL_INTERVAL_MS = 3 * 60 * 1000; // 3 minutes

// ── ET timezone helpers ───────────────────────────────────────────────────────

// Extract named parts from the current time in US Eastern time.
// Uses the built-in Intl API — no external dependencies needed.
function getETParts() {
  const now = new Date();
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone:    'America/New_York',
    weekday:     'long',
    year:        'numeric',
    month:       '2-digit',
    day:         '2-digit',
    hour:        '2-digit',
    minute:      '2-digit',
    second:      '2-digit',
    hour12:      false,
  }).formatToParts(now);

  const get = type => parts.find(p => p.type === type)?.value ?? '0';

  return {
    weekday: get('weekday'),          // e.g. "Monday"
    year:    get('year'),             // "2026"
    month:   get('month'),            // "02"
    day:     get('day'),              // "26"
    hour:    parseInt(get('hour'), 10),     // 9
    minute:  parseInt(get('minute'), 10),   // 30
    second:  parseInt(get('second'), 10),   // 0
  };
}

// Returns the ET date as "YYYY-MM-DD" — used to detect new trading days.
function getETDateString() {
  const { year, month, day } = getETParts();
  return `${year}-${month}-${day}`;
}

// Returns a formatted timestamp for log lines: "2026-02-26 10:33 ET"
function formatETTimestamp() {
  const { year, month, day, hour, minute } = getETParts();
  const hh = String(hour).padStart(2, '0');
  const mm = String(minute).padStart(2, '0');
  return `${year}-${month}-${day} ${hh}:${mm} ET`;
}

// ── Market hours ──────────────────────────────────────────────────────────────

// Returns true when the US stock market is open:
//   Monday–Friday, 9:30 AM – 4:00 PM Eastern Time
// Note: does not account for market holidays (acceptable for this use case).
function isMarketOpen() {
  const { weekday, hour, minute } = getETParts();

  const isWeekday = !['Saturday', 'Sunday'].includes(weekday);
  const timeInMinutes = hour * 60 + minute;
  const marketOpen  = 9 * 60 + 30;  // 570 minutes
  const marketClose = 16 * 60;       // 960 minutes

  return isWeekday && timeInMinutes >= marketOpen && timeInMinutes < marketClose;
}

// ── Midnight reset timer ──────────────────────────────────────────────────────

// Returns the milliseconds from now until midnight ET.
// We measure how many seconds have elapsed since midnight ET today and subtract
// from 86400. This works correctly across DST transitions because we read the
// current ET clock time directly rather than relying on UTC offsets.
function msUntilMidnightET() {
  const { hour, minute, second } = getETParts();
  const elapsedSeconds = hour * 3600 + minute * 60 + second;
  const remainingSeconds = 24 * 3600 - elapsedSeconds;
  // Add 1 second buffer so the reset fires just after midnight, not just before.
  return (remainingSeconds + 1) * 1000;
}

module.exports = {
  POLL_INTERVAL_MS,
  isMarketOpen,
  msUntilMidnightET,
  getETDateString,
  formatETTimestamp,
};
