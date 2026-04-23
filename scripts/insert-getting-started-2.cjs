/**
 * insert-getting-started-2.cjs
 * Lesson: GETTING_STARTED Day 2 — What to do DURING a tantrum
 * Run: node scripts/insert-getting-started-2.cjs
 */

require('dotenv').config();
const { PrismaClient } = require('@prisma/client');
const crypto = require('crypto');
const prisma = new PrismaClient();

function id() {
  return crypto.randomBytes(12).toString('base64').replace(/[+/=]/g, '').substring(0, 25);
}

// ─── CARD 1: During a tantrum ─────────────────────────────────────────────────
const CARD_1 = `<section class="w-full bg-[#E0F2F7] relative flex flex-col px-10 py-16 text-[#204E59] overflow-hidden" style="min-height:100%">
  <div class="absolute top-0 right-0 w-80 h-80 bg-white/40 rounded-full blur-3xl -translate-y-1/2 translate-x-1/2"></div>
  <div class="relative z-10 space-y-8">
    <div class="space-y-2">
      <span class="uppercase tracking-[0.3em] text-[12px] font-bold text-[#4DA1B0]">Phase: Meltdown</span>
      <h1 class="text-5xl font-black leading-none uppercase tracking-tighter">During a <br/>tantrum</h1>
    </div>
    <div class="space-y-6">
      <p class="text-2xl font-medium leading-tight">Your goal is <span class="text-[#D95D39] font-black underline decoration-4 underline-offset-4">not</span> to fix behavior.</p>
      <div class="bg-white/60 p-6 rounded-[32px] border border-white shadow-sm backdrop-blur-sm">
        <p class="text-3xl font-black leading-tight italic">Help their brain come back online.</p>
      </div>
    </div>
  </div>
  <div class="mt-auto mb-10 flex justify-center">
    <svg viewBox="0 0 400 400" class="w-full h-auto">
      <path d="M100 300 Q200 270 300 300 L280 320 Q200 330 120 320 Z" fill="#204E59" opacity="0.1"></path>
      <g transform="translate(140, 100)">
        <rect x="40" y="50" width="40" height="120" fill="#4DA1B0" opacity="0.3" rx="4"></rect>
        <path d="M30 50 L90 50 L60 20 Z" fill="#204E59" opacity="0.2"></path>
        <path d="M60 40 L-100 -50 L220 -50 Z" fill="#FFF" opacity="0.4"></path>
        <circle cx="60" cy="40" r="15" fill="#FFF"></circle>
      </g>
    </svg>
  </div>
</section>`;

// ─── CARD 2: What's happening ─────────────────────────────────────────────────
const CARD_2 = `<section class="w-full bg-[#F5F3FF] relative flex flex-col px-10 py-16 text-[#4338CA] overflow-hidden" style="min-height:100%">
  <div class="absolute top-1/2 left-0 w-full h-full bg-indigo-100/30 blur-3xl"></div>
  <div class="relative z-10 space-y-8">
    <h1 class="text-5xl font-black uppercase tracking-tighter leading-none">What's <br/>happening</h1>
    <p class="text-3xl font-bold leading-tight">The thinking brain is <span class="text-[#EF4444] font-black uppercase">"offline"</span></p>
    <div class="space-y-4">
      <div class="flex items-center space-x-4 bg-white/50 p-4 rounded-2xl border border-white shadow-sm">
        <span class="text-3xl">⛈️</span>
        <span class="text-xl font-black opacity-80 uppercase tracking-tight">they can't listen</span>
      </div>
      <div class="flex items-center space-x-4 bg-white/50 p-4 rounded-2xl border border-white shadow-sm">
        <span class="text-3xl">⛈️</span>
        <span class="text-xl font-black opacity-80 uppercase tracking-tight">they can't learn</span>
      </div>
      <div class="flex items-center space-x-4 bg-white/50 p-4 rounded-2xl border border-white shadow-sm">
        <span class="text-3xl">⛈️</span>
        <span class="text-xl font-black opacity-80 uppercase tracking-tight">they can't reason</span>
      </div>
    </div>
  </div>
  <div class="mt-auto mb-10 flex justify-center">
    <svg viewBox="0 0 400 400" class="w-full h-auto">
      <g transform="translate(150, 150)">
        <rect x="-100" y="-40" width="200" height="80" rx="10" fill="#4338CA" opacity="0.1"></rect>
        <rect x="35" y="80" width="30" height="50" rx="4" fill="#4338CA" opacity="0.3" transform="rotate(-45 50 100)"></rect>
        <rect x="-40" y="-20" width="20" height="20" rx="4" fill="#EF4444" opacity="0.4"></rect>
        <circle cx="140" cy="20" r="10" fill="#EF4444" opacity="0.4"></circle>
      </g>
    </svg>
  </div>
</section>`;

