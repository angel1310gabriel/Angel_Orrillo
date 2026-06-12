import { NextResponse } from 'next/server';

// ============================================================
// Debug endpoint - checks if env vars are properly configured
// Helps diagnose Vercel deployment issues
// ============================================================

export async function GET() {
  const isVercel = process.env.VERCEL === '1';

  const config = {
    platform: isVercel ? 'vercel' : 'local',
    supabase: {
      url: process.env.NEXT_PUBLIC_SUPABASE_URL
        ? `Set (${process.env.NEXT_PUBLIC_SUPABASE_URL.substring(0, 30)}...)`
        : 'MISSING',
      anonKey: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
        ? `Set (${process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY.substring(0, 20)}...)`
        : 'MISSING',
      serviceRoleKey: process.env.SUPABASE_SERVICE_ROLE_KEY
        ? `Set (${process.env.SUPABASE_SERVICE_ROLE_KEY.substring(0, 20)}...)`
        : 'MISSING',
    },
    database: {
      url: process.env.DATABASE_URL
        ? `Set (${process.env.DATABASE_URL})`
        : 'MISSING',
    },
    nodeEnv: process.env.NODE_ENV,
  };

  // Test Supabase connection
  let supabaseTest = 'not_tested';
  try {
    const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const key = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

    if (url && key) {
      const { createClient } = await import('@supabase/supabase-js');
      const supabase = createClient(url, key);

      const { data, error } = await supabase.from('profiles').select('id, name, role').limit(5);
      if (error) {
        supabaseTest = `Error: ${error.message}`;
      } else {
        supabaseTest = `OK - ${data.length} profiles found: ${data.map((p: { name: string; role: string }) => `${p.name}(${p.role})`).join(', ')}`;
      }
    } else {
      supabaseTest = 'Cannot test - missing credentials';
    }
  } catch (err) {
    supabaseTest = `Exception: ${String(err)}`;
  }

  return NextResponse.json({
    success: true,
    config,
    supabaseTest,
    timestamp: new Date().toISOString(),
  });
}
