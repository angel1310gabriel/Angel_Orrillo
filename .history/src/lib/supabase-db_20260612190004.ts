import { getSupabaseClient } from './supabase';
import { db } from './db';

// ============================================================
// Database Bridge - Supabase + Prisma Fallback
// When Supabase is configured, uses Supabase (same DB as Flutter app)
// Otherwise falls back to local Prisma/SQLite
// ============================================================

export function isSupabaseConfigured(): boolean {
  return !!getSupabaseClient();
}

export function getClient() {
  return getSupabaseClient();
}

// ============================================================
// Field Mapping: Prisma Schema ↔ Supabase Schema
// The Flutter app may use different column names than our Prisma schema
// ============================================================

export const FIELD_MAP: Record<string, Record<string, string>> = {
  // profiles table: Prisma field → Supabase column
  // Supabase profiles table uses 'dni' column (not document_number)
  profiles: {
    id: 'id',
    email: 'email',
    name: 'name',
    phone: 'phone',
    role: 'role',
    photoUrl: 'photo_url',
    isActive: 'is_active',
    biometricEnabled: 'biometric_enabled',
    dailyGoal: 'daily_goal',
    createdAt: 'created_at',
    // Supabase profiles table uses 'dni' column
    documentNumber: 'dni',
    documentType: 'document_type',
    address: 'address',
    password: 'password',
    updatedAt: 'updated_at',
  },
  // clients table
  // Supabase clients table uses `dni` instead of `document_number`
  clients: {
    id: 'id',
    name: 'name',
    documentNumber: 'dni',
    phone: 'phone',
    address: 'address',
    zoneId: 'zone_id',
    photoUrl: 'photo_url',
    documentType: 'document_type',
    creditScore: 'credit_score',
    latitude: 'latitude',
    longitude: 'longitude',
    createdBy: 'created_by',
    createdAt: 'created_at',
    updatedAt: 'updated_at',
  },
  // loans table
  loans: {
    id: 'id',
    clientId: 'client_id',
    collectorId: 'collector_id',
    zoneId: 'zone_id',
    amount: 'amount',
    totalAmount: 'total_amount',
    interest: 'interest',
    days: 'days',
    dailyPayment: 'daily_payment',
    paymentFrequency: 'payment_frequency',
    numCuotas: 'num_cuotas',
    amountPaid: 'amount_paid',
    startDate: 'start_date',
    endDate: 'end_date',
    status: 'status',
    creditApproved: 'credit_approved',
    signature: 'signature',
    notes: 'notes',
    chargedOff: 'charged_off',
    chargedOffAt: 'charged_off_at',
    chargedOffBy: 'charged_off_by',
    recoveryCollectorId: 'recovery_collector_id',
    createdBy: 'created_by',
    createdAt: 'created_at',
    updatedAt: 'updated_at',
  },
  // payments table
  payments: {
    id: 'id',
    loanId: 'loan_id',
    collectorId: 'collector_id',
    clientId: 'client_id',
    amount: 'amount',
    interest: 'interest',
    paymentMethod: 'payment_method',
    status: 'status',
    observation: 'observation',
    proofPhoto: 'proof_photo',
    photoUrl: 'photo_url',
    gpsLatitude: 'gps_latitude',
    gpsLongitude: 'gps_longitude',
    paymentDate: 'payment_date',
    createdAt: 'created_at',
  },
  // capital_movements table
  capital_movements: {
    id: 'id',
    type: 'type',
    amount: 'amount',
    previousCapital: 'previous_capital',
    newCapital: 'new_capital',
    description: 'description',
    createdAt: 'created_at',
  },
  // zones table
  zones: {
    id: 'id',
    name: 'name',
    createdAt: 'created_at',
    updatedAt: 'updated_at',
  },
  // settings table
  settings: {
    id: 'id',
    key: 'key',
    value: 'value',
  },
  // guarantors table
  guarantors: {
    id: 'id',
    clientId: 'client_id',
    name: 'name',
    documentNumber: 'document_number',
    phone: 'phone',
    address: 'address',
    photoUrl: 'photo_url',
    createdAt: 'created_at',
  },
  // late_fees table
  late_fees: {
    id: 'id',
    loanId: 'loan_id',
    daysLate: 'days_late',
    amount: 'amount',
    ratePerDay: 'rate_per_day',
    status: 'status',
    waivedBy: 'waived_by',
    waivedReason: 'waived_reason',
    waivedAt: 'waived_at',
    paidAt: 'paid_at',
    generatedAt: 'generated_at',
  },
  // payment_schedule table
  payment_schedule: {
    id: 'id',
    loanId: 'loan_id',
    installmentNumber: 'installment_number',
    amount: 'amount',
    dueDate: 'due_date',
    status: 'status',
    createdAt: 'created_at',
  },
  // audit_logs table
  audit_logs: {
    id: 'id',
    userId: 'user_id',
    action: 'action',
    entityType: 'entity_type',
    entityId: 'entity_id',
    entityName: 'entity_name',
    changes: 'changes',
    ipAddress: 'ip_address',
    userAgent: 'user_agent',
    severity: 'severity',
    notes: 'notes',
    createdAt: 'created_at',
  },
  // collector_expenses table
  collector_expenses: {
    id: 'id',
    collectorId: 'collector_id',
    amount: 'amount',
    category: 'category',
    description: 'description',
    expenseDate: 'expense_date',
    receiptPhoto: 'receipt_photo',
    status: 'status',
    approvedBy: 'approved_by',
    createdAt: 'created_at',
  },
  // daily_settlements table
  daily_settlements: {
    id: 'id',
    collectorId: 'collector_id',
    date: 'date',
    expectedCount: 'expected_count',
    expectedAmount: 'expected_amount',
    collectedCount: 'collected_count',
    collectedAmount: 'collected_amount',
    difference: 'difference',
    notes: 'notes',
    status: 'status',
    createdAt: 'created_at',
  },
  // collector_locations table
  collector_locations: {
    id: 'id',
    collectorId: 'collector_id',
    latitude: 'latitude',
    longitude: 'longitude',
    accuracy: 'accuracy',
    createdAt: 'created_at',
  },
  // notifications table
  notifications: {
    id: 'id',
    userId: 'user_id',
    sentById: 'sent_by_id',
    title: 'title',
    body: 'body',
    type: 'type',
    referenceType: 'reference_type',
    referenceId: 'reference_id',
    isRead: 'is_read',
    createdAt: 'created_at',
  },
  // client_notes table
  client_notes: {
    id: 'id',
    clientId: 'client_id',
    createdBy: 'created_by',
    note: 'note',
    isImportant: 'is_important',
    createdAt: 'created_at',
  },
};

