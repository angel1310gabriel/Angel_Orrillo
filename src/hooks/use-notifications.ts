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
    markAllAsReadByRefAsRead,
    deleteNotification,
  };
}

export type { Notification };