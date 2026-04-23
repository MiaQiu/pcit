/**
 * insert-getting-started-3.cjs
 * Lesson: GETTING_STARTED Day 3 — Why do small daily moments change behavior at the root?
 * Run: node scripts/insert-getting-started-3.cjs
 */

require('dotenv').config();
const { PrismaClient } = require('@prisma/client');
const crypto = require('crypto');
const prisma = new PrismaClient();

function id() {
  return crypto.randomBytes(12).toString('base64').replace(/[+/=]/g, '').substring(0, 25);
}

// ─── CARD 1: Cover — Why do small daily moments… ──────────────────────────────
const CARD_1 = `<section class="w-full bg-[#D1F2F9] relative flex flex-col px-10 py-16 text-[#1A3A42] overflow-hidden" style="min-height:100%">
  <div class="absolute inset-0 z-0 opacity-60">
    <svg viewBox="0 0 400 800" class="w-full h-full">
      <defs>
        <linearGradient id="seaGradCover" x1="0%" y1="0%" x2="0%" y2="100%">
          <stop offset="0%" stop-color="#E0F7FA"></stop>
          <stop offset="100%" stop-color="#81D4FA"></stop>
        </linearGradient>
      </defs>
      <path d="M0 450 Q100 420 200 450 T400 450 L400 800 L0 800 Z" fill="url(#seaGradCover)"></path>
      <circle cx="50" cy="500" r="220" fill="none" stroke="white" stroke-width="25" opacity="0.3"></circle>
      <circle cx="50" cy="500" r="180" fill="none" stroke="white" stroke-width="15" opacity="0.2"></circle>
    </svg>
  </div>
  <div class="relative z-10 space-y-4 pt-10">
    <h1 class="text-5xl font-black leading-[0.9] uppercase tracking-tighter">Why do <br/>small daily <br/>moments...</h1>
    <p class="text-3xl italic text-[#F472B6]" style="font-family: serif; font-weight: 700;">change behavior at the root?</p>
  </div>
  <div class="mt-auto mb-10 flex justify-center z-10">
    <svg viewBox="0 0 400 450" class="w-full h-auto">
      <g transform="translate(120, 180)">
        <path d="M0 120 Q30 -10 90 20 Q120 40 120 120 L120 220 Q60 240 0 210 Z" fill="#E0AC69" opacity="0.9"></path>
        <path d="M10 80 C-10 20, 60 0, 100 40 S130 100, 110 140" fill="none" stroke="#4B2C20" stroke-width="18" stroke-linecap="round" opacity="0.8"></path>
        <g transform="translate(85, 90) scale(0.6)">
          <path d="M0 100 C0 10, 100 10, 100 100 L100 160 L0 160 Z" fill="#F4D03F"></path>
          <circle cx="50" cy="35" r="40" fill="#E0AC69"></circle>
          <path d="M20 20 Q50 -10 80 20" fill="none" stroke="#4B2C20" stroke-width="12" stroke-linecap="round"></path>
        </g>
        <g transform="translate(110, 0)">
          <ellipse cx="20" cy="-45" rx="22" ry="28" fill="#F472B6"></ellipse>
          <ellipse cx="55" cy="-25" rx="18" ry="24" fill="#F4D03F"></ellipse>
          <ellipse cx="-15" cy="-70" rx="20" ry="26" fill="#4DA1B0"></ellipse>
          <circle cx="12" cy="-55" r="5" fill="white" opacity="0.3"></circle>
          <path d="M0 0 Q5 -20 20 -45 M0 0 Q30 -15 55 -25 M0 0 Q-10 -30 -15 -70" stroke="#1A3A42" stroke-width="1" opacity="0.2" fill="none"></path>
        </g>
      </g>
    </svg>
  </div>
</section>`;

