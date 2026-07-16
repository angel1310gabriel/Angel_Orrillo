import { NextRequest, NextResponse } from 'next/server';
import { findMany, collections } from '@/lib/firestore-db';

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const format = searchParams.get('format') || 'json';

    const data = await getReportsFromFirestore();

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

async function getReportsFromFirestore() {
  const today = new Date();
  const thirtyDaysAgo = new Date(today.getTime() - 29 * 86400000);

  const payments = await findMany(collections.payments, { status: 'completed' });
  const dayBuckets: Record<string, { totalAmount: number; count: number }> = {};
  for (let i = 0; i < 30; i++) {
    const d = new Date(today.getTime() - i * 86400000);
    dayBuckets[d.toISOString().split('T')[0]] = { totalAmount: 0, count: 0 };
  }
  payments.forEach((p: Record<string, unknown>) => {
    const dateStr = typeof p.paymentDate === 'string'
      ? p.paymentDate.split('T')[0]
      : p.paymentDate instanceof Date
        ? p.paymentDate.toISOString().split('T')[0]
        : String(p.paymentDate || '').split('T')[0];
    if (dayBuckets[dateStr]) {
      dayBuckets[dateStr].totalAmount += Number(p.amount) || 0;
      dayBuckets[dateStr].count += 1;
    }
  });
  const collectionsByDay = Object.entries(dayBuckets)
    .map(([date, data]) => ({ date, totalAmount: data.totalAmount, count: data.count }))
    .sort((a, b) => a.date.localeCompare(b.date));

  const loans = await findMany(collections.loans);
  const statusCounts: Record<string, number> = { active: 0, mora: 0, completed: 0, cancelled: 0, refinanced: 0 };
  loans.forEach((l: Record<string, unknown>) => {
    const s = l.status as string;
    if (statusCounts[s] !== undefined) {
      statusCounts[s] += 1;
    }
  });
  const loansByStatus = { ...statusCounts };

  const collectors = await findMany(collections.profiles, { role: 'collector', isActive: true });

  const collectorRanking: { collectorId: string; collectorName: string; totalCollected: number; count: number; totalLoans: number }[] = [];
  for (const collector of collectors) {
    const collectorPayments = await findMany(collections.payments, { collectorId: collector.id, status: 'completed' });
    const collectorLoans = await findMany(collections.loans, { collectorId: collector.id });

    const totalCollected = collectorPayments.reduce((s: number, p: Record<string, unknown>) => s + (Number(p.amount) || 0), 0);
    collectorRanking.push({
      collectorId: collector.id,
      collectorName: collector.name || 'Sin nombre',
      totalCollected,
      count: collectorPayments.length,
      totalLoans: collectorLoans.length,
    });
  }
  collectorRanking.sort((a, b) => b.totalCollected - a.totalCollected);

  const zones = await findMany(collections.zones as any);
  const zonePerformance: { zoneName: string; activeLoans: number; moraLoans: number; totalLoaned: number }[] = [];
  for (const zone of zones) {
    const zoneLoans = await findMany(collections.loans, { zoneId: zone.id });

    const active = zoneLoans.filter((l: Record<string, unknown>) => l.status === 'active').length;
    const mora = zoneLoans.filter((l: Record<string, unknown>) => l.status === 'mora').length;
    const totalLoaned = zoneLoans.reduce((s: number, l: Record<string, unknown>) => s + (Number(l.amount) || 0), 0);

    zonePerformance.push({ zoneName: zone.name, activeLoans: active, moraLoans: mora, totalLoaned });
  }

  return { collectionsByDay, loansByStatus, collectorRanking: collectorRanking.slice(0, 5), zonePerformance };
}
