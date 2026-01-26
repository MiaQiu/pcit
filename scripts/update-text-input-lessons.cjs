require('dotenv').config();
const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient();

/**
 * Update specific lesson segments to TEXT_INPUT content type
 * This script updates only DISCIPLINE-2-seg-4 and DISCIPLINE-5-seg-6
 * without re-importing all lessons (preserving user progress)
 *
 * Usage: node scripts/update-text-input-lessons.cjs
 */

const TEXT_INPUT_SEGMENTS = [
  {
    segmentId: 'DISCIPLINE-2-seg-4',
    idealAnswer: 'Please put the lego on the floor.',
    aiCheckMode: 'AI-Check',
    // The prompt is already in bodyText, but we need to clean it up
    // to remove the $$Text Input Field$$ marker and AI-Check Answer line
    cleanupBodyText: true,
  },
  {
    segmentId: 'DISCIPLINE-5-seg-6',
    idealAnswer: `1. (Wait 5 seconds).
2. "You can put the blocks on the rug, or the blocks will take a break."
3. (Wait 5 seconds).
4. "You chose not to listen, so the blocks are taking a break." (Remove blocks for 2 mins).`,
    aiCheckMode: 'Ideal',
    cleanupBodyText: true,
  },
];

async function updateTextInputSegments() {
  console.log('🚀 Starting text input segment updates...\n');

  let successCount = 0;
  let errorCount = 0;

  for (const config of TEXT_INPUT_SEGMENTS) {
    try {
      // Check if segment exists
      const segment = await prisma.lessonSegment.findUnique({
        where: { id: config.segmentId },
      });

      if (!segment) {
        console.log(`⚠️ Segment ${config.segmentId} not found - skipping`);
        errorCount++;
        continue;
      }

      // Clean up bodyText if needed (remove markers and answer lines)
      let cleanBodyText = segment.bodyText;
      if (config.cleanupBodyText) {
        // Remove $$Text Input Field$$ or $$$Text Input Field$$$ markers
        cleanBodyText = cleanBodyText.replace(/\${2,3}Text Input Field\${2,3}/g, '').trim();

        // Remove AI-Check Answer line
        cleanBodyText = cleanBodyText.replace(/AI-Check Answer:\s*"[^"]+"\s*/g, '').trim();

        // Remove Ideal Answer section (multi-line)
        cleanBodyText = cleanBodyText.replace(/Ideal Answer:[\s\S]*?(?=Card \d+:|$)/g, '').trim();
      }

      // Update the segment
      await prisma.lessonSegment.update({
        where: { id: config.segmentId },
        data: {
          contentType: 'TEXT_INPUT',
          idealAnswer: config.idealAnswer,
          aiCheckMode: config.aiCheckMode,
          bodyText: cleanBodyText,
          updatedAt: new Date(),
        },
      });

      console.log(`✅ Updated ${config.segmentId}`);
      console.log(`   Content Type: TEXT_INPUT`);
      console.log(`   AI Check Mode: ${config.aiCheckMode}`);
      console.log(`   Ideal Answer: "${config.idealAnswer.substring(0, 50)}..."`);
      console.log('');
      successCount++;
    } catch (error) {
      console.error(`❌ Failed to update ${config.segmentId}:`, error.message);
      errorCount++;
    }
  }

  console.log('='.repeat(60));
  console.log('📊 Update Summary:');
  console.log(`   ✅ Success: ${successCount}`);
  console.log(`   ❌ Failed: ${errorCount}`);
  console.log(`   📦 Total: ${TEXT_INPUT_SEGMENTS.length}`);
  console.log('='.repeat(60) + '\n');
}

async function main() {
  try {
    await updateTextInputSegments();
    console.log('🎉 Text input segment updates completed!\n');
  } catch (error) {
    console.error('❌ Fatal error:', error);
    throw error;
  } finally {
    await prisma.$disconnect();
  }
}

// Run the script
main()
  .then(() => {
    process.exit(0);
  })
  .catch((error) => {
    console.error('Script failed:', error);
    process.exit(1);
  });
