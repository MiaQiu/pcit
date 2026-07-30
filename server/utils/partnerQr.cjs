'use strict';

const QRCode = require('qrcode');

// Mirrors the fallback used for the /p/:slug redirect in server.cjs, so the QR
// code always encodes the same URL that redirect points to.
function buildPartnerUrl(slug) {
  const signupAppUrl = process.env.SIGNUP_APP_URL || 'https://signup.hinora.co';
  return `${signupAppUrl}/p/${slug}`;
}

async function generatePartnerQrPng(slug) {
  return QRCode.toBuffer(buildPartnerUrl(slug), { type: 'png', width: 512, margin: 2 });
}

module.exports = { buildPartnerUrl, generatePartnerQrPng };