// Helper: Convert Prisma-style camelCase fields to snake_case for Supabase
export function toSnakeCase<T extends Record<string, unknown>>(obj: T, tableName: string): Record<string, unknown> {
  const map = FIELD_MAP[tableName];
  if (!map) return obj as Record<string, unknown>;

  const result: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(obj)) {
    const snakeKey = map[key] || key;
    result[snakeKey] = value;
  }
  return result;
}

// Helper: Convert Supabase snake_case fields to camelCase for frontend
export function toCamelCase<T extends Record<string, unknown>>(obj: T, tableName: string): Record<string, unknown> {
  const map = FIELD_MAP[tableName];
  if (!map) return obj as Record<string, unknown>;

  const reverseMap: Record<string, string> = {};
  for (const [camel, snake] of Object.entries(map)) {
    reverseMap[snake] = camel;
  }

  const result: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(obj)) {
    const camelKey = reverseMap[key] || key;
    result[camelKey] = value;
  }
  return result;
}

// ============================================================
// Unified Database Access Functions
// ============================================================

/**
 * Generic fetch from a table, using Supabase if configured, otherwise Prisma
 */
export async function fetchFromTable(
  tableName: string,
  options?: {
    select?: string;
    filter?: Record<string, unknown>;
    orderBy?: string;
    orderAsc?: boolean;
    limit?: number;
    offset?: number;
    joinTables?: string[];
  }
): Promise<{ data: unknown[]; count: number }> {
  const supabase = getSupabaseClient();

  if (supabase) {
    let query = supabase
      .from(tableName)
      .select(options?.select || '*', { count: 'exact' });

    if (options?.filter) {
      for (const [key, value] of Object.entries(options.filter)) {
        if (value !== undefined && value !== null) {
          if (typeof value === 'object' && value !== null) {
            for (const [op, val] of Object.entries(value as Record<string, unknown>)) {
              switch (op) {
                case 'gte': query = query.gte(key, val as string | number); break;
                case 'lte': query = query.lte(key, val as string | number); break;
                case 'gt': query = query.gt(key, val as string | number); break;
                case 'lt': query = query.lt(key, val as string | number); break;
                case 'in': query = query.in(key, val as unknown[]); break;
                case 'notIn': query = query.not(key, 'in', `(${(val as unknown[]).join(',')})`); break;
                case 'contains': query = query.ilike(key, `%${val}%`); break;
                case 'neq': query = query.neq(key, val as string | number | boolean); break;
              }
            }
          } else {
            query = query.eq(key, value as string | number | boolean);
          }
        }
      }
    }

    if (options?.orderBy) {
      query = query.order(options.orderBy, { ascending: options.orderAsc ?? false });
    }

    if (options?.limit) {
      query = query.limit(options.limit);
    }
    if (options?.offset) {
      query = query.range(options.offset, options.offset + (options.limit || 50) - 1);
    }

    const { data, count, error } = await query;

    if (error) {
      console.error(`Supabase fetch error (${tableName}):`, error);
      throw new Error(error.message);
    }

    return { data: (data || []) as unknown[], count: count || 0 };
  }

  return { data: [], count: 0 };
}

