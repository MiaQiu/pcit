/**
 * Data Migration: Create Child records, backfill ChildProfiling.childId,
 * and run milestone detection on existing sessions.
 *
 * Usage:
 *   node scripts/migrate-child-records.cjs --users=id1,id2
 *   node scripts/migrate-child-records.cjs --dry-run
 *   node scripts/migrate-child-records.cjs --skip-milestones
 *
 * Default: processes user 7624c281-64a3-4ea9-8cd0-5e4652d620a0 only
 */
require('dotenv').config();
const prisma = require('../server/services/db.cjs');
const { decryptSensitiveData } = require('../server/utils/encryption.cjs');
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

async function main() {
  const userIds = getUserIds();

  console.log('='.repeat(80));
  console.log('DATA MIGRATION: Child Records + Milestone Detection');
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
        childConditions: true
      }
    });

    if (!user) {
      console.error(`  ❌ User not found: ${userId}`);
      continue;
    }

    const childName = user.childName ? decryptSensitiveData(user.childName) : 'Child';
    console.log(`  User found: childName=${childName}, birthYear=${user.childBirthYear}, gender=${user.childGender}`);

    // ========================================================================
    // PHASE 1: Create Child record
    // ========================================================================
    console.log(`\n  📌 PHASE 1: Create Child record`);

    let child = await prisma.child.findFirst({ where: { userId } });

    if (child) {
      console.log(`  ✅ Child record already exists: ${child.id}`);
    } else {
      const childData = {
        userId,
        name: childName || 'Child',
        birthday: user.childBirthday || null,
        gender: user.childGender || null,
        conditions: user.childConditions || null
      };

      if (DRY_RUN) {
        console.log(`  [DRY RUN] Would create Child:`, JSON.stringify(childData));
        // Create a fake ID for dry run reference
        child = { id: 'dry-run-child-id' };
      } else {
        child = await prisma.child.create({ data: childData });
        console.log(`  ✅ Created Child record: ${child.id}`);
      }
    }

    // ========================================================================
    // PHASE 2: Backfill childId on existing ChildProfiling records
    // ========================================================================
    console.log(`\n  📌 PHASE 2: Backfill childId on ChildProfiling records`);

    const profilings = await prisma.childProfiling.findMany({
      where: { userId },
      orderBy: { createdAt: 'asc' },
      select: { id: true, sessionId: true, childId: true, createdAt: true }
    });

    console.log(`  Found ${profilings.length} ChildProfiling records`);

    let backfilled = 0;
    for (const p of profilings) {
      if (p.childId && p.childId !== child.id) {
        console.log(`  ⚠️ Profiling ${p.id.substring(0, 8)} has different childId: ${p.childId.substring(0, 8)}`);
      }

      if (!p.childId || p.childId !== child.id) {
        if (DRY_RUN) {
          console.log(`  [DRY RUN] Would update profiling ${p.id.substring(0, 8)} with childId=${child.id}`);
        } else {
          await prisma.childProfiling.update({
            where: { id: p.id },
            data: { childId: child.id }
          });
        }
        backfilled++;
      }
    }
    console.log(`  ✅ Backfilled childId on ${backfilled} records`);

    // ========================================================================
    // PHASE 3: Run milestone detection on each profiling (oldest first)
    // ========================================================================
    if (SKIP_MILESTONES) {
      console.log(`\n  📌 PHASE 3: Skipped (--skip-milestones)`);
    } else {
      console.log(`\n  📌 PHASE 3: Milestone detection on ${profilings.length} sessions`);

      if (DRY_RUN) {
        console.log(`  [DRY RUN] Would process ${profilings.length} sessions through detectAndUpdateMilestones()`);
      } else {
        let totalDetected = 0;
        let totalEmerging = 0;
        let totalAchieved = 0;

        for (let i = 0; i < profilings.length; i++) {
          const p = profilings[i];
          console.log(`\n  Processing ${i + 1}/${profilings.length}: session ${p.sessionId.substring(0, 8)} (${p.createdAt.toISOString().split('T')[0]})`);

          try {
            const result = await detectAndUpdateMilestones(child.id, p.sessionId);
            if (result) {
              totalDetected += result.detected;
              totalEmerging += result.newEmerging;
              totalAchieved += result.newAchieved;
              console.log(`    → ${result.detected} detected, ${result.newEmerging} emerging, ${result.newAchieved} achieved`);
            } else {
              console.log(`    → No milestones detected`);
            }
          } catch (err) {
            console.error(`    ❌ Error: ${err.message}`);
          }

          // Small delay between API calls to avoid rate limiting
          if (i < profilings.length - 1) {
            await new Promise(resolve => setTimeout(resolve, 1000));
          }
        }

        console.log(`\n  ✅ PHASE 3 complete: ${totalDetected} total detected, ${totalEmerging} new emerging, ${totalAchieved} new achieved`);
      }
    }

    console.log(`\n  ✅ User ${userId.substring(0, 8)} migration complete`);
  }

  // Summary
  console.log(`\n${'='.repeat(80)}`);
  console.log(`Migration complete${DRY_RUN ? ' (DRY RUN)' : ''}`);
  console.log(`${'='.repeat(80)}`);
}

main()
  .catch(err => {
    console.error('Migration failed:', err);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
