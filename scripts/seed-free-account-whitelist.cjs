/**
 * One-off script: add ALL free account emails to FreeAccountWhitelist.
 * Also grants isFreeAccount immediately if the user already exists.
 */

const crypto = require('crypto');
const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient();

const EMAILS = [
  'ccuchildren@gmail.com',
  'psyycc@gmail.com',
  'bob870507@gmail.com',
  'sam871223@alum.ccu.edu.tw',
  'yeena95123@gmail.com',
  's0961161675@gmail.com',
  'ngel6373071@gmail.com',
  'accbee@gmail.com',
  'heather4113@gmail.com',
];

async function main() {
  console.log(`Seeding whitelist for ${EMAILS.length} emails...\n`);

  for (const email of EMAILS) {
    const normalised = email.trim().toLowerCase();
    const emailHash = crypto.createHash('sha256').update(normalised).digest('hex');

    await prisma.freeAccountWhitelist.upsert({
      where: { emailHash },
      update: {},
      create: { id: crypto.randomUUID(), emailHash, email: normalised },
    });

    const existingUser = await prisma.user.findUnique({ where: { emailHash } });
    if (existingUser && !existingUser.isFreeAccount) {
      await prisma.user.update({ where: { id: existingUser.id }, data: { isFreeAccount: true } });
      console.log(`  WHITELISTED + GRANTED: ${email}`);
    } else if (existingUser) {
      console.log(`  WHITELISTED (already granted): ${email}`);
    } else {
      console.log(`  WHITELISTED (pending signup): ${email}`);
    }
  }

  console.log('\nDone.');
}

main()
  .catch(err => { console.error(err); process.exit(1); })
  .finally(() => prisma.$disconnect());
