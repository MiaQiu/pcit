/**
 * insert-getting-started-5.cjs
 * Lesson: GETTING_STARTED Day 5 — What to say (and not say)
 * Run: node scripts/insert-getting-started-5.cjs
 */

require('dotenv').config();
const { PrismaClient } = require('@prisma/client');
const crypto = require('crypto');
const prisma = new PrismaClient();

function id() {
  return crypto.randomBytes(12).toString('base64').replace(/[+/=]/g, '').substring(0, 25);
}

// ─── CARD 1: Title ────────────────────────────────────────────────────────────
const CARD_1 = `<section class="w-full bg-[#E9F5E9] relative flex flex-col text-[#1A3A42] overflow-hidden" style="min-height:100%">
  <div class="p-8 pt-24 space-y-6">
    <h1 class="text-5xl font-black leading-tight uppercase tracking-tighter">
      What to say <br/>and not to say <br/>
      <span class="text-[#7E22CE]">during Emotional <br/>Massage</span>
    </h1>
    <p class="text-2xl font-bold bg-[#7E22CE] text-white px-5 py-2 inline-block rounded-xl">
      (P.E.N. Skills)
    </p>
  </div>
  <div class="mt-auto mb-20 flex justify-center px-10">
    <svg viewBox="0 0 400 400" class="w-full h-auto drop-shadow-sm">
      <g transform="translate(100, 50)">
        <path d="M10 100 Q40 0 100 20 Q130 40 130 120 L130 200" fill="#A855F7"></path>
        <circle cx="70" cy="130" r="45" fill="#FEF3C7" opacity="0.8"></circle>
        <circle cx="50" cy="70" r="8" fill="#1A3A42"></circle>
        <circle cx="100" cy="70" r="8" fill="#1A3A42"></circle>
        <path d="M65 85 Q75 95 85 85" fill="none" stroke="#1A3A42" stroke-width="3" stroke-linecap="round"></path>
        <rect x="-40" y="160" width="45" height="35" rx="4" fill="#F472B6"></rect>
        <rect x="140" y="150" width="35" height="50" rx="4" fill="#10B981"></rect>
      </g>
    </svg>
  </div>
</section>`;

// ─── CARD 2: Showing Up ───────────────────────────────────────────────────────
const CARD_2 = `<section class="w-full bg-[#FFFBEB] relative flex flex-col text-[#92400E] overflow-hidden" style="min-height:100%">
  <div class="p-10 pt-28 space-y-10">
    <p class="text-4xl font-black leading-tight">
      It's not just about spending 5 minutes.
    </p>
    <p class="text-3xl font-bold italic text-[#D95D39] leading-tight">
      It's about how you show up in those 5 minutes.
    </p>
    <div class="bg-white/60 p-8 rounded-[40px] border-2 border-orange-100 shadow-sm mt-4">
      <p class="text-2xl font-bold leading-tight">
        Your attention becomes an emotional deposit.
      </p>
    </div>
  </div>
  <div class="mt-auto mb-10 flex justify-center opacity-80">
    <svg viewBox="0 0 400 200" class="w-full h-auto">
      <g transform="translate(140, 50)">
        <circle cx="0" cy="40" r="40" fill="#E0AC69"></circle>
        <circle cx="100" cy="80" r="30" fill="#E0AC69"></circle>
        <path d="M-10 45 Q0 55 10 45" fill="none" stroke="#4B2C20" stroke-width="4" stroke-linecap="round"></path>
        <path d="M110 85 Q120 95 130 85" fill="none" stroke="#4B2C20" stroke-width="3" stroke-linecap="round"></path>
      </g>
    </svg>
  </div>
</section>`;

