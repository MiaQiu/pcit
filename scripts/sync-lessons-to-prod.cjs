#!/usr/bin/env node
'use strict';

const { Client } = require('pg');

const SSL = { ssl: { rejectUnauthorized: false } };

const DEV_URL  = { connectionString: 'postgresql://nora_admin:D7upDeIjZc1S1BG6Mca1QxKzVqxF4Bbw@localhost:5432/nora_dev',  ...SSL };
const PROD_URL = { connectionString: process.env.PROD_DB_URL || 'postgresql://nora_admin:SvnD5rjj9MSlb0xGeCstfzn5e7ZcSdkR@127.0.0.1:5433/nora', ...SSL };

async function main() {
  const dev = new Client(DEV_URL);
  const prod = new Client(PROD_URL);

  await dev.connect();
  await prod.connect();
  console.log('Connected to dev and prod.');

  try {
    // --- Read all data from dev ---
    const { rows: modules }     = await dev.query('SELECT * FROM "Module" ORDER BY "displayOrder"');
    const { rows: lessons }     = await dev.query('SELECT * FROM "Lesson" ORDER BY "module", "dayNumber"');
    const { rows: segments }    = await dev.query('SELECT * FROM "LessonSegment" ORDER BY "lessonId", "order"');
    const { rows: quizzes }     = await dev.query('SELECT * FROM "Quiz" ORDER BY "lessonId"');
    const { rows: quizOptions } = await dev.query('SELECT * FROM "QuizOption" ORDER BY "quizId", "order"');

    console.log(`Dev: ${modules.length} modules, ${lessons.length} lessons, ${segments.length} segments, ${quizzes.length} quizzes, ${quizOptions.length} quiz options`);

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

    // --- Lessons: upsert by id ---
    let lessonsUpserted = 0;
    for (const l of lessons) {
      await prod.query(`
        INSERT INTO "Lesson" (id, "dayNumber", title, subtitle, "shortDescription", objectives,
          "estimatedMinutes", "teachesCategories", "dragonImageUrl", "backgroundColor",
          "ellipse77Color", "ellipse78Color", "createdAt", "updatedAt", module)
        VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15)
        ON CONFLICT (id) DO UPDATE SET
          "dayNumber"         = EXCLUDED."dayNumber",
          title               = EXCLUDED.title,
          subtitle            = EXCLUDED.subtitle,
          "shortDescription"  = EXCLUDED."shortDescription",
          objectives          = EXCLUDED.objectives,
          "estimatedMinutes"  = EXCLUDED."estimatedMinutes",
          "teachesCategories" = EXCLUDED."teachesCategories",
          "dragonImageUrl"    = EXCLUDED."dragonImageUrl",
          "backgroundColor"   = EXCLUDED."backgroundColor",
          "ellipse77Color"    = EXCLUDED."ellipse77Color",
          "ellipse78Color"    = EXCLUDED."ellipse78Color",
          "updatedAt"         = EXCLUDED."updatedAt",
          module              = EXCLUDED.module
      `, [l.id, l.dayNumber, l.title, l.subtitle, l.shortDescription, l.objectives,
          l.estimatedMinutes, l.teachesCategories, l.dragonImageUrl, l.backgroundColor,
          l.ellipse77Color, l.ellipse78Color, l.createdAt, l.updatedAt, l.module]);
      lessonsUpserted++;
    }
    console.log(`Upserted ${lessonsUpserted} lessons.`);

    // --- LessonSegments: delete-and-reinsert per lesson (handles reordering/deletions) ---
    const lessonIds = lessons.map(l => l.id);
    const segmentsByLesson = {};
    for (const s of segments) {
      if (!segmentsByLesson[s.lessonId]) segmentsByLesson[s.lessonId] = [];
      segmentsByLesson[s.lessonId].push(s);
    }

    let segmentsReplaced = 0;
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
      }
    }
    console.log(`Replaced ${segmentsReplaced} lesson segments.`);

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
      // Delete existing quiz for this lesson (cascades to QuizOptions and QuizResponses)
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
    console.log('\nSync complete. Old lessons/modules remain in prod until cutover.');

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
