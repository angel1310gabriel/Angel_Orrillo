const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient();

async function main() {
  console.log('🌱 Initializing clean database...');

  // Use upsert so it doesn't fail if settings already exist
  const settings = [
    { key: 'capital', value: '0' },
    { key: 'late_fee_rate_per_day', value: '2.0' },
    { key: 'late_fee_enabled', value: 'true' },
    { key: 'mora_threshold_days', value: '1' },
    { key: 'auto_mora_enabled', value: 'true' },
    { key: 'cron_last_run', value: '' },
    { key: 'max_credit_score', value: '100' },
    { key: 'min_credit_score_for_loan', value: '20' },
  ];

  for (const setting of settings) {
    await prisma.setting.upsert({
      where: { key: setting.key },
      update: { value: setting.value },
      create: setting,
    });
  }

  console.log('✅ Database initialized!');
  console.log('   - Default settings created');
  console.log('   - No users, clients, loans, or payments');
  console.log('   - Zones and profiles sync from Supabase on login');
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
