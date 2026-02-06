/**
 * Backfill ChildProfiling + ChildMilestone records for existing sessions.
 *
 * For each COMPLETED session that has utterances and tagCounts:
 *   1. Re-runs generateChildProfiling (Gemini streaming call)
 *   2. Upserts ChildProfiling record with childId
 *   3. Runs detectAndUpdateMilestones to populate ChildMilestone
 *
 * Usage:
 *   node scripts/backfill-child-profiling.cjs
 *   node scripts/backfill-child-profiling.cjs --dry-run
 *   node scripts/backfill-child-profiling.cjs --skip-milestones
 *   node scripts/backfill-child-profiling.cjs --users=id1,id2
 */
require('dotenv').config();
const prisma = require('../server/services/db.cjs');
const { decryptSensitiveData } = require('../server/utils/encryption.cjs');
const { getUtterances } = require('../server/utils/utteranceUtils.cjs');
const { generateChildProfiling } = require('../server/services/pcitAnalysisService.cjs');
const { detectAndUpdateMilestones } = require('../server/services/milestoneDetectionService.cjs');

// Parse CLI args
const args = process.argv.slice(2);
const DRY_RUN = args.includes('--dry-run');
const SKIP_MILESTONES = args.includes('--skip-milestones');
const DEFAULT_USER_ID = '7624c281-64a3-4ea9-8cd0-5e4652d620a0';

function getUserIds() {
  const usersArg = args.find(a => a.startsWith('--users='));
  if (usersArg) {
    return usersArg.replace('--users=', '').split(',').map(id => id.trim());
  }
  return [DEFAULT_USER_ID];
}

function formatGender(genderEnum) {
  const map = { BOY: 'boy', GIRL: 'girl', OTHER: 'child' };
  return map[genderEnum] || 'child';
}

function calculateAgeInMonths(birthday, birthYear) {
  const today = new Date();
  if (birthday) {
    const d = new Date(birthday);
    return (today.getFullYear() - d.getFullYear()) * 12 + (today.getMonth() - d.getMonth());
  }
  if (birthYear) return (today.getFullYear() - birthYear) * 12;
  return null;
}

function getChildSpeaker(roleIdentificationJson) {
  const speakers = roleIdentificationJson?.speaker_identification || {};
  for (const [id, info] of Object.entries(speakers)) {
    if (info.role === 'CHILD') return id;
  }
  return null;
}

