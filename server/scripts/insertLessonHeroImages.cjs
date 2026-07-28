'use strict';

/**
 * One-time content operation: uploads the 9 local "day N" hero images
 * (nora-mobile/assets/images/lessons/lesson image/dayN.jpg) to S3 and inserts
 * an ![](key) marker right after the first paragraph of each corresponding
 * lesson's contentV2 -- for the English Lesson row and both zh-CN/zh-TW
 * LessonTranslation rows, reusing the same uploaded image key across all
 * three (same illustration, not language-specific).
 *
 * Safe to re-run: skips a lesson/locale if its contentV2 already contains
 * the exact marker for that lesson's image (checked by key, not just any
 * image marker, since a lesson could have other unrelated inline images).
 *
 * Usage:
 *   node server/scripts/insertLessonHeroImages.cjs --dry-run
 *   node server/scripts/insertLessonHeroImages.cjs
 */

require('dotenv').config();

const fs = require('fs');
const path = require('path');
const prisma = require('../services/db.cjs');
const { uploadLessonContentImage } = require('../services/storage-s3.cjs');

const IMAGE_DIR = path.join(__dirname, '../../nora-mobile/assets/images/lessons/lesson image');

// day1 -> WELCOME-1, day2..9 -> POSITIVE_PLAY-1..8 (confirmed via DB dayNumber ordering)
const DAY_TO_LESSON_ID = {
  1: 'WELCOME-1',
  2: 'POSITIVE_PLAY-1',
  3: 'POSITIVE_PLAY-2',
  4: 'POSITIVE_PLAY-3',
  5: 'POSITIVE_PLAY-4',
  6: 'POSITIVE_PLAY-5',
  7: 'POSITIVE_PLAY-6',
  8: 'POSITIVE_PLAY-7',
  9: 'POSITIVE_PLAY-8',
};

function insertAfterFirstParagraph(contentV2, marker) {
  const match = contentV2.match(/\n\s*\n/);
  if (!match) {
    return contentV2.trimEnd() + '\n\n' + marker;
  }
  const idx = match.index;
  const firstPara = contentV2.slice(0, idx);
  const rest = contentV2.slice(idx + match[0].length);
  return `${firstPara}\n\n${marker}\n\n${rest}`;
}

async function processContentField({ dryRun, label, currentText, imageKey, save }) {
  if (!currentText) {
    console.log(`  [SKIP] ${label} — no contentV2`);
    return 'skipped';
  }
  if (currentText.includes(imageKey)) {
    console.log(`  [SKIP] ${label} — marker already present`);
    return 'skipped';
  }

  const marker = `![](${imageKey})`;
  const updated = insertAfterFirstParagraph(currentText, marker);

  if (dryRun) {
    console.log(`  [DRY-RUN] ${label} — would insert ${marker} after first paragraph`);
    return 'ok';
  }

  await save(updated);
  console.log(`  [OK] ${label}`);
  return 'ok';
}

async function main() {
  const args = process.argv.slice(2);
  const dryRun = args.includes('--dry-run');

  console.log(`Insert lesson hero images${dryRun ? ' (DRY RUN)' : ''}`);

  let ok = 0, skipped = 0, failed = 0;

  for (const [day, lessonId] of Object.entries(DAY_TO_LESSON_ID)) {
    const imagePath = path.join(IMAGE_DIR, `day${day}.jpg`);
    console.log(`\nDay ${day} -> ${lessonId} (${imagePath})`);

    if (!fs.existsSync(imagePath)) {
      console.log(`  [FAILED] image file not found`);
      failed++;
      continue;
    }

    const lesson = await prisma.lesson.findUnique({ where: { id: lessonId }, select: { contentV2: true } });
    if (!lesson) {
      console.log(`  [FAILED] lesson not found in DB`);
      failed++;
      continue;
    }

    let imageKey;
    try {
      if (dryRun) {
        imageKey = `lessons/${lessonId}/content-images/<would-upload>.jpg`;
      } else {
        const buffer = fs.readFileSync(imagePath);
        imageKey = await uploadLessonContentImage(buffer, lessonId, 'jpg');
      }
    } catch (err) {
      console.log(`  [FAILED] upload error: ${err.message}`);
      failed++;
      continue;
    }

    const results = [];

    results.push(
      await processContentField({
        dryRun,
        label: `en (${lessonId})`,
        currentText: lesson.contentV2,
        imageKey,
        save: (updated) => prisma.lesson.update({ where: { id: lessonId }, data: { contentV2: updated, updatedAt: new Date() } }),
      })
    );

    for (const locale of ['zh-CN', 'zh-TW']) {
      const tx = await prisma.lessonTranslation.findUnique({ where: { lessonId_locale: { lessonId, locale } }, select: { contentV2: true } });
      results.push(
        await processContentField({
          dryRun,
          label: `${locale} (${lessonId})`,
          currentText: tx?.contentV2,
          imageKey,
          save: (updated) =>
            prisma.lessonTranslation.update({
              where: { lessonId_locale: { lessonId, locale } },
              data: { contentV2: updated },
            }),
        })
      );
    }

    ok += results.filter((r) => r === 'ok').length;
    skipped += results.filter((r) => r === 'skipped').length;
  }

  console.log(`\nDone. OK: ${ok}, Skipped: ${skipped}, Failed: ${failed}`);
  await prisma.$disconnect();
}

main().catch((err) => {
  console.error('Fatal:', err);
  process.exit(1);
});
