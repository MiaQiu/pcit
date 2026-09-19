#!/usr/bin/env node
'use strict';

// Syncs the 5 "Content V2" modules (the ones LearnScreen_v3 renders) and
// their lessons/translations from dev to prod. Unlike
// sync-lessons-to-prod.cjs (which syncs everything), this is deliberately
// scoped to CONTENT_V2_MODULES only — every dev-side query filters on it,
// so the older 5 modules (GETTING_STARTED, EMOTIONAL_MASSAGE, EMOTIONS,
// DISCIPLINE, ADHD) are never read from dev and therefore never written to
// prod. See doc/contentv2_prod_deploy.dm for the full plan.
//
// Requires DEV_DATABASE_URL and PROD_DATABASE_URL env vars (no hardcoded
// fallback, unlike the older script) so credentials never need to live in
// this file. Run the matching S3 copy (lessons/<id>/ prefixes) separately
// before or after this — see the plan doc.

const { Client } = require('pg');
const SSL = { ssl: { rejectUnauthorized: false } };

if (!process.env.DEV_DATABASE_URL || !process.env.PROD_DATABASE_URL) {
  console.error('Set DEV_DATABASE_URL and PROD_DATABASE_URL env vars before running.');
  process.exit(1);
}

const DEV_URL = { connectionString: process.env.DEV_DATABASE_URL, ...SSL };
const PROD_URL = { connectionString: process.env.PROD_DATABASE_URL, ...SSL };

const CONTENT_V2_MODULES = [
  'WELCOME',
  'POSITIVE_PLAY',
  'CALM_DISCIPLINE',
  'BIG_FEELINGS_TANTRUMS',
  'COMMONLY_ASKED_QUESTIONS',
];

