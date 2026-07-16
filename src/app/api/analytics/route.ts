import { NextRequest, NextResponse } from 'next/server';
import { findMany, findFirst, collections } from '@/lib/firestore-db';

// GET /api/analytics - Get analytics data for dashboard
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const type = searchParams.get('type') || 'overview';

    if (type === 'overview') {
      return await getOverview();
    }

    if (type === 'mora-prediction') {
      return await getMoraPredictionHandler();
    }

    if (type === 'trends') {
      return await getTrendsHandler();
    }

    if (type === 'collectors') {
      return await getCollectorPerformanceHandler();
    }

    if (type === 'zones') {
      return await getZoneAnalysis();
    }

    return NextResponse.json({ error: 'Tipo de analytics no válido' }, { status: 400 });
  } catch (error) {
    console.error('Error fetching analytics:', error);
    return NextResponse.json({ error: 'Error al obtener analytics' }, { status: 500 });
  }
}

async function getOverview() {
  const today = new Date();
  const thirtyDaysAgo = new Date(today.getTime() - 30 * 86400000);
  const sevenDaysAgo = new Date(today.getTime() - 7 * 86400000);

  const allLoans = await findMany(collections.loans);
  const allClients = await findMany(collections.clients);
  const allPayments = await findMany(collections.payments);
  const lateFees = await findMany(collections.lateFees);

  // Loan stats
  const totalLoans = allLoans.length;
  const activeLoans = allLoans.filter((l: Record<string, unknown>) => l.status === 'active').length;
  const moraLoans = allLoans.filter((l: Record<string, unknown>) => l.status === 'mora').length;
  const completedLoans = allLoans.filter((l: Record<string, unknown>) => l.status === 'completed').length;
  const cancelledLoans = allLoans.filter((l: Record<string, unknown>) => l.status === 'cancelled').length;

  // Financial stats
  const nonCancelled = allLoans.filter((l: Record<string, unknown>) => l.status !== 'cancelled');
  const totalLoaned = nonCancelled.reduce((s: number, l: Record<string, unknown>) => s + (Number(l.amount) || 0), 0);
  const totalCollected = nonCancelled.reduce((s: number, l: Record<string, unknown>) => s + (Number(l.amountPaid) || 0), 0);
  const totalInterest = nonCancelled.reduce((s: number, l: Record<string, unknown>) => s + (Number(l.interest) || 0), 0);
  const totalExpected = nonCancelled.reduce((s: number, l: Record<string, unknown>) => s + (Number(l.totalAmount) || 0), 0);

  const moraOnly = allLoans.filter((l: Record<string, unknown>) => l.status === 'mora');
  const moraOutstanding = moraOnly.reduce((s: number, l: Record<string, unknown>) => s + ((Number(l.totalAmount) || 0) - (Number(l.amountPaid) || 0)), 0);

  // Payment stats
  const completedPayments = allPayments.filter((p: Record<string, unknown>) => p.status === 'completed');
  const totalPayments = completedPayments.length;

  const paymentsLast7Days = completedPayments.filter((p: Record<string, unknown>) => {
    const d = typeof p.paymentDate === 'string' ? new Date(p.paymentDate) : p.paymentDate instanceof Date ? p.paymentDate : new Date();
    return d >= sevenDaysAgo;
  });

  const paymentsLast30Days = completedPayments.filter((p: Record<string, unknown>) => {
    const d = typeof p.paymentDate === 'string' ? new Date(p.paymentDate) : p.paymentDate instanceof Date ? p.paymentDate : new Date();
    return d >= thirtyDaysAgo;
  });

  const amountLast30Days = paymentsLast30Days.reduce((s: number, p: Record<string, unknown>) => s + (Number(p.amount) || 0), 0);

  // Client stats
  const totalClients = allClients.length;
  const clientsWithActiveLoans = allClients.filter((c: Record<string, unknown>) =>
    allLoans.some((l: Record<string, unknown>) => l.clientId === c.id && l.status === 'active')
  ).length;
  const clientsInMora = allClients.filter((c: Record<string, unknown>) =>
    allLoans.some((l: Record<string, unknown>) => l.clientId === c.id && l.status === 'mora')
  ).length;

  const avgCreditScore = allClients.length > 0
    ? allClients.reduce((s: number, c: Record<string, unknown>) => s + (Number(c.creditScore) || 0), 0) / allClients.length
    : 0;

  // Late fee stats
  const pendingFees = lateFees.filter((f: Record<string, unknown>) => f.status === 'pending')
    .reduce((s: number, f: Record<string, unknown>) => s + (Number(f.amount) || 0), 0);
  const paidFees = lateFees.filter((f: Record<string, unknown>) => f.status === 'paid')
    .reduce((s: number, f: Record<string, unknown>) => s + (Number(f.amount) || 0), 0);
  const waivedFees = lateFees.filter((f: Record<string, unknown>) => f.status === 'waived')
    .reduce((s: number, f: Record<string, unknown>) => s + (Number(f.amount) || 0), 0);

  // Capital
  const capitalMovements = await findMany(collections.capitalMovements, {}, { field: 'createdAt', direction: 'desc' }, 1);
  const currentCapital = capitalMovements[0]?.newCapital || 0;

  // Mora rate
  const moraRate = totalLoans > 0 ? (moraLoans / (activeLoans + moraLoans)) * 100 : 0;

  // Collection efficiency (last 30 days)
  const activeOrMora = allLoans.filter((l: Record<string, unknown>) => l.status === 'active' || l.status === 'mora');
  const dailyExpected = activeOrMora.reduce((s: number, l: Record<string, unknown>) => s + (Number(l.dailyPayment) || 0), 0);
  const expected30Days = dailyExpected * 30;
  const actual30Days = amountLast30Days;
  const collectionEfficiency = expected30Days > 0 ? (actual30Days / expected30Days) * 100 : 0;

  // Recent payments (last 7 days, grouped by date)
  const rawPayments7d = completedPayments.filter((p: Record<string, unknown>) => {
    const d = typeof p.paymentDate === 'string' ? new Date(p.paymentDate) : p.paymentDate instanceof Date ? p.paymentDate : new Date();
    return d >= sevenDaysAgo;
  });

  const paymentsByDate: Record<string, number> = {};
  for (let i = 0; i < 7; i++) {
    const d = new Date(today.getTime() - (6 - i) * 86400000);
    const key = d.toISOString().split('T')[0];
    paymentsByDate[key] = 0;
  }
  rawPayments7d.forEach((p: Record<string, unknown>) => {
    const key = typeof p.paymentDate === 'string'
      ? p.paymentDate.split('T')[0]
      : p.paymentDate instanceof Date
        ? p.paymentDate.toISOString().split('T')[0]
        : new Date(p.paymentDate as string).toISOString().split('T')[0];
    if (paymentsByDate[key] !== undefined) {
      paymentsByDate[key] += Number(p.amount) || 0;
    }
  });
  const recentPayments = Object.entries(paymentsByDate).map(([date, amount]) => ({ date, amount }));

  // Payment methods distribution
  const methodMap: Record<string, { amount: number; count: number }> = {};
  completedPayments.forEach((p: Record<string, unknown>) => {
    const method = p.paymentMethod as string || 'unknown';
    if (!methodMap[method]) methodMap[method] = { amount: 0, count: 0 };
    methodMap[method].amount += Number(p.amount) || 0;
    methodMap[method].count += 1;
  });
  const paymentMethods = Object.entries(methodMap).map(([method, data]) => ({
    method,
    amount: data.amount,
    count: data.count,
  }));

  // Top clients by total loaned
  const clientLoanMap: Record<string, { name: string; totalLoaned: number; totalPaid: number }> = {};
  allLoans.forEach((l: Record<string, unknown>) => {
    const clientId = l.clientId as string;
    if (!clientLoanMap[clientId]) {
      const client = allClients.find((c: Record<string, unknown>) => c.id === clientId);
      clientLoanMap[clientId] = { name: (client?.name as string) || 'Desconocido', totalLoaned: 0, totalPaid: 0 };
    }
    clientLoanMap[clientId].totalLoaned += Number(l.amount) || 0;
    clientLoanMap[clientId].totalPaid += Number(l.amountPaid) || 0;
  });
  const topClients = Object.values(clientLoanMap)
    .sort((a, b) => b.totalLoaned - a.totalLoaned)
    .slice(0, 5);

  return NextResponse.json({
    overview: {
      totalLoaned,
      totalCollected,
      totalInterest,
      activeLoans,
      moraLoans,
      completedLoans,
    },
    recentPayments,
    paymentMethods,
    topClients,
    loans: {
      total: totalLoans,
      active: activeLoans,
      mora: moraLoans,
      completed: completedLoans,
      cancelled: cancelledLoans,
    },
    financials: {
      totalLoaned,
      totalExpected,
      totalCollected,
      totalInterest,
      moraOutstanding,
    },
    payments: {
      total: totalPayments,
      last7Days: paymentsLast7Days.length,
      last30Days: paymentsLast30Days.length,
      amountLast30Days,
    },
    clients: {
      total: totalClients,
      withActiveLoans: clientsWithActiveLoans,
      inMora: clientsInMora,
      avgCreditScore: Math.round(avgCreditScore * 100) / 100,
    },
    lateFees: {
      pending: pendingFees,
      paid: paidFees,
      waived: waivedFees,
    },
    capital: {
      current: currentCapital,
    },
    rates: {
      moraRate: Math.round(moraRate * 100) / 100,
      collectionEfficiency: Math.round(collectionEfficiency * 100) / 100,
    },
  });
}

