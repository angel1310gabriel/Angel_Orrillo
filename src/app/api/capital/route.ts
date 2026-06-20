import { NextRequest, NextResponse } from 'next/server';
import { db, isVercel } from '@/lib/db';

// GET /api/capital - Get capital history
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const page = parseInt(searchParams.get('page') || '1');
    const limit = parseInt(searchParams.get('limit') || '30');

    // Try Supabase first if configured (lazy-loaded)
    try {
      const { isSupabaseConfigured, getCapitalHistory: supabaseGetCapitalHistory } = await import('@/lib/supabase-server');
      if (isSupabaseConfigured()) {
        try {
          const data = await Promise.race([
            supabaseGetCapitalHistory({ page, limit }),
            new Promise<null>((_, reject) => setTimeout(() => reject(new Error('Supabase timeout')), 5000)),
          ]);
          if (data === null) throw new Error('Supabase timeout');
          // Only return Supabase data if it has meaningful content
          if (data && ((data.movements?.length || 0) > 0 || (data.currentCapital || 0) > 0)) {
            return NextResponse.json(data);
          }
        } catch (error) {
          console.error('Supabase getCapitalHistory failed, falling back to Prisma:', error);
        }
      }
    } catch (error) {
      console.error('Supabase not available, using Prisma fallback:', error);
    }

    // On Vercel, if Supabase failed, don't fall back to Prisma (no SQLite)
    if (isVercel) {
      return NextResponse.json({ error: 'Base de datos no disponible' }, { status: 503 });
    }

    // Fallback to Prisma
    const skip = (page - 1) * limit;

    const [movements, total] = await Promise.all([
      db.capitalMovement.findMany({
        orderBy: { createdAt: 'desc' },
        skip,
        take: limit,
      }),
      db.capitalMovement.count(),
    ]);

    // Get current capital
    const lastMovement = movements.length > 0 ? movements[0] : null;
    const currentCapital = lastMovement?.newCapital || 0;

    // Summary
    const totalInjections = await db.capitalMovement.aggregate({
      _sum: { amount: true },
      where: { type: 'INYECCION' },
    });

    const totalWithdrawals = await db.capitalMovement.aggregate({
      _sum: { amount: true },
      where: { type: 'RETIRO' },
    });

    const totalLoans = await db.capitalMovement.aggregate({
      _sum: { amount: true },
      where: { type: 'PRESTAMO' },
    });

    // Active loan capital (money out there)
    const activeLoansTotal = await db.loan.aggregate({
      _sum: { amount: true },
      where: { status: { in: ['active', 'mora'] } },
    });

    return NextResponse.json({
      currentCapital,
      summary: {
        totalInjections: totalInjections._sum.amount || 0,
        totalWithdrawals: totalWithdrawals._sum.amount || 0,
        totalLoansOut: totalLoans._sum.amount || 0,
        activeLoansOut: activeLoansTotal._sum.amount || 0,
      },
      movements,
      pagination: { page, limit, total, totalPages: Math.ceil(total / limit) },
    });
  } catch (error) {
    console.error('Error fetching capital:', error);
    return NextResponse.json({ error: 'Error al obtener capital' }, { status: 500 });
  }
}

// POST /api/capital - Add capital injection or withdrawal
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { type, amount, description } = body;

    if (!type || !amount) {
      return NextResponse.json({ error: 'Tipo y monto son requeridos' }, { status: 400 });
    }

    if (!['INYECCION', 'RETIRO'].includes(type)) {
      return NextResponse.json({ error: 'Tipo debe ser INYECCION o RETIRO' }, { status: 400 });
    }

    if (amount <= 0) {
      return NextResponse.json({ error: 'El monto debe ser mayor a 0' }, { status: 400 });
    }

    // Try Supabase first if configured (lazy-loaded)
    try {
      const { isSupabaseConfigured, createCapitalMovement: supabaseCreateCapitalMovement } = await import('@/lib/supabase-server');
      if (isSupabaseConfigured()) {
        try {
          const movement = await Promise.race([
            supabaseCreateCapitalMovement({
              type: type as 'INYECCION' | 'RETIRO',
              amount,
              description,
            }),
            new Promise<null>((_, reject) => setTimeout(() => reject(new Error('Supabase timeout')), 5000)),
          ]);
          if (movement === null) throw new Error('Supabase timeout');
          if (movement) {
            return NextResponse.json(movement, { status: 201 });
          }
        } catch (error) {
          if (error instanceof Error && error.message.includes('Capital insuficiente')) {
            return NextResponse.json({ error: error.message }, { status: 400 });
          }
          console.error('Supabase createCapitalMovement failed, falling back to Prisma:', error);
        }
      }
    } catch (error) {
      console.error('Supabase not available, using Prisma fallback:', error);
    }

    // On Vercel, if Supabase failed, don't fall back to Prisma (no SQLite)
    if (isVercel) {
      return NextResponse.json({ error: 'Error al registrar movimiento de capital - base de datos no disponible' }, { status: 503 });
    }

    // Fallback to Prisma
    // Get current capital
    const lastMovement = await db.capitalMovement.findFirst({
      orderBy: { createdAt: 'desc' },
    });
    const previousCapital = lastMovement?.newCapital || 0;

    let newCapital: number;
    if (type === 'INYECCION') {
      newCapital = previousCapital + amount;
    } else {
      if (amount > previousCapital) {
        return NextResponse.json(
          { error: `Capital insuficiente. Disponible: S/${previousCapital.toFixed(2)}` },
          { status: 400 }
        );
      }
      newCapital = previousCapital - amount;
    }

    const movement = await db.capitalMovement.create({
      data: {
        type,
        amount,
        previousCapital,
        newCapital,
        description: description || `${type === 'INYECCION' ? 'Inyección' : 'Retiro'} de capital: S/${amount}`,
      },
    });

    // Audit log
    await db.auditLog.create({
      data: {
        action: 'CREATE',
        entityType: 'capital',
        entityId: movement.id,
        entityName: `${type === 'INYECCION' ? 'Inyección' : 'Retiro'} de Capital`,
        severity: type === 'RETIRO' ? 'warning' : 'info',
        notes: `${type === 'INYECCION' ? 'Inyección' : 'Retiro'} de S/${amount}. Capital: S/${previousCapital} → S/${newCapital}`,
        changes: JSON.stringify({ type, amount, previousCapital, newCapital }),
      },
    });

    // Push capital movement to Supabase in background
    pushCapitalToSupabase({
      id: movement.id,
      type: type as 'INYECCION' | 'RETIRO',
      amount,
      description: movement.description,
    }).catch((err) => console.error('[Capital] Push to Supabase error:', err));

    return NextResponse.json(movement, { status: 201 });
  } catch (error) {
    console.error('Error creating capital movement:', error);
    return NextResponse.json({ error: 'Error al registrar movimiento de capital' }, { status: 500 });
  }
}

// ============================================================
// Helper: Get Supabase client
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
  } catch { /* not configured */ }
  return null;
}

// ============================================================
// Helper: Push capital movement to Supabase
// ============================================================
async function pushCapitalToSupabase(movement: {
  id: string; type: string; amount: number; description: string | null;
}) {
  const supabase = await getSupabase();
  if (!supabase) return;

  const { error } = await supabase.from('capital_movements').insert({
    id: movement.id,
    type: movement.type,
    amount: movement.amount,
    description: movement.description,
  });

  if (error) console.error('[Capital] Push to Supabase error:', error.message);
  else console.log('[Capital] Capital movement pushed to Supabase:', movement.id);
}
