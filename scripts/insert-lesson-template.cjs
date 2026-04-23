/**
 * insert-lesson-template.cjs
 *
 * Template for inserting one or more lessons into the dev database.
 * Usage: node scripts/insert-lesson-template.cjs
 *
 * Instructions:
 *   1. Duplicate the LESSON block below for each lesson you want to insert.
 *   2. Fill in all values marked with <...>.
 *   3. Remove the Quiz block if the lesson has no quiz.
 *   4. Run: node scripts/insert-lesson-template.cjs
 */

require('dotenv').config();
const { PrismaClient } = require('@prisma/client');
const crypto = require('crypto');
const prisma = new PrismaClient();

function id() {
  return crypto.randomBytes(12).toString('base64').replace(/[+/=]/g, '').substring(0, 25);
}

function lessonId(module, day) {
  return `${module}-${day}`;
}

// ============================================================================
// LESSON DEFINITIONS
// Duplicate this block for each lesson. Each lesson is upserted so the
// script is safe to re-run (won't create duplicates).
// ============================================================================

const LESSONS = [

  // ── LESSON 1 ──────────────────────────────────────────────────────────────
  {
    lesson: {
      id:                lessonId('EMOTIONS', 1),   // format: MODULE-dayNumber
      module:            'EMOTIONS',                 // see LessonModule enum in schema
      dayNumber:         1,                          // unique per module
      title:             'Lesson Title',
      subtitle:          null,                       // or 'Subtitle text'
      shortDescription:  'Short description shown on the lesson card.',
      objectives:        ['Objective 1', 'Objective 2'],
      estimatedMinutes:  3,
      teachesCategories: ['category1'],
      backgroundColor:   '#E4E4FF',
      ellipse77Color:    '#9BD4DF',
      ellipse78Color:    '#A6E0CB',
    },

    segments: [
      {
        order:        1,
        sectionTitle: null,                          // or 'Section heading'
        contentType:  'TEXT',                        // TEXT | TIP | EXAMPLE | SCRIPT | CALLOUT | TEXT_INPUT
        bodyText:     'Body text for segment 1.',
        customHtml:   null,                          // or paste HTML string
      },
      {
        order:        2,
        sectionTitle: 'Section Heading',
        contentType:  'TIP',
        bodyText:     'Body text for segment 2.',
        customHtml:   null,
      },
      {
        order:        3,
        sectionTitle: null,
        contentType:  'TEXT',
        bodyText:     'Body text for segment 3.',
        customHtml:   null,
      },
    ],

    // Set quiz: null if there is no quiz for this lesson
    quiz: {
      question:         'Quiz question?',
      correctAnswer:    'A',                         // must match one of the option labels below
      explanation:      'Explanation shown for the correct answer.',
      wrongExplanation: null,                        // or 'Explanation shown for wrong answers'
      quizPosition:     null,                        // null = after all segments; 0 = before first; N = after segment N
      options: [
        { label: 'A', text: 'First option',  order: 1 },
        { label: 'B', text: 'Second option', order: 2 },
        { label: 'C', text: 'Third option',  order: 3 },
        { label: 'D', text: 'Fourth option', order: 4 },
      ],
    },
  },

  // ── LESSON 2 ──────────────────────────────────────────────────────────────
  // (copy the block above and fill in)

];

// ============================================================================
// RUNNER — do not edit below this line
// ============================================================================

async function run() {
  console.log(`Inserting ${LESSONS.length} lesson(s)...\n`);

  for (const def of LESSONS) {
    const { lesson, segments, quiz } = def;

    console.log(`→ ${lesson.id}: ${lesson.title}`);

    await prisma.$transaction(async (tx) => {

      // Upsert lesson
      await tx.lesson.upsert({
        where: { id: lesson.id },
        update: { ...lesson, updatedAt: new Date() },
        create: { ...lesson, updatedAt: new Date() },
      });

      // Delete existing segments and re-insert (clean slate)
      await tx.lessonSegment.deleteMany({ where: { lessonId: lesson.id } });

      for (const seg of segments) {
        await tx.lessonSegment.create({
          data: {
            id:           id(),
            lessonId:     lesson.id,
            order:        seg.order,
            sectionTitle: seg.sectionTitle ?? null,
            contentType:  seg.contentType,
            bodyText:     seg.bodyText,
            customHtml:   seg.customHtml ?? null,
            updatedAt:    new Date(),
          },
        });
      }

      // Quiz
      if (quiz) {
        const existingQuiz = await tx.quiz.findUnique({ where: { lessonId: lesson.id } });

        const quizId = existingQuiz?.id ?? id();

        await tx.quiz.upsert({
          where:  { lessonId: lesson.id },
          update: { question: quiz.question, correctAnswer: quiz.correctAnswer, explanation: quiz.explanation, wrongExplanation: quiz.wrongExplanation ?? null, quizPosition: quiz.quizPosition ?? null, updatedAt: new Date() },
          create: { id: quizId, lessonId: lesson.id, question: quiz.question, correctAnswer: quiz.correctAnswer, explanation: quiz.explanation, wrongExplanation: quiz.wrongExplanation ?? null, quizPosition: quiz.quizPosition ?? null, updatedAt: new Date() },
        });

        await tx.quizOption.deleteMany({ where: { quizId } });

        for (const opt of quiz.options) {
          await tx.quizOption.create({
            data: { id: id(), quizId, optionLabel: opt.label, optionText: opt.text, order: opt.order },
          });
        }
      }

      console.log(`   ✓ ${segments.length} segment(s)${quiz ? ' + quiz' : ''}`);
    });
  }

  console.log('\nDone.');
  await prisma.$disconnect();
}

run().catch(async (e) => {
  console.error(e);
  await prisma.$disconnect();
  process.exit(1);
});
