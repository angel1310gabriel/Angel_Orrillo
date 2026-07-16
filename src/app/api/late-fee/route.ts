import { NextRequest, NextResponse } from 'next/server';
import {
  findMany,
  findById,
  findFirst,
  createDoc,
  updateDoc,
  createMany,
  collections,
} from '@/lib/firestore-db';

// GET /api/late-fee
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const type = searchParams.get('type') || 'history';

    if (type === 'status') {
      const activeLoans = await findMany(collections.loans, { status: 'active' });
      const today = new Date();

      const loansInPotentialMora = activeLoans.filter((loan) => {
        if (!loan.endDate) return false;
        return new Date(loan.endDate as string) < today;
      });

      const executions = await findMany(collections.lateFeeExecutions, undefined, { field: 'createdAt', direction: 'desc' }, 1);
      const lastExecution = executions[0] || null;

      const moraLoans = await findMany(collections.loans, { status: 'mora' });
      const pendingFees = await findMany(collections.lateFees, { status: 'pending' });

      const clientIds = [...new Set([
        ...moraLoans.map((l) => l.clientId as string),
        ...activeLoans.filter((l) => loansInPotentialMora.includes(l)).map((l) => l.clientId as string),
      ].filter(Boolean))];
      const allClients = clientIds.length > 0 ? await findMany(collections.clients) : [];
      const clientMap: Record<string, Record<string, unknown>> = {};
      for (const c of allClients) clientMap[c.id] = c;

      const moraLoanIds = moraLoans.map((l) => l.id as string);
      const allLateFees = moraLoanIds.length > 0 ? await findMany(collections.lateFees) : [];
      const lateFeesByLoan: Record<string, Record<string, unknown>[]> = {};
      for (const f of allLateFees) {
        const lid = f.loanId as string;
        if (moraLoanIds.includes(lid)) {
          if (!lateFeesByLoan[lid]) lateFeesByLoan[lid] = [];
          lateFeesByLoan[lid].push(f);
        }
      }

      return NextResponse.json({
        lastExecution,
        loansInPotentialMora: loansInPotentialMora.length,
        totalMoraLoans: moraLoans.length,
        totalPendingFees: pendingFees.length,
        totalPendingFeeAmount: pendingFees.reduce((sum, f) => sum + (Number(f.amount) || 0), 0),
        moraLoans: moraLoans.map((l) => {
          const client = clientMap[l.clientId as string];
          const loanFees = lateFeesByLoan[l.id as string] || [];
          return {
            id: l.id,
            clientName: (client?.name as string) || '',
            amount: l.amount,
            totalAmount: l.totalAmount,
            amountPaid: l.amountPaid,
            daysOverdue: l.endDate ? Math.floor((today.getTime() - new Date(l.endDate as string).getTime()) / 86400000) : 0,
            creditScore: client?.creditScore,
            pendingFees: loanFees.filter((f) => f.status === 'pending').length,
          };
        }),
      });
    }

    if (type === 'config') {
      const settingsDocs = await findMany(collections.settings);
      const configMap: Record<string, string> = {};
      settingsDocs.forEach((s) => { configMap[s.key as string] = s.value as string; });

      return NextResponse.json({
        lateFeeRatePerDay: parseFloat(configMap.late_fee_rate_per_day || '2.0'),
        lateFeeEnabled: configMap.late_fee_enabled === 'true',
        moraThresholdDays: parseInt(configMap.mora_threshold_days || '1'),
        autoMoraEnabled: configMap.auto_mora_enabled === 'true',
      });
    }

    const page = parseInt(searchParams.get('page') || '1');
    const limit = parseInt(searchParams.get('limit') || '10');
    const skip = (page - 1) * limit;

    const executions = await findMany(collections.lateFeeExecutions, undefined, { field: 'createdAt', direction: 'desc' });
    const total = executions.length;
    const paginatedExecutions = executions.slice(skip, skip + limit);

    return NextResponse.json({
      executions: paginatedExecutions,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    });
  } catch (error) {
    console.error('Error fetching late fee data:', error);
    return NextResponse.json({ error: 'Error al obtener datos de mora' }, { status: 500 });
  }
}

