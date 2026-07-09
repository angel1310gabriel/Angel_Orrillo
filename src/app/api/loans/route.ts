import { NextRequest, NextResponse } from 'next/server';
import { db, isVercel } from '@/lib/db';

// GET /api/loans - List loans with filters
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const status = searchParams.get('status');
    const clientId = searchParams.get('clientId');
    const collectorId = searchParams.get('collectorId');
    const zoneId = searchParams.get('zoneId');
    const page = parseInt(searchParams.get('page') || '1');
    const limit = parseInt(searchParams.get('limit') || '50');

    // Try Supabase first if configured (lazy-loaded) - with timeout to prevent hanging
    try {
      const { isSupabaseConfigured, getLoans: supabaseGetLoans } = await import('@/lib/supabase-server');
      if (isSupabaseConfigured()) {
        try {
          const data = await Promise.race([
            supabaseGetLoans({
              status: status || undefined,
              clientId: clientId || undefined,
              collectorId: collectorId || undefined,
              zoneId: zoneId || undefined,
              page,
              limit,
            }),
            new Promise<null>((_, reject) => setTimeout(() => reject(new Error('Supabase timeout')), 5000)),
          ]);
          // Only return Supabase data if query succeeded (even if empty resultset)
          if (data && data !== null) {
            return NextResponse.json(data);
          }
        } catch (error) {
          console.error('Supabase getLoans failed, falling back to Prisma:', error);
        }
      }
    } catch (error) {
      console.error('Supabase not available, using Prisma fallback:', error);
    }

    // On Vercel, if Supabase failed, don't fall back to Prisma (no SQLite)


    // Fallback to Prisma
    const skip = (page - 1) * limit;

    const where: Record<string, unknown> = {};
    if (status) where.status = status;
    if (clientId) where.clientId = clientId;
    if (collectorId) where.collectorId = collectorId;
    if (zoneId) where.zoneId = zoneId;

    const [loans, total] = await Promise.all([
      db.loan.findMany({
        where,
        include: {
          client: { select: { id: true, name: true, documentNumber: true, documentType: true, phone: true, creditScore: true } },
          collector: { select: { id: true, name: true } },
          zone: { select: { id: true, name: true } },
          payments: {
            where: { status: 'completed' },
            orderBy: { paymentDate: 'desc' },
            take: 5,
          },
          lateFees: {
            where: { status: 'pending' },
          },
          schedule: {
            orderBy: { installmentNumber: 'asc' },
            take: 5,
          },
        },
        orderBy: { createdAt: 'desc' },
        skip,
        take: limit,
      }),
      db.loan.count({ where }),
    ]);

    const loansWithProgress = loans.map((loan) => {
      const progressPercent = loan.totalAmount > 0 ? (loan.amountPaid / loan.totalAmount) * 100 : 0;
      const remaining = loan.totalAmount - loan.amountPaid;
      const daysElapsed = loan.startDate
        ? Math.floor((Date.now() - new Date(loan.startDate).getTime()) / 86400000)
        : 0;
      const daysRemaining = loan.endDate
        ? Math.floor((new Date(loan.endDate).getTime() - Date.now()) / 86400000)
        : null;
      const isOverdue = daysRemaining !== null && daysRemaining < 0;

      return {
        ...loan,
        progressPercent: Math.min(100, Math.round(progressPercent * 100) / 100),
        remaining: Math.max(0, remaining),
        daysElapsed,
        daysRemaining,
        isOverdue,
        pendingLateFees: loan.lateFees.length,
      };
    });

    return NextResponse.json({
      loans: loansWithProgress,
      pagination: { page, limit, total, totalPages: Math.ceil(total / limit) },
    });
  } catch (error) {
    console.error('Error fetching loans:', error);
    return NextResponse.json({ error: 'Error al obtener préstamos' }, { status: 500 });
  }
}

