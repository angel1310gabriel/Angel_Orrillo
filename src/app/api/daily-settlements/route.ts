import { NextRequest, NextResponse } from 'next/server';
import { db, isVercel } from '@/lib/db';

// GET /api/daily-settlements - List settlements with optional filters
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const collectorId = searchParams.get('collectorId');
    const date = searchParams.get('date');
    const status = searchParams.get('status');

    // Try Supabase first if configured
    try {
      const supabase = await getSupabase();
      if (supabase) {
        let query = supabase.from('daily_settlements').select('*, profiles!daily_settlements_collector_id_fkey(name)');
        if (collectorId) query = query.eq('collector_id', collectorId);
        if (date) query = query.eq('date', date);
        if (status) query = query.eq('status', status);
        query = query.order('created_at', { ascending: false });

        const { data, error } = await query;
        if (!error && data) {
          const settlements = data.map((s: Record<string, unknown>) => ({
            id: s.id,
            collectorId: s.collector_id,
            collectorName: (s.profiles as Record<string, unknown> | null)?.name || null,
            date: s.date,
            expectedCount: s.expected_count,
            expectedAmount: s.expected_amount,
            collectedCount: s.collected_count,
            collectedAmount: s.collected_amount,
            difference: s.difference,
            notes: s.notes,
            status: s.status,
            createdAt: s.created_at,
          }));
          return NextResponse.json(settlements);
        }
      }
    } catch (error) {
      console.error('Supabase query failed, falling back to Prisma:', error);
    }

    if (isVercel) {
      return NextResponse.json({ error: 'Base de datos no disponible' }, { status: 503 });
    }

    // Fallback to Prisma
    const where: Record<string, unknown> = {};
    if (collectorId) where.collectorId = collectorId;
    if (date) where.date = date;
    if (status) where.status = status;

    const settlements = await db.dailySettlement.findMany({
      where,
      include: {
        collector: { select: { id: true, name: true } },
      },
      orderBy: { createdAt: 'desc' },
    });

    const result = settlements.map((s) => ({
      id: s.id,
      collectorId: s.collectorId,
      collectorName: s.collector.name,
      date: s.date,
      expectedCount: s.expectedCount,
      expectedAmount: s.expectedAmount,
      collectedCount: s.collectedCount,
      collectedAmount: s.collectedAmount,
      difference: s.difference,
      notes: s.notes,
      status: s.status,
      createdAt: s.createdAt.toISOString(),
    }));

    return NextResponse.json(result);
  } catch (error) {
    console.error('Error fetching settlements:', error);
    return NextResponse.json({ error: 'Error al obtener cierres de caja' }, { status: 500 });
  }
}