// ─── CARD 3: Common mistake ───────────────────────────────────────────────────
const CARD_3 = `<section class="w-full bg-[#FFF1F0] relative flex flex-col px-10 py-16 text-[#991B1B] overflow-hidden" style="min-height:100%">
  <div class="relative z-10 space-y-8">
    <h1 class="text-5xl font-black uppercase tracking-tighter leading-[0.9]">Common <br/>mistake</h1>
    <div class="space-y-5">
      <div class="text-3xl font-black bg-white/50 p-6 rounded-[40px] border-2 border-white italic shadow-sm text-center">"Stop crying."</div>
      <div class="text-3xl font-black bg-white/50 p-6 rounded-[40px] border-2 border-white italic shadow-sm text-center">"Calm down."</div>
      <div class="text-3xl font-black bg-white/50 p-6 rounded-[40px] border-2 border-white italic shadow-sm text-center">"Use your words."</div>
    </div>
    <p class="text-2xl font-bold leading-tight">👉 These require a child who is <span class="text-[#F59E0B] font-black uppercase">already calm</span>.</p>
  </div>
  <div class="mt-auto mb-12 flex justify-center">
    <svg viewBox="0 0 400 300" class="w-full h-auto">
      <g transform="translate(200, 150)">
        <path d="M-100 -50 Q-50 -100 0 -50 L20 0 L-120 0 Z" fill="#991B1B" opacity="0.1"></path>
        <rect x="-40" y="40" width="80" height="40" rx="10" fill="#991B1B" opacity="0.2"></rect>
      </g>
    </svg>
  </div>
</section>`;

// ─── CARD 4: What helps ───────────────────────────────────────────────────────
const CARD_4 = `<section class="w-full bg-[#F0FDF4] relative flex flex-col px-10 py-16 text-[#166534] overflow-hidden" style="min-height:100%">
  <div class="relative z-10 space-y-8">
    <h1 class="text-6xl font-black uppercase tracking-tighter leading-none">What <br/>helps</h1>
    <div class="space-y-4">
      <div class="bg-[#BBF7D0]/50 p-5 rounded-3xl border border-[#BBF7D0] flex items-center space-x-4">
        <div class="w-4 h-4 rounded-full bg-[#166534] opacity-30"></div>
        <span class="text-2xl font-black uppercase tracking-tight">stay close</span>
      </div>
      <div class="bg-[#BBF7D0]/50 p-5 rounded-3xl border border-[#BBF7D0] flex items-center space-x-4">
        <div class="w-4 h-4 rounded-full bg-[#166534] opacity-30"></div>
        <span class="text-2xl font-black uppercase tracking-tight">stay calm</span>
      </div>
      <div class="bg-[#BBF7D0]/50 p-5 rounded-3xl border border-[#BBF7D0] flex items-center space-x-4">
        <div class="w-4 h-4 rounded-full bg-[#166534] opacity-30"></div>
        <span class="text-2xl font-black uppercase tracking-tight">steady words</span>
      </div>
    </div>
    <div class="bg-white/90 p-8 rounded-[48px] border-2 border-white shadow-xl mt-4 transform -rotate-1">
      <p class="text-center italic font-black text-3xl leading-tight">"I'm here. <br/>You're safe."</p>
    </div>
  </div>
  <div class="mt-auto mb-6 flex justify-center">
    <svg viewBox="0 0 400 400" class="w-full h-auto">
      <circle cx="200" cy="200" r="140" fill="#BBF7D0" opacity="0.2"></circle>
      <g transform="translate(140, 160)">
        <path d="M0 100 Q40 0 100 20 Q120 40 120 100 L120 180 Q60 200 0 180 Z" fill="#166534" opacity="0.1"></path>
      </g>
    </svg>
  </div>
</section>`;

