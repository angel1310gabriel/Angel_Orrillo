const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function check() {
  const profiles = await prisma.profiles.findMany({
    where: {
      OR: [
        { email: 'keysyotero@gmail.com' },
        { email: 'angelorrillo1@gmail.com' },
        { id: '7e79c902-a74b-4358-b335-b1ca37a453ae' },
        { id: '5d4b78e2-f732-44f1-a5e6-d6caf75903f1' }
      ]
    },
    select: { id: true, email: true, name: true, role: true, is_active: true }
  });
  console.log('Current profiles:', JSON.stringify(profiles, null, 2));
  await prisma.$disconnect();
}

check().catch(console.error);