// ─── CARD 2: Manage vs. Reduce ────────────────────────────────────────────────
const CARD_2 = `<section class="w-full bg-[#F0FDF4] relative flex flex-col px-10 py-20 text-[#166534] overflow-hidden" style="min-height:100%">
  <div class="relative z-10 space-y-8">
    <h2 class="text-4xl font-black uppercase leading-none tracking-tighter">Manage <br/>vs. <span class="text-[#10B981]">Reduce</span></h2>
    <div class="space-y-6">
      <p class="text-2xl font-bold leading-tight opacity-90">You don't only need to manage behavior when it happens.</p>
      <div class="bg-white/60 p-8 rounded-[40px] border-2 border-[#BBF7D0] shadow-sm transform -rotate-1">
        <p class="text-2xl font-black leading-tight italic">You can reduce how often it happens by supporting them in small moments.</p>
      </div>
    </div>
  </div>
  <div class="mt-auto mb-10 flex justify-center">
    <svg viewBox="0 0 400 350" class="w-full h-auto">
      <g transform="translate(200, 180)">
        <circle cx="0" cy="0" r="100" fill="none" stroke="#166534" stroke-width="1" stroke-dasharray="10,10" opacity="0.1"></circle>
        <path d="M-130 50 Q0 -50 130 50" fill="none" stroke="#10B981" stroke-width="3" opacity="0.3" stroke-linecap="round"></path>
        <circle cx="-130" cy="50" r="15" fill="#10B981" opacity="0.2"></circle>
        <circle cx="130" cy="50" r="10" fill="#F472B6" opacity="0.4"></circle>
        <text x="-35" y="10" fill="#166534" font-size="12" font-weight="bold" opacity="0.4">Root Care</text>
      </g>
    </svg>
  </div>
</section>`;

// ─── CARD 3: The Build Up ─────────────────────────────────────────────────────
const CARD_3 = `<section class="w-full bg-[#FFFBEB] relative flex flex-col px-10 py-20 text-[#92400E] overflow-hidden" style="min-height:100%">
  <div class="relative z-10 space-y-6">
    <h2 class="text-4xl font-black uppercase leading-none tracking-tighter">The build up</h2>
    <p class="text-2xl font-medium leading-snug">Most behavior challenges build up during the <span class="font-bold underline decoration-[#D95D39] underline-offset-8">everyday rush.</span></p>
    <div class="bg-[#D95D39]/10 p-7 rounded-[40px] border-l-8 border-[#D95D39] shadow-inner">
      <p class="text-2xl font-black italic leading-tight">"They are trying to get more of you in the day."</p>
    </div>
  </div>
  <div class="mt-auto mb-10 flex justify-center">
    <svg viewBox="0 0 400 400" class="w-full h-auto">
      <g transform="translate(200, 350)">
        <rect x="-40" y="-50" width="80" height="50" rx="8" fill="#D95D39" opacity="0.9"></rect>
        <g transform="rotate(-6, 0, -50)">
          <rect x="-30" y="-110" width="60" height="60" rx="10" fill="#F4D03F" opacity="0.9"></rect>
          <circle cx="0" cy="-140" r="30" fill="#76A19E" opacity="0.8"></circle>
          <circle cx="60" cy="-100" r="6" fill="#D95D39" opacity="0.4"></circle>
        </g>
      </g>
    </svg>
  </div>
</section>`;