async function getMoraPredictionHandler() {
  const today = new Date();

  const allLoans = await findMany(collections.loans, { status: 'active' });
  const allClients = await findMany(collections.clients);
  const allPayments = await findMany(collections.payments, { status: 'completed' });

  const riskAssessments = allLoans.map((loan: Record<string, unknown>) => {
    let riskScore = 0;
    const factors: { factor: string; impact: number; description: string }[] = [];

    const client = allClients.find((c: Record<string, unknown>) => c.id === loan.clientId) || { creditScore: 50, name: 'Desconocido', id: '' };
    const loanPayments = allPayments
      .filter((p: Record<string, unknown>) => p.loanId === loan.id)
      .sort((a: Record<string, unknown>, b: Record<string, unknown>) => {
        const da = typeof a.paymentDate === 'string' ? new Date(a.paymentDate) : a.paymentDate instanceof Date ? a.paymentDate : new Date();
        const db = typeof b.paymentDate === 'string' ? new Date(b.paymentDate) : b.paymentDate instanceof Date ? b.paymentDate : new Date();
        return db.getTime() - da.getTime();
      })
      .slice(0, 10);

    // Factor 1: Credit score (0-40 points)
    const creditScore = (client.creditScore as number) || 50;
    const creditRisk = Math.max(0, (100 - creditScore) / 100) * 40;
    riskScore += creditRisk;
    factors.push({
      factor: 'Score Crediticio',
      impact: Math.round(creditRisk),
      description: creditScore < 30 ? 'Score muy bajo - alto riesgo' : creditScore < 50 ? 'Score bajo - riesgo moderado' : creditScore < 70 ? 'Score medio - riesgo bajo' : 'Score alto - riesgo mínimo',
    });

    // Factor 2: Payment consistency (0-25 points)
    const totalExpected = (loan.dailyPayment as number) * (loan.numCuotas as number);
    const paymentRatio = totalExpected > 0 ? (loan.amountPaid as number) / totalExpected : 0;
    const consistencyRisk = Math.max(0, (1 - paymentRatio) * 25);
    riskScore += consistencyRisk;
    factors.push({
      factor: 'Consistencia de Pago',
      impact: Math.round(consistencyRisk),
      description: paymentRatio > 0.8 ? 'Pagando bien' : paymentRatio > 0.5 ? 'Pagos irregulares' : 'Pagos muy atrasados',
    });

    // Factor 3: Time remaining (0-20 points)
    if (loan.endDate) {
      const daysRemaining = Math.floor((new Date(loan.endDate as string).getTime() - today.getTime()) / 86400000);
      const timeRisk = daysRemaining < 0 ? 20 : daysRemaining < 5 ? 18 : daysRemaining < 10 ? 12 : daysRemaining < 15 ? 6 : 0;
      riskScore += timeRisk;
      factors.push({
        factor: 'Tiempo Restante',
        impact: Math.round(timeRisk),
        description: daysRemaining < 0 ? `Vencido hace ${Math.abs(daysRemaining)} días` : `${daysRemaining} días restantes`,
      });
    }

    // Factor 4: Recent payment gaps (0-15 points)
    const recentPayments = loanPayments.filter((p: Record<string, unknown>) => {
      const daysAgo = Math.floor((today.getTime() - new Date(p.paymentDate as string).getTime()) / 86400000);
      return daysAgo <= 7;
    });
    const expectedPaymentsWeek = 7;
    const gapRisk = Math.max(0, (1 - recentPayments.length / expectedPaymentsWeek) * 15);
    riskScore += gapRisk;
    factors.push({
      factor: 'Pagos Recientes',
      impact: Math.round(gapRisk),
      description: `${recentPayments.length} pagos en los últimos 7 días`,
    });

    riskScore = Math.min(100, Math.round(riskScore));

    let riskLevel: 'low' | 'medium' | 'high' | 'critical';
    if (riskScore < 25) riskLevel = 'low';
    else if (riskScore < 50) riskLevel = 'medium';
    else if (riskScore < 75) riskLevel = 'high';
    else riskLevel = 'critical';

    return {
      loanId: loan.id,
      clientName: client.name,
      clientId: client.id,
      amount: loan.amount,
      totalAmount: loan.totalAmount,
      amountPaid: loan.amountPaid,
      creditScore,
      riskScore,
      riskLevel,
      factors,
      daysRemaining: loan.endDate ? Math.floor((new Date(loan.endDate as string).getTime() - today.getTime()) / 86400000) : null,
    };
  });

  riskAssessments.sort((a, b) => b.riskScore - a.riskScore);

  const summary = {
    total: riskAssessments.length,
    low: riskAssessments.filter((r) => r.riskLevel === 'low').length,
    medium: riskAssessments.filter((r) => r.riskLevel === 'medium').length,
    high: riskAssessments.filter((r) => r.riskLevel === 'high').length,
    critical: riskAssessments.filter((r) => r.riskLevel === 'critical').length,
    avgRiskScore: riskAssessments.length > 0 ? Math.round(riskAssessments.reduce((s, r) => s + r.riskScore, 0) / riskAssessments.length) : 0,
    predictedMoraNext7Days: riskAssessments.filter((r) => r.riskLevel === 'high' || r.riskLevel === 'critical').length,
  };

  return NextResponse.json({
    summary,
    assessments: riskAssessments,
  });
}

