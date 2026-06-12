import { NextRequest, NextResponse } from 'next/server';
import { db, isVercel } from '@/lib/db';
import { toSnakeCase, toCamelCase, FIELD_MAP } from '@/lib/supabase-db';
import type { SupabaseClient } from '@supabase/supabase-js';

// ============================================================
// /api/supabase-sync - Sync data between local Prisma/SQLite and Supabase
// GET:  Fetch data from Supabase (with filters, pagination, field mapping)
// POST: Push local → Supabase or Pull Supabase → local
// ============================================================

// ---------- Type Definitions ----------

interface SyncReportTable {
  table: string;
  direction: 'push' | 'pull';
  sourceCount: number;
  synced: number;
  errors: number;
  errorMessages: string[];
  skipped: number;
}

interface SyncReport {
  success: boolean;
  direction: 'push' | 'pull';
  tables: SyncReportTable[];
  totalSynced: number;
  totalErrors: number;
  timestamp: string;
}

// Mapping from Prisma model names to Supabase table names
const PRISMA_TO_SUPABASE_TABLE: Record<string, string> = {
  profile: 'profiles',
  zone: 'zones',
  client: 'clients',
  guarantor: 'guarantors',
  clientNote: 'client_notes',
  loan: 'loans',
  payment: 'payments',
  paymentSchedule: 'payment_schedule',
  lateFee: 'late_fees',
  expense: 'collector_expenses',
  dailySettlement: 'daily_settlements',
  capitalMovement: 'capital_movements',
  notification: 'notifications',
  setting: 'settings',
  auditLog: 'audit_logs',
  paymentLink: 'payment_links',
};

// Reverse mapping: Supabase table name → Prisma model key (lowercase first letter)
const SUPABASE_TO_PRISMA_MODEL: Record<string, string> = {};
for (const [prismaModel, supabaseTable] of Object.entries(PRISMA_TO_SUPABASE_TABLE)) {
  SUPABASE_TO_PRISMA_MODEL[supabaseTable] = prismaModel;
}

// All valid Supabase table names that we support for sync
const VALID_TABLES = Object.keys(FIELD_MAP);

// Tables that should be excluded from push sync (they are derived or auto-managed)
const PUSH_EXCLUDED_TABLES: string[] = [];

// Fields that are auto-generated and should be excluded from insert operations
const AUTO_GENERATED_FIELDS: Record<string, string[]> = {
  clients: ['createdAt', 'updatedAt'],
  loans: ['createdAt', 'updatedAt'],
  payments: ['createdAt'],
  profiles: ['createdAt', 'updatedAt'],
  zones: ['createdAt', 'updatedAt'],
  capital_movements: ['createdAt'],
  guarantors: ['createdAt'],
  expenses: ['createdAt'],
  collector_expenses: ['createdAt'],
  daily_settlements: ['createdAt'],
  audit_logs: ['createdAt'],
  late_fees: ['generatedAt'],
  payment_schedules: ['createdAt'],
  payment_schedule: ['createdAt'],
  notifications: ['createdAt'],
  client_notes: ['createdAt'],
  settings: [],
};

// ---------- Helper: Get Supabase Client ----------

async function getSupabaseClientFromDB(): Promise<{ client: SupabaseClient; url: string; key: string } | null> {
  try {
    // Dynamic import to avoid loading @supabase/supabase-js at module level
    const { initSupabaseFromDB, createSupabaseClient } = await import('@/lib/supabase');

    // Step 1: Initialize Supabase credentials from database settings
    const initialized = await initSupabaseFromDB();
    if (!initialized) {
      return null;
    }

    // Step 2: Read stored credentials from database
    const urlSetting = await db.setting.findUnique({ where: { key: 'supabase_url' } });
    const keySetting = await db.setting.findUnique({ where: { key: 'supabase_anon_key' } });
    const serviceKeySetting = await db.setting.findUnique({ where: { key: 'supabase_service_role_key' } });

    const url = urlSetting?.value;
    const key = serviceKeySetting?.value || keySetting?.value;

    if (!url || !key) {
      return null;
    }

    // Step 3: Create Supabase client with stored credentials
    const client = createSupabaseClient(url, key);
    return { client, url, key };
  } catch (error) {
    console.error('Error initializing Supabase client from DB:', error);
    return null;
  }
}

