/**
 * Shared "share card" image renderer — a 1200×630 PNG with a title, an
 * optional subtitle, an optional square thumbnail on the right, and a small
 * Nora icon + wordmark footer (mirrors the reference link-preview mockup:
 * bold title, grey subtitle, thumbnail, app icon/name). Used BOTH as the
 * mobile ShareSheet's in-app preview AND as the og:image injected into
 * share-home-card.html / share-lesson.html (see server.cjs) — one rendering
 * path for both Home Cards and Lessons instead of per-surface duplicates.
 *
 * Font note: rendered via sharp's bundled librsvg/pango, which resolves
 * font-family through the container's fontconfig. Alpine ships no fonts, so
 * the Dockerfile installs fontconfig + ttf-dejavu and copies the bundled
 * Plus Jakarta Sans faces (server/assets/fonts/) into /usr/share/fonts —
 * without that, SVG <text> renders as tofu boxes. Locally (macOS) any of
 * the fallbacks below resolve, so it looks right there regardless.
 */

const fs = require('fs');
const path = require('path');
const sharp = require('sharp');
const fetch = require('node-fetch');

const WIDTH = 1200;
// Canvas height adapts to how much text there actually is (see
// buildShareCardImage below) rather than a fixed 630px — a one-line lesson
// title on a fixed-height card left a lot of dead space below it.
const MIN_HEIGHT = 400;
const PADDING = 64;
const THUMB_SIZE = 340;
const THUMB_RADIUS = 20;
const FONT = "'Plus Jakarta Sans', 'Helvetica Neue', Helvetica, Arial, 'DejaVu Sans', sans-serif";
const NORA_ICON_PATH = path.join(__dirname, '..', '..', 'public', 'images', 'nora-icon.png');

function escapeXml(str) {
  return String(str == null ? '' : str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}

// CJK (Chinese/Japanese/Korean) text has no spaces between words, so the
// Latin word-wrap below would treat a whole zh-TW/zh-CN title as one
// unbreakable "word" and run it off the edge of the canvas uncut. Detect it
// and wrap per-character instead (no separator needed — CJK reads fine
// broken anywhere); glyphs are also roughly full-width/square rather than
// ~0.55×fontSize like Latin ones, so maxChars needs a wider estimate too.
const CJK_RE = /[\u3400-\u9FFF\uF900-\uFAFF\u3040-\u30FF\uAC00-\uD7AF]/;

// Rough word-wrap for SVG <text> (which doesn't wrap on its own): estimates
// average glyph width as a fraction of font size rather than measuring real
// metrics, since the actual rendering font isn't known ahead of time (see
// the font-note above) — good enough for a preview thumbnail, not exact.
function wrapText(text, maxWidth, fontSize, maxLines) {
  const isCJK = CJK_RE.test(text);
  const avgCharWidth = fontSize * (isCJK ? 1.0 : 0.55);
  const maxChars = Math.max(1, Math.floor(maxWidth / avgCharWidth));
  const units = isCJK ? Array.from(text.trim()) : text.trim().split(/\s+/).filter(Boolean);
  const sep = isCJK ? '' : ' ';
  const lines = [];
  let current = '';

  for (const unit of units) {
    const candidate = current ? `${current}${sep}${unit}` : unit;
    if (candidate.length > maxChars && current) {
      lines.push(current);
      current = unit;
    } else {
      current = candidate;
    }
    if (lines.length === maxLines - 1 && current.length > maxChars) {
      break;
    }
  }
  if (current) lines.push(current);

  if (lines.length > maxLines) {
    lines.length = maxLines;
  }
  const last = lines[lines.length - 1];
  if (last && lines.length === maxLines && units.join(sep).length > lines.join(sep).length) {
    lines[lines.length - 1] = isCJK
      ? last.slice(0, -1) + '…'
      : last.replace(/\s*\S*$/, '').trim() + '…';
  }
  return lines;
}

// Strips the lightweight markdown syntax used in card message/contentV2 text
// (**bold**, *italic*, "* " bullets, "### " headings, image lines) down to
// plain text — this card renders everything in one plain weight/color, so
// there are no bold/italic runs to preserve, just the literal syntax
// characters to remove before wrapping.
function stripMarkdown(text) {
  return String(text || '')
    .replace(/!\[[^\]]*\]\([^)]*\)/g, '')
    .replace(/^#{1,6}\s+/gm, '')
    .replace(/^\*\s+/gm, '')
    .replace(/\*\*(.+?)\*\*/g, '$1')
    .replace(/\*(.+?)\*/g, '$1')
    .replace(/\n+/g, ' ')
    .trim();
}

