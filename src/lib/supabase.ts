import { createClient, SupabaseClient } from '@supabase/supabase-js';

// ============================================================
// Supabase Client for KC Cobranzas
// Connects to the same database as the Flutter app
// With in-memory caching for latency optimization
// ============================================================

// --- Client instances ---
let supabaseInstance: SupabaseClient | null = null;
let cachedCredentials: { url: string; key: string } | null = null;

// --- Connection test cache ---
interface ConnectionCache {
  status: 'connected' | 'error';
  tables: string[];
  message: string;
  timestamp: number;
}
let connectionCache: ConnectionCache | null = null;
const CACHE_TTL_MS = 5 * 60 * 1000; // 5 minutes

export interface SupabaseConfig {
  url: string;
  anonKey: string;
  serviceRoleKey?: string;
}

// All 22 tables from KC Cobranzas Supabase schema
const TABLE_CHECKS = [
  // Core entities
  'zones', 'profiles', 'clients', 'loans', 'payments',
  'capital_movements', 'settings', 'guarantors',
  // Collector & Zone management
  'collector_zones', 'collector_locations', 'collector_current_location',
  'supervisor_assignments',
  // Loan lifecycle
  'late_fees', 'payment_schedule', 'deferred_payments',
  'charge_off_history',
  // Daily operations
  'daily_settlements', 'collector_expenses',
  // Communication & tracking
  'client_notes', 'notifications', 'payment_links', 'chat_messages',
];

/**
 * Get Supabase credentials from environment variables or cached DB values
 * Priority 1: SUPABASE_SERVICE_ROLE_KEY (server-only env var, bypasses RLS)
 * Priority 2: NEXT_PUBLIC_SUPABASE_ANON_KEY (public key, limited by RLS)
 * Priority 3: Cached credentials from database / Config tab
 */
function getCredentials(): { url: string; key: string } | null {
  const envUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;

  // Priority 1: Service role key (bypasses RLS for write operations)
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (envUrl && serviceRoleKey) {
    return { url: envUrl, key: serviceRoleKey };
  }

  // Priority 2: Anon key (public, limited by RLS - read-only for most tables)
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (envUrl && anonKey) {
    return { url: envUrl, key: anonKey };
  }

  // Priority 3: Cached credentials from database / Config tab
  if (cachedCredentials?.url && cachedCredentials.key) {
    return cachedCredentials;
  }

  return null;
}

/**
 * Set cached credentials (called from API route that reads from DB)
 */
export function setCachedCredentials(url: string, key: string) {
  cachedCredentials = { url, key };
  // Reset instance so next call creates new client
  supabaseInstance = null;
}

/**
 * Initialize or get the Supabase client
 * Uses environment variables, cached credentials, or dynamic configuration
 */
export function getSupabaseClient(config?: SupabaseConfig): SupabaseClient | null {
  const credentials = config
    ? { url: config.url, key: config.serviceRoleKey || config.anonKey }
    : getCredentials();

  if (!credentials?.url || !credentials?.key) {
    return null;
  }

  if (!supabaseInstance) {
    supabaseInstance = createClient(credentials.url, credentials.key, {
      auth: {
        persistSession: false,
        autoRefreshToken: false,
      },
      db: {
        schema: 'public',
      },
    });
  }

  return supabaseInstance;
}

/**
 * Reset the client instance (used when config changes)
 */
export function resetSupabaseClient() {
  supabaseInstance = null;
  cachedCredentials = null;
  connectionCache = null; // Invalidate cache on config change
}

/**
 * Create a Supabase client with specific credentials
 * Used for testing connections before saving
 */
export function createSupabaseClient(url: string, key: string): SupabaseClient {
  return createClient(url, key, {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
    },
    db: {
      schema: 'public',
    },
  });
}

/**
 * Quick connection check — just verifies 1 table (fast, ~100ms)
 * Used for GET status checks where we just need to know if connected
 */
export async function quickConnectionCheck(url: string, key: string): Promise<{
  success: boolean;
  message: string;
}> {
  try {
    const client = createSupabaseClient(url, key);
    const { error } = await client.from('profiles').select('*').limit(0);

    if (error) {
      // Try clients table as fallback
      const { error: err2 } = await client.from('clients').select('*').limit(0);
      if (err2) {
        return { success: false, message: `Error de conexión: ${err2.message}` };
      }
    }

    return { success: true, message: 'Conexión exitosa' };
  } catch (err) {
    return { success: false, message: `Error: ${err instanceof Error ? err.message : 'Error desconocido'}` };
  }
}

/**
 * Full connection test with table detection — uses cache to avoid repeated scans
 * @param forceFresh - Skip cache and force a fresh test (for "Probar Conexión" button)
 */
export async function testSupabaseConnection(
  url: string,
  key: string,
  forceFresh: boolean = false,
): Promise<{
  success: boolean;
  message: string;
  tables?: string[];
  fromCache?: boolean;
}> {
  // Return cached result if still valid
  if (!forceFresh && connectionCache && Date.now() - connectionCache.timestamp < CACHE_TTL_MS) {
    return {
      success: connectionCache.status === 'connected',
      message: connectionCache.message,
      tables: connectionCache.tables,
      fromCache: true,
    };
  }

  try {
    const client = createSupabaseClient(url, key);

    // Quick connection check first
    const { error } = await client.from('profiles').select('*').limit(0);

    if (error) {
      const { error: clientError } = await client.from('clients').select('*').limit(0);
      if (clientError) {
        connectionCache = {
          status: 'error',
          tables: [],
          message: `Error de conexión: ${clientError.message}`,
          timestamp: Date.now(),
        };
        return { success: false, message: connectionCache.message };
      }
    }

    // Detect available tables in parallel
    // Note: Some tables (collector_current_location) don't have an 'id' column,
    // so we use select('*') with limit(0) to just check table existence
    const tables: string[] = [];
    const results = await Promise.allSettled(
      TABLE_CHECKS.map(async (table) => {
        const { error: tableError } = await client.from(table).select('*').limit(0);
        return { table, exists: !tableError };
      })
    );

    for (const result of results) {
      if (result.status === 'fulfilled' && result.value.exists) {
        tables.push(result.value.table);
      }
    }

    const message = `Conexión exitosa. ${tables.length} tablas encontradas.`;

    // Update cache
    connectionCache = {
      status: 'connected',
      tables,
      message,
      timestamp: Date.now(),
    };

    return {
      success: true,
      message,
      tables,
      fromCache: false,
    };
  } catch (err) {
    const message = `Error: ${err instanceof Error ? err.message : 'Error desconocido'}`;
    connectionCache = {
      status: 'error',
      tables: [],
      message,
      timestamp: Date.now(),
    };
    return { success: false, message };
  }
}

/**
 * Invalidate the connection cache (call when config changes)
 */
export function invalidateConnectionCache() {
  connectionCache = null;
}

/**
 * Initialize Supabase client from database settings
 * Called on server startup or first request
 */
export async function initSupabaseFromDB(): Promise<boolean> {
  try {
    // Dynamic import to avoid circular dependency
    const { db } = await import('./db');
    const urlSetting = await db.setting.findUnique({ where: { key: 'supabase_url' } });
    const keySetting = await db.setting.findUnique({ where: { key: 'supabase_anon_key' } });
    const serviceKeySetting = await db.setting.findUnique({ where: { key: 'supabase_service_role_key' } });

    const url = urlSetting?.value;
    const key = serviceKeySetting?.value || keySetting?.value;

    if (url && key) {
      setCachedCredentials(url, key);
      return true;
    }
  } catch {
    // DB might not be initialized yet
  }
  return false;
}