// ---------- Helper: Build Supabase filter from query params ----------

function buildFilters(searchParams: URLSearchParams, tableName: string): Record<string, unknown> {
  const filters: Record<string, unknown> = {};
  const fieldMap = FIELD_MAP[tableName];

  // Standard filter parameters
  const filterParams: Record<string, string> = {
    status: 'status',
    clientId: 'client_id',
    collectorId: 'collector_id',
    zoneId: 'zone_id',
    loanId: 'loan_id',
    type: 'type',
    paymentMethod: 'payment_method',
    entityType: 'entity_type',
    severity: 'severity',
    documentType: 'document_type',
  };

  for (const [paramName, snakeField] of Object.entries(filterParams)) {
    const value = searchParams.get(paramName);
    if (value) {
      // Use snake_case field name for Supabase query
      if (fieldMap) {
        // Check if the camelCase version maps to a snake_case field
        const camelToSnake = Object.entries(fieldMap).find(([, v]) => v === snakeField);
        if (camelToSnake) {
          filters[camelToSnake[1]] = value;
        } else {
          filters[snakeField] = value;
        }
      } else {
        filters[snakeField] = value;
      }
    }
  }

  // Search filter (text search across multiple fields)
  const search = searchParams.get('search');
  if (search && fieldMap) {
    // For search, we'll handle it separately in the query builder
    filters._search = search;
  }

  // Date range filters
  const dateFrom = searchParams.get('dateFrom');
  const dateTo = searchParams.get('dateTo');

  if (dateFrom) {
    const dateField = fieldMap?.createdAt || 'created_at';
    filters[dateField] = { ...(filters[dateField] as Record<string, unknown> || {}), gte: dateFrom };
  }
  if (dateTo) {
    const dateField = fieldMap?.createdAt || 'created_at';
    filters[dateField] = { ...(filters[dateField] as Record<string, unknown> || {}), lte: dateTo };
  }

  return filters;
}

// ---------- Helper: Apply filters to Supabase query ----------

function applyFilters(
  query: ReturnType<SupabaseClient['from']['select']>,
  filters: Record<string, unknown>
) {
  let q = query;

  for (const [key, value] of Object.entries(filters)) {
    if (key === '_search') continue; // Handled separately

    if (value === undefined || value === null) continue;

    if (typeof value === 'object' && value !== null) {
      // Handle operator-based filters like { gte: x, lte: y }
      for (const [op, val] of Object.entries(value as Record<string, unknown>)) {
        switch (op) {
          case 'gte': q = q.gte(key, val as string | number); break;
          case 'lte': q = q.lte(key, val as string | number); break;
          case 'gt': q = q.gt(key, val as string | number); break;
          case 'lt': q = q.lt(key, val as string | number); break;
          case 'in': q = q.in(key, val as unknown[]); break;
          case 'neq': q = q.neq(key, val as string | number | boolean); break;
        }
      }
    } else {
      q = q.eq(key, value as string | number | boolean);
    }
  }

  return q;
}

// ---------- Helper: Map Supabase response to camelCase ----------

function mapRowsToCamelCase(rows: Record<string, unknown>[], tableName: string): Record<string, unknown>[] {
  return rows.map((row) => toCamelCase(row, tableName));
}

// ---------- Helper: Get Prisma model delegate ----------

function getPrismaModel(modelName: string): Record<string, unknown> {
  // Prisma client models are accessed via lowercase model name
  const modelKey = modelName.charAt(0).toLowerCase() + modelName.slice(1);
  return (db as Record<string, Record<string, unknown>>)[modelKey];
}

// ---------- Helper: Convert Prisma model name from Supabase table ----------

function supabaseTableToPrismaModel(tableName: string): string | null {
  return SUPABASE_TO_PRISMA_MODEL[tableName] || null;
}

// ---------- Helper: Prisma model name to PascalCase ----------

function toPascalCase(str: string): string {
  return str
    .split('_')
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join('');
}

// ============================================================
// GET /api/supabase-sync
// Fetch data from Supabase with filters, pagination, and field mapping
// ============================================================