// ─── CARD 4: The Common Mistake ───────────────────────────────────────────────
const CARD_4 = `<section class="w-full bg-[#E0F2F7] relative flex flex-col px-10 py-20 text-[#204E59] overflow-hidden" style="min-height:100%">
  <div class="relative z-10 space-y-10">
    <h2 class="text-4xl font-black uppercase leading-none tracking-tighter">The common <br/>mistake</h2>
    <div class="bg-[#1A3A42] p-10 rounded-[60px] text-white shadow-2xl relative overflow-hidden">
      <div class="absolute top-0 right-0 w-32 h-32 bg-white/5 rounded-full blur-2xl -translate-y-1/2 translate-x-1/2"></div>
      <p class="text-2xl font-black leading-tight italic">"I spend all day with them... why the issues?"</p>
    </div>
    <p class="text-2xl font-bold leading-snug text-center opacity-80">Children don't just need presence — they need to be <span class="text-[#EF845D] font-black uppercase tracking-widest">noticed.</span></p>
  </div>
  <div class="mt-auto mb-10 flex justify-center">
    <svg viewBox="0 0 400 350" class="w-full h-auto">
      <g transform="translate(200, 180)">
        <path d="M-150 0 Q0 -120 150 0 Q0 120 -150 0" fill="none" stroke="#204E59" stroke-width="2" opacity="0.2"></path>
        <circle cx="0" cy="0" r="45" fill="#4DA1B0" opacity="0.2"></circle>
        <circle cx="0" cy="0" r="15" fill="#EF845D"></circle>
        <g stroke="#EF845D" stroke-width="2" stroke-dasharray="4,4" opacity="0.4">
          <line x1="0" y1="-60" x2="0" y2="-120"></line>
          <line x1="60" y1="-30" x2="110" y2="-60"></line>
          <line x1="-60" y1="-30" x2="-110" y2="-60"></line>
        </g>
      </g>
    </svg>
  </div>
</section>`;

// ─── CARD 5: Prevent the Build Up ────────────────────────────────────────────
const CARD_5 = `<section class="w-full bg-[#FDF4E3] relative flex flex-col px-10 py-16 text-[#1A3A42] overflow-hidden" style="min-height:100%">
  <div class="relative z-10 space-y-6 pt-10">
    <h2 class="text-4xl font-black uppercase leading-none tracking-tighter">Prevent <br/>the build up</h2>
    <p class="text-2xl italic text-[#F472B6]" style="font-family: serif; font-weight: 700;">The 5-minute magic...</p>
    <p class="text-xl font-medium opacity-90 leading-tight">Add a small daily <strong>emotional massage.</strong> These moments reduce the tension before it explodes.</p>
    <div class="bg-white/80 p-8 rounded-[48px] border-4 border-white shadow-xl text-center">
      <p class="text-2xl font-black italic leading-tight">A settled nervous system.</p>
    </div>
  </div>
  <div class="mt-auto mb-10 flex justify-center z-10">
    <svg viewBox="0 0 400 400" class="w-full h-auto">
      <g transform="translate(100, 180)">
        <ellipse cx="100" cy="180" rx="160" ry="40" fill="#B3E5FC" opacity="0.3"></ellipse>
        <path d="M10 160 C10 80, 70 60, 90 100 Q100 120 90 180" fill="#76A19E" opacity="0.9"></path>
        <circle cx="65" cy="85" r="30" fill="#E0AC69"></circle>
        <g transform="translate(130, 85)">
          <circle cx="0" cy="0" r="28" fill="#E0AC69"></circle>
          <path d="M-20 60 Q0 50 20 60 L20 100 L-20 100 Z" fill="#F4D03F"></path>
        </g>
        <path d="M110 50 Q115 40 120 50 Q125 60 110 75 Q95 60 100 50" fill="#F472B6"></path>
      </g>
    </svg>
  </div>
</section>`;

