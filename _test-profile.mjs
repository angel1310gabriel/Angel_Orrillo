import { PrismaClient } from '@prisma/client';
const p = new PrismaClient();
const r = await p.profiles.findFirst({ where: { firebase_uid: 'rAUQ7gUAMFgEc4QcZlLiPMR4ZFs2' }, select: { name: true, email: true, role: true, firebase_uid: true } });
console.log(JSON.stringify(r));
await p.$disconnect();
