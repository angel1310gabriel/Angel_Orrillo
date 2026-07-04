const { createClient } = require('@supabase/supabase-js');

const SUPABASE_URL = 'https://pmojbfvmlvtaekqfzasz.supabase.co';
const SERVICE_ROLE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InBtb2piZnZtbHZ0YWVrcWZ6YXN6Iiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc3NjQ2NjkxNiwiZXhwIjoyMDkyMDQyOTE2fQ.iwZR3hmo-CDKINA_wcuzYrnWsB-YGptxni1ZHGLt6tI';

const supabase = createClient(SUPABASE_URL, SERVICE_ROLE_KEY);

async function createProfiles() {
  // Keysy - Admin
  const keysyId = '7e79c902-a74b-4358-b335-b1ca37a453ae';
  const { error: e1 } = await supabase.from('profiles').upsert({
    id: keysyId,
    email: 'keysyotero@gmail.com',
    name: 'Keysy Otero',
    role: 'admin',
    is_active: true,
    created_at: new Date().toISOString(),
  });
  console.log('Keysy profile:', e1 ? 'ERROR: ' + e1.message : 'OK');

  // Angel - Collector
  const angelId = '5d4b78e2-f732-44f1-a5e6-d6caf75903f1';
  const { error: e2 } = await supabase.from('profiles').upsert({
    id: angelId,
    email: 'angelorrillo1@gmail.com',
    name: 'Angel Orrillo',
    role: 'collector',
    is_active: true,
    created_at: new Date().toISOString(),
  });
  console.log('Angel profile:', e2 ? 'ERROR: ' + e2.message : 'OK');

  // Verify
  const { data, error } = await supabase.from('profiles').select('*').in('id', [keysyId, angelId]);
  console.log('Created profiles:', data);
}

createProfiles().catch(console.error);