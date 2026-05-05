'use strict';

/**
 * Lesson translation migration script.
 * Translates all lessons into configured target locales using Claude API.
 * Safe to re-run: skips lessons that are already reviewed; upserts auto-translated ones.
 *
 * Usage:
 *   node server/scripts/translateLessons.cjs [locale]
 *   node server/scripts/translateLessons.cjs zh-TW
 *   node server/scripts/translateLessons.cjs          # translates all TARGET_LOCALES
 */

require('dotenv').config();

const prisma = require('../services/db.cjs');
const { translateLessonBundle, LOCALE_NAMES } = require('../services/translationService.cjs');

const TARGET_LOCALES = Object.keys(LOCALE_NAMES); // ['zh-TW']

function buildBundle(lesson) {
  return {
    lesson: {
      title: lesson.title,
      subtitle: lesson.subtitle ?? null,
      shortDescription: lesson.shortDescription,
      objectives: lesson.objectives,
    },
    segments: lesson.LessonSegment.map(s => ({
      id: s.id,
      sectionTitle: s.sectionTitle ?? null,
      bodyText: s.bodyText,
      idealAnswer: s.idealAnswer ?? null,
      customHtml: s.customHtml ?? null,
    })),
    quiz: lesson.Quiz ? {
      question: lesson.Quiz.question,
      options: lesson.Quiz.QuizOption.map(o => ({
        optionLabel: o.optionLabel,
        optionText: o.optionText,
      })),
      explanation: lesson.Quiz.explanation,
      wrongExplanation: lesson.Quiz.wrongExplanation ?? null,
    } : null,
  };
}

async function saveTranslation(lesson, translated, locale) {
  const ops = [
    prisma.lessonTranslation.upsert({
      where: { lessonId_locale: { lessonId: lesson.id, locale } },
      create: {
        lessonId: lesson.id,
        locale,
        title: translated.lesson.title,
        subtitle: translated.lesson.subtitle,
        shortDescription: translated.lesson.shortDescription,
        objectives: translated.lesson.objectives,
      },
      update: {
        title: translated.lesson.title,
        subtitle: translated.lesson.subtitle,
        shortDescription: translated.lesson.shortDescription,
        objectives: translated.lesson.objectives,
        translatedAt: new Date(),
      },
    }),
    ...lesson.LessonSegment.map((seg, i) => {
      const txSeg = translated.segments[i];
      return prisma.lessonSegmentTranslation.upsert({
        where: { segmentId_locale: { segmentId: seg.id, locale } },
        create: {
          segmentId: seg.id,
          locale,
          sectionTitle: txSeg.sectionTitle,
          bodyText: txSeg.bodyText,
          idealAnswer: txSeg.idealAnswer,
          customHtml: txSeg.customHtml,
        },
        update: {
          sectionTitle: txSeg.sectionTitle,
          bodyText: txSeg.bodyText,
          idealAnswer: txSeg.idealAnswer,
          customHtml: txSeg.customHtml,
          translatedAt: new Date(),
        },
      });
    }),
  ];

  if (lesson.Quiz && translated.quiz) {
    ops.push(
      prisma.quizTranslation.upsert({
        where: { quizId_locale: { quizId: lesson.Quiz.id, locale } },
        create: {
          quizId: lesson.Quiz.id,
          locale,
          question: translated.quiz.question,
          options: translated.quiz.options,
          explanation: translated.quiz.explanation,
          wrongExplanation: translated.quiz.wrongExplanation,
        },
        update: {
          question: translated.quiz.question,
          options: translated.quiz.options,
          explanation: translated.quiz.explanation,
          wrongExplanation: translated.quiz.wrongExplanation,
          translatedAt: new Date(),
        },
      })
    );
  }

  await prisma.$transaction(ops);
}

async function main() {
  const args = process.argv.slice(2);
  const cliLocale = args.find(a => !a.startsWith('--'));
  const limitArg = args.find(a => a.startsWith('--limit='));
  const limit = limitArg ? parseInt(limitArg.split('=')[1], 10) : null;

  const locales = cliLocale ? [cliLocale] : TARGET_LOCALES;

  for (const locale of locales) {
    if (!LOCALE_NAMES[locale]) {
      console.error(`Unknown locale: ${locale}. Supported: ${Object.keys(LOCALE_NAMES).join(', ')}`);
      process.exit(1);
    }
  }

  const lessons = await prisma.lesson.findMany({
    include: {
      LessonSegment: { orderBy: { order: 'asc' } },
      Quiz: { include: { QuizOption: { orderBy: { order: 'asc' } } } },
    },
    orderBy: [{ module: 'asc' }, { dayNumber: 'asc' }],
    ...(limit ? { take: limit } : {}),
  });

  console.log(`Found ${lessons.length} lessons. Translating into: ${locales.join(', ')}\n`);

  let ok = 0, skipped = 0, failed = 0;

  for (const locale of locales) {
    for (const lesson of lessons) {
      const existing = await prisma.lessonTranslation.findUnique({
        where: { lessonId_locale: { lessonId: lesson.id, locale } },
        select: { reviewed: true },
      });

      if (existing?.reviewed) {
        console.log(`  [SKIP] ${lesson.module} Day ${lesson.dayNumber} — already reviewed`);
        skipped++;
        continue;
      }

      try {
        process.stdout.write(`  [→] ${lesson.module} Day ${lesson.dayNumber}: ${lesson.title} ... `);
        const bundle = buildBundle(lesson);
        const translated = await translateLessonBundle(bundle, locale);
        await saveTranslation(lesson, translated, locale);
        console.log('OK');
        ok++;
      } catch (err) {
        console.log(`FAILED: ${err.message}`);
        failed++;
      }
    }
  }

  console.log(`\nDone. OK: ${ok}, Skipped (reviewed): ${skipped}, Failed: ${failed}`);
  await prisma.$disconnect();
}

main().catch(err => {
  console.error('Fatal:', err);
  process.exit(1);
});