async function getTrendsHandler() {
  const today = new Date();
  const thirtyDaysAgo = new Date(today.getTime() - 30 * 86400000);

  const allPayments = await findMany(collections.payments, { status: 'completed' });
  const allLoans = await findMany(collections.loans);
  const allZones = await findMany(collections.zones as any);
  const auditLogs = await findMany(collections.auditLogs);

  // Daily payment amounts for last 30 days
  const dailyPayments = [];
  for (let i = 29; i >= 0; i--) {
    const date = new Date(today.getTime() - i * 86400000);
    date.setHours(0, 0, 0, 0);
    const nextDate = new Date(date.getTime() + 86400000);

    const dayPayments = allPayments.filter((p: Record<string, unknown>) => {
      const pd = typeof p.paymentDate === 'string' ? new Date(p.paymentDate) : p.paymentDate instanceof Date ? p.paymentDate : new Date();
      return pd >= date && pd < nextDate;
    });

    dailyPayments.push({
      date: date.toISOString().split('T')[0],
      amount: dayPayments.reduce((s: number, p: Record<string, unknown>) => s + (Number(p.amount) || 0), 0),
      count: dayPayments.length,
    });
  }

  // Weekly loan status changes (from audit logs)
  const weeklyActions = [];
  for (let i = 11; i >= 0; i--) {
    const weekStart = new Date(today.getTime() - (i * 7 + 6) * 86400000);
    const weekEnd = new Date(today.getTime() - i * 7 * 86400000);

    const moraChanges = auditLogs.filter((log: Record<string, unknown>) => {
      const created = typeof log.createdAt === 'string' ? new Date(log.createdAt) : log.createdAt instanceof Date ? log.createdAt : new Date();
      return log.action === 'UPDATE' && log.entityType === 'loan' && typeof log.notes === 'string' && log.notes.includes('mora') && created >= weekStart && created < weekEnd;
    }).length;

    const loanCreations = auditLogs.filter((log: Record<string, unknown>) => {
      const created = typeof log.createdAt === 'string' ? new Date(log.createdAt) : log.createdAt instanceof Date ? log.createdAt : new Date();
      return log.action === 'CREATE' && log.entityType === 'loan' && created >= weekStart && created < weekEnd;
    }).length;

    weeklyActions.push({
      week: `Sem ${12 - i}`,
      moraChanges,
      loanCreations,
    });
  }

  // Payment method distribution
  const methodMap: Record<string, { amount: number; count: number }> = {};
  allPayments.forEach((p: Record<string, unknown>) => {
    const method = p.paymentMethod as string || 'unknown';
    if (!methodMap[method]) methodMap[method] = { amount: 0, count: 0 };
    methodMap[method].amount += Number(p.amount) || 0;
    methodMap[method].count += 1;
  });
  const paymentMethods = Object.entries(methodMap).map(([method, data]) => ({
    method,
    count: data.count,
    amount: data.amount,
  }));

  // Mora trend by zone
  const zoneMora = allZones.map((z: Record<string, unknown>) => {
    const zoneLoans = allLoans.filter((l: Record<string, unknown>) => l.zoneId === z.id);
    const moraLoans = zoneLoans.filter((l: Record<string, unknown>) => l.status === 'mora');
    return {
      zone: z.name,
      totalLoans: zoneLoans.length,
      moraLoans: moraLoans.length,
      moraAmount: moraLoans.reduce((sum: number, l: Record<string, unknown>) => sum + ((Number(l.totalAmount) || 0) - (Number(l.amountPaid) || 0)), 0),
      moraRate: zoneLoans.length > 0 ? Math.round((moraLoans.length / zoneLoans.length) * 10000) / 100 : 0,
    };
  });

  return NextResponse.json({
    dailyPayments,
    weeklyActions,
    paymentMethods,
    zoneMora,
  });
}

