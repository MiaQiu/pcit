const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient({
  datasources: { db: { url: 'postgresql://nora_admin:D7upDeIjZc1S1BG6Mca1QxKzVqxF4Bbw@localhost:5432/nora_dev' }}
});

async function checkColumns() {
  try {
    const result = await prisma.$queryRaw`
      SELECT column_name, data_type, is_nullable
      FROM information_schema.columns
      WHERE table_name = 'User'
      ORDER BY ordinal_position
    `;
    console.log('User table columns:');
    result.forEach(col => {
      console.log(`  ${col.column_name} (${col.data_type}, ${col.is_nullable === 'YES' ? 'nullable' : 'not null'})`);
    });

    const hasProfileImageUrl = result.some(col => col.column_name === 'profileImageUrl');
    console.log(`\n✓ Has profileImageUrl column? ${hasProfileImageUrl}`);
  } catch (error) {
    console.error('Error:', error);
  } finally {
    await prisma.$disconnect();
  }
}

checkColumns();
