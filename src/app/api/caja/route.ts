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

function mapMovement(m: Record<string, unknown>) {
  return {
    id: m.id,
    type: m.type,
    amount: m.amount,
    category: m.category,
    description: m.description,
    referenceType: m.reference_type,
    referenceId: m.reference_id,
    createdBy: m.created_by,
    createdAt: m.created_at,
  };
}

export async function GET(request: NextRequest) {
  try {
    const supabase = await getSupabase();
    if (!supabase) {
      return NextResponse.json({ error: 'Base de datos no disponible' }, { status: 503 });
    }

    const { searchParams } = new URL(request.url);
    const startDate = searchParams.get('startDate');
    const endDate = searchParams.get('endDate');
    const type = searchParams.get('type');
    const limit = parseInt(searchParams.get('limit') || '50');

    let query = supabase
      .from('caja_movements')
      .select('*', { count: 'exact' })
      .order('created_at', { ascending: false })
      .limit(limit);

    if (startDate) {
      query = query.gte('created_at', startDate);
    }
    if (endDate) {
      query = query.lte('created_at', endDate);
    }
    if (type && (type === 'income' || type === 'expense')) {
      query = query.eq('type', type);
    }

    const { data, count, error } = await query;

    if (error) {
      console.error('[Caja] GET error:', error.message);
      return NextResponse.json({ error: 'Error al obtener movimientos' }, { status: 500 });
    }

    return NextResponse.json({
      movements: (data || []).map(mapMovement),
      total: count || 0,
    });
  } catch (error) {
    console.error('[Caja] GET error:', error);
    return NextResponse.json({ error: 'Error al obtener movimientos' }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const supabase = await getSupabase();
    if (!supabase) {
      return NextResponse.json({ error: 'Base de datos no disponible' }, { status: 503 });
    }

    const body = await request.json();
    const { type, amount, category, description, referenceType, referenceId, createdBy } = body;

    if (!type || !['income', 'expense'].includes(type)) {
      return NextResponse.json({ error: 'Tipo inválido. Use income o expense' }, { status: 400 });
    }
    if (!amount || typeof amount !== 'number' || amount <= 0) {
      return NextResponse.json({ error: 'Monto inválido' }, { status: 400 });
    }
    if (!category) {
      return NextResponse.json({ error: 'Categoría requerida' }, { status: 400 });
    }

    const { data, error } = await supabase
      .from('caja_movements')
      .insert({
        type,
        amount,
        category,
        description: description || null,
        reference_type: referenceType || null,
        reference_id: referenceId || null,
        created_by: createdBy || null,
      })
      .select()
      .single();

    if (error) {
      console.error('[Caja] POST error:', error.message);
      return NextResponse.json({ error: 'Error al crear movimiento' }, { status: 500 });
    }

    return NextResponse.json(mapMovement(data), { status: 201 });
  } catch (error) {
    console.error('[Caja] POST error:', error);
    return NextResponse.json({ error: 'Error al crear movimiento' }, { status: 500 });
  }
}
