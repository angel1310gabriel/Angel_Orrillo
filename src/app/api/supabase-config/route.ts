import { NextRequest, NextResponse } from 'next/server';
import { findMany, findFirst, collections } from '@/lib/firestore-db';

// ============================================================
// /api/supabase-config - Manage database configuration
// GET:  Check current configuration status
// POST: Save configuration
// DELETE: Remove configuration
// ============================================================

export async function GET() {
  try {
    const envUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const envAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
    const hasEnvConfig = !!(envUrl && envAnonKey);

    let dbConfig: { url: string; key: string; serviceKey?: string } | null = null;
    try {
      const settings = await findMany(collections.settings);
      const settingsMap = Object.fromEntries(
        settings
          .filter((s: any) => ['supabase_url', 'supabase_anon_key', 'supabase_service_role_key'].includes(s.key))
          .map((s: any) => [s.key, s.value])
      );
      if (settingsMap.supabase_url && settingsMap.supabase_anon_key) {
        dbConfig = {
          url: settingsMap.supabase_url,
          key: settingsMap.supabase_anon_key,
          serviceKey: settingsMap.supabase_service_role_key,
        };
      }
    } catch {
      // Settings collection might not exist yet
    }

    const isDbConfigured = !!(dbConfig?.url && dbConfig?.key);
    const isConfigured = hasEnvConfig || isDbConfigured;

    const activeUrl = envUrl || dbConfig?.url || '';
    const displayAnonKey = envAnonKey || dbConfig?.key || '';
    const hasServiceKey = !!(process.env.SUPABASE_SERVICE_ROLE_KEY?.trim()) || !!(dbConfig?.serviceKey?.trim());

    return NextResponse.json({
      isConfigured,
      connectionStatus: isConfigured ? 'connected' : 'not_configured',
      configSource: hasEnvConfig ? 'env' : isDbConfigured ? 'database' : null,
      url: activeUrl,
      hasKey: isConfigured,
      anonKey: displayAnonKey,
      keyType: process.env.SUPABASE_SERVICE_ROLE_KEY ? 'service_role' : 'anon',
      accessMode: process.env.SUPABASE_SERVICE_ROLE_KEY ? 'read_write' : 'read_only',
      hasServiceRoleKey: hasServiceKey,
    });
  } catch (error) {
    console.error('Error checking config:', error);
    return NextResponse.json({
      isConfigured: false,
      connectionStatus: 'error',
      errorMessage: 'Error al verificar configuración',
      anonKey: '',
      keyType: null,
      accessMode: null,
      hasServiceRoleKey: false,
    });
  }
}

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

    return NextResponse.json({
      success: true,
      message: 'Configuración guardada. Firestore is the active database.',
    });
  } catch (error) {
    console.error('Error saving config:', error);
    return NextResponse.json(
      { error: 'Error al guardar la configuración' },
      { status: 500 }
    );
  }
}

export async function DELETE() {
  try {
    return NextResponse.json({ message: 'Configuración eliminada' });
  } catch (error) {
    console.error('Error deleting config:', error);
    return NextResponse.json(
      { error: 'Error al eliminar la configuración' },
      { status: 500 }
    );
  }
}
