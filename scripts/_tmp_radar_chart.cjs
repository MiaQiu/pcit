/**
 * Temp script: plot developmental radar chart for a child from prod DB.
 * Requires prod tunnel running on localhost:5433 (run scripts/start-prod-db-tunnel.sh first).
 *
 * Usage: node scripts/_tmp_radar_chart.cjs
 */

require('dotenv').config();
const { Client } = require('pg');
const fs = require('fs');
const path = require('path');

const CHILD_ID = 'a44fa924-caa9-453b-936a-0ea0291eaf7f';
const DOMAINS = ['Language', 'Cognitive', 'Social', 'Emotional', 'Connection'];

const client = new Client({
  connectionString: 'postgresql://nora_admin:SvnD5rjj9MSlb0xGeCstfzn5e7ZcSdkR@localhost:5433/nora',
  ssl: { rejectUnauthorized: false }
});

// Parse age range from groupingStage string e.g. "Stage I (12-26m)" -> { start: 12, end: 26 }
function parseAgeRange(groupingStage) {
  const match = groupingStage.match(/\((\d+)-?(\d+)?m?\+?\)/);
  if (match) {
    const start = parseInt(match[1], 10);
    const end = match[2] ? parseInt(match[2], 10) : 84;
    return { start, end };
  }
  return { start: 0, end: 84 };
}

function calculateBenchmark(category, milestonesByDomainAndStage, childAgeMonths) {
  const stages = milestonesByDomainAndStage[category];
  if (!stages) return 0;

  let benchmark = 0;
  const stageEntries = Object.entries(stages)
    .map(([stage, milestones]) => ({ stage, milestones, range: parseAgeRange(stage) }))
    .sort((a, b) => a.range.start - b.range.start);

  for (const { milestones, range } of stageEntries) {
    const stageCount = milestones.length;
    if (childAgeMonths >= range.end) {
      benchmark += stageCount;
    } else if (childAgeMonths >= range.start) {
      const progress = (childAgeMonths - range.start) / (range.end - range.start);
      benchmark += stageCount * progress;
    }
  }

  return Math.round(benchmark * 100) / 100;
}

// SVG radar chart generator (mirrors RadarChart.tsx logic)
function generateSVG(domainData, childAgeMonths, childName) {
  const SIZE = 320;
  const CENTER = SIZE / 2;
  const MAX_RADIUS = SIZE / 2 - 50;

  function polarToCartesian(radius, angleDeg) {
    const rad = ((angleDeg - 90) * Math.PI) / 180;
    return {
      x: CENTER + radius * Math.cos(rad),
      y: CENTER + radius * Math.sin(rad),
    };
  }

  function pentagonPoints(radius) {
    return DOMAINS.map((_, i) => polarToCartesian(radius, (i * 360) / 5));
  }

  function pts(points) {
    return points.map(p => `${p.x.toFixed(1)},${p.y.toFixed(1)}`).join(' ');
  }

  // Normalize values
  const childValues = DOMAINS.map(d => {
    const dd = domainData[d];
    if (!dd || dd.total === 0) return 0;
    return ((dd.achieved + dd.emerging * 0.5) / dd.total) * 100;
  });

  const benchmarkValues = DOMAINS.map(d => {
    const dd = domainData[d];
    if (!dd || dd.total === 0) return 0;
    return (dd.benchmark / dd.total) * 100;
  });

  const childPoints = childValues.map((v, i) => polarToCartesian((v / 100) * MAX_RADIUS, (i * 360) / 5));
  const benchmarkPoints = benchmarkValues.map((v, i) => polarToCartesian((v / 100) * MAX_RADIUS, (i * 360) / 5));

  const gridRadii = [MAX_RADIUS * 0.333, MAX_RADIUS * 0.667, MAX_RADIUS];

  // Grid pentagons
  const gridSVG = gridRadii.map((r, i) =>
    `<polygon points="${pts(pentagonPoints(r))}" fill="none" stroke="#E5E7EB" stroke-width="1"/>`
  ).join('\n    ');

  // Axis lines
  const axesSVG = DOMAINS.map((_, i) => {
    const end = polarToCartesian(MAX_RADIUS, (i * 360) / 5);
    return `<line x1="${CENTER}" y1="${CENTER}" x2="${end.x.toFixed(1)}" y2="${end.y.toFixed(1)}" stroke="#E5E7EB" stroke-width="1"/>`;
  }).join('\n    ');

  // Labels
  const labelsSVG = DOMAINS.map((domain, i) => {
    const angle = (i * 360) / 5;
    const pos = polarToCartesian(MAX_RADIUS + 28, angle);
    const anchor = (angle > 45 && angle < 135) ? 'start' : (angle > 225 && angle < 315) ? 'end' : 'middle';
    return `<text x="${pos.x.toFixed(1)}" y="${pos.y.toFixed(1)}" text-anchor="${anchor}" dominant-baseline="middle" font-size="12" font-family="sans-serif" font-weight="600" fill="#1E2939">${domain}</text>`;
  }).join('\n    ');

  // Percentage labels on axes (33%, 66%, 100%)
  const pctLabelsSVG = [33, 66, 100].map((pct, i) => {
    const pos = polarToCartesian(gridRadii[i], 0); // along Language axis (top)
    return `<text x="${(pos.x + 3).toFixed(1)}" y="${pos.y.toFixed(1)}" font-size="9" font-family="sans-serif" fill="#9CA3AF">${pct}%</text>`;
  }).join('\n    ');

  // Data point circles for child
  const dotsSVG = childPoints.map((p, i) =>
    `<circle cx="${p.x.toFixed(1)}" cy="${p.y.toFixed(1)}" r="4" fill="#8C49D5"/>`
  ).join('\n    ');

  return `<svg width="${SIZE}" height="${SIZE}" xmlns="http://www.w3.org/2000/svg">
  <!-- Grid -->
  ${gridSVG}
  <!-- Axes -->
  ${axesSVG}
  <!-- % labels -->
  ${pctLabelsSVG}
  <!-- Benchmark polygon -->
  <polygon points="${pts(benchmarkPoints)}" fill="none" stroke="#FF8C42" stroke-width="2" stroke-dasharray="6,4"/>
  <!-- Child polygon -->
  <polygon points="${pts(childPoints)}" fill="rgba(140,73,213,0.3)" stroke="#8C49D5" stroke-width="2"/>
  <!-- Child dots -->
  ${dotsSVG}
  <!-- Domain labels -->
  ${labelsSVG}
</svg>`;
}

