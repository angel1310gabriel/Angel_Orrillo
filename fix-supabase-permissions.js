// Fix Supabase schema permissions directly via PostgreSQL
require('dotenv').config({ path: '.env.local' });
const { Client } = require('pg');

const url = process.env.DATABASE_URL;
if (!url) { console.error('Missing DATABASE_URL'); process.exit(1); }

async function main() {
  const client = new Client({ connectionString: url, ssl: { rejectUnauthorized: false } });
  await client.connect();
  console.log('Connected to Supabase PostgreSQL');

  // Grant schema usage and table permissions
  await client.query('GRANT USAGE ON SCHEMA public TO anon, authenticated, service_role;');
  console.log('✓ GRANT USAGE ON SCHEMA public');

  await client.query('GRANT ALL ON ALL TABLES IN SCHEMA public TO anon, authenticated, service_role;');
  console.log('✓ GRANT ALL ON ALL TABLES');

  await client.query('GRANT ALL ON ALL SEQUENCES IN SCHEMA public TO anon, authenticated, service_role;');
  console.log('✓ GRANT ALL ON ALL SEQUENCES');

  // Disable RLS on all tables
  const { rows: tables } = await client.query("SELECT tablename FROM pg_tables WHERE schemaname='public'");
  for (const t of tables) {
    await client.query(`ALTER TABLE ${t.tablename} DISABLE ROW LEVEL SECURITY;`);
    console.log(`✓ DISABLE RLS on ${t.tablename}`);
  }

  // Set default privileges for future tables
  await client.query('ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL ON TABLES TO anon, authenticated, service_role;');
  await client.query('ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL ON SEQUENCES TO anon, authenticated, service_role;');
  console.log('✓ Default privileges set');

  // Verify
  const { rows: privs } = await client.query("SELECT grantee, privilege_type, table_schema, table_name FROM information_schema.role_table_grants WHERE table_schema='public' AND grantee IN ('anon','authenticated','service_role') LIMIT 10");
  console.log('\nSample grants:', JSON.stringify(privs, null, 2));

  await client.end();
  console.log('\n✅ All permissions fixed!');
}

main().catch(err => { console.error('Error:', err.message); process.exit(1); });