async function main() {
  const dev = new Client(DEV_URL);
  const prod = new Client(PROD_URL);
  await dev.connect();
  await prod.connect();
  console.log('Connected to dev and prod.');
  console.log('Scope: modules', CONTENT_V2_MODULES);

  try {
    // --- Read scoped data from dev ---
    const { rows: modules } = await dev.query(
      `SELECT * FROM "Module" WHERE key = ANY($1) ORDER BY "displayOrder"`,
      [CONTENT_V2_MODULES]
    );
    const moduleIds = modules.map(m => m.id);

    const { rows: moduleTranslations } = await dev.query(
      `SELECT * FROM "ModuleTranslation" WHERE "moduleId" = ANY($1)`,
      [moduleIds]
    );

    const { rows: lessons } = await dev.query(
      `SELECT * FROM "Lesson" WHERE module = ANY($1) ORDER BY module, "dayNumber"`,
      [CONTENT_V2_MODULES]
    );
    const lessonIds = lessons.map(l => l.id);

    const { rows: lessonTranslations } = await dev.query(
      `SELECT * FROM "LessonTranslation" WHERE "lessonId" = ANY($1)`,
      [lessonIds]
    );
    const { rows: segments } = await dev.query(
      `SELECT * FROM "LessonSegment" WHERE "lessonId" = ANY($1) ORDER BY "lessonId", "order"`,
      [lessonIds]
    );
    const segmentIds = segments.map(s => s.id);
    const { rows: segmentTranslations } = segmentIds.length
      ? await dev.query(`SELECT * FROM "LessonSegmentTranslation" WHERE "segmentId" = ANY($1)`, [segmentIds])
      : { rows: [] };
    const { rows: quizzes } = await dev.query(
      `SELECT * FROM "Quiz" WHERE "lessonId" = ANY($1) ORDER BY "lessonId"`,
      [lessonIds]
    );
    const quizIds = quizzes.map(q => q.id);
    const { rows: quizOptions } = quizIds.length
      ? await dev.query(`SELECT * FROM "QuizOption" WHERE "quizId" = ANY($1) ORDER BY "quizId", "order"`, [quizIds])
      : { rows: [] };

    console.log(
      `Dev (scoped): ${modules.length} modules, ${moduleTranslations.length} module translations, ` +
      `${lessons.length} lessons, ${lessonTranslations.length} lesson translations, ` +
      `${segments.length} segments, ${segmentTranslations.length} segment translations, ` +
      `${quizzes.length} quizzes, ${quizOptions.length} quiz options`
    );

    await prod.query('BEGIN');

    // --- Modules: upsert by key ---
    let modulesUpserted = 0;
    for (const m of modules) {
      await prod.query(`
        INSERT INTO "Module" (id, key, title, "shortName", description, "displayOrder", "backgroundColor", "createdAt", "updatedAt")
        VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9)
        ON CONFLICT (key) DO UPDATE SET
          title          = EXCLUDED.title,
          "shortName"    = EXCLUDED."shortName",
          description    = EXCLUDED.description,
          "displayOrder" = EXCLUDED."displayOrder",
          "backgroundColor" = EXCLUDED."backgroundColor",
          "updatedAt"    = EXCLUDED."updatedAt"
      `, [m.id, m.key, m.title, m.shortName, m.description, m.displayOrder, m.backgroundColor, m.createdAt, m.updatedAt]);
      modulesUpserted++;
    }
    console.log(`Upserted ${modulesUpserted} modules.`);

    // --- ModuleTranslations: upsert by (moduleId, locale) ---
    let moduleTransUpserted = 0;
    for (const t of moduleTranslations) {
      await prod.query(`
        INSERT INTO "ModuleTranslation" ("moduleId", locale, title, description, "autoTranslated", reviewed, "translatedAt")
        VALUES ($1,$2,$3,$4,$5,$6,$7)
        ON CONFLICT ("moduleId", locale) DO UPDATE SET
          title          = EXCLUDED.title,
          description    = EXCLUDED.description,
          "autoTranslated" = EXCLUDED."autoTranslated",
          reviewed       = EXCLUDED.reviewed,
          "translatedAt" = EXCLUDED."translatedAt"
      `, [t.moduleId, t.locale, t.title, t.description, t.autoTranslated, t.reviewed, t.translatedAt]);
      moduleTransUpserted++;
    }
    console.log(`Upserted ${moduleTransUpserted} module translations.`);

    // --- Lessons: upsert by id (includes Content V2 fields the old script dropped) ---
    let lessonsUpserted = 0;
    for (const l of lessons) {
      await prod.query(`
        INSERT INTO "Lesson" (id, module, "dayNumber", title, subtitle, "shortDescription", objectives,
          "estimatedMinutes", "teachesCategories", "dragonImageUrl", "contentV2", "audioUrl", "wordTimings",
          "durationSeconds", "backgroundColor", "ellipse77Color", "ellipse78Color", "shareCountBase",
          "shareTitle", "shareSubtitle", "createdAt", "updatedAt")
        VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18,$19,$20,$21,$22)
        ON CONFLICT (id) DO UPDATE SET
          module              = EXCLUDED.module,
          "dayNumber"         = EXCLUDED."dayNumber",
          title               = EXCLUDED.title,
          subtitle            = EXCLUDED.subtitle,
          "shortDescription"  = EXCLUDED."shortDescription",
          objectives          = EXCLUDED.objectives,
          "estimatedMinutes"  = EXCLUDED."estimatedMinutes",
          "teachesCategories" = EXCLUDED."teachesCategories",
          "dragonImageUrl"    = EXCLUDED."dragonImageUrl",
          "contentV2"         = EXCLUDED."contentV2",
          "audioUrl"          = EXCLUDED."audioUrl",
          "wordTimings"       = EXCLUDED."wordTimings",
          "durationSeconds"   = EXCLUDED."durationSeconds",
          "backgroundColor"   = EXCLUDED."backgroundColor",
          "ellipse77Color"    = EXCLUDED."ellipse77Color",
          "ellipse78Color"    = EXCLUDED."ellipse78Color",
          "shareCountBase"    = EXCLUDED."shareCountBase",
          "shareTitle"        = EXCLUDED."shareTitle",
          "shareSubtitle"     = EXCLUDED."shareSubtitle",
          "updatedAt"         = EXCLUDED."updatedAt"
      `, [l.id, l.module, l.dayNumber, l.title, l.subtitle, l.shortDescription, l.objectives,
          l.estimatedMinutes, l.teachesCategories, l.dragonImageUrl, l.contentV2, l.audioUrl,
          l.wordTimings === null ? null : JSON.stringify(l.wordTimings),
          l.durationSeconds, l.backgroundColor, l.ellipse77Color, l.ellipse78Color, l.shareCountBase,
          l.shareTitle, l.shareSubtitle, l.createdAt, l.updatedAt]);
      lessonsUpserted++;
    }
    console.log(`Upserted ${lessonsUpserted} lessons.`);

    // --- LessonTranslations: upsert by (lessonId, locale) ---
    let lessonTransUpserted = 0;
    for (const t of lessonTranslations) {
      await prod.query(`
        INSERT INTO "LessonTranslation" ("lessonId", locale, title, subtitle, "shortDescription", objectives,
          "contentV2", "audioUrl", "wordTimings", "durationSeconds", "autoTranslated", reviewed, "translatedAt")
        VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13)
        ON CONFLICT ("lessonId", locale) DO UPDATE SET
          title              = EXCLUDED.title,
          subtitle           = EXCLUDED.subtitle,
          "shortDescription" = EXCLUDED."shortDescription",
          objectives         = EXCLUDED.objectives,
          "contentV2"        = EXCLUDED."contentV2",
          "audioUrl"         = EXCLUDED."audioUrl",
          "wordTimings"      = EXCLUDED."wordTimings",
          "durationSeconds"  = EXCLUDED."durationSeconds",
          "autoTranslated"   = EXCLUDED."autoTranslated",
          reviewed           = EXCLUDED.reviewed,
          "translatedAt"     = EXCLUDED."translatedAt"
      `, [t.lessonId, t.locale, t.title, t.subtitle, t.shortDescription, t.objectives,
          t.contentV2, t.audioUrl, t.wordTimings === null ? null : JSON.stringify(t.wordTimings),
          t.durationSeconds, t.autoTranslated, t.reviewed, t.translatedAt]);
      lessonTransUpserted++;
    }
    console.log(`Upserted ${lessonTransUpserted} lesson translations.`);

    // --- LessonSegments (+ translations): delete-and-reinsert per lesson ---
    const segmentsByLesson = {};
    for (const s of segments) {
      if (!segmentsByLesson[s.lessonId]) segmentsByLesson[s.lessonId] = [];
      segmentsByLesson[s.lessonId].push(s);
    }
    const segTransBySegment = {};
    for (const t of segmentTranslations) {
      if (!segTransBySegment[t.segmentId]) segTransBySegment[t.segmentId] = [];
      segTransBySegment[t.segmentId].push(t);
    }

    let segmentsReplaced = 0;
    let segmentTransReplaced = 0;
    for (const lessonId of lessonIds) {
      await prod.query('DELETE FROM "LessonSegment" WHERE "lessonId" = $1', [lessonId]);
      for (const s of (segmentsByLesson[lessonId] || [])) {
        await prod.query(`
          INSERT INTO "LessonSegment" (id, "lessonId", "order", "sectionTitle", "contentType",
            "bodyText", "imageUrl", "iconType", "createdAt", "updatedAt", "aiCheckMode", "idealAnswer", "customHtml")
          VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13)
        `, [s.id, s.lessonId, s.order, s.sectionTitle, s.contentType,
            s.bodyText, s.imageUrl, s.iconType, s.createdAt, s.updatedAt,
            s.aiCheckMode, s.idealAnswer, s.customHtml]);
        segmentsReplaced++;

        for (const t of (segTransBySegment[s.id] || [])) {
          await prod.query(`
            INSERT INTO "LessonSegmentTranslation" ("segmentId", locale, "sectionTitle", "bodyText",
              "idealAnswer", "customHtml", "autoTranslated", reviewed, "translatedAt")
            VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9)
          `, [t.segmentId, t.locale, t.sectionTitle, t.bodyText, t.idealAnswer, t.customHtml,
              t.autoTranslated, t.reviewed, t.translatedAt]);
          segmentTransReplaced++;
        }
      }
    }
    console.log(`Replaced ${segmentsReplaced} lesson segments, ${segmentTransReplaced} segment translations.`);

    // --- Quizzes + QuizOptions: delete-and-reinsert per lesson ---
    const quizzesByLesson = {};
    for (const q of quizzes) quizzesByLesson[q.lessonId] = q;
    const optionsByQuiz = {};
    for (const o of quizOptions) {
      if (!optionsByQuiz[o.quizId]) optionsByQuiz[o.quizId] = [];
      optionsByQuiz[o.quizId].push(o);
    }

    let quizzesReplaced = 0;
    let optionsReplaced = 0;
    for (const lessonId of lessonIds) {
      await prod.query('DELETE FROM "Quiz" WHERE "lessonId" = $1', [lessonId]);
      const q = quizzesByLesson[lessonId];
      if (!q) continue;

      await prod.query(`
        INSERT INTO "Quiz" (id, "lessonId", question, "correctAnswer", explanation,
          "wrongExplanation", "quizPosition", "createdAt", "updatedAt")
        VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9)
      `, [q.id, q.lessonId, q.question, q.correctAnswer, q.explanation,
          q.wrongExplanation, q.quizPosition, q.createdAt, q.updatedAt]);
      quizzesReplaced++;

      for (const o of (optionsByQuiz[q.id] || [])) {
        await prod.query(`
          INSERT INTO "QuizOption" (id, "quizId", "optionLabel", "optionText", "order")
          VALUES ($1,$2,$3,$4,$5)
        `, [o.id, o.quizId, o.optionLabel, o.optionText, o.order]);
        optionsReplaced++;
      }
    }
    console.log(`Replaced ${quizzesReplaced} quizzes, ${optionsReplaced} quiz options.`);

    await prod.query('COMMIT');
    console.log('\nSync complete.');
  } catch (err) {
    await prod.query('ROLLBACK');
    console.error('ERROR — rolled back:', err.message);
    process.exit(1);
  } finally {
    await dev.end();
    await prod.end();
  }
}

main();
