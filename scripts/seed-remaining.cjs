const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

/**
 * Seed Lessons Script
 * Populates the database with initial lesson content for the Nora bite-size learning curriculum
 */

async function seedLessons() {
  try {
    console.log('🌱 Starting lesson seeding...\n');

    // Check if lessons already exist
    const existingLessons = await prisma.lesson.count();
    if (existingLessons > 0 && existingLessons < 41) {
      console.log(`⚠️  Found ${existingLessons} existing lessons in database.`);
      console.log('Resuming from where we left off...\n');
    } else if (existingLessons >= 41) {
      console.log(`✅ All 41 lessons already exist in database.`);
      console.log('To reseed, run: npx prisma db execute --stdin <<< "DELETE FROM \\"Lesson\\""');
      console.log('Then run this script again.\n');
      return;
    }

    console.log('Creating lessons...\n');

async function seedRemaining() {
  try {
    console.log('🌱 Seeding remaining lessons (29-41)...
');

    // Get existing lessons for prerequisites
    const existingLessons = await prisma.lesson.findMany({
      orderBy: [{ phaseNumber: 'asc' }, { dayNumber: 'asc' }],
      select: { id: true }
    });

    if (existingLessons.length < 28) {
      console.log('❌ Need 28 existing lessons first');
      return;
    }

    // Build prerequisite array from existing lessons
    const prereqs = {};
    existingLessons.forEach((l, i) => { prereqs[`lesson${i+1}`] = { id: l.id }; });
    const lesson15 = prereqs.lesson15, lesson16 = prereqs.lesson16, lesson17 = prereqs.lesson17, lesson18 = prereqs.lesson18, lesson19 = prereqs.lesson19, lesson20 = prereqs.lesson20, lesson21 = prereqs.lesson21, lesson22 = prereqs.lesson22, lesson23 = prereqs.lesson23, lesson24 = prereqs.lesson24, lesson25 = prereqs.lesson25, lesson26 = prereqs.lesson26, lesson27 = prereqs.lesson27, lesson28 = prereqs.lesson28;