// ─── CARD 3: P.E.N. Toolkit ───────────────────────────────────────────────────
const CARD_3 = `<section class="w-full bg-[#F5F3FF] relative flex flex-col text-[#4B218E] overflow-hidden" style="min-height:100%">
  <div class="p-8 pt-16 space-y-4 overflow-y-auto pb-10">
    <h2 class="text-4xl font-black uppercase tracking-tighter">The simple <br/>toolkit: P.E.N.</h2>
    <p class="text-lg font-bold opacity-70">During Emotional Massage, you don't need to teach or direct. Just stay present using:</p>
    <div class="space-y-4">
      <div class="bg-white/95 p-5 rounded-[32px] border border-black/5 shadow-sm flex items-start space-x-5">
        <div class="w-16 h-16 rounded-full flex items-center justify-center font-black text-white text-3xl shrink-0 shadow-md" style="background-color:#10B981">P</div>
        <div class="space-y-1 flex-1">
          <div class="flex items-center justify-between">
            <p class="text-xs font-black uppercase tracking-widest opacity-60" style="color:#10B981">Praise (be specific)</p>
            <span class="text-xl">⭐</span>
          </div>
          <p class="text-xl font-bold leading-tight italic">"You're stacking those blocks so carefully."</p>
          <p class="text-xs font-black text-black/40 uppercase tracking-tight pt-1 leading-tight">👉 Focus on effort and process instead of result.</p>
        </div>
      </div>
      <div class="bg-white/95 p-5 rounded-[32px] border border-black/5 shadow-sm flex items-start space-x-5">
        <div class="w-16 h-16 rounded-full flex items-center justify-center font-black text-white text-3xl shrink-0 shadow-md" style="background-color:#3B82F6">E</div>
        <div class="space-y-1 flex-1">
          <div class="flex items-center justify-between">
            <p class="text-xs font-black uppercase tracking-widest opacity-60" style="color:#3B82F6">Echo (repeat their words)</p>
            <span class="text-xl">💬</span>
          </div>
          <p class="text-xl font-bold leading-tight italic">Child: "This car is so fast!" — You: "This car is so fast!"</p>
          <p class="text-xs font-black text-black/40 uppercase tracking-tight pt-1 leading-tight">👉 Helps them feel heard and understood.</p>
        </div>
      </div>
      <div class="bg-white/95 p-5 rounded-[32px] border border-black/5 shadow-sm flex items-start space-x-5">
        <div class="w-16 h-16 rounded-full flex items-center justify-center font-black text-white text-3xl shrink-0 shadow-md" style="background-color:#A855F7">N</div>
        <div class="space-y-1 flex-1">
          <div class="flex items-center justify-between">
            <p class="text-xs font-black uppercase tracking-widest opacity-60" style="color:#A855F7">Narrate (describe what you see)</p>
            <span class="text-xl">🧱</span>
          </div>
          <p class="text-xl font-bold leading-tight italic">"You're putting the blue block on top."</p>
          <p class="text-xs font-black text-black/40 uppercase tracking-tight pt-1 leading-tight">👉 Builds focus and keeps attention shared.</p>
        </div>
      </div>
    </div>
  </div>
</section>`;

// ─── CARD 4: Key Insight 1 ────────────────────────────────────────────────────
const CARD_4 = `<section class="w-full bg-[#D1F2F9] relative flex flex-col text-[#1A3A42] overflow-hidden" style="min-height:100%">
  <div class="p-10 pt-40 text-center space-y-12">
    <h2 class="text-6xl font-black uppercase tracking-tighter">Key Insight</h2>
    <div class="bg-white/50 p-10 rounded-[48px] border-4 border-white backdrop-blur-md shadow-inner">
      <p class="text-3xl font-black italic leading-tight">When a child feels seen, heard, and noticed, their emotional bank account fills faster.</p>
    </div>
  </div>
  <div class="mt-auto mb-20 flex justify-center">
    <svg viewBox="0 0 400 200" class="w-full h-auto drop-shadow-md">
      <g transform="translate(150, 150)">
        <rect x="0" y="0" width="50" height="40" rx="4" fill="#F472B6"></rect>
        <rect x="55" y="0" width="50" height="40" rx="4" fill="#3B82F6"></rect>
        <rect x="25" y="-45" width="60" height="40" rx="4" fill="#10B981"></rect>
      </g>
    </svg>
  </div>
</section>`;

