require('dotenv').config({ path: '.env.local' });
const { Client } = require('pg');

async function main() {
  const client = new Client({ connectionString: process.env.DATABASE_URL, ssl: { rejectUnauthorized: false } });
  await client.connect();
  const { rows } = await client.query(
    "SELECT grantee, privilege_type, table_name FROM information_schema.role_table_grants WHERE table_schema='public' AND grantee='anon' AND table_name='profiles'"
  );
  console.log('anon permissions on profiles:', JSON.stringify(rows, null, 2));
  const { rows: rls } = await client.query(
    "SELECT tablename, rowsecurity FROM pg_tables WHERE schemaname='public' AND tablename='profiles'"
  );
  console.log('RLS status:', JSON.stringify(rls, null, 2));
  await client.end();
}
main().catch(console.error);
