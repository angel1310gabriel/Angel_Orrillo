import { NextRequest, NextResponse } from 'next/server';
import { db, isVercel } from '@/lib/db';

// ============================================================
// Helper: Get Supabase client from env
// ============================================================
async function getSupabase() {
  try {
    const envUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
    const envKey = serviceKey || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
    if (envUrl && envKey) {
      const { createClient } = await import('@supabase/supabase-js');
      return createClient(envUrl, envKey);
    }
  } catch {
    // Not configured
  }
  return null;
}

// GET /api/late-fee - Get late fee execution history and status
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const type = searchParams.get('type') || 'history';

    if (type === 'status') {
      // On Vercel: use Supabase
      if (isVercel) {
        const supabase = await getSupabase();
        if (!supabase) {
          return NextResponse.json({ error: 'Base de datos no disponible' }, { status: 503 });
        }

        const today = new Date();

        // Get active loans
        const { data: activeLoans } = await supabase.from('loans').select('id, amount, total_amount, amount_paid, end_date, client:clients(name, credit_score)').eq('status', 'active');

        const loansInPotentialMora = (activeLoans || []).filter((loan: Record<string, unknown>) => {
          if (!loan.end_date) return false;
          return new Date(loan.end_date as string) < today;
        });

        // Get last execution
        const { data: lastExecution } = await supabase.from('late_fee_executions').select('*').order('created_at', { ascending: false }).limit(1).maybeSingle();

        // Get mora loans
        const { data: moraLoans } = await supabase.from('loans').select('id, amount, total_amount, amount_paid, end_date, client:clients(name, credit_score), late_fees(id, amount, status)').eq('status', 'mora');

        // Get pending fees
        const { data: pendingFees } = await supabase.from('late_fees').select('id, amount, loan:loans(id, client:clients(name))').eq('status', 'pending');

        return NextResponse.json({
          lastExecution,
          loansInPotentialMora: loansInPotentialMora.length,
          totalMoraLoans: (moraLoans || []).length,
          totalPendingFees: (pendingFees || []).length,
          totalPendingFeeAmount: (pendingFees || []).reduce((sum: number, f: Record<string, unknown>) => sum + ((f.amount as number) || 0), 0),
          moraLoans: (moraLoans || []).map((l: Record<string, unknown>) => ({
            id: l.id,
            clientName: (l.client as Record<string, unknown>)?.name || '',
            amount: l.amount,
            totalAmount: l.total_amount,
            amountPaid: l.amount_paid,
            daysOverdue: l.end_date ? Math.floor((today.getTime() - new Date(l.end_date as string).getTime()) / 86400000) : 0,
            creditScore: (l.client as Record<string, unknown>)?.credit_score,
            pendingFees: Array.isArray(l.late_fees) ? l.late_fees.filter((f: Record<string, unknown>) => f.status === 'pending').length : 0,
          })),
        });
      }

      // Local: Prisma
      // Get current status - how many loans need mora processing
      const activeLoans = await db.loan.findMany({
        where: { status: 'active' },
        include: { client: { select: { name: true, creditScore: true } } },
      });

      const today = new Date();
      const loansInPotentialMora = activeLoans.filter((loan) => {
        if (!loan.endDate) return false;
        return new Date(loan.endDate) < today;
      });

      const lastExecution = await db.lateFeeExecution.findFirst({
        orderBy: { createdAt: 'desc' },
      });

      // Get current mora stats
      const moraLoans = await db.loan.findMany({
        where: { status: 'mora' },
        include: { client: { select: { name: true, creditScore: true } }, lateFees: true },
      });

      const pendingFees = await db.lateFee.findMany({
        where: { status: 'pending' },
        include: { loan: { include: { client: { select: { name: true } } } } },
      });

      return NextResponse.json({
        lastExecution,
        loansInPotentialMora: loansInPotentialMora.length,
        totalMoraLoans: moraLoans.length,
        totalPendingFees: pendingFees.length,
        totalPendingFeeAmount: pendingFees.reduce((sum, f) => sum + f.amount, 0),
        moraLoans: moraLoans.map((l) => ({
          id: l.id,
          clientName: l.client.name,
          amount: l.amount,
          totalAmount: l.totalAmount,
          amountPaid: l.amountPaid,
          daysOverdue: l.endDate ? Math.floor((today.getTime() - new Date(l.endDate).getTime()) / 86400000) : 0,
          creditScore: l.client.creditScore,
          pendingFees: l.lateFees.filter((f) => f.status === 'pending').length,
        })),
      });
    }

    if (type === 'config') {
      // On Vercel: try Supabase settings
      if (isVercel) {
        const supabase = await getSupabase();
        if (!supabase) {
          return NextResponse.json({ error: 'Base de datos no disponible' }, { status: 503 });
        }

        const { data: settings } = await supabase.from('settings').select('key, value');
        const configMap: Record<string, string> = {};
        (settings || []).forEach((s: { key: string; value: string }) => { configMap[s.key] = s.value; });

        return NextResponse.json({
          lateFeeRatePerDay: parseFloat(configMap.late_fee_rate_per_day || '2.0'),
          lateFeeEnabled: configMap.late_fee_enabled === 'true',
          moraThresholdDays: parseInt(configMap.mora_threshold_days || '1'),
          autoMoraEnabled: configMap.auto_mora_enabled === 'true',
        });
      }

      // Local: Prisma
      const settings = await db.setting.findMany();
      const configMap: Record<string, string> = {};
      settings.forEach((s) => { configMap[s.key] = s.value; });

      return NextResponse.json({
        lateFeeRatePerDay: parseFloat(configMap.late_fee_rate_per_day || '2.0'),
        lateFeeEnabled: configMap.late_fee_enabled === 'true',
        moraThresholdDays: parseInt(configMap.mora_threshold_days || '1'),
        autoMoraEnabled: configMap.auto_mora_enabled === 'true',
      });
    }

    // Default: return execution history
    const page = parseInt(searchParams.get('page') || '1');
    const limit = parseInt(searchParams.get('limit') || '10');
    const skip = (page - 1) * limit;

    // On Vercel: use Supabase
    if (isVercel) {
      const supabase = await getSupabase();
      if (!supabase) {
        return NextResponse.json({ error: 'Base de datos no disponible' }, { status: 503 });
      }

      const { data: executions, count, error } = await supabase.from('late_fee_executions').select('*', { count: 'exact' }).order('created_at', { ascending: false }).range(skip, skip + limit - 1);

      if (error) {
        console.error('[LateFee] Supabase query error:', error.message);
        return NextResponse.json({ error: 'Error al obtener historial' }, { status: 500 });
      }

      return NextResponse.json({
        executions: executions || [],
        pagination: {
          page,
          limit,
          total: count || 0,
          totalPages: Math.ceil((count || 0) / limit),
        },
      });
    }

    // Local: Prisma
    const [executions, total] = await Promise.all([
      db.lateFeeExecution.findMany({
        orderBy: { createdAt: 'desc' },
        skip,
        take: limit,
      }),
      db.lateFeeExecution.count(),
    ]);

    return NextResponse.json({
      executions,
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

// POST /api/late-fee - Run the late fee calculation
export async function POST(request: NextRequest) {
  const startTime = Date.now();

  // On Vercel: use Supabase for all operations
  if (isVercel) {
    try {
      const supabase = await getSupabase();
      if (!supabase) {
        return NextResponse.json({ error: 'Base de datos no disponible' }, { status: 503 });
      }

      const body = await request.json() || {};
      const triggeredBy = body.triggeredBy || 'manual';

      // Get settings from Supabase
      const { data: settings } = await supabase.from('settings').select('key, value');
      const configMap: Record<string, string> = {};
      (settings || []).forEach((s: { key: string; value: string }) => { configMap[s.key] = s.value; });

      const lateFeeRate = parseFloat(configMap.late_fee_rate_per_day || '2.0');
      const moraThreshold = parseInt(configMap.mora_threshold_days || '1');
      const autoMoraEnabled = configMap.auto_mora_enabled !== 'false';

      if (!autoMoraEnabled && triggeredBy === 'automatic') {
        return NextResponse.json({ message: 'Mora automática deshabilitada' }, { status: 400 });
      }

      const today = new Date();
      today.setHours(0, 0, 0, 0);

      // Get active loans from Supabase
      const { data: activeLoans } = await supabase.from('loans').select('*').eq('status', 'active');

      let loansProcessed = 0;
      let feesGenerated = 0;
      let totalFeeAmount = 0;
      let loansMovedToMora = 0;
      const newFees: { loanId: string; daysLate: number; amount: number }[] = [];

      for (const loan of (activeLoans || [])) {
        loansProcessed++;

        if (!loan.end_date || loan.amount_paid >= loan.total_amount) continue;

        const endDate = new Date(loan.end_date);
        endDate.setHours(0, 0, 0, 0);

        if (endDate < today) {
          const daysLate = Math.floor((today.getTime() - endDate.getTime()) / 86400000);

          if (daysLate >= moraThreshold) {
            // Move loan to mora status
            await supabase.from('loans').update({ status: 'mora' }).eq('id', loan.id);
            loansMovedToMora++;

            // Check if there's already a pending late fee for this loan today
            const { data: existingFee } = await supabase.from('late_fees').select('id').eq('loan_id', loan.id).eq('status', 'pending').gte('generated_at', today.toISOString()).maybeSingle();

            if (!existingFee) {
              const feeAmount = daysLate * lateFeeRate;
              await supabase.from('late_fees').insert({
                loan_id: loan.id,
                days_late: daysLate,
                amount: feeAmount,
                rate_per_day: lateFeeRate,
                status: 'pending',
              });

              feesGenerated++;
              totalFeeAmount += feeAmount;
              newFees.push({ loanId: loan.id, daysLate, amount: feeAmount });
            }
          }
        }
      }

      // Also check existing mora loans for additional late fees
      const { data: moraLoans } = await supabase.from('loans').select('*').eq('status', 'mora');

      for (const loan of (moraLoans || [])) {
        if (!loan.end_date || loan.amount_paid >= loan.total_amount) continue;

        const endDate = new Date(loan.end_date);
        endDate.setHours(0, 0, 0, 0);

        const daysLate = Math.floor((today.getTime() - endDate.getTime()) / 86400000);

        const { data: existingFee } = await supabase.from('late_fees').select('id').eq('loan_id', loan.id).eq('status', 'pending').gte('generated_at', today.toISOString()).maybeSingle();

        if (!existingFee && daysLate >= moraThreshold) {
          const feeAmount = lateFeeRate;
          await supabase.from('late_fees').insert({
            loan_id: loan.id,
            days_late: daysLate,
            amount: feeAmount,
            rate_per_day: lateFeeRate,
            status: 'pending',
          });

          feesGenerated++;
          totalFeeAmount += feeAmount;
          newFees.push({ loanId: loan.id, daysLate, amount: feeAmount });
        }
      }

      const executionTime = Date.now() - startTime;

      // Log the execution
      const { data: execution } = await supabase.from('late_fee_executions').insert({
        execution_date: today.toISOString(),
        loans_processed: loansProcessed,
        fees_generated: feesGenerated,
        total_fee_amount: totalFeeAmount,
        loans_moved_to_mora: loansMovedToMora,
        status: 'completed',
        execution_time_ms: executionTime,
        triggered_by: triggeredBy,
      }).select().single();

      // Update the cron last run setting
      await supabase.from('settings').upsert({
        key: 'cron_last_run',
        value: today.toISOString(),
      }, { onConflict: 'key' });

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
      console.error('Error running late fee calculation (Vercel):', error);
      return NextResponse.json({ error: 'Error al ejecutar cálculo de mora' }, { status: 500 });
    }
  }

  // Local mode: Prisma
  try {
    const body = await request.json() || {};
    const triggeredBy = body.triggeredBy || 'manual';

    // Get settings
    const settings = await db.setting.findMany();
    const configMap: Record<string, string> = {};
    settings.forEach((s) => { configMap[s.key] = s.value; });

    const lateFeeRate = parseFloat(configMap.late_fee_rate_per_day || '2.0');
    const moraThreshold = parseInt(configMap.mora_threshold_days || '1');
    const autoMoraEnabled = configMap.auto_mora_enabled !== 'false';

    if (!autoMoraEnabled && triggeredBy === 'automatic') {
      return NextResponse.json({ message: 'Mora automática deshabilitada' }, { status: 400 });
    }

    const today = new Date();
    today.setHours(0, 0, 0, 0);

    // Find all active loans
    const activeLoans = await db.loan.findMany({
      where: { status: 'active' },
    });

    let loansProcessed = 0;
    let feesGenerated = 0;
    let totalFeeAmount = 0;
    let loansMovedToMora = 0;
    const newFees: { loanId: string; daysLate: number; amount: number }[] = [];

    for (const loan of activeLoans) {
      loansProcessed++;

      // Check if loan has overdue payments
      // A loan is overdue if endDate has passed and amountPaid < totalAmount
      if (!loan.endDate || loan.amountPaid >= loan.totalAmount) continue;

      const endDate = new Date(loan.endDate);
      endDate.setHours(0, 0, 0, 0);

      if (endDate < today) {
        const daysLate = Math.floor((today.getTime() - endDate.getTime()) / 86400000);

        if (daysLate >= moraThreshold) {
          // Move loan to mora status
          await db.loan.update({
            where: { id: loan.id },
            data: { status: 'mora' },
          });

          loansMovedToMora++;

          // Check if there's already a pending late fee for this loan today
          const existingFee = await db.lateFee.findFirst({
            where: {
              loanId: loan.id,
              status: 'pending',
              generatedAt: {
                gte: today,
              },
            },
          });

          if (!existingFee) {
            const feeAmount = daysLate * lateFeeRate;
            await db.lateFee.create({
              data: {
                loanId: loan.id,
                daysLate,
                amount: feeAmount,
                ratePerDay: lateFeeRate,
                status: 'pending',
              },
            });

            feesGenerated++;
            totalFeeAmount += feeAmount;
            newFees.push({ loanId: loan.id, daysLate, amount: feeAmount });
          }

          // Create audit log for mora status change
          await db.auditLog.create({
            data: {
              action: 'UPDATE',
              entityType: 'loan',
              entityId: loan.id,
              entityName: `Préstamo ${loan.id.slice(-6)}`,
              severity: 'warning',
              notes: `Préstamo pasó a mora (${daysLate} días de atraso)`,
              changes: JSON.stringify({ field: 'status', oldValue: 'active', newValue: 'mora' }),
            },
          });
        }
      }
    }

    // Also check existing mora loans for additional late fees
    const moraLoans = await db.loan.findMany({
      where: { status: 'mora' },
    });

    for (const loan of moraLoans) {
      if (!loan.endDate || loan.amountPaid >= loan.totalAmount) continue;

      const endDate = new Date(loan.endDate);
      endDate.setHours(0, 0, 0, 0);

      const daysLate = Math.floor((today.getTime() - endDate.getTime()) / 86400000);

      // Check if fee already generated today
      const existingFee = await db.lateFee.findFirst({
        where: {
          loanId: loan.id,
          status: 'pending',
          generatedAt: { gte: today },
        },
      });

      if (!existingFee && daysLate >= moraThreshold) {
        const feeAmount = lateFeeRate; // Daily rate for ongoing mora
        await db.lateFee.create({
          data: {
            loanId: loan.id,
            daysLate,
            amount: feeAmount,
            ratePerDay: lateFeeRate,
            status: 'pending',
          },
        });

        feesGenerated++;
        totalFeeAmount += feeAmount;
        newFees.push({ loanId: loan.id, daysLate, amount: feeAmount });
      }
    }

    const executionTime = Date.now() - startTime;

    // Log the execution
    const execution = await db.lateFeeExecution.create({
      data: {
        executionDate: today,
        loansProcessed,
        feesGenerated,
        totalFeeAmount,
        loansMovedToMora,
        status: 'completed',
        executionTimeMs: executionTime,
        triggeredBy,
      },
    });

    // Update the cron last run setting
    await db.setting.upsert({
      where: { key: 'cron_last_run' },
      update: { value: today.toISOString() },
      create: { key: 'cron_last_run', value: today.toISOString() },
    });

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

    // Log failed execution
    const executionTime = Date.now() - startTime;
    await db.lateFeeExecution.create({
      data: {
        executionDate: new Date(),
        loansProcessed: 0,
        feesGenerated: 0,
        totalFeeAmount: 0,
        loansMovedToMora: 0,
        status: 'failed',
        errorMessage: error instanceof Error ? error.message : 'Unknown error',
        executionTimeMs: executionTime,
        triggeredBy: 'manual',
      },
    });

    return NextResponse.json({ error: 'Error al ejecutar cálculo de mora' }, { status: 500 });
  }
}

// PUT /api/late-fee - Update late fee configuration
export async function PUT(request: NextRequest) {
  try {
    const body = await request.json();
    const { lateFeeRatePerDay, lateFeeEnabled, moraThresholdDays, autoMoraEnabled } = body;

    // On Vercel: use Supabase for settings
    if (isVercel) {
      const supabase = await getSupabase();
      if (!supabase) {
        return NextResponse.json({ error: 'Base de datos no disponible' }, { status: 503 });
      }

      if (lateFeeRatePerDay !== undefined) {
        await supabase.from('settings').upsert({ key: 'late_fee_rate_per_day', value: lateFeeRatePerDay.toString() }, { onConflict: 'key' });
      }

      if (lateFeeEnabled !== undefined) {
        await supabase.from('settings').upsert({ key: 'late_fee_enabled', value: lateFeeEnabled.toString() }, { onConflict: 'key' });
      }

      if (moraThresholdDays !== undefined) {
        await supabase.from('settings').upsert({ key: 'mora_threshold_days', value: moraThresholdDays.toString() }, { onConflict: 'key' });
      }

      if (autoMoraEnabled !== undefined) {
        await supabase.from('settings').upsert({ key: 'auto_mora_enabled', value: autoMoraEnabled.toString() }, { onConflict: 'key' });
      }

      return NextResponse.json({ message: 'Configuración actualizada' });
    }

    // Local mode: Prisma
    const updates: Promise<unknown>[] = [];

    if (lateFeeRatePerDay !== undefined) {
      updates.push(
        db.setting.upsert({
          where: { key: 'late_fee_rate_per_day' },
          update: { value: lateFeeRatePerDay.toString() },
          create: { key: 'late_fee_rate_per_day', value: lateFeeRatePerDay.toString() },
        })
      );
    }

    if (lateFeeEnabled !== undefined) {
      updates.push(
        db.setting.upsert({
          where: { key: 'late_fee_enabled' },
          update: { value: lateFeeEnabled.toString() },
          create: { key: 'late_fee_enabled', value: lateFeeEnabled.toString() },
        })
      );
    }

    if (moraThresholdDays !== undefined) {
      updates.push(
        db.setting.upsert({
          where: { key: 'mora_threshold_days' },
          update: { value: moraThresholdDays.toString() },
          create: { key: 'mora_threshold_days', value: moraThresholdDays.toString() },
        })
      );
    }

    if (autoMoraEnabled !== undefined) {
      updates.push(
        db.setting.upsert({
          where: { key: 'auto_mora_enabled' },
          update: { value: autoMoraEnabled.toString() },
          create: { key: 'auto_mora_enabled', value: autoMoraEnabled.toString() },
        })
      );
    }

    await Promise.all(updates);

    // Create audit log for config change
    await db.auditLog.create({
      data: {
        action: 'UPDATE',
        entityType: 'setting',
        entityName: 'Configuración de Mora',
        severity: 'warning',
        notes: 'Configuración de mora actualizada',
        changes: JSON.stringify(body),
      },
    });

    return NextResponse.json({ message: 'Configuración actualizada' });
  } catch (error) {
    console.error('Error updating late fee config:', error);
    return NextResponse.json({ error: 'Error al actualizar configuración' }, { status: 500 });
  }
}

// PATCH /api/late-fee - Waive a late fee (single or bulk)
export async function PATCH(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const type = searchParams.get('type');

    // Single late fee waiver: PATCH /api/late-fee?id=xxx
    if (type !== 'bulk-waive') {
      const id = searchParams.get('id');
      if (!id) {
        return NextResponse.json({ error: 'ID de mora requerido' }, { status: 400 });
      }

      const body = await request.json();
      const { waivedBy, waivedReason } = body;

      if (isVercel) {
        const supabase = await getSupabase();
        if (!supabase) {
          return NextResponse.json({ error: 'Base de datos no disponible' }, { status: 503 });
        }

        const { error } = await supabase.from('late_fees').update({
          status: 'waived',
          waived_by: waivedBy || null,
          waived_reason: waivedReason || null,
          waived_at: new Date().toISOString(),
        }).eq('id', id);

        if (error) {
          console.error('[LateFee] Error waiving fee:', error.message);
          return NextResponse.json({ error: 'Error al condonar mora' }, { status: 500 });
        }

        return NextResponse.json({ success: true });
      }

      // Local: Prisma
      await db.lateFee.update({
        where: { id },
        data: {
          status: 'waived',
          waivedBy: waivedBy || null,
          waivedReason: waivedReason || null,
          waivedAt: new Date(),
        },
      });

      return NextResponse.json({ success: true });
    }

    // Bulk waiver: PATCH /api/late-fee?type=bulk-waive
    const body = await request.json();
    const { ids, loanId, waivedBy, waivedReason } = body;

    // Support loanId: find all pending fees for that loan
    let feeIds = ids;
    if (!feeIds && loanId) {
      if (isVercel) {
        const supabase = await getSupabase();
        if (!supabase) return NextResponse.json({ error: 'Base de datos no disponible' }, { status: 503 });
        const { data: fees } = await supabase.from('late_fees').select('id').eq('loan_id', loanId).eq('status', 'pending');
        feeIds = (fees || []).map((f: Record<string, unknown>) => f.id);
      } else {
        const fees = await db.lateFee.findMany({ where: { loanId, status: 'pending' }, select: { id: true } });
        feeIds = fees.map(f => f.id);
      }
    }

    if (!feeIds || !Array.isArray(feeIds) || feeIds.length === 0) {
      return NextResponse.json({ error: 'No hay recargos pendientes para condonar' }, { status: 400 });
    }

    if (isVercel) {
      const supabase = await getSupabase();
      if (!supabase) {
        return NextResponse.json({ error: 'Base de datos no disponible' }, { status: 503 });
      }

      const { data, error } = await supabase.from('late_fees').update({
        status: 'waived',
        waived_by: waivedBy || null,
        waived_reason: waivedReason || null,
        waived_at: new Date().toISOString(),
      }).in('id', feeIds).select();

      if (error) {
        console.error('[LateFee] Error bulk waiving fees:', error.message);
        return NextResponse.json({ error: 'Error al condonar moras' }, { status: 500 });
      }

      return NextResponse.json({ success: true, count: (data || []).length });
    }

    // Local: Prisma
    const result = await db.lateFee.updateMany({
      where: { id: { in: feeIds } },
      data: {
        status: 'waived',
        waivedBy: waivedBy || null,
        waivedReason: waivedReason || null,
        waivedAt: new Date(),
      },
    });

    return NextResponse.json({ success: true, count: result.count });
  } catch (error) {
    console.error('Error waiving late fee:', error);
    return NextResponse.json({ error: 'Error al condonar mora' }, { status: 500 });
  }
}
