'use strict';

const fs    = require('fs');
const path  = require('path');
const fetch = require('node-fetch');

const BASE_URL        = 'https://generativelanguage.googleapis.com/v1beta';
const UPLOAD_BASE_URL = 'https://generativelanguage.googleapis.com/upload/v1beta';

// In-memory registries — reset on process restart (acceptable: one cold-start round-trip)
const _fileRegistry  = {}; // { [filePath]: { uri, expiresAt } }   — Files API 48 h TTL
const _cacheRegistry = {}; // { [variant]:  { name, expiresAt } }  — cache 24 h TTL

// ─── Files API ────────────────────────────────────────────────────────────────

/**
 * Upload a local file to the Gemini Files API via multipart upload.
 * Returns the file URI (e.g. "https://.../v1beta/files/abc123").
 */
async function uploadFile(apiKey, filePath, mimeType = 'application/pdf') {
  const fileBuffer   = fs.readFileSync(filePath);
  const displayName  = path.basename(filePath);
  const boundary     = `----GeminiBoundary${Date.now()}`;
  const metaJson     = JSON.stringify({ file: { displayName } });

  const body = Buffer.concat([
    Buffer.from(`--${boundary}\r\nContent-Type: application/json; charset=utf-8\r\n\r\n${metaJson}\r\n`),
    Buffer.from(`--${boundary}\r\nContent-Type: ${mimeType}\r\n\r\n`),
    fileBuffer,
    Buffer.from(`\r\n--${boundary}--`),
  ]);

  const res = await fetch(
    `${UPLOAD_BASE_URL}/files?uploadType=multipart&key=${apiKey}`,
    {
      method:  'POST',
      headers: {
        'Content-Type':   `multipart/related; boundary=${boundary}`,
        'Content-Length': String(body.length),
      },
      body,
    }
  );

  if (!res.ok) {
    const errText = await res.text().catch(() => '');
    throw new Error(`Gemini file upload failed ${res.status}: ${errText.substring(0, 300)}`);
  }

  const data = await res.json();
  const uri  = data.file?.uri;
  if (!uri) throw new Error('Gemini file upload: no URI in response');
  return uri;
}

/**
 * Return (or refresh) the uploaded file URI for a local path.
 * Files expire after 48 h; we refresh with a 1-minute safety buffer.
 */
async function getOrUploadFile(filePath, mimeType) {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) throw new Error('GEMINI_API_KEY not set');

  const now   = Date.now();
  const entry = _fileRegistry[filePath];

  if (entry && entry.expiresAt > now + 60_000) {
    console.log(`✅ [GEMINI-CACHE] Reusing uploaded file: ${entry.uri}`);
    return entry.uri;
  }

  console.log(`📤 [GEMINI-CACHE] Uploading ${path.basename(filePath)} to Files API...`);
  const uri = await uploadFile(apiKey, filePath, mimeType);
  _fileRegistry[filePath] = { uri, expiresAt: now + 48 * 3_600_000 }; // 48 h
  console.log(`✅ [GEMINI-CACHE] File uploaded: ${uri}`);
  return uri;
}

// ─── Context Cache API ────────────────────────────────────────────────────────

/**
 * POST /cachedContents — creates a context cache that embeds:
 *   - fileUri  : the uploaded DPICS manual (PDF) as cache contents
 *   - systemInstruction : the coding rules from dpicsCoding.txt
 *
 * @param {string} apiKey
 * @param {string} model             - bare model ID, e.g. 'gemini-2.5-flash'
 * @param {string} fileUri           - URI returned by Files API
 * @param {string} systemInstruction - text from dpicsCoding.txt (+ PDI override if needed)
 * @param {string} [ttl='86400s']
 * @returns {Promise<string>} cache resource name, e.g. 'cachedContents/abc123'
 */
async function createCache(apiKey, model, fileUri, systemInstruction, ttl = '86400s') {
  const url  = `${BASE_URL}/cachedContents?key=${apiKey}`;
  const body = {
    model: `models/${model}`,
    systemInstruction: {
      role: 'user',
      parts: [{ text: systemInstruction }],
    },
    contents: [{
      role: 'user',
      parts: [{
        fileData: { mimeType: 'application/pdf', fileUri },
      }],
    }],
    ttl,
  };

  const res = await fetch(url, {
    method:  'POST',
    headers: { 'Content-Type': 'application/json' },
    body:    JSON.stringify(body),
  });

  if (!res.ok) {
    const errText = await res.text().catch(() => '');
    throw new Error(`Gemini cache creation failed ${res.status}: ${errText.substring(0, 300)}`);
  }

  const data = await res.json();
  return data.name; // e.g. 'cachedContents/abc123'
}

/**
 * Return (or refresh) the context cache for a given variant.
 *
 * @param {string} variant           - logical key, e.g. 'dpics-cdi' or 'dpics-pdi'
 * @param {string} pdfPath           - absolute path to the DPICS manual PDF
 * @param {string} systemInstruction - dpicsCoding.txt content (+ any PDI override)
 * @param {string} model             - Gemini model ID
 * @returns {Promise<string>} cache resource name
 */
async function getOrCreateCache(variant, pdfPath, systemInstruction, model) {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) throw new Error('GEMINI_API_KEY not set');

  const now   = Date.now();
  const entry = _cacheRegistry[variant];

  if (entry && entry.expiresAt > now + 60_000) {
    console.log(`✅ [GEMINI-CACHE] Reusing ${variant} cache: ${entry.name}`);
    return entry.name;
  }

  // Ensure the PDF is uploaded (reuses existing upload if still valid)
  const fileUri = await getOrUploadFile(pdfPath, 'application/pdf');

  console.log(`📦 [GEMINI-CACHE] Creating ${variant} context cache (model: ${model})...`);
  const name = await createCache(apiKey, model, fileUri, systemInstruction);
  _cacheRegistry[variant] = { name, expiresAt: now + 86_400_000 }; // 24 h
  console.log(`✅ [GEMINI-CACHE] Created ${variant} cache: ${name}`);
  return name;
}

/**
 * DELETE /cachedContents/{name} — frees the cache immediately.
 */
async function deleteCache(cacheName) {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey || !cacheName) return;
  await fetch(`${BASE_URL}/${cacheName}?key=${apiKey}`, { method: 'DELETE' }).catch(() => {});
  for (const [k, v] of Object.entries(_cacheRegistry)) {
    if (v.name === cacheName) delete _cacheRegistry[k];
  }
}

module.exports = { getOrCreateCache, getOrUploadFile, createCache, deleteCache };
