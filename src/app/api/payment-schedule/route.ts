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

// GET /api/payment-schedule - List payment schedule entries
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const loanId = searchParams.get('loanId');
    const status = searchParams.get('status');

    // On Vercel: use Supabase
    if (isVercel) {
      const supabase = await getSupabase();
      if (!supabase) {
        return NextResponse.json({ error: 'Base de datos no disponible' }, { status: 503 });
      }

      let query = supabase.from('payment_schedule').select('*').order('installment_number', { ascending: true });

      if (loanId) {
        query = query.eq('loan_id', loanId);
      }

      if (status) {
        query = query.eq('status', status);
      }

      const { data, error } = await query;

      if (error) {
        console.error('[PaymentSchedule] Supabase query error:', error.message);
        return NextResponse.json({ error: 'Error al obtener calendario de pagos' }, { status: 500 });
      }

      const mapped = (data || []).map((item: Record<string, unknown>) => ({
        id: item.id,
        loanId: item.loan_id,
        installmentNumber: item.installment_number,
        amount: item.amount,
        dueDate: item.due_date,
        status: item.status,
        createdAt: item.created_at,
      }));

      return NextResponse.json(mapped);
    }

    // Local: Prisma
    const where: Record<string, unknown> = {};
    if (loanId) where.loanId = loanId;
    if (status) where.status = status;

    const schedules = await db.paymentSchedule.findMany({
      where,
      orderBy: { installmentNumber: 'asc' },
    });

    return NextResponse.json(schedules);
  } catch (error) {
    console.error('Error fetching payment schedules:', error);
    return NextResponse.json({ error: 'Error al obtener calendario de pagos' }, { status: 500 });
  }
}

// POST /api/payment-schedule - Generate schedule for a loan
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { loanId, totalAmount, numInstallments, startDate, frequency } = body;

    if (!loanId || !totalAmount || !numInstallments || !startDate) {
      return NextResponse.json({ error: 'Faltan campos requeridos: loanId, totalAmount, numInstallments, startDate' }, { status: 400 });
    }

    const installmentAmount = totalAmount / numInstallments;
    const start = new Date(startDate);
    const entries: Record<string, unknown>[] = [];

    for (let i = 0; i < numInstallments; i++) {
      const dueDate = new Date(start);

      if (frequency === 'monthly') {
        dueDate.setMonth(dueDate.getMonth() + i);
      } else if (frequency === 'biweekly') {
        dueDate.setDate(dueDate.getDate() + 15 * i);
      } else if (frequency === 'weekly') {
        dueDate.setDate(dueDate.getDate() + 7 * i);
      } else {
        // Default: monthly
        dueDate.setMonth(dueDate.getMonth() + i);
      }

      entries.push({
        loan_id: loanId,
        installment_number: i + 1,
        amount: installmentAmount,
        due_date: dueDate.toISOString(),
        status: 'pending',
      });
    }

    // On Vercel: use Supabase
    if (isVercel) {
      const supabase = await getSupabase();
      if (!supabase) {
        return NextResponse.json({ error: 'Base de datos no disponible' }, { status: 503 });
      }

      const { data, error } = await supabase.from('payment_schedule').insert(entries).select();

      if (error) {
        console.error('[PaymentSchedule] Supabase insert error:', error.message);
        return NextResponse.json({ error: 'Error al generar calendario de pagos' }, { status: 500 });
      }

      const mapped = (data || []).map((item: Record<string, unknown>) => ({
        id: item.id,
        loanId: item.loan_id,
        installmentNumber: item.installment_number,
        amount: item.amount,
        dueDate: item.due_date,
        status: item.status,
        createdAt: item.created_at,
      }));

      return NextResponse.json(mapped, { status: 201 });
    }

    // Local: Prisma
    const created = await Promise.all(
      entries.map((entry) =>
        db.paymentSchedule.create({
          data: {
            loanId: entry.loan_id as string,
            installmentNumber: entry.installment_number as number,
            amount: entry.amount as number,
            dueDate: new Date(entry.due_date as string),
            status: entry.status as string,
          },
        })
      )
    );

    return NextResponse.json(created, { status: 201 });
  } catch (error) {
    console.error('Error generating payment schedule:', error);
    return NextResponse.json({ error: 'Error al generar calendario de pagos' }, { status: 500 });
  }
}

// PATCH /api/payment-schedule?id=xxx - Update a schedule entry status
export async function PATCH(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const id = searchParams.get('id');

    if (!id) {
      return NextResponse.json({ error: 'Se requiere el parámetro id' }, { status: 400 });
    }

    const body = await request.json();
    const { status } = body;

    if (!status) {
      return NextResponse.json({ error: 'Se requiere el campo status' }, { status: 400 });
    }

    // On Vercel: use Supabase
    if (isVercel) {
      const supabase = await getSupabase();
      if (!supabase) {
        return NextResponse.json({ error: 'Base de datos no disponible' }, { status: 503 });
      }

      const { error } = await supabase.from('payment_schedule').update({ status }).eq('id', id);

      if (error) {
        console.error('[PaymentSchedule] Supabase update error:', error.message);
        return NextResponse.json({ error: 'Error al actualizar calendario de pagos' }, { status: 500 });
      }

      return NextResponse.json({ success: true });
    }

    // Local: Prisma
    await db.paymentSchedule.update({
      where: { id },
      data: { status },
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Error updating payment schedule:', error);
    return NextResponse.json({ error: 'Error al actualizar calendario de pagos' }, { status: 500 });
  }
}
