#!/usr/bin/env node
'use strict';

// Syncs HomeCardBadge, HomeCard, HomeCardTranslation, HomeCardComponent,
// HomeCardComponentTranslation ("Nora Daily") from dev to prod.
// Deliberately does NOT touch HomeCardLike, HomeCardImpression, or
// HomeCardUserInputResponse — those are per-user prod interaction data,
// not content; this script never queries them. See
// doc/contentv2_prod_deploy.dm Phase 3 for the full plan.
//
// Requires DEV_DATABASE_URL and PROD_DATABASE_URL env vars.

const { Client } = require('pg');
const SSL = { ssl: { rejectUnauthorized: false } };

if (!process.env.DEV_DATABASE_URL || !process.env.PROD_DATABASE_URL) {
  console.error('Set DEV_DATABASE_URL and PROD_DATABASE_URL env vars before running.');
  process.exit(1);
}

const DEV_URL = { connectionString: process.env.DEV_DATABASE_URL, ...SSL };
const PROD_URL = { connectionString: process.env.PROD_DATABASE_URL, ...SSL };

async function main() {
  const dev = new Client(DEV_URL);
  const prod = new Client(PROD_URL);
  await dev.connect();
  await prod.connect();
  console.log('Connected to dev and prod.');

  try {
    const { rows: badges } = await dev.query(`SELECT * FROM "HomeCardBadge"`);
    const { rows: cards } = await dev.query(`SELECT * FROM "HomeCard" ORDER BY "displayOrder"`);
    const { rows: cardTranslations } = await dev.query(`SELECT * FROM "HomeCardTranslation"`);
    const { rows: components } = await dev.query(`SELECT * FROM "HomeCardComponent" ORDER BY "homeCardId", "order"`);
    const { rows: componentTranslations } = await dev.query(`SELECT * FROM "HomeCardComponentTranslation"`);

    console.log(
      `Dev: ${badges.length} badges, ${cards.length} cards, ${cardTranslations.length} card translations, ` +
      `${components.length} components, ${componentTranslations.length} component translations`
    );

    await prod.query('BEGIN');

    // --- Badges first (HomeCard.badgeId FK depends on these) ---
    // HomeCardBadge rows get a random id per environment (migration
    // 20260730154210_add_home_card_badges_and_components seeds the 5
    // defaults with gen_random_uuid() independently in dev and prod), so
    // dev's id for "Science Bite" etc. is NOT prod's id for the same name.
    // Match by the unique `name` and build a dev-id -> prod-id map; only
    // insert with dev's id for a genuinely new name prod doesn't have yet.
    const badgeIdMap = {}; // devBadgeId -> prodBadgeId
    let badgesUpserted = 0;
    for (const b of badges) {
      const existing = await prod.query(`SELECT id FROM "HomeCardBadge" WHERE name = $1`, [b.name]);
      if (existing.rows.length > 0) {
        const prodId = existing.rows[0].id;
        badgeIdMap[b.id] = prodId;
        await prod.query(`UPDATE "HomeCardBadge" SET color = $1 WHERE id = $2`, [b.color, prodId]);
      } else {
        await prod.query(`INSERT INTO "HomeCardBadge" (id, name, color, "createdAt") VALUES ($1,$2,$3,$4)`,
          [b.id, b.name, b.color, b.createdAt]);
        badgeIdMap[b.id] = b.id;
      }
      badgesUpserted++;
    }
    console.log(`Upserted ${badgesUpserted} home card badges.`);

    // --- HomeCards ---
    let cardsUpserted = 0;
    for (const c of cards) {
      await prod.query(`
        INSERT INTO "HomeCard" (id, "cardType", "badgeId", message, "messageFontSize", "messageBold",
          "messageItalic", attribution, image, "detailTitle", "isActive", "displayOrder", "likeCountBase",
          "targetTags", "minAgeMonths", "maxAgeMonths", "targetGender", "createdAt", "updatedAt")
        VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18,$19)
        ON CONFLICT (id) DO UPDATE SET
          "cardType"        = EXCLUDED."cardType",
          "badgeId"         = EXCLUDED."badgeId",
          message           = EXCLUDED.message,
          "messageFontSize" = EXCLUDED."messageFontSize",
          "messageBold"     = EXCLUDED."messageBold",
          "messageItalic"   = EXCLUDED."messageItalic",
          attribution       = EXCLUDED.attribution,
          image             = EXCLUDED.image,
          "detailTitle"     = EXCLUDED."detailTitle",
          "isActive"        = EXCLUDED."isActive",
          "displayOrder"    = EXCLUDED."displayOrder",
          "likeCountBase"   = EXCLUDED."likeCountBase",
          "targetTags"      = EXCLUDED."targetTags",
          "minAgeMonths"    = EXCLUDED."minAgeMonths",
          "maxAgeMonths"    = EXCLUDED."maxAgeMonths",
          "targetGender"    = EXCLUDED."targetGender",
          "updatedAt"       = EXCLUDED."updatedAt"
      `, [c.id, c.cardType, badgeIdMap[c.badgeId], c.message, c.messageFontSize, c.messageBold,
          c.messageItalic, c.attribution, c.image, c.detailTitle, c.isActive, c.displayOrder, c.likeCountBase,
          c.targetTags, c.minAgeMonths, c.maxAgeMonths, c.targetGender, c.createdAt, c.updatedAt]);
      cardsUpserted++;
    }
    console.log(`Upserted ${cardsUpserted} home cards.`);

    // --- HomeCardTranslations ---
    let cardTransUpserted = 0;
    for (const t of cardTranslations) {
      await prod.query(`
        INSERT INTO "HomeCardTranslation" ("homeCardId", locale, message, attribution, "detailTitle",
          "autoTranslated", reviewed, "translatedAt")
        VALUES ($1,$2,$3,$4,$5,$6,$7,$8)
        ON CONFLICT ("homeCardId", locale) DO UPDATE SET
          message          = EXCLUDED.message,
          attribution      = EXCLUDED.attribution,
          "detailTitle"    = EXCLUDED."detailTitle",
          "autoTranslated" = EXCLUDED."autoTranslated",
          reviewed         = EXCLUDED.reviewed,
          "translatedAt"   = EXCLUDED."translatedAt"
      `, [t.homeCardId, t.locale, t.message, t.attribution, t.detailTitle,
          t.autoTranslated, t.reviewed, t.translatedAt]);
      cardTransUpserted++;
    }
    console.log(`Upserted ${cardTransUpserted} home card translations.`);

    // --- HomeCardComponents ---
    let componentsUpserted = 0;
    for (const c of components) {
      await prod.query(`
        INSERT INTO "HomeCardComponent" (id, "homeCardId", type, "order", text, image, "linkedCardId",
          "ctaLabel", "inputLabel", "inputPlaceholder", "createdAt", "updatedAt")
        VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12)
        ON CONFLICT (id) DO UPDATE SET
          "homeCardId"       = EXCLUDED."homeCardId",
          type               = EXCLUDED.type,
          "order"            = EXCLUDED."order",
          text               = EXCLUDED.text,
          image              = EXCLUDED.image,
          "linkedCardId"     = EXCLUDED."linkedCardId",
          "ctaLabel"         = EXCLUDED."ctaLabel",
          "inputLabel"       = EXCLUDED."inputLabel",
          "inputPlaceholder" = EXCLUDED."inputPlaceholder",
          "updatedAt"        = EXCLUDED."updatedAt"
      `, [c.id, c.homeCardId, c.type, c.order, c.text, c.image, c.linkedCardId,
          c.ctaLabel, c.inputLabel, c.inputPlaceholder, c.createdAt, c.updatedAt]);
      componentsUpserted++;
    }
    console.log(`Upserted ${componentsUpserted} home card components.`);

    // --- HomeCardComponentTranslations ---
    let componentTransUpserted = 0;
    for (const t of componentTranslations) {
      await prod.query(`
        INSERT INTO "HomeCardComponentTranslation" ("componentId", locale, text, "ctaLabel", "inputLabel",
          "inputPlaceholder", "autoTranslated", reviewed, "translatedAt")
        VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9)
        ON CONFLICT ("componentId", locale) DO UPDATE SET
          text               = EXCLUDED.text,
          "ctaLabel"         = EXCLUDED."ctaLabel",
          "inputLabel"       = EXCLUDED."inputLabel",
          "inputPlaceholder" = EXCLUDED."inputPlaceholder",
          "autoTranslated"   = EXCLUDED."autoTranslated",
          reviewed           = EXCLUDED.reviewed,
          "translatedAt"     = EXCLUDED."translatedAt"
      `, [t.componentId, t.locale, t.text, t.ctaLabel, t.inputLabel,
          t.inputPlaceholder, t.autoTranslated, t.reviewed, t.translatedAt]);
      componentTransUpserted++;
    }
    console.log(`Upserted ${componentTransUpserted} home card component translations.`);

    await prod.query('COMMIT');
    console.log('\nSync complete.');
  } catch (err) {
    await prod.query('ROLLBACK');
    console.error('ERROR — rolled back:', err.message);
    process.exit(1);
  } finally {
    await dev.end();
    await prod.end();
  }
}

main();
