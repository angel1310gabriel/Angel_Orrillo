const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function check() {
  // Query auth.users via raw SQL since Prisma model was removed
  const users = await prisma.$queryRaw`
    SELECT id, email, raw_user_meta_data, raw_app_meta_data, created_at
    FROM auth.users
    WHERE email ILIKE '%keysy%' OR email ILIKE '%angel%'
    ORDER BY created_at DESC
    LIMIT 10
  `;
  console.log('Auth users found:', JSON.stringify(users, null, 2));
  await prisma.$disconnect();
}

check().catch(e => { console.error(e); process.exit(1); });