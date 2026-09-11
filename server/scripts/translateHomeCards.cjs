'use strict';

/**
 * Home Card translation migration script — same shape as translateLessons.cjs.
 * Translates all Home Cards (message/attribution/detailTitle) and their
 * detail-page components (text/ctaLabel/inputLabel/inputPlaceholder) into
 * configured target locales using Claude API.
 * Safe to re-run: skips cards/components that are already reviewed; upserts
 * auto-translated ones.
 *
 * Usage:
 *   node server/scripts/translateHomeCards.cjs [locale]
 *   node server/scripts/translateHomeCards.cjs zh-TW
 *   node server/scripts/translateHomeCards.cjs          # translates all TARGET_LOCALES
 */

require('dotenv').config();

const prisma = require('../services/db.cjs');
const { translateHomeCardBundle, LOCALE_NAMES } = require('../services/translationService.cjs');

const TARGET_LOCALES = Object.keys(LOCALE_NAMES); // ['zh-TW', 'zh-CN']

function buildBundle(card) {
  return {
    card: {
      message: card.message,
      attribution: card.attribution ?? null,
      detailTitle: card.detailTitle ?? null,
    },
    components: card.components.map((c) => ({
      text: c.text ?? null,
      ctaLabel: c.ctaLabel ?? null,
      inputLabel: c.inputLabel ?? null,
      inputPlaceholder: c.inputPlaceholder ?? null,
    })),
  };
}

async function saveTranslation(card, translated, locale) {
  const ops = [
    prisma.homeCardTranslation.upsert({
      where: { homeCardId_locale: { homeCardId: card.id, locale } },
      create: {
        homeCardId: card.id,
        locale,
        message: translated.card.message,
        attribution: translated.card.attribution,
        detailTitle: translated.card.detailTitle,
      },
      update: {
        message: translated.card.message,
        attribution: translated.card.attribution,
        detailTitle: translated.card.detailTitle,
        translatedAt: new Date(),
      },
    }),
    ...card.components.map((comp, i) => {
      const txComp = translated.components[i];
      return prisma.homeCardComponentTranslation.upsert({
        where: { componentId_locale: { componentId: comp.id, locale } },
        create: {
          componentId: comp.id,
          locale,
          text: txComp.text,
          ctaLabel: txComp.ctaLabel,
          inputLabel: txComp.inputLabel,
          inputPlaceholder: txComp.inputPlaceholder,
        },
        update: {
          text: txComp.text,
          ctaLabel: txComp.ctaLabel,
          inputLabel: txComp.inputLabel,
          inputPlaceholder: txComp.inputPlaceholder,
          translatedAt: new Date(),
        },
      });
    }),
  ];

  await prisma.$transaction(ops);
}

async function main() {
  const args = process.argv.slice(2);
  const cliLocale = args.find((a) => !a.startsWith('--'));
  const limitArg = args.find((a) => a.startsWith('--limit='));
  const limit = limitArg ? parseInt(limitArg.split('=')[1], 10) : null;
  // --ids=id1,id2 — retry just specific cards (e.g. after a one-off failure)
  // instead of re-translating everything.
  const idsArg = args.find((a) => a.startsWith('--ids='));
  const ids = idsArg ? idsArg.split('=')[1].split(',') : null;

  const locales = cliLocale ? [cliLocale] : TARGET_LOCALES;

  for (const locale of locales) {
    if (!LOCALE_NAMES[locale]) {
      console.error(`Unknown locale: ${locale}. Supported: ${Object.keys(LOCALE_NAMES).join(', ')}`);
      process.exit(1);
    }
  }

  const cards = await prisma.homeCard.findMany({
    where: ids ? { id: { in: ids } } : undefined,
    include: {
      components: { orderBy: { order: 'asc' } },
    },
    orderBy: { displayOrder: 'asc' },
    ...(limit ? { take: limit } : {}),
  });

  console.log(`Found ${cards.length} home cards. Translating into: ${locales.join(', ')}\n`);

  let ok = 0, skipped = 0, failed = 0;

  for (const locale of locales) {
    for (const card of cards) {
      const existing = await prisma.homeCardTranslation.findUnique({
        where: { homeCardId_locale: { homeCardId: card.id, locale } },
        select: { reviewed: true },
      });

      if (existing?.reviewed) {
        console.log(`  [SKIP] ${card.id} — already reviewed`);
        skipped++;
        continue;
      }

      try {
        process.stdout.write(`  [→] ${card.id}: ${card.message.slice(0, 40)} ... `);
        const bundle = buildBundle(card);
        const translated = await translateHomeCardBundle(bundle, locale);
        await saveTranslation(card, translated, locale);
        console.log('OK');
        ok++;
      } catch (err) {
        console.log(`FAILED: ${err.message}`);
        failed++;
      }
    }
  }

  console.log(`\nDone. OK: ${ok}, Skipped (reviewed): ${skipped}, Failed: ${failed}`);
  await prisma.$disconnect();
}

main().catch((err) => {
  console.error('Fatal:', err);
  process.exit(1);
});
