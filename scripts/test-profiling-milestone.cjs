/**
 * Test script: run developmental profiling + milestone detection for a session
 * Skips transcription — uses existing transcript and role identification.
 *
 * Usage:
 *   node scripts/test-profiling-milestone.cjs <sessionId>          # dry run (no DB writes)
 *   node scripts/test-profiling-milestone.cjs <sessionId> --save   # save to DB
 */
require('dotenv').config();
const prisma = require('../server/services/db.cjs');
const { decryptSensitiveData } = require('../server/utils/encryption.cjs');

const SESSION_ID = process.argv[2];
const SAVE = process.argv.includes('--save');
if (!SESSION_ID) {
  console.error('Usage: node scripts/test-profiling-milestone.cjs <sessionId> [--save]');
  process.exit(1);
}

async function run() {
  console.log('='.repeat(80));
  console.log(`🧪 Testing profiling + milestone detection for session ${SESSION_ID}`);
  console.log('='.repeat(80));

  // Load session
  const session = await prisma.session.findUnique({
    where: { id: SESSION_ID },
    select: {
      id: true, userId: true, mode: true, durationSeconds: true,
      transcript: true, roleIdentificationJson: true,
      pcitCoding: true, tagCounts: true, analysisStatus: true
    }
  });

  if (!session) { console.error('❌ Session not found'); process.exit(1); }
  if (!session.transcript) { console.error('❌ No transcript — run full pipeline first'); process.exit(1); }

  console.log(`✅ Session found — mode: ${session.mode}, status: ${session.analysisStatus}`);

  // Load user + child info
  const user = await prisma.user.findUnique({
    where: { id: session.userId },
    select: { childName: true, childBirthYear: true, childBirthday: true, childGender: true }
  });

  let child = await prisma.child.findFirst({ where: { userId: session.userId } });
  if (!child) { console.error('❌ No child record found'); process.exit(1); }

  const childName = user?.childName ? decryptSensitiveData(user.childName) : 'the child';

  // Calculate age
  let childAgeMonths = null;
  if (child.birthday) {
    const now = new Date();
    const bd = new Date(child.birthday);
    childAgeMonths = (now.getFullYear() - bd.getFullYear()) * 12 + (now.getMonth() - bd.getMonth());
  } else if (user?.childBirthday) {
    const now = new Date();
    const bd = new Date(user.childBirthday);
    childAgeMonths = (now.getFullYear() - bd.getFullYear()) * 12 + (now.getMonth() - bd.getMonth());
  } else if (user?.childBirthYear) {
    childAgeMonths = (new Date().getFullYear() - user.childBirthYear) * 12;
  }

  const formatGender = (g) => ({ BOY: 'boy', GIRL: 'girl', OTHER: 'child' }[g] || 'child');
  const childGender = user?.childGender ? formatGender(user.childGender) : 'child';

  console.log(`👶 Child: ${childName}, ${childAgeMonths}mo, ${childGender}`);

  // Load existing achieved milestone keys
  const existingChildMilestones = await prisma.childMilestone.findMany({
    where: { childId: child.id },
    include: { MilestoneLibrary: { select: { key: true } } }
  });
  const achievedMilestoneKeys = existingChildMilestones
    .filter(m => m.status === 'ACHIEVED')
    .map(m => m.MilestoneLibrary.key);

  const priorCompletedCount = await prisma.session.count({
    where: { userId: session.userId, analysisStatus: 'COMPLETED' }
  });
  const isFirstSession = priorCompletedCount === 0;

  console.log(`📊 Existing milestones: ${existingChildMilestones.length} total, ${achievedMilestoneKeys.length} achieved`);
  console.log(`📊 Is first session: ${isFirstSession}`);
  console.log(`📊 Achieved keys: ${achievedMilestoneKeys.join(', ') || 'none'}`);

  // Load clinical priority
  const latestComputedAt = await prisma.childIssuePriority.findFirst({
    where: { childId: child.id },
    orderBy: { computedAt: 'desc' },
    select: { computedAt: true }
  });
  const issuePriorities = latestComputedAt
    ? await prisma.childIssuePriority.findMany({
        where: { childId: child.id, computedAt: latestComputedAt.computedAt },
        orderBy: { priorityRank: 'asc' }
      })
    : [];
  const clinicalPriority = {
    primaryIssue: child.primaryIssue,
    primaryStrategy: child.primaryStrategy,
    secondaryIssue: child.secondaryIssue,
    secondaryStrategy: child.secondaryStrategy,
    issuePriorities
  };

  // Build utterances from transcript + role identification
  const utterances = await prisma.utterance.findMany({
    where: { sessionId: SESSION_ID },
    orderBy: { order: 'asc' }
  });

  if (utterances.length === 0) {
    console.error('❌ No utterances found — run full pipeline first');
    process.exit(1);
  }
  console.log(`📝 Utterances: ${utterances.length}`);

  // Run generateDevelopmentalProfiling via the analysis service
  const pcitAnalysis = require('../server/services/pcitAnalysisService.cjs');

  const childInfoForProfiling = {
    name: childName,
    ageMonths: childAgeMonths,
    gender: childGender,
    clinicalPriority,
    isFirstSession,
    durationSeconds: session.durationSeconds || null,
    achievedMilestoneKeys
  };

  const tagCounts = session.tagCounts || {};

  console.log('\n' + '='.repeat(80));
  console.log('🧠 STEP 9: Running generateDevelopmentalProfiling...');
  console.log('='.repeat(80));

  const profilingResult = await pcitAnalysis.generateDevelopmentalProfiling(
    utterances,
    childInfoForProfiling,
    tagCounts,
    null
  );

  if (!profilingResult) {
    console.error('❌ Profiling failed');
    process.exit(1);
  }

  console.log('\n📋 DOMAINS OUTPUT:');
  for (const domain of profilingResult.developmentalObservation?.domains || []) {
    const keys = (domain.detected_milestone_keys || []).map(k => k.milestone_key);
    console.log(`\n  [${domain.category}] ${domain.developmental_status}`);
    console.log(`    Detected keys: ${keys.length > 0 ? keys.join(', ') : 'none'}`);
    for (const k of domain.detected_milestone_keys || []) {
      console.log(`      • ${k.milestone_key}: "${k.evidence_summary}"`);
    }
  }

  const detectedMilestones = (profilingResult.developmentalObservation?.domains || [])
    .flatMap(d => d.detected_milestone_keys || []);
  const baselineAchieved = profilingResult.baselineAchieved || [];

  console.log(`\n📊 Total detected: ${detectedMilestones.length}, baseline achieved: ${baselineAchieved.length}`);
  if (baselineAchieved.length > 0) {
    console.log('  Baseline:');
    baselineAchieved.forEach(b => console.log(`    • ${b.milestone_key}: "${b.evidence_summary}"`));
  }

  if (SAVE) {
    console.log('\n' + '='.repeat(80));
    console.log('💾 SAVING: Upserting ChildProfiling...');
    console.log('='.repeat(80));

    await prisma.childProfiling.upsert({
      where: { sessionId: SESSION_ID },
      create: {
        userId: session.userId,
        sessionId: SESSION_ID,
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
    console.log('✅ ChildProfiling upserted');

    console.log('\n🏆 STEP 10: Running detectAndUpdateMilestones (SAVING to DB)...');
    const { detectAndUpdateMilestones } = require('../server/services/milestoneDetectionService.cjs');
    const milestoneResult = await detectAndUpdateMilestones(child.id, detectedMilestones, baselineAchieved);
    if (milestoneResult) {
      console.log(`✅ Milestones: ${milestoneResult.newEmerging} new emerging, ${milestoneResult.newAchieved} new achieved, ${milestoneResult.celebrations.length} celebrations`);
    }

    console.log('\n' + '='.repeat(80));
    console.log('✅ Done — DB updated');
    console.log('='.repeat(80));
  } else {
    console.log('\n' + '='.repeat(80));
    console.log('🏆 STEP 10: DRY RUN — showing what would happen (pass --save to write)');
    console.log('='.repeat(80));

    const allMilestones = await prisma.milestoneLibrary.findMany();
    const keyToMilestone = {};
    for (const m of allMilestones) keyToMilestone[m.key] = m;
    const existingByKey = {};
    for (const em of existingChildMilestones) existingByKey[em.MilestoneLibrary.key] = em;

    for (const detected of detectedMilestones) {
      const lib = keyToMilestone[detected.milestone_key];
      if (!lib) { console.log(`  ⚠️  Unknown key: ${detected.milestone_key}`); continue; }
      const existing = existingByKey[detected.milestone_key];
      if (!existing) {
        console.log(`  ✨ WOULD CREATE EMERGING: ${detected.milestone_key}`);
      } else if (existing.status === 'EMERGING') {
        const newCount = existing.detectionCount + 1;
        if (newCount > lib.thresholdValue) {
          console.log(`  🏆 WOULD PROMOTE TO ACHIEVED: ${detected.milestone_key} (count ${newCount} > threshold ${lib.thresholdValue})`);
        } else {
          console.log(`  📊 WOULD INCREMENT: ${detected.milestone_key} (count ${existing.detectionCount} → ${newCount} / threshold ${lib.thresholdValue})`);
        }
      } else {
        console.log(`  ✅ Already ACHIEVED: ${detected.milestone_key} (skip)`);
      }
    }

    console.log('\n' + '='.repeat(80));
    console.log('✅ Dry run complete — no DB changes made');
    console.log('='.repeat(80));
  }

  await prisma.$disconnect();
}

run().catch(err => {
  console.error('Fatal error:', err.message, err.stack);
  process.exit(1);
});
