/**
 * Re-run CDI feedback generation for a specific session
 * Usage: node scripts/rerun-cdi-feedback.cjs <sessionId>
 */

const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

// Import the analysis service functions
const { generateCDIFeedback } = require('../server/services/pcitAnalysisService.cjs');
const { getUtterances, updateRevisedFeedback } = require('../server/utils/utteranceUtils.cjs');
const { decryptSensitiveData } = require('../server/utils/encryption.cjs');

async function rerunCDIFeedback(sessionId) {
  console.log(`\n${'='.repeat(60)}`);
  console.log(`Re-running CDI feedback for session: ${sessionId}`);
  console.log(`${'='.repeat(60)}\n`);

  try {
    // Get session
    const session = await prisma.session.findUnique({
      where: { id: sessionId }
    });

    if (!session) {
      throw new Error(`Session ${sessionId} not found`);
    }

    console.log(`Session found, mode: ${session.mode}`);

    if (session.mode !== 'CDI') {
      throw new Error(`Session mode is ${session.mode}, expected CDI`);
    }

    // Get user info for child name
    const user = await prisma.user.findUnique({
      where: { id: session.userId },
      select: { childName: true }
    });

    const childName = user?.childName ? decryptSensitiveData(user.childName) : 'the child';
    console.log(`Child name: ${childName}`);

    // Get utterances with tags
    const utterances = await getUtterances(sessionId);
    console.log(`Found ${utterances.length} utterances`);

    // Get tag counts from session
    const tagCounts = session.tagCounts || {};
    console.log(`Tag counts:`, tagCounts);

    // Run CDI feedback generation
    console.log(`\nGenerating CDI feedback...`);
    const feedbackResult = await generateCDIFeedback(tagCounts, utterances, childName);

    console.log(`\n${'='.repeat(60)}`);
    console.log(`Feedback Result:`);
    console.log(`${'='.repeat(60)}`);
    console.log(`Top Moment: ${feedbackResult.topMoment}`);
    console.log(`Feedback: ${feedbackResult.feedback}`);
    console.log(`Child Reaction: ${feedbackResult.childReaction}`);
    console.log(`Reminder: ${feedbackResult.reminder}`);
    console.log(`Example Index: ${feedbackResult.example}`);

    // Save revised feedback to database
    if (feedbackResult.revisedFeedback && feedbackResult.revisedFeedback.length > 0) {
      await updateRevisedFeedback(sessionId, feedbackResult.revisedFeedback);
      console.log(`Updated ${feedbackResult.revisedFeedback.length} revised feedback items`);
    }

    // Build updated competency analysis
    const competencyAnalysis = {
      topMoment: feedbackResult.topMoment,
      topMomentUtteranceNumber: typeof feedbackResult.topMomentUtteranceNumber === 'number' ? feedbackResult.topMomentUtteranceNumber : null,
      feedback: feedbackResult.feedback || null,
      example: typeof feedbackResult.example === 'number' ? feedbackResult.example : null,
      childReaction: feedbackResult.childReaction || null,
      tips: null,
      reminder: feedbackResult.reminder,
      analyzedAt: new Date().toISOString(),
      mode: session.mode
    };

    // Update session
    await prisma.session.update({
      where: { id: sessionId },
      data: { competencyAnalysis }
    });

    console.log(`\nSession updated with new competency analysis`);
    console.log(`Done!`);

  } catch (error) {
    console.error(`\nError: ${error.message}`);
    console.error(error.stack);
  } finally {
    await prisma.$disconnect();
  }
}

// Get session ID from command line
const sessionId = process.argv[2] || '807db5e6-74ad-423c-ba20-b3ead3b58aac';
rerunCDIFeedback(sessionId);
