/**
 * Milestone Detection Service
 * Receives pre-detected milestone keys from generateDevelopmentalProfiling (Prompt 1)
 * and creates/updates ChildMilestone records.
 *
 * First detection = EMERGING
 * Re-detected > thresholdValue times = ACHIEVED
 */
const prisma = require('./db.cjs');

// ============================================================================
// Main Detection Function
// ============================================================================

/**
 * Update ChildMilestone records based on milestones detected by Prompt 1
 * @param {string} childId - The Child record ID
 * @param {Array<{milestone_key: string, evidence_summary: string}>} detectedMilestones - Detected by Prompt 1
 * @param {Array<{milestone_key: string, evidence_summary: string}>} baselineAchieved - First session baselines
 * @returns {Promise<{detected: number, newEmerging: number, newAchieved: number, celebrations: Array}|null>}
 */
async function detectAndUpdateMilestones(childId, detectedMilestones = [], baselineAchieved = []) {
  if (!childId) {
    console.log(`⚠️ [MILESTONE] No childId provided, skipping`);
    return null;
  }

  // Load all MilestoneLibrary entries
  const milestones = await prisma.milestoneLibrary.findMany();
  if (milestones.length === 0) {
    console.log(`⚠️ [MILESTONE] No milestones in library, skipping`);
    return null;
  }

  // Load existing ChildMilestone records for this child
  const existingMilestones = await prisma.childMilestone.findMany({
    where: { childId },
    include: { MilestoneLibrary: { select: { key: true } } }
  });

  const existingByKey = {};
  for (const em of existingMilestones) {
    existingByKey[em.MilestoneLibrary.key] = em;
  }

  const isFirstProfiling = existingMilestones.length === 0;

  // Build key -> milestoneLibrary map
  const keyToMilestone = {};
  for (const m of milestones) {
    keyToMilestone[m.key] = m;
  }

  let newEmerging = 0;
  let newAchieved = 0;
  const celebrations = [];

  // Process each detected milestone
  for (const detected of detectedMilestones) {
    const milestoneKey = detected.milestone_key;
    const libraryEntry = keyToMilestone[milestoneKey];

    if (!libraryEntry) {
      console.warn(`⚠️ [MILESTONE] Unknown milestone key: ${milestoneKey}, skipping`);
      continue;
    }

    const existing = existingByKey[milestoneKey];

    if (!existing) {
      // No existing row → create with EMERGING
      await prisma.childMilestone.create({
        data: {
          childId,
          milestoneId: libraryEntry.id,
          status: 'EMERGING',
          detectionCount: 1,
          firstObservedAt: new Date()
        }
      });
      newEmerging++;
      celebrations.push({
        status: 'EMERGING',
        category: libraryEntry.category,
        title: libraryEntry.displayTitle,
        actionTip: libraryEntry.actionTip,
        evidenceSummary: detected.evidence_summary || null
      });
      console.log(`  ✨ [MILESTONE] NEW EMERGING: ${milestoneKey} — ${detected.evidence_summary}`);
    } else if (existing.status === 'EMERGING') {
      // Existing EMERGING → increment detectionCount and check threshold
      const newCount = existing.detectionCount + 1;

      if (newCount > libraryEntry.thresholdValue) {
        await prisma.childMilestone.update({
          where: { id: existing.id },
          data: {
            status: 'ACHIEVED',
            detectionCount: newCount,
            achievedAt: new Date()
          }
        });
        newAchieved++;
        celebrations.push({
          status: 'ACHIEVED',
          category: libraryEntry.category,
          title: libraryEntry.displayTitle,
          actionTip: libraryEntry.actionTip,
          evidenceSummary: detected.evidence_summary || null
        });
        console.log(`  🏆 [MILESTONE] ACHIEVED: ${milestoneKey} (detected ${newCount} times > threshold ${libraryEntry.thresholdValue})`);
      } else {
        await prisma.childMilestone.update({
          where: { id: existing.id },
          data: { detectionCount: newCount }
        });
        console.log(`  📊 [MILESTONE] Still EMERGING: ${milestoneKey} (detected ${newCount}/${libraryEntry.thresholdValue} times)`);
      }
    } else if (existing.status === 'ACHIEVED') {
      // Already achieved → skip (never downgrade)
      continue;
    }
  }

  // Process baseline achieved milestones (first profiling only)
  let newBaselineAchieved = 0;

  if (isFirstProfiling && baselineAchieved.length > 0) {
    console.log(`🎯 [MILESTONE] First profiling — processing ${baselineAchieved.length} baseline achieved milestones`);

    for (const baseline of baselineAchieved) {
      const milestoneKey = baseline.milestone_key;
      const libraryEntry = keyToMilestone[milestoneKey];

      if (!libraryEntry) {
        console.warn(`⚠️ [MILESTONE] Unknown baseline milestone key: ${milestoneKey}, skipping`);
        continue;
      }

      // If already created as EMERGING above, upgrade to ACHIEVED
      const justCreated = await prisma.childMilestone.findUnique({
        where: { childId_milestoneId: { childId, milestoneId: libraryEntry.id } }
      });

      if (justCreated && justCreated.status === 'EMERGING') {
        await prisma.childMilestone.update({
          where: { id: justCreated.id },
          data: { status: 'ACHIEVED', achievedAt: new Date() }
        });
        newBaselineAchieved++;
        newEmerging--;
        console.log(`  🏆 [MILESTONE] BASELINE ACHIEVED (upgraded): ${milestoneKey}`);
        continue;
      }

      if (justCreated) continue; // already processed

      await prisma.childMilestone.create({
        data: {
          childId,
          milestoneId: libraryEntry.id,
          status: 'ACHIEVED',
          detectionCount: 1,
          firstObservedAt: new Date(),
          achievedAt: new Date()
        }
      });
      newBaselineAchieved++;
      celebrations.push({
        status: 'ACHIEVED',
        category: libraryEntry.category,
        title: libraryEntry.displayTitle,
        actionTip: libraryEntry.actionTip,
        evidenceSummary: baseline.evidence_summary || null
      });
      console.log(`  🏆 [MILESTONE] BASELINE ACHIEVED: ${milestoneKey} — ${baseline.evidence_summary}`);
    }
  }

  newAchieved += newBaselineAchieved;

  const result = {
    detected: detectedMilestones.length + baselineAchieved.length,
    newEmerging,
    newAchieved,
    celebrations
  };

  console.log(`✅ [MILESTONE] Detection complete: ${result.detected} detected, ${result.newEmerging} new emerging, ${result.newAchieved} new achieved, ${celebrations.length} celebrations`);
  return result;
}

module.exports = {
  detectAndUpdateMilestones,
};
