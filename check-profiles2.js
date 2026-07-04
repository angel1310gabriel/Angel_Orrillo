const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function check() {
  // Check profiles by auth IDs
  const profiles = await prisma.profiles.findMany({
    where: {
      id: {
        in: [
          '5d4b78e2-f732-44f1-a5e6-d6caf75903f1', // angel
          '7e79c902-a74b-4358-b335-b1ca37a453ae'  // keysy
        ]
      }
    },
    select: { id: true, email: true, name: true, role: true, is_active: true }
  });
  console.log('Profiles by auth ID:', JSON.stringify(profiles, null, 2));
  
  // Also check by email
  const byEmail = await prisma.profiles.findMany({
    where: {
      OR: [
        { email: 'angelorrillo1@gmail.com' },
        { email: 'keysyotero@gmail.com' },
        { email: '71208379@temp.kc.com' }
      ]
    },
    select: { id: true, email: true, name: true, role: true, is_active: true }
  });
  console.log('Profiles by email:', JSON.stringify(byEmail, null, 2));
  
  await prisma.$disconnect();
}

check().catch(e => { console.error(e); process.exit(1); });