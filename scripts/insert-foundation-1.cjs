/**
 * insert-foundation-1.cjs
 * Lesson: FOUNDATION Day 1 — Why Kids Have Tantrums
 * Run: node scripts/insert-foundation-1.cjs
 */

require('dotenv').config();
const { PrismaClient } = require('@prisma/client');
const crypto = require('crypto');
const prisma = new PrismaClient();

function id() {
  return crypto.randomBytes(12).toString('base64').replace(/[+/=]/g, '').substring(0, 25);
}

// ─── Card 1: The Reality ─────────────────────────────────────────────────────
const CARD_1 = `<section class="w-full bg-[#FEF9D7] relative flex flex-col px-10 py-16 text-[#1A1A1A] overflow-hidden" style="min-height:100%">
  <div class="absolute top-0 right-0 w-64 h-auto transform translate-x-12 -translate-y-4">
    <svg viewBox="0 0 200 300" xmlns="http://www.w3.org/2000/svg">
      <path d="M0 100 Q40 0 100 20 Q140 40 120 120 L130 250 Q100 280 60 250 Z" fill="#E0AC69"></path>
      <g transform="translate(60, 40) rotate(15)">
        <rect x="0" y="20" width="50" height="100" rx="15" fill="white" stroke="#A5C9E1" stroke-width="4"></rect>
        <path d="M5 40 Q25 35 45 40" stroke="#A5C9E1" stroke-width="2" fill="none"></path>
        <path d="M10 10 L40 10 L35 -10 L15 -10 Z" fill="#F9C7A1"></path>
      </g>
    </svg>
  </div>
  <div class="relative z-10 mt-32 space-y-10">
    <div class="flex items-start space-x-3">
      <div class="w-3 h-3 bg-red-600 rounded-full mt-2 flex-shrink-0"></div>
      <p class="text-xl leading-snug">Tantrums are <span class="font-black uppercase">not bad behavior</span>. They are <span class="font-black uppercase text-red-600">overloaded emotions</span> in a small brain.</p>
    </div>
    <div class="flex items-start space-x-3">
      <div class="w-3 h-3 bg-red-600 rounded-full mt-2 flex-shrink-0"></div>
      <p class="text-xl leading-snug">Kids don't behave badly when they <span class="font-black uppercase">feel good</span>. They struggle when they feel <span class="font-black uppercase">overwhelmed, unseen</span>, or <span class="font-black uppercase">unable to cope</span>.</p>
    </div>
  </div>
  <div class="mt-auto -mb-16 -ml-4">
    <svg viewBox="0 0 300 300" xmlns="http://www.w3.org/2000/svg">
      <g transform="translate(100, 50)">
        <circle cx="50" cy="50" r="45" fill="#B08D82"></circle>
        <circle cx="20" cy="20" r="15" fill="#B08D82"></circle>
        <circle cx="80" cy="20" r="15" fill="#B08D82"></circle>
        <circle cx="50" cy="110" r="55" fill="#B08D82"></circle>
        <circle cx="50" cy="60" r="15" fill="#FDF4D0" opacity="0.4"></circle>
        <path d="M45 60 L50 65 L55 60" fill="none" stroke="#4B2C20" stroke-width="2"></path>
      </g>
      <path d="M150 300 Q180 200 280 250 L300 300 Z" fill="#4B2C20" opacity="0.9"></path>
      <path d="M220 230 Q250 210 280 250" fill="none" stroke="#E0AC69" stroke-width="30" stroke-linecap="round"></path>
    </svg>
  </div>
</section>`;