// ─── CARD 5: What NOT to Do ───────────────────────────────────────────────────
const CARD_5 = `<section class="w-full bg-[#FFF1F0] relative flex flex-col text-[#991B1B] overflow-hidden" style="min-height:100%">
  <div class="p-10 pt-24 space-y-10">
    <h2 class="text-4xl font-black uppercase leading-tight tracking-tighter">What NOT to do during Emotional Massage</h2>
    <p class="text-2xl font-bold opacity-70 italic leading-tight">During these 5 minutes, your child leads. Try to avoid:</p>
    <div class="space-y-5 pt-4 text-center uppercase tracking-widest font-black">
      <div class="bg-white/40 p-6 rounded-2xl border border-rose-200 text-2xl shadow-sm">❌ Asking questions</div>
      <div class="bg-white/40 p-6 rounded-2xl border border-rose-200 text-2xl shadow-sm">❌ Giving commands</div>
      <div class="bg-white/40 p-6 rounded-2xl border border-rose-200 text-2xl shadow-sm">❌ Correcting or criticizing</div>
    </div>
  </div>
</section>`;

// ─── CARD 6: Why This Matters ─────────────────────────────────────────────────
const CARD_6 = `<section class="w-full bg-[#FDF4E3] relative flex flex-col text-[#1A3A42] overflow-hidden" style="min-height:100%">
  <div class="p-10 pt-20 space-y-8 overflow-y-auto pb-32">
    <h2 class="text-5xl font-black uppercase tracking-tighter text-[#EF845D]">Why this <br/>matters</h2>
    <p class="text-2xl font-bold leading-tight opacity-70 italic">"What are you building?" "Why did you do that?"</p>
    <p class="text-2xl font-bold leading-tight">During Emotional Massage, these can feel like <span class="text-[#EF4444] font-black underline decoration-4">pressure.</span></p>
    <div class="space-y-4 pt-4 text-[#7E22CE]">
      <p class="text-sm font-black uppercase opacity-40 text-black">Pressure can make children:</p>
      <ul class="text-3xl font-black space-y-3 italic">
        <li>→ Withdraw</li>
        <li>→ Lose focus</li>
        <li>→ Engage less</li>
      </ul>
    </div>
    <p class="text-xl font-bold bg-white/60 p-6 rounded-3xl mt-4 leading-tight">
      Even small "teaching moments" can turn a deposit into a withdrawal.
    </p>
  </div>
</section>`;

// ─── CARD 7: Key Insight 2 ────────────────────────────────────────────────────
const CARD_7 = `<section class="w-full bg-[#F0FDFA] relative flex flex-col text-[#0F766E] overflow-hidden" style="min-height:100%">
  <div class="p-10 pt-32 text-center space-y-12">
    <h2 class="text-6xl font-black uppercase tracking-tighter">Key Insight</h2>
    <div class="bg-white p-10 rounded-[60px] border-4 border-teal-100 shadow-xl">
      <p class="text-3xl font-black italic leading-tight">
        When children don't feel tested, they stay more open, more engaged, and more connected.
      </p>
    </div>
  </div>
  <div class="mt-auto mb-16 flex justify-center drop-shadow-lg">
    <svg viewBox="0 0 400 300" class="w-full h-auto">
      <g transform="translate(120, 100)">
        <circle cx="40" cy="40" r="40" fill="#76A19E" opacity="0.3"></circle>
        <circle cx="100" cy="80" r="30" fill="#E0AC69"></circle>
        <path d="M0 150 Q80 130 160 150" fill="none" stroke="#10B981" stroke-width="10" stroke-linecap="round"></path>
      </g>
    </svg>
  </div>
</section>`;

// ─── CARD 8: Important Reminder ──────────────────────────────────────────────
const CARD_8 = `<section class="w-full bg-[#FFF7ED] relative flex flex-col text-[#1A3A42] overflow-hidden" style="min-height:100%">
  <div class="p-10 pt-24 space-y-10">
    <h2 class="text-5xl font-black uppercase leading-none text-[#D95D39] tracking-tighter">Important <br/>Reminder</h2>
    <p class="text-3xl font-medium leading-tight">
      Questions and teaching are still great outside of <span class="text-[#A855F7] font-black italic underline">Emotional Massage Time</span> — they help your child learn, imagine, and talk about their world.
    </p>
    <div class="bg-[#D95D39]/10 p-8 rounded-[40px] border-2 border-[#D95D39]/20 shadow-inner">
      <p class="text-2xl font-black italic leading-tight text-[#D95D39]">
        But remember those are withdrawals for their emotional bank account.
      </p>
    </div>
  </div>
</section>`;