// ─── CARD 5: Key shift ────────────────────────────────────────────────────────
const CARD_5 = `<section class="w-full bg-[#FFFBEB] relative flex flex-col px-10 py-16 text-[#92400E] overflow-hidden" style="min-height:100%">
  <div class="relative z-10 space-y-12">
    <div class="space-y-1">
      <h1 class="text-6xl font-black uppercase leading-none tracking-tighter">Key <br/>shift</h1>
      <div class="h-3 w-20 bg-[#92400E] rounded-full"></div>
    </div>
    <div class="space-y-12">
      <div class="bg-[#D95D39] text-white p-8 rounded-[48px] shadow-xl transform -rotate-2">
        <p class="text-4xl font-black italic tracking-tighter leading-none">1. Connection first.</p>
      </div>
      <div class="bg-white/60 p-8 rounded-[48px] border-2 border-[#92400E]/20 text-[#92400E] transform rotate-1">
        <p class="text-3xl font-black italic opacity-60 leading-none">2. Correction later.</p>
      </div>
    </div>
  </div>
  <div class="mt-auto mb-16 flex justify-center opacity-10">
    <svg viewBox="0 0 400 300" class="w-full h-auto">
      <path d="M200 250 Q100 150 100 100 Q100 50 200 50 Q300 50 300 100 Q300 150 200 250" fill="#D95D39"></path>
    </svg>
  </div>
</section>`;

// ─── CARD 6: What to expect ───────────────────────────────────────────────────
const CARD_6 = `<section class="w-full bg-[#FFF7ED] relative flex flex-col px-10 py-16 text-[#C2410C] overflow-hidden" style="min-height:100%">
  <div class="relative z-10 space-y-6">
    <h1 class="text-5xl font-black uppercase tracking-tighter leading-none">What to <br/>expect</h1>
    <div class="space-y-4">
      <div class="flex items-start space-x-3 bg-white/50 p-4 rounded-2xl border border-white shadow-sm">
        <div class="w-3 h-3 rounded-full mt-2 flex-shrink-0 bg-rose-500"></div>
        <span class="text-xl font-bold italic leading-tight uppercase tracking-tight">don't expect instant calm</span>
      </div>
      <div class="flex items-start space-x-3 bg-white/50 p-4 rounded-2xl border border-white shadow-sm">
        <div class="w-3 h-3 rounded-full mt-2 flex-shrink-0 bg-rose-500"></div>
        <span class="text-xl font-bold italic leading-tight uppercase tracking-tight">don't expect listening</span>
      </div>
      <div class="flex items-start space-x-3 bg-white/50 p-4 rounded-2xl border border-white shadow-sm">
        <div class="w-3 h-3 rounded-full mt-2 flex-shrink-0 bg-green-500"></div>
        <span class="text-xl font-bold italic leading-tight uppercase tracking-tight">expect gradual recovery</span>
      </div>
    </div>
    <div class="pt-6 space-y-4">
      <p class="text-sm font-black uppercase tracking-widest opacity-60">Over time:</p>
      <ul class="space-y-4">
        <li class="flex items-center space-x-4 text-2xl font-black leading-none">
          <span class="text-3xl">✨</span>
          <span class="tracking-tighter">meltdowns get shorter</span>
        </li>
        <li class="flex items-center space-x-4 text-2xl font-black leading-none">
          <span class="text-3xl">✨</span>
          <span class="tracking-tighter">recovery becomes faster</span>
        </li>
      </ul>
    </div>
    <div class="bg-[#C2410C] text-white p-7 rounded-[40px] shadow-xl mt-6 border-t-4 border-white/20">
      <p class="text-2xl font-black text-center leading-none uppercase tracking-tighter">cooperation improves <br/>after connection</p>
    </div>
  </div>
</section>`;

