/**
 * One-off script: grant isFreeAccount=true for a list of emails.
 * Uses emailHash for lookup (emails are encrypted in the DB).
 *
 * Usage:
 *   node scripts/set-free-accounts.cjs
 *   DATABASE_URL="..." node scripts/set-free-accounts.cjs   # override for prod
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
  console.log(`Granting free accounts for ${EMAILS.length} emails...\n`);

  for (const email of EMAILS) {
    const emailHash = crypto.createHash('sha256').update(email.toLowerCase()).digest('hex');
    const user = await prisma.user.findUnique({ where: { emailHash }, select: { id: true, isFreeAccount: true } });

    if (!user) {
      console.log(`  NOT FOUND: ${email}`);
      continue;
    }

    if (user.isFreeAccount) {
      console.log(`  ALREADY FREE: ${email}`);
      continue;
    }

    await prisma.user.update({ where: { id: user.id }, data: { isFreeAccount: true } });
    console.log(`  GRANTED: ${email}`);
  }

  console.log('\nDone.');
}

main()
  .catch(err => { console.error(err); process.exit(1); })
  .finally(() => prisma.$disconnect());
