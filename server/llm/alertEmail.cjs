'use strict';

/**
 * LLM failure alert — sends an email when an LLM call fails permanently
 * (all retries and fallbacks exhausted).
 *
 * Requires env vars:
 *   SMTP_HOST       (default: smtp.gmail.com)
 *   SMTP_PORT       (default: 587)
 *   SMTP_SECURE     (default: false)
 *   SMTP_USER       sender address + auth user
 *   SMTP_PASS       auth password
 *   LLM_ALERT_EMAIL recipient address (alerts are silently skipped if unset)
 */

const nodemailer = require('nodemailer');

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

/**
 * Send an alert email for a permanently failed LLM call.
 * Fires-and-forgets — never throws. Silently skipped when LLM_ALERT_EMAIL is not set.
 *
 * @param {Object} params
 * @param {string} params.label              - Call label (e.g. 'pcit-coding')
 * @param {string} params.model              - Model that was used (may be fallback)
 * @param {string} params.error              - Error message
 * @param {string} [params.type]             - 'gateway' | 'streaming' (for subject line)
 * @param {string} [params.sessionId]        - Session ID, if available
 */
async function sendLLMFailureAlert({ label, model, error, type = 'gateway', sessionId = null, to: toOverride = null }) {
  const to = toOverride || process.env.LLM_ALERT_EMAIL;
  if (!to || !process.env.SMTP_USER || !process.env.SMTP_PASS) return;

  const timestamp = new Date().toISOString();
  const subject   = `[ALERT] LLM call failed permanently: ${label}`;

  const html = `
    <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
      <h2 style="color: #dc2626;">LLM Call Failed Permanently</h2>
      <p>An LLM call has failed after exhausting all retries and fallbacks.</p>
      <table style="border-collapse: collapse; width: 100%; margin: 20px 0;">
        <tr style="background: #f9fafb;">
          <td style="padding: 8px 12px; font-weight: bold; border: 1px solid #e5e7eb; width: 130px;">Label</td>
          <td style="padding: 8px 12px; border: 1px solid #e5e7eb; font-family: monospace;">${label}</td>
        </tr>
        ${sessionId ? `<tr>
          <td style="padding: 8px 12px; font-weight: bold; border: 1px solid #e5e7eb;">Session ID</td>
          <td style="padding: 8px 12px; border: 1px solid #e5e7eb; font-family: monospace;">${escapeHtml(sessionId)}</td>
        </tr>` : ''}
        <tr>
          <td style="padding: 8px 12px; font-weight: bold; border: 1px solid #e5e7eb;">Type</td>
          <td style="padding: 8px 12px; border: 1px solid #e5e7eb; font-family: monospace;">${type}</td>
        </tr>
        <tr style="background: #f9fafb;">
          <td style="padding: 8px 12px; font-weight: bold; border: 1px solid #e5e7eb;">Model</td>
          <td style="padding: 8px 12px; border: 1px solid #e5e7eb; font-family: monospace;">${model || 'unknown'}</td>
        </tr>
        <tr>
          <td style="padding: 8px 12px; font-weight: bold; border: 1px solid #e5e7eb;">Error</td>
          <td style="padding: 8px 12px; border: 1px solid #e5e7eb; color: #dc2626; font-family: monospace;">${escapeHtml(error || 'unknown error')}</td>
        </tr>
        <tr style="background: #f9fafb;">
          <td style="padding: 8px 12px; font-weight: bold; border: 1px solid #e5e7eb;">Time</td>
          <td style="padding: 8px 12px; border: 1px solid #e5e7eb;">${timestamp}</td>
        </tr>
      </table>
      <p style="color: #6b7280; font-size: 13px;">Check server logs for the full stack trace and structured log line.</p>
      <hr style="border: none; border-top: 1px solid #e5e7eb; margin: 24px 0;">
      <p style="color: #9ca3af; font-size: 12px; text-align: center;">Nora — LLM Gateway Alert</p>
    </div>
  `;

  try {
    await _getTransporter().sendMail({
      from:    `"Nora Alerts" <${process.env.SMTP_USER}>`,
      to,
      subject,
      html,
    });
  } catch (mailErr) {
    // Never let alert failures surface to callers
    console.error(`[llm-alert] Failed to send failure alert for "${label}": ${mailErr.message}`);
  }
}

function escapeHtml(str) {
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

module.exports = { sendLLMFailureAlert };
