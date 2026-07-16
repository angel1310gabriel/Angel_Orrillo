import { NextRequest, NextResponse } from 'next/server';
import { findMany, findById, createDoc, updateDoc, collections } from '@/lib/firestore-db';

function toISO(val: unknown): string {
  if (!val) return new Date().toISOString();
  if (typeof val === 'string') return val;
  if (val instanceof Date) return val.toISOString();
  if (val && typeof val === 'object' && 'toDate' in val) return (val as any).toDate().toISOString();
  return String(val);
}

// GET /api/daily-settlements - List settlements with optional filters
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const collectorId = searchParams.get('collectorId');
    const date = searchParams.get('date');
    const status = searchParams.get('status');

    const where: Record<string, unknown> = {};
    if (collectorId) where.collectorId = collectorId;
    if (date) where.date = date;
    if (status) where.status = status;

    const settlements = await findMany(collections.dailySettlements, where, { field: 'createdAt', direction: 'desc' });

    const result = await Promise.all(settlements.map(async (s: any) => {
      const collector = await findById(collections.profiles, s.collectorId);
      return {
        id: s.id,
        collectorId: s.collectorId,
        collectorName: collector?.name || null,
        date: s.date,
        expectedCount: s.expectedCount,
        expectedAmount: s.expectedAmount,
        collectedCount: s.collectedCount,
        collectedAmount: s.collectedAmount,
        difference: s.difference,
        notes: s.notes,
        status: s.status,
        createdAt: toISO(s.createdAt),
      };
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

    const collector = await findById(collections.profiles, collectorId);
    if (!collector) {
      return NextResponse.json({ error: 'Cobrador no encontrado' }, { status: 404 });
    }

    const settlement = await createDoc(collections.dailySettlements, {
      collectorId,
      date,
      expectedCount,
      expectedAmount,
      collectedCount,
      collectedAmount,
      difference: difference ?? (collectedAmount - expectedAmount),
      notes: notes || null,
      status: 'pending',
    });

    await createDoc(collections.auditLogs, {
      action: 'CREATE',
      entityType: 'settlement',
      entityId: settlement.id,
      entityName: `Cierre de caja ${collector.name} - ${date}`,
      severity: 'info',
      notes: `Cierre registrado: S/${settlement.collectedAmount} recaudado de S/${settlement.expectedAmount} esperado`,
    }).catch(() => {});

    return NextResponse.json({
      id: settlement.id,
      collectorId: settlement.collectorId,
      collectorName: collector.name,
      date: settlement.date,
      expectedCount: settlement.expectedCount,
      expectedAmount: settlement.expectedAmount,
      collectedCount: settlement.collectedCount,
      collectedAmount: settlement.collectedAmount,
      difference: settlement.difference,
      notes: settlement.notes,
      status: settlement.status,
      createdAt: settlement.createdAt,
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

    const existing = await findById(collections.dailySettlements, id);
    if (!existing) {
      return NextResponse.json({ error: 'Cierre de caja no encontrado' }, { status: 404 });
    }

    const settlement = await updateDoc(collections.dailySettlements, id, { status });
    const collector = await findById(collections.profiles, settlement.collectorId);

    await createDoc(collections.auditLogs, {
      action: status === 'approved' ? 'APPROVE' : 'REJECT',
      entityType: 'settlement',
      entityId: id,
      entityName: `Cierre de caja ${existing.collectorId} - ${existing.date}`,
      severity: status === 'approved' ? 'info' : 'warning',
      notes: `Cierre ${status === 'approved' ? 'aprobado' : 'disputado'}`,
      changes: JSON.stringify({ field: 'status', oldValue: existing.status, newValue: status }),
    }).catch(() => {});

    return NextResponse.json({
      id: settlement.id,
      collectorId: settlement.collectorId,
      collectorName: collector?.name || null,
      date: settlement.date,
      expectedCount: settlement.expectedCount,
      expectedAmount: settlement.expectedAmount,
      collectedCount: settlement.collectedCount,
      collectedAmount: settlement.collectedAmount,
      difference: settlement.difference,
      notes: settlement.notes,
      status: settlement.status,
      createdAt: toISO(settlement.createdAt),
    });
  } catch (error) {
    console.error('Error updating settlement:', error);
    return NextResponse.json({ error: 'Error al actualizar cierre de caja' }, { status: 500 });
  }
}
