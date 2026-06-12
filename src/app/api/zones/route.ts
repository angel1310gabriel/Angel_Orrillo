import { NextRequest, NextResponse } from 'next/server';
import { db, isVercel } from '@/lib/db';

// ============================================================
// Helper: Get Supabase client from env or DB settings
// ============================================================
async function getSupabase() {
  try {
    const envUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    // Priority: service_role key (bypasses RLS for admin operations)
    const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
    const envKey = serviceKey || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
    if (envUrl && envKey) {
      const { createClient } = await import('@supabase/supabase-js');
      return createClient(envUrl, envKey);
    }

    // Fallback to DB settings (only available locally, not on Vercel)
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

// GET /api/zones - List all zones (Supabase first, local fallback)
export async function GET() {
  try {
    // Try Supabase first
    const supabase = await getSupabase();
    if (supabase) {
      try {
        const { data, error } = await Promise.race([
          supabase.from('zones').select('*').order('name'),
          new Promise<{ data: null; error: Error }>((_, reject) =>
            setTimeout(() => reject(new Error('timeout')), 5000)
          ),
        ]);

        if (!error && data && data.length > 0) {
          // Sync to local in background
          syncZonesToLocal(data).catch(() => {});

          const zones = data.map((z: { id: string; name: string; created_at?: string; updated_at?: string }) => ({
            id: z.id,
            name: z.name,
            createdAt: z.created_at,
            updatedAt: z.updated_at,
            stats: { totalClients: 0, totalLoans: 0, activeLoans: 0, totalLoaned: 0, moraLoans: 0 },
          }));

          return NextResponse.json({ zones, dataSource: 'supabase' });
        }
      } catch (error) {
        console.error('Supabase zones failed, falling back:', error);
      }
    }

    // On Vercel, if Supabase failed, don't fall back to Prisma (no SQLite)
    if (isVercel) {
      return NextResponse.json({ error: 'Base de datos no disponible' }, { status: 503 });
    }

    // Fallback to local
    const zones = await db.zone.findMany({
      include: {
        clients: { select: { id: true } },
        loans: { select: { id: true, status: true, amount: true } },
        _count: { select: { clients: true, loans: true } },
      },
      orderBy: { name: 'asc' },
    });

    const zonesWithStats = zones.map((zone) => {
      const activeLoans = zone.loans.filter((l) => l.status === 'active' || l.status === 'mora');
      const totalLoaned = zone.loans.reduce((s, l) => s + l.amount, 0);
      const moraLoans = zone.loans.filter((l) => l.status === 'mora');

      return {
        id: zone.id,
        name: zone.name,
        createdAt: zone.createdAt,
        updatedAt: zone.updatedAt,
        stats: {
          totalClients: zone.clients.length,
          totalLoans: zone.loans.length,
          activeLoans: activeLoans.length,
          totalLoaned,
          moraLoans: moraLoans.length,
        },
      };
    });

    return NextResponse.json({ zones: zonesWithStats, dataSource: 'local' });
  } catch (error) {
    console.error('Error fetching zones:', error);
    return NextResponse.json({ error: 'Error al obtener zonas' }, { status: 500 });
  }
}

// POST /api/zones - Create a zone (saves to both Supabase and local)
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { name } = body;

    if (!name) {
      return NextResponse.json({ error: 'Nombre es requerido' }, { status: 400 });
    }

    // On Vercel: use Supabase as primary DB
    if (isVercel) {
      const supabase = await getSupabase();
      if (!supabase) {
        return NextResponse.json({ error: 'Base de datos no disponible' }, { status: 503 });
      }

      const { data: newZone, error: createError } = await supabase.from('zones').insert({ name }).select().single();

      if (createError) {
        console.error('[Zones] Supabase create error:', createError.message);
        return NextResponse.json({ error: 'Error al crear zona' }, { status: 500 });
      }

      return NextResponse.json({
        id: newZone.id,
        name: newZone.name,
        createdAt: newZone.created_at,
        updatedAt: newZone.updated_at,
      }, { status: 201 });
    }

    // Local mode: Prisma-first with Supabase background push
    const zone = await db.zone.create({ data: { name } });

    // Also push to Supabase in background
    const supabase = await getSupabase();
    if (supabase) {
      supabase
        .from('zones')
        .insert({ id: zone.id, name })
        .then(({ error }) => {
          if (error) console.error('Failed to push zone to Supabase:', error.message);
          else console.log('[Zones] Zone pushed to Supabase:', name);
        });
    }

    // Audit log (local only)
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
    console.error('Error creating zone:', error);
    return NextResponse.json({ error: 'Error al crear zona' }, { status: 500 });
  }
}

// ============================================================
// Helper: Sync zones from Supabase to local DB
// ============================================================
async function syncZonesToLocal(zones: Record<string, unknown>[]) {
  // Skip sync on Vercel (no local DB)
  if (isVercel) return;

  try {
    for (const zone of zones) {
      await db.zone.upsert({
        where: { id: zone.id as string },
        update: { name: zone.name as string },
        create: { id: zone.id as string, name: zone.name as string },
      });
    }
    console.log(`[Zones] Synced ${zones.length} zones from Supabase to local`);
  } catch (err) {
    console.error('[Zones] Sync error:', err);
  }
}
