import { NextRequest, NextResponse } from 'next/server';
import { db, isVercel } from '@/lib/db';

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const format = searchParams.get('format') || 'json';

    let data;

    try {
      const { isSupabaseConfigured } = await import('@/lib/supabase-server');
      if (isSupabaseConfigured()) {
        try {
          data = await Promise.race([
            getReportsFromSupabase(),
            new Promise<null>((_, reject) => setTimeout(() => reject(new Error('Supabase timeout')), 5000)),
          ]);
        } catch (error) {
          console.error('Supabase getReports failed, falling back to Prisma:', error);
        }
      }
    } catch (error) {
      console.error('Supabase not available, using Prisma fallback:', error);
    }

    if (!data) {
      if (isVercel) {
        return NextResponse.json({ error: 'Base de datos no disponible' }, { status: 503 });
      }
      data = await getReportsFromPrisma();
    }

    if (format === 'csv') {
      const csv = generateReportCsv(data);
      return new NextResponse(csv, {
        headers: {
          'Content-Type': 'text/csv; charset=utf-8',
          'Content-Disposition': `attachment; filename="reporte-${new Date().toISOString().split('T')[0]}.csv"`,
        },
      });
    }

    return NextResponse.json(data);
  } catch (error) {
    console.error('Error fetching reports:', error);
    return NextResponse.json({ error: 'Error al obtener reportes' }, { status: 500 });
  }
}

function generateReportCsv(data: {
  collectionsByDay: { date: string; totalAmount: number; count: number }[];
  loansByStatus: Record<string, number>;
  collectorRanking: { collectorName: string; totalCollected: number; count: number; totalLoans: number }[];
  zonePerformance: { zoneName: string; activeLoans: number; moraLoans: number; totalLoaned: number }[];
}): string {
  const lines: string[] = [];
  lines.push('REPORTE GENERAL DE COBRANZAS');
  lines.push(`Generado: ${new Date().toLocaleString('es-PE')}`);
  lines.push('');

  lines.push('COBRANZAS POR DIA (ultimos 30 dias)');
  lines.push('Fecha,Monto,Transacciones');
  for (const d of data.collectionsByDay) {
    lines.push(`${d.date},${d.totalAmount.toFixed(2)},${d.count}`);
  }
  const total = data.collectionsByDay.reduce((s, d) => s + d.totalAmount, 0);
  const totalCount = data.collectionsByDay.reduce((s, d) => s + d.count, 0);
  lines.push(`TOTAL,,${total.toFixed(2)},${totalCount}`);
  lines.push('');

  lines.push('PRESTAMOS POR ESTADO');
  lines.push('Estado,Cantidad');
  for (const [status, count] of Object.entries(data.loansByStatus)) {
    lines.push(`${status},${count}`);
  }
  lines.push('');

  lines.push('RANKING DE COBRADORES');
  lines.push('Cobrador,Monto Cobrado,Transacciones,Prestamos Asignados');
  for (const c of data.collectorRanking) {
    lines.push(`${c.collectorName},${c.totalCollected.toFixed(2)},${c.count},${c.totalLoans}`);
  }
  lines.push('');

  lines.push('RENDIMIENTO POR ZONA');
  lines.push('Zona,Activos,Mora,Monto Total Prestado');
  for (const z of data.zonePerformance) {
    lines.push(`${z.zoneName},${z.activeLoans},${z.moraLoans},${z.totalLoaned.toFixed(2)}`);
  }

  return lines.join('\r\n');
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

  const collectorRanking: { collectorId: string; collectorName: string; totalCollected: number; count: number; totalLoans: number }[] = [];
  for (const collector of collectors || []) {
    const { data: payments } = await supabase
      .from('payments')
      .select('amount')
      .eq('collector_id', collector.id)
      .eq('status', 'completed');

    const { count: totalLoans } = await supabase
      .from('loans')
      .select('*', { count: 'exact', head: true })
      .eq('collector_id', collector.id);

    const totalCollected = (payments || []).reduce((s: number, p: Record<string, unknown>) => s + (Number(p.amount) || 0), 0);
    collectorRanking.push({
      collectorId: collector.id,
      collectorName: collector.name || 'Sin nombre',
      totalCollected,
      count: payments?.length || 0,
      totalLoans: totalLoans || 0,
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
      const loanCount = await db.loan.count({ where: { collectorId: c.id } });
      return {
        collectorId: c.id,
        collectorName: c.name || 'Sin nombre',
        totalCollected: agg._sum.amount || 0,
        count: agg._count,
        totalLoans: loanCount,
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
