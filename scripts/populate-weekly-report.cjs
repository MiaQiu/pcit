const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  const userId = '7624c281-64a3-4ea9-8cd0-5e4652d620a0';
  const childId = '61adccb5-79e7-4e64-a353-3c5a7b8ba9ac';

  // Current week: Mon Feb 10 - Sun Feb 16
  const weekStartDate = new Date('2026-02-10T00:00:00.000Z');
  const weekEndDate = new Date('2026-02-16T23:59:59.999Z');

  // Sessions with completed analysis (recent)
  const sessions = await prisma.session.findMany({
    where: {
      userId,
      analysisStatus: 'COMPLETED',
      overallScore: { not: null },
      createdAt: { gte: new Date('2026-02-02T00:00:00Z') },
    },
    orderBy: { createdAt: 'desc' },
  });

  console.log(`Found ${sessions.length} sessions`);

  // Compute deposits from tagCounts
  let totalPraise = 0, totalEcho = 0, totalNarrate = 0, totalDuration = 0;
  for (const s of sessions) {
    const tc = s.tagCounts;
    totalPraise += (tc.labeled_praise || 0) + (tc.unlabeled_praise || 0);
    totalEcho += tc.echo || 0;
    totalNarrate += tc.narration || 0;
    totalDuration += s.durationSeconds || 0;
  }

  console.log(`Deposits: praise=${totalPraise}, echo=${totalEcho}, narrate=${totalNarrate}, time=${Math.round(totalDuration / 60)}m`);

  // Build top moments
  const DAY_NAMES = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
  const MONTH_NAMES = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

  const topMoments = sessions.map(s => {
    const ca = s.competencyAnalysis;
    const date = new Date(s.createdAt);
    const dayLabel = DAY_NAMES[date.getDay()];
    const dateLabel = MONTH_NAMES[date.getMonth()] + ' ' + date.getDate();

    // Determine top skill from tagCounts
    const tc = s.tagCounts;
    const skillCounts = [
      { label: 'Praise', count: (tc.labeled_praise || 0) + (tc.unlabeled_praise || 0) },
      { label: 'Echo', count: tc.echo || 0 },
      { label: 'Narrate', count: tc.narration || 0 },
    ];
    const topSkill = skillCounts.sort((a, b) => b.count - a.count)[0];

    // Clean top moment text
    let quote = (ca && ca.topMoment) || '';
    quote = quote.replace(/\s+\[(LP|UP|RF|BD|NT|QU|CM|CR|IC|DC|PR|NA|EC|NE)\]/gi, '');

    return {
      date: dayLabel + '  ' + dateLabel,
      dayLabel,
      dateLabel,
      tag: topSkill.label,
      sessionTitle: Math.round(s.durationSeconds / 60) + 'm ' + s.mode + ' session',
      quote,
      celebration: (ca && ca.feedback) || '',
      audioUrl: null,
      startTime: null,
      endTime: null,
    };
  });

  // Build milestones
  const milestones = [];
  const seenTitles = new Set();

  // From session milestoneCelebrations
  for (const s of sessions) {
    if (s.milestoneCelebrations) {
      const mc = Array.isArray(s.milestoneCelebrations) ? s.milestoneCelebrations : [];
      for (const m of mc) {
        if (!seenTitles.has(m.title)) {
          seenTitles.add(m.title);
          milestones.push(m);
        }
      }
    }
  }

  // Also pull recent child milestones
  const childMilestones = await prisma.childMilestone.findMany({
    where: { childId },
    include: { MilestoneLibrary: true },
    orderBy: { updatedAt: 'desc' },
    take: 5,
  });
  for (const cm of childMilestones) {
    const title = cm.MilestoneLibrary.displayTitle;
    if (!seenTitles.has(title)) {
      seenTitles.add(title);
      milestones.push({
        status: cm.status,
        category: cm.MilestoneLibrary.category,
        title,
        actionTip: cm.MilestoneLibrary.actionTip,
      });
    }
  }

  // Build scenario cards from coaching cards
  const scenarioCards = [];
  for (const s of sessions) {
    if (s.coachingCards) {
      const cards = Array.isArray(s.coachingCards) ? s.coachingCards : Object.values(s.coachingCards);
      for (const card of cards.slice(0, 2)) {
        if (card.scenario) {
          scenarioCards.push({
            label: card.scenario.context || card.title,
            body: card.coaching_tip,
            exampleScript: card.scenario.try_this,
          });
        }
      }
    }
  }

  // Determine best skill for celebration title
  const bestSkill = totalNarrate >= totalPraise && totalNarrate >= totalEcho
    ? 'Narrator'
    : totalPraise >= totalEcho ? 'Encourager' : 'Listener';

  const report = await prisma.weeklyReport.create({
    data: {
      userId,
      childId,
      weekStartDate,
      weekEndDate,
      visibility: true,
      headline: 'Anya felt seen and safe in your play this week',
      totalDeposits: totalPraise + totalEcho + totalNarrate,
      massageTimeMinutes: Math.round(totalDuration / 60),
      praiseCount: totalPraise,
      echoCount: totalEcho,
      narrateCount: totalNarrate,
      skillCelebrationTitle: "You're an excellent " + bestSkill,
      scenarioCards,
      topMoments,
      milestones,
      focusHeading: 'Stay consistent with follow-through during transitions and requests.',
      focusSubtext: "You don't need to be perfect \u2014 just consistent.",
      whyExplanation: 'When Anya sees that your words match your actions, she learns that boundaries are safe and predictable. This consistency reduces anxiety and makes cooperation more natural over time.',
      sessionIds: sessions.map(s => s.id),
    },
  });

  console.log('Created WeeklyReport:', report.id);
  console.log(JSON.stringify(report, null, 2));
}

main()
  .catch(e => { console.error(e); process.exit(1); })
  .finally(() => prisma.$disconnect());
