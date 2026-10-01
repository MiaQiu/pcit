#!/usr/bin/env node
'use strict';

// Syncs DemoVideo + DemoVideoTranslation from dev to prod. Deliberately
// does NOT touch UserDemoVideoProgress — that's per-user prod state, not
// content. See doc/contentv2_prod_deploy.dm Phase 2 for the full plan.
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
    const { rows: videos } = await dev.query(`SELECT * FROM "DemoVideo" ORDER BY "displayOrder"`);
    const { rows: translations } = await dev.query(`SELECT * FROM "DemoVideoTranslation"`);
    console.log(`Dev: ${videos.length} demo videos, ${translations.length} translations`);

    await prod.query('BEGIN');

    let videosUpserted = 0;
    for (const v of videos) {
      await prod.query(`
        INSERT INTO "DemoVideo" (id, title, description, "additionalText", "videoUrl", "thumbnailUrl",
          "lessonId", "isActive", "displayOrder", "createdAt", "updatedAt")
        VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11)
        ON CONFLICT (id) DO UPDATE SET
          title            = EXCLUDED.title,
          description      = EXCLUDED.description,
          "additionalText" = EXCLUDED."additionalText",
          "videoUrl"       = EXCLUDED."videoUrl",
          "thumbnailUrl"   = EXCLUDED."thumbnailUrl",
          "lessonId"       = EXCLUDED."lessonId",
          "isActive"       = EXCLUDED."isActive",
          "displayOrder"   = EXCLUDED."displayOrder",
          "updatedAt"      = EXCLUDED."updatedAt"
      `, [v.id, v.title, v.description, v.additionalText, v.videoUrl, v.thumbnailUrl,
          v.lessonId, v.isActive, v.displayOrder, v.createdAt, v.updatedAt]);
      videosUpserted++;
    }
    console.log(`Upserted ${videosUpserted} demo videos.`);

    let transUpserted = 0;
    for (const t of translations) {
      await prod.query(`
        INSERT INTO "DemoVideoTranslation" ("demoVideoId", locale, title, description, "additionalText",
          "videoUrl", "autoTranslated", reviewed, "translatedAt")
        VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9)
        ON CONFLICT ("demoVideoId", locale) DO UPDATE SET
          title            = EXCLUDED.title,
          description      = EXCLUDED.description,
          "additionalText" = EXCLUDED."additionalText",
          "videoUrl"       = EXCLUDED."videoUrl",
          "autoTranslated" = EXCLUDED."autoTranslated",
          reviewed         = EXCLUDED.reviewed,
          "translatedAt"   = EXCLUDED."translatedAt"
      `, [t.demoVideoId, t.locale, t.title, t.description, t.additionalText,
          t.videoUrl, t.autoTranslated, t.reviewed, t.translatedAt]);
      transUpserted++;
    }
    console.log(`Upserted ${transUpserted} demo video translations.`);

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