/**
 * Generic insert into a table
 */
export async function insertIntoTable(
  tableName: string,
  record: Record<string, unknown>
): Promise<unknown> {
  const supabase = getSupabaseClient();

  if (supabase) {
    const snakeRecord = toSnakeCase(record, tableName);
    const { data, error } = await supabase
      .from(tableName)
      .insert(snakeRecord)
      .select()
      .single();

    if (error) {
      console.error(`Supabase insert error (${tableName}):`, error);
      throw new Error(error.message);
    }

    return toCamelCase(data as Record<string, unknown>, tableName);
  }

  throw new Error('No database configured');
}

/**
 * Generic update a record in a table
 */
export async function updateInTable(
  tableName: string,
  filter: Record<string, unknown>,
  updates: Record<string, unknown>
): Promise<unknown> {
  const supabase = getSupabaseClient();

  if (supabase) {
    const snakeUpdates = toSnakeCase(updates, tableName);
    let query = supabase.from(tableName).update(snakeUpdates);

    for (const [key, value] of Object.entries(filter)) {
      query = query.eq(key, value as string | number);
    }

    const { data, error } = await query.select().single();

    if (error) {
      console.error(`Supabase update error (${tableName}):`, error);
      throw new Error(error.message);
    }

    return toCamelCase(data as Record<string, unknown>, tableName);
  }

  throw new Error('No database configured');
}

/**
 * Generic delete from a table
 */
export async function deleteFromTable(
  tableName: string,
  filter: Record<string, unknown>
): Promise<void> {
  const supabase = getSupabaseClient();

  if (supabase) {
    let query = supabase.from(tableName).delete();

    for (const [key, value] of Object.entries(filter)) {
      query = query.eq(key, value as string | number);
    }

    const { error } = await query;

    if (error) {
      console.error(`Supabase delete error (${tableName}):`, error);
      throw new Error(error.message);
    }

    return;
  }

  throw new Error('No database configured');
}

/**
 * Count records in a table
 */
export async function countTable(
  tableName: string,
  filter?: Record<string, unknown>
): Promise<number> {
  const supabase = getSupabaseClient();

  if (supabase) {
    let query = supabase.from(tableName).select('*', { count: 'exact', head: true });

    if (filter) {
      for (const [key, value] of Object.entries(filter)) {
        if (typeof value === 'object' && value !== null) {
          for (const [op, val] of Object.entries(value as Record<string, unknown>)) {
            switch (op) {
              case 'gte': query = query.gte(key, val as string | number); break;
              case 'lte': query = query.lte(key, val as string | number); break;
              case 'in': query = query.in(key, val as unknown[]); break;
              case 'notIn': query = query.not(key, 'in', `(${(val as unknown[]).join(',')})`); break;
              case 'neq': query = query.neq(key, val as string | number | boolean); break;
            }
          }
        } else {
          query = query.eq(key, value as string | number | boolean);
        }
      }
    }

    const { count, error } = await query;

    if (error) {
      console.error(`Supabase count error (${tableName}):`, error);
      return 0;
    }

    return count || 0;
  }

  return 0;
}

/**
 * Aggregate sum of a column in a table
 */
export async function sumColumn(
  tableName: string,
  column: string,
  filter?: Record<string, unknown>
): Promise<number> {
  const supabase = getSupabaseClient();

  if (supabase) {
    let query = supabase.from(tableName).select(column);

    if (filter) {
      for (const [key, value] of Object.entries(filter)) {
        if (typeof value === 'object' && value !== null) {
          for (const [op, val] of Object.entries(value as Record<string, unknown>)) {
            switch (op) {
              case 'gte': query = query.gte(key, val as string | number); break;
              case 'lte': query = query.lte(key, val as string | number); break;
              case 'in': query = query.in(key, val as unknown[]); break;
              case 'notIn': query = query.not(key, 'in', `(${(val as unknown[]).join(',')})`); break;
              case 'neq': query = query.neq(key, val as string | number | boolean); break;
            }
          }
        } else {
          query = query.eq(key, value as string | number | boolean);
        }
      }
    }

    const { data, error } = await query;

    if (error) {
      console.error(`Supabase sum error (${tableName}):`, error);
      return 0;
    }

    // ✅ DESPUÉS (correcto - pasa por unknown primero)
    const rows = (data || []) as unknown as Record<string, unknown>[];
    return rows.reduce((sum: number, row: Record<string, unknown>) => {
      return sum + (Number(row[column]) || 0);
    }, 0);
  }

  // Export the Prisma client as fallback
  export { db };