import { PrismaClient } from '@prisma/client';
const p = new PrismaClient();
const r = await p.$queryRawUnsafe(`SELECT column_name, data_type, character_maximum_length FROM information_schema.columns WHERE table_name = 'profiles' AND column_name IN ('id','firebase_uid')`);
console.log(JSON.stringify(r, null, 2));
await p.$disconnect();
