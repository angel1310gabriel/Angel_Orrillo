import { NextRequest, NextResponse } from 'next/server';
import { findMany, findFirst, createDoc, collections } from '@/lib/firestore-db';

// POST /api/locations - Save collector location
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { collectorId, latitude, longitude, accuracy, speed } = body;

    if (!collectorId || latitude === undefined || longitude === undefined) {
      return NextResponse.json({ error: 'collectorId, latitude y longitude son requeridos' }, { status: 400 });
    }

    await createDoc(collections.locations, {
      collectorId,
      latitude,
      longitude,
      accuracy: accuracy ?? null,
      speed: speed ?? null,
      timestamp: new Date().toISOString(),
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('[Locations] Error saving location:', error);
    return NextResponse.json({ error: 'Error al guardar ubicación' }, { status: 500 });
  }
}

// GET /api/locations - Get latest locations for all active collectors
export async function GET() {
  try {
    const activeCollectors = await findMany(collections.profiles, { role: 'collector', isActive: true });

    const locations: Array<{
      collectorId: string;
      collectorName: string;
      latitude: number;
      longitude: number;
      accuracy: number | null;
      speed: number | null;
      timestamp: string;
    }> = [];

    for (const collector of activeCollectors) {
      const latest = await findFirst(collections.locations, { collectorId: collector.id });
      if (latest) {
        locations.push({
          collectorId: collector.id,
          collectorName: collector.name || 'Desconocido',
          latitude: latest.latitude,
          longitude: latest.longitude,
          accuracy: latest.accuracy ?? null,
          speed: latest.speed ?? null,
          timestamp: latest.timestamp || latest.createdAt,
        });
      }
    }

    return NextResponse.json({ locations });
  } catch (error) {
    console.error('[Locations] Error fetching locations:', error);
    return NextResponse.json({ error: 'Error al obtener ubicaciones' }, { status: 500 });
  }
}
