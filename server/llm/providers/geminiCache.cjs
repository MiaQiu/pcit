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
 * POST /cachedContents — creates a context cache that embeds one or more uploaded files
 * plus a system instruction.
 *
 * @param {string} apiKey
 * @param {string} model             - bare model ID, e.g. 'gemini-2.5-flash'
 * @param {string|Array<{mimeType,fileUri}>} fileUriOrFiles
 *   - string: single PDF URI (legacy)
 *   - Array:  [{ mimeType, fileUri }, ...] for multi-file caches
 * @param {string} systemInstruction - coding rules / system prompt
 * @param {string} [ttl='86400s']
 * @returns {Promise<string>} cache resource name, e.g. 'cachedContents/abc123'
 */
async function createCache(apiKey, model, fileUriOrFiles, systemInstruction, ttl = '86400s') {
  const files = Array.isArray(fileUriOrFiles)
    ? fileUriOrFiles
    : [{ mimeType: 'application/pdf', fileUri: fileUriOrFiles }];

  const url  = `${BASE_URL}/cachedContents?key=${apiKey}`;
  const body = {
    model: `models/${model}`,
    systemInstruction: {
      role: 'user',
      parts: [{ text: systemInstruction }],
    },
    contents: [{
      role: 'user',
      parts: files.map(f => ({ fileData: { mimeType: f.mimeType, fileUri: f.fileUri } })),
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
 * @param {string} pdfPath           - absolute path to the primary PDF
 * @param {string} systemInstruction - dpicsCoding.txt content (+ any PDI override)
 * @param {string} model             - Gemini model ID
 * @param {Array<{path,mimeType}>}   [extraFiles] - additional files to include in the cache
 * @returns {Promise<string>} cache resource name
 */
async function getOrCreateCache(variant, pdfPath, systemInstruction, model, extraFiles = []) {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) throw new Error('GEMINI_API_KEY not set');

  const now   = Date.now();
  const entry = _cacheRegistry[variant];

  if (entry && entry.expiresAt > now + 60_000) {
    console.log(`✅ [GEMINI-CACHE] Reusing ${variant} cache: ${entry.name}`);
    return entry.name;
  }

  // Upload primary PDF + any extra files (reuses existing uploads if still valid)
  const primaryUri = await getOrUploadFile(pdfPath, 'application/pdf');
  const files = [{ mimeType: 'application/pdf', fileUri: primaryUri }];
  for (const f of extraFiles) {
    const uri = await getOrUploadFile(f.path, f.mimeType);
    files.push({ mimeType: f.mimeType, fileUri: uri });
  }

  console.log(`📦 [GEMINI-CACHE] Creating ${variant} context cache (model: ${model}, files: ${files.length})...`);
  const name = await createCache(apiKey, model, files, systemInstruction);
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
