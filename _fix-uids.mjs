import { PrismaClient } from '@prisma/client';
const p = new PrismaClient();

const oldId = '7e79c902-a74b-4358-b335-b1ca37a453ae';
const newId = 'rAUQ7gUAMFgEc4QcZlLiPMR4ZFs2';

// Check references
const tables = [
  { name:'caja', fk:'collector_id' },
  { name:'clients', fk:'collector_id' },
  { name:'charge_off', fk1:'original_collector_id', fk2:'recovery_collector_id' },
  { name:'collector_current_location', fk:'collector_id' },
  { name:'collector_expenses', fk:'collector_id' },
  { name:'collector_locations', fk:'collector_id' },
  { name:'collector_zones', fk:'collector_id' },
  { name:'daily_settlements', fk:'collector_id' },
  { name:'loans', fk:'collector_id' },
  { name:'loans', fk2:'recovery_collector_id' },
  { name:'payments', fk:'collector_id' },
  { name:'chat_messages', fk:'collector_id' },
];

for (const t of tables) {
  if (t.fk) {
    const q = `SELECT COUNT(*) as cnt FROM "${t.name}" WHERE "${t.fk}" = '${oldId}'`;
    const r = await p.$queryRawUnsafe(q);
    console.log(`${t.name}.${t.fk}: ${r[0].cnt}`);
  }
  if (t.fk2) {
    const q = `SELECT COUNT(*) as cnt FROM "${t.name}" WHERE "${t.fk2}" = '${oldId}'`;
    const r = await p.$queryRawUnsafe(q);
    console.log(`${t.name}.${t.fk2}: ${r[0].cnt}`);
  }
}

await p.$disconnect();
