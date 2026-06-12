'use client';

import { useEffect, useRef } from 'react';
import { createClient, SupabaseClient } from '@supabase/supabase-js';

// ============================================================
// KC Cobranzas - Supabase Realtime Hook
//
// Listens for changes on key tables (via Supabase Realtime)
// and triggers a callback when data changes. This allows the
// web app to automatically refresh when the mobile app (Flutter)
// makes changes to the same Supabase database.
//
// Usage:
//   useSupabaseRealtime('loans', () => refetch());
//   useSupabaseRealtime(['loans', 'clients', 'payments'], () => refetch());
//
// The hook handles:
//   - Auto-detecting Supabase credentials from env vars
//   - Managing a single Supabase client instance
//   - Debouncing rapid changes (e.g., bulk sync)
//   - Proper cleanup on unmount
// ============================================================

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

// Singleton client instance (shared across all hook instances)
let realtimeClient: SupabaseClient | null = null;
let activeChannels: Set<string> = new Set();

function getRealtimeClient(): SupabaseClient | null {
  if (!supabaseUrl || !supabaseKey) return null;

  if (!realtimeClient) {
    realtimeClient = createClient(supabaseUrl, supabaseKey, {
      auth: { persistSession: false, autoRefreshToken: false },
      db: { schema: 'public' },
      realtime: {
        params: {
          eventsPerSecond: 10,
        },
      },
    });
  }

  return realtimeClient;
}

export function useSupabaseRealtime(
  tables: string | string[],
  onDataChange: () => void,
  options?: {
    /** Debounce delay in ms (default: 1000) - prevents rapid refetches during bulk operations */
    debounceMs?: number;
    /** Whether realtime is enabled (default: true) - can be toggled from config */
    enabled?: boolean;
  }
) {
  const callbackRef = useRef(onDataChange);
  useEffect(() => {
    callbackRef.current = onDataChange;
  }, [onDataChange]);

  const debounceMs = options?.debounceMs ?? 1000;
  const enabled = options?.enabled ?? true;

  // Convert single table to array
  const tableList = Array.isArray(tables) ? tables : [tables];
  const tableKey = tableList.join(',');

  useEffect(() => {
    if (!enabled) return;

    const client = getRealtimeClient();
    if (!client) return;

    // Debounce timer
    let debounceTimer: ReturnType<typeof setTimeout> | null = null;

    const handleChange = (table: string, eventType: string) => {
      console.log(`[Realtime] ${table} ${eventType}`);

      if (debounceTimer) {
        clearTimeout(debounceTimer);
      }

      debounceTimer = setTimeout(() => {
        callbackRef.current();
      }, debounceMs);
    };

    const channels: ReturnType<SupabaseClient['channel']>[] = [];

    for (const table of tableList) {
      // Skip if already subscribed to this table
      const channelName = `${table}-changes`;
      if (activeChannels.has(channelName)) continue;

      activeChannels.add(channelName);

      const channel = client
        .channel(channelName)
        .on(
          'postgres_changes',
          { event: '*', schema: 'public', table },
          (payload) => {
            handleChange(table, payload.eventType);
          }
        )
        .subscribe((status) => {
          if (status === 'SUBSCRIBED') {
            console.log(`[Realtime] Subscribed to ${table}`);
          } else if (status === 'CHANNEL_ERROR') {
            console.error(`[Realtime] Channel error for ${table}`);
            activeChannels.delete(channelName);
          }
        });

      channels.push(channel);
    }

    return () => {
      if (debounceTimer) {
        clearTimeout(debounceTimer);
      }

      for (const channel of channels) {
        const channelName = channel.topic;
        activeChannels.delete(channelName);
        client.removeChannel(channel);
      }
    };
    }, [tableKey, debounceMs, enabled]);
}

// ============================================================
// Utility: Check if Supabase Realtime is available
// ============================================================

export function isRealtimeAvailable(): boolean {
  return !!(supabaseUrl && supabaseKey);
}

// ============================================================
// Hook: Subscribe to multiple tables at once with a single callback
// Useful for dashboard pages that need to refresh when any data changes
// ============================================================

export function useSupabaseRealtimeAll(
  onDataChange: () => void,
  options?: {
    debounceMs?: number;
    enabled?: boolean;
  }
) {
  useSupabaseRealtime(
    ['zones', 'profiles', 'clients', 'loans', 'payments', 'capital_movements', 'settings', 'late_fees', 'payment_schedule'],
    onDataChange,
    options
  );
}
