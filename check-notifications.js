const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function check() {
  try {
    const result = await prisma.$queryRaw`
      SELECT table_name 
      FROM information_schema.tables 
      WHERE table_schema = 'public' 
      AND table_name = 'notifications'
    `;
    console.log('Notifications table exists:', result.length > 0);
    
    // Also check columns
    const columns = await prisma.$queryRaw`
      SELECT column_name, data_type 
      FROM information_schema.columns 
      WHERE table_schema = 'public' 
      AND table_name = 'notifications'
      ORDER BY ordinal_position
    `;
    console.log('Columns:', columns);
  } catch (e) {
    console.error('Error:', e.message);
  }
  await prisma.$disconnect();
}

check();