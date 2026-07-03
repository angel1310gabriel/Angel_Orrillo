import { NextRequest, NextResponse } from 'next/server';
import { isVercel } from '@/lib/db';

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

async function generateAutomaticNotifications(supabase: any) {
  const now = new Date();
  const notifications: any[] = [];

  // 1. Préstamos vencidos (estado 'active' y end_date < hoy)
  const { data: overdueLoans } = await supabase
    .from('loans')
    .select('id, client_id, collector_id, end_date, amount_paid, total_amount')
    .eq('status', 'active')
    .lt('end_date', now.toISOString().split('T')[0]);

  if (overdueLoans?.length) {
    for (const loan of overdueLoans) {
      if (loan.collector_id) {
        notifications.push({
          user_id: loan.collector_id,
          title: '🔴 Préstamo vencido',
          body: `El préstamo #${loan.id.slice(0,8)} de ${loan.amount_paid}/${loan.total_amount} está vencido desde ${new Date(loan.end_date).toLocaleDateString('es-PE')}`,
          type: 'overdue',
          reference_type: 'loan',
          reference_id: loan.id,
          is_read: false,
        });
      }
    }
  }

  // 2. Próximos a vencer (1-2 días)
  const soon = new Date(now);
  soon.setDate(soon.getDate() + 2);
  const { data: upcomingLoans } = await supabase
    .from('loans')
    .select('id, client_id, collector_id, end_date, amount_paid, total_amount')
    .eq('status', 'active')
    .gte('end_date', now.toISOString().split('T')[0])
    .lte('end_date', soon.toISOString().split('T')[0]);

  if (upcomingLoans?.length) {
    for (const loan of upcomingLoans) {
      if (loan.collector_id) {
        const daysLeft = Math.ceil((new Date(loan.end_date).getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
        notifications.push({
          user_id: loan.collector_id,
          title: `🟡 Pago próximo a vencer (${daysLeft} día${daysLeft !== 1 ? 's' : ''})`,
          body: `El préstamo #${loan.id.slice(0,8)} vence el ${new Date(loan.end_date).toLocaleDateString('es-PE')}. Monto pendiente: ${(loan.total_amount - loan.amount_paid).toLocaleString('es-PE', {minimumFractionDigits: 2})}`,
          type: 'upcoming',
          reference_type: 'loan',
          reference_id: loan.id,
          is_read: false,
        });
      }
    }
  }

  // 3. Pagos recientes (últimas 24h) - éxito
  const dayAgo = new Date(now.getTime() - 24 * 60 * 60 * 1000);
  const { data: recentPayments } = await supabase
    .from('payments')
    .select('id, loan_id, amount, collector_id, created_at')
    .gte('created_at', dayAgo.toISOString())
    .eq('status', 'completed');

  if (recentPayments?.length) {
    for (const payment of recentPayments) {
      if (payment.collector_id) {
        notifications.push({
          user_id: payment.collector_id,
          title: '🟢 Pago recibido',
          body: `Recibiste S/${payment.amount.toLocaleString('es-PE', {minimumFractionDigits: 2})} del préstamo #${payment.loan_id?.slice(0,8)}`,
          type: 'payment_received',
          reference_type: 'payment',
          reference_id: payment.id,
          is_read: false,
        });
      }
    }
  }

  // 4. Cobradores inactivos (sin pagos en 7 días)
  const weekAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
  const { data: activeCollectors } = await supabase
    .from('profiles')
    .select('id, name')
    .eq('role', 'collector')
    .eq('is_active', true);

  if (activeCollectors?.length) {
    for (const collector of activeCollectors) {
      const { data: recentPayments } = await supabase
        .from('payments')
        .select('id')
        .eq('collector_id', collector.id)
        .gte('created_at', weekAgo.toISOString())
        .limit(1);

      if (!recentPayments?.length) {
        notifications.push({
          user_id: collector.id,
          title: '🟠 Sin actividad reciente',
          body: `No has registrado pagos en los últimos 7 días. ¡Anímate a cobrar hoy!`,
          type: 'inactive',
          reference_type: 'collector',
          reference_id: collector.id,
          is_read: false,
        });
      }
    }
  }

  // 5. Meta diaria alcanzada
  const today = now.toISOString().split('T')[0];
  const { data: collectorsWithGoals } = await supabase
    .from('profiles')
    .select('id, name, daily_goal')
    .eq('role', 'collector')
    .eq('is_active', true)
    .not('daily_goal', 'is', null);

  if (collectorsWithGoals?.length) {
    for (const collector of collectorsWithGoals) {
      const { data: todayPayments } = await supabase
        .from('payments')
        .select('amount')
        .eq('collector_id', collector.id)
        .eq('payment_date', today)
        .eq('status', 'completed');

      const totalToday = todayPayments?.reduce((sum, p) => sum + Number(p.amount), 0) || 0;
      const goal = Number(collector.daily_goal);

      if (totalToday >= goal) {
        notifications.push({
          user_id: collector.id,
          title: '🎯 ¡Meta diaria alcanzada!',
          body: `¡Felicidades! Cobraste S/${totalToday.toLocaleString('es-PE')} hoy (meta: S/${goal.toLocaleString('es-PE')})`,
          type: 'goal_achieved',
          reference_type: 'collector',
          reference_id: collector.id,
          is_read: false,
        });
      }
    }
  }

  // Insertar todas las notificaciones (evitando duplicados)
  if (notifications.length > 0) {
    for (const notif of notifications) {
      const { data: existing } = await supabase
        .from('notifications')
        .select('id')
        .eq('user_id', notif.user_id)
        .eq('type', notif.type)
        .eq('reference_type', notif.reference_type)
        .eq('reference_id', notif.reference_id)
        .eq('is_read', false)
        .gte('created_at', new Date(now.getTime() - 24 * 60 * 60 * 1000).toISOString())
        .limit(1);

      if (!existing?.length) {
        await supabase.from('notifications').insert(notif);
      }
    }
  }

  return notifications.length;
}

// POST /api/notifications/generate - Generar notificaciones automáticas
export async function POST(request: NextRequest) {
  try {
    const { isSupabaseConfigured } = await import('@/lib/supabase-server');
    if (!isSupabaseConfigured()) {
      return NextResponse.json({ error: 'Base de datos no disponible' }, { status: 503 });
    }

    const supabase = await getSupabase();
    if (!supabase) {
      return NextResponse.json({ error: 'Base de datos no disponible' }, { status: 503 });
    }

    const count = await generateAutomaticNotifications(supabase);

    return NextResponse.json({ success: true, generated: count });
  } catch (error) {
    console.error('Error generating notifications:', error);
    return NextResponse.json({ error: 'Error al generar notificaciones' }, { status: 500 });
  }
}