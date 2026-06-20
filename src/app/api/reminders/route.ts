import { NextRequest, NextResponse } from 'next/server';
import { db, isVercel } from '@/lib/db';

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const collectorId = searchParams.get('collectorId');

    try {
      const { isSupabaseConfigured } = await import('@/lib/supabase-server');
      if (isSupabaseConfigured()) {
        try {
          const data = await Promise.race([
            getRemindersFromSupabase(collectorId || null),
            new Promise<null>((_, reject) => setTimeout(() => reject(new Error('Supabase timeout')), 5000)),
          ]);
          if (data) {
            return NextResponse.json(data);
          }
        } catch (error) {
          console.error('Supabase getReminders failed, falling back to Prisma:', error);
        }
      }
    } catch (error) {
      console.error('Supabase not available, using Prisma fallback:', error);
    }

    if (isVercel) {
      return NextResponse.json({ error: 'Base de datos no disponible' }, { status: 503 });
    }

    const data = await getRemindersFromPrisma(collectorId || null);
    return NextResponse.json(data);
  } catch (error) {
    console.error('Error fetching reminders:', error);
    return NextResponse.json({ error: 'Error al obtener recordatorios' }, { status: 500 });
  }
}

async function getRemindersFromSupabase(collectorId: string | null) {
  const envUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  const envKey = serviceKey || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!envUrl || !envKey) return null;

  const { createClient } = await import('@supabase/supabase-js');
  const supabase = createClient(envUrl, envKey);

  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const twoDaysLater = new Date(today.getTime() + 2 * 86400000);

  let query = supabase
    .from('payment_schedule')
    .select(`
      id, loan_id, installment_number, amount, due_date, status,
      loans!loan_id (
        id, amount, collector_id,
        clients!client_id (id, name, phone)
      )
    `)
    .eq('status', 'pending')
    .gte('due_date', today.toISOString().split('T')[0])
    .lte('due_date', twoDaysLater.toISOString().split('T')[0]);

  if (collectorId) {
    query = query.eq('loans.collector_id', collectorId);
  }

  const { data, error } = await query;
  if (error) throw error;

  const reminders = (data || []).map((s: Record<string, unknown>) => {
    const loan = s.loans as unknown as Record<string, unknown>;
    const client = loan?.clients as unknown as Record<string, unknown> || {};
    return {
      id: s.id,
      clientName: client.name || 'Desconocido',
      clientPhone: client.phone || '',
      loanId: s.loan_id,
      installmentNumber: s.installment_number,
      amount: Number(s.amount) || 0,
      dueDate: s.due_date,
    };
  });

  return reminders;
}

async function getRemindersFromPrisma(collectorId: string | null) {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const twoDaysLater = new Date(today.getTime() + 2 * 86400000);

  const where: Record<string, unknown> = {
    status: 'pending',
    dueDate: { gte: today, lte: twoDaysLater },
  };

  if (collectorId) {
    where.loan = { collectorId };
  }

  const scheduleEntries = await db.paymentSchedule.findMany({
    where,
    include: {
      loan: {
        include: {
          client: { select: { id: true, name: true, phone: true } },
        },
      },
    },
    orderBy: { dueDate: 'asc' },
  });

  return scheduleEntries.map((s) => ({
    id: s.id,
    clientName: s.loan.client.name,
    clientPhone: s.loan.client.phone,
    loanId: s.loanId,
    installmentNumber: s.installmentNumber,
    amount: s.amount,
    dueDate: s.dueDate.toISOString().split('T')[0],
  }));
}
