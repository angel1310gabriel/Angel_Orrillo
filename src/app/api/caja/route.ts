import { NextRequest, NextResponse } from 'next/server';
import { db, isVercel } from '@/lib/db';

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const startDate = searchParams.get('startDate');
    const endDate = searchParams.get('endDate');
    const type = searchParams.get('type');
    const limit = parseInt(searchParams.get('limit') || '50');

    let data, count;

    try {
      const supabase = await getSupabase();
      if (supabase) {
        let query = supabase
          .from('caja_movements')
          .select('*', { count: 'exact' })
          .order('created_at', { ascending: false })
          .limit(limit);

        if (startDate) query = query.gte('created_at', startDate);
        if (endDate) query = query.lte('created_at', endDate);
        if (type && (type === 'income' || type === 'expense')) query = query.eq('type', type);

        const result = await query;
        if (!result.error) {
          return NextResponse.json({
            movements: (result.data || []).map(mapMovement),
            total: result.count || 0,
          });
        }
        console.error('[Caja] Supabase query error:', result.error);
      }
    } catch (e) {
      console.error('[Caja] Supabase error:', e);
    }

    // On Vercel, if Supabase failed, return empty (table may not exist yet)
    if (isVercel) {
      return NextResponse.json({ movements: [], total: 0 });
    }

    // Fallback: Prisma
    const where: Record<string, unknown> = {};
    if (startDate) where.createdAt = { gte: new Date(startDate) } as any;
    if (endDate) where.createdAt = { ...(where.createdAt as object || {}), lte: new Date(endDate) } as any;
    if (type) where.type = type;

    const [movements, total] = await Promise.all([
      db.cajaMovement.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        take: limit,
      }),
      db.cajaMovement.count({ where }),
    ]);

    return NextResponse.json({ movements, total });
  } catch (error) {
    console.error('[Caja] GET error:', error);
    return NextResponse.json({ error: 'Error al obtener movimientos' }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
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

    try {
      const supabase = await getSupabase();
      if (supabase) {
        const { data, error } = await supabase
          .from('caja_movements')
          .insert({
            type, amount, category,
            description: description || null,
            reference_type: referenceType || null,
            reference_id: referenceId || null,
            created_by: createdBy || null,
          })
          .select()
          .single();

        if (!error && data) {
          return NextResponse.json(mapMovement(data), { status: 201 });
        }
      }
    } catch {}

    if (isVercel) {
      return NextResponse.json({ error: 'Base de datos no disponible' }, { status: 503 });
    }

    // Fallback: Prisma
    const movement = await db.cajaMovement.create({
      data: { type, amount, category, description, referenceType, referenceId, createdBy },
    });

    return NextResponse.json(movement, { status: 201 });
  } catch (error) {
    console.error('[Caja] POST error:', error);
    return NextResponse.json({ error: 'Error al crear movimiento' }, { status: 500 });
  }
}

async function getSupabase() {
  try {
    const envUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
    const envKey = serviceKey || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
    if (envUrl && envKey) {
      const { createClient } = await import('@supabase/supabase-js');
      return createClient(envUrl, envKey);
    }
  } catch {}
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
