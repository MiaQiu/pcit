/**
 * lesson-to-sql.cjs
 *
 * Converts lesson definitions into PostgreSQL SQL statements.
 * Pipe the output directly to psql or save to a .sql file.
 *
 * Usage (standalone — edit LESSONS at the bottom):
 *   node scripts/lesson-to-sql.cjs
 *   node scripts/lesson-to-sql.cjs > output.sql
 *
 * Usage (as a module from another script):
 *   const { generateSql } = require('./lesson-to-sql.cjs');
 *   console.log(generateSql(lessons));
 */

const crypto = require('crypto');

function randomId() {
  return crypto.randomBytes(12).toString('base64').replace(/[+/=]/g, '').substring(0, 25);
}

// Escape a value for use inside a SQL single-quoted string.
function esc(val) {
  if (val === null || val === undefined) return 'NULL';
  return `'${String(val).replace(/'/g, "''")}'`;
}

// PostgreSQL TEXT[] array literal.
function escArray(arr) {
  if (!arr || arr.length === 0) return `ARRAY[]::TEXT[]`;
  return `ARRAY[${arr.map(esc).join(', ')}]`;
}

// Nullable integer.
function escInt(val) {
  if (val === null || val === undefined) return 'NULL';
  return String(Number(val));
}

/**
 * Generate SQL for an array of lesson definitions.
 * Each definition has the shape:
 *   {
 *     lesson:   { id, module, dayNumber, title, subtitle?, shortDescription,
 *                 objectives, estimatedMinutes, teachesCategories,
 *                 backgroundColor, ellipse77Color, ellipse78Color },
 *     segments: [{ order, sectionTitle?, contentType, bodyText, customHtml? }],
 *     quiz:     { question, correctAnswer, explanation, wrongExplanation?,
 *                 quizPosition?, options: [{ label, text, order }] } | null,
 *   }
 */
function generateSql(lessons) {
  const blocks = [];

  for (const def of lessons) {
    const { lesson, segments, quiz } = def;
    const lessonId = lesson.id;
    const lines = [];

    lines.push(`-- ════════════════════════════════════════════════════════════`);
    lines.push(`-- Lesson: ${lessonId} — ${lesson.title}`);
    lines.push(`-- ════════════════════════════════════════════════════════════`);
    lines.push('');

    // ── Lesson upsert ──────────────────────────────────────────────────────────
    lines.push(`INSERT INTO "Lesson" (`);
    lines.push(`  id, module, "dayNumber", title, subtitle, "shortDescription",`);
    lines.push(`  objectives, "estimatedMinutes", "teachesCategories",`);
    lines.push(`  "backgroundColor", "ellipse77Color", "ellipse78Color", "updatedAt"`);
    lines.push(`) VALUES (`);
    lines.push(`  ${esc(lessonId)},`);
    lines.push(`  ${esc(lesson.module)},`);
    lines.push(`  ${lesson.dayNumber},`);
    lines.push(`  ${esc(lesson.title)},`);
    lines.push(`  ${esc(lesson.subtitle ?? null)},`);
    lines.push(`  ${esc(lesson.shortDescription)},`);
    lines.push(`  ${escArray(lesson.objectives)},`);
    lines.push(`  ${lesson.estimatedMinutes},`);
    lines.push(`  ${escArray(lesson.teachesCategories)},`);
    lines.push(`  ${esc(lesson.backgroundColor)},`);
    lines.push(`  ${esc(lesson.ellipse77Color)},`);
    lines.push(`  ${esc(lesson.ellipse78Color)},`);
    lines.push(`  NOW()`);
    lines.push(`) ON CONFLICT (id) DO UPDATE SET`);
    lines.push(`  title              = EXCLUDED.title,`);
    lines.push(`  subtitle           = EXCLUDED.subtitle,`);
    lines.push(`  "shortDescription" = EXCLUDED."shortDescription",`);
    lines.push(`  objectives         = EXCLUDED.objectives,`);
    lines.push(`  "estimatedMinutes" = EXCLUDED."estimatedMinutes",`);
    lines.push(`  "teachesCategories"= EXCLUDED."teachesCategories",`);
    lines.push(`  "backgroundColor"  = EXCLUDED."backgroundColor",`);
    lines.push(`  "ellipse77Color"   = EXCLUDED."ellipse77Color",`);
    lines.push(`  "ellipse78Color"   = EXCLUDED."ellipse78Color",`);
    lines.push(`  "updatedAt"        = NOW();`);
    lines.push('');

    // ── Segments (delete + insert) ─────────────────────────────────────────────
    lines.push(`DELETE FROM "LessonSegment" WHERE "lessonId" = ${esc(lessonId)};`);
    lines.push('');

    for (const seg of segments) {
      const segId = randomId();
      lines.push(`INSERT INTO "LessonSegment" (`);
      lines.push(`  id, "lessonId", "order", "sectionTitle", "contentType", "bodyText", "customHtml", "updatedAt"`);
      lines.push(`) VALUES (`);
      lines.push(`  ${esc(segId)},`);
      lines.push(`  ${esc(lessonId)},`);
      lines.push(`  ${seg.order},`);
      lines.push(`  ${esc(seg.sectionTitle ?? null)},`);
      lines.push(`  ${esc(seg.contentType ?? 'TEXT')},`);
      lines.push(`  ${esc(seg.bodyText ?? '')},`);
      lines.push(`  ${esc(seg.customHtml ?? null)},`);
      lines.push(`  NOW()`);
      lines.push(`);`);
      lines.push('');
    }

    // ── Quiz (delete + insert) ─────────────────────────────────────────────────
    lines.push(`DELETE FROM "Quiz" WHERE "lessonId" = ${esc(lessonId)};`);
    lines.push('');

    if (quiz && quiz.question) {
      const quizId = randomId();

      lines.push(`INSERT INTO "Quiz" (`);
      lines.push(`  id, "lessonId", question, "correctAnswer", explanation, "wrongExplanation", "quizPosition", "updatedAt"`);
      lines.push(`) VALUES (`);
      lines.push(`  ${esc(quizId)},`);
      lines.push(`  ${esc(lessonId)},`);
      lines.push(`  ${esc(quiz.question)},`);
      lines.push(`  ${esc(quiz.correctAnswer)},`);
      lines.push(`  ${esc(quiz.explanation)},`);
      lines.push(`  ${esc(quiz.wrongExplanation ?? null)},`);
      lines.push(`  ${escInt(quiz.quizPosition ?? null)},`);
      lines.push(`  NOW()`);
      lines.push(`);`);
      lines.push('');

      for (const opt of quiz.options) {
        const optId = randomId();
        lines.push(`INSERT INTO "QuizOption" (id, "quizId", "optionLabel", "optionText", "order") VALUES (`);
        lines.push(`  ${esc(optId)}, ${esc(quizId)}, ${esc(opt.label)}, ${esc(opt.text)}, ${opt.order}`);
        lines.push(`);`);
      }
      lines.push('');
    }

    blocks.push(lines.join('\n'));
  }

  return blocks.join('\n');
}