async function getCollectorPerformanceHandler() {
  const today = new Date();
  const sevenDaysAgo = new Date(today.getTime() - 7 * 86400000);

  const collectors = await findMany(collections.profiles, { role: 'collector', isActive: true });
  const allLoans = await findMany(collections.loans);
  const allPayments = await findMany(collections.payments, { status: 'completed' });

  const performance = await Promise.all(
    collectors.map(async (collector: Record<string, unknown>) => {
      const collectorLoans = allLoans.filter((l: Record<string, unknown>) => l.collectorId === collector.id);
      const collectorPayments = allPayments.filter((p: Record<string, unknown>) => p.collectorId === collector.id);

      const payments7Days = collectorPayments.filter((p: Record<string, unknown>) => {
        const pd = typeof p.paymentDate === 'string' ? new Date(p.paymentDate) : p.paymentDate instanceof Date ? p.paymentDate : new Date();
        return pd >= sevenDaysAgo;
      });
      const amount7Days = payments7Days.reduce((s: number, p: Record<string, unknown>) => s + (Number(p.amount) || 0), 0);

      const activeOrMoraLoans = collectorLoans.filter((l: Record<string, unknown>) => l.status === 'active' || l.status === 'mora');
      const activeLoans = activeOrMoraLoans.filter((l: Record<string, unknown>) => l.status === 'active').length;
      const moraLoansCount = collectorLoans.filter((l: Record<string, unknown>) => l.status === 'mora').length;
      const totalLoans = collectorLoans.length;
      const moraRate = totalLoans > 0 ? Math.round((moraLoansCount / totalLoans) * 100) : 0;

      const totalManaged = activeOrMoraLoans.reduce((sum: number, l: Record<string, unknown>) => sum + (Number(l.amount) || 0), 0);
      const totalCollected = activeOrMoraLoans.reduce((sum: number, l: Record<string, unknown>) => sum + (Number(l.amountPaid) || 0), 0);
      const collectionRate = totalManaged > 0 ? Math.round((totalCollected / totalManaged) * 100) : 0;

      return {
        id: collector.id,
        name: collector.name,
        activeLoans,
        moraLoans: moraLoansCount,
        totalLoans,
        moraRate,
        totalManaged,
        totalCollected,
        collectionRate,
        payments7Days: payments7Days.length,
        amount7Days,
      };
    })
  );

  performance.sort((a, b) => a.moraRate - b.moraRate);

  return NextResponse.json({ collectors: performance });
}