// POST /api/loans - Create a new loan (GOTA A GOTA)
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const {
      clientId,
      collectorId,
      zoneId,
      amount,
      interestRate,
      days,
      numCuotas: numCuotasInput,
      dailyPayment: dailyPaymentInput,
      paymentFrequency,
      restDays,
      startDate,
      notes,
      guarantors,
    } = body;

    // Validation
    if (!clientId || !amount || !interestRate || !days) {
      return NextResponse.json(
        { error: 'Cliente, monto, tasa de interés y días son requeridos' },
        { status: 400 }
      );
    }

    if (amount <= 0) {
      return NextResponse.json({ error: 'El monto debe ser mayor a 0' }, { status: 400 });
    }

    if (interestRate < 0 || interestRate > 100) {
      return NextResponse.json({ error: 'La tasa de interés debe estar entre 0 y 100' }, { status: 400 });
    }

    // Try Supabase first if configured (lazy-loaded)
    try {
      const { isSupabaseConfigured, createLoan: supabaseCreateLoan } = await import('@/lib/supabase-server');
      if (isSupabaseConfigured()) {
        try {
          const loan = await Promise.race([
            supabaseCreateLoan({
              clientId,
              collectorId,
              zoneId,
              amount,
              interestRate,
              days,
              numCuotas: numCuotasInput,
              dailyPayment: dailyPaymentInput,
              paymentFrequency,
              restDays,
              startDate,
              notes,
              createdBy: collectorId,
            }),
            new Promise<null>((_, reject) => setTimeout(() => reject(new Error('Supabase timeout')), 5000)),
          ]);
          if (loan === null) throw new Error('Supabase timeout');
          if (loan) {
            return NextResponse.json(loan, { status: 201 });
          }
        } catch (error) {
          // Map known errors to HTTP responses (only if not a data mismatch issue)
          if (error instanceof Error) {
            if (error.message.includes('préstamo activo')) {
              return NextResponse.json(
                { error: 'El cliente ya tiene un préstamo activo. Debe completar o cancelar el préstamo anterior.' },
                { status: 409 }
              );
            }
            if (error.message.includes('Capital insuficiente')) {
              return NextResponse.json({ error: error.message }, { status: 400 });
            }
          }
          console.error('Supabase createLoan failed, falling back to Prisma:', error);
        }
      }
    } catch (error) {
      console.error('Supabase not available, using Prisma fallback:', error);
    }

    // On Vercel, if Supabase failed, don't fall back to Prisma (no SQLite)


    // Fallback to Prisma
    // Check client exists
    const client = await db.client.findUnique({ where: { id: clientId } });
    if (!client) {
      return NextResponse.json({ error: 'Cliente no encontrado' }, { status: 404 });
    }

    // Check if client already has an active loan
    const activeLoan = await db.loan.findFirst({
      where: { clientId, status: { in: ['active', 'mora'] } },
    });
    if (activeLoan) {
      return NextResponse.json(
        { error: 'El cliente ya tiene un préstamo activo. Debe completar o cancelar el préstamo anterior.' },
        { status: 409 }
      );
    }

    // Calculate loan amounts (GOTA A GOTA logic)
    const interestAmount = amount * (interestRate / 100);
    const totalAmount = amount + interestAmount;
    const numCuotas = numCuotasInput || days;
    const dailyPayment = dailyPaymentInput || Math.round((totalAmount / days) * 100) / 100;
    const loanStartDate = startDate ? new Date(startDate) : new Date();
    const loanEndDate = new Date(loanStartDate.getTime() + days * 86400000);

    // Check capital availability
    const lastCapitalMovement = await db.capitalMovement.findFirst({
      orderBy: { createdAt: 'desc' },
    });
    const currentCapital = lastCapitalMovement?.newCapital || 0;

    if (currentCapital < amount) {
      return NextResponse.json(
        { error: `Capital insuficiente. Disponible: S/${currentCapital.toFixed(2)}, Necesario: S/${amount.toFixed(2)}` },
        { status: 400 }
      );
    }

    // Create loan with payment schedule
    const loan = await db.loan.create({
      data: {
        clientId,
        collectorId: collectorId || null,
        zoneId: zoneId || client.zoneId || null,
        amount,
        totalAmount,
        interest: interestAmount,
        days,
        dailyPayment,
        paymentFrequency: paymentFrequency || 'daily',
        numCuotas,
        amountPaid: 0,
        startDate: loanStartDate,
        endDate: loanEndDate,
        status: 'active',
        creditApproved: true,
        notes: notes || null,
        restDays: restDays ? (Array.isArray(restDays) ? restDays.join(',') : String(restDays)) : '',
        createdBy: collectorId || null,
        // Generate payment schedule
        schedule: {
          create: (() => {
            const restSet = new Set((restDays ? String(restDays).split(',').map(Number) : []).filter(n => !isNaN(n)));
            const nextBiz = (d: Date) => { const d2 = new Date(d); while (restSet.has(d2.getDay())) d2.setDate(d2.getDate() + 1); return d2; };
            return Array.from({ length: numCuotas }, (_, i) => {
              const offset = paymentFrequency === 'weekly' ? (i + 1) * 7 : (i + 1);
              const dueDate = nextBiz(new Date(loanStartDate.getTime() + offset * 86400000));
              return { installmentNumber: i + 1, amount: dailyPayment, dueDate, status: 'pending' };
            });
          })(),
        },
      },
      include: {
        client: { select: { id: true, name: true, documentNumber: true, documentType: true, phone: true } },
        collector: { select: { id: true, name: true } },
        zone: { select: { id: true, name: true } },
        schedule: { orderBy: { installmentNumber: 'asc' } },
      },
    });

    // Deduct from capital
    const newCapital = currentCapital - amount;
    await db.capitalMovement.create({
      data: {
        type: 'PRESTAMO',
        amount,
        previousCapital: currentCapital,
        newCapital,
        description: `Préstamo creado para ${client.name} - ${days} cuotas de S/${dailyPayment}`,
      },
    });

    // Update client credit score (slight decrease for new loan)
    await db.client.update({
      where: { id: clientId },
      data: {
        creditScore: Math.max(0, (client.creditScore || 50) - 2),
      },
    });

    // Create guarantors if provided
    if (guarantors && Array.isArray(guarantors)) {
      for (const g of guarantors) {
        if (g.name) {
          await db.guarantor.create({
            data: {
              clientId,
              name: g.name,
              documentNumber: g.documentNumber || null,
              documentType: g.documentType || null,
              phone: g.phone || null,
              address: g.address || null,
            },
          });
        }
      }
    }

    // Audit log
    await db.audit_logs.create({
      data: {
        action: 'CREATE',
        entityType: 'loan',
        entityId: loan.id,
        entityName: `Préstamo ${client.name} - S/${amount}`,
        severity: 'info',
        notes: `Préstamo creado: S/${amount} a ${client.name}, ${days} cuotas de S/${dailyPayment}, interés ${interestRate}%`,
        changes: JSON.stringify({
          amount,
          totalAmount,
          interest: interestAmount,
          days,
          dailyPayment,
          clientId,
          startDate: loanStartDate,
          endDate: loanEndDate,
        }),
      },
    });

    // Push loan to Supabase in background
    pushLoanToSupabase({
      id: loan.id,
      clientId,
      collectorId: collectorId || null,
      zoneId: zoneId || client.zoneId || null,
      amount,
      totalAmount,
      interestRate,
      interestAmount,
      dailyPayment,
      days,
      startDate: loanStartDate,
      endDate: loanEndDate,
      status: 'active',
    }).catch((err) => console.error('[Loans] Push to Supabase error:', err));

    return NextResponse.json(loan, { status: 201 });
  } catch (error) {
    console.error('Error creating loan:', error);
    return NextResponse.json({ error: 'Error al crear préstamo' }, { status: 500 });
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
// Helper: Push loan to Supabase
// ============================================================
async function pushLoanToSupabase(loan: {
  id: string; clientId: string; collectorId: string | null; zoneId: string | null;
  amount: number; totalAmount: number; interestRate: number; interestAmount: number;
  dailyPayment: number; days: number; startDate: Date; endDate: Date; status: string;
}) {
  const supabase = await getSupabase();
  if (!supabase) return;

  const { error } = await supabase.from('loans').insert({
    id: loan.id,
    client_id: loan.clientId,
    collector_id: loan.collectorId,
    zone_id: loan.zoneId,
    amount: loan.amount,
    total_amount: loan.totalAmount,
    interest_rate: loan.interestRate,
    interest_amount: loan.interestAmount,
    daily_payment: loan.dailyPayment,
    num_cuotas: loan.days,
    amount_paid: 0,
    start_date: loan.startDate.toISOString(),
    end_date: loan.endDate.toISOString(),
    status: loan.status,
  });

  if (error) console.error('[Loans] Push to Supabase error:', error.message);
  else console.log('[Loans] Loan pushed to Supabase:', loan.id);
}

// PUT /api/loans - Update a loan
export async function PUT(request: NextRequest) {
  try {
    const body = await request.json();
    const { id, status, notes, collectorId, cancellationReason } = body;

    if (!id) {
      return NextResponse.json({ error: 'ID es requerido' }, { status: 400 });
    }

    // Try Supabase first if configured (lazy-loaded)
    try {
      const { isSupabaseConfigured, updateLoan: supabaseUpdateLoan } = await import('@/lib/supabase-server');
      if (isSupabaseConfigured()) {
        try {
          const loan = await Promise.race([
            supabaseUpdateLoan(id, {
              status,
              notes,
              collectorId,
              cancellationReason,
            }),
            new Promise<null>((_, reject) => setTimeout(() => reject(new Error('Supabase timeout')), 5000)),
          ]);
          if (loan === null) throw new Error('Supabase timeout');
          if (loan) {
            return NextResponse.json(loan);
          }
        } catch (error) {
          if (error instanceof Error) {
            if (error.message.includes('no encontrado')) {
              return NextResponse.json({ error: 'Préstamo no encontrado' }, { status: 404 });
            }
            if (error.message.includes('totalmente pagado')) {
              return NextResponse.json(
                { error: 'No se puede completar un préstamo que no está totalmente pagado' },
                { status: 400 }
              );
            }
          }
          console.error('Supabase updateLoan failed, falling back to Prisma:', error);
        }
      }
    } catch (error) {
      console.error('Supabase not available, using Prisma fallback:', error);
    }

    // On Vercel, if Supabase failed, don't fall back to Prisma (no SQLite)


    // Fallback to Prisma
    const existing = await db.loan.findUnique({
      where: { id },
      include: { client: { select: { name: true } } },
    });

    if (!existing) {
      return NextResponse.json({ error: 'Préstamo no encontrado' }, { status: 404 });
    }

    const updateData: Record<string, unknown> = {};
    if (status) updateData.status = status;
    if (notes !== undefined) updateData.notes = notes;
    if (collectorId !== undefined) updateData.collectorId = collectorId;

    // If marking as completed, check if fully paid
    if (status === 'completed' && existing.amountPaid < existing.totalAmount) {
      return NextResponse.json(
        { error: 'No se puede completar un préstamo que no está totalmente pagado' },
        { status: 400 }
      );
    }

    // If cancelling, set cancellation fields and return remaining to capital
    if (status === 'cancelled' && existing.status !== 'cancelled') {
      updateData.cancellationReason = cancellationReason || null;
      updateData.cancelledBy = null; // TODO: pass user info when auth context is available
      updateData.cancelledAt = new Date().toISOString();
      const remaining = existing.amount - existing.amountPaid;
      if (remaining > 0) {
        const lastCapital = await db.capitalMovement.findFirst({ orderBy: { createdAt: 'desc' } });
        const currentCapital = lastCapital?.newCapital || 0;
        await db.capitalMovement.create({
          data: {
            type: 'RETIRO',
            amount: remaining,
            previousCapital: currentCapital,
            newCapital: currentCapital + remaining,
            description: `Préstamo cancelado - reintegro de ${existing.client.name}`,
          },
        });
      }
      // Update client credit score (penalty for cancellation)
      await db.client.update({
        where: { id: existing.clientId },
        data: { creditScore: Math.max(0, (await db.client.findUnique({ where: { id: existing.clientId } }))!.creditScore! - 15) },
      });
    }

    const loan = await db.loan.update({
      where: { id },
      data: updateData,
      include: {
        client: { select: { id: true, name: true, documentNumber: true, documentType: true, phone: true } },
        collector: { select: { id: true, name: true } },
      },
    });

    // Audit log
    await db.audit_logs.create({
      data: {
        action: 'UPDATE',
        entityType: 'loan',
        entityId: id,
        entityName: `Préstamo ${existing.client.name}`,
        severity: status === 'cancelled' ? 'critical' : status === 'completed' ? 'info' : 'warning',
        notes: `Préstamo actualizado: estado ${existing.status} → ${status || existing.status}`,
        changes: JSON.stringify({ field: 'status', oldValue: existing.status, newValue: status }),
      },
    });

    return NextResponse.json(loan);
  } catch (error) {
    console.error('Error updating loan:', error);
    return NextResponse.json({ error: 'Error al actualizar préstamo' }, { status: 500 });
  }
}

// DELETE /api/loans - Delete a loan
export async function DELETE(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const id = searchParams.get('id');

    if (!id) {
      return NextResponse.json({ error: 'ID es requerido' }, { status: 400 });
    }

    // On Vercel: use Supabase as primary DB
    if (isVercel) {
      const supabase = await getSupabase();
      if (!supabase) {
        return NextResponse.json({ error: 'Base de datos no disponible' }, { status: 503 });
      }

      // Check existing via Supabase
      const { data: loan, error: findError } = await supabase.from('loans').select('id, client_id, status, amount').eq('id', id).maybeSingle();
      if (!loan || findError) {
        return NextResponse.json({ error: 'Préstamo no encontrado' }, { status: 404 });
      }

      // Only allow deleting cancelled or completed loans
      if (loan.status !== 'cancelled' && loan.status !== 'completed') {
        return NextResponse.json({ error: 'Solo se pueden eliminar préstamos cancelados o completados' }, { status: 400 });
      }

      // Delete via Supabase
      const { error: deleteError } = await supabase.from('loans').delete().eq('id', id);
      if (deleteError) {
        console.error('[Loans] Supabase delete error:', deleteError.message);
        return NextResponse.json({ error: 'Error al eliminar préstamo' }, { status: 500 });
      }

      return NextResponse.json({ message: 'Préstamo eliminado' });
    }

    // Local mode: Prisma-first with Supabase
    const loan = await db.loan.findUnique({ where: { id }, include: { client: { select: { name: true } } } });
    if (!loan) {
      return NextResponse.json({ error: 'Préstamo no encontrado' }, { status: 404 });
    }

    if (loan.status !== 'cancelled' && loan.status !== 'completed') {
      return NextResponse.json({ error: 'Solo se pueden eliminar préstamos cancelados o completados' }, { status: 400 });
    }

    await db.loan.delete({ where: { id } });

    // Also delete from Supabase in background
    const supabase = await getSupabase();
    if (supabase) {
      supabase.from('loans').delete().eq('id', id).then(({ error }) => {
        if (error) console.error('[Loans] Delete from Supabase error:', error.message);
      });
    }

    // Audit log
    await db.audit_logs.create({
      data: {
        action: 'DELETE', entityType: 'loan', entityId: id,
        entityName: `Préstamo ${loan.client.name}`,
        severity: 'warning',
        notes: `Préstamo eliminado: ${loan.client.name} - S/${loan.amount}`,
      },
    }).catch(() => {});

    return NextResponse.json({ message: 'Préstamo eliminado' });
  } catch (error) {
    console.error('Error deleting loan:', error);
    return NextResponse.json({ error: 'Error al eliminar préstamo' }, { status: 500 });
  }
}