export async function GET(request: NextRequest) {
  try {
    // On Vercel, sync is not available (no persistent local DB)
    if (isVercel) {
      return NextResponse.json(
        { error: 'Sync no disponible en entorno serverless' },
        { status: 503 }
      );
    }

    const { searchParams } = new URL(request.url);
    const table = searchParams.get('table');

    // Validate required table parameter
    if (!table) {
      return NextResponse.json(
        {
          error: 'Parámetro "table" es requerido',
          validTables: VALID_TABLES,
        },
        { status: 400 }
      );
    }

    if (!VALID_TABLES.includes(table)) {
      return NextResponse.json(
        {
          error: `Tabla "${table}" no es válida`,
          validTables: VALID_TABLES,
        },
        { status: 400 }
      );
    }

    // Initialize Supabase client from database settings
    const supabaseResult = await getSupabaseClientFromDB();
    if (!supabaseResult) {
      return NextResponse.json(
        {
          error: 'Supabase no está configurado. Configure las credenciales en /api/supabase-config primero.',
        },
        { status: 503 }
      );
    }

    const { client: supabase } = supabaseResult;

    // Parse pagination parameters
    const page = Math.max(1, parseInt(searchParams.get('page') || '1'));
    const limit = Math.min(500, Math.max(1, parseInt(searchParams.get('limit') || '50')));
    const offset = (page - 1) * limit;

    // Parse and build filters
    const filters = buildFilters(searchParams, table);

    // Parse sort parameters
    const sortBy = searchParams.get('sortBy') || 'created_at';
    const sortOrder = searchParams.get('sortOrder') || 'desc';

    // Build Supabase query
    let query = supabase
      .from(table)
      .select('*', { count: 'exact' });

    // Apply filters
    query = applyFilters(query, filters);

    // Handle text search (ilike on name or similar fields)
    const searchText = filters._search as string | undefined;
    if (searchText) {
      const fieldMap = FIELD_MAP[table];
      // Try to search on 'name' field if it exists
      if (fieldMap?.name) {
        query = query.ilike(fieldMap.name, `%${searchText}%`);
      }
    }

    // Apply sorting
    query = query.order(sortBy, { ascending: sortOrder === 'asc' });

    // Apply pagination
    query = query.range(offset, offset + limit - 1);

    // Execute query
    const { data, count, error } = await query;

    if (error) {
      console.error(`Supabase query error (${table}):`, error);
      return NextResponse.json(
        {
          error: `Error al consultar Supabase: ${error.message}`,
          table,
        },
        { status: 500 }
      );
    }

    // Map snake_case fields to camelCase
    const mappedData = mapRowsToCamelCase((data || []) as Record<string, unknown>[], table);

    // Determine the response key (use the table name as key, matching existing API patterns)
    const responseKey = table;

    return NextResponse.json({
      [responseKey]: mappedData,
      pagination: {
        page,
        limit,
        total: count || 0,
        totalPages: Math.ceil((count || 0) / limit),
      },
      source: 'supabase',
    });
  } catch (error) {
    console.error('Error in Supabase sync GET:', error);
    return NextResponse.json(
      { error: 'Error al sincronizar datos con Supabase' },
      { status: 500 }
    );
  }
}

// ============================================================
// POST /api/supabase-sync
// Sync data: push (local → Supabase) or pull (Supabase → local)
// Body: { direction: "push" | "pull", tables: string[] }
// ============================================================

