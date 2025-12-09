/**
 * Script to set trial dates for existing users
 * Sets a 30-day trial period for users who don't have subscription dates
 */

const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient();

async function setTrialDates() {
  try {
    console.log('Setting trial dates for existing users...\n');

    // Find users without trial dates set
    const usersWithoutTrialDates = await prisma.user.findMany({
      where: {
        OR: [
          { trialStartDate: null },
          { trialEndDate: null }
        ]
      },
      select: {
        id: true,
        email: true,
        createdAt: true,
        subscriptionPlan: true,
        subscriptionStatus: true
      }
    });

    console.log(`Found ${usersWithoutTrialDates.length} users without trial dates\n`);

    if (usersWithoutTrialDates.length === 0) {
      console.log('No users to update. All users have trial dates set.');
      return;
    }

    // Update each user
    let updatedCount = 0;
    for (const user of usersWithoutTrialDates) {
      const now = new Date();
      const trialEndDate = new Date(now);
      trialEndDate.setDate(trialEndDate.getDate() + 30);

      await prisma.user.update({
        where: { id: user.id },
        data: {
          subscriptionPlan: user.subscriptionPlan || 'TRIAL',
          subscriptionStatus: user.subscriptionStatus || 'ACTIVE',
          trialStartDate: now,
          trialEndDate: trialEndDate
        }
      });

      updatedCount++;
      console.log(`✓ Updated user ${updatedCount}/${usersWithoutTrialDates.length}`);
    }

    console.log(`\n✅ Successfully set trial dates for ${updatedCount} users`);

  } catch (error) {
    console.error('Error setting trial dates:', error);
    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
}

setTrialDates();
