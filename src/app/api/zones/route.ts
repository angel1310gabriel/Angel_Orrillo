import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';

// GET /api/zones
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const collectorId = searchParams.get('collectorId');

    const where = collectorId ? {
      collector_zones: { some: { collector_id: collectorId } },
    } : {};

    const zones = await db.zone.findMany({
      where,
      include: {
        _count: { select: { clients: true, loans: true } },
      },
      orderBy: { name: 'asc' },
    });

    const zonesWithStats = await Promise.all(zones.map(async (zone) => {
      const loans = await db.loan.findMany({
        where: { zone_id: zone.id },
        select: { id: true, status: true, amount: true },
      });
      const activeLoans = loans.filter((l) => l.status === 'active' || l.status === 'mora');
      const totalLoaned = loans.reduce((s, l) => s + l.amount, 0);
      const moraLoans = loans.filter((l) => l.status === 'mora');

      return {
        id: zone.id,
        name: zone.name,
        createdAt: zone.createdAt,
        updatedAt: zone.updatedAt,
        stats: {
          totalClients: zone._count.clients,
          totalLoans: zone._count.loans,
          activeLoans: activeLoans.length,
          totalLoaned,
          moraLoans: moraLoans.length,
        },
      };
    }));

    return NextResponse.json({ zones: zonesWithStats });
  } catch (error) {
    console.error('[Zones] Error:', error);
    return NextResponse.json({ error: 'Error al obtener zonas' }, { status: 500 });
  }
}

// POST /api/zones
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { name } = body;

    if (!name) {
      return NextResponse.json({ error: 'Nombre es requerido' }, { status: 400 });
    }

    const zone = await db.zone.create({ data: { name } });

    await db.auditLog.create({
      data: {
        action: 'CREATE',
        entityType: 'zone',
        entityId: zone.id,
        entityName: zone.name,
        severity: 'info',
        notes: `Zona creada: ${zone.name}`,
      },
    }).catch(() => {});

    return NextResponse.json(zone, { status: 201 });
  } catch (error) {
    console.error('[Zones] Error creating:', error);
    return NextResponse.json({ error: 'Error al crear zona' }, { status: 500 });
  }
}
