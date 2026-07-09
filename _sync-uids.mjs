import { PrismaClient } from '@prisma/client';
const p = new PrismaClient();

// Map old DB IDs -> Firebase UIDs
const mappings = [
  { name:'Keysy',    email:'keysyotero@gmail.com',     newUid:'rAUQ7gUAMFgEc4QcZlLiPMR4ZFs2' },
  { name:'Angel',    email:'angelorrillo1@gmail.com',  newUid:'Pu753r4dyLNMMdwiHbmMMJR4N7s1' },
  { name:'Michelle', email:'michelleosorio@gmail.com', newUid:'jg2PGf02loS8y4YPs4TBqBb9TXF2' },
];

for (const m of mappings) {
  // Find old profile
  const profile = await p.profiles.findFirst({ where: { email: m.email } });
  if (!profile) { console.log(`${m.name}: NOT FOUND in DB`); continue; }
  const oldId = profile.id;
  if (oldId === m.newUid) { console.log(`${m.name}: already correct UID`); continue; }

  console.log(`${m.name}: old=${oldId} -> new=${m.newUid}`);

  // Update profile id
  await p.$executeRawUnsafe(`UPDATE profiles SET id = $1 WHERE id = $2`, m.newUid, oldId);
  console.log(`${m.name}: profile id updated`);

  // Update references
  const updates = [
    ['caja', 'collector_id'],
    ['clients', 'collector_id'],
    ['charge_off', 'original_collector_id'],
    ['collector_current_location', 'collector_id'],
    ['collector_expenses', 'collector_id'],
    ['collector_locations', 'collector_id'],
    ['collector_zones', 'collector_id'],
    ['daily_settlements', 'collector_id'],
    ['payments', 'collector_id'],
    ['loans', 'collector_id'],
  ];
  const updates2 = [
    ['charge_off', 'recovery_collector_id'],
    ['loans', 'recovery_collector_id'],
  ];

  for (const [table, fk] of updates) {
    const r = await p.$executeRawUnsafe(`UPDATE "${table}" SET "${fk}" = $1 WHERE "${fk}" = $2`, m.newUid, oldId);
    if (r > 0) console.log(`  ${table}.${fk}: ${r} rows`);
  }
  for (const [table, fk] of updates2) {
    const r = await p.$executeRawUnsafe(`UPDATE "${table}" SET "${fk}" = $1 WHERE "${fk}" = $2`, m.newUid, oldId);
    if (r > 0) console.log(`  ${table}.${fk}: ${r} rows`);
  }
}

console.log('Done');
await p.$disconnect();