function tspanLines(lines, x, startY, lineHeight) {
  return lines.map((line, i) => `<tspan x="${x}" y="${startY + i * lineHeight}">${escapeXml(line)}</tspan>`).join('');
}

// Ports lightenHexColor from HomeScreen_v2.tsx — same math, so the badge
// pill/card tint here match what SubActionCard renders in the app.
function lightenHexColor(hex, amount) {
  const clean = String(hex || '').replace('#', '');
  const full = clean.length === 3 ? clean.split('').map((c) => c + c).join('') : clean;
  const bigint = parseInt(full, 16);
  if (Number.isNaN(bigint)) return hex;
  const r = (bigint >> 16) & 255;
  const g = (bigint >> 8) & 255;
  const b = bigint & 255;
  const mix = (channel) => Math.round(channel + (255 - channel) * amount);
  return `rgb(${mix(r)}, ${mix(g)}, ${mix(b)})`;
}

// Fetches + resizes the thumbnail and rounds its corners (via an SVG mask
// composited with 'dest-in'). Returns null on any failure — a broken/slow
// thumbnail should never take down the whole card.
async function prepareThumbnail(thumbnailUrl) {
  if (!thumbnailUrl) return null;
  try {
    const response = await fetch(thumbnailUrl, { timeout: 5000 });
    if (!response.ok) return null;
    const buffer = Buffer.from(await response.arrayBuffer());

    const mask = Buffer.from(
      `<svg width="${THUMB_SIZE}" height="${THUMB_SIZE}"><rect width="${THUMB_SIZE}" height="${THUMB_SIZE}" rx="${THUMB_RADIUS}" fill="#fff"/></svg>`
    );
    const resized = await sharp(buffer).resize(THUMB_SIZE, THUMB_SIZE, { fit: 'cover' }).png().toBuffer();
    return await sharp(resized)
      .composite([{ input: mask, blend: 'dest-in' }])
      .png()
      .toBuffer();
  } catch (error) {
    console.error('[shareImage] Failed to prepare thumbnail:', error.message);
    return null;
  }
}

/**
 * @param {{ title: string, subtitle?: string, thumbnailUrl?: string|null,
 *           badgeText?: string|null, badgeColor?: string|null,
 *           backgroundColor?: string|null }} params
 * @returns {Promise<Buffer>} PNG bytes
 */
