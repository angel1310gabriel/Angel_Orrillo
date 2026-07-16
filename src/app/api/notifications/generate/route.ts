import { NextRequest, NextResponse } from 'next/server';
import { findMany, createDoc, findFirst, collections } from '@/lib/firestore-db';

async function generateAutomaticNotifications() {
  const now = new Date();
  const notifications: any[] = [];

  // 1. Préstamos vencidos (estado 'active' y end_date < hoy)
  const todayStr = now.toISOString().split('T')[0];
  const overdueLoans = await findMany(collections.loans, { status: 'active' });
  const overdueFiltered = overdueLoans.filter(
    (l: any) => l.endDate && l.endDate < todayStr
  );

  for (const loan of overdueFiltered) {
    if (loan.collectorId) {
      notifications.push({
        userId: loan.collectorId,
        title: 'Préstamo vencido',
        body: `El préstamo #${loan.id.slice(0,8)} de ${loan.amountPaid}/${loan.totalAmount} está vencido desde ${new Date(loan.endDate).toLocaleDateString('es-PE')}`,
        type: 'overdue',
        referenceType: 'loan',
        referenceId: loan.id,
        isRead: false,
      });
    }
  }

  // 2. Próximos a vencer (1-2 días)
  const soon = new Date(now);
  soon.setDate(soon.getDate() + 2);
  const soonStr = soon.toISOString().split('T')[0];
  const upcomingLoans = await findMany(collections.loans, { status: 'active' });
  const upcomingFiltered = upcomingLoans.filter(
    (l: any) => l.endDate && l.endDate >= todayStr && l.endDate <= soonStr
  );

  for (const loan of upcomingFiltered) {
    if (loan.collectorId) {
      const daysLeft = Math.ceil((new Date(loan.endDate).getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
      notifications.push({
        userId: loan.collectorId,
        title: `Pago próximo a vencer (${daysLeft} día${daysLeft !== 1 ? 's' : ''})`,
        body: `El préstamo #${loan.id.slice(0,8)} vence el ${new Date(loan.endDate).toLocaleDateString('es-PE')}. Monto pendiente: ${(loan.totalAmount - loan.amountPaid).toLocaleString('es-PE', {minimumFractionDigits: 2})}`,
        type: 'upcoming',
        referenceType: 'loan',
        referenceId: loan.id,
        isRead: false,
      });
    }
  }

  // 3. Pagos recientes (últimas 24h) - éxito
  const dayAgo = new Date(now.getTime() - 24 * 60 * 60 * 1000);
  const dayAgoStr = dayAgo.toISOString();
  const allPayments = await findMany(collections.payments, { status: 'completed' });
  const recentPayments = allPayments.filter(
    (p: any) => p.createdAt && new Date(p.createdAt) >= dayAgo
  );

  for (const payment of recentPayments) {
    if (payment.collectorId) {
      notifications.push({
        userId: payment.collectorId,
        title: 'Pago recibido',
        body: `Recibiste S/${Number(payment.amount).toLocaleString('es-PE', {minimumFractionDigits: 2})} del préstamo #${payment.loanId?.slice(0,8)}`,
        type: 'payment_received',
        referenceType: 'payment',
        referenceId: payment.id,
        isRead: false,
      });
    }
  }

  // 4. Cobradores inactivos (sin pagos en 7 días)
  const weekAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
  const activeCollectors = await findMany(collections.profiles, { role: 'collector', isActive: true });

  for (const collector of activeCollectors) {
    const recent = await findMany(collections.payments, { collectorId: collector.id });
    const hasRecent = recent.some((p: any) => p.createdAt && new Date(p.createdAt) >= weekAgo);

    if (!hasRecent) {
      notifications.push({
        userId: collector.id,
        title: 'Sin actividad reciente',
        body: 'No has registrado pagos en los últimos 7 días. ¡Anímate a cobrar hoy!',
        type: 'inactive',
        referenceType: 'collector',
        referenceId: collector.id,
        isRead: false,
      });
    }
  }

  // 5. Meta diaria alcanzada
  const collectorsWithGoals = activeCollectors.filter((c: any) => c.dailyGoal != null);

  for (const collector of collectorsWithGoals) {
    const todayPayments = await findMany(collections.payments, { collectorId: collector.id, status: 'completed' });
    const todayFiltered = todayPayments.filter(
      (p: any) => p.paymentDate && p.paymentDate >= todayStr
    );
    const totalToday = todayFiltered.reduce((sum: number, p: any) => sum + Number(p.amount), 0);
    const goal = Number(collector.dailyGoal);

    if (totalToday >= goal) {
      notifications.push({
        userId: collector.id,
        title: '¡Meta diaria alcanzada!',
        body: `¡Felicidades! Cobraste S/${totalToday.toLocaleString('es-PE')} hoy (meta: S/${goal.toLocaleString('es-PE')})`,
        type: 'goal_achieved',
        referenceType: 'collector',
        referenceId: collector.id,
        isRead: false,
      });
    }
  }

  // Insertar todas las notificaciones (evitando duplicados)
  if (notifications.length > 0) {
    for (const notif of notifications) {
      const existing = await findMany(collections.notifications, {
        userId: notif.userId,
        type: notif.type,
        referenceType: notif.referenceType,
        referenceId: notif.referenceId,
        isRead: false,
      });
      const hasRecent = existing.some(
        (n: any) => n.createdAt && (new Date(now.getTime() - 24 * 60 * 60 * 1000).getTime() - new Date(n.createdAt).getTime()) < 24 * 60 * 60 * 1000
      );

      if (!hasRecent) {
        await createDoc(collections.notifications, notif);
      }
    }
  }

  return notifications.length;
}

// POST /api/notifications/generate - Generar notificaciones automáticas
export async function POST(request: NextRequest) {
  try {
    const count = await generateAutomaticNotifications();
    return NextResponse.json({ success: true, generated: count });
  } catch (error) {
    console.error('Error generating notifications:', error);
    return NextResponse.json({ error: 'Error al generar notificaciones' }, { status: 500 });
  }
}
