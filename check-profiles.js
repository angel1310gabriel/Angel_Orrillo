const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function check() {
  const profiles = await prisma.profiles.findMany({
    where: {
      OR: [
        { email: { contains: 'keysy', mode: 'insensitive' } },
        { email: { contains: 'angel', mode: 'insensitive' } }
      ]
    },
    select: { id: true, email: true, name: true, role: true, is_active: true }
  });
  console.log('Profiles found:', JSON.stringify(profiles, null, 2));
  await prisma.$disconnect();
}

check().catch(e => { console.error(e); process.exit(1); });