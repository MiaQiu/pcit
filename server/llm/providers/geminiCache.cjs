'use strict';

const fs    = require('fs');
const path  = require('path');
const fetch = require('node-fetch');

const BASE_URL        = 'https://generativelanguage.googleapis.com/v1beta';
const UPLOAD_BASE_URL = 'https://generativelanguage.googleapis.com/upload/v1beta';

// Registries persisted to disk so separate short-lived process invocations (e.g. CLI
// scripts run once per session) reuse the same uploaded files / context cache instead
// of re-uploading the manual and recreating the cache on every single invocation.
// Soft-fail on any read/write error — a missing or corrupt registry file just means a
// cold-start re-upload, never a hard failure.
const REGISTRY_PATH = path.join(__dirname, '.gemini-cache-registry.json');

function loadRegistry() {
  try {
    const data = JSON.parse(fs.readFileSync(REGISTRY_PATH, 'utf-8'));
    return {
      fileRegistry:  data.fileRegistry  || {},
      cacheRegistry: data.cacheRegistry || {},
    };
  } catch {
    return { fileRegistry: {}, cacheRegistry: {} };
  }
}

const _loaded = loadRegistry();
const _fileRegistry  = _loaded.fileRegistry;  // { [filePath]: { uri, expiresAt } }   — Files API 48 h TTL
const _cacheRegistry = _loaded.cacheRegistry; // { [variant]:  { name, expiresAt } }  — cache 2 h TTL

function saveRegistry() {
  try {
    fs.writeFileSync(REGISTRY_PATH, JSON.stringify({ fileRegistry: _fileRegistry, cacheRegistry: _cacheRegistry }, null, 2));
  } catch (err) {
    console.warn(`[GEMINI-CACHE] Failed to persist registry (non-fatal): ${err.message}`);
  }
}

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
 * Files expire after 2 h; we refresh with a 1-minute safety buffer.
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
  _fileRegistry[filePath] = { uri, expiresAt: now + 2 * 3_600_000 }; // 2 h
  saveRegistry();
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
 * @param {string|null} systemInstruction - coding rules / system prompt. Pass null/empty to
 *   create a files-only cache (no system instruction baked in) — callers can then prepend
 *   their own instructions to the per-call prompt text instead, so the same cache is reusable
 *   across different prompts. (Gemini rejects combining cachedContent with a separate
 *   systemInstruction field at call time — but prepending into the regular prompt/contents
 *   text, the same way the no-cache fallback already works, is not subject to that restriction.)
 * @param {string} [ttl='7200s'] - 2 h TTL for context caches.
 * @returns {Promise<string>} cache resource name, e.g. 'cachedContents/abc123'
 */
async function createCache(apiKey, model, fileUriOrFiles, systemInstruction, ttl = '7200s') {
  const files = Array.isArray(fileUriOrFiles)
    ? fileUriOrFiles
    : [{ mimeType: 'application/pdf', fileUri: fileUriOrFiles }];

  const url  = `${BASE_URL}/cachedContents?key=${apiKey}`;
  const body = {
    model: `models/${model}`,
    ...(systemInstruction ? { systemInstruction: { role: 'user', parts: [{ text: systemInstruction }] } } : {}),
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
  _cacheRegistry[variant] = { name, expiresAt: now + 2 * 3_600_000 }; // 2 h
  saveRegistry();
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
  saveRegistry();
}

module.exports = { getOrCreateCache, getOrUploadFile, createCache, deleteCache };
