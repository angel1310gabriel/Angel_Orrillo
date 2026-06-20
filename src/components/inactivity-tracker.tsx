'use client';

import { useEffect, useRef } from 'react';
import { useAuth, INACTIVITY_TIMEOUT } from '@/hooks/use-auth';

export function InactivityTracker() {
  const { isAuthenticated, updateActivity, logout } = useAuth();
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    if (!isAuthenticated) {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
        intervalRef.current = null;
      }
      return;
    }

    const events = ['mousedown', 'keydown', 'touchstart', 'scroll', 'mousemove'];
    const handler = () => updateActivity();
    events.forEach((event) => window.addEventListener(event, handler, { passive: true }));

    intervalRef.current = setInterval(() => {
      const { lastActivity } = useAuth.getState();
      if (Date.now() - lastActivity > INACTIVITY_TIMEOUT) {
        logout();
      }
    }, 30000);

    return () => {
      events.forEach((event) => window.removeEventListener(event, handler));
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
      }
    };
  }, [isAuthenticated, updateActivity, logout]);

  return null;
}