// ─── CARD 6: 3 Weeks — The Breakthrough ──────────────────────────────────────
const CARD_6 = `<section class="w-full bg-[#FFD780] relative flex flex-col px-10 py-16 text-[#4B2C20] overflow-hidden" style="min-height:100%">
  <div class="absolute top-0 right-0 w-[500px] h-[500px] bg-white/30 rounded-full blur-[100px] -translate-y-1/2 translate-x-1/2"></div>
  <div class="relative z-10 space-y-10 pt-10">
    <div class="space-y-1">
      <h2 class="text-8xl font-black text-[#D95D39] leading-none tracking-tighter">3 WEEKS</h2>
      <p class="text-xl font-black uppercase tracking-[0.6em] opacity-40">The Breakthrough</p>
    </div>
    <div class="space-y-6">
      <p class="text-3xl font-black italic text-[#4B2C20] leading-none">You don't always <br/>need to react less.</p>
      <div class="bg-white/40 p-8 rounded-[50px] border-4 border-white/50 shadow-2xl transform rotate-2">
        <p class="text-3xl font-black italic text-center text-[#D95D39]">You can prevent more.</p>
      </div>
    </div>
  </div>
  <div class="mt-auto mb-16 flex justify-center">
    <svg viewBox="0 0 400 350" class="w-full h-auto">
      <g transform="translate(50, 320)">
        <rect x="0" y="-30" width="80" height="20" rx="10" fill="#4B2C20" opacity="0.05"></rect>
        <rect x="70" y="-70" width="80" height="20" rx="10" fill="#4B2C20" opacity="0.1"></rect>
        <rect x="140" y="-110" width="80" height="20" rx="10" fill="#4B2C20" opacity="0.15"></rect>
        <g transform="translate(280, -220)">
          <circle cx="0" cy="0" r="60" fill="#EF845D" opacity="0.15"></circle>
          <circle cx="0" cy="0" r="35" fill="#D95D39"></circle>
          <path d="M0 -50 L10 -15 L40 -15 L10 5 L20 35 L0 15 L-20 35 L-10 5 L-40 -15 L-10 -15 Z" fill="white" opacity="0.5"></path>
        </g>
      </g>
    </svg>
  </div>
</section>`;

// ─── Runner ───────────────────────────────────────────────────────────────────

const LESSON_ID = 'GETTING_STARTED-3';

const segments = [
  { order: 1, contentType: 'TEXT', bodyText: '', customHtml: CARD_1 },
  { order: 2, contentType: 'TEXT', bodyText: '', customHtml: CARD_2 },
  { order: 3, contentType: 'TEXT', bodyText: '', customHtml: CARD_3 },
  { order: 4, contentType: 'TEXT', bodyText: '', customHtml: CARD_4 },
  { order: 5, contentType: 'TEXT', bodyText: '', customHtml: CARD_5 },
  { order: 6, contentType: 'TEXT', bodyText: '', customHtml: CARD_6 },
];

async function run() {
  console.log(`Inserting lesson ${LESSON_ID}…`);

  await prisma.$transaction(async (tx) => {
    await tx.lesson.upsert({
      where: { id: LESSON_ID },
      update: {
        title:             'Why do small daily moments change behavior at the root?',
        subtitle:          null,
        shortDescription:  'Discover why 5 minutes of daily connection prevents more tantrums than any reaction strategy.',
        objectives:        [
          'Understand the difference between managing and reducing behavior',
          'See how unmet connection builds up into outbursts',
          'Learn how small daily moments change behavior at the root',
        ],
        estimatedMinutes:  4,
        teachesCategories: ['EMOTIONS'],
        backgroundColor:   '#D1F2F9',
        ellipse77Color:    '#4DA1B0',
        ellipse78Color:    '#F472B6',
        updatedAt:         new Date(),
      },
      create: {
        id:                LESSON_ID,
        module:            'GETTING_STARTED',
        dayNumber:         3,
        title:             'Why do small daily moments change behavior at the root?',
        subtitle:          null,
        shortDescription:  'Discover why 5 minutes of daily connection prevents more tantrums than any reaction strategy.',
        objectives:        [
          'Understand the difference between managing and reducing behavior',
          'See how unmet connection builds up into outbursts',
          'Learn how small daily moments change behavior at the root',
        ],
        estimatedMinutes:  4,
        teachesCategories: ['EMOTIONS'],
        backgroundColor:   '#D1F2F9',
        ellipse77Color:    '#4DA1B0',
        ellipse78Color:    '#F472B6',
        updatedAt:         new Date(),
      },
    });

    await tx.lessonSegment.deleteMany({ where: { lessonId: LESSON_ID } });

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

    await tx.quiz.deleteMany({ where: { lessonId: LESSON_ID } });

    console.log(`✓ ${segments.length} segments inserted (no quiz)`);
  });

  await prisma.$disconnect();
  console.log('Done.');
}

run().catch(async (e) => {
  console.error(e);
  await prisma.$disconnect();
  process.exit(1);
});
