'use strict';

/**
 * One-time data fix for the parent-skill-level ladder's expansion from 7 to
 * 9 levels (old level 1 "Play Builder" split into 3 flat levels: criticism,
 * commands, questions — see doc/goal.md). Old levels 2-7 shifted to become
 * new levels 4-9; old level 1 stays new level 1 (unchanged value). This
 * bumps every existing parent's stored ParentSkillProgress.currentLevel by
 * +2 so nobody gets silently reset to the new (harder) level 1.
 *
 * No Prisma schema change is involved — currentLevel stays an Int column,
 * only the meaning of its value shifts. level5/6/7QualifyingCount columns
 * are untouched by this script (their legacy names already map correctly
 * to the new level numbers — see the field-name note in
 * server/services/parentSkillLevelService.cjs).
 *
 * Usage:
 *   node server/scripts/migrate-parent-level-ladder.cjs           # dry run (default)
 *   node server/scripts/migrate-parent-level-ladder.cjs --apply   # actually writes
 */
const prisma = require('../services/db.cjs');

async function main() {
  const apply = process.argv.includes('--apply');

  const affected = await prisma.parentSkillProgress.findMany({
    where: { currentLevel: { gte: 2 } },
    select: { id: true, userId: true, currentLevel: true },
  });

  console.log(`Found ${affected.length} ParentSkillProgress row(s) with currentLevel >= 2.`);
  if (affected.length > 0) {
    console.log('Preview (old currentLevel -> new currentLevel), first 20:');
    affected.slice(0, 20).forEach(row => {
      console.log(`  ${row.userId.substring(0, 8)}: ${row.currentLevel} -> ${row.currentLevel + 2}`);
    });
  }

  if (!apply) {
    console.log('\nDry run only — no changes written. Re-run with --apply to persist.');
    return;
  }

  const result = await prisma.parentSkillProgress.updateMany({
    where: { currentLevel: { gte: 2 } },
    data: { currentLevel: { increment: 2 } },
  });
  console.log(`\nUpdated ${result.count} row(s).`);
}

main()
  .catch(err => {
    console.error('Migration failed:', err);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