// POST /api/late-fee
export async function POST(request: NextRequest) {
  const startTime = Date.now();

  try {
    const body = await request.json() || {};
    const triggeredBy = body.triggeredBy || 'manual';

    const settingsDocs = await findMany(collections.settings);
    const configMap: Record<string, string> = {};
    settingsDocs.forEach((s) => { configMap[s.key as string] = s.value as string; });

    const lateFeeRate = parseFloat(configMap.late_fee_rate_per_day || '2.0');
    const moraThreshold = parseInt(configMap.mora_threshold_days || '1');
    const autoMoraEnabled = configMap.auto_mora_enabled !== 'false';

    if (!autoMoraEnabled && triggeredBy === 'automatic') {
      return NextResponse.json({ message: 'Mora automática deshabilitada' }, { status: 400 });
    }

    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const activeLoans = await findMany(collections.loans, { status: 'active' });

    let loansProcessed = 0;
    let feesGenerated = 0;
    let totalFeeAmount = 0;
    let loansMovedToMora = 0;
    const newFees: { loanId: string; daysLate: number; amount: number }[] = [];

    for (const loan of activeLoans) {
      loansProcessed++;

      if (!loan.endDate || Number(loan.amountPaid) >= Number(loan.totalAmount)) continue;

      const endDate = new Date(loan.endDate as string);
      endDate.setHours(0, 0, 0, 0);

      if (endDate < today) {
        const daysLate = Math.floor((today.getTime() - endDate.getTime()) / 86400000);

        if (daysLate >= moraThreshold) {
          await updateDoc(collections.loans, loan.id, { status: 'mora' });
          loansMovedToMora++;

          const existingFees = await findMany(collections.lateFees, { loanId: loan.id, status: 'pending' });
          const existingFeeToday = existingFees.find((f) => {
            const genDate = new Date(f.generatedAt as string);
            genDate.setHours(0, 0, 0, 0);
            return genDate.getTime() === today.getTime();
          });

          if (!existingFeeToday) {
            const feeAmount = daysLate * lateFeeRate;
            await createDoc(collections.lateFees, {
              loanId: loan.id,
              daysLate,
              amount: feeAmount,
              ratePerDay: lateFeeRate,
              status: 'pending',
              generatedAt: today.toISOString(),
            });

            feesGenerated++;
            totalFeeAmount += feeAmount;
            newFees.push({ loanId: loan.id, daysLate, amount: feeAmount });
          }

          await createDoc(collections.auditLogs, {
            action: 'UPDATE',
            entityType: 'loan',
            entityId: loan.id,
            entityName: `Préstamo ${(loan.id as string).slice(-6)}`,
            severity: 'warning',
            notes: `Préstamo pasó a mora (${daysLate} días de atraso)`,
            changes: JSON.stringify({ field: 'status', oldValue: 'active', newValue: 'mora' }),
          });
        }
      }
    }

    const moraLoans = await findMany(collections.loans, { status: 'mora' });

    for (const loan of moraLoans) {
      if (!loan.endDate || Number(loan.amountPaid) >= Number(loan.totalAmount)) continue;

      const endDate = new Date(loan.endDate as string);
      endDate.setHours(0, 0, 0, 0);

      const daysLate = Math.floor((today.getTime() - endDate.getTime()) / 86400000);

      const existingFees = await findMany(collections.lateFees, { loanId: loan.id, status: 'pending' });
      const existingFeeToday = existingFees.find((f) => {
        const genDate = new Date(f.generatedAt as string);
        genDate.setHours(0, 0, 0, 0);
        return genDate.getTime() === today.getTime();
      });

      if (!existingFeeToday && daysLate >= moraThreshold) {
        const feeAmount = lateFeeRate;
        await createDoc(collections.lateFees, {
          loanId: loan.id,
          daysLate,
          amount: feeAmount,
          ratePerDay: lateFeeRate,
          status: 'pending',
          generatedAt: today.toISOString(),
        });

        feesGenerated++;
        totalFeeAmount += feeAmount;
        newFees.push({ loanId: loan.id, daysLate, amount: feeAmount });
      }
    }

    const executionTime = Date.now() - startTime;

    const execution = await createDoc(collections.lateFeeExecutions, {
      executionDate: today.toISOString(),
      loansProcessed,
      feesGenerated,
      totalFeeAmount,
      loansMovedToMora,
      status: 'completed',
      executionTimeMs: executionTime,
      triggeredBy,
    });

    const cronSetting = await findById(collections.settings, 'cron_last_run');
    if (cronSetting) {
      await updateDoc(collections.settings, 'cron_last_run', { value: today.toISOString() });
    } else {
      await createDoc(collections.settings, { key: 'cron_last_run', value: today.toISOString() }, 'cron_last_run');
    }

    return NextResponse.json({
      execution,
      details: {
        loansProcessed,
        feesGenerated,
        totalFeeAmount,
        loansMovedToMora,
        newFees,
        executionTimeMs: executionTime,
      },
    });
  } catch (error) {
    console.error('Error running late fee calculation:', error);

    const executionTime = Date.now() - startTime;
    await createDoc(collections.lateFeeExecutions, {
      executionDate: new Date().toISOString(),
      loansProcessed: 0,
      feesGenerated: 0,
      totalFeeAmount: 0,
      loansMovedToMora: 0,
      status: 'failed',
      errorMessage: error instanceof Error ? error.message : 'Unknown error',
      executionTimeMs: executionTime,
      triggeredBy: 'manual',
    });

    return NextResponse.json({ error: 'Error al ejecutar cálculo de mora' }, { status: 500 });
  }
}

