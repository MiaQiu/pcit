const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient();

async function getSession() {
  try {
    const session = await prisma.session.findUnique({
      where: {
        id: '67264850-64fe-4ca2-b21d-3fbe84398d51'
      }
    });

    if (session) {
      console.log(JSON.stringify(session, null, 2));
    } else {
      console.log('Session not found');
    }
  } catch (error) {
    console.error('Error:', error.message);
  } finally {
    await prisma.$disconnect();
  }
}

getSession();
