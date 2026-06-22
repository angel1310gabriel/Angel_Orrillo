import { NextRequest, NextResponse } from 'next/server';
import { isVercel } from '@/lib/db';

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

function mapGuarantor(record: Record<string, unknown>) {
  return {
    id: record.id,
    clientId: record.client_id,
    name: record.name,
    documentNumber: record.document_number,
    phone: record.phone,
    address: record.address,
    photoUrl: record.photo_url,
    createdAt: record.created_at,
  };
}

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const clientId = searchParams.get('clientId');

    if (!clientId) {
      return NextResponse.json({ error: 'clientId es requerido' }, { status: 400 });
    }

    if (isVercel) {
      const supabase = await getSupabase();
      if (!supabase) {
        return NextResponse.json({ error: 'Base de datos no disponible' }, { status: 503 });
      }

      const { data, error } = await supabase
        .from('guarantors')
        .select('*')
        .eq('client_id', clientId);

      if (error) {
        console.error('[Guarantors] Supabase query error:', error.message);
        return NextResponse.json({ error: 'Error al obtener garantes' }, { status: 500 });
      }

      return NextResponse.json((data || []).map(mapGuarantor));
    }

    const supabase = await getSupabase();
    if (!supabase) {
      return NextResponse.json({ error: 'Base de datos no disponible' }, { status: 503 });
    }

    const { data, error } = await supabase
      .from('guarantors')
      .select('*')
      .eq('client_id', clientId);

    if (error) {
      console.error('[Guarantors] Supabase query error:', error.message);
      return NextResponse.json({ error: 'Error al obtener garantes' }, { status: 500 });
    }

    return NextResponse.json((data || []).map(mapGuarantor));
  } catch (error) {
    console.error('Error fetching guarantors:', error);
    return NextResponse.json({ error: 'Error al obtener garantes' }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { clientId, name, documentNumber, phone, address } = body;

    if (!clientId || !name) {
      return NextResponse.json({ error: 'clientId y name son requeridos' }, { status: 400 });
    }

    if (isVercel) {
      const supabase = await getSupabase();
      if (!supabase) {
        return NextResponse.json({ error: 'Base de datos no disponible' }, { status: 503 });
      }

      const { data, error } = await supabase
        .from('guarantors')
        .insert({
          client_id: clientId,
          name,
          document_number: documentNumber,
          phone,
          address,
        })
        .select()
        .single();

      if (error) {
        console.error('[Guarantors] Supabase insert error:', error.message);
        return NextResponse.json({ error: 'Error al crear garante' }, { status: 500 });
      }

      return NextResponse.json(mapGuarantor(data as Record<string, unknown>), { status: 201 });
    }

    const supabase = await getSupabase();
    if (!supabase) {
      return NextResponse.json({ error: 'Base de datos no disponible' }, { status: 503 });
    }

    const { data, error } = await supabase
      .from('guarantors')
      .insert({
        client_id: clientId,
        name,
        document_number: documentNumber,
        phone,
        address,
      })
      .select()
      .single();

    if (error) {
      console.error('[Guarantors] Supabase insert error:', error.message);
      return NextResponse.json({ error: 'Error al crear garante' }, { status: 500 });
    }

    return NextResponse.json(mapGuarantor(data as Record<string, unknown>), { status: 201 });
  } catch (error) {
    console.error('Error creating guarantor:', error);
    return NextResponse.json({ error: 'Error al crear garante' }, { status: 500 });
  }
}

export async function DELETE(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const id = searchParams.get('id');

    if (!id) {
      return NextResponse.json({ error: 'id es requerido' }, { status: 400 });
    }

    if (isVercel) {
      const supabase = await getSupabase();
      if (!supabase) {
        return NextResponse.json({ error: 'Base de datos no disponible' }, { status: 503 });
      }

      const { error } = await supabase.from('guarantors').delete().eq('id', id);

      if (error) {
        console.error('[Guarantors] Supabase delete error:', error.message);
        return NextResponse.json({ error: 'Error al eliminar garante' }, { status: 500 });
      }

      return NextResponse.json({ success: true });
    }

    const supabase = await getSupabase();
    if (!supabase) {
      return NextResponse.json({ error: 'Base de datos no disponible' }, { status: 503 });
    }

    const { error } = await supabase.from('guarantors').delete().eq('id', id);

    if (error) {
      console.error('[Guarantors] Supabase delete error:', error.message);
      return NextResponse.json({ error: 'Error al eliminar garante' }, { status: 500 });
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Error deleting guarantor:', error);
    return NextResponse.json({ error: 'Error al eliminar garante' }, { status: 500 });
  }
}
