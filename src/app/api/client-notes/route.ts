import { NextRequest, NextResponse } from 'next/server';
import { db, isVercel } from '@/lib/db';

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

function mapNote(row: Record<string, unknown>) {
  return {
    id: row.id,
    clientId: row.client_id,
    createdBy: row.created_by,
    note: row.note,
    isImportant: row.is_important,
    createdAt: row.created_at,
  };
}

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const clientId = searchParams.get('clientId');

    if (!clientId) {
      return NextResponse.json({ error: 'clientId is required' }, { status: 400 });
    }

    const supabase = await getSupabase();
    if (!supabase) {
      return NextResponse.json({ error: 'Base de datos no disponible' }, { status: 503 });
    }

    const { data, error } = await supabase
      .from('client_notes')
      .select('*')
      .eq('client_id', clientId)
      .order('created_at', { ascending: false });

    if (error) {
      console.error('[ClientNotes] Supabase query error:', error.message);
      return NextResponse.json({ error: 'Error al obtener notas' }, { status: 500 });
    }

    return NextResponse.json((data || []).map(mapNote));
  } catch (error) {
    console.error('Error fetching client notes:', error);
    return NextResponse.json({ error: 'Error al obtener notas' }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { clientId, createdBy, note, isImportant } = body;

    if (!clientId || !note) {
      return NextResponse.json({ error: 'clientId and note are required' }, { status: 400 });
    }

    const supabase = await getSupabase();
    if (!supabase) {
      return NextResponse.json({ error: 'Base de datos no disponible' }, { status: 503 });
    }

    const { data, error } = await supabase
      .from('client_notes')
      .insert({
        client_id: clientId,
        created_by: createdBy,
        note,
        is_important: isImportant || false,
      })
      .select()
      .single();

    if (error) {
      console.error('[ClientNotes] Supabase insert error:', error.message);
      return NextResponse.json({ error: 'Error al crear nota' }, { status: 500 });
    }

    return NextResponse.json(mapNote(data as Record<string, unknown>), { status: 201 });
  } catch (error) {
    console.error('Error creating client note:', error);
    return NextResponse.json({ error: 'Error al crear nota' }, { status: 500 });
  }
}

export async function DELETE(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const id = searchParams.get('id');

    if (!id) {
      return NextResponse.json({ error: 'id is required' }, { status: 400 });
    }

    const supabase = await getSupabase();
    if (!supabase) {
      return NextResponse.json({ error: 'Base de datos no disponible' }, { status: 503 });
    }

    const { error } = await supabase.from('client_notes').delete().eq('id', id);

    if (error) {
      console.error('[ClientNotes] Supabase delete error:', error.message);
      return NextResponse.json({ error: 'Error al eliminar nota' }, { status: 500 });
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Error deleting client note:', error);
    return NextResponse.json({ error: 'Error al eliminar nota' }, { status: 500 });
  }
}