async function buildShareCardImage({ title, subtitle, thumbnailUrl, badgeText, badgeColor, backgroundColor }) {
  const thumbnail = await prepareThumbnail(thumbnailUrl);
  const hasThumb = !!thumbnail;
  const textWidth = hasThumb ? WIDTH - PADDING * 2 - THUMB_SIZE - 48 : WIDTH - PADDING * 2;

  // The card is always shown scaled down inside a link-preview bubble
  // (WhatsApp etc.), so type is sized large relative to the 1200px canvas.
  // Bump SCALE to enlarge every text element together.
  const SCALE = 1.4;

  const TITLE_FONT_SIZE = Math.round(60 * SCALE);
  const TITLE_LINE_HEIGHT = Math.round(74 * SCALE);
  const SUBTITLE_FONT_SIZE = Math.round(36 * SCALE);
  const SUBTITLE_LINE_HEIGHT = Math.round(50 * SCALE);
  const titleLines = wrapText(stripMarkdown(title), textWidth, TITLE_FONT_SIZE, 3);
  const subtitleLines = subtitle ? wrapText(stripMarkdown(subtitle), textWidth, SUBTITLE_FONT_SIZE, 3) : [];

  // Badge pill mirrors SubActionCard's CONTENT layout: a light tint of
  // badgeColor behind badgeColor-tinted text (see subActionBadgePill(Text)
  // in HomeScreen_v2.tsx), sitting above the title.
  const hasBadge = !!(badgeText && badgeColor);
  const BADGE_HEIGHT = Math.round(44 * SCALE);
  const BADGE_FONT_SIZE = Math.round(20 * SCALE);
  const contentTop = PADDING;
  const titleStartY = hasBadge
    ? contentTop + BADGE_HEIGHT + 28 + TITLE_FONT_SIZE
    : contentTop + TITLE_FONT_SIZE;
  const subtitleStartY = titleStartY + (titleLines.length - 1) * TITLE_LINE_HEIGHT + TITLE_LINE_HEIGHT * 0.55 + SUBTITLE_FONT_SIZE * 0.9;

  const footerIconSize = Math.round(64 * SCALE);
  const FOOTER_FONT_SIZE = Math.round(40 * SCALE);
  const GAP_BEFORE_FOOTER = Math.round(48 * SCALE);

  // Bottom of the last line of actual text (subtitle if present, else title).
  const contentBottom = subtitleLines.length
    ? subtitleStartY + (subtitleLines.length - 1) * SUBTITLE_LINE_HEIGHT + SUBTITLE_LINE_HEIGHT * 0.35
    : titleStartY + (titleLines.length - 1) * TITLE_LINE_HEIGHT + TITLE_LINE_HEIGHT * 0.35;

  const textDrivenHeight = contentBottom + GAP_BEFORE_FOOTER + footerIconSize + PADDING;
  const thumbDrivenHeight = hasThumb ? PADDING + THUMB_SIZE + GAP_BEFORE_FOOTER + footerIconSize + PADDING : 0;
  const HEIGHT = Math.round(Math.max(textDrivenHeight, thumbDrivenHeight, MIN_HEIGHT));

  const footerY = HEIGHT - PADDING - footerIconSize / 2;

  const badgeWidth = hasBadge ? badgeText.length * (BADGE_FONT_SIZE * 0.62) + 40 : 0;

  const svg = `<svg width="${WIDTH}" height="${HEIGHT}" viewBox="0 0 ${WIDTH} ${HEIGHT}" xmlns="http://www.w3.org/2000/svg">
    <rect width="${WIDTH}" height="${HEIGHT}" fill="${escapeXml(backgroundColor || '#FFFFFF')}" />
    ${hasBadge ? `
    <rect x="${PADDING}" y="${contentTop}" width="${badgeWidth}" height="${BADGE_HEIGHT}" rx="${BADGE_HEIGHT / 2}" fill="${escapeXml(lightenHexColor(badgeColor, 0.82))}" />
    <text x="${PADDING + badgeWidth / 2}" y="${contentTop + BADGE_HEIGHT / 2 + BADGE_FONT_SIZE * 0.35}" text-anchor="middle" font-family="${FONT}" font-size="${BADGE_FONT_SIZE}" font-weight="700" fill="${escapeXml(badgeColor)}">${escapeXml(badgeText)}</text>
    ` : ''}
    <text x="${PADDING}" font-family="${FONT}" font-size="${TITLE_FONT_SIZE}" font-weight="700" fill="#1E2939">${tspanLines(titleLines, PADDING, titleStartY, TITLE_LINE_HEIGHT)}</text>
    ${subtitleLines.length ? `<text x="${PADDING}" font-family="${FONT}" font-size="${SUBTITLE_FONT_SIZE}" font-weight="400" fill="#6B7280">${tspanLines(subtitleLines, PADDING, subtitleStartY, SUBTITLE_LINE_HEIGHT)}</text>` : ''}
    <text x="${PADDING + footerIconSize + 18}" y="${footerY + FOOTER_FONT_SIZE * 0.35}" font-family="${FONT}" font-size="${FOOTER_FONT_SIZE}" font-weight="700" fill="#1E2939">Nora AI</text>
  </svg>`;

  const base = await sharp(Buffer.from(svg)).png().toBuffer();

  const overlays = [];
  if (thumbnail) {
    overlays.push({ input: thumbnail, top: PADDING, left: WIDTH - PADDING - THUMB_SIZE });
  }
  if (fs.existsSync(NORA_ICON_PATH)) {
    const icon = await sharp(NORA_ICON_PATH).resize(footerIconSize, footerIconSize).png().toBuffer();
    overlays.push({ input: icon, top: Math.round(footerY - footerIconSize / 2), left: PADDING });
  }

  return overlays.length ? sharp(base).composite(overlays).png().toBuffer() : base;
}

module.exports = { buildShareCardImage, lightenHexColor };
