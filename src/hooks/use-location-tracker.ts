'use client';

import { useState, useEffect, useRef, useCallback } from 'react';

interface Position {
  latitude: number;
  longitude: number;
  accuracy: number | null;
  speed: number | null;
}

interface UseLocationTrackerOptions {
  collectorId?: string;
  enabled?: boolean;
  intervalMs?: number;
}

export function useLocationTracker({ collectorId, enabled = false, intervalMs = 30000 }: UseLocationTrackerOptions) {
  const [isTracking, setIsTracking] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [currentPosition, setCurrentPosition] = useState<Position | null>(null);
  const watchIdRef = useRef<number | null>(null);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const lastSentRef = useRef<Position | null>(null);

  const sendPosition = useCallback(async (pos: Position) => {
    if (!collectorId) return;
    try {
      await fetch('/api/locations', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          collectorId,
          latitude: pos.latitude,
          longitude: pos.longitude,
          accuracy: pos.accuracy,
          speed: pos.speed,
        }),
      });
    } catch {
      // Silent - don't disrupt tracking for network errors
    }
  }, [collectorId]);

  const startTracking = useCallback(() => {
    if (!navigator.geolocation) {
      setError('Geolocalización no soportada por el navegador');
      return;
    }

    setError(null);

    watchIdRef.current = navigator.geolocation.watchPosition(
      (position) => {
        const pos: Position = {
          latitude: position.coords.latitude,
          longitude: position.coords.longitude,
          accuracy: position.coords.accuracy ?? null,
          speed: position.coords.speed ?? null,
        };
        setCurrentPosition(pos);
        lastSentRef.current = pos;
      },
      (err) => {
        setError(`Error de geolocalización: ${err.message}`);
      },
      {
        enableHighAccuracy: true,
        timeout: 10000,
        maximumAge: 5000,
      }
    );

    // Send position periodically
    intervalRef.current = setInterval(() => {
      if (lastSentRef.current) {
        sendPosition(lastSentRef.current);
      }
    }, intervalMs);

    setIsTracking(true);
  }, [sendPosition, intervalMs]);

  const stopTracking = useCallback(() => {
    if (watchIdRef.current !== null) {
      navigator.geolocation.clearWatch(watchIdRef.current);
      watchIdRef.current = null;
    }
    if (intervalRef.current !== null) {
      clearInterval(intervalRef.current);
      intervalRef.current = null;
    }
    setIsTracking(false);
  }, []);

  // Auto-start/stop based on enabled prop
  useEffect(() => {
    if (enabled && collectorId) {
      startTracking();
    }
    return () => {
      stopTracking();
    };
  }, [enabled, collectorId, startTracking, stopTracking]);

  return {
    isTracking,
    error,
    currentPosition,
    startTracking,
    stopTracking,
  };
}