async function main() {
  await client.connect();

  // 1. Get child record + age
  const childRes = await client.query(
    `SELECT c.id, c.birthday, u."childName", u."childBirthYear", u."childBirthday"
     FROM "Child" c
     JOIN "User" u ON u.id = c."userId"
     WHERE c.id = $1`,
    [CHILD_ID]
  );

  if (childRes.rows.length === 0) {
    console.error('Child not found:', CHILD_ID);
    await client.end();
    process.exit(1);
  }

  const childRow = childRes.rows[0];

  // Calculate age in months (same logic as server)
  const now = new Date();
  let childAgeMonths = 0;
  const birthdayStr = childRow.birthday || childRow.childBirthday;
  if (birthdayStr) {
    const birthday = new Date(birthdayStr);
    childAgeMonths = (now.getFullYear() - birthday.getFullYear()) * 12 +
      (now.getMonth() - birthday.getMonth());
  } else if (childRow.childBirthYear) {
    childAgeMonths = (now.getFullYear() - childRow.childBirthYear) * 12 + 6;
  }

  console.log(`Child ID:  ${CHILD_ID}`);
  console.log(`Age:       ${childAgeMonths} months (${(childAgeMonths / 12).toFixed(1)} years)`);

  // 2. Fetch all milestones from library
  const libRes = await client.query(
    `SELECT id, category, grouping_stage AS "groupingStage", median_age_months AS "medianAgeMonths", display_title AS "displayTitle"
     FROM milestone_library
     ORDER BY category, median_age_months ASC`
  );

  // 3. Fetch child's milestones
  const childMilestonesRes = await client.query(
    `SELECT cm.status, ml.category
     FROM "ChildMilestone" cm
     JOIN milestone_library ml ON ml.id = cm."milestoneId"
     WHERE cm."childId" = $1`,
    [CHILD_ID]
  );

  // Group library milestones by domain+stage
  const milestonesByDomainAndStage = {};
  libRes.rows.forEach(m => {
    if (!milestonesByDomainAndStage[m.category]) milestonesByDomainAndStage[m.category] = {};
    if (!milestonesByDomainAndStage[m.category][m.groupingStage]) milestonesByDomainAndStage[m.category][m.groupingStage] = [];
    milestonesByDomainAndStage[m.category][m.groupingStage].push(m);
  });

  // Build domain progress
  const domainData = {};
  DOMAINS.forEach(domain => {
    const total = libRes.rows.filter(m => m.category === domain).length;
    const achieved = childMilestonesRes.rows.filter(cm => cm.category === domain && cm.status === 'ACHIEVED').length;
    const emerging = childMilestonesRes.rows.filter(cm => cm.category === domain && cm.status === 'EMERGING').length;
    const benchmark = calculateBenchmark(domain, milestonesByDomainAndStage, childAgeMonths);

    domainData[domain] = { achieved, emerging, total, benchmark };
  });

  // Print table
  console.log('\n' + '─'.repeat(75));
  console.log(`${'Domain'.padEnd(12)} ${'Achieved'.padEnd(10)} ${'Emerging'.padEnd(10)} ${'Total'.padEnd(8)} ${'Benchmark'.padEnd(12)} Child%   Bench%`);
  console.log('─'.repeat(75));
  DOMAINS.forEach(d => {
    const dd = domainData[d];
    const childPct = dd.total ? (((dd.achieved + dd.emerging * 0.5) / dd.total) * 100).toFixed(1) : '0.0';
    const benchPct = dd.total ? ((dd.benchmark / dd.total) * 100).toFixed(1) : '0.0';
    console.log(
      `${d.padEnd(12)} ${String(dd.achieved).padEnd(10)} ${String(dd.emerging).padEnd(10)} ${String(dd.total).padEnd(8)} ${String(dd.benchmark).padEnd(12)} ${childPct.padStart(6)}%  ${benchPct.padStart(6)}%`
    );
  });
  console.log('─'.repeat(75));

  // Generate HTML output
  const svg = generateSVG(domainData, childAgeMonths, childRow.childName || 'Child');
  const html = `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <title>Developmental Radar Chart — Child ${CHILD_ID}</title>
  <style>
    body { font-family: sans-serif; background: #f9fafb; display: flex; flex-direction: column; align-items: center; padding: 40px; }
    h2 { color: #1E2939; margin-bottom: 4px; }
    .subtitle { color: #6B7280; font-size: 14px; margin-bottom: 32px; }
    .card { background: white; border-radius: 16px; border: 1px solid #E5E7EB; padding: 32px; display: flex; flex-direction: column; align-items: center; }
    .legend { display: flex; gap: 24px; margin-top: 20px; }
    .legend-item { display: flex; align-items: center; gap: 8px; font-size: 13px; color: #6B7280; }
    .line-child { width: 24px; height: 3px; background: #8C49D5; border-radius: 2px; }
    .line-bench { width: 24px; height: 3px; background: #FF8C42; border-radius: 2px; }
    table { margin-top: 32px; border-collapse: collapse; font-size: 13px; }
    th { background: #F3F4F6; padding: 8px 16px; text-align: left; color: #374151; }
    td { padding: 8px 16px; border-top: 1px solid #E5E7EB; color: #1E2939; }
    .ahead { color: #16a34a; font-weight: 600; }
    .behind { color: #dc2626; }
  </style>
</head>
<body>
  <h2>Developmental Radar Chart</h2>
  <div class="subtitle">Child ID: ${CHILD_ID} &nbsp;·&nbsp; Age: ${childAgeMonths} months (${(childAgeMonths / 12).toFixed(1)} yrs)</div>
  <div class="card">
    ${svg}
    <div class="legend">
      <div class="legend-item"><div class="line-child"></div> Child's Progress</div>
      <div class="legend-item"><div class="line-bench"></div> Age Benchmark</div>
    </div>
  </div>
  <table>
    <thead>
      <tr><th>Domain</th><th>Achieved</th><th>Emerging</th><th>Total</th><th>Child %</th><th>Benchmark %</th><th>Status</th></tr>
    </thead>
    <tbody>
      ${DOMAINS.map(d => {
        const dd = domainData[d];
        const childPct = dd.total ? (((dd.achieved + dd.emerging * 0.5) / dd.total) * 100).toFixed(1) : '0.0';
        const benchPct = dd.total ? ((dd.benchmark / dd.total) * 100).toFixed(1) : '0.0';
        const ahead = parseFloat(childPct) >= parseFloat(benchPct);
        const statusClass = ahead ? 'ahead' : 'behind';
        const statusText = ahead ? '▲ On/ahead of track' : '▼ Below benchmark';
        return `<tr>
          <td><strong>${d}</strong></td>
          <td>${dd.achieved}</td>
          <td>${dd.emerging}</td>
          <td>${dd.total}</td>
          <td>${childPct}%</td>
          <td>${benchPct}%</td>
          <td class="${statusClass}">${statusText}</td>
        </tr>`;
      }).join('')}
    </tbody>
  </table>
</body>
</html>`;

  const outPath = path.join(__dirname, '_tmp_radar_chart_output.html');
  fs.writeFileSync(outPath, html);
  console.log(`\nChart saved to: ${outPath}`);
  console.log('Open it in a browser to view the radar chart.\n');

  await client.end();
}

main().catch(e => {
  console.error('Error:', e.message);
  process.exit(1);
});
