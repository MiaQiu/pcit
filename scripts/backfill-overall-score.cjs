/**
 * Backfill Overall Score for existing sessions
 * Calculates and stores overallScore for sessions that have tagCounts but no overallScore
 */

const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

function calculateOverallScore(mode, tagCounts) {
  let overallScore = 0;
  const isCDI = mode === 'CDI';

  if (isCDI) {
    // CDI mode - PEN skills (60 points) + Avoid penalty (40 points)
    const praiseScore = Math.min(20, ((tagCounts.praise || 0) / 10) * 20);
    const echoScore = Math.min(20, ((tagCounts.echo || 0) / 10) * 20);
    const narrationScore = Math.min(20, ((tagCounts.narration || 0) / 10) * 20);
    const penScore = praiseScore + echoScore + narrationScore;

    // Avoid Penalty: 40 points if total < 3, decreasing by 10 for each additional
    const totalAvoid = (tagCounts.question || 0) + (tagCounts.command || 0) + (tagCounts.criticism || 0);
    let avoidScore = 40;
    if (totalAvoid >= 3) {
      avoidScore = Math.max(0, 40 - (totalAvoid - 2) * 10);
    }

    overallScore = Math.round(penScore + avoidScore);
  } else {
    // PDI mode - Command effectiveness
    const totalCommands = (tagCounts.direct_command || 0) + (tagCounts.indirect_command || 0) +
      (tagCounts.vague_command || 0) + (tagCounts.chained_command || 0);
    const effectiveCommands = tagCounts.direct_command || 0;
    overallScore = totalCommands > 0 ? Math.round((effectiveCommands / totalCommands) * 100) : 0;
  }

  return overallScore;
}

async function backfillOverallScores() {
  try {
    console.log('Starting overall score backfill...');

    // Find all sessions with tagCounts but no overallScore
    const sessions = await prisma.session.findMany({
      where: {
        overallScore: null,
        NOT: {
          tagCounts: {}
        }
      },
      select: {
        id: true,
        mode: true,
        tagCounts: true,
        createdAt: true
      }
    });

    console.log(`Found ${sessions.length} sessions to update`);

    let updated = 0;
    for (const session of sessions) {
      try {
        const overallScore = calculateOverallScore(session.mode, session.tagCounts);

        await prisma.session.update({
          where: { id: session.id },
          data: { overallScore }
        });

        console.log(`✓ Updated session ${session.id}: mode=${session.mode}, score=${overallScore}`);
        updated++;
      } catch (error) {
        console.error(`✗ Failed to update session ${session.id}:`, error.message);
      }
    }

    console.log(`\nBackfill complete! Updated ${updated}/${sessions.length} sessions.`);
  } catch (error) {
    console.error('Backfill error:', error);
  } finally {
    await prisma.$disconnect();
  }
}

backfillOverallScores();
