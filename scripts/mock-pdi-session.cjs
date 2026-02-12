/**
 * Create a mock PDI session with a pre-defined transcript,
 * run the PDI Two Choices Flow analysis via Claude API,
 * and store the results so the report is viewable in the app.
 */
require('dotenv').config();
const { PrismaClient } = require('@prisma/client');
const { v4: uuidv4 } = require('uuid');
const { callClaudeForFeedback } = require('../server/services/claudeService.cjs');
const { loadPromptWithVariables } = require('../server/prompts/index.cjs');

const prisma = new PrismaClient();

const USER_ID = '7624c281-64a3-4ea9-8cd0-5e4652d620a0';
const CHILD_NAME = 'Leo';

// Transcript utterances from the provided script
const UTTERANCES = [
  { speaker: 'speaker_0', role: 'adult', text: 'I love how quietly you are sitting and building that garage for your cars.', start: 0, end: 5, pcitTag: 'LP', noraTag: 'Labeled Praise' },
  { speaker: 'speaker_1', role: 'child', text: "Look, the blue car is the fastest! It's going to jump over the roof!", start: 45, end: 50 },
  { speaker: 'speaker_0', role: 'adult', text: "The blue car is zooming over the roof! You're being so creative with these ramps.", start: 75, end: 81, pcitTag: 'BD', noraTag: 'Narration' },
  { speaker: 'speaker_1', role: 'child', text: 'Help me build a big wall right here so the car crashes.', start: 120, end: 125 },
  { speaker: 'speaker_0', role: 'adult', text: "I'd love to help you build the wall. Tell me where the blocks go.", start: 130, end: 135, pcitTag: 'BD', noraTag: 'Narration' },
  { speaker: 'speaker_0', role: 'adult', text: 'Leo, please hand me that yellow block right now.', start: 180, end: 184, pcitTag: 'DC', noraTag: 'Command' },
  { speaker: 'speaker_1', role: 'child', text: '(Hands Sarah the yellow block.)', start: 185, end: 187 },
  { speaker: 'speaker_0', role: 'adult', text: 'Thank you for handing me the block right away! That was great listening.', start: 188, end: 193, pcitTag: 'LP', noraTag: 'Labeled Praise' },
  { speaker: 'speaker_0', role: 'adult', text: 'Leo, would you mind moving your cars so I can sweep this spot?', start: 240, end: 245, pcitTag: 'IC', noraTag: 'Command' },
  { speaker: 'speaker_1', role: 'child', text: "No, I'm using this spot for the race track!", start: 250, end: 254 },
  { speaker: 'speaker_0', role: 'adult', text: "Oh, okay. Just move them when you're done, I guess.", start: 255, end: 259 },
  { speaker: 'speaker_1', role: 'child', text: 'Explosions!', start: 330, end: 332 },
  { speaker: 'speaker_0', role: 'adult', text: 'Leo, stop throwing the blocks now.', start: 345, end: 348, pcitTag: 'DC', noraTag: 'Command' },
  { speaker: 'speaker_1', role: 'child', text: "I'm making explosions! Boom!", start: 350, end: 353 },
  { speaker: 'speaker_0', role: 'adult', text: 'Leo, you have a choice. You can keep the blocks on the floor and build with them, or you can throw another block and the blocks will go in the timeout box for the rest of the day. Which do you choose?', start: 360, end: 372 },
  { speaker: 'speaker_1', role: 'child', text: 'I choose explosions!', start: 375, end: 377 },
  { speaker: 'speaker_0', role: 'adult', text: 'I see you have chosen to put the blocks in the timeout box. They are going away now.', start: 380, end: 386, pcitTag: 'DC', noraTag: 'Command' },
  { speaker: 'speaker_1', role: 'child', text: "NO! Give them back! I'll be good! I'll build a house!", start: 400, end: 405 },
  { speaker: 'speaker_0', role: 'adult', text: 'The choice was made for the blocks. You can choose to play with the cars or draw on your paper. What would you like to do?', start: 405, end: 412 },
  { speaker: 'speaker_1', role: 'child', text: "I'm not playing anything! You're the meanest mom in the whole world!", start: 450, end: 455 },
  { speaker: 'speaker_0', role: 'adult', text: '(Remains silent — active ignoring of the verbal jab.)', start: 465, end: 467 },
  { speaker: 'speaker_1', role: 'child', text: 'Fine. The car is going to the store.', start: 495, end: 498 },
  { speaker: 'speaker_0', role: 'adult', text: "The car is going to the store. I like how you're playing gently with the cars now.", start: 510, end: 516, pcitTag: 'LP', noraTag: 'Labeled Praise' },
  { speaker: 'speaker_0', role: 'adult', text: 'Leo, please put the blue car in the toy box so we can go get a snack.', start: 555, end: 560, pcitTag: 'DC', noraTag: 'Command' },
  { speaker: 'speaker_1', role: 'child', text: '(Leo puts the car in the box immediately.)', start: 560, end: 563 },
  { speaker: 'speaker_0', role: 'adult', text: 'Wow! You put that car away exactly when I asked. Since you listened so well, you can choose which snack we have: apple slices or crackers.', start: 600, end: 608, pcitTag: 'LP', noraTag: 'Labeled Praise' },
];