module.exports = { generateSql };

// ════════════════════════════════════════════════════════════════════════════
// LESSON DEFINITIONS — edit below, then run: node scripts/lesson-to-sql.cjs
// ════════════════════════════════════════════════════════════════════════════

// Paste your HTML card strings here:
const CARD_1 = `<section class="w-full bg-[#FEF9D7]" style="min-height:100%">
  <!-- replace with real card HTML -->
</section>`;

const LESSONS = [
  // {
  //   lesson: {
  //     id:                'MODULE-1',
  //     module:            'MODULE',
  //     dayNumber:         1,
  //     title:             'Lesson Title',
  //     subtitle:          null,
  //     shortDescription:  'Short description.',
  //     objectives:        ['Objective 1', 'Objective 2'],
  //     estimatedMinutes:  3,
  //     teachesCategories: ['CATEGORY'],
  //     backgroundColor:   '#FEF9D7',
  //     ellipse77Color:    '#E0AC69',
  //     ellipse78Color:    '#F9C7A1',
  //   },
  //   segments: [
  //     { order: 1, contentType: 'TEXT', bodyText: '', customHtml: CARD_1 },
  //   ],
  //   quiz: null,
  //   // quiz: {
  //   //   question:         'Question?',
  //   //   correctAnswer:    'A',
  //   //   explanation:      'Correct explanation.',
  //   //   wrongExplanation: 'Wrong explanation.',
  //   //   quizPosition:     null,
  //   //   options: [
  //   //     { label: 'A', text: 'Option A', order: 1 },
  //   //     { label: 'B', text: 'Option B', order: 2 },
  //   //     { label: 'C', text: 'Option C', order: 3 },
  //   //     { label: 'D', text: 'Option D', order: 4 },
  //   //   ],
  //   // },
  // },
];

if (require.main === module) {
  if (LESSONS.length === 0) {
    console.error('No lessons defined. Edit the LESSONS array at the bottom of the script.');
    process.exit(1);
  }
  process.stdout.write(generateSql(LESSONS));
  process.stdout.write('\n');
}
