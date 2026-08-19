// One-off bulk import of "Nora Daily" home cards from a CSV export
// ("Nora Daily - Sheet1.csv"). See conversation/PR notes for the field
// mapping decisions this encodes:
//
//  - cardType: CONTENT if "Read more" is filled, else QUOTE.
//  - CONTENT with Title filled: message = Title\nSub Title, detailTitle =
//    Title, detail body = Read More. Short Content is discarded (Title +
//    Sub Title already cover the on-card headline/description).
//  - CONTENT with Title empty (Read More still filled): detailTitle is
//    derived (heading-line heuristic, else first clause of Short Content),
//    message = Short Content as-is (single block, no split).
//  - QUOTE (Read More empty): message = Short Content, attribution = Author.
//  - Author, when present on a CONTENT row, is appended as a trailing
//    citation line on the detail body (CONTENT cards have no attribution
//    field in the schema).
//  - Rows with nothing but a Category are skipped (blank spreadsheet rows).
//  - The CSV row for "Same-Gender Play Is a Normal Developmental Stage"
//    (Science Bite) is skipped — it already exists in the DB as a hand-
//    edited card under a different badge/copy.
//  - Imported cards are created with isActive=false for review in the admin
//    portal before they go live on mobile.

const fs = require('fs');
const path = require('path');
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

const args = process.argv.slice(2).filter((a) => a !== '--dry-run');
const DRY_RUN = process.argv.includes('--dry-run');
const CSV_PATH = args[0] || '/Users/yihui/Downloads/Nora Daily - Sheet1.csv';
const SKIP_TITLES = new Set(['Same-Gender Play Is a Normal Developmental Stage']);

// ─── RFC4180-ish CSV parser (handles quoted fields with embedded commas,
// newlines, and doubled "" quotes) ──────────────────────────────────────
function parseCsv(text) {
  const rows = [];
  let row = [];
  let field = '';
  let inQuotes = false;
  let i = 0;
  const n = text.length;

  while (i < n) {
    const c = text[i];
    if (inQuotes) {
      if (c === '"') {
        if (text[i + 1] === '"') { field += '"'; i += 2; continue; }
        inQuotes = false; i++; continue;
      }
      field += c; i++; continue;
    }
    if (c === '"') { inQuotes = true; i++; continue; }
    if (c === ',') { row.push(field); field = ''; i++; continue; }
    if (c === '\r') { i++; continue; }
    if (c === '\n') { row.push(field); rows.push(row); row = []; field = ''; i++; continue; }
    field += c; i++;
  }
  if (field.length > 0 || row.length > 0) { row.push(field); rows.push(row); }
  return rows;
}

function normalizeAuthor(author) {
  if (!author) return null;
  const stripped = author.trim().replace(/^[-—\s]+/, '').trim();
  return stripped || null;
}