// POST /api/daily-settlements - Create a new settlement
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { collectorId, date, expectedCount, expectedAmount, collectedCount, collectedAmount, difference, notes } = body;

    if (!collectorId || !date) {
      return NextResponse.json({ error: 'Cobrador y fecha son requeridos' }, { status: 400 });
    }

    if (expectedCount === undefined || expectedAmount === undefined || collectedCount === undefined || collectedAmount === undefined) {
      return NextResponse.json({ error: 'Todos los campos de conteo y montos son requeridos' }, { status: 400 });
    }

    // Try Supabase first
    try {
      const supabase = await getSupabase();
      if (supabase) {
        const { data, error } = await supabase.from('daily_settlements').insert({
          collector_id: collectorId,
          date,
          expected_count: expectedCount,
          expected_amount: expectedAmount,
          collected_count: collectedCount,
          collected_amount: collectedAmount,
          difference: difference ?? (collectedAmount - expectedAmount),
          notes: notes || null,
          status: 'pending',
        }).select('*, profiles!daily_settlements_collector_id_fkey(name)').single();

        if (!error && data) {
          return NextResponse.json({
            id: data.id,
            collectorId: data.collector_id,
            collectorName: (data.profiles as Record<string, unknown> | null)?.name || null,
            date: data.date,
            expectedCount: data.expected_count,
            expectedAmount: data.expected_amount,
            collectedCount: data.collected_count,
            collectedAmount: data.collected_amount,
            difference: data.difference,
            notes: data.notes,
            status: data.status,
            createdAt: data.created_at,
          }, { status: 201 });
        }
      }
    } catch (error) {
      console.error('Supabase insert failed, falling back to Prisma:', error);
    }

    if (isVercel) {
      return NextResponse.json({ error: 'Error al crear cierre - base de datos no disponible' }, { status: 503 });
    }

    // Fallback to Prisma
    const collector = await db.profile.findUnique({ where: { id: collectorId } });
    if (!collector) {
      return NextResponse.json({ error: 'Cobrador no encontrado' }, { status: 404 });
    }

    const settlement = await db.dailySettlement.create({
      data: {
        collectorId,
        date,
        expectedCount,
        expectedAmount,
        collectedCount,
        collectedAmount,
        difference: difference ?? (collectedAmount - expectedAmount),
        notes: notes || null,
        status: 'pending',
      },
      include: {
        collector: { select: { id: true, name: true } },
      },
    });

    // Audit log
    await db.audit_logs.create({
      data: {
        action: 'CREATE',
        entityType: 'settlement',
        entityId: settlement.id,
        entityName: `Cierre de caja ${collector.name} - ${date}`,
        severity: 'info',
        notes: `Cierre registrado: S/${settlement.collectedAmount} recaudado de S/${settlement.expectedAmount} esperado`,
      },
    }).catch(() => {});

    // Push to Supabase in background
    pushSettlementToSupabase(settlement).catch((err) =>
      console.error('[Settlements] Push to Supabase error:', err)
    );

    return NextResponse.json({
      id: settlement.id,
      collectorId: settlement.collectorId,
      collectorName: settlement.collector.name,
      date: settlement.date,
      expectedCount: settlement.expectedCount,
      expectedAmount: settlement.expectedAmount,
      collectedCount: settlement.collectedCount,
      collectedAmount: settlement.collectedAmount,
      difference: settlement.difference,
      notes: settlement.notes,
      status: settlement.status,
      createdAt: settlement.createdAt.toISOString(),
    }, { status: 201 });
  } catch (error) {
    console.error('Error creating settlement:', error);
    return NextResponse.json({ error: 'Error al crear cierre de caja' }, { status: 500 });
  }
}