// ─── CARD 7: Try this next ────────────────────────────────────────────────────
const CARD_7 = `<section class="w-full bg-[#F0FDFA] relative flex flex-col px-10 py-16 text-[#0F766E] overflow-hidden" style="min-height:100%">
  <div class="relative z-10 space-y-12">
    <h1 class="text-5xl font-black uppercase tracking-tighter leading-none">Try this <br/>next</h1>
    <div class="space-y-10">
      <div class="space-y-4">
        <p class="text-xs font-black uppercase tracking-[0.4em] opacity-40">Pause and reflect:</p>
        <div class="bg-white p-10 rounded-[60px] border-4 border-[#99F6E4] shadow-2xl relative">
          <div class="absolute -top-4 -left-4 w-12 h-12 bg-[#99F6E4] rounded-full flex items-center justify-center text-white font-black text-2xl">"</div>
          <p class="text-3xl font-black text-center italic leading-tight tracking-tighter">Am I trying to teach, or help them calm?</p>
        </div>
      </div>
      <p class="text-2xl font-bold text-center opacity-80 leading-tight">Presence is the most powerful tool you own.</p>
    </div>
  </div>
  <div class="mt-auto mb-12 flex justify-center opacity-10">
    <svg viewBox="0 0 400 300" class="w-full h-auto">
      <circle cx="200" cy="150" r="100" fill="#99F6E4"></circle>
    </svg>
  </div>
</section>`;

// ─── RUNNER ───────────────────────────────────────────────────────────────────

async function run() {
  const LESSON_ID = 'GETTING_STARTED-2';

  console.log(`Inserting lesson ${LESSON_ID}…`);

  await prisma.$transaction(async (tx) => {

    // 1. Lesson
    await tx.lesson.upsert({
      where: { id: LESSON_ID },
      update: {
        title:             'What to do DURING a tantrum',
        subtitle:          null,
        shortDescription:  'Learn how to handle the "Offline Brain" phase and why connection must come before correction.',
        objectives:        ['Understand why children cannot listen during a meltdown', 'Identify common mistakes like "stop crying"', 'Practice the "Connection First" mantra'],
        estimatedMinutes:  4,
        teachesCategories: ['MANAGE_EMOTIONS'],
        backgroundColor:   '#E0F2F7',
        ellipse77Color:    '#4DA1B0',
        ellipse78Color:    '#D95D39',
        updatedAt:         new Date(),
      },
      create: {
        id:                LESSON_ID,
        module:            'GETTING_STARTED',
        dayNumber:         2,
        title:             'What to do DURING a tantrum',
        subtitle:          null,
        shortDescription:  'Learn how to handle the "Offline Brain" phase and why connection must come before correction.',
        objectives:        ['Understand why children cannot listen during a meltdown', 'Identify common mistakes like "stop crying"', 'Practice the "Connection First" mantra'],
        estimatedMinutes:  4,
        teachesCategories: ['MANAGE_EMOTIONS'],
        backgroundColor:   '#E0F2F7',
        ellipse77Color:    '#4DA1B0',
        ellipse78Color:    '#D95D39',
        updatedAt:         new Date(),
      },
    });

    // 2. Segments (wipe + recreate)
    await tx.lessonSegment.deleteMany({ where: { lessonId: LESSON_ID } });

    const segments = [
      { order: 1, customHtml: CARD_1 },
      { order: 2, customHtml: CARD_2 },
      { order: 3, customHtml: CARD_3 },
      { order: 4, customHtml: CARD_4 },
      { order: 5, customHtml: CARD_5 },
      { order: 6, customHtml: CARD_6 },
      { order: 7, customHtml: CARD_7 },
    ];

    for (const seg of segments) {
      await tx.lessonSegment.create({
        data: {
          id:           id(),
          lessonId:     LESSON_ID,
          order:        seg.order,
          sectionTitle: null,
          contentType:  'TEXT',
          bodyText:     '',
          customHtml:   seg.customHtml,
          updatedAt:    new Date(),
        },
      });
    }

    // 3. No quiz for this lesson
    await tx.quiz.deleteMany({ where: { lessonId: LESSON_ID } });

    console.log('✓ 7 segments inserted (no quiz)');
  });

  await prisma.$disconnect();
  console.log('Done.');
}

run().catch(async (e) => {
  console.error(e);
  await prisma.$disconnect();
  process.exit(1);
});
