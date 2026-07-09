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
  } catch {
    // Not configured
  }
  return null;
}

// POST /api/locations - Save collector location
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { collectorId, latitude, longitude, accuracy, speed } = body;

    if (!collectorId || latitude === undefined || longitude === undefined) {
      return NextResponse.json({ error: 'collectorId, latitude y longitude son requeridos' }, { status: 400 });
    }

    const timestamp = new Date().toISOString();

    // Try Supabase first
    const supabase = await getSupabase();
    if (supabase) {
      try {
        const { error } = await supabase.from('collector_locations').insert({
          collector_id: collectorId,
          latitude,
          longitude,
          accuracy: accuracy ?? null,
          speed: speed ?? null,
          timestamp,
        });

        if (!error) {
          return NextResponse.json({ success: true, dataSource: 'supabase' });
        }
        console.error('[Locations] Supabase insert error:', error.message);
      } catch (err) {
        console.error('[Locations] Supabase insert failed:', err);
      }
    }

    // On Vercel, if Supabase failed, return error


    // Fallback to Prisma
    await db.collectorLocation.create({
      data: {
        collectorId,
        latitude,
        longitude,
        accuracy: accuracy ?? null,
        speed: speed ?? null,
        timestamp: new Date(timestamp),
      },
    });

    return NextResponse.json({ success: true, dataSource: 'local' });
  } catch (error) {
    console.error('[Locations] Error saving location:', error);
    return NextResponse.json({ error: 'Error al guardar ubicación' }, { status: 500 });
  }
}

// GET /api/locations - Get latest locations for all active collectors
export async function GET() {
  try {
    const supabase = await getSupabase();
    if (supabase) {
      try {
        const { data, error } = await supabase
          .from('collector_locations')
          .select('*, profiles!inner(name, is_active)')
          .eq('profiles.is_active', true)
          .order('timestamp', { ascending: false });

        if (!error && data) {
          const latestMap = new Map<string, Record<string, unknown>>();
          for (const row of data as Array<Record<string, unknown>>) {
            const cId = row.collector_id as string;
            if (!latestMap.has(cId)) {
              latestMap.set(cId, row);
            }
          }
          const locations = Array.from(latestMap.values()).map((row) => ({
            collectorId: row.collector_id,
            collectorName: (row.profiles as Record<string, unknown>)?.name || 'Desconocido',
            latitude: row.latitude,
            longitude: row.longitude,
            accuracy: row.accuracy ?? null,
            speed: row.speed ?? null,
            timestamp: row.timestamp || row.created_at,
          }));
          return NextResponse.json({ locations, dataSource: 'supabase' });
        }
      } catch (err) {
        console.error('[Locations] Supabase fetch failed:', err);
      }
    }



    // Fallback to Prisma
    const activeCollectors = await db.profile.findMany({
      where: { role: 'collector', isActive: true },
      select: { id: true, name: true },
    });

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
      const latest = await db.collectorLocation.findFirst({
        where: { collectorId: collector.id },
        orderBy: { timestamp: 'desc' },
      });
      if (latest) {
        locations.push({
          collectorId: collector.id,
          collectorName: collector.name || 'Desconocido',
          latitude: latest.latitude,
          longitude: latest.longitude,
          accuracy: latest.accuracy,
          speed: latest.speed,
          timestamp: latest.timestamp.toISOString(),
        });
      }
    }

    return NextResponse.json({ locations, dataSource: 'local' });
  } catch (error) {
    console.error('[Locations] Error fetching locations:', error);
    return NextResponse.json({ error: 'Error al obtener ubicaciones' }, { status: 500 });
  }
}