// PUT /api/daily-settlements - Update settlement status (admin approval)
export async function PUT(request: NextRequest) {
  try {
    const body = await request.json();
    const { id, status } = body;

    if (!id || !status) {
      return NextResponse.json({ error: 'ID y estado son requeridos' }, { status: 400 });
    }

    if (!['approved', 'disputed'].includes(status)) {
      return NextResponse.json({ error: 'Estado inválido. Use "approved" o "disputed"' }, { status: 400 });
    }

    // Try Supabase first
    try {
      const supabase = await getSupabase();
      if (supabase) {
        const { data: existing, error: findError } = await supabase
          .from('daily_settlements')
          .select('id, status')
          .eq('id', id)
          .maybeSingle();

        if (findError || !existing) {
          return NextResponse.json({ error: 'Cierre de caja no encontrado' }, { status: 404 });
        }

        const { data, error } = await supabase
          .from('daily_settlements')
          .update({ status })
          .eq('id', id)
          .select('*, profiles!daily_settlements_collector_id_fkey(name)')
          .single();

        if (!error && data) {
          return NextResponse.json({
            id: data.id,
            collectorId: data.collector_id,
            collectorName: (data.profiles as Record<string, unknown> | null)?.name || null,
            date: data.date,
            expectedCount: data.expected_count,
            expectedAmount: data.expected_amount,
            collectedCount: data.collected_count,
            collectedAmount: data.collected_amount,
            difference: data.difference,
            notes: data.notes,
            status: data.status,
            createdAt: data.created_at,
          });
        }
      }
    } catch (error) {
      console.error('Supabase update failed, falling back to Prisma:', error);
    }

    if (isVercel) {
      return NextResponse.json({ error: 'Error al actualizar cierre - base de datos no disponible' }, { status: 503 });
    }

    // Fallback to Prisma
    const existing = await db.dailySettlement.findUnique({
      where: { id },
      include: { collector: { select: { name: true } } },
    });

    if (!existing) {
      return NextResponse.json({ error: 'Cierre de caja no encontrado' }, { status: 404 });
    }

    const settlement = await db.dailySettlement.update({
      where: { id },
      data: { status },
      include: {
        collector: { select: { id: true, name: true } },
      },
    });

    // Audit log
    await db.audit_logs.create({
      data: {
        action: status === 'approved' ? 'APPROVE' : 'REJECT',
        entityType: 'settlement',
        entityId: id,
        entityName: `Cierre de caja ${existing.collector.name} - ${existing.date}`,
        severity: status === 'approved' ? 'info' : 'warning',
        notes: `Cierre ${status === 'approved' ? 'aprobado' : 'disputado'}`,
        changes: JSON.stringify({ field: 'status', oldValue: existing.status, newValue: status }),
      },
    }).catch(() => {});

    // Push update to Supabase in background
    supabaseUpdateSettlement(id, status).catch((err) =>
      console.error('[Settlements] Push update to Supabase error:', err)
    );

    return NextResponse.json({
      id: settlement.id,
      collectorId: settlement.collectorId,
      collectorName: settlement.collector.name,
      date: settlement.date,
      expectedCount: settlement.expectedCount,
      expectedAmount: settlement.expectedAmount,
      collectedCount: settlement.collectedCount,
      collectedAmount: settlement.collectedAmount,
      difference: settlement.difference,
      notes: settlement.notes,
      status: settlement.status,
      createdAt: settlement.createdAt.toISOString(),
    });
  } catch (error) {
    console.error('Error updating settlement:', error);
    return NextResponse.json({ error: 'Error al actualizar cierre de caja' }, { status: 500 });
  }
}

// ============================================================
// Helper: Get Supabase client
// ============================================================
async function getSupabase() {
  try {
    const envUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
    const envKey = serviceKey || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
    if (envUrl && envKey) {
      const { createClient } = await import('@supabase/supabase-js');
      return createClient(envUrl, envKey);
    }

    if (!isVercel) {
      const urlSetting = await db.setting.findUnique({ where: { key: 'supabase_url' } });
      const keySetting = await db.setting.findUnique({ where: { key: 'supabase_anon_key' } });
      const serviceKeySetting = await db.setting.findUnique({ where: { key: 'supabase_service_role_key' } });
      const url = urlSetting?.value;
      const key = serviceKeySetting?.value || keySetting?.value;
      if (url && key) {
        const { createClient } = await import('@supabase/supabase-js');
        return createClient(url, key);
      }
    }
  } catch { /* not configured */ }
  return null;
}

// ============================================================
// Helper: Push settlement to Supabase
// ============================================================
async function pushSettlementToSupabase(settlement: {
  id: string; collectorId: string; date: string;
  expectedCount: number; expectedAmount: number;
  collectedCount: number; collectedAmount: number;
  difference: number; notes: string | null; status: string;
}) {
  const supabase = await getSupabase();
  if (!supabase) return;

  const { error } = await supabase.from('daily_settlements').insert({
    id: settlement.id,
    collector_id: settlement.collectorId,
    date: settlement.date,
    expected_count: settlement.expectedCount,
    expected_amount: settlement.expectedAmount,
    collected_count: settlement.collectedCount,
    collected_amount: settlement.collectedAmount,
    difference: settlement.difference,
    notes: settlement.notes,
    status: settlement.status,
  });

  if (error) console.error('[Settlements] Push to Supabase error:', error.message);
}

// ============================================================
// Helper: Update settlement in Supabase
// ============================================================
async function supabaseUpdateSettlement(id: string, status: string) {
  const supabase = await getSupabase();
  if (!supabase) return;

  const { error } = await supabase.from('daily_settlements').update({ status }).eq('id', id);
  if (error) console.error('[Settlements] Update in Supabase error:', error.message);
}
