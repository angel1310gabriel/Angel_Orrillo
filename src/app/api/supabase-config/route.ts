import { NextRequest, NextResponse } from 'next/server';
import { db, isVercel } from '@/lib/db';

// ============================================================
// /api/supabase-config - Manage Supabase connection settings
// Optimized with caching for minimal latency
// ============================================================

// GET - Check current Supabase connection status
export async function GET() {
  try {
    // Get credentials from env or DB
    const envUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const envAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
    const envServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
    const hasServiceKey = !!(envServiceKey && envServiceKey.trim() !== '');

    // Batch-read all settings in one query instead of individual queries
    // Only available locally (not on Vercel)
    let dbConfig: { url: string; key: string; serviceKey?: string } | null = null;
    if (!isVercel) {
      try {
        const settings = await db.setting.findMany({
          where: { key: { in: ['supabase_url', 'supabase_anon_key', 'supabase_service_role_key'] } },
        });
        const settingsMap = Object.fromEntries(settings.map((s) => [s.key, s.value]));
        if (settingsMap.supabase_url && settingsMap.supabase_anon_key) {
          dbConfig = {
            url: settingsMap.supabase_url,
            key: settingsMap.supabase_anon_key,
            serviceKey: settingsMap.supabase_service_role_key,
          };
        }
      } catch {
        // Table might not exist yet
      }
    }

    const isEnvConfigured = !!(envUrl && envAnonKey);
    const isDbConfigured = !!(dbConfig?.url && dbConfig?.key);
    const isConfigured = isEnvConfigured || isDbConfigured;

    // Determine the active key type (lazy-loaded)
    let keyType: string | null = null;
    let accessMode: string | null = null;
    try {
      const { getServerCredentials } = await import('@/lib/supabase-server');
      const credentials = getServerCredentials();
      keyType = credentials?.keyType || null;
      accessMode = keyType === 'service_role' ? 'read_write' : 'read_only';
    } catch {
      // Supabase module not available
    }

    // Get the URL and anon key for display
    const activeUrl = envUrl || dbConfig?.url || '';
    const displayAnonKey = envAnonKey || dbConfig?.key || '';
    const hasDbServiceKey = !!(dbConfig?.serviceKey && dbConfig.serviceKey.trim() !== '');

    return NextResponse.json({
      isConfigured,
      connectionStatus: isConfigured ? 'connected' : 'not_configured',
      tables: [],
      errorMessage: null,
      configSource: isEnvConfigured ? 'env' : isDbConfigured ? 'database' : null,
      url: activeUrl,
      hasKey: isConfigured,
      anonKey: displayAnonKey,
      keyType,
      accessMode,
      hasServiceRoleKey: hasServiceKey || hasDbServiceKey,
    });
  } catch (error) {
    console.error('Error checking Supabase config:', error);
    return NextResponse.json({
      isConfigured: false,
      connectionStatus: 'error',
      errorMessage: 'Error al verificar configuración',
      tables: [],
      anonKey: '',
      keyType: null,
      accessMode: null,
      hasServiceRoleKey: false,
    });
  }
}

// POST - Save Supabase configuration and test connection
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { url, anonKey, serviceRoleKey } = body;

    if (!url || !anonKey) {
      return NextResponse.json(
        { error: 'URL y API Key son requeridos' },
        { status: 400 }
      );
    }

    // Test the connection with full table scan (forceFresh = true)
    // Use service_role key if provided for full access, otherwise anon key
    const testKey = serviceRoleKey || anonKey;
    const { testSupabaseConnection } = await import('@/lib/supabase');
    const testResult = await Promise.race([
      testSupabaseConnection(url, testKey, true),
      new Promise<{ success: false; message: string }>((resolve) =>
        setTimeout(() => resolve({ success: false, message: 'Timeout: la conexión tardó demasiado' }), 20000)
      ),
    ]);

    if (!testResult.success) {
      return NextResponse.json({
        success: false,
        message: `Conexión fallida: ${testResult.message}`,
      });
    }

    // Batch save all settings in parallel (only locally, not on Vercel)
    const key = serviceRoleKey || anonKey;
    const keyType = serviceRoleKey ? 'service_role' as const : 'anon' as const;

    if (!isVercel) {
      const settingsToSave = [
        { key: 'supabase_url', value: url },
        { key: 'supabase_anon_key', value: anonKey },
        { key: 'supabase_configured', value: 'true' },
      ];

      if (serviceRoleKey) {
        settingsToSave.push({ key: 'supabase_service_role_key', value: serviceRoleKey });
      }

      await Promise.all(
        settingsToSave.map((s) =>
          db.setting.upsert({
            where: { key: s.key },
            update: { value: s.value },
            create: { key: s.key, value: s.value },
          })
        )
      );
    }

    // Reset and update both client modules so all API routes use the new credentials (lazy-loaded)
    try {
      const { resetSupabaseClient, setCachedCredentials } = await import('@/lib/supabase');
      const { resetServerClient, setServerCredentials } = await import('@/lib/supabase-server');
      resetSupabaseClient();
      resetServerClient();
      setCachedCredentials(url, key);
      setServerCredentials(url, key, keyType);
    } catch (error) {
      console.error('Failed to reset Supabase clients:', error);
    }

    return NextResponse.json({
      success: true,
      message: testResult.message,
      tables: testResult.tables,
      keyType,
      accessMode: keyType === 'service_role' ? 'read_write' : 'read_only',
    });
  } catch (error) {
    console.error('Error saving Supabase config:', error);
    return NextResponse.json(
      { error: 'Error al guardar la configuración' },
      { status: 500 }
    );
  }
}

// DELETE - Remove Supabase configuration
export async function DELETE() {
  try {
    // On Vercel, just reset clients (no local DB to delete from)
    if (!isVercel) {
      const keysToDelete = ['supabase_url', 'supabase_anon_key', 'supabase_service_role_key', 'supabase_configured'];

      // Delete all settings in parallel
      await Promise.allSettled(
        keysToDelete.map((key) => db.setting.delete({ where: { key } }))
      );
    }

    // Reset Supabase clients (lazy-loaded)
    try {
      const { resetSupabaseClient, invalidateConnectionCache } = await import('@/lib/supabase');
      const { resetServerClient } = await import('@/lib/supabase-server');
      resetSupabaseClient();
      resetServerClient();
      invalidateConnectionCache();
    } catch (error) {
      console.error('Failed to reset Supabase clients:', error);
    }

    return NextResponse.json({ message: 'Configuración de Supabase eliminada' });
  } catch (error) {
    console.error('Error deleting Supabase config:', error);
    return NextResponse.json(
      { error: 'Error al eliminar la configuración' },
      { status: 500 }
    );
  }
}
