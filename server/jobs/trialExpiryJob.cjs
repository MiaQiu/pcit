'use strict';

/**
 * Trial Expiry Reminder Job
 *
 * Runs daily at 10:00am SGT (02:00 UTC).
 * Queries RevenueCat directly for every user to find trials ending in N days,
 * then sends them a reminder email.
 *
 * Requires env vars:
 *   REVENUECAT_SECRET_KEY   RevenueCat secret API key (sk_...)
 *   SMTP_HOST, SMTP_PORT, SMTP_SECURE, SMTP_USER, SMTP_PASS
 */

const cron = require('node-cron');
const nodemailer = require('nodemailer');
const prisma = require('../services/db.cjs');
const { decryptUserData } = require('../utils/encryption.cjs');

// ─── SMTP ────────────────────────────────────────────────────────────────────

let _transporter = null;

function getTransporter() {
  if (!_transporter) {
    _transporter = nodemailer.createTransport({
      host: process.env.SMTP_HOST || 'smtp.gmail.com',
      port: parseInt(process.env.SMTP_PORT || '587', 10),
      secure: process.env.SMTP_SECURE === 'true',
      auth: { user: process.env.SMTP_USER, pass: process.env.SMTP_PASS },
    });
  }
  return _transporter;
}

// ─── HELPERS ─────────────────────────────────────────────────────────────────

