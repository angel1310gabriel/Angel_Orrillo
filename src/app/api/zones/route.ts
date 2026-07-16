import { NextRequest, NextResponse } from 'next/server';
import { findMany, createDoc, collections } from '@/lib/firestore-db';

function toISO(val: unknown): string {
  if (!val) return new Date().toISOString();
  if (typeof val === 'string') return val;
  if (val instanceof Date) return val.toISOString();
  if (val && typeof val === 'object' && 'toDate' in val) return (val as any).toDate().toISOString();
  return String(val);
}

// GET /api/zones
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const collectorId = searchParams.get('collectorId');

    let zones;
    if (collectorId) {
      const czDocs = await findMany(collections.collectorZones, { collectorId });
      const zoneIds = czDocs.map((cz: any) => cz.zoneId).filter(Boolean);
      if (zoneIds.length === 0) {
        return NextResponse.json({ zones: [] });
      }
      const allZones = await findMany(collections.zones);
      zones = allZones.filter((z: any) => zoneIds.includes(z.id));
    } else {
      zones = await findMany(collections.zones);
    }

    zones.sort((a: any, b: any) => (a.name || '').localeCompare(b.name || ''));

    const zonesWithStats = await Promise.all(zones.map(async (zone: any) => {
      const loans = await findMany(collections.loans, { zoneId: zone.id });
      const clients = await findMany(collections.clients, { zoneId: zone.id });
      const activeLoans = loans.filter((l: any) => l.status === 'active' || l.status === 'mora');
      const totalLoaned = loans.reduce((s: number, l: any) => s + (l.amount || 0), 0);
      const moraLoans = loans.filter((l: any) => l.status === 'mora');

      return {
        id: zone.id,
        name: zone.name,
        createdAt: toISO(zone.createdAt),
        updatedAt: toISO(zone.updatedAt),
        stats: {
          totalClients: clients.length,
          totalLoans: loans.length,
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

    const zone = await createDoc(collections.zones, { name });

    await createDoc(collections.auditLogs, {
      action: 'CREATE',
      entityType: 'zone',
      entityId: zone.id,
      entityName: zone.name,
      severity: 'info',
      notes: `Zona creada: ${zone.name}`,
    }).catch(() => {});

    return NextResponse.json(zone, { status: 201 });
  } catch (error) {
    console.error('[Zones] Error creating:', error);
    return NextResponse.json({ error: 'Error al crear zona' }, { status: 500 });
  }
}