export async function POST(request: NextRequest) {
  try {
    // On Vercel, sync is not available (no persistent local DB)
    if (isVercel) {
      return NextResponse.json(
        { error: 'Sync no disponible en entorno serverless' },
        { status: 503 }
      );
    }

    const body = await request.json();
    const { direction, tables } = body as { direction: 'push' | 'pull'; tables: string[] };

    // Validate direction
    if (!direction || !['push', 'pull'].includes(direction)) {
      return NextResponse.json(
        { error: 'Parámetro "direction" debe ser "push" o "pull"' },
        { status: 400 }
      );
    }

    // Validate tables
    if (!tables || !Array.isArray(tables) || tables.length === 0) {
      return NextResponse.json(
        {
          error: 'Parámetro "tables" debe ser un array no vacío de nombres de tabla',
          validTables: VALID_TABLES,
        },
        { status: 400 }
      );
    }

    // Filter to only valid tables
    const validTables = tables.filter((t) => VALID_TABLES.includes(t));
    const invalidTables = tables.filter((t) => !VALID_TABLES.includes(t));

    if (validTables.length === 0) {
      return NextResponse.json(
        {
          error: 'Ninguna de las tablas especificadas es válida',
          invalidTables,
          validTables: VALID_TABLES,
        },
        { status: 400 }
      );
    }

    // Initialize Supabase client
    const supabaseResult = await getSupabaseClientFromDB();
    if (!supabaseResult) {
      return NextResponse.json(
        {
          error: 'Supabase no está configurado. Configure las credenciales en /api/supabase-config primero.',
        },
        { status: 503 }
      );
    }

    const { client: supabase } = supabaseResult;

    // Process each table
    const report: SyncReport = {
      success: true,
      direction,
      tables: [],
      totalSynced: 0,
      totalErrors: 0,
      timestamp: new Date().toISOString(),
    };

    for (const tableName of validTables) {
      if (direction === 'push') {
        const tableReport = await pushToSupabase(supabase, tableName);
        report.tables.push(tableReport);
        report.totalSynced += tableReport.synced;
        report.totalErrors += tableReport.errors;
      } else {
        const tableReport = await pullFromSupabase(supabase, tableName);
        report.tables.push(tableReport);
        report.totalSynced += tableReport.synced;
        report.totalErrors += tableReport.errors;
      }
    }

    // Mark overall success based on error count
    if (report.totalErrors > 0) {
      report.success = false;
    }

    // Add warning about invalid tables if any
    const response: Record<string, unknown> = { ...report };
    if (invalidTables.length > 0) {
      response.warnings = [`Tablas ignoradas (no válidas): ${invalidTables.join(', ')}`];
    }

    return NextResponse.json(response);
  } catch (error) {
    console.error('Error in Supabase sync POST:', error);
    return NextResponse.json(
      { error: 'Error al sincronizar datos con Supabase' },
      { status: 500 }
    );
  }
}

// ============================================================
// Push: Local Prisma → Supabase
// ============================================================

async function pushToSupabase(
  supabase: SupabaseClient,
  tableName: string
): Promise<SyncReportTable> {
  const report: SyncReportTable = {
    table: tableName,
    direction: 'push',
    sourceCount: 0,
    synced: 0,
    errors: 0,
    errorMessages: [],
    skipped: 0,
  };

  try {
    // Check if this table should be excluded from push
    if (PUSH_EXCLUDED_TABLES.includes(tableName)) {
      report.skipped = 1;
      report.errorMessages.push('Tabla excluida del push (auto-gestionada)');
      return report;
    }

    // Get Prisma model for this table
    const prismaModelName = supabaseTableToPrismaModel(tableName);
    if (!prismaModelName) {
      report.errors = 1;
      report.errorMessages.push(`No se encontró modelo Prisma para la tabla "${tableName}"`);
      return report;
    }

    const prismaModel = getPrismaModel(toPascalCase(prismaModelName));
    if (!prismaModel) {
      report.errors = 1;
      report.errorMessages.push(`Modelo Prisma "${prismaModelName}" no disponible`);
      return report;
    }

    // Read all records from Prisma
    const records = await prismaModel.findMany();
    report.sourceCount = records.length;

    if (records.length === 0) {
      return report;
    }

    // Get fields to exclude from insert
    const excludedFields = AUTO_GENERATED_FIELDS[tableName] || [];

    // Transform and insert records into Supabase in batches
    const BATCH_SIZE = 100;
    for (let i = 0; i < records.length; i += BATCH_SIZE) {
      const batch = records.slice(i, i + BATCH_SIZE);

      // Convert each record: camelCase → snake_case, remove auto-generated fields and relation fields
      const supabaseRecords = batch.map((record: Record<string, unknown>) => {
        // Remove auto-generated fields and relation objects
        const cleanRecord: Record<string, unknown> = {};
        for (const [key, value] of Object.entries(record)) {
          // Skip auto-generated fields
          if (excludedFields.includes(key)) continue;
          // Skip relation objects (non-primitive values that aren't dates)
          if (value !== null && typeof value === 'object' && !(value instanceof Date)) continue;
          // Skip undefined values
          if (value === undefined) continue;

          cleanRecord[key] = value;
        }

        // Convert to snake_case using FIELD_MAP
        return toSnakeCase(cleanRecord, tableName);
      });

      // Insert into Supabase (upsert to handle existing records)
      const { error } = await supabase
        .from(tableName)
        .upsert(supabaseRecords, {
          onConflict: 'id',
          ignoreDuplicates: false,
        });

      if (error) {
        // Try inserting one by one to identify which records fail
        for (const supabaseRecord of supabaseRecords) {
          const { error: singleError } = await supabase
            .from(tableName)
            .upsert(supabaseRecord, {
              onConflict: 'id',
              ignoreDuplicates: false,
            });

          if (singleError) {
            report.errors++;
            report.errorMessages.push(
              `Registro ${(supabaseRecord as Record<string, unknown>).id || 'unknown'}: ${singleError.message}`
            );
          } else {
            report.synced++;
          }
        }
      } else {
        report.synced += supabaseRecords.length;
      }
    }
  } catch (error) {
    report.errors++;
    report.errorMessages.push(
      `Error general: ${error instanceof Error ? error.message : 'Error desconocido'}`
    );
  }

  return report;
}