// Detects a short "heading" first line in Read More text (used when Title
// is blank but Read More still starts with what reads like a title before
// the actual body). Returns { heading, rest } or null if no such line.
function splitLeadingHeading(readMore) {
  const nlIndex = readMore.indexOf('\n');
  if (nlIndex === -1) return null;
  const first = readMore.slice(0, nlIndex).trim();
  const rest = readMore.slice(nlIndex + 1).replace(/^\n+/, '').trim();
  if (!first || !rest) return null;
  if (first.length > 80) return null;
  if (/[.!?]"?$/.test(first)) return null; // reads like a full sentence, not a heading
  return { heading: first, rest };
}

// Fallback title derived from Short Content's first clause/sentence, capped
// to a reasonable headline length.
function deriveTitleFromShortContent(shortContent) {
  const colonIdx = shortContent.indexOf(': ');
  let candidate;
  if (colonIdx !== -1 && colonIdx <= 60) {
    candidate = shortContent.slice(0, colonIdx);
  } else {
    const m = shortContent.match(/^.*?[.!?](?=["')\s]|$)/);
    candidate = m ? m[0] : shortContent;
  }
  candidate = candidate.trim();
  if (candidate.length > 70) candidate = candidate.slice(0, 67).trimEnd() + '…';
  return candidate;
}

function appendAuthor(body, author) {
  const normalized = normalizeAuthor(author);
  if (!normalized) return body;
  return `${body}\n\n— ${normalized}`;
}

async function main() {
  const raw = fs.readFileSync(CSV_PATH, 'utf8');
  const table = parseCsv(raw);
  const header = table[0].map((h) => h.trim());
  const col = (name) => header.indexOf(name);

  const idx = {
    category: col('Category'),
    shortContent: col('Short Content'),
    title: col('Title'),
    subTitle: col('Sub Title'),
    readMore: col('Read more'),
    author: col('Author'),
  };
  for (const [key, i] of Object.entries(idx)) {
    if (i === -1) throw new Error(`CSV missing expected column for "${key}"`);
  }

  const badges = await prisma.homeCardBadge.findMany();
  const badgeByName = new Map(badges.map((b) => [b.name, b]));

  const lastCard = await prisma.homeCard.findFirst({ orderBy: { displayOrder: 'desc' } });
  let nextOrder = lastCard ? lastCard.displayOrder + 1 : 0;

  const created = [];
  const skipped = [];
  const needsReview = [];

  for (let r = 1; r < table.length; r++) {
    const row = table[r];
    if (!row || row.every((f) => !f || !f.trim())) continue; // fully blank line

    const category = (row[idx.category] || '').trim();
    const shortContent = (row[idx.shortContent] || '').trim();
    const title = (row[idx.title] || '').trim();
    const subTitle = (row[idx.subTitle] || '').trim();
    const readMore = (row[idx.readMore] || '').trim();
    const author = (row[idx.author] || '').trim();

    if (!category && !shortContent) continue; // blank spreadsheet row

    if (SKIP_TITLES.has(title)) {
      skipped.push({ row: r + 1, reason: 'duplicate of existing hand-edited card', title });
      continue;
    }

    if (!shortContent && !readMore) {
      skipped.push({ row: r + 1, reason: 'no content (Short Content and Read More both empty)', title });
      continue;
    }

    // QUOTE cards always use the "Today's Thought" badge, regardless of the
    // CSV's Category column (e.g. a "Try This Today" row with no Read More
    // is still a quote-style card on mobile).
    const badgeName = readMore ? category : "Today's Thought";
    const badge = badgeByName.get(badgeName);
    if (!badge) {
      skipped.push({ row: r + 1, reason: `no badge named "${badgeName}"`, title: title || shortContent.slice(0, 40) });
      continue;
    }

    let data;
    if (readMore) {
      // CONTENT card
      let detailTitle;
      let bodyText;
      let message;
      let derivedTitle = false;

      if (title) {
        detailTitle = title;
        message = subTitle ? `${title}\n${subTitle}` : title;
        bodyText = readMore;
      } else {
        const headingSplit = splitLeadingHeading(readMore);
        if (headingSplit) {
          detailTitle = headingSplit.heading;
          bodyText = headingSplit.rest;
        } else {
          detailTitle = deriveTitleFromShortContent(shortContent || readMore);
          bodyText = readMore;
        }
        message = shortContent || detailTitle;
        derivedTitle = true;
      }

      bodyText = appendAuthor(bodyText, author);

      data = {
        cardType: 'CONTENT',
        badgeId: badge.id,
        message,
        messageFontSize: 'MEDIUM',
        messageBold: false,
        messageItalic: false,
        attribution: null,
        detailTitle,
        isActive: false,
        displayOrder: nextOrder++,
        likeCountBase: Math.floor(Math.random() * 401) + 100,
        components: { create: [{ type: 'TEXT', order: 0, text: bodyText }] },
      };
      if (derivedTitle) needsReview.push({ row: r + 1, detailTitle, badge: badgeName });
    } else {
      // QUOTE card
      data = {
        cardType: 'QUOTE',
        badgeId: badge.id,
        message: shortContent,
        messageFontSize: 'MEDIUM',
        messageBold: false,
        messageItalic: false,
        attribution: normalizeAuthor(author),
        detailTitle: null,
        isActive: false,
        displayOrder: nextOrder++,
        likeCountBase: Math.floor(Math.random() * 401) + 100,
      };
    }

    if (DRY_RUN) {
      created.push({ row: r + 1, id: '(dry-run)', cardType: data.cardType, badge: badgeName, preview: (data.message || '').slice(0, 60) });
    } else {
      const homeCard = await prisma.homeCard.create({ data, include: { components: true } });
      created.push({ row: r + 1, id: homeCard.id, cardType: homeCard.cardType, badge: badgeName, preview: (homeCard.message || '').slice(0, 60) });
    }
  }

  console.log(`\n${DRY_RUN ? '[DRY RUN] Would create' : 'Created'} ${created.length} home cards (isActive=false):`);
  for (const c of created) {
    console.log(`  [row ${c.row}] ${c.cardType.padEnd(7)} ${c.badge.padEnd(16)} "${c.preview}"`);
  }

  if (needsReview.length > 0) {
    console.log(`\n${needsReview.length} card(s) got an auto-derived detail title (Title column was blank) — please review in the admin portal:`);
    for (const nr of needsReview) {
      console.log(`  [row ${nr.row}] ${nr.badge}: "${nr.detailTitle}"`);
    }
  }

  if (skipped.length > 0) {
    console.log(`\nSkipped ${skipped.length} row(s):`);
    for (const s of skipped) {
      console.log(`  [row ${s.row}] ${s.title || '(no title)'} — ${s.reason}`);
    }
  }
}

main()
  .catch((err) => { console.error(err); process.exitCode = 1; })
  .finally(() => prisma.$disconnect());
