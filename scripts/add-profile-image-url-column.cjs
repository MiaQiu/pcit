const { PrismaClient } = require('@prisma/client');

const DATABASE_URL = 'postgresql://nora_admin:D7upDeIjZc1S1BG6Mca1QxKzVqxF4Bbw@localhost:5432/nora_dev';

const prisma = new PrismaClient({
  datasources: {
    db: {
      url: DATABASE_URL
    }
  }
});

async function addColumn() {
  try {
    console.log('Connecting to production database...');

    // Add the profileImageUrl column if it doesn't exist
    await prisma.$executeRawUnsafe(
      'ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "profileImageUrl" TEXT;'
    );

    console.log('✓ Successfully added profileImageUrl column to User table');

  } catch (error) {
    console.error('Error adding column:', error);
    throw error;
  } finally {
    await prisma.$disconnect();
  }
}

addColumn();