async function getZoneAnalysis() {
  const allZones = await findMany(collections.zones as any);
  const allLoans = await findMany(collections.loans);
  const allClients = await findMany(collections.clients);

  const analysis = allZones.map((zone: Record<string, unknown>) => {
    const zoneLoans = allLoans.filter((l: Record<string, unknown>) => l.zoneId === zone.id);
    const zoneClients = allClients.filter((c: Record<string, unknown>) => c.zoneId === zone.id);
    const activeLoans = zoneLoans.filter((l: Record<string, unknown>) => l.status === 'active');
    const moraLoans = zoneLoans.filter((l: Record<string, unknown>) => l.status === 'mora');
    const completedLoans = zoneLoans.filter((l: Record<string, unknown>) => l.status === 'completed');

    const avgCreditScore = zoneClients.length > 0
      ? zoneClients.reduce((sum: number, c: Record<string, unknown>) => sum + (Number(c.creditScore) || 0), 0) / zoneClients.length
      : 0;

    const totalLoaned = zoneLoans.reduce((sum: number, l: Record<string, unknown>) => sum + (Number(l.amount) || 0), 0);
    const totalCollected = zoneLoans.reduce((sum: number, l: Record<string, unknown>) => sum + (Number(l.amountPaid) || 0), 0);
    const moraOutstanding = moraLoans.reduce((sum: number, l: Record<string, unknown>) => sum + ((Number(l.totalAmount) || 0) - (Number(l.amountPaid) || 0)), 0);
    const moraRate = zoneLoans.length > 0 ? Math.round((moraLoans.length / zoneLoans.length) * 10000) / 100 : 0;
    const collectionRate = totalLoaned > 0 ? Math.round((totalCollected / totalLoaned) * 100) : 0;

    return {
      zone: zone.name,
      totalClients: zoneClients.length,
      totalLoans: zoneLoans.length,
      activeLoans: activeLoans.length,
      moraLoans: moraLoans.length,
      completedLoans: completedLoans.length,
      avgCreditScore: Math.round(avgCreditScore * 100) / 100,
      totalLoaned,
      totalCollected,
      moraOutstanding,
      moraRate,
      collectionRate,
    };
  });

  return NextResponse.json({ zones: analysis });
}
