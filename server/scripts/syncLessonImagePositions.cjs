'use strict';

/**
 * One-time content operation: for every lesson, take the image/video markers
 * currently in the English Lesson.contentV2 (key + position, where position
 * = "after the Nth text block": paragraph/bullet/heading, 0-indexed) and
 * make the zh-CN/zh-TW LessonTranslation.contentV2 match -- same keys, same
 * relative position. Any marker in a translation whose key doesn't appear in
 * the English content is left completely untouched (it's locale-specific
 * content, not something this script owns).
 *
 * Safe to re-run: recomputes from current English state each time.
 *
 * Usage:
 *   node server/scripts/syncLessonImagePositions.cjs --dry-run
 *   node server/scripts/syncLessonImagePositions.cjs
 */

require('dotenv').config();

const prisma = require('../services/db.cjs');

const IMAGE_LINE = /^!\[\]\(([^)]+)\)$/;
const VIDEO_LINE = /^!\[video\]\(([^)]+)\)$/;
const HEADING_LINE = /^#{1,6}\s+(.+)$/;
const DIVIDER_LINE = /^-{3,}$/;

/**
 * Parse contentV2 into (a) the list of {key, type, afterTextBlockIndex} media
 * markers in document order, and (b) the character ranges of each text block
 * (paragraph/bullet/heading) in the normalized string, so a marker can later
 * be inserted/removed at an exact position without touching surrounding text.
 */
function analyze(contentV2) {
  const normalized = contentV2.replace(/\r\n/g, '\n');
  const lines = normalized.split('\n');
  const textBlockRanges = [];
  const media = [];

  let offset = 0;
  let paragraphStart = -1;
  let paragraphEnd = -1;
  let hasParagraph = false;

  const flushParagraph = () => {
    if (hasParagraph) {
      textBlockRanges.push({ start: paragraphStart, end: paragraphEnd });
      hasParagraph = false;
    }
  };

  for (const rawLine of lines) {
    const line = rawLine.trim();
    const lineStart = offset;
    const lineEnd = offset + rawLine.length;

    const videoMatch = line.match(VIDEO_LINE);
    const imageMatch = !videoMatch && line.match(IMAGE_LINE);

    if (line === '') {
      flushParagraph();
    } else if (videoMatch) {
      flushParagraph();
      media.push({ key: videoMatch[1], type: 'video', afterTextBlockIndex: textBlockRanges.length - 1 });
    } else if (imageMatch) {
      flushParagraph();
      media.push({ key: imageMatch[1], type: 'image', afterTextBlockIndex: textBlockRanges.length - 1 });
    } else if (DIVIDER_LINE.test(line)) {
      flushParagraph();
    } else if (line.startsWith('* ') || HEADING_LINE.test(line)) {
      flushParagraph();
      textBlockRanges.push({ start: lineStart, end: lineEnd });
    } else {
      if (!hasParagraph) {
        paragraphStart = lineStart;
        hasParagraph = true;
      }
      paragraphEnd = lineEnd;
    }

    offset = lineEnd + 1;
  }
  flushParagraph();

  return { normalized, textBlockRanges, media };
}

function removeMarkerByKey(contentV2, key) {
  const normalized = contentV2.replace(/\r\n/g, '\n');
  const escaped = key.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const markerLineRegex = new RegExp(`^!\\[(?:video)?\\]\\(${escaped}\\)$`);
  const lines = normalized.split('\n').filter((line) => !markerLineRegex.test(line.trim()));
  return lines.join('\n').replace(/\n{3,}/g, '\n\n');
}

function insertMarkerAfterTextBlock(contentV2, targetIndex, marker) {
  const { normalized, textBlockRanges } = analyze(contentV2);

  if (textBlockRanges.length === 0) {
    return `${normalized.trimEnd()}\n\n${marker}`;
  }

  const clamped = Math.max(0, Math.min(targetIndex, textBlockRanges.length - 1));
  const insertAt = textBlockRanges[clamped].end;
  const before = normalized.slice(0, insertAt);
  const after = normalized.slice(insertAt).replace(/^\n+/, '');
  return `${before}\n\n${marker}\n\n${after}`.replace(/\n{3,}/g, '\n\n');
}

async function syncOne({ dryRun, label, currentText, targets }) {
  if (!currentText) {
    console.log(`  [SKIP] ${label} — no contentV2`);
    return 'skipped';
  }

  let text = currentText;
  const changes = [];

  for (const target of targets) {
    const marker = target.type === 'video' ? `![video](${target.key})` : `![](${target.key})`;
    const { media } = analyze(text);
    const existing = media.find((m) => m.key === target.key);

    if (existing && existing.afterTextBlockIndex === target.afterTextBlockIndex) {
      continue; // already correct
    }
    if (existing) {
      text = removeMarkerByKey(text, target.key);
    }
    text = insertMarkerAfterTextBlock(text, target.afterTextBlockIndex, marker);
    changes.push(`${target.key.split('/').pop()} -> after block ${target.afterTextBlockIndex}`);
  }

  if (changes.length === 0) {
    console.log(`  [SKIP] ${label} — already matches`);
    return 'skipped';
  }

  console.log(`  [${dryRun ? 'DRY-RUN' : 'OK'}] ${label} — ${changes.join('; ')}`);
  if (!dryRun) {
    return { updatedText: text };
  }
  return 'ok';
}

async function main() {
  const args = process.argv.slice(2);
  const dryRun = args.includes('--dry-run');

  console.log(`Sync lesson image positions to zh-CN/zh-TW${dryRun ? ' (DRY RUN)' : ''}`);

  const lessons = await prisma.lesson.findMany({
    where: { contentV2: { not: null } },
    select: { id: true, contentV2: true },
    orderBy: [{ module: 'asc' }, { dayNumber: 'asc' }],
  });

  let ok = 0, skipped = 0;

  for (const lesson of lessons) {
    const { media } = analyze(lesson.contentV2);
    if (media.length === 0) continue;

    console.log(`\n${lesson.id} — English media: ${JSON.stringify(media.map((m) => ({ key: m.key.split('/').pop(), after: m.afterTextBlockIndex })))}`);

    for (const locale of ['zh-CN', 'zh-TW']) {
      const tx = await prisma.lessonTranslation.findUnique({
        where: { lessonId_locale: { lessonId: lesson.id, locale } },
        select: { contentV2: true },
      });

      const result = await syncOne({
        dryRun,
        label: `${locale} (${lesson.id})`,
        currentText: tx?.contentV2,
        targets: media,
      });

      if (result === 'skipped') {
        skipped++;
      } else if (result && result.updatedText) {
        await prisma.lessonTranslation.update({
          where: { lessonId_locale: { lessonId: lesson.id, locale } },
          data: { contentV2: result.updatedText },
        });
        ok++;
      } else if (result === 'ok') {
        ok++; // dry-run counted as would-be-ok
      }
    }
  }

  console.log(`\nDone. OK: ${ok}, Skipped: ${skipped}`);
  await prisma.$disconnect();
}

main().catch((err) => {
  console.error('Fatal:', err);
  process.exit(1);
});