// PUT /api/late-fee
export async function PUT(request: NextRequest) {
  try {
    const body = await request.json();
    const { lateFeeRatePerDay, lateFeeEnabled, moraThresholdDays, autoMoraEnabled } = body;

    const upserts: Promise<unknown>[] = [];

    const upsertSetting = async (key: string, value: string) => {
      const existing = await findById(collections.settings, key);
      if (existing) {
        return updateDoc(collections.settings, key, { value });
      } else {
        return createDoc(collections.settings, { key, value }, key);
      }
    };

    if (lateFeeRatePerDay !== undefined) {
      upserts.push(upsertSetting('late_fee_rate_per_day', lateFeeRatePerDay.toString()));
    }
    if (lateFeeEnabled !== undefined) {
      upserts.push(upsertSetting('late_fee_enabled', lateFeeEnabled.toString()));
    }
    if (moraThresholdDays !== undefined) {
      upserts.push(upsertSetting('mora_threshold_days', moraThresholdDays.toString()));
    }
    if (autoMoraEnabled !== undefined) {
      upserts.push(upsertSetting('auto_mora_enabled', autoMoraEnabled.toString()));
    }

    await Promise.all(upserts);

    await createDoc(collections.auditLogs, {
      action: 'UPDATE',
      entityType: 'setting',
      entityName: 'Configuración de Mora',
      severity: 'warning',
      notes: 'Configuración de mora actualizada',
      changes: JSON.stringify(body),
    });

    return NextResponse.json({ message: 'Configuración actualizada' });
  } catch (error) {
    console.error('Error updating late fee config:', error);
    return NextResponse.json({ error: 'Error al actualizar configuración' }, { status: 500 });
  }
}

// PATCH /api/late-fee
export async function PATCH(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const type = searchParams.get('type');

    if (type !== 'bulk-waive') {
      const id = searchParams.get('id');
      if (!id) {
        return NextResponse.json({ error: 'ID de mora requerido' }, { status: 400 });
      }

      const body = await request.json();
      const { waivedBy, waivedReason } = body;

      await updateDoc(collections.lateFees, id, {
        status: 'waived',
        waivedBy: waivedBy || null,
        waivedReason: waivedReason || null,
        waivedAt: new Date().toISOString(),
      });

      return NextResponse.json({ success: true });
    }

    const body = await request.json();
    const { ids, loanId, waivedBy, waivedReason } = body;

    let feeIds = ids;
    if (!feeIds && loanId) {
      const fees = await findMany(collections.lateFees, { loanId, status: 'pending' });
      feeIds = fees.map((f) => f.id);
    }

    if (!feeIds || !Array.isArray(feeIds) || feeIds.length === 0) {
      return NextResponse.json({ error: 'No hay recargos pendientes para condonar' }, { status: 400 });
    }

    let count = 0;
    for (const feeId of feeIds) {
      await updateDoc(collections.lateFees, feeId, {
        status: 'waived',
        waivedBy: waivedBy || null,
        waivedReason: waivedReason || null,
        waivedAt: new Date().toISOString(),
      });
      count++;
    }

    return NextResponse.json({ success: true, count });
  } catch (error) {
    console.error('Error waiving late fee:', error);
    return NextResponse.json({ error: 'Error al condonar mora' }, { status: 500 });
  }
}