async function main() {
  const userIds = getUserIds();

  console.log('='.repeat(80));
  console.log('BACKFILL: ChildProfiling + ChildMilestone');
  console.log('='.repeat(80));
  console.log(`Mode: ${DRY_RUN ? 'DRY RUN' : 'LIVE'}`);
  console.log(`Skip milestones: ${SKIP_MILESTONES}`);
  console.log(`Users: ${userIds.join(', ')}`);
  console.log('');

  for (const userId of userIds) {
    console.log(`\n${'─'.repeat(60)}`);
    console.log(`Processing user: ${userId}`);
    console.log(`${'─'.repeat(60)}`);

    // Fetch user
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: {
        id: true,
        childName: true,
        childBirthYear: true,
        childBirthday: true,
        childGender: true,
        childConditions: true,
        issue: true
      }
    });

    if (!user) {
      console.error(`  ❌ User not found: ${userId}`);
      continue;
    }

    const childName = user.childName ? decryptSensitiveData(user.childName) : 'the child';
    const childGender = user.childGender ? formatGender(user.childGender) : 'child';
    const childAgeMonths = calculateAgeInMonths(user.childBirthday, user.childBirthYear);
    const childIssue = user.issue || null;
    console.log(`  User found: ${childName}, ${childAgeMonths}mo, ${childGender}`);

    // Find or create Child record
    let child = await prisma.child.findFirst({ where: { userId } });
    if (!child) {
      if (DRY_RUN) {
        console.log(`  [DRY RUN] Would create Child record`);
        child = { id: 'dry-run-child-id' };
      } else {
        child = await prisma.child.create({
          data: {
            userId,
            name: childName || 'Child',
            birthday: user.childBirthday || null,
            gender: user.childGender || null,
            conditions: user.childConditions || null
          }
        });
        console.log(`  ✅ Created Child record: ${child.id}`);
      }
    } else {
      console.log(`  ✅ Child record exists: ${child.id}`);
    }

    // Find COMPLETED sessions with tagCounts and roleIdentificationJson
    const sessions = await prisma.session.findMany({
      where: {
        userId,
        analysisStatus: 'COMPLETED'
      },
      orderBy: { createdAt: 'asc' },
      select: {
        id: true,
        mode: true,
        tagCounts: true,
        roleIdentificationJson: true,
        createdAt: true
      }
    });

    console.log(`  Found ${sessions.length} COMPLETED sessions`);

    let profilingCount = 0;
    let milestoneStats = { totalDetected: 0, totalEmerging: 0, totalAchieved: 0 };

    for (let i = 0; i < sessions.length; i++) {
      const session = sessions[i];
      const dateStr = session.createdAt.toISOString().split('T')[0];
      console.log(`\n  [${i + 1}/${sessions.length}] Session ${session.id.substring(0, 8)} (${session.mode}, ${dateStr})`);

      // Check if tagCounts exists and has data
      const tagCounts = session.tagCounts;
      if (!tagCounts || typeof tagCounts !== 'object') {
        console.log(`    ⚠️ No tagCounts, skipping`);
        continue;
      }

      // Get utterances
      const utterances = await getUtterances(session.id);
      if (utterances.length === 0) {
        console.log(`    ⚠️ No utterances, skipping`);
        continue;
      }
      console.log(`    ${utterances.length} utterances, tagCounts present`);

      // Get child speaker from roleIdentificationJson
      const childSpeaker = getChildSpeaker(session.roleIdentificationJson);

      if (DRY_RUN) {
        console.log(`    [DRY RUN] Would run generateChildProfiling + upsert + milestone detection`);
        profilingCount++;
        continue;
      }

      // Run child profiling (Step 9)
      console.log(`    📊 Running child profiling...`);
      let profilingResult = null;
      try {
        profilingResult = await generateChildProfiling(
          utterances,
          {
            name: childName,
            ageMonths: childAgeMonths,
            gender: childGender,
            issue: childIssue
          },
          tagCounts,
          childSpeaker
        );
      } catch (err) {
        console.error(`    ❌ Profiling error: ${err.message}`);
        continue;
      }

      if (!profilingResult?.developmentalObservation) {
        console.log(`    ⚠️ Profiling returned no developmental observation, skipping`);
        continue;
      }

      console.log(`    ✅ Profiling: ${profilingResult.developmentalObservation.domains?.length || 0} domains, ${profilingResult.coachingCards?.length || 0} coaching cards`);

      // Upsert ChildProfiling
      try {
        await prisma.childProfiling.upsert({
          where: { sessionId: session.id },
          create: {
            userId,
            sessionId: session.id,
            childId: child.id,
            summary: profilingResult.developmentalObservation.summary || null,
            domains: profilingResult.developmentalObservation.domains || [],
            metadata: profilingResult.metadata || null
          },
          update: {
            childId: child.id,
            summary: profilingResult.developmentalObservation.summary || null,
            domains: profilingResult.developmentalObservation.domains || [],
            metadata: profilingResult.metadata || null
          }
        });
        console.log(`    ✅ ChildProfiling upserted`);
        profilingCount++;
      } catch (dbErr) {
        console.error(`    ❌ ChildProfiling upsert error: ${dbErr.message}`);
        continue;
      }

      // Also save coaching cards to the session
      if (profilingResult.coachingCards) {
        try {
          await prisma.session.update({
            where: { id: session.id },
            data: {
              coachingSummary: profilingResult.coachingSummary || null,
              coachingCards: profilingResult.coachingCards,
            }
          });
        } catch (_) { /* non-critical */ }
      }

      // Run milestone detection
      if (!SKIP_MILESTONES) {
        try {
          const result = await detectAndUpdateMilestones(child.id, session.id);
          if (result) {
            milestoneStats.totalDetected += result.detected;
            milestoneStats.totalEmerging += result.newEmerging;
            milestoneStats.totalAchieved += result.newAchieved;
            console.log(`    🏅 Milestones: ${result.detected} detected, ${result.newEmerging} emerging, ${result.newAchieved} achieved`);
          }
        } catch (mErr) {
          console.error(`    ⚠️ Milestone detection error (non-blocking): ${mErr.message}`);
        }
      }

      // Delay between sessions to avoid rate limiting
      if (i < sessions.length - 1) {
        console.log(`    ⏳ Waiting 3s before next session...`);
        await new Promise(resolve => setTimeout(resolve, 3000));
      }
    }

    console.log(`\n  ${'─'.repeat(40)}`);
    console.log(`  ✅ User ${userId.substring(0, 8)} complete`);
    console.log(`     Profiling: ${profilingCount}/${sessions.length} sessions`);
    if (!SKIP_MILESTONES && !DRY_RUN) {
      console.log(`     Milestones: ${milestoneStats.totalDetected} detected, ${milestoneStats.totalEmerging} emerging, ${milestoneStats.totalAchieved} achieved`);
    }
  }

  console.log(`\n${'='.repeat(80)}`);
  console.log(`Backfill complete${DRY_RUN ? ' (DRY RUN)' : ''}`);
  console.log(`${'='.repeat(80)}`);
}

main()
  .catch(err => {
    console.error('Backfill failed:', err);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