async function main() {
  console.log('🎯 Creating mock PDI session...\n');

  // Verify user exists
  const user = await prisma.user.findUnique({ where: { id: USER_ID } });
  if (!user) {
    console.error(`❌ User ${USER_ID} not found. Please provide a valid user ID.`);
    process.exit(1);
  }
  console.log(`✅ User found: ${user.name || user.email}`);

  const sessionId = uuidv4();
  const durationSeconds = 608;

  // Build full transcript text
  const transcriptText = UTTERANCES.map(u => {
    const role = u.role === 'adult' ? 'Parent' : 'Child';
    return `${role}: ${u.text}`;
  }).join('\n');

  // Tag counts from the transcript
  const tagCounts = {
    direct_command: 4,
    indirect_command: 1,
    labeled_praise: 4,
    unlabeled_praise: 0,
    narration: 2,
    echo: 0,
    question: 0,
    criticism: 0,
    neutral: 1,
    command: 5,
    praise: 4,
  };

  // 1. Create the session
  await prisma.session.create({
    data: {
      id: sessionId,
      userId: USER_ID,
      mode: 'PDI',
      storagePath: `mock/audio/pdi-mock-${sessionId}.wav`,
      durationSeconds,
      transcript: transcriptText,
      aiFeedbackJSON: {},
      pcitCoding: { adultSpeakers: ['speaker_0'], codingResults: [] },
      tagCounts,
      analysisStatus: 'PROCESSING',
      overallScore: 80,
      createdAt: new Date(),
    },
  });
  console.log(`✅ Session created: ${sessionId}`);

  // 2. Create utterances
  for (let i = 0; i < UTTERANCES.length; i++) {
    const u = UTTERANCES[i];
    await prisma.utterance.create({
      data: {
        id: uuidv4(),
        sessionId,
        speaker: u.speaker,
        text: u.text,
        startTime: u.start,
        endTime: u.end,
        role: u.role,
        pcitTag: u.pcitTag || null,
        noraTag: u.noraTag || null,
        order: i,
      },
    });
  }
  console.log(`✅ ${UTTERANCES.length} utterances created`);

  // 3. Run PDI Two Choices Flow analysis
  console.log('\n🧠 Running PDI Two Choices Flow analysis via Claude...\n');

  const prompt = loadPromptWithVariables('pdiTwoChoicesFlow', {
    CHILD_NAME: CHILD_NAME,
    TRANSCRIPT: UTTERANCES
      .map(u => {
        const roleLabel = u.role === 'adult' ? 'Parent' : 'Child';
        const tagSuffix = u.pcitTag ? ` [${u.pcitTag}]` : '';
        return `${roleLabel}: ${u.text}${tagSuffix}`;
      })
      .join('\n'),
  });

  const result = await callClaudeForFeedback(prompt);
  console.log('✅ Claude response received');
  console.log(JSON.stringify(result, null, 2));

  // 4. Build competencyAnalysis and update session
  const competencyAnalysis = {
    analyzedAt: new Date().toISOString(),
    mode: 'PDI',
    pdiSkills: result.pdiSkills,
    pdiCommandSequences: result.commandSequences || [],
    pdiTomorrowGoal: result.tomorrowGoal || null,
    pdiEncouragement: result.encouragement || null,
    pdiSummary: result.summary || null,
  };

  await prisma.session.update({
    where: { id: sessionId },
    data: {
      competencyAnalysis,
      analysisStatus: 'COMPLETED',
    },
  });

  console.log(`\n✅ Session updated with PDI analysis. Session ID: ${sessionId}`);
  console.log(`\n📱 Open the app and navigate to this session's report to see the Coach's Corner.`);

  await prisma.$disconnect();
}

main().catch(async (err) => {
  console.error('❌ Error:', err);
  await prisma.$disconnect();
  process.exit(1);
});
