// Set app_metadata.role on auth users so it's available in JWT
// This bypasses the need to read profiles table (which has RLS issues)
const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: '.env.local' });

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!url || !serviceKey) {
  console.error('Missing env vars');
  process.exit(1);
}

const supabase = createClient(url, serviceKey, { auth: { persistSession: false } });

async function main() {
  // Keysy Otero - admin
  const { error: err1 } = await supabase.auth.admin.updateUserById(
    '7e79c902-a74b-4358-b335-b1ca37a453ae',
    { app_metadata: { role: 'admin' } }
  );
  if (err1) console.error('Keysy error:', err1.message);
  else console.log('✓ Keysy set to admin');

  // Angel Orrillo - collector
  const { error: err2 } = await supabase.auth.admin.updateUserById(
    '5d4b78e2-f732-44f1-a5e6-d6caf75903f1',
    { app_metadata: { role: 'collector' } }
  );
  if (err2) console.error('Angel error:', err2.message);
  else console.log('✓ Angel set to collector');

  // Verify
  for (const uid of [
    '7e79c902-a74b-4358-b335-b1ca37a453ae',
    '5d4b78e2-f732-44f1-a5e6-d6caf75903f1'
  ]) {
    const { data, error } = await supabase.auth.admin.getUserById(uid);
    if (error) console.error(`Verify error for ${uid}:`, error.message);
    else console.log(`User ${uid}: role=${data.user?.app_metadata?.role}, email=${data.user?.email}`);
  }
}

main().catch(console.error);
