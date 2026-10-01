'use strict';

const QRCode = require('qrcode');

// Mirrors the fallback used for the /p/:slug redirect in server.cjs, so the QR
// code always encodes the same URL that redirect points to.
function buildPartnerUrl(slug) {
  const signupAppUrl = process.env.SIGNUP_APP_URL || 'https://signup.hinora.co';
  return `${signupAppUrl}/p/${slug}`;
}

// Campaign link for one message variant and channel: /p/<slug>[/<messageKey>][?src=<source>].
function buildCampaignUrl(slug, messageKey = null, source = null) {
  const path = messageKey ? `${buildPartnerUrl(slug)}/${messageKey}` : buildPartnerUrl(slug);
  return source ? `${path}?src=${encodeURIComponent(source)}` : path;
}

async function generatePartnerQrPng(slug) {
  return QRCode.toBuffer(buildPartnerUrl(slug), { type: 'png', width: 512, margin: 2 });
}

// On-the-fly QR for a link-builder URL (not stored — every message x channel combination has one).
async function generateQrDataUrl(url) {
  return QRCode.toDataURL(url, { width: 512, margin: 2 });
}

module.exports = { buildPartnerUrl, buildCampaignUrl, generatePartnerQrPng, generateQrDataUrl };
