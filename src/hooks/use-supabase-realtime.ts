'use client';

import { useEffect, useRef } from 'react';
import { db } from '@/lib/firebase-client';
import { collection, query, onSnapshot, doc } from 'firebase/firestore';

type TableName = string;
type Callback = () => void;

interface Options {
  debounceMs?: number;
  enabled?: boolean;
}

// Maps our table names to Firestore collection names
const TABLE_TO_COLLECTION: Record<string, string> = {
  zones: 'zones',
  profiles: 'profiles',
  clients: 'clients',
  loans: 'loans',
  payments: 'payments',
  capital_movements: 'capital_movements',
  settings: 'settings',
  late_fees: 'late_fees',
  daily_settlements: 'daily_settlements',
  caja_movements: 'caja_movements',
};

export function useSupabaseRealtime(
  tables: TableName | TableName[],
  callback: Callback,
  options: Options = {}
) {
  const { debounceMs = 1500, enabled = true } = options;
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const callbackRef = useRef(callback);
  callbackRef.current = callback;

  useEffect(() => {
    if (!enabled) return;

    const tableArr = Array.isArray(tables) ? tables : [tables];
    const unsubscribers: (() => void)[] = [];

    for (const table of tableArr) {
      const collectionName = TABLE_TO_COLLECTION[table];
      if (!collectionName) continue;

      const q = query(collection(db, collectionName));
      const unsub = onSnapshot(q, () => {
        if (timerRef.current) clearTimeout(timerRef.current);
        timerRef.current = setTimeout(() => {
          callbackRef.current();
        }, debounceMs);
      });
      unsubscribers.push(unsub);
    }

    return () => {
      unsubscribers.forEach((unsub) => unsub());
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  }, [tables, enabled, debounceMs]);
}