// ─── Card 2: What To Do Now ───────────────────────────────────────────────────
const CARD_2 = `<section class="w-full bg-[#E0E7FF] relative flex flex-col px-10 py-20 text-[#1E1B4B] overflow-hidden" style="min-height:100%">
  <div class="absolute top-0 left-0 w-full h-40 bg-white/40 blur-3xl opacity-50"></div>
  <div class="relative z-10 space-y-8">
    <div class="space-y-1">
      <span class="text-xs font-bold uppercase tracking-widest text-indigo-500">The Path Forward</span>
      <h1 class="text-4xl font-black leading-none uppercase">What to Do Now</h1>
    </div>
    <p class="text-2xl font-bold leading-tight">The fastest way to help your child is <span class="text-indigo-600">not</span> to explain more.</p>
    <div class="bg-white/60 p-8 rounded-[40px] border-2 border-white shadow-inner">
      <p class="text-3xl font-black text-center italic text-indigo-700">It's to connect first.</p>
    </div>
  </div>
  <div class="flex-grow flex items-end justify-center mb-10">
    <svg viewBox="0 0 400 300" xmlns="http://www.w3.org/2000/svg">
      <defs>
        <linearGradient id="bridgeGrad" x1="0%" y1="0%" x2="100%" y2="0%">
          <stop offset="0%" stop-color="#818CF8"></stop>
          <stop offset="100%" stop-color="#C084FC"></stop>
        </linearGradient>
      </defs>
      <circle cx="80" cy="220" r="50" fill="#1E1B4B" opacity="0.05"></circle>
      <circle cx="320" cy="180" r="40" fill="#1E1B4B" opacity="0.05"></circle>
      <path d="M80 220 Q200 100 320 180" fill="none" stroke="url(#bridgeGrad)" stroke-width="8" stroke-dasharray="1,15" stroke-linecap="round"></path>
      <path d="M80 200 Q90 180 100 200 Q110 220 80 240 Q50 220 60 200 Q70 180 80 200" fill="#818CF8"></path>
      <g transform="translate(300, 150)">
        <circle cx="20" cy="0" r="15" fill="#C084FC"></circle>
        <path d="M0 30 Q20 10 40 30" fill="none" stroke="#C084FC" stroke-width="5" stroke-linecap="round"></path>
      </g>
    </svg>
  </div>
</section>`;

// ─── Card 3: Emotional Massage ────────────────────────────────────────────────
const CARD_3 = `<section class="w-full bg-[#F97316] relative flex flex-col px-10 py-20 text-white overflow-hidden" style="min-height:100%">
  <div class="absolute top-0 right-0 w-64 h-64 bg-yellow-400 rounded-full blur-3xl opacity-20 -translate-y-1/2 translate-x-1/4"></div>
  <div class="relative z-10 space-y-8">
    <h1 class="text-3xl font-black leading-tight">Try this today during your 5 mins Emotional Massage:</h1>
    <ul class="space-y-4">
      <li class="flex items-center space-x-4 bg-black/10 p-4 rounded-2xl border border-white/10">
        <div class="w-2 h-2 rounded-full bg-yellow-300"></div>
        <span class="text-lg font-bold">Follow their lead</span>
      </li>
      <li class="flex items-center space-x-4 bg-black/10 p-4 rounded-2xl border border-white/10">
        <div class="w-2 h-2 rounded-full bg-yellow-300"></div>
        <span class="text-lg font-bold">Don't teach or correct</span>
      </li>
      <li class="flex items-center space-x-4 bg-black/10 p-4 rounded-2xl border border-white/10">
        <div class="w-2 h-2 rounded-full bg-yellow-300"></div>
        <span class="text-lg font-bold">Just describe what they do</span>
      </li>
      <li class="flex items-center space-x-4 bg-black/10 p-4 rounded-2xl border border-white/10">
        <div class="w-2 h-2 rounded-full bg-yellow-300"></div>
        <span class="text-lg font-bold">Be fully present.</span>
      </li>
    </ul>
  </div>
  <div class="flex-grow flex items-end justify-center mb-12">
    <svg viewBox="0 0 400 300" xmlns="http://www.w3.org/2000/svg">
      <g transform="translate(150, 200)">
        <rect x="0" y="30" width="40" height="40" fill="white" opacity="0.9" rx="4"></rect>
        <rect x="45" y="10" width="30" height="60" fill="white" opacity="0.7" rx="4"></rect>
        <circle cx="20" cy="10" r="15" fill="white" opacity="0.5"></circle>
      </g>
      <g transform="translate(200, 100)">
        <path d="M-80 0 Q0 -60 80 0 Q0 60 -80 0" fill="none" stroke="white" stroke-width="2" opacity="0.3"></path>
        <circle cx="0" cy="0" r="30" fill="none" stroke="white" stroke-width="4"></circle>
        <circle cx="0" cy="0" r="12" fill="white"></circle>
        <line x1="0" y1="40" x2="0" y2="80" stroke="white" stroke-width="2" stroke-dasharray="4,4" opacity="0.6"></line>
      </g>
    </svg>
  </div>
</section>`;

