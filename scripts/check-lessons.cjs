require('dotenv').config();
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function check() {
  try {
    const count = await prisma.lesson.count();
    console.log(`Total lessons in database: ${count}`);

    const lessons = await prisma.lesson.findMany({
      select: { id: true, dayNumber: true, phase: true, title: true },
      orderBy: [{ phaseNumber: 'asc' }, { dayNumber: 'asc' }]
    });

    console.log('\nCreated lessons:');
    lessons.forEach(l => {
      console.log(`  ${l.phase} Day ${l.dayNumber}: ${l.title}`);
    });

    await prisma.$disconnect();
  } catch (e) {
    console.error('Error:', e.message);
    process.exit(1);
  }
}

check();