// ─── CARD 9: Simple Takeaway ──────────────────────────────────────────────────
const CARD_9 = `<section class="w-full bg-[#D1F2F9] relative flex flex-col text-[#1A3A42] overflow-hidden" style="min-height:100%">
  <div class="p-10 pt-32 text-center space-y-12">
    <h2 class="text-5xl font-black uppercase tracking-tight">Simple <br/>Takeaway</h2>
    <div class="bg-[#1A3A42] text-white p-14 rounded-[60px] shadow-2xl transform rotate-1">
      <p class="text-4xl font-black italic leading-tight text-[#F4D03F]">You don't need <br/>to do more.</p>
      <div class="h-1 bg-white/20 my-10"></div>
      <p class="text-4xl font-black italic leading-tight text-white">You just need <br/>to notice more.</p>
    </div>
  </div>
  <div class="mt-auto mb-10 flex flex-col items-center">
    <svg viewBox="0 0 200 300" class="w-52 h-auto drop-shadow-xl">
      <g transform="translate(50, 250)">
        <rect x="0" y="-40" width="100" height="40" rx="4" fill="#F472B6"></rect>
        <rect x="15" y="-95" width="70" height="55" rx="4" fill="#3B82F6"></rect>
        <rect x="35" y="-135" width="30" height="40" rx="4" fill="#10B981"></rect>
        <circle cx="50" cy="-170" r="28" fill="#F4D03F"></circle>
        <path d="M40 -175 Q50 -160 60 -175" fill="none" stroke="#4B2C20" stroke-width="3" stroke-linecap="round"></path>
      </g>
    </svg>
  </div>
</section>`;

// ─── Runner ───────────────────────────────────────────────────────────────────

const LESSON_ID = 'GETTING_STARTED-5';

const segments = [
  { order: 1, contentType: 'TEXT', bodyText: '', customHtml: CARD_1 },
  { order: 2, contentType: 'TEXT', bodyText: '', customHtml: CARD_2 },
  { order: 3, contentType: 'TEXT', bodyText: '', customHtml: CARD_3 },
  { order: 4, contentType: 'TEXT', bodyText: '', customHtml: CARD_4 },
  { order: 5, contentType: 'TEXT', bodyText: '', customHtml: CARD_5 },
  { order: 6, contentType: 'TEXT', bodyText: '', customHtml: CARD_6 },
  { order: 7, contentType: 'TEXT', bodyText: '', customHtml: CARD_7 },
  { order: 8, contentType: 'TEXT', bodyText: '', customHtml: CARD_8 },
  { order: 9, contentType: 'TEXT', bodyText: '', customHtml: CARD_9 },
];

async function run() {
  console.log(`Inserting lesson ${LESSON_ID}…`);

  await prisma.$transaction(async (tx) => {
    await tx.lesson.upsert({
      where: { id: LESSON_ID },
      update: {
        title:             'What to say (and not say)',
        subtitle:          null,
        shortDescription:  'Learn the P.E.N. skills — what to say and avoid during Emotional Massage Time.',
        objectives:        [
          'Understand the difference between presence and quality attention',
          'Learn the P.E.N. framework: Praise, Echo, Narrate',
          'Know what to avoid during Emotional Massage Time',
        ],
        estimatedMinutes:  5,
        teachesCategories: ['EMOTIONS'],
        backgroundColor:   '#E9F5E9',
        ellipse77Color:    '#A855F7',
        ellipse78Color:    '#10B981',
        updatedAt:         new Date(),
      },
      create: {
        id:                LESSON_ID,
        module:            'GETTING_STARTED',
        dayNumber:         5,
        title:             'What to say (and not say)',
        subtitle:          null,
        shortDescription:  'Learn the P.E.N. skills — what to say and avoid during Emotional Massage Time.',
        objectives:        [
          'Understand the difference between presence and quality attention',
          'Learn the P.E.N. framework: Praise, Echo, Narrate',
          'Know what to avoid during Emotional Massage Time',
        ],
        estimatedMinutes:  5,
        teachesCategories: ['EMOTIONS'],
        backgroundColor:   '#E9F5E9',
        ellipse77Color:    '#A855F7',
        ellipse78Color:    '#10B981',
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
  }, { timeout: 30000 });

  await prisma.$disconnect();
  console.log('Done.');
}

run().catch(async (e) => {
  console.error(e);
  await prisma.$disconnect();
  process.exit(1);
});
