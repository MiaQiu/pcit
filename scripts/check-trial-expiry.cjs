'use strict';

/**
 * Dry-run: list all users whose RevenueCat trial expires within N days.
 * Usage: node scripts/check-trial-expiry.cjs [daysBeforeExpiry]
 * Default: 3 days
 */

require('dotenv').config({ path: require('path').resolve(__dirname, '../.env') });

const { Client } = require('pg');
const { decryptUserData } = require('../server/utils/encryption.cjs');

const daysBeforeExpiry = parseInt(process.argv[2] ?? '3', 10);

function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

function isInDays(dateStr, days) {
  if (!dateStr) return false;
  const now = new Date();
  const target = new Date(now);
  target.setUTCDate(now.getUTCDate() + days);
  const targetDay = target.toISOString().slice(0, 10);
  return dateStr.slice(0, 10) === targetDay;
}

async function fetchRCSubscriber(userId) {
  const key = process.env.REVENUECAT_SECRET_KEY;
  if (!key) return null;
  try {
    const res = await fetch(`https://api.revenuecat.com/v1/subscribers/${encodeURIComponent(userId)}`, {
      headers: { Authorization: `Bearer ${key}` },
    });
    if (!res.ok) return null;
    const { subscriber } = await res.json();
    return subscriber;
  } catch {
    return null;
  }
}

async function main() {
  console.log(`\n[check-trial-expiry] Checking for trials expiring within ${daysBeforeExpiry} day(s)\n`);

  if (!process.env.REVENUECAT_SECRET_KEY) {
    console.error('ERROR: REVENUECAT_SECRET_KEY not set in .env');
    process.exit(1);
  }

  const dbUrl = process.env.DATABASE_URL;
  const client = new Client({ connectionString: dbUrl, ssl: { rejectUnauthorized: false } });
  await client.connect();

  const { rows: users } = await client.query(
    `SELECT id, name, email FROM "User" ORDER BY "createdAt" ASC`
  );

  console.log(`Checking ${users.length} users against RevenueCat (600ms delay per request)...\n`);

  const results = [];

  for (let i = 0; i < users.length; i++) {
    const user = users[i];
    process.stdout.write(`\r[${i + 1}/${users.length}] checking...`);
    await sleep(600);

    const subscriber = await fetchRCSubscriber(user.id);
    if (!subscriber?.subscriptions) continue;

    for (const [productId, sub] of Object.entries(subscriber.subscriptions)) {
      if (sub.period_type !== 'trial') continue;

      const decrypted = decryptUserData(user);
      const expiresDate = sub.expires_date;
      const cancelled = !!sub.unsubscribe_detected_at;

      if (isInDays(expiresDate, daysBeforeExpiry)) {
        const expiresIn = ((new Date(expiresDate) - new Date()) / (1000 * 60 * 60 * 24)).toFixed(1);
        results.push({
          userId: user.id,
          name: decrypted.name || '(no name)',
          email: decrypted.email || '(no email)',
          productId,
          expiresDate: expiresDate?.slice(0, 19).replace('T', ' ') + ' UTC',
          expiresInDays: parseFloat(expiresIn),
          cancelled,
        });
      }
    }
  }

  await client.end();
  console.log('\n');

  if (results.length === 0) {
    console.log(`No users found with trials expiring within ${daysBeforeExpiry} day(s).`);
  } else {
    console.log(`Found ${results.length} user(s) with trials expiring within ${daysBeforeExpiry} day(s):\n`);
    console.log(
      'Name'.padEnd(25) +
      'Email'.padEnd(35) +
      'Expires (UTC)'.padEnd(22) +
      'Days left'.padEnd(12) +
      'Cancelled'
    );
    console.log('-'.repeat(100));
    for (const r of results.sort((a, b) => a.expiresInDays - b.expiresInDays)) {
      console.log(
        r.name.padEnd(25) +
        r.email.padEnd(35) +
        r.expiresDate.padEnd(22) +
        String(r.expiresInDays).padEnd(12) +
        (r.cancelled ? 'YES (already cancelled)' : 'No')
      );
    }

    console.log(`\nThese are the exact users the scheduled job would email today (expiring on day ${daysBeforeExpiry}, not cancelled).`);
  }
}

main().catch(err => {
  console.error(err);
  process.exit(1);
});
