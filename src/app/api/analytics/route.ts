import { NextRequest, NextResponse } from 'next/server';
import { db, isVercel } from '@/lib/db';

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
  // Try Supabase first if configured (lazy-loaded)
  try {
    const { isSupabaseConfigured, getAnalyticsOverview } = await import('@/lib/supabase-server');
    if (isSupabaseConfigured()) {
      try {
        const data = await Promise.race([
          getAnalyticsOverview(),
          new Promise<null>((_, reject) => setTimeout(() => reject(new Error('Supabase timeout')), 5000)),
        ]);
        if (data === null) throw new Error('Supabase timeout');
        // Return Supabase data even if it's empty (0 counts are valid)
        // Only fall through to Prisma if Supabase returns an error or null
        if (data) {
          return NextResponse.json(data);
        }
      } catch (error) {
        console.error('Supabase getAnalyticsOverview failed, falling back to Prisma:', error);
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
  const today = new Date();
  const thirtyDaysAgo = new Date(today.getTime() - 30 * 86400000);
  const sevenDaysAgo = new Date(today.getTime() - 7 * 86400000);

  // Loan stats
  const totalLoans = await db.loan.count();
  const activeLoans = await db.loan.count({ where: { status: 'active' } });
  const moraLoans = await db.loan.count({ where: { status: 'mora' } });
  const completedLoans = await db.loan.count({ where: { status: 'completed' } });
  const cancelledLoans = await db.loan.count({ where: { status: 'cancelled' } });

  // Financial stats
  const loanFinancials = await db.loan.aggregate({
    _sum: { amount: true, totalAmount: true, amountPaid: true, interest: true },
    where: { status: { notIn: ['cancelled'] } },
  });

  const moraFinancials = await db.loan.aggregate({
    _sum: { amount: true, totalAmount: true, amountPaid: true },
    where: { status: 'mora' },
  });

  // Payment stats
  const totalPayments = await db.payment.count({ where: { status: 'completed' } });
  const paymentsLast7Days = await db.payment.count({
    where: {
      status: 'completed',
      paymentDate: { gte: sevenDaysAgo },
    },
  });

  const paymentsLast30Days = await db.payment.count({
    where: {
      status: 'completed',
      paymentDate: { gte: thirtyDaysAgo },
    },
  });

  const paymentAmountsLast30 = await db.payment.aggregate({
    _sum: { amount: true },
    where: {
      status: 'completed',
      paymentDate: { gte: thirtyDaysAgo },
    },
  });

  // Client stats
  const totalClients = await db.client.count();
  const clientsWithActiveLoans = await db.client.count({
    where: { loans: { some: { status: 'active' } } },
  });
  const clientsInMora = await db.client.count({
    where: { loans: { some: { status: 'mora' } } },
  });

  // Late fee stats
  const pendingFees = await db.lateFee.aggregate({
    _sum: { amount: true },
    where: { status: 'pending' },
  });

  const paidFees = await db.lateFee.aggregate({
    _sum: { amount: true },
    where: { status: 'paid' },
  });

  const waivedFees = await db.lateFee.aggregate({
    _sum: { amount: true },
    where: { status: 'waived' },
  });

  // Capital
  const capitalMovements = await db.capitalMovement.findMany({
    orderBy: { createdAt: 'desc' },
    take: 1,
  });

  const currentCapital = capitalMovements[0]?.newCapital || 0;

  // Mora rate
  const moraRate = totalLoans > 0 ? (moraLoans / (activeLoans + moraLoans)) * 100 : 0;

  // Collection efficiency (last 30 days)
  const expectedCollection = await db.loan.aggregate({
    _sum: { dailyPayment: true },
    where: { status: { in: ['active', 'mora'] } },
  });
  const dailyExpected = expectedCollection._sum.dailyPayment || 0;
  const expected30Days = dailyExpected * 30;
  const actual30Days = paymentAmountsLast30._sum.amount || 0;
  const collectionEfficiency = expected30Days > 0 ? (actual30Days / expected30Days) * 100 : 0;

  // Average credit score
  const avgCreditScore = await db.client.aggregate({
    _avg: { creditScore: true },
  });

  return NextResponse.json({
    loans: {
      total: totalLoans,
      active: activeLoans,
      mora: moraLoans,
      completed: completedLoans,
      cancelled: cancelledLoans,
    },
    financials: {
      totalLoaned: loanFinancials._sum.amount || 0,
      totalExpected: loanFinancials._sum.totalAmount || 0,
      totalCollected: loanFinancials._sum.amountPaid || 0,
      totalInterest: loanFinancials._sum.interest || 0,
      moraOutstanding: (moraFinancials._sum.totalAmount || 0) - (moraFinancials._sum.amountPaid || 0),
    },
    payments: {
      total: totalPayments,
      last7Days: paymentsLast7Days,
      last30Days: paymentsLast30Days,
      amountLast30Days: paymentAmountsLast30._sum.amount || 0,
    },
    clients: {
      total: totalClients,
      withActiveLoans: clientsWithActiveLoans,
      inMora: clientsInMora,
      avgCreditScore: avgCreditScore._avg.creditScore || 0,
    },
    lateFees: {
      pending: pendingFees._sum.amount || 0,
      paid: paidFees._sum.amount || 0,
      waived: waivedFees._sum.amount || 0,
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
  // Try Supabase first if configured (lazy-loaded)
  try {
    const { isSupabaseConfigured, getMoraPrediction } = await import('@/lib/supabase-server');
    if (isSupabaseConfigured()) {
      try {
        const data = await Promise.race([
          getMoraPrediction(),
          new Promise<null>((_, reject) => setTimeout(() => reject(new Error('Supabase timeout')), 5000)),
        ]);
        if (data === null) throw new Error('Supabase timeout');
        // Return Supabase data even if empty (0 active loans is valid)
        if (data) {
          return NextResponse.json(data);
        }
      } catch (error) {
        console.error('Supabase getMoraPrediction failed, falling back to Prisma:', error);
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
  const today = new Date();

  // Get all active loans with their client credit scores
  const activeLoans = await db.loan.findMany({
    where: { status: 'active' },
    include: {
      client: { select: { name: true, creditScore: true, id: true } },
      payments: {
        where: { status: 'completed' },
        orderBy: { paymentDate: 'desc' },
        take: 10,
      },
    },
  });

  // Risk scoring algorithm
  const riskAssessments = activeLoans.map((loan) => {
    let riskScore = 0; // 0-100, higher = more risk
    const factors: { factor: string; impact: number; description: string }[] = [];

    // Factor 1: Credit score (0-40 points)
    const creditScore = loan.client.creditScore || 50;
    const creditRisk = Math.max(0, (100 - creditScore) / 100) * 40;
    riskScore += creditRisk;
    factors.push({
      factor: 'Score Crediticio',
      impact: Math.round(creditRisk),
      description: creditScore < 30 ? 'Score muy bajo - alto riesgo' : creditScore < 50 ? 'Score bajo - riesgo moderado' : creditScore < 70 ? 'Score medio - riesgo bajo' : 'Score alto - riesgo mínimo',
    });

    // Factor 2: Payment consistency (0-25 points)
    const totalExpected = loan.dailyPayment * loan.numCuotas;
    const paymentRatio = totalExpected > 0 ? loan.amountPaid / totalExpected : 0;
    const consistencyRisk = Math.max(0, (1 - paymentRatio) * 25);
    riskScore += consistencyRisk;
    factors.push({
      factor: 'Consistencia de Pago',
      impact: Math.round(consistencyRisk),
      description: paymentRatio > 0.8 ? 'Pagando bien' : paymentRatio > 0.5 ? 'Pagos irregulares' : 'Pagos muy atrasados',
    });

    // Factor 3: Time remaining (0-20 points)
    if (loan.endDate) {
      const daysRemaining = Math.floor((new Date(loan.endDate).getTime() - today.getTime()) / 86400000);
      const timeRisk = daysRemaining < 0 ? 20 : daysRemaining < 5 ? 18 : daysRemaining < 10 ? 12 : daysRemaining < 15 ? 6 : 0;
      riskScore += timeRisk;
      factors.push({
        factor: 'Tiempo Restante',
        impact: Math.round(timeRisk),
        description: daysRemaining < 0 ? `Vencido hace ${Math.abs(daysRemaining)} días` : `${daysRemaining} días restantes`,
      });
    }

    // Factor 4: Recent payment gaps (0-15 points)
    const recentPayments = loan.payments.filter((p) => {
      const daysAgo = Math.floor((today.getTime() - new Date(p.paymentDate).getTime()) / 86400000);
      return daysAgo <= 7;
    });
    const expectedPaymentsWeek = 7; // Daily payments
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
      clientName: loan.client.name,
      clientId: loan.client.id,
      amount: loan.amount,
      totalAmount: loan.totalAmount,
      amountPaid: loan.amountPaid,
      creditScore: loan.client.creditScore,
      riskScore,
      riskLevel,
      factors,
      daysRemaining: loan.endDate ? Math.floor((new Date(loan.endDate).getTime() - today.getTime()) / 86400000) : null,
    };
  });

  // Sort by risk score descending
  riskAssessments.sort((a, b) => b.riskScore - a.riskScore);

  // Summary
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
  // Try Supabase first if configured (lazy-loaded)
  try {
    const { isSupabaseConfigured, getTrends } = await import('@/lib/supabase-server');
    if (isSupabaseConfigured()) {
      try {
        const data = await Promise.race([
          getTrends(),
          new Promise<null>((_, reject) => setTimeout(() => reject(new Error('Supabase timeout')), 5000)),
        ]);
        if (data === null) throw new Error('Supabase timeout');
        // Return Supabase data even if empty (no payments is valid)
        if (data) {
          return NextResponse.json(data);
        }
      } catch (error) {
        console.error('Supabase getTrends failed, falling back to Prisma:', error);
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
  const today = new Date();

  // Daily payment amounts for last 30 days
  const dailyPayments = [];
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

    dailyPayments.push({
      date: date.toISOString().split('T')[0],
      amount: result._sum.amount || 0,
      count: result._count,
    });
  }

  // Weekly loan status changes (from audit logs)
  const weeklyActions = [];
  for (let i = 11; i >= 0; i--) {
    const weekStart = new Date(today.getTime() - (i * 7 + 6) * 86400000);
    const weekEnd = new Date(today.getTime() - i * 7 * 86400000);

    const moraChanges = await db.auditLog.count({
      where: {
        action: 'UPDATE',
        entityType: 'loan',
        notes: { contains: 'mora' },
        createdAt: { gte: weekStart, lt: weekEnd },
      },
    });

    const loanCreations = await db.auditLog.count({
      where: {
        action: 'CREATE',
        entityType: 'loan',
        createdAt: { gte: weekStart, lt: weekEnd },
      },
    });

    weeklyActions.push({
      week: `Sem ${12 - i}`,
      moraChanges,
      loanCreations,
    });
  }

  // Payment method distribution
  const paymentMethods = await db.payment.groupBy({
    by: ['paymentMethod'],
    _count: { paymentMethod: true },
    _sum: { amount: true },
    where: { status: 'completed' },
  });

  // Mora trend by zone
  const zones = await db.zone.findMany({
    include: {
      loans: {
        select: { id: true, amount: true, totalAmount: true, amountPaid: true, status: true },
      },
    },
  });

  const zoneMora = zones.map((z) => {
    const moraLoans = z.loans.filter((l) => l.status === 'mora');
    return {
      zone: z.name,
      totalLoans: z.loans.length,
      moraLoans: moraLoans.length,
      moraAmount: moraLoans.reduce((sum, l) => sum + (l.totalAmount - l.amountPaid), 0),
      moraRate: z.loans.length > 0 ? Math.round((moraLoans.length / z.loans.length) * 10000) / 100 : 0,
    };
  });

  return NextResponse.json({
    dailyPayments,
    weeklyActions,
    paymentMethods: paymentMethods.map((pm) => ({
      method: pm.paymentMethod,
      count: pm._count.paymentMethod,
      amount: pm._sum.amount || 0,
    })),
    zoneMora,
  });
}

async function getCollectorPerformanceHandler() {
  // Try Supabase first if configured (lazy-loaded)
  try {
    const { isSupabaseConfigured, getCollectorPerformance } = await import('@/lib/supabase-server');
    if (isSupabaseConfigured()) {
      try {
        const data = await Promise.race([
          getCollectorPerformance(),
          new Promise<null>((_, reject) => setTimeout(() => reject(new Error('Supabase timeout')), 5000)),
        ]);
        if (data === null) throw new Error('Supabase timeout');
        // Return Supabase data even if empty (no collectors is valid)
        if (data) {
          return NextResponse.json({ collectors: data });
        }
      } catch (error) {
        console.error('Supabase getCollectorPerformance failed, falling back to Prisma:', error);
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
  const collectors = await db.profile.findMany({
    where: { role: 'collector', isActive: true },
    include: {
      loans: {
        select: { id: true, status: true, amount: true, totalAmount: true, amountPaid: true },
      },
    },
  });

  const today = new Date();
  const sevenDaysAgo = new Date(today.getTime() - 7 * 86400000);

  const performance = await Promise.all(
    collectors.map(async (collector) => {
      const payments7Days = await db.payment.aggregate({
        _sum: { amount: true },
        _count: true,
        where: {
          collectorId: collector.id,
          status: 'completed',
          paymentDate: { gte: sevenDaysAgo },
        },
      });

      const activeOrMoraLoans = collector.loans.filter((l) => l.status === 'active' || l.status === 'mora');
      const activeLoans = activeOrMoraLoans.filter((l) => l.status === 'active').length;
      const moraLoans = collector.loans.filter((l) => l.status === 'mora').length;
      const totalLoans = collector.loans.length;
      const moraRate = totalLoans > 0 ? Math.round((moraLoans / totalLoans) * 100) : 0;

      const totalManaged = activeOrMoraLoans.reduce((sum, l) => sum + l.amount, 0);
      const totalCollected = activeOrMoraLoans.reduce((sum, l) => sum + l.amountPaid, 0);
      const collectionRate = totalManaged > 0 ? Math.round((totalCollected / totalManaged) * 100) : 0;

      return {
        id: collector.id,
        name: collector.name,
        activeLoans,
        moraLoans,
        totalLoans,
        moraRate,
        totalManaged,
        totalCollected,
        collectionRate,
        payments7Days: payments7Days._count,
        amount7Days: payments7Days._sum.amount || 0,
      };
    })
  );

  performance.sort((a, b) => a.moraRate - b.moraRate);

  return NextResponse.json({ collectors: performance });
}

async function getZoneAnalysis() {
  // On Vercel, try Supabase for zone data
  if (isVercel) {
    try {
      const { isSupabaseConfigured } = await import('@/lib/supabase-server');
      if (isSupabaseConfigured()) {
        const envUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
        const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
        const envKey = serviceKey || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
        if (envUrl && envKey) {
          const { createClient } = await import('@supabase/supabase-js');
          const supabase = createClient(envUrl, envKey);

          const { data: zones } = await supabase.from('zones').select('id, name, clients(id, credit_score), loans(id, status, amount, total_amount, amount_paid)');
          if (zones) {
            const analysis = zones.map((zone: Record<string, unknown>) => {
              const zoneClients = (zone.clients as Record<string, unknown>[]) || [];
              const zoneLoans = (zone.loans as Record<string, unknown>[]) || [];
              const activeLoans = zoneLoans.filter((l) => l.status === 'active');
              const moraLoans = zoneLoans.filter((l) => l.status === 'mora');
              const completedLoans = zoneLoans.filter((l) => l.status === 'completed');

              const avgCreditScore = zoneClients.length > 0
                ? zoneClients.reduce((sum: number, c: Record<string, unknown>) => sum + ((c.credit_score as number) || 0), 0) / zoneClients.length
                : 0;

              const totalLoaned = zoneLoans.reduce((sum: number, l: Record<string, unknown>) => sum + ((l.amount as number) || 0), 0);
              const totalCollected = zoneLoans.reduce((sum: number, l: Record<string, unknown>) => sum + ((l.amount_paid as number) || 0), 0);
              const moraOutstanding = moraLoans.reduce((sum: number, l: Record<string, unknown>) => sum + (((l.total_amount as number) || 0) - ((l.amount_paid as number) || 0)), 0);
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
        }
      }
    } catch (error) {
      console.error('Supabase getZoneAnalysis failed:', error);
    }
    return NextResponse.json({ error: 'Base de datos no disponible' }, { status: 503 });
  }

  // Local: Prisma fallback
  const zones = await db.zone.findMany({
    include: {
      clients: { select: { id: true, creditScore: true } },
      loans: {
        select: {
          id: true,
          status: true,
          amount: true,
          totalAmount: true,
          amountPaid: true,
        },
      },
    },
  });

  const analysis = zones.map((zone) => {
    const activeLoans = zone.loans.filter((l) => l.status === 'active');
    const moraLoans = zone.loans.filter((l) => l.status === 'mora');
    const completedLoans = zone.loans.filter((l) => l.status === 'completed');

    const avgCreditScore = zone.clients.length > 0
      ? zone.clients.reduce((sum, c) => sum + (c.creditScore || 0), 0) / zone.clients.length
      : 0;

    const totalLoaned = zone.loans.reduce((sum, l) => sum + l.amount, 0);
    const totalCollected = zone.loans.reduce((sum, l) => sum + l.amountPaid, 0);
    const moraOutstanding = moraLoans.reduce((sum, l) => sum + (l.totalAmount - l.amountPaid), 0);
    const moraRate = zone.loans.length > 0 ? Math.round((moraLoans.length / zone.loans.length) * 10000) / 100 : 0;
    const collectionRate = totalLoaned > 0 ? Math.round((totalCollected / totalLoaned) * 100) : 0;

    return {
      zone: zone.name,
      totalClients: zone.clients.length,
      totalLoans: zone.loans.length,
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