// ─── Runner ───────────────────────────────────────────────────────────────────

async function run() {
  const LESSON_ID = 'FOUNDATION-1';

  console.log(`Inserting lesson ${LESSON_ID}…`);

  await prisma.$transaction(async (tx) => {

    // 1. Lesson
    await tx.lesson.upsert({
      where: { id: LESSON_ID },
      update: {
        title:             'Why Kids Have Tantrums',
        subtitle:          null,
        shortDescription:  'Understand why kids melt down — and the one thing that helps most.',
        objectives:        ['Understand what drives tantrums and non-listening', 'Learn to connect before correcting', 'Try the 5-min Emotional Massage today'],
        estimatedMinutes:  3,
        teachesCategories: ['EMOTIONS'],
        backgroundColor:   '#FEF9D7',
        ellipse77Color:    '#E0AC69',
        ellipse78Color:    '#F9C7A1',
        updatedAt:         new Date(),
      },
      create: {
        id:                LESSON_ID,
        module:            'FOUNDATION',
        dayNumber:         1,
        title:             'Why Kids Have Tantrums',
        subtitle:          null,
        shortDescription:  'Understand why kids melt down — and the one thing that helps most.',
        objectives:        ['Understand what drives tantrums and non-listening', 'Learn to connect before correcting', 'Try the 5-min Emotional Massage today'],
        estimatedMinutes:  3,
        teachesCategories: ['EMOTIONS'],
        backgroundColor:   '#FEF9D7',
        ellipse77Color:    '#E0AC69',
        ellipse78Color:    '#F9C7A1',
        updatedAt:         new Date(),
      },
    });

    // 2. Segments (wipe + recreate)
    await tx.lessonSegment.deleteMany({ where: { lessonId: LESSON_ID } });

    const segments = [
      { order: 1, contentType: 'TEXT', bodyText: '', customHtml: CARD_1 },
      { order: 2, contentType: 'TEXT', bodyText: '', customHtml: CARD_2 },
      { order: 3, contentType: 'TEXT', bodyText: '', customHtml: CARD_3 },
    ];

    for (const seg of segments) {
      await tx.lessonSegment.create({
        data: {
          id:           id(),
          lessonId:     LESSON_ID,
          order:        seg.order,
          sectionTitle: null,
          contentType:  seg.contentType,
          bodyText:     seg.bodyText,
          customHtml:   seg.customHtml,
          updatedAt:    new Date(),
        },
      });
    }

    // 3. Quiz
    await tx.quiz.deleteMany({ where: { lessonId: LESSON_ID } });

    const quizId = id();
    await tx.quiz.create({
      data: {
        id:               quizId,
        lessonId:         LESSON_ID,
        question:         'Your child melts down when you say "no". What\'s MOST likely happening?',
        correctAnswer:    'C',
        explanation:      'Yes — when a child feels overwhelmed, they lose access to self-control, listening, and reasoning. At that moment, they don\'t need correction first. They need help coming back to calm.',
        wrongExplanation: 'It can feel like your child is being naughty, defiant, or disrespectful. But most young children aren\'t trying to misbehave on purpose. When emotions take over, their brain is not in "thinking mode" — it\'s in "survival mode."',
        quizPosition:     null,
        updatedAt:        new Date(),
      },
    });

    const options = [
      { label: 'A', text: 'Being naughty',      order: 1 },
      { label: 'B', text: 'Trying to control',  order: 2 },
      { label: 'C', text: 'Overwhelmed',         order: 3 },
      { label: 'D', text: 'Disrespectful',       order: 4 },
    ];

    for (const opt of options) {
      await tx.quizOption.create({
        data: { id: id(), quizId, optionLabel: opt.label, optionText: opt.text, order: opt.order },
      });
    }

    console.log('✓ 3 segments + quiz inserted');
  });

  await prisma.$disconnect();
  console.log('Done.');
}

run().catch(async (e) => {
  console.error(e);
  await prisma.$disconnect();
  process.exit(1);
});
