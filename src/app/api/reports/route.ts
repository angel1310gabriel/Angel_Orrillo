import { NextRequest, NextResponse } from 'next/server';
import { db, isVercel } from '@/lib/db';

export async function GET(_request: NextRequest) {
  try {
    try {
      const { isSupabaseConfigured } = await import('@/lib/supabase-server');
      if (isSupabaseConfigured()) {
        try {
          const data = await Promise.race([
            getReportsFromSupabase(),
            new Promise<null>((_, reject) => setTimeout(() => reject(new Error('Supabase timeout')), 5000)),
          ]);
          if (data) {
            return NextResponse.json(data);
          }
        } catch (error) {
          console.error('Supabase getReports failed, falling back to Prisma:', error);
        }
      }
    } catch (error) {
      console.error('Supabase not available, using Prisma fallback:', error);
    }

    if (isVercel) {
      return NextResponse.json({ error: 'Base de datos no disponible' }, { status: 503 });
    }

    const data = await getReportsFromPrisma();
    return NextResponse.json(data);
  } catch (error) {
    console.error('Error fetching reports:', error);
    return NextResponse.json({ error: 'Error al obtener reportes' }, { status: 500 });
  }
}

async function getReportsFromSupabase() {
  const envUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  const envKey = serviceKey || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!envUrl || !envKey) return null;

  const { createClient } = await import('@supabase/supabase-js');
  const supabase = createClient(envUrl, envKey);

  const today = new Date();
  const thirtyDaysAgo = new Date(today.getTime() - 29 * 86400000).toISOString().split('T')[0];

  // Collections by day (last 30 days)
  const { data: paymentsData } = await supabase
    .from('payments')
    .select('amount, payment_date')
    .eq('status', 'completed')
    .gte('payment_date', thirtyDaysAgo);

  const dayBuckets: Record<string, { totalAmount: number; count: number }> = {};
  for (let i = 0; i < 30; i++) {
    const d = new Date(today.getTime() - i * 86400000);
    dayBuckets[d.toISOString().split('T')[0]] = { totalAmount: 0, count: 0 };
  }
  (paymentsData || []).forEach((p: Record<string, unknown>) => {
    const dateStr = p.payment_date as string;
    if (dayBuckets[dateStr]) {
      dayBuckets[dateStr].totalAmount += Number(p.amount) || 0;
      dayBuckets[dateStr].count += 1;
    }
  });
  const collectionsByDay = Object.entries(dayBuckets)
    .map(([date, data]) => ({ date, totalAmount: data.totalAmount, count: data.count }))
    .sort((a, b) => a.date.localeCompare(b.date));

  // Loans by status
  const { data: loansData } = await supabase.from('loans').select('status');
  const statusCounts = { active: 0, mora: 0, completed: 0, cancelled: 0, refinanced: 0 };
  (loansData || []).forEach((l: Record<string, unknown>) => {
    const s = l.status as string;
    if (statusCounts[s as keyof typeof statusCounts] !== undefined) {
      statusCounts[s as keyof typeof statusCounts] += 1;
    }
  });
  const loansByStatus = { ...statusCounts };

  // Collector ranking
  const { data: collectors } = await supabase
    .from('profiles')
    .select('id, name')
    .eq('role', 'collector')
    .eq('is_active', true);

  const collectorRanking: { collectorId: string; collectorName: string; totalCollected: number; count: number }[] = [];
  for (const collector of collectors || []) {
    const { data: payments } = await supabase
      .from('payments')
      .select('amount')
      .eq('collector_id', collector.id)
      .eq('status', 'completed');

    const totalCollected = (payments || []).reduce((s: number, p: Record<string, unknown>) => s + (Number(p.amount) || 0), 0);
    collectorRanking.push({
      collectorId: collector.id,
      collectorName: collector.name || 'Sin nombre',
      totalCollected,
      count: payments?.length || 0,
    });
  }
  collectorRanking.sort((a, b) => b.totalCollected - a.totalCollected);

  // Zone performance
  const { data: zones } = await supabase.from('zones').select('id, name');
  const zonePerformance: { zoneName: string; activeLoans: number; moraLoans: number; totalLoaned: number }[] = [];
  for (const zone of zones || []) {
    const { data: zoneLoans } = await supabase
      .from('loans')
      .select('status, amount')
      .eq('zone_id', zone.id);

    const loans = zoneLoans || [];
    const active = loans.filter((l: Record<string, unknown>) => l.status === 'active').length;
    const mora = loans.filter((l: Record<string, unknown>) => l.status === 'mora').length;
    const totalLoaned = loans.reduce((s: number, l: Record<string, unknown>) => s + (Number(l.amount) || 0), 0);

    zonePerformance.push({ zoneName: zone.name, activeLoans: active, moraLoans: mora, totalLoaned });
  }

  return { collectionsByDay, loansByStatus, collectorRanking: collectorRanking.slice(0, 5), zonePerformance };
}

async function getReportsFromPrisma() {
  const today = new Date();
  const thirtyDaysAgo = new Date(today.getTime() - 29 * 86400000);

  // Collections by day (last 30 days)
  const collectionsByDay: { date: string; totalAmount: number; count: number }[] = [];
  for (let i = 29; i >= 0; i--) {
    const date = new Date(today.getTime() - i * 86400000);
    date.setHours(0, 0, 0, 0);
    const nextDate = new Date(date.getTime() + 86400000);
    const result = await db.payment.aggregate({
      _sum: { amount: true },
      _count: true,
      where: {
        status: 'completed',
        paymentDate: { gte: date, lt: nextDate },
      },
    });
    collectionsByDay.push({
      date: date.toISOString().split('T')[0],
      totalAmount: result._sum.amount || 0,
      count: result._count,
    });
  }

  // Loans by status
  const [active, mora, completed, cancelled, refinanced] = await Promise.all([
    db.loan.count({ where: { status: 'active' } }),
    db.loan.count({ where: { status: 'mora' } }),
    db.loan.count({ where: { status: 'completed' } }),
    db.loan.count({ where: { status: 'cancelled' } }),
    db.loan.count({ where: { status: 'refinanced' } }),
  ]);
  const loansByStatus = { active, mora, completed, cancelled, refinanced };

  // Collector ranking (top 5 by total collected)
  const collectors = await db.profile.findMany({
    where: { role: 'collector', isActive: true },
  });
  const collectorRanking = await Promise.all(
    collectors.map(async (c) => {
      const agg = await db.payment.aggregate({
        _sum: { amount: true },
        _count: true,
        where: { collectorId: c.id, status: 'completed' },
      });
      return {
        collectorId: c.id,
        collectorName: c.name || 'Sin nombre',
        totalCollected: agg._sum.amount || 0,
        count: agg._count,
      };
    })
  );
  collectorRanking.sort((a, b) => b.totalCollected - a.totalCollected);

  // Zone performance
  const zones = await db.zone.findMany({
    include: {
      loans: {
        select: { status: true, amount: true },
      },
    },
  });
  const zonePerformance = zones.map((z) => ({
    zoneName: z.name,
    activeLoans: z.loans.filter((l) => l.status === 'active').length,
    moraLoans: z.loans.filter((l) => l.status === 'mora').length,
    totalLoaned: z.loans.reduce((sum, l) => sum + l.amount, 0),
  }));

  return { collectionsByDay, loansByStatus, collectorRanking: collectorRanking.slice(0, 5), zonePerformance };
}
