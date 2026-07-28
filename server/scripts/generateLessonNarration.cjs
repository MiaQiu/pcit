'use strict';

/**
 * Backfill lesson narration audio via ElevenLabs TTS.
 * Generates audio for English lessons and zh-CN/zh-TW LessonTranslation rows
 * that have contentV2 text but no audioUrl yet, storing results through the
 * same uploadLessonAudio()/Lesson/LessonTranslation fields the manual admin
 * upload flow (POST /lessons/:id/audio in server/routes/admin.cjs) already uses.
 *
 * Safe to re-run: only processes rows where audioUrl is currently null.
 *
 * Usage:
 *   node server/scripts/generateLessonNarration.cjs --dry-run
 *   node server/scripts/generateLessonNarration.cjs --lesson-id=WELCOME-1
 *   node server/scripts/generateLessonNarration.cjs --skip-translations
 *   node server/scripts/generateLessonNarration.cjs
 */

require('dotenv').config();

const prisma = require('../services/db.cjs');
const { uploadLessonAudio } = require('../services/storage-s3.cjs');
const { generateLessonNarration } = require('../services/ttsService.cjs');
const { buildNarrationPlan } = require('../utils/lessonContentTokenizer.cjs');

function narratableWordCount(contentV2) {
  return buildNarrationPlan(contentV2).reduce((sum, chunk) => sum + chunk.words.length, 0);
}

const VOICE_IDS = {
  en: '3NCpLcGW5vNnR78Ytkew',
  'zh-CN': '3NCpLcGW5vNnR78Ytkew',
  'zh-TW': '1AKkSX7KMPHIWuz76m0n',
};

const ITEM_DELAY_MS = 500;

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function processEnglishLessons({ dryRun, lessonId }) {
  const lessons = await prisma.lesson.findMany({
    where: {
      contentV2: { not: null },
      audioUrl: null,
      ...(lessonId ? { id: lessonId } : {}),
    },
    orderBy: [{ module: 'asc' }, { dayNumber: 'asc' }],
  });

  console.log(`\n[English] Found ${lessons.length} lesson(s) with text but no audio.`);
  let ok = 0, skipped = 0, failed = 0;

  for (const lesson of lessons) {
    const label = `${lesson.module} Day ${lesson.dayNumber} (${lesson.id}): ${lesson.title}`;
    const wordCount = narratableWordCount(lesson.contentV2);
    if (wordCount === 0) {
      console.log(`  [SKIP] ${label} — no narratable text after stripping markup`);
      skipped++;
      continue;
    }

    if (dryRun) {
      console.log(`  [DRY-RUN] ${label} — would generate narration for ${wordCount} words`);
      continue;
    }

    try {
      process.stdout.write(`  [→] ${label} ... `);
      const { audioBuffer, wordTimings, durationSeconds } = await generateLessonNarration(lesson.contentV2, VOICE_IDS.en);
      const audioUrl = await uploadLessonAudio(audioBuffer, lesson.id, 'mp3');
      await prisma.lesson.update({
        where: { id: lesson.id },
        data: { audioUrl, wordTimings, durationSeconds, updatedAt: new Date() },
      });
      console.log(`OK (${durationSeconds}s, ${wordTimings.length} words)`);
      ok++;
    } catch (err) {
      console.log(`FAILED: ${err.message}`);
      failed++;
    }

    await sleep(ITEM_DELAY_MS);
  }

  return { ok, skipped, failed };
}

async function processTranslations({ dryRun, lessonId }) {
  const translations = await prisma.lessonTranslation.findMany({
    where: {
      locale: { in: ['zh-CN', 'zh-TW'] },
      contentV2: { not: null },
      audioUrl: null,
      ...(lessonId ? { lessonId } : {}),
    },
    include: { lesson: { select: { module: true, dayNumber: true, title: true } } },
    orderBy: [{ locale: 'asc' }, { lessonId: 'asc' }],
  });

  console.log(`\n[Translations] Found ${translations.length} row(s) with text but no audio.`);
  let ok = 0, skipped = 0, failed = 0;

  for (const tx of translations) {
    const label = `${tx.locale} — ${tx.lesson.module} Day ${tx.lesson.dayNumber} (${tx.lessonId}): ${tx.lesson.title}`;
    const wordCount = narratableWordCount(tx.contentV2);
    if (wordCount === 0) {
      console.log(`  [SKIP] ${label} — no narratable text after stripping markup`);
      skipped++;
      continue;
    }

    if (dryRun) {
      console.log(`  [DRY-RUN] ${label} — would generate narration for ${wordCount} words`);
      continue;
    }

    try {
      process.stdout.write(`  [→] ${label} ... `);
      const voiceId = VOICE_IDS[tx.locale];
      const { audioBuffer, wordTimings, durationSeconds } = await generateLessonNarration(tx.contentV2, voiceId);
      const audioUrl = await uploadLessonAudio(audioBuffer, tx.lessonId, 'mp3', tx.locale);
      await prisma.lessonTranslation.update({
        where: { lessonId_locale: { lessonId: tx.lessonId, locale: tx.locale } },
        data: { audioUrl, wordTimings, durationSeconds },
      });
      console.log(`OK (${durationSeconds}s, ${wordTimings.length} words)`);
      ok++;
    } catch (err) {
      console.log(`FAILED: ${err.message}`);
      failed++;
    }

    await sleep(ITEM_DELAY_MS);
  }

  return { ok, skipped, failed };
}

async function main() {
  const args = process.argv.slice(2);
  const dryRun = args.includes('--dry-run');
  const skipTranslations = args.includes('--skip-translations');
  const lessonIdArg = args.find((a) => a.startsWith('--lesson-id='));
  const lessonId = lessonIdArg ? lessonIdArg.split('=')[1] : null;

  if (!dryRun && !process.env.ELEVENLABS_API_KEY) {
    console.error('ELEVENLABS_API_KEY is not set.');
    process.exit(1);
  }

  console.log(`Lesson narration backfill${dryRun ? ' (DRY RUN)' : ''}${lessonId ? ` — restricted to lesson ${lessonId}` : ''}`);

  const enResult = await processEnglishLessons({ dryRun, lessonId });
  const txResult = skipTranslations ? { ok: 0, skipped: 0, failed: 0 } : await processTranslations({ dryRun, lessonId });

  const totals = {
    ok: enResult.ok + txResult.ok,
    skipped: enResult.skipped + txResult.skipped,
    failed: enResult.failed + txResult.failed,
  };

  console.log(`\nDone. OK: ${totals.ok}, Skipped: ${totals.skipped}, Failed: ${totals.failed}`);
  await prisma.$disconnect();
}

main().catch((err) => {
  console.error('Fatal:', err);
  process.exit(1);
});
