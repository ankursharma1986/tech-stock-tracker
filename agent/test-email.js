'use strict';

require('dotenv').config({ path: require('path').join(__dirname, '..', '.env') });

const { sendAlertEmail } = require('./emailer');

// Simulated NVDA drop — 5.83% below today's open
const testDrops = [
  {
    symbol:       'NVDA',
    name:         'NVIDIA',
    openPrice:    125.40,
    currentPrice: 118.09,
    dropPct:      -5.83,
  },
];

(async () => {
  console.log('Sending test alert email...');
  console.log(`  To:   ${process.env.ALERT_EMAIL_TO}`);
  console.log(`  From: ${process.env.ALERT_EMAIL_FROM}`);
  console.log('');

  try {
    const result = await sendAlertEmail(testDrops);
    console.log('Test email sent successfully!');
    console.log('Resend response:', result);
  } catch (err) {
    console.error('Failed to send test email:', err.message);
    process.exit(1);
  }
})();
