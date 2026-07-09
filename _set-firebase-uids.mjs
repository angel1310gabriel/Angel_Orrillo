import { PrismaClient } from '@prisma/client';
const p = new PrismaClient();

const mappings = [
  { name:'Keysy',    email:'keysyotero@gmail.com',     firebaseUid:'rAUQ7gUAMFgEc4QcZlLiPMR4ZFs2' },
  { name:'Angel',    email:'angelorrillo1@gmail.com',  firebaseUid:'Pu753r4dyLNMMdwiHbmMMJR4N7s1' },
  { name:'Michelle', email:'michelleosorio@gmail.com', firebaseUid:'jg2PGf02loS8y4YPs4TBqBb9TXF2' },
];

for (const m of mappings) {
  const profile = await p.profiles.findFirst({ where: { email: m.email } });
  if (!profile) { console.log(`${m.name}: NOT FOUND`); continue; }
  await p.profiles.update({
    where: { id: profile.id },
    data: { firebase_uid: m.firebaseUid }
  });
  console.log(`${m.name}: firebase_uid set to ${m.firebaseUid}`);
}

await p.$disconnect();
