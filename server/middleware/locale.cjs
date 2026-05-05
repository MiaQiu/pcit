'use strict';

const SUPPORTED_LOCALES = new Set(['en', 'zh-TW']);
const DEFAULT_LOCALE = 'en';

function normalizeLocale(raw) {
  if (!raw) return DEFAULT_LOCALE;
  const trimmed = raw.split(',')[0].trim(); // handle "zh-TW,zh;q=0.9"
  if (SUPPORTED_LOCALES.has(trimmed)) return trimmed;
  const lang = trimmed.split('-')[0].toLowerCase();
  if (lang === 'zh') return 'zh-TW';
  if (lang === 'en') return 'en';
  return DEFAULT_LOCALE;
}

function localeMiddleware(req, _res, next) {
  const raw = req.query.lang || req.headers['accept-language'];
  req.locale = normalizeLocale(raw);
  next();
}

module.exports = { localeMiddleware, SUPPORTED_LOCALES };
