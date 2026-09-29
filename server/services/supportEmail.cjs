'use strict';

/**
 * Support request notification — emails the support inbox whenever a user
 * submits a ticket from Profile → Support.
 *
 * Uses the same SMTP env vars as llm/alertEmail.cjs:
 *   SMTP_HOST, SMTP_PORT, SMTP_SECURE, SMTP_USER, SMTP_PASS
 *   SUPPORT_NOTIFY_EMAIL  recipient override (default: yihui.qiu@chromamind.ai)
 */

const nodemailer = require('nodemailer');

const DEFAULT_RECIPIENT = 'yihui.qiu@chromamind.ai';

let _transporter = null;

function _getTransporter() {
  if (!_transporter) {
    _transporter = nodemailer.createTransport({
      host:   process.env.SMTP_HOST || 'smtp.gmail.com',
      port:   parseInt(process.env.SMTP_PORT || '587', 10),
      secure: process.env.SMTP_SECURE === 'true',
      auth: {
        user: process.env.SMTP_USER,
        pass: process.env.SMTP_PASS,
      },
    });
  }
  return _transporter;
}

function escapeHtml(str) {
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function formatSize(bytes) {
  if (!bytes) return '0 B';
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

/**
 * Send a notification email for a new support request.
 * Fire-and-forget — never throws. Skipped when SMTP credentials are not set.
 *
 * @param {Object} params
 * @param {string} params.requestId
 * @param {string} params.userId
 * @param {string} params.contactEmail   - Email the user typed into the form
 * @param {string} params.description
 * @param {Array<{url: string, name: string, size: number}>} [params.attachments]
 * @param {{email?: string, name?: string}|null} [params.account] - The user's account record
 * @param {Date} [params.createdAt]
 */
async function sendSupportRequestEmail({ requestId, userId, contactEmail, description, attachments = [], account = null, createdAt = new Date() }) {
  const to = process.env.SUPPORT_NOTIFY_EMAIL || DEFAULT_RECIPIENT;
  if (!process.env.SMTP_USER || !process.env.SMTP_PASS) {
    console.warn('[support-email] SMTP not configured, skipping support request notification');
    return;
  }

  const preview = description.replace(/\s+/g, ' ').slice(0, 60);
  const subject = `[Support] ${contactEmail}: ${preview}${description.length > 60 ? '…' : ''}`;

  const row = (label, value, shaded) => `
        <tr${shaded ? ' style="background: #f9fafb;"' : ''}>
          <td style="padding: 8px 12px; font-weight: bold; border: 1px solid #e5e7eb; width: 130px;">${label}</td>
          <td style="padding: 8px 12px; border: 1px solid #e5e7eb;">${value}</td>
        </tr>`;

  const attachmentsHtml = attachments.length > 0
    ? `<ul style="padding-left: 20px;">${attachments.map(a =>
        `<li><a href="${escapeHtml(a.url)}">${escapeHtml(a.name)}</a> (${formatSize(a.size)})</li>`
      ).join('')}</ul>`
    : '<p style="color: #6b7280;">None</p>';

  const html = `
    <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
      <h2 style="color: #8C49D5;">New Support Request</h2>
      <table style="border-collapse: collapse; width: 100%; margin: 20px 0;">
        ${row('Contact email', `<a href="mailto:${escapeHtml(contactEmail)}">${escapeHtml(contactEmail)}</a>`, true)}
        ${row('Account email', escapeHtml(account?.email || 'unknown'), false)}
        ${row('Account name', escapeHtml(account?.name || '—'), true)}
        ${row('User ID', `<span style="font-family: monospace;">${escapeHtml(userId)}</span>`, false)}
        ${row('Request ID', `<span style="font-family: monospace;">${escapeHtml(requestId)}</span>`, true)}
        ${row('Submitted', createdAt.toISOString(), false)}
      </table>
      <h3 style="margin-bottom: 8px;">Description</h3>
      <div style="white-space: pre-wrap; background: #f9fafb; border: 1px solid #e5e7eb; border-radius: 8px; padding: 12px;">${escapeHtml(description)}</div>
      <h3 style="margin-bottom: 8px;">Attachments (${attachments.length})</h3>
      ${attachmentsHtml}
      <hr style="border: none; border-top: 1px solid #e5e7eb; margin: 24px 0;">
      <p style="color: #9ca3af; font-size: 12px; text-align: center;">Nora — Support Request Notification. Reply to this email to respond to the user.</p>
    </div>
  `;

  try {
    await _getTransporter().sendMail({
      from:    `"Nora Support" <${process.env.SMTP_USER}>`,
      to,
      replyTo: contactEmail,
      subject,
      html,
    });
  } catch (mailErr) {
    console.error(`[support-email] Failed to send notification for request ${requestId}: ${mailErr.message}`);
  }
}

module.exports = { sendSupportRequestEmail };