function escapeHtml(str) {
  return String(str)
    .replace(/&/g, '&amp;').replace(/</g, '&lt;')
    .replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

/**
 * Returns true if the given UTC date string falls within the target day
 * (i.e. exactly `days` days from now, by UTC date boundary).
 */
function isInDays(dateStr, days) {
  if (!dateStr) return false;
  const now = new Date();
  const target = new Date(now);
  target.setUTCDate(now.getUTCDate() + days);
  const targetDay = target.toISOString().slice(0, 10); // YYYY-MM-DD
  return dateStr.slice(0, 10) === targetDay;
}

// ─── REVENUECAT ──────────────────────────────────────────────────────────────

/**
 * Fetch subscriber info from RevenueCat for a given user ID.
 * Returns null if the user doesn't exist in RC or on error.
 */
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

/**
 * Given a RevenueCat subscriber object, return the trial subscription that
 * expires in exactly `days` days and has NOT been cancelled, or null if none.
 */
function getTrialExpiringSoon(subscriber, days) {
  if (!subscriber?.subscriptions) return null;
  for (const [productId, sub] of Object.entries(subscriber.subscriptions)) {
    if (
      sub.period_type === 'trial' &&
      !sub.unsubscribe_detected_at &&
      isInDays(sub.expires_date, days)
    ) {
      return { productId, expiresDate: sub.expires_date };
    }
  }
  return null;
}

// ─── EMAIL ───────────────────────────────────────────────────────────────────

function buildTrialExpiryHtml({ name, daysLeft, trialEndFormatted, sessionCount, totalEmotionalDeposits, report }) {
  const firstName = escapeHtml(name.split(' ')[0]);

  const stats = [];
  if (sessionCount > 0) stats.push({ value: sessionCount, label: 'sessions completed' });
  if (totalEmotionalDeposits > 0) stats.push({ value: totalEmotionalDeposits, label: 'total emotional account deposits' });
  if (report?.strongestGrowthArea) stats.push({ value: report.strongestGrowthArea, label: 'strongest skill' });
  if (report?.massageTimeMinutes > 0 && stats.length < 4) stats.push({ value: `${report.massageTimeMinutes}m`, label: 'practice time' });

  // Row 1: sessions + strongest skill | Row 2: total deposits centered
  let metricsHtml = '';
  if (stats.length > 0) {
    const sessions = stats.find(s => s.label === 'sessions completed');
    const deposits = stats.find(s => s.label === 'total emotional account deposits');
    const skill = stats.find(s => s.label === 'strongest skill');

    const tile = (s, pad) => s
      ? `<td style="width:50%;padding:${pad};"><div style="background:#f9fafb;border:1px solid #e5e7eb;border-radius:8px;padding:12px;text-align:center;"><div style="font-size:22px;font-weight:700;color:#4f46e5;">${escapeHtml(String(s.value))}</div><div style="font-size:11px;color:#6b7280;margin-top:2px;">${escapeHtml(s.label)}</div></div></td>`
      : '<td style="width:50%;"></td>';

    const row1 = `<tr>${tile(sessions, '4px 4px 4px 0')}${tile(skill, '4px 0 4px 4px')}</tr>`;
    const row2 = deposits
      ? `<tr><td colspan="2" style="padding:4px 0 0;"><div style="background:#f9fafb;border:1px solid #e5e7eb;border-radius:8px;padding:12px;text-align:center;"><div style="font-size:22px;font-weight:700;color:#4f46e5;">${escapeHtml(String(deposits.value))}</div><div style="font-size:11px;color:#6b7280;margin-top:2px;">${escapeHtml(deposits.label)}</div></div></td></tr>`
      : '';

    metricsHtml = `<p style="margin:0 0 8px;font-size:13px;font-weight:600;color:#374151;">Your progress during the trial</p><table style="width:100%;border-collapse:collapse;margin-bottom:16px;">${row1}${row2}</table>`;
  }

  const openingLine = stats.length > 0
    ? `Here's what you've built during your trial — don't lose it.`
    : `You've started your journey with Nora — keep that momentum going.`;

  return `<!DOCTYPE html><html><body style="margin:0;padding:0;background:#f3f4f6;"><div style="font-family:Arial,sans-serif;max-width:560px;margin:32px auto;border-radius:12px;overflow:hidden;border:1px solid #e5e7eb;"><div style="background:linear-gradient(135deg,#6366f1,#8b5cf6);padding:28px 24px;text-align:center;"><p style="color:#c7d2fe;margin:0 0 6px;font-size:12px;letter-spacing:.08em;text-transform:uppercase;">Subscription renewal</p><h1 style="color:#fff;margin:0;font-size:22px;font-weight:700;">Your Nora subscription renews in ${daysLeft} day${daysLeft !== 1 ? 's' : ''}</h1></div><div style="background:#fff;padding:24px;"><p style="margin:0 0 4px;font-size:15px;">Hi ${firstName},</p><p style="margin:0 0 16px;font-size:14px;color:#4b5563;">${openingLine}</p>${metricsHtml}<div style="background:#f9fafb;border:1px solid #e5e7eb;border-radius:8px;padding:14px 16px;margin-bottom:12px;"><p style="margin:0;font-size:12px;color:#6b7280;">Renewal date</p><p style="margin:2px 0 6px;font-size:15px;font-weight:600;color:#111827;">${escapeHtml(trialEndFormatted)}</p><p style="margin:0;font-size:12px;color:#6b7280;">Your subscription renews automatically. Don't want to continue? Cancel before ${escapeHtml(trialEndFormatted)} and you won't be charged.</p></div><p style="margin:0;font-size:12px;color:#9ca3af;text-align:center;">Questions? Reply to this email — we're happy to help.</p></div></div></body></html>`;
}

async function sendTrialExpiryEmail(user, daysLeft, trialEndFormatted, report) {
  if (!process.env.SMTP_USER || !process.env.SMTP_PASS) {
    console.warn('[TrialExpiryJob] SMTP not configured — skipping email');
    return false;
  }

  const decrypted = decryptUserData(user);
  const name = decrypted.name || 'there';
  const email = decrypted.email;
  if (!email) return false;

  const sessionCount = user._count?.Session ?? 0;
  const totalEmotionalDeposits = user._totalDeposits ?? 0;

  const html = buildTrialExpiryHtml({ name, daysLeft, trialEndFormatted, sessionCount, totalEmotionalDeposits, report });

  try {
    await getTransporter().sendMail({
      from: `"Nora Parenting" <info@chromamind.ai>`,
      to: email,
      subject: `Your Nora subscription renews in ${daysLeft} day${daysLeft !== 1 ? 's' : ''} — here's what to know`,
      html,
    });
    return true;
  } catch (err) {
    console.error(`[TrialExpiryJob] Failed to send to user ${user.id}: ${err.message}`);
    return false;
  }
}

// ─── MAIN JOB ────────────────────────────────────────────────────────────────

/**
 * Run the trial expiry job.
 * Queries RevenueCat for every user to find trials ending in `daysBeforeExpiry` days.
 * Rate-limited to ~100 req/min (600ms delay) to stay under RC's 150 req/min limit.
 */
async function runTrialExpiryJob(daysBeforeExpiry = 3) {
  console.log(`[TrialExpiryJob] Starting — checking RC for trials ending in ${daysBeforeExpiry} days`);

  if (!process.env.REVENUECAT_SECRET_KEY) {
    console.error('[TrialExpiryJob] REVENUECAT_SECRET_KEY not set — aborting');
    return { found: 0, sent: 0, failed: 0 };
  }

  // Fetch all users with email
  const users = await prisma.user.findMany({
    select: {
      id: true,
      name: true,
      email: true,
      _count: { select: { Session: true } },
    },
  });

  console.log(`[TrialExpiryJob] Checking ${users.length} users against RevenueCat`);

  // Aggregate total overallScore per user in one query
  const scoreAggs = await prisma.session.groupBy({
    by: ['userId'],
    where: { overallScore: { not: null } },
    _sum: { overallScore: true },
  });
  const scoreByUserId = Object.fromEntries(scoreAggs.map(r => [r.userId, r._sum.overallScore ?? 0]));

  // Fetch latest published weekly report per user in one query
  const reports = await prisma.weeklyReport.findMany({
    where: { visibility: true },
    orderBy: { weekStartDate: 'desc' },
    select: {
      userId: true,
      strongestGrowthArea: true,
      massageTimeMinutes: true,
    },
  });
  // Keep only the most recent per user
  const reportByUserId = {};
  for (const r of reports) {
    if (!reportByUserId[r.userId]) reportByUserId[r.userId] = r;
  }

  let found = 0, sent = 0, failed = 0;

  for (const user of users) {
    // RC API rate limit: ~100 req/min
    await sleep(600);

    const subscriber = await fetchRCSubscriber(user.id);
    const trial = getTrialExpiringSoon(subscriber, daysBeforeExpiry);
    if (!trial) continue;

    found++;
    console.log(`[TrialExpiryJob] Trial expiring in ${daysBeforeExpiry}d for user ${user.id}`);

    const trialEndFormatted = new Date(trial.expiresDate).toLocaleDateString('en-US', {
      year: 'numeric', month: 'long', day: 'numeric', timeZone: 'Asia/Singapore',
    });

    const enrichedUser = {
      ...user,
      _totalDeposits: scoreByUserId[user.id] ?? 0,
    };
    const report = reportByUserId[user.id] ?? { strongestGrowthArea: 'Narrate', massageTimeMinutes: 0 };

    const ok = await sendTrialExpiryEmail(enrichedUser, daysBeforeExpiry, trialEndFormatted, report);
    if (ok) {
      sent++;
      console.log(`[TrialExpiryJob] Sent to user ${user.id}`);
    } else {
      failed++;
    }
  }

  console.log(`[TrialExpiryJob] Done — found: ${found}, sent: ${sent}, failed: ${failed}`);
  return { found, sent, failed };
}

// ─── SCHEDULER ───────────────────────────────────────────────────────────────

function scheduleTrialExpiryJob() {
  // 0 2 * * * = 02:00 UTC daily = 10:00am SGT
  cron.schedule('0 2 * * *', async () => {
    try {
      await runTrialExpiryJob(3);
    } catch (err) {
      console.error('[TrialExpiryJob] Unexpected error:', err);
    }
  }, { timezone: 'UTC' });

  console.log('[TrialExpiryJob] Scheduled — runs daily at 10:00am SGT (02:00 UTC)');
}

module.exports = { scheduleTrialExpiryJob, runTrialExpiryJob };
