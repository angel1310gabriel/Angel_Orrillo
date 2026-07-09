import { PrismaClient } from '@prisma/client';
const p = new PrismaClient();

// Find user
const users = await p.profiles.findMany({
  where: { email: 'keysyotero@gmail.com' },
  select: { id: true, name: true, email: true, role: true, dni: true }
});
console.log('Found:', JSON.stringify(users));

if (users.length > 0) {
  const uid = users[0].id;
  await p.profiles.update({
    where: { id: uid },
    data: { role: 'admin' }
  });
  const updated = await p.profiles.findUnique({
    where: { id: uid },
    select: { id: true, name: true, email: true, role: true }
  });
  console.log('Updated:', JSON.stringify(updated));
} else {
  console.log('User not found');
}
await p.$disconnect();
