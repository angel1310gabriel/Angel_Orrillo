import { NextRequest, NextResponse } from 'next/server';

async function getSupabase() {
  try {
    const envUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
    const envKey = serviceKey || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
    if (envUrl && envKey) {
      const { createClient } = await import('@supabase/supabase-js');
      return createClient(envUrl, envKey);
    }
  } catch {
    // Not configured
  }
  return null;
}

export async function GET(request: NextRequest) {
  const supabase = await getSupabase();
  if (!supabase) {
    return NextResponse.json({ error: 'Base de datos no disponible' }, { status: 503 });
  }

  const { searchParams } = new URL(request.url);
  const key = searchParams.get('key');

  let query = supabase.from('settings').select('*');

  if (key) {
    query = query.eq('key', key);
  }

  const { data, error } = await query;

  if (error) {
    console.error('[Settings] GET error:', error.message);
    return NextResponse.json({ error: 'Error al obtener configuraciones' }, { status: 503 });
  }

  if (key && data && data.length === 1) {
    return NextResponse.json(data[0]);
  }

  return NextResponse.json(data || []);
}

export async function PUT(request: NextRequest) {
  try {
    const supabase = await getSupabase();
    if (!supabase) {
      return NextResponse.json({ error: 'Base de datos no disponible' }, { status: 503 });
    }

    const body = await request.json();
    const { key, value } = body;

    if (!key || value === undefined) {
      return NextResponse.json({ error: 'key y value son requeridos' }, { status: 400 });
    }

    const { data: existing } = await supabase.from('settings').select('id').eq('key', key).maybeSingle();

    if (existing) {
      await supabase.from('settings').update({ value }).eq('key', key);
    } else {
      await supabase.from('settings').insert({ key, value });
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('[Settings] PUT error:', error);
    return NextResponse.json({ error: 'Error al actualizar configuración' }, { status: 500 });
  }
}

export async function DELETE(request: NextRequest) {
  try {
    const supabase = await getSupabase();
    if (!supabase) {
      return NextResponse.json({ error: 'Base de datos no disponible' }, { status: 503 });
    }

    const { searchParams } = new URL(request.url);
    const key = searchParams.get('key');

    if (!key) {
      return NextResponse.json({ error: 'key es requerido' }, { status: 400 });
    }

    await supabase.from('settings').delete().eq('key', key);

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('[Settings] DELETE error:', error);
    return NextResponse.json({ error: 'Error al eliminar configuración' }, { status: 500 });
  }
}
