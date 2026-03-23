/**
 * Backfill evidenceSummary into milestoneCelebrations for a specific session.
 * Uses the detected_milestone_keys stored in childProfiling.domains.
 */

const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

const SESSION_ID = process.argv[2] || 'd9a95a81-bfcf-4405-a0a6-ac9b6652163c';

async function main() {
  console.log(`\n🔍 Backfilling milestone evidence for session: ${SESSION_ID}\n`);

  // Fetch session and its childProfiling
  const session = await prisma.session.findUnique({
    where: { id: SESSION_ID },
    select: { id: true, milestoneCelebrations: true }
  });

  if (!session) {
    console.error('❌ Session not found');
    return;
  }

  const celebrations = session.milestoneCelebrations;
  if (!celebrations || !Array.isArray(celebrations) || celebrations.length === 0) {
    console.log('⚠️  No milestoneCelebrations found on this session');
    return;
  }

  console.log(`Found ${celebrations.length} celebration(s):`, celebrations.map(c => c.title));

  const childProfiling = await prisma.childProfiling.findUnique({
    where: { sessionId: SESSION_ID },
    select: { domains: true }
  });

  if (!childProfiling?.domains) {
    console.error('❌ No childProfiling record found for this session');
    return;
  }

  // Build map: milestone_key → evidence_summary from all domains
  const evidenceByKey = {};
  for (const domain of childProfiling.domains) {
    for (const mk of (domain.detected_milestone_keys || [])) {
      if (mk.milestone_key && mk.evidence_summary) {
        evidenceByKey[mk.milestone_key] = mk.evidence_summary;
      }
    }
  }

  console.log(`\nEvidence map built from childProfiling (${Object.keys(evidenceByKey).length} keys):`, evidenceByKey);

  // Fetch milestone library to map displayTitle → key
  const celebrationTitles = celebrations.map(c => c.title);
  const libraryEntries = await prisma.milestoneLibrary.findMany({
    where: { displayTitle: { in: celebrationTitles } },
    select: { key: true, displayTitle: true }
  });

  const keyByTitle = {};
  for (const e of libraryEntries) {
    keyByTitle[e.displayTitle] = e.key;
  }

  console.log(`\nTitle → key map:`, keyByTitle);

  // Enrich celebrations
  const enriched = celebrations.map(c => {
    const key = c.milestoneKey || keyByTitle[c.title];
    const evidenceSummary = c.evidenceSummary || (key && evidenceByKey[key]) || null;
    console.log(`  ${c.title}: key=${key}, evidence=${evidenceSummary}`);
    return { ...c, evidenceSummary };
  });

  // Update session
  await prisma.session.update({
    where: { id: SESSION_ID },
    data: { milestoneCelebrations: enriched }
  });

  console.log(`\n✅ Updated milestoneCelebrations with evidenceSummary`);
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
