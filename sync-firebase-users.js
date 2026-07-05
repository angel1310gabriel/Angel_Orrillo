const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();
const API_KEY = 'AIzaSyCYbYHvlGwOLY071631rtb2A-j0MVPQeMo';

async function main() {
  const profiles = await prisma.profiles.findMany({
    where: { role: { in: ['collector', 'supervisor', 'admin'] } },
    select: { id: true, email: true, name: true, role: true },
  });
  console.log(`Found ${profiles.length} profiles in database\n`);

  for (const p of profiles) {
    const email = p.email || `${p.name?.toLowerCase().replace(/\s+/g,'.' )||p.id.substring(0,8)}@kc-cobranzas.app`;
    process.stdout.write(`${p.name || '?'} (${email})... `);

    const res = await fetch(
      `https://identitytoolkit.googleapis.com/v1/accounts:signUp?key=${API_KEY}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password: '123456', returnSecureToken: true }),
      }
    );
    const data = await res.json();
    if (data.localId) {
      console.log(`✓ Created (UID: ${data.localId.substring(0,8)}...)`);
      // Update DB profile email to match Firebase
      await prisma.profiles.update({ where: { id: p.id }, data: { email } });
    } else if (data.error?.message === 'EMAIL_EXISTS') {
      console.log(`✓ Already exists in Firebase`);
    } else {
      console.log(`✗ ${data.error?.message || 'unknown error'}`);
    }
  }
  await prisma.$disconnect();
  console.log('\nDone!');
}
main().catch(console.error);
