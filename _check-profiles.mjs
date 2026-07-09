import { PrismaClient } from '@prisma/client';
const p = new PrismaClient();
const r = await p.profiles.findMany({ orderBy: {created_at:'desc'}, take: 10 });
for (const x of r) {
  console.log(JSON.stringify({
    id: x.id?.slice(0,12),
    name: x.name,
    email: x.email,
    dni: x.dni,
    phone: x.phone,
    role: x.role,
    loginMethod: x.login_method,
    created: x.created_at
  }));
}
await p.$disconnect();
