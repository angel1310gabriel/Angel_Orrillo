import { NextRequest, NextResponse } from 'next/server';
import { db, isVercel } from '@/lib/db';

// GET /api/payments - List payments with filters
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const loanId = searchParams.get('loanId');
    const clientId = searchParams.get('clientId');
    const collectorId = searchParams.get('collectorId');
    const date = searchParams.get('date');
    const page = parseInt(searchParams.get('page') || '1');
    const limit = parseInt(searchParams.get('limit') || '50');

    // Try Supabase first if configured (lazy-loaded)
    try {
      const { isSupabaseConfigured, getPayments: supabaseGetPayments } = await import('@/lib/supabase-server');
      if (isSupabaseConfigured()) {
        try {
          const data = await Promise.race([
            supabaseGetPayments({
              loanId: loanId || undefined,
              clientId: clientId || undefined,
              collectorId: collectorId || undefined,
              date: date || undefined,
              page,
              limit,
            }),
            new Promise<null>((_, reject) => setTimeout(() => reject(new Error('Supabase timeout')), 5000)),
          ]);
          if (data === null) throw new Error('Supabase timeout');
          if (data) {
            return NextResponse.json(data);
          }
        } catch (error) {
          console.error('Supabase getPayments failed, falling back to Prisma:', error);
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

    const where: Record<string, unknown> = { status: 'completed' };
    if (loanId) where.loanId = loanId;
    if (collectorId) where.collectorId = collectorId;
    if (clientId) where.clientId = clientId;
    if (date) {
      const dateObj = new Date(date);
      dateObj.setHours(0, 0, 0, 0);
      const nextDay = new Date(dateObj.getTime() + 86400000);
      where.paymentDate = { gte: dateObj, lt: nextDay };
    }

    const [payments, total] = await Promise.all([
      db.payment.findMany({
        where,
        include: {
          loan: {
            include: {
              client: { select: { id: true, name: true, documentNumber: true, documentType: true, phone: true } },
            },
          },
          collector: { select: { id: true, name: true } },
        },
        orderBy: { paymentDate: 'desc' },
        skip,
        take: limit,
      }),
      db.payment.count({ where }),
    ]);

    return NextResponse.json({
      payments,
      pagination: { page, limit, total, totalPages: Math.ceil(total / limit) },
    });
  } catch (error) {
    console.error('Error fetching payments:', error);
    return NextResponse.json({ error: 'Error al obtener pagos' }, { status: 500 });
  }
}

// POST /api/payments - Register a payment (COBRO DIARIO)
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const {
      loanId,
      amount,
      collectorId,
      paymentMethod,
      observation,
      proofPhoto,
      gpsLatitude,
      gpsLongitude,
    } = body;

    if (!loanId || !amount) {
      return NextResponse.json({ error: 'Préstamo y monto son requeridos' }, { status: 400 });
    }

    if (amount <= 0) {
      return NextResponse.json({ error: 'El monto debe ser mayor a 0' }, { status: 400 });
    }

    // Try Supabase first if configured (lazy-loaded)
    try {
      const { isSupabaseConfigured, createPayment: supabaseCreatePayment } = await import('@/lib/supabase-server');
      if (isSupabaseConfigured()) {
        try {
          const payment = await Promise.race([
            supabaseCreatePayment({
              loanId,
              amount,
              collectorId,
              paymentMethod,
              observation,
              proofPhoto,
              createdBy: collectorId,
            }),
            new Promise<null>((_, reject) => setTimeout(() => reject(new Error('Supabase timeout')), 5000)),
          ]);
          if (payment === null) throw new Error('Supabase timeout');
          if (payment) {
            return NextResponse.json(payment, { status: 201 });
          }
        } catch (error) {
          if (error instanceof Error) {
            if (error.message.includes('no está activo')) {
              return NextResponse.json({ error: 'El préstamo no está activo' }, { status: 400 });
            }
            if (error.message.includes('mayor a 0')) {
              return NextResponse.json({ error: 'El monto debe ser mayor a 0' }, { status: 400 });
            }
          }
          console.error('Supabase createPayment failed, falling back to Prisma:', error);
        }
      }
    } catch (error) {
      console.error('Supabase not available, using Prisma fallback:', error);
    }

    // On Vercel, if Supabase failed, don't fall back to Prisma (no SQLite)
    if (isVercel) {
      return NextResponse.json({ error: 'Error al registrar pago - base de datos no disponible' }, { status: 503 });
    }

    // Fallback to Prisma
    // Get loan with client
    const loan = await db.loan.findUnique({
      where: { id: loanId },
      include: { client: { select: { id: true, name: true, creditScore: true } } },
    });

    if (!loan) {
      return NextResponse.json({ error: 'Préstamo no encontrado' }, { status: 404 });
    }

    if (loan.status !== 'active' && loan.status !== 'mora') {
      return NextResponse.json({ error: 'El préstamo no está activo' }, { status: 400 });
    }

    // Check if payment amount doesn't exceed remaining
    const remaining = loan.totalAmount - loan.amountPaid;
    const paymentAmount = Math.min(amount, remaining + 1); // Allow small overpayment

    // Create payment
    const payment = await db.payment.create({
      data: {
        loanId,
        collectorId: collectorId || null,
        clientId: loan.client.id,
        amount: paymentAmount,
        interest: 0,
        paymentMethod: paymentMethod || 'cash',
        status: 'completed',
        observation: observation || null,
        proofPhoto: proofPhoto || null,
        gpsLatitude: gpsLatitude || null,
        gpsLongitude: gpsLongitude || null,
        paymentDate: new Date(),
      },
      include: {
        loan: {
          include: {
            client: { select: { id: true, name: true, documentNumber: true, documentType: true, phone: true } },
          },
        },
        collector: { select: { id: true, name: true } },
      },
    });

    // Update loan amountPaid
    const newAmountPaid = loan.amountPaid + paymentAmount;
    const newStatus = newAmountPaid >= loan.totalAmount ? 'completed' : loan.status;

    await db.loan.update({
      where: { id: loanId },
      data: {
        amountPaid: newAmountPaid,
        status: newStatus,
      },
    });

    // If loan is completed, update payment schedule and client credit score
    if (newStatus === 'completed') {
      // Mark all remaining schedule as paid
      await db.paymentSchedule.updateMany({
        where: { loanId, status: 'pending' },
        data: { status: 'paid' },
      });

      // Increase client credit score
      const currentScore = loan.client.creditScore || 50;
      await db.client.update({
        where: { id: loan.client.id },
        data: { creditScore: Math.min(100, currentScore + 10) },
      });

      // Return capital + interest to capital
      const lastCapital = await db.capitalMovement.findFirst({ orderBy: { createdAt: 'desc' } });
      const currentCapital = lastCapital?.newCapital || 0;
      await db.capitalMovement.create({
        data: {
          type: 'RETIRO',
          amount: paymentAmount,
          previousCapital: currentCapital,
          newCapital: currentCapital + paymentAmount,
          description: `Pago final - Préstamo completado de ${loan.client.name}`,
        },
      });
    } else if (loan.status === 'mora') {
      // If it was in mora and a payment is made, increase credit score slightly
      const currentScore = loan.client.creditScore || 50;
      await db.client.update({
        where: { id: loan.client.id },
        data: { creditScore: Math.min(100, currentScore + 2) },
      });
    }

    // Mark the next pending schedule as paid
    const nextSchedule = await db.paymentSchedule.findFirst({
      where: { loanId, status: 'pending' },
      orderBy: { installmentNumber: 'asc' },
    });
    if (nextSchedule) {
      await db.paymentSchedule.update({
        where: { id: nextSchedule.id },
        data: { status: 'paid' },
      });
    }

    // Audit log
    await db.auditLog.create({
      data: {
        action: 'CREATE',
        entityType: 'payment',
        entityId: payment.id,
        entityName: `Pago S/${paymentAmount} - ${loan.client.name}`,
        severity: 'info',
        notes: `Pago registrado: S/${paymentAmount} para ${loan.client.name} (${paymentMethod || 'efectivo'})${newStatus === 'completed' ? ' - PRÉSTAMO COMPLETADO' : ''}`,
        changes: JSON.stringify({
          loanId,
          amount: paymentAmount,
          previousAmountPaid: loan.amountPaid,
          newAmountPaid,
          loanStatus: newStatus,
        }),
      },
    });

    // Push payment to Supabase in background
    pushPaymentToSupabase({
      id: payment.id,
      loanId,
      clientId: loan.client.id,
      collectorId: collectorId || null,
      amount: paymentAmount,
      paymentMethod: paymentMethod || 'cash',
      paymentDate: new Date(),
    }).catch((err) => console.error('[Payments] Push to Supabase error:', err));

    return NextResponse.json({
      ...payment,
      loanStatus: newStatus,
      loanCompleted: newStatus === 'completed',
    }, { status: 201 });
  } catch (error) {
    console.error('Error creating payment:', error);
    return NextResponse.json({ error: 'Error al registrar pago' }, { status: 500 });
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
// Helper: Push payment to Supabase
// ============================================================
async function pushPaymentToSupabase(payment: {
  id: string; loanId: string; clientId: string; collectorId: string | null;
  amount: number; paymentMethod: string; paymentDate: Date;
}) {
  const supabase = await getSupabase();
  if (!supabase) return;

  const { error } = await supabase.from('payments').insert({
    id: payment.id,
    loan_id: payment.loanId,
    client_id: payment.clientId,
    collector_id: payment.collectorId,
    amount: payment.amount,
    payment_method: payment.paymentMethod,
    payment_date: payment.paymentDate.toISOString(),
    status: 'completed',
  });

  if (error) console.error('[Payments] Push to Supabase error:', error.message);
  else console.log('[Payments] Payment pushed to Supabase:', payment.id);
}

// DELETE /api/payments - Delete a payment
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
      const { data: payment, error: findError } = await supabase.from('payments').select('id, loan_id, amount, status').eq('id', id).maybeSingle();
      if (!payment || findError) {
        return NextResponse.json({ error: 'Pago no encontrado' }, { status: 404 });
      }

      // Delete via Supabase
      const { error: deleteError } = await supabase.from('payments').delete().eq('id', id);
      if (deleteError) {
        console.error('[Payments] Supabase delete error:', deleteError.message);
        return NextResponse.json({ error: 'Error al eliminar pago' }, { status: 500 });
      }

      return NextResponse.json({ message: 'Pago eliminado', loanId: payment.loan_id, amount: payment.amount });
    }

    // Local mode: Prisma-first with Supabase
    const payment = await db.payment.findUnique({ where: { id }, include: { loan: { include: { client: { select: { name: true } } } } } });
    if (!payment) {
      return NextResponse.json({ error: 'Pago no encontrado' }, { status: 404 });
    }

    // Update loan amountPaid
    const newAmountPaid = Math.max(0, payment.loan.amountPaid - payment.amount);
    const newStatus = newAmountPaid >= payment.loan.totalAmount ? 'completed' : (newAmountPaid > 0 ? 'active' : 'active');

    await db.loan.update({
      where: { id: payment.loanId },
      data: { amountPaid: newAmountPaid, status: newStatus },
    });

    await db.payment.delete({ where: { id } });

    // Also delete from Supabase in background
    const supabase = await getSupabase();
    if (supabase) {
      supabase.from('payments').delete().eq('id', id).then(({ error }) => {
        if (error) console.error('[Payments] Delete from Supabase error:', error.message);
      });
    }

    // Audit log
    await db.auditLog.create({
      data: {
        action: 'DELETE', entityType: 'payment', entityId: id,
        entityName: `Pago S/${payment.amount} - ${payment.loan.client.name}`,
        severity: 'warning',
        notes: `Pago eliminado: S/${payment.amount} de ${payment.loan.client.name}`,
      },
    }).catch(() => {});

    return NextResponse.json({ message: 'Pago eliminado', loanId: payment.loanId, amount: payment.amount });
  } catch (error) {
    console.error('Error deleting payment:', error);
    return NextResponse.json({ error: 'Error al eliminar pago' }, { status: 500 });
  }
}