// ============================================================
// Pull: Supabase → Local Prisma
// ============================================================

async function pullFromSupabase(
  supabase: SupabaseClient,
  tableName: string
): Promise<SyncReportTable> {
  const report: SyncReportTable = {
    table: tableName,
    direction: 'pull',
    sourceCount: 0,
    synced: 0,
    errors: 0,
    errorMessages: [],
    skipped: 0,
  };

  try {
    // Get Prisma model for this table
    const prismaModelName = supabaseTableToPrismaModel(tableName);
    if (!prismaModelName) {
      report.errors = 1;
      report.errorMessages.push(`No se encontró modelo Prisma para la tabla "${tableName}"`);
      return report;
    }

    const prismaModel = getPrismaModel(toPascalCase(prismaModelName));
    if (!prismaModel) {
      report.errors = 1;
      report.errorMessages.push(`Modelo Prisma "${prismaModelName}" no disponible`);
      return report;
    }

    // Fetch all records from Supabase
    const { data, error } = await supabase
      .from(tableName)
      .select('*');

    if (error) {
      report.errors = 1;
      report.errorMessages.push(`Error al leer de Supabase: ${error.message}`);
      return report;
    }

    const rows = (data || []) as Record<string, unknown>[];
    report.sourceCount = rows.length;

    if (rows.length === 0) {
      return report;
    }

    // Convert each row from snake_case to camelCase and insert into Prisma
    for (const row of rows) {
      try {
        // Map snake_case to camelCase
        const camelRecord = toCamelCase(row, tableName);

        // Clean up the record for Prisma
        const prismaRecord: Record<string, unknown> = {};
        for (const [key, value] of Object.entries(camelRecord)) {
          // Skip null/undefined values for optional fields
          if (value === undefined) continue;
          // Skip relation objects (non-primitive values that aren't dates)
          if (value !== null && typeof value === 'object' && !(value instanceof Date)) continue;

          prismaRecord[key] = value;
        }

        // Handle date fields - convert strings to Date objects for Prisma
        for (const [key, value] of Object.entries(prismaRecord)) {
          if (typeof value === 'string' && isISODateString(value)) {
            prismaRecord[key] = new Date(value);
          }
        }

        // Use upsert to handle existing records (by id)
        if (prismaRecord.id) {
          await prismaModel.upsert({
            where: { id: prismaRecord.id },
            update: prismaRecord,
            create: prismaRecord,
          });
          report.synced++;
        } else {
          // No id, try creating
          await prismaModel.create({ data: prismaRecord });
          report.synced++;
        }
      } catch (error) {
        report.errors++;
        const rowId = row.id || 'unknown';
        report.errorMessages.push(
          `Registro ${rowId}: ${error instanceof Error ? error.message : 'Error desconocido'}`
        );
      }
    }
  } catch (error) {
    report.errors++;
    report.errorMessages.push(
      `Error general: ${error instanceof Error ? error.message : 'Error desconocido'}`
    );
  }

  return report;
}

// ---------- Helper: Check if string is a valid ISO date ----------

function isISODateString(value: string): boolean {
  // Match ISO 8601 date format: YYYY-MM-DD or YYYY-MM-DDTHH:mm:ss.sssZ
  const isoDateRegex = /^\d{4}-\d{2}-\d{2}(T\d{2}:\d{2}:\d{2}(\.\d{3})?Z?)?$/;
  if (!isoDateRegex.test(value)) return false;

  const date = new Date(value);
  return !isNaN(date.getTime());
}
