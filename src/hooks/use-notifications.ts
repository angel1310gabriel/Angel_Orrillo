'use client';

import { useState, useEffect, useCallback } from 'react';

export interface Notification {
  id: string;
  userId: string;
  sentById: string | null;
  title: string;
  body: string;
  type: string;
  referenceType: string | null;
  referenceId: string | null;
  isRead: boolean;
  createdAt: string;
}

export function useNotifications(collectorId: string | undefined) {
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchNotifications = useCallback(async () => {
    if (!collectorId) {
      setNotifications([]);
      setUnreadCount(0);
      setLoading(false);
      return;
    }

    try {
      const res = await fetch(`/api/notifications?collectorId=${collectorId}`);
      if (!res.ok) throw new Error('Error al cargar notificaciones');
      const data = await res.json();
      setNotifications(data);
      setUnreadCount(data.filter((n: any) => !n.isRead).length);
    } catch (err) {
      console.error('Error fetching notifications:', err);
      setError('Error al cargar notificaciones');
    } finally {
      setLoading(false);
    }
  }, [collectorId]);

  useEffect(() => {
    fetchNotifications();
    const interval = setInterval(fetchNotifications, 30000); // Poll every 30s
    return () => clearInterval(interval);
  }, [fetchNotifications]);

  const markAsRead = async (ids: string[]) => {
    try {
      const res = await fetch('/api/notifications', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ids }),
      });
      if (res.ok) {
        setNotifications(prev => prev.map(n => ids.includes(n.id) ? { ...n, isRead: true } : n));
        setUnreadCount(prev => Math.max(0, prev - ids.filter(id => notifications.some(n => n.id === id && !n.isRead)).length));
      }
    } catch (err) {
      console.error('Error marking as read:', err);
    }
  };

  const markAllAsReadByRefAsRead = async (referenceType: string, referenceId: string) => {
    const ids = notifications
      .filter(n => n.referenceType === referenceType && n.referenceId === referenceId && !n.isRead)
      .map(n => n.id);
    if (ids.length > 0) await markAsRead(ids);
  };

  const deleteNotification = async (id: string) => {
    try {
      const res = await fetch(`/api/notifications?id=${id}`, { method: 'DELETE' });
      if (res.ok) {
        setNotifications(prev => prev.filter(n => n.id !== id));
        setUnreadCount(prev => Math.max(0, prev - 1));
      }
    } catch (err) {
      console.error('Error deleting notification:', err);
    }
  };

  return {
    notifications,
    unreadCount,
    loading,
    error,
    refetch: fetchNotifications,
    markAsRead,
    markByRefAsRead,
    deleteNotification,
  };
}

// Función para generar notificaciones automáticas (llamar desde server actions o cron)
export async function generateAutomaticNotifications(supabase: any) {
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

  // Insertar todas las notificaciones
  if (notifications.length > 0) {
    // Evitar duplicados: solo insertar si no existe una similar sin leer en las últimas 24h
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

export type { Notification };
<tool_call>
<function=read>
<parameter=filePath>
C:\Users\Keysy\Desktop\kc-cobranzas\src\hooks\use-notifications.ts