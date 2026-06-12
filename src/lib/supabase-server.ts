import { createClient, SupabaseClient } from '@supabase/supabase-js';

// ============================================================
// KC Cobranzas - Server-Side Supabase Query Service
// Connects to the same Supabase database as the Flutter app
// Provides query functions that return data in the same shape
// as the existing Prisma-based API routes
// ============================================================

// ============================================================
// TypeScript Types (matching frontend expectations)
// ============================================================

export interface OverviewData {
  loans: {
    total: number;
    active: number;
    mora: number;
    completed: number;
    cancelled: number;
  };
  financials: {
    totalLoaned: number;
    totalExpected: number;
    totalCollected: number;
    totalInterest: number;
    moraOutstanding: number;
  };
  payments: {
    total: number;
    last7Days: number;
    last30Days: number;
    amountLast30Days: number;
  };
  clients: {
    total: number;
    withActiveLoans: number;
    inMora: number;
    avgCreditScore: number;
  };
  lateFees: {
    pending: number;
    paid: number;
    waived: number;
  };
  capital: {
    current: number;
  };
  rates: {
    moraRate: number;
    collectionEfficiency: number;
  };
}

export interface MoraPredictionData {
  summary: {
    total: number;
    low: number;
    medium: number;
    high: number;
    critical: number;
    avgRiskScore: number;
    predictedMoraNext7Days: number;
  };
  assessments: RiskAssessment[];
}

export interface RiskAssessment {
  loanId: string;
  clientName: string;
  clientId: string;
  amount: number;
  totalAmount: number;
  amountPaid: number;
  creditScore: number | null;
  riskScore: number;
  riskLevel: 'low' | 'medium' | 'high' | 'critical';
  factors: { factor: string; impact: number; description: string }[];
  daysRemaining: number | null;
}

export interface TrendData {
  dailyPayments: { date: string; amount: number; count: number }[];
  weeklyActions: { week: string; moraChanges: number; loanCreations: number }[];
  paymentMethods: { method: string; count: number; amount: number }[];
  zoneMora: { zone: string; totalLoans: number; moraLoans: number; moraAmount: number; moraRate: number }[];
}

export interface CollectorPerformance {
  id: string;
  name: string | null;
  activeLoans: number;
  moraLoans: number;
  totalLoans: number;
  moraRate: number;
  totalManaged: number;
  totalCollected: number;
  collectionRate: number;
  payments7Days: number;
  amount7Days: number;
}

export interface Client {
  id: string;
  name: string;
  documentNumber: string;
  documentType: string;
  phone: string;
  address: string | null;
  zoneId: string | null;
  zone: { id: string; name: string } | null;
  photoUrl: string | null;
  creditScore: number | null;
  latitude: number | null;
  longitude: number | null;
  createdBy: string | null;
  createdAt: string;
  updatedAt: string | null;
  loans?: { id: string; status: string; amount: number; totalAmount: number; amountPaid: number }[];
  guarantors?: { id: string; name: string; phone: string | null }[];
  stats?: {
    totalLoans: number;
    activeLoans: number;
    totalLoaned: number;
    totalPaid: number;
    hasMora: boolean;
  };
}

export interface Loan {
  id: string;
  clientId: string;
  collectorId: string | null;
  zoneId: string | null;
  amount: number;
  totalAmount: number;
  interest: number;
  days: number;
  dailyPayment: number;
  paymentFrequency: string;
  numCuotas: number;
  amountPaid: number;
  startDate: string | null;
  endDate: string | null;
  status: string;
  creditApproved: boolean;
  signature: string | null;
  notes: string | null;
  chargedOff: boolean;
  chargedOffAt: string | null;
  chargedOffBy: string | null;
  recoveryCollectorId: string | null;
  createdBy: string | null;
  createdAt: string;
  updatedAt: string | null;
  // Joined relations
  client?: { id: string; name: string; documentNumber: string; documentType: string; phone: string; creditScore?: number | null } | null;
  collector?: { id: string; name: string } | null;
  zone?: { id: string; name: string } | null;
  payments?: Payment[];
  lateFees?: LateFee[];
  schedule?: PaymentScheduleEntry[];
  // Derived fields
  progressPercent?: number;
  remaining?: number;
  daysElapsed?: number;
  daysRemaining?: number | null;
  isOverdue?: boolean;
  pendingLateFees?: number;
}

export interface Payment {
  id: string;
  loanId: string;
  collectorId: string | null;
  clientId: string | null;
  amount: number;
  interest: number | null;
  paymentMethod: string;
  status: string;
  observation: string | null;
  proofPhoto: string | null;
  paymentDate: string;
  createdAt: string;
  // Joined relations
  loan?: {
    id: string;
    client?: { id: string; name: string; documentNumber: string; documentType: string; phone: string } | null;
  } | null;
  collector?: { id: string; name: string } | null;
  // Derived fields
  loanStatus?: string;
  loanCompleted?: boolean;
}

export interface CapitalMovement {
  id: string;
  type: string;
  amount: number;
  previousCapital: number;
  newCapital: number;
  description: string | null;
  createdAt: string;
}

export interface Zone {
  id: string;
  name: string;
  createdAt: string;
  updatedAt: string | null;
  stats?: {
    totalClients: number;
    totalLoans: number;
    activeLoans: number;
    totalLoaned: number;
    moraLoans: number;
  };
}

export interface Collector {
  id: string;
  name: string | null;
  email: string | null;
  phone: string | null;
  role: string;
  isActive: boolean;
  loanCount?: number;
  paymentCount?: number;
}

export interface CollectorLocation {
  collectorId: string;
  latitude: number;
  longitude: number;
  heading: number | null;
  updatedAt: string;
  collector?: { id: string; name: string } | null;
}

export interface LateFee {
  id: string;
  loanId: string;
  daysLate: number;
  amount: number;
  ratePerDay: number;
  status: string;
  waivedBy: string | null;
  waivedReason: string | null;
  waivedAt: string | null;
  paidAt: string | null;
  generatedAt: string;
}

export interface PaymentScheduleEntry {
  id: string;
  loanId: string;
  installmentNumber: number;
  amount: number;
  dueDate: string;
  status: string;
}

export interface PaginatedResult<T> {
  data: T[];
  pagination: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  };
}

// ============================================================
// Snake_case ↔ CamelCase Mapping
// ============================================================

const CLIENT_MAP: Record<string, string> = {
  id: 'id', name: 'name', dni: 'documentNumber', phone: 'phone', address: 'address',
  zone_id: 'zoneId', photo_url: 'photoUrl', document_type: 'documentType',
  credit_score: 'creditScore', credit_score_label: 'creditScoreLabel',
  latitude: 'latitude', longitude: 'longitude',
  created_by: 'createdBy', created_at: 'createdAt',
};

const LOAN_MAP: Record<string, string> = {
  id: 'id', client_id: 'clientId', collector_id: 'collectorId', zone_id: 'zoneId',
  amount: 'amount', total_amount: 'totalAmount', interest: 'interest',
  days: 'days', daily_payment: 'dailyPayment',
  payment_frequency: 'paymentFrequency', num_cuotas: 'numCuotas',
  amount_paid: 'amountPaid', start_date: 'startDate', end_date: 'endDate',
  status: 'status', credit_approved: 'creditApproved', signature: 'signature',
  notes: 'notes', charged_off: 'chargedOff', charged_off_at: 'chargedOffAt',
  charged_off_by: 'chargedOffBy', recovery_collector_id: 'recoveryCollectorId',
  cancellation_reason: 'cancellationReason', cancelled_by: 'cancelledBy', cancelled_at: 'cancelledAt',
  completed_at: 'completedAt',
  created_by: 'createdBy', created_at: 'createdAt',
};

const PAYMENT_MAP: Record<string, string> = {
  id: 'id', loan_id: 'loanId', collector_id: 'collectorId', client_id: 'clientId',
  amount: 'amount', interest: 'interest', payment_method: 'paymentMethod',
  status: 'status', observation: 'observation', proof_photo: 'proofPhoto',
  payment_date: 'paymentDate', created_at: 'createdAt',
  created_by: 'createdBy', cancellation_reason: 'cancellationReason',
  cancelled_by: 'cancelledBy', cancelled_at: 'cancelledAt',
};

const CAPITAL_MOVEMENT_MAP: Record<string, string> = {
  id: 'id', type: 'type', amount: 'amount',
  previous_capital: 'previousCapital', new_capital: 'newCapital',
  description: 'description', created_at: 'createdAt',
};

const ZONE_MAP: Record<string, string> = {
  id: 'id', name: 'name', created_at: 'createdAt',
};

const COLLECTOR_MAP: Record<string, string> = {
  id: 'id', name: 'name', email: 'email', phone: 'phone',
  role: 'role', is_active: 'isActive',
  photo_url: 'photoUrl', daily_goal: 'dailyGoal',
  biometric_enabled: 'biometricEnabled', created_at: 'createdAt',
  // Note: Supabase profiles table does NOT have: document_number, document_type, address, password, updated_at
  // These columns exist only in the local Prisma schema
};

const LATE_FEE_MAP: Record<string, string> = {
  id: 'id', loan_id: 'loanId', days_late: 'daysLate',
  amount: 'amount', rate_per_day: 'ratePerDay', status: 'status',
  waived_by: 'waivedBy', waived_reason: 'waivedReason', waived_at: 'waivedAt',
  paid_at: 'paidAt', generated_at: 'generatedAt', updated_at: 'updatedAt',
};

const SCHEDULE_MAP: Record<string, string> = {
  id: 'id', loan_id: 'loanId', installment_number: 'installmentNumber',
  amount: 'amount', due_date: 'dueDate', status: 'status', created_at: 'createdAt',
};

const COLLECTOR_LOCATION_MAP: Record<string, string> = {
  collector_id: 'collectorId', latitude: 'latitude', longitude: 'longitude',
  heading: 'heading', updated_at: 'updatedAt',
};

// Build reverse maps (camelCase → snake_case) for inserts
function buildReverseMap(map: Record<string, string>): Record<string, string> {
  const rev: Record<string, string> = {};
  for (const [snake, camel] of Object.entries(map)) {
    rev[camel] = snake;
  }
  return rev;
}

const CLIENT_REVERSE = buildReverseMap(CLIENT_MAP);
const LOAN_REVERSE = buildReverseMap(LOAN_MAP);
const PAYMENT_REVERSE = buildReverseMap(PAYMENT_MAP);
const CAPITAL_MOVEMENT_REVERSE = buildReverseMap(CAPITAL_MOVEMENT_MAP);

/** Convert a single record from snake_case to camelCase using a map */
function toCamel<T>(record: Record<string, unknown>, map: Record<string, string>): T {
  const result: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(record)) {
    const camelKey = map[key] || key;
    result[camelKey] = value;
  }
  return result as T;
}

/** Convert a single record from camelCase to snake_case using a reverse map */
function toSnake(record: Record<string, unknown>, reverseMap: Record<string, string>): Record<string, unknown> {
  const result: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(record)) {
    const snakeKey = reverseMap[key] || key;
    result[snakeKey] = value;
  }
  return result;
}

/** Convert an array of records from snake_case to camelCase */
function toCamelList<T>(records: Record<string, unknown>[], map: Record<string, string>): T[] {
  return records.map((r) => toCamel<T>(r, map));
}

// ============================================================
// Supabase Client Management
// ============================================================

let serverInstance: SupabaseClient | null = null;
let serverCredentials: { url: string; key: string; keyType?: 'service_role' | 'anon' } | null = null;

/**
 * Set server-side Supabase credentials (called when Config tab saves credentials)
 * This allows the API routes to use Supabase without requiring env vars
 */
export function setServerCredentials(url: string, key: string, keyType?: 'service_role' | 'anon'): void {
  serverCredentials = { url, key, keyType: keyType || 'anon' };
  serverInstance = null; // Reset so next call creates new client
}

/**
 * Get the currently configured server credentials (for display in Config tab)
 * Priority 1: SUPABASE_SERVICE_ROLE_KEY (server-only env var, bypasses RLS)
 * Priority 2: NEXT_PUBLIC_SUPABASE_ANON_KEY (public key, limited by RLS)
 * Priority 3: In-memory credentials from Config tab
 */
export function getServerCredentials(): { url: string; key: string; keyType: 'service_role' | 'anon' } | null {
  const envUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;

  // Priority 1: Service role key (bypasses RLS for write operations)
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (envUrl && serviceRoleKey && serviceRoleKey.trim() !== '') {
    return { url: envUrl, key: serviceRoleKey, keyType: 'service_role' };
  }

  // Priority 2: Anon key (public, limited by RLS - read-only for most tables)
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (envUrl && anonKey) return { url: envUrl, key: anonKey, keyType: 'anon' };

  // Priority 3: In-memory credentials (set via Config tab)
  if (serverCredentials) {
    return { url: serverCredentials.url, key: serverCredentials.key, keyType: serverCredentials.keyType || 'anon' };
  }

  return null;
}

/**
 * Returns a Supabase client initialized from environment variables or cached credentials.
 * Uses SUPABASE_SERVICE_ROLE_KEY first (bypasses RLS for admin),
 * falls back to NEXT_PUBLIC_SUPABASE_ANON_KEY, then to DB-stored credentials.
 * Returns null if not configured.
 */
export function getSupabaseServerClient(): SupabaseClient | null {
  const credentials = getServerCredentials();
  if (!credentials) return null;

  if (!serverInstance) {
    serverInstance = createClient(credentials.url, credentials.key, {
      auth: {
        persistSession: false,
        autoRefreshToken: false,
      },
      db: { schema: 'public' },
    });
  }

  return serverInstance;
}

/**
 * Check if Supabase credentials are available
 * Checks both environment variables and cached DB credentials
 */
export function isSupabaseConfigured(): boolean {
  return getServerCredentials() !== null;
}

/**
 * Check if a service_role key is configured (bypasses RLS)
 * Returns true only if SUPABASE_SERVICE_ROLE_KEY is set in env vars or DB settings
 */
export function hasServiceRoleKey(): boolean {
  return !!process.env.SUPABASE_SERVICE_ROLE_KEY;
}

/**
 * Get the current client mode based on available keys
 * Returns 'read_write' if service_role key is available, 'read_only' if only anon key
 */
export function getClientMode(): 'read_write' | 'read_only' {
  return hasServiceRoleKey() ? 'read_write' : 'read_only';
}

/**
 * Test a Supabase connection with provided credentials
 */
export async function testConnection(url: string, key: string): Promise<{
  success: boolean;
  message: string;
  tables?: string[];
}> {
  try {
    const client = createClient(url, key, {
      auth: { persistSession: false, autoRefreshToken: false },
      db: { schema: 'public' },
    });

    const { error } = await client.from('profiles').select('id').limit(1);
    if (error) {
      const { error: clientErr } = await client.from('clients').select('id').limit(1);
      if (clientErr) {
        return { success: false, message: `Connection error: ${clientErr.message}` };
      }
    }

    const tables: string[] = [];
    const checks = [
      'profiles', 'clients', 'loans', 'payments',
      'capital_movements', 'settings', 'guarantors', 'zones',
      'collector_locations', 'collector_current_location', 'collector_zones',
      'supervisor_assignments', 'late_fees', 'payment_schedule',
      'deferred_payments', 'daily_settlements', 'collector_expenses',
      'client_notes', 'charge_off_history', 'notifications', 'payment_links',
      'chat_messages',
    ];

    for (const table of checks) {
      try {
        const { error: tErr } = await client.from(table).select('id').limit(1);
        if (!tErr) tables.push(table);
      } catch {
        // table doesn't exist, skip
      }
    }

    return {
      success: true,
      message: `Connected. ${tables.length} tables found.`,
      tables,
    };
  } catch (err) {
    return {
      success: false,
      message: `Error: ${err instanceof Error ? err.message : 'Unknown error'}`,
    };
  }
}

/** Reset the server client (useful after config changes) */
export function resetServerClient(): void {
  serverInstance = null;
  serverCredentials = null;
}

// ============================================================
// Helper: Get a guaranteed Supabase client or throw
// ============================================================

function getClient(): SupabaseClient {
  const client = getSupabaseServerClient();
  if (!client) throw new Error('Supabase is not configured');
  return client;
}

// ============================================================
// Helper: Calculate derived loan fields
// ============================================================

function calculateLoanDerived(loan: Loan): void {
  loan.progressPercent = loan.totalAmount > 0
    ? Math.min(100, Math.round((loan.amountPaid / loan.totalAmount) * 10000) / 100)
    : 0;
  loan.remaining = Math.max(0, loan.totalAmount - loan.amountPaid);
  loan.daysElapsed = loan.startDate
    ? Math.floor((Date.now() - new Date(loan.startDate).getTime()) / 86400000)
    : 0;
  loan.daysRemaining = loan.endDate
    ? Math.floor((new Date(loan.endDate).getTime() - Date.now()) / 86400000)
    : null;
  loan.isOverdue = loan.daysRemaining !== null && loan.daysRemaining < 0;
  loan.pendingLateFees = (loan as Loan & { _pendingLateFeeCount?: number })._pendingLateFeeCount || 0;
}

// ============================================================
// ANALYTICS QUERIES
// ============================================================

/**
 * Get analytics overview data matching the existing /api/analytics?type=overview response
 */
export async function getAnalyticsOverview(): Promise<OverviewData | null> {
  const sb = getSupabaseServerClient();
  if (!sb) return null;

  try {
    const today = new Date();
    const thirtyDaysAgo = new Date(today.getTime() - 30 * 86400000);
    const sevenDaysAgo = new Date(today.getTime() - 7 * 86400000);

    // --- Loan counts by status ---
    const [allLoans, activeLoans, moraLoans, completedLoans, cancelledLoans] = await Promise.all([
      sb.from('loans').select('id', { count: 'exact', head: true }),
      sb.from('loans').select('id', { count: 'exact', head: true }).eq('status', 'active'),
      sb.from('loans').select('id', { count: 'exact', head: true }).eq('status', 'mora'),
      sb.from('loans').select('id', { count: 'exact', head: true }).eq('status', 'completed'),
      sb.from('loans').select('id', { count: 'exact', head: true }).eq('status', 'cancelled'),
    ]);

    const totalLoans = allLoans.count || 0;
    const activeCount = activeLoans.count || 0;
    const moraCount = moraLoans.count || 0;
    const completedCount = completedLoans.count || 0;
    const cancelledCount = cancelledLoans.count || 0;

    // --- Financial stats (non-cancelled loans) ---
    const { data: nonCancelledLoans } = await sb
      .from('loans')
      .select('amount, total_amount, amount_paid, interest')
      .neq('status', 'cancelled');

    const loanFinancials = (nonCancelledLoans || []).reduce(
      (acc, l) => ({
        totalLoaned: acc.totalLoaned + (Number(l.amount) || 0),
        totalExpected: acc.totalExpected + (Number(l.total_amount) || 0),
        totalCollected: acc.totalCollected + (Number(l.amount_paid) || 0),
        totalInterest: acc.totalInterest + (Number(l.interest) || 0),
      }),
      { totalLoaned: 0, totalExpected: 0, totalCollected: 0, totalInterest: 0 }
    );

    // --- Mora financials ---
    const { data: moraLoansData } = await sb
      .from('loans')
      .select('amount, total_amount, amount_paid')
      .eq('status', 'mora');

    const moraOutstanding = (moraLoansData || []).reduce(
      (sum, l) => sum + (Number(l.total_amount) || 0) - (Number(l.amount_paid) || 0),
      0
    );

    // --- Payment stats ---
    const [totalPaymentsRes, payments7dRes, payments30dRes] = await Promise.all([
      sb.from('payments').select('id', { count: 'exact', head: true }).eq('status', 'completed'),
      sb.from('payments').select('id', { count: 'exact', head: true }).eq('status', 'completed').gte('payment_date', sevenDaysAgo.toISOString().split('T')[0]),
      sb.from('payments').select('id', { count: 'exact', head: true }).eq('status', 'completed').gte('payment_date', thirtyDaysAgo.toISOString().split('T')[0]),
    ]);

    const { data: payments30dAmounts } = await sb
      .from('payments')
      .select('amount')
      .eq('status', 'completed')
      .gte('payment_date', thirtyDaysAgo.toISOString().split('T')[0]);

    const amountLast30Days = (payments30dAmounts || []).reduce((s, p) => s + (Number(p.amount) || 0), 0);

    // --- Client stats ---
    const [totalClientsRes, clientsWithActiveRes, clientsInMoraRes] = await Promise.all([
      sb.from('clients').select('id', { count: 'exact', head: true }),
      sb.from('clients').select('id').in(
        'id',
        ((await sb.from('loans').select('client_id').in('status', ['active'])).data || []).map((l) => l.client_id)
      ),
      sb.from('clients').select('id').in(
        'id',
        ((await sb.from('loans').select('client_id').eq('status', 'mora')).data || []).map((l) => l.client_id)
      ),
    ]);

    const totalClients = totalClientsRes.count || 0;
    const clientsWithActive = new Set((clientsWithActiveRes.data || []).map((c) => c.id)).size;
    const clientsInMora = new Set((clientsInMoraRes.data || []).map((c) => c.id)).size;

    // --- Avg credit score ---
    const { data: allClients } = await sb.from('clients').select('credit_score');
    const avgCreditScore = (allClients || []).length > 0
      ? allClients!.reduce((s, c) => s + (Number(c.credit_score) || 0), 0) / allClients!.length
      : 0;

    // --- Late fees ---
    const [pendingFeesData, paidFeesData, waivedFeesData] = await Promise.all([
      sb.from('late_fees').select('amount').eq('status', 'pending'),
      sb.from('late_fees').select('amount').eq('status', 'paid'),
      sb.from('late_fees').select('amount').eq('status', 'waived'),
    ]);

    const pendingFees = (pendingFeesData.data || []).reduce((s, f) => s + (Number(f.amount) || 0), 0);
    const paidFees = (paidFeesData.data || []).reduce((s, f) => s + (Number(f.amount) || 0), 0);
    const waivedFees = (waivedFeesData.data || []).reduce((s, f) => s + (Number(f.amount) || 0), 0);

    // --- Capital ---
    let currentCapital = 0;
    const { data: settingsData } = await sb.from('settings').select('capital').limit(1);
    if (settingsData && settingsData.length > 0) {
      currentCapital = Number(settingsData[0].capital) || 0;
    } else {
      // Fallback: get from last capital movement
      const { data: lastMov } = await sb
        .from('capital_movements')
        .select('new_capital')
        .order('created_at', { ascending: false })
        .limit(1);
      currentCapital = lastMov && lastMov.length > 0 ? Number(lastMov[0].new_capital) : 0;
    }

    // --- Rates ---
    const moraRate = activeCount + moraCount > 0 ? (moraCount / (activeCount + moraCount)) * 100 : 0;

    // Collection efficiency (last 30 days)
    const { data: activeOrMoraLoans } = await sb
      .from('loans')
      .select('daily_payment')
      .in('status', ['active', 'mora']);

    const dailyExpected = (activeOrMoraLoans || []).reduce((s, l) => s + (Number(l.daily_payment) || 0), 0);
    const expected30Days = dailyExpected * 30;
    const collectionEfficiency = expected30Days > 0 ? (amountLast30Days / expected30Days) * 100 : 0;

    return {
      loans: {
        total: totalLoans,
        active: activeCount,
        mora: moraCount,
        completed: completedCount,
        cancelled: cancelledCount,
      },
      financials: {
        totalLoaned: loanFinancials.totalLoaned,
        totalExpected: loanFinancials.totalExpected,
        totalCollected: loanFinancials.totalCollected,
        totalInterest: loanFinancials.totalInterest,
        moraOutstanding,
      },
      payments: {
        total: totalPaymentsRes.count || 0,
        last7Days: payments7dRes.count || 0,
        last30Days: payments30dRes.count || 0,
        amountLast30Days,
      },
      clients: {
        total: totalClients,
        withActiveLoans: clientsWithActive,
        inMora: clientsInMora,
        avgCreditScore: Math.round(avgCreditScore * 100) / 100,
      },
      lateFees: {
        pending: pendingFees,
        paid: paidFees,
        waived: waivedFees,
      },
      capital: { current: currentCapital },
      rates: {
        moraRate: Math.round(moraRate * 100) / 100,
        collectionEfficiency: Math.round(collectionEfficiency * 100) / 100,
      },
    };
  } catch (err) {
    console.error('Error in getAnalyticsOverview:', err);
    return null;
  }
}

/**
 * Get mora prediction data matching /api/analytics?type=mora-prediction
 */
export async function getMoraPrediction(): Promise<MoraPredictionData | null> {
  const sb = getSupabaseServerClient();
  if (!sb) return null;

  try {
    const today = new Date();

    // Get all active loans with client info
    const { data: activeLoansRaw, error } = await sb
      .from('loans')
      .select(`
        id, amount, total_amount, amount_paid, daily_payment, num_cuotas,
        end_date, client_id,
        clients!client_id (id, name, credit_score)
      `)
      .eq('status', 'active');

    if (error) throw error;

    // Get recent payments for each active loan
    const loanIds = (activeLoansRaw || []).map((l) => l.id);

    let recentPaymentsByLoan: Record<string, { payment_date: string }[]> = {};
    if (loanIds.length > 0) {
      const { data: recentPayments } = await sb
        .from('payments')
        .select('loan_id, payment_date')
        .eq('status', 'completed')
        .in('loan_id', loanIds)
        .gte('payment_date', new Date(today.getTime() - 14 * 86400000).toISOString().split('T')[0])
        .order('payment_date', { ascending: false });

      recentPaymentsByLoan = (recentPayments || []).reduce<Record<string, { payment_date: string }[]>>(
        (acc, p) => {
          if (!acc[p.loan_id]) acc[p.loan_id] = [];
          acc[p.loan_id].push({ payment_date: p.payment_date });
          return acc;
        },
        {}
      );
    }

    // Risk scoring algorithm (same as Prisma version)
    const riskAssessments: RiskAssessment[] = (activeLoansRaw || []).map((loan) => {
      const client = loan.clients as unknown as { id: string; name: string; credit_score: number | null } | null;
      let riskScore = 0;
      const factors: { factor: string; impact: number; description: string }[] = [];

      // Factor 1: Credit score (0-40 points)
      const creditScore = client?.credit_score || 50;
      const creditRisk = Math.max(0, (100 - creditScore) / 100) * 40;
      riskScore += creditRisk;
      factors.push({
        factor: 'Score Crediticio',
        impact: Math.round(creditRisk),
        description:
          creditScore < 30 ? 'Score muy bajo - alto riesgo' :
          creditScore < 50 ? 'Score bajo - riesgo moderado' :
          creditScore < 70 ? 'Score medio - riesgo bajo' :
          'Score alto - riesgo mínimo',
      });

      // Factor 2: Payment consistency (0-25 points)
      const totalExpected = (Number(loan.daily_payment) || 0) * (loan.num_cuotas || 1);
      const paymentRatio = totalExpected > 0 ? (Number(loan.amount_paid) || 0) / totalExpected : 0;
      const consistencyRisk = Math.max(0, (1 - paymentRatio) * 25);
      riskScore += consistencyRisk;
      factors.push({
        factor: 'Consistencia de Pago',
        impact: Math.round(consistencyRisk),
        description:
          paymentRatio > 0.8 ? 'Pagando bien' :
          paymentRatio > 0.5 ? 'Pagos irregulares' :
          'Pagos muy atrasados',
      });

      // Factor 3: Time remaining (0-20 points)
      let daysRemaining: number | null = null;
      if (loan.end_date) {
        daysRemaining = Math.floor((new Date(loan.end_date).getTime() - today.getTime()) / 86400000);
        const timeRisk =
          daysRemaining < 0 ? 20 :
          daysRemaining < 5 ? 18 :
          daysRemaining < 10 ? 12 :
          daysRemaining < 15 ? 6 : 0;
        riskScore += timeRisk;
        factors.push({
          factor: 'Tiempo Restante',
          impact: Math.round(timeRisk),
          description: daysRemaining < 0
            ? `Vencido hace ${Math.abs(daysRemaining)} días`
            : `${daysRemaining} días restantes`,
        });
      }

      // Factor 4: Recent payment gaps (0-15 points)
      const recentPayments = recentPaymentsByLoan[loan.id] || [];
      const recentIn7Days = recentPayments.filter((p) => {
        const daysAgo = Math.floor((today.getTime() - new Date(p.payment_date).getTime()) / 86400000);
        return daysAgo <= 7;
      });
      const expectedPaymentsWeek = 7;
      const gapRisk = Math.max(0, (1 - recentIn7Days.length / expectedPaymentsWeek) * 15);
      riskScore += gapRisk;
      factors.push({
        factor: 'Pagos Recientes',
        impact: Math.round(gapRisk),
        description: `${recentIn7Days.length} pagos en los últimos 7 días`,
      });

      riskScore = Math.min(100, Math.round(riskScore));

      let riskLevel: 'low' | 'medium' | 'high' | 'critical';
      if (riskScore < 25) riskLevel = 'low';
      else if (riskScore < 50) riskLevel = 'medium';
      else if (riskScore < 75) riskLevel = 'high';
      else riskLevel = 'critical';

      return {
        loanId: loan.id,
        clientName: client?.name || 'Unknown',
        clientId: client?.id || loan.client_id,
        amount: Number(loan.amount) || 0,
        totalAmount: Number(loan.total_amount) || 0,
        amountPaid: Number(loan.amount_paid) || 0,
        creditScore: client?.credit_score || null,
        riskScore,
        riskLevel,
        factors,
        daysRemaining,
      };
    });

    riskAssessments.sort((a, b) => b.riskScore - a.riskScore);

    const summary = {
      total: riskAssessments.length,
      low: riskAssessments.filter((r) => r.riskLevel === 'low').length,
      medium: riskAssessments.filter((r) => r.riskLevel === 'medium').length,
      high: riskAssessments.filter((r) => r.riskLevel === 'high').length,
      critical: riskAssessments.filter((r) => r.riskLevel === 'critical').length,
      avgRiskScore: riskAssessments.length > 0
        ? Math.round(riskAssessments.reduce((s, r) => s + r.riskScore, 0) / riskAssessments.length)
        : 0,
      predictedMoraNext7Days: riskAssessments.filter((r) => r.riskLevel === 'high' || r.riskLevel === 'critical').length,
    };

    return { summary, assessments: riskAssessments };
  } catch (err) {
    console.error('Error in getMoraPrediction:', err);
    return null;
  }
}

/**
 * Get trends data matching /api/analytics?type=trends
 */
export async function getTrends(): Promise<TrendData | null> {
  const sb = getSupabaseServerClient();
  if (!sb) return null;

  try {
    const today = new Date();

    // --- Daily payments for last 30 days ---
    const dailyPayments: { date: string; amount: number; count: number }[] = [];
    const thirtyDaysAgo = new Date(today.getTime() - 29 * 86400000);

    const { data: recentPayments } = await sb
      .from('payments')
      .select('amount, payment_date')
      .eq('status', 'completed')
      .gte('payment_date', thirtyDaysAgo.toISOString().split('T')[0]);

    const paymentsByDate: Record<string, { amount: number; count: number }> = {};
    for (let i = 0; i < 30; i++) {
      const date = new Date(today.getTime() - i * 86400000);
      const dateStr = date.toISOString().split('T')[0];
      paymentsByDate[dateStr] = { amount: 0, count: 0 };
    }

    (recentPayments || []).forEach((p) => {
      const dateStr = p.payment_date;
      if (paymentsByDate[dateStr]) {
        paymentsByDate[dateStr].amount += Number(p.amount) || 0;
        paymentsByDate[dateStr].count += 1;
      }
    });

    for (let i = 29; i >= 0; i--) {
      const date = new Date(today.getTime() - i * 86400000);
      const dateStr = date.toISOString().split('T')[0];
      const entry = paymentsByDate[dateStr] || { amount: 0, count: 0 };
      dailyPayments.push({ date: dateStr, amount: entry.amount, count: entry.count });
    }

    // --- Weekly actions (simplified: count loans created per week) ---
    const weeklyActions: { week: string; moraChanges: number; loanCreations: number }[] = [];
    for (let i = 11; i >= 0; i--) {
      const weekStart = new Date(today.getTime() - (i * 7 + 6) * 86400000).toISOString().split('T')[0];
      const weekEnd = new Date(today.getTime() - i * 7 * 86400000).toISOString().split('T')[0];

      const { data: creations } = await sb
        .from('loans')
        .select('id')
        .gte('created_at', weekStart)
        .lt('created_at', weekEnd);

      weeklyActions.push({
        week: `Sem ${12 - i}`,
        moraChanges: 0, // Would need audit_logs table in Supabase
        loanCreations: creations?.length || 0,
      });
    }

    // --- Payment methods distribution ---
    const { data: methodData } = await sb
      .from('payments')
      .select('payment_method, amount')
      .eq('status', 'completed');

    const methodAgg: Record<string, { count: number; amount: number }> = {};
    (methodData || []).forEach((p) => {
      const m = p.payment_method || 'cash';
      if (!methodAgg[m]) methodAgg[m] = { count: 0, amount: 0 };
      methodAgg[m].count += 1;
      methodAgg[m].amount += Number(p.amount) || 0;
    });

    const paymentMethods = Object.entries(methodAgg).map(([method, data]) => ({
      method,
      count: data.count,
      amount: data.amount,
    }));

    // --- Zone mora ---
    const { data: zonesData } = await sb.from('zones').select('id, name');
    const zoneMora: TrendData['zoneMora'] = [];

    for (const zone of zonesData || []) {
      const { data: zoneLoans } = await sb
        .from('loans')
        .select('id, amount, total_amount, amount_paid, status')
        .eq('zone_id', zone.id);

      const loans = zoneLoans || [];
      const moraLoans = loans.filter((l) => l.status === 'mora');
      zoneMora.push({
        zone: zone.name,
        totalLoans: loans.length,
        moraLoans: moraLoans.length,
        moraAmount: moraLoans.reduce((s, l) => s + (Number(l.total_amount) || 0) - (Number(l.amount_paid) || 0), 0),
        moraRate: loans.length > 0 ? Math.round((moraLoans.length / loans.length) * 10000) / 100 : 0,
      });
    }

    return { dailyPayments, weeklyActions, paymentMethods, zoneMora };
  } catch (err) {
    console.error('Error in getTrends:', err);
    return null;
  }
}

/**
 * Get collector performance data matching /api/analytics?type=collectors
 */
export async function getCollectorPerformance(): Promise<CollectorPerformance[] | null> {
  const sb = getSupabaseServerClient();
  if (!sb) return null;

  try {
    const today = new Date();
    const sevenDaysAgo = new Date(today.getTime() - 7 * 86400000).toISOString().split('T')[0];

    // Get collectors (profiles with role collector that are active)
    const { data: collectorsData } = await sb
      .from('profiles')
      .select('id, name')
      .eq('role', 'collector')
      .eq('is_active', true);

    const performance: CollectorPerformance[] = [];

    for (const collector of collectorsData || []) {
      // Get loans for this collector
      const { data: loans } = await sb
        .from('loans')
        .select('id, status, amount, total_amount, amount_paid')
        .eq('collector_id', collector.id);

      const allLoans = loans || [];
      const activeOrMora = allLoans.filter((l) => l.status === 'active' || l.status === 'mora');
      const active = allLoans.filter((l) => l.status === 'active');
      const mora = allLoans.filter((l) => l.status === 'mora');
      const moraRate = allLoans.length > 0 ? Math.round((mora.length / allLoans.length) * 100) : 0;
      const totalManaged = activeOrMora.reduce((s, l) => s + (Number(l.amount) || 0), 0);
      const totalCollected = activeOrMora.reduce((s, l) => s + (Number(l.amount_paid) || 0), 0);
      const collectionRate = totalManaged > 0 ? Math.round((totalCollected / totalManaged) * 100) : 0;

      // Payments last 7 days
      const { data: payments7d } = await sb
        .from('payments')
        .select('amount')
        .eq('collector_id', collector.id)
        .eq('status', 'completed')
        .gte('payment_date', sevenDaysAgo);

      const amount7Days = (payments7d || []).reduce((s, p) => s + (Number(p.amount) || 0), 0);

      performance.push({
        id: collector.id,
        name: collector.name,
        activeLoans: active.length,
        moraLoans: mora.length,
        totalLoans: allLoans.length,
        moraRate,
        totalManaged,
        totalCollected,
        collectionRate,
        payments7Days: payments7d?.length || 0,
        amount7Days,
      });
    }

    performance.sort((a, b) => a.moraRate - b.moraRate);
    return performance;
  } catch (err) {
    console.error('Error in getCollectorPerformance:', err);
    return null;
  }
}

// ============================================================
// CLIENT QUERIES
// ============================================================

/**
 * Get clients with search, zone filter, and pagination
 */
export async function getClients(options: {
  search?: string;
  zoneId?: string;
  page?: number;
  limit?: number;
}): Promise<{ clients: Client[]; pagination: { page: number; limit: number; total: number; totalPages: number } }> {
  const sb = getClient();
  const page = options.page || 1;
  const limit = options.limit || 50;
  const offset = (page - 1) * limit;

  let query = sb
    .from('clients')
    .select(`
      *, zones!zone_id (id, name)
    `, { count: 'exact' });

  if (options.search) {
    query = query.or(`name.ilike.%${options.search}%,dni.ilike.%${options.search}%,phone.ilike.%${options.search}%`);
  }
  if (options.zoneId) {
    query = query.eq('zone_id', options.zoneId);
  }

  query = query.order('created_at', { ascending: false }).range(offset, offset + limit - 1);

  const { data, count, error } = await query;
  if (error) {
    console.error('Supabase query error:', error.message);
    throw new Error(`Supabase query error`); // Let API routes' try-catch handle it
  }

  const clientsRaw = data || [];
  const total = count || 0;

  // Get loans for each client
  const clientIds = clientsRaw.map((c) => c.id);
  let loansByClient: Record<string, Record<string, unknown>[]> = {};
  let guarantorsByClient: Record<string, Record<string, unknown>[]> = {};

  if (clientIds.length > 0) {
    const [loansRes, guarantorsRes] = await Promise.all([
      sb.from('loans').select('id, status, amount, total_amount, amount_paid, client_id').in('client_id', clientIds),
      sb.from('guarantors').select('id, name, phone, client_id').in('client_id', clientIds),
    ]);

    (loansRes.data || []).forEach((l) => {
      if (!loansByClient[l.client_id]) loansByClient[l.client_id] = [];
      loansByClient[l.client_id].push(l);
    });

    (guarantorsRes.data || []).forEach((g) => {
      if (!guarantorsByClient[g.client_id]) guarantorsByClient[g.client_id] = [];
      guarantorsByClient[g.client_id].push(g);
    });
  }

  // Map to camelCase and add stats
  const clients: Client[] = clientsRaw.map((raw) => {
    const mapped = toCamel<Client>(raw as Record<string, unknown>, CLIENT_MAP);
    // Map zone relation
    const zoneData = raw.zones as unknown as { id: string; name: string } | null;
    mapped.zone = zoneData ? { id: zoneData.id, name: zoneData.name } : null;

    // Map loans
    const clientLoans = (loansByClient[raw.id] || []).map((l) => ({
      id: l.id as string,
      status: l.status as string,
      amount: Number(l.amount) || 0,
      totalAmount: Number(l.total_amount) || 0,
      amountPaid: Number(l.amount_paid) || 0,
    }));
    mapped.loans = clientLoans;

    // Map guarantors
    const clientGuarantors = (guarantorsByClient[raw.id] || []).map((g) => ({
      id: g.id as string,
      name: g.name as string,
      phone: (g.phone as string) || null,
    }));
    mapped.guarantors = clientGuarantors;

    // Calculate stats
    const activeLoans = clientLoans.filter((l) => l.status === 'active' || l.status === 'mora');
    const totalLoaned = clientLoans.reduce((s, l) => s + l.amount, 0);
    const totalPaid = clientLoans.reduce((s, l) => s + l.amountPaid, 0);
    const hasMora = clientLoans.some((l) => l.status === 'mora');

    mapped.stats = {
      totalLoans: clientLoans.length,
      activeLoans: activeLoans.length,
      totalLoaned,
      totalPaid,
      hasMora,
    };

    return mapped;
  });

  return {
    clients,
    pagination: {
      page,
      limit,
      total,
      totalPages: Math.ceil(total / limit),
    },
  };
}

/**
 * Create a new client in Supabase
 */
export async function createSupabaseClient(data: {
  name: string;
  documentNumber: string;
  documentType?: string;
  phone: string;
  address?: string;
  zoneId?: string;
  creditScore?: number;
  latitude?: number;
  longitude?: number;
  createdBy?: string;
}): Promise<Client> {
  const sb = getClient();

  // Check for existing document number
  const { data: existing } = await sb.from('clients').select('id').eq('dni', data.documentNumber).limit(1);
  if (existing && existing.length > 0) {
    throw new Error('Ya existe un cliente con ese documento');
  }

  const insertData = toSnake(
    {
      name: data.name,
      documentNumber: data.documentNumber,
      phone: data.phone,
      address: data.address || null,
      zoneId: data.zoneId || null,
      documentType: data.documentType || 'dni',
      creditScore: data.creditScore ?? 50,
      latitude: data.latitude || null,
      longitude: data.longitude || null,
      createdBy: data.createdBy || null,
    } as Record<string, unknown>,
    CLIENT_REVERSE
  );

  const { data: newClient, error } = await sb
    .from('clients')
    .insert(insertData)
    .select('*, zones!zone_id (id, name)')
    .single();

  if (error) {
    console.error('Supabase query error:', error.message);
    throw new Error(`Supabase query error`); // Let API routes' try-catch handle it
  }

  const mapped = toCamel<Client>(newClient as Record<string, unknown>, CLIENT_MAP);
  const zoneData = newClient.zones as unknown as { id: string; name: string } | null;
  mapped.zone = zoneData ? { id: zoneData.id, name: zoneData.name } : null;
  mapped.loans = [];
  mapped.guarantors = [];
  mapped.stats = {
    totalLoans: 0,
    activeLoans: 0,
    totalLoaned: 0,
    totalPaid: 0,
    hasMora: false,
  };

  return mapped;
}

/**
 * Update an existing client
 */
export async function updateClient(
  id: string,
  data: {
    name?: string;
    documentNumber?: string;
    documentType?: string;
    phone?: string;
    address?: string;
    zoneId?: string;
    creditScore?: number;
  }
): Promise<Client> {
  const sb = getClient();

  const updateData: Record<string, unknown> = {};
  if (data.name !== undefined) updateData.name = data.name;
  if (data.documentNumber !== undefined) updateData.documentNumber = data.documentNumber;
  if (data.phone !== undefined) updateData.phone = data.phone;
  if (data.address !== undefined) updateData.address = data.address;
  if (data.zoneId !== undefined) updateData.zoneId = data.zoneId;
  if (data.documentType !== undefined) updateData.documentType = data.documentType;
  if (data.creditScore !== undefined) updateData.creditScore = data.creditScore;

  const snakeData = toSnake(updateData, CLIENT_REVERSE);

  const { data: updated, error } = await sb
    .from('clients')
    .update(snakeData)
    .eq('id', id)
    .select('*, zones!zone_id (id, name)')
    .single();

  if (error) {
    console.error('Supabase query error:', error.message);
    throw new Error(`Supabase query error`); // Let API routes' try-catch handle it
  }

  const mapped = toCamel<Client>(updated as Record<string, unknown>, CLIENT_MAP);
  const zoneData = updated.zones as unknown as { id: string; name: string } | null;
  mapped.zone = zoneData ? { id: zoneData.id, name: zoneData.name } : null;

  return mapped;
}

/**
 * Delete a client (only if no active loans)
 */
export async function deleteClient(id: string): Promise<void> {
  const sb = getClient();

  // Check for active loans
  const { data: activeLoans } = await sb
    .from('loans')
    .select('id')
    .eq('client_id', id)
    .in('status', ['active', 'mora']);

  if (activeLoans && activeLoans.length > 0) {
    throw new Error('No se puede eliminar un cliente con préstamos activos');
  }

  const { error } = await sb.from('clients').delete().eq('id', id);
  if (error) {
    console.error('Supabase query error:', error.message);
    throw new Error(`Supabase query error`); // Let API routes' try-catch handle it
  }
}

// ============================================================
// LOAN QUERIES
// ============================================================

/**
 * Get loans with filters and pagination
 */
export async function getLoans(options: {
  status?: string;
  clientId?: string;
  collectorId?: string;
  zoneId?: string;
  page?: number;
  limit?: number;
}): Promise<{ loans: Loan[]; pagination: { page: number; limit: number; total: number; totalPages: number } }> {
  const sb = getClient();
  const page = options.page || 1;
  const limit = options.limit || 50;
  const offset = (page - 1) * limit;

  let query = sb
    .from('loans')
    .select(`
      *,
      clients!client_id (id, name, dni, document_type, phone, credit_score),
      profiles!collector_id (id, name),
      zones!zone_id (id, name)
    `, { count: 'exact' });

  if (options.status) query = query.eq('status', options.status);
  if (options.clientId) query = query.eq('client_id', options.clientId);
  if (options.collectorId) query = query.eq('collector_id', options.collectorId);
  if (options.zoneId) query = query.eq('zone_id', options.zoneId);

  query = query.order('created_at', { ascending: false }).range(offset, offset + limit - 1);

  const { data, count, error } = await query;
  if (error) {
    console.error('Supabase query error:', error.message);
    throw new Error(`Supabase query error`); // Let API routes' try-catch handle it
  }

  const loansRaw = data || [];
  const total = count || 0;

  // Get related data for each loan
  const loanIds = loansRaw.map((l) => l.id);
  let paymentsByLoan: Record<string, Record<string, unknown>[]> = {};
  let lateFeesByLoan: Record<string, Record<string, unknown>[]> = {};
  let scheduleByLoan: Record<string, Record<string, unknown>[]> = {};

  if (loanIds.length > 0) {
    const [paymentsRes, lateFeesRes, scheduleRes] = await Promise.all([
      sb.from('payments').select('id, loan_id, amount, status, payment_date, payment_method')
        .eq('status', 'completed')
        .in('loan_id', loanIds)
        .order('payment_date', { ascending: false }),
      sb.from('late_fees').select('id, loan_id, status').in('loan_id', loanIds),
      sb.from('payment_schedule').select('id, loan_id, installment_number, amount, due_date, status')
        .in('loan_id', loanIds)
        .order('installment_number', { ascending: true }),
    ]);

    (paymentsRes.data || []).forEach((p) => {
      if (!paymentsByLoan[p.loan_id]) paymentsByLoan[p.loan_id] = [];
      paymentsByLoan[p.loan_id].push(p);
    });

    (lateFeesRes.data || []).forEach((f) => {
      if (!lateFeesByLoan[f.loan_id]) lateFeesByLoan[f.loan_id] = [];
      lateFeesByLoan[f.loan_id].push(f);
    });

    (scheduleRes.data || []).forEach((s) => {
      if (!scheduleByLoan[s.loan_id]) scheduleByLoan[s.loan_id] = [];
      scheduleByLoan[s.loan_id].push(s);
    });
  }

  // Map to camelCase and calculate derived fields
  const loans: Loan[] = loansRaw.map((raw) => {
    const mapped = toCamel<Loan>(raw as Record<string, unknown>, LOAN_MAP);

    // Map client relation
    const clientData = raw.clients as unknown as { id: string; name: string; dni: string; document_type: string; phone: string; credit_score: number | null } | null;
    mapped.client = clientData
      ? { id: clientData.id, name: clientData.name, documentNumber: clientData.dni, documentType: clientData.document_type, phone: clientData.phone, creditScore: clientData.credit_score }
      : null;

    // Map collector relation
    const collectorData = raw.profiles as unknown as { id: string; name: string } | null;
    mapped.collector = collectorData ? { id: collectorData.id, name: collectorData.name } : null;

    // Map zone relation
    const zoneData = raw.zones as unknown as { id: string; name: string } | null;
    mapped.zone = zoneData ? { id: zoneData.id, name: zoneData.name } : null;

    // Map payments (last 5)
    const loanPayments = (paymentsByLoan[raw.id] || [])
      .slice(0, 5)
      .map((p) => toCamel<Payment>(p, PAYMENT_MAP) as Payment);
    mapped.payments = loanPayments;

    // Map late fees
    const loanLateFees = (lateFeesByLoan[raw.id] || [])
      .map((f) => toCamel<LateFee>(f, LATE_FEE_MAP) as LateFee);
    mapped.lateFees = loanLateFees;

    // Map schedule (first 5)
    const loanSchedule = (scheduleByLoan[raw.id] || [])
      .slice(0, 5)
      .map((s) => toCamel<PaymentScheduleEntry>(s, SCHEDULE_MAP) as PaymentScheduleEntry);
    mapped.schedule = loanSchedule;

    // Count pending late fees
    (mapped as Loan & { _pendingLateFeeCount: number })._pendingLateFeeCount =
      loanLateFees.filter((f) => f.status === 'pending').length;

    // Calculate derived fields
    calculateLoanDerived(mapped);

    return mapped;
  });

  return {
    loans,
    pagination: { page, limit, total, totalPages: Math.ceil(total / limit) },
  };
}

/**
 * Create a new loan with gota-a-gota logic
 */
export async function createLoan(data: {
  clientId: string;
  collectorId?: string;
  zoneId?: string;
  amount: number;
  interestRate: number;
  days: number;
  paymentFrequency?: string;
  startDate?: string;
  notes?: string;
  createdBy?: string;
}): Promise<Loan> {
  const sb = getClient();

  if (!data.clientId || !data.amount || !data.interestRate || !data.days) {
    throw new Error('Cliente, monto, tasa de interés y días son requeridos');
  }

  if (data.amount <= 0) {
    throw new Error('El monto debe ser mayor a 0');
  }

  // Check client exists
  const { data: client, error: clientErr } = await sb
    .from('clients')
    .select('id, name, credit_score, zone_id')
    .eq('id', data.clientId)
    .single();

  if (clientErr || !client) {
    throw new Error('Cliente no encontrado');
  }

  // Check if client already has an active loan
  const { data: activeLoans } = await sb
    .from('loans')
    .select('id')
    .eq('client_id', data.clientId)
    .in('status', ['active', 'mora']);

  if (activeLoans && activeLoans.length > 0) {
    throw new Error('El cliente ya tiene un préstamo activo. Debe completar o cancelar el préstamo anterior.');
  }

  // Calculate loan amounts (GOTA A GOTA logic)
  const interestAmount = data.amount * (data.interestRate / 100);
  const totalAmount = data.amount + interestAmount;
  const numCuotas = data.days;
  const dailyPayment = Math.round((totalAmount / numCuotas) * 100) / 100;
  const loanStartDate = data.startDate ? new Date(data.startDate) : new Date();
  const loanEndDate = new Date(loanStartDate.getTime() + data.days * 86400000);

  // Check capital availability from settings table
  let currentCapital = 0;
  const { data: settingsData } = await sb.from('settings').select('capital, id').limit(1);

  if (settingsData && settingsData.length > 0) {
    currentCapital = Number(settingsData[0].capital) || 0;
  } else {
    // Fallback: get from last capital movement
    const { data: lastMov } = await sb
      .from('capital_movements')
      .select('new_capital')
      .order('created_at', { ascending: false })
      .limit(1);
    currentCapital = lastMov && lastMov.length > 0 ? Number(lastMov[0].new_capital) : 0;
  }

  if (currentCapital < data.amount) {
    throw new Error(`Capital insuficiente. Disponible: S/${currentCapital.toFixed(2)}, Necesario: S/${data.amount.toFixed(2)}`);
  }

  // Create loan
  const loanInsert = {
    client_id: data.clientId,
    collector_id: data.collectorId || null,
    zone_id: data.zoneId || client.zone_id || null,
    amount: data.amount,
    total_amount: totalAmount,
    interest: interestAmount,
    days: data.days,
    daily_payment: dailyPayment,
    payment_frequency: data.paymentFrequency || 'daily',
    num_cuotas: numCuotas,
    amount_paid: 0,
    start_date: loanStartDate.toISOString(),
    end_date: loanEndDate.toISOString(),
    status: 'active',
    credit_approved: true,
    notes: data.notes || null,
    created_by: data.createdBy || data.collectorId || null,
  };

  const { data: newLoan, error: loanErr } = await sb
    .from('loans')
    .insert(loanInsert)
    .select(`
      *,
      clients!client_id (id, name, dni, document_type, phone),
      profiles!collector_id (id, name),
      zones!zone_id (id, name)
    `)
    .single();

  if (loanErr) throw new Error(loanErr.message);

  // Create payment schedule entries
  const scheduleEntries = Array.from({ length: numCuotas }, (_, i) => ({
    loan_id: newLoan.id,
    installment_number: i + 1,
    amount: dailyPayment,
    due_date: new Date(loanStartDate.getTime() + (i + 1) * 86400000).toISOString().split('T')[0],
    status: 'pending',
  }));

  const { error: scheduleErr } = await sb.from('payment_schedule').insert(scheduleEntries);
  if (scheduleErr) {
    console.error('Error creating payment schedule:', scheduleErr);
    // Don't fail the loan creation, just log the error
  }

  // Update settings.capital - deduct loan amount
  if (settingsData && settingsData.length > 0) {
    const newCapital = currentCapital - data.amount;
    await sb.from('settings').update({ capital: newCapital }).eq('id', settingsData[0].id);
  }

  // Add capital_movement with type='PRESTAMO'
  const newCapital = currentCapital - data.amount;
  await sb.from('capital_movements').insert({
    type: 'PRESTAMO',
    amount: data.amount,
    previous_capital: currentCapital,
    new_capital: newCapital,
    description: `Préstamo creado para ${client.name} - ${numCuotas} cuotas de S/${dailyPayment}`,
  });

  // Update client credit score (slight decrease for new loan)
  const newCreditScore = Math.max(0, (client.credit_score || 50) - 2);
  await sb.from('clients').update({ credit_score: newCreditScore }).eq('id', data.clientId);

  // Map result
  const mapped = toCamel<Loan>(newLoan as Record<string, unknown>, LOAN_MAP);

  const clientData = newLoan.clients as unknown as { id: string; name: string; dni: string; document_type: string; phone: string } | null;
  mapped.client = clientData ? { id: clientData.id, name: clientData.name, documentNumber: clientData.dni, documentType: clientData.document_type, phone: clientData.phone } : null;

  const collectorData = newLoan.profiles as unknown as { id: string; name: string } | null;
  mapped.collector = collectorData ? { id: collectorData.id, name: collectorData.name } : null;

  const zoneData = newLoan.zones as unknown as { id: string; name: string } | null;
  mapped.zone = zoneData ? { id: zoneData.id, name: zoneData.name } : null;

  // Map schedule
  mapped.schedule = scheduleEntries.map((s, i) => ({
    id: '', // IDs generated by DB
    loanId: newLoan.id,
    installmentNumber: s.installment_number,
    amount: s.amount,
    dueDate: s.due_date,
    status: s.status,
  }));

  calculateLoanDerived(mapped);

  return mapped;
}

/**
 * Update a loan
 */
export async function updateLoan(
  id: string,
  data: {
    status?: string;
    notes?: string;
    collectorId?: string;
  }
): Promise<Loan> {
  const sb = getClient();

  // Get existing loan
  const { data: existing, error: fetchErr } = await sb
    .from('loans')
    .select('*, clients!client_id (id, name)')
    .eq('id', id)
    .single();

  if (fetchErr || !existing) {
    throw new Error('Préstamo no encontrado');
  }

  const updateData: Record<string, unknown> = {};
  if (data.status !== undefined) updateData.status = data.status;
  if (data.notes !== undefined) updateData.notes = data.notes;
  if (data.collectorId !== undefined) updateData.collector_id = data.collectorId;

  // If marking as completed, check if fully paid
  if (data.status === 'completed' && (Number(existing.amount_paid) || 0) < (Number(existing.total_amount) || 0)) {
    throw new Error('No se puede completar un préstamo que no está totalmente pagado');
  }

  // If cancelling, return remaining to capital
  if (data.status === 'cancelled' && existing.status !== 'cancelled') {
    const remaining = (Number(existing.amount) || 0) - (Number(existing.amount_paid) || 0);
    if (remaining > 0) {
      // Get current capital from settings
      const { data: settingsData } = await sb.from('settings').select('capital, id').limit(1);
      let currentCapital = 0;
      let settingsId: string | null = null;
      if (settingsData && settingsData.length > 0) {
        currentCapital = Number(settingsData[0].capital) || 0;
        settingsId = settingsData[0].id;
      }

      const newCapital = currentCapital + remaining;

      if (settingsId) {
        await sb.from('settings').update({ capital: newCapital }).eq('id', settingsId);
      }

      await sb.from('capital_movements').insert({
        type: 'RETIRO',
        amount: remaining,
        previous_capital: currentCapital,
        new_capital: newCapital,
        description: `Préstamo cancelado - reintegro de ${(existing.clients as unknown as { name: string })?.name || 'cliente'}`,
      });
    }

    // Update client credit score (penalty for cancellation)
    const clientId = existing.client_id;
    const { data: clientData } = await sb.from('clients').select('credit_score').eq('id', clientId).single();
    if (clientData) {
      const newScore = Math.max(0, (Number(clientData.credit_score) || 50) - 15);
      await sb.from('clients').update({ credit_score: newScore }).eq('id', clientId);
    }
  }

  // If marking as completed with completion_at
  if (data.status === 'completed') {
    updateData.completed_at = new Date().toISOString();
  }

  const snakeData = toSnake(updateData, LOAN_REVERSE);

  const { data: updated, error: updateErr } = await sb
    .from('loans')
    .update(snakeData)
    .eq('id', id)
    .select(`
      *,
      clients!client_id (id, name, dni, document_type, phone),
      profiles!collector_id (id, name)
    `)
    .single();

  if (updateErr) throw new Error(updateErr.message);

  const mapped = toCamel<Loan>(updated as Record<string, unknown>, LOAN_MAP);

  const clientData = updated.clients as unknown as { id: string; name: string; dni: string; document_type: string; phone: string } | null;
  mapped.client = clientData ? { id: clientData.id, name: clientData.name, documentNumber: clientData.dni, documentType: clientData.document_type, phone: clientData.phone } : null;

  const collectorData = updated.profiles as unknown as { id: string; name: string } | null;
  mapped.collector = collectorData ? { id: collectorData.id, name: collectorData.name } : null;

  calculateLoanDerived(mapped);

  return mapped;
}

// ============================================================
// PAYMENT QUERIES
// ============================================================

/**
 * Get payments with filters and pagination
 */
export async function getPayments(options: {
  loanId?: string;
  clientId?: string;
  collectorId?: string;
  date?: string;
  page?: number;
  limit?: number;
}): Promise<{ payments: Payment[]; pagination: { page: number; limit: number; total: number; totalPages: number } }> {
  const sb = getClient();
  const page = options.page || 1;
  const limit = options.limit || 50;
  const offset = (page - 1) * limit;

  let query = sb
    .from('payments')
    .select(`
      *,
      loans!loan_id (id, clients!client_id (id, name, dni, document_type, phone)),
      profiles!collector_id (id, name)
    `, { count: 'exact' });

  query = query.eq('status', 'completed');
  if (options.loanId) query = query.eq('loan_id', options.loanId);
  if (options.collectorId) query = query.eq('collector_id', options.collectorId);
  if (options.clientId) query = query.eq('client_id', options.clientId);
  if (options.date) {
    query = query.eq('payment_date', options.date);
  }

  query = query.order('payment_date', { ascending: false }).range(offset, offset + limit - 1);

  const { data, count, error } = await query;
  if (error) {
    console.error('Supabase query error:', error.message);
    throw new Error(`Supabase query error`); // Let API routes' try-catch handle it
  }

  const paymentsRaw = data || [];
  const total = count || 0;

  const payments: Payment[] = paymentsRaw.map((raw) => {
    const mapped = toCamel<Payment>(raw as Record<string, unknown>, PAYMENT_MAP);

    // Map loan relation
    const loanData = raw.loans as unknown as {
      id: string;
      clients: { id: string; name: string; dni: string; document_type: string; phone: string } | null;
    } | null;
    if (loanData) {
      mapped.loan = {
        id: loanData.id,
        client: loanData.clients
          ? { id: loanData.clients.id, name: loanData.clients.name, documentNumber: loanData.clients.dni, documentType: loanData.clients.document_type, phone: loanData.clients.phone }
          : null,
      };
    }

    // Map collector relation
    const collectorData = raw.profiles as unknown as { id: string; name: string } | null;
    mapped.collector = collectorData ? { id: collectorData.id, name: collectorData.name } : null;

    return mapped;
  });

  return {
    payments,
    pagination: { page, limit, total, totalPages: Math.ceil(total / limit) },
  };
}

/**
 * Register a payment with auto-update logic
 */
export async function createPayment(data: {
  loanId: string;
  amount: number;
  collectorId?: string;
  paymentMethod?: string;
  observation?: string;
  proofPhoto?: string;
  createdBy?: string;
}): Promise<Payment & { loanStatus: string; loanCompleted: boolean }> {
  const sb = getClient();

  if (!data.loanId || !data.amount) {
    throw new Error('Préstamo y monto son requeridos');
  }

  if (data.amount <= 0) {
    throw new Error('El monto debe ser mayor a 0');
  }

  // Get loan with client info
  const { data: loan, error: loanErr } = await sb
    .from('loans')
    .select('id, client_id, status, amount, total_amount, amount_paid, daily_payment')
    .eq('id', data.loanId)
    .single();

  if (loanErr || !loan) {
    throw new Error('Préstamo no encontrado');
  }

  if (loan.status !== 'active' && loan.status !== 'mora') {
    throw new Error('El préstamo no está activo');
  }

  // Get client info
  const { data: clientData } = await sb
    .from('clients')
    .select('id, name, credit_score')
    .eq('id', loan.client_id)
    .single();

  const remaining = (Number(loan.total_amount) || 0) - (Number(loan.amount_paid) || 0);
  const paymentAmount = Math.min(data.amount, remaining + 1); // Allow small overpayment

  // Create payment record
  const today = new Date();
  const paymentDateStr = today.toISOString().split('T')[0]; // date type for Supabase

  const paymentInsert = {
    loan_id: data.loanId,
    collector_id: data.collectorId || null,
    client_id: loan.client_id,
    amount: paymentAmount,
    interest: 0,
    payment_method: data.paymentMethod || 'cash',
    status: 'completed',
    observation: data.observation || null,
    proof_photo: data.proofPhoto || null,
    payment_date: paymentDateStr,
    created_by: data.createdBy || data.collectorId || null,
  };

  const { data: newPayment, error: payErr } = await sb
    .from('payments')
    .insert(paymentInsert)
    .select(`
      *,
      loans!loan_id (id, clients!client_id (id, name, dni, document_type, phone)),
      profiles!collector_id (id, name)
    `)
    .single();

  if (payErr) throw new Error(payErr.message);

  // Update loan's amount_paid
  const newAmountPaid = (Number(loan.amount_paid) || 0) + paymentAmount;
  const newStatus = newAmountPaid >= (Number(loan.total_amount) || 0) ? 'completed' : loan.status;

  const loanUpdate: Record<string, unknown> = {
    amount_paid: newAmountPaid,
    status: newStatus,
  };
  if (newStatus === 'completed') {
    loanUpdate.completed_at = new Date().toISOString();
  }

  await sb.from('loans').update(loanUpdate).eq('id', data.loanId);

  // If loan completed
  if (newStatus === 'completed') {
    // Mark all remaining schedule entries as paid
    await sb
      .from('payment_schedule')
      .update({ status: 'paid' })
      .eq('loan_id', data.loanId)
      .eq('status', 'pending');

    // Increase client credit score
    if (clientData) {
      const newScore = Math.min(100, (Number(clientData.credit_score) || 50) + 10);
      await sb.from('clients').update({ credit_score: newScore }).eq('id', loan.client_id);
    }

    // Return capital + interest to capital (update settings table)
    const { data: settingsData } = await sb.from('settings').select('capital, id').limit(1);
    let currentCapital = 0;
    let settingsId: string | null = null;
    if (settingsData && settingsData.length > 0) {
      currentCapital = Number(settingsData[0].capital) || 0;
      settingsId = settingsData[0].id;
    }

    const newCapital = currentCapital + paymentAmount;
    if (settingsId) {
      await sb.from('settings').update({ capital: newCapital }).eq('id', settingsId);
    }

    await sb.from('capital_movements').insert({
      type: 'RETIRO',
      amount: paymentAmount,
      previous_capital: currentCapital,
      new_capital: newCapital,
      description: `Pago final - Préstamo completado de ${clientData?.name || 'cliente'}`,
    });
  } else if (loan.status === 'mora' && clientData) {
    // If it was in mora and a payment is made, increase credit score slightly
    const newScore = Math.min(100, (Number(clientData.credit_score) || 50) + 2);
    await sb.from('clients').update({ credit_score: newScore }).eq('id', loan.client_id);
  }

  // Mark the next pending payment_schedule entry as paid
  const { data: nextSchedule } = await sb
    .from('payment_schedule')
    .select('id')
    .eq('loan_id', data.loanId)
    .eq('status', 'pending')
    .order('installment_number', { ascending: true })
    .limit(1);

  if (nextSchedule && nextSchedule.length > 0) {
    await sb.from('payment_schedule').update({ status: 'paid' }).eq('id', nextSchedule[0].id);
  }

  // Map payment result
  const mapped = toCamel<Payment>(newPayment as Record<string, unknown>, PAYMENT_MAP);

  const loanRelData = newPayment.loans as unknown as {
    id: string;
    clients: { id: string; name: string; dni: string; document_type: string; phone: string } | null;
  } | null;
  if (loanRelData) {
    mapped.loan = {
      id: loanRelData.id,
      client: loanRelData.clients
        ? { id: loanRelData.clients.id, name: loanRelData.clients.name, documentNumber: loanRelData.clients.dni, documentType: loanRelData.clients.document_type, phone: loanRelData.clients.phone }
        : null,
    };
  }

  const collectorData = newPayment.profiles as unknown as { id: string; name: string } | null;
  mapped.collector = collectorData ? { id: collectorData.id, name: collectorData.name } : null;

  return {
    ...mapped,
    loanStatus: newStatus,
    loanCompleted: newStatus === 'completed',
  };
}

// ============================================================
// CAPITAL QUERIES
// ============================================================

/**
 * Get capital history with summary and pagination
 */
export async function getCapitalHistory(options: {
  page?: number;
  limit?: number;
}): Promise<{
  currentCapital: number;
  summary: {
    totalInjections: number;
    totalWithdrawals: number;
    totalLoansOut: number;
    activeLoansOut: number;
  };
  movements: CapitalMovement[];
  pagination: { page: number; limit: number; total: number; totalPages: number };
}> {
  const sb = getClient();
  const page = options.page || 1;
  const limit = options.limit || 30;
  const offset = (page - 1) * limit;

  // Get current capital from settings
  let currentCapital = 0;
  const { data: settingsData } = await sb.from('settings').select('capital').limit(1);
  if (settingsData && settingsData.length > 0) {
    currentCapital = Number(settingsData[0].capital) || 0;
  } else {
    // Fallback
    const { data: lastMov } = await sb
      .from('capital_movements')
      .select('new_capital')
      .order('created_at', { ascending: false })
      .limit(1);
    currentCapital = lastMov && lastMov.length > 0 ? Number(lastMov[0].new_capital) : 0;
  }

  // Get movements with pagination
  const { data: movementsRaw, count, error } = await sb
    .from('capital_movements')
    .select('*', { count: 'exact' })
    .order('created_at', { ascending: false })
    .range(offset, offset + limit - 1);

  if (error) {
    console.error('Supabase query error:', error.message);
    throw new Error(`Supabase query error`); // Let API routes' try-catch handle it
  }

  // Summary calculations
  const { data: injections } = await sb.from('capital_movements').select('amount').eq('type', 'INYECCION');
  const { data: withdrawals } = await sb.from('capital_movements').select('amount').eq('type', 'RETIRO');
  const { data: loans } = await sb.from('capital_movements').select('amount').eq('type', 'PRESTAMO');
  const { data: activeLoans } = await sb.from('loans').select('amount').in('status', ['active', 'mora']);

  const movements = toCamelList<CapitalMovement>(movementsRaw as Record<string, unknown>[], CAPITAL_MOVEMENT_MAP);

  return {
    currentCapital,
    summary: {
      totalInjections: (injections || []).reduce((s, m) => s + (Number(m.amount) || 0), 0),
      totalWithdrawals: (withdrawals || []).reduce((s, m) => s + (Number(m.amount) || 0), 0),
      totalLoansOut: (loans || []).reduce((s, m) => s + (Number(m.amount) || 0), 0),
      activeLoansOut: (activeLoans || []).reduce((s, l) => s + (Number(l.amount) || 0), 0),
    },
    movements,
    pagination: {
      page,
      limit,
      total: count || 0,
      totalPages: Math.ceil((count || 0) / limit),
    },
  };
}

/**
 * Create a capital movement (INYECCION or RETIRO)
 */
export async function createCapitalMovement(data: {
  type: 'INYECCION' | 'RETIRO';
  amount: number;
  description?: string;
}): Promise<CapitalMovement> {
  const sb = getClient();

  if (!data.type || !data.amount) {
    throw new Error('Tipo y monto son requeridos');
  }

  if (!['INYECCION', 'RETIRO'].includes(data.type)) {
    throw new Error('Tipo debe ser INYECCION o RETIRO');
  }

  if (data.amount <= 0) {
    throw new Error('El monto debe ser mayor a 0');
  }

  // Get current capital from settings
  let previousCapital = 0;
  let settingsId: string | null = null;
  const { data: settingsData } = await sb.from('settings').select('capital, id').limit(1);
  if (settingsData && settingsData.length > 0) {
    previousCapital = Number(settingsData[0].capital) || 0;
    settingsId = settingsData[0].id;
  } else {
    // Fallback
    const { data: lastMov } = await sb
      .from('capital_movements')
      .select('new_capital')
      .order('created_at', { ascending: false })
      .limit(1);
    previousCapital = lastMov && lastMov.length > 0 ? Number(lastMov[0].new_capital) : 0;
  }

  let newCapital: number;
  if (data.type === 'INYECCION') {
    newCapital = previousCapital + data.amount;
  } else {
    if (data.amount > previousCapital) {
      throw new Error(`Capital insuficiente. Disponible: S/${previousCapital.toFixed(2)}`);
    }
    newCapital = previousCapital - data.amount;
  }

  // Create movement
  const { data: movement, error } = await sb
    .from('capital_movements')
    .insert({
      type: data.type,
      amount: data.amount,
      previous_capital: previousCapital,
      new_capital: newCapital,
      description: data.description || `${data.type === 'INYECCION' ? 'Inyección' : 'Retiro'} de capital: S/${data.amount}`,
    })
    .select()
    .single();

  if (error) {
    console.error('Supabase query error:', error.message);
    throw new Error(`Supabase query error`); // Let API routes' try-catch handle it
  }

  // Update settings.capital
  if (settingsId) {
    await sb.from('settings').update({ capital: newCapital }).eq('id', settingsId);
  }

  return toCamel<CapitalMovement>(movement as Record<string, unknown>, CAPITAL_MOVEMENT_MAP);
}

// ============================================================
// ZONE QUERIES
// ============================================================

/**
 * Get all zones with stats
 */
export async function getZones(): Promise<Zone[]> {
  const sb = getClient();

  const { data: zonesRaw, error } = await sb
    .from('zones')
    .select('*')
    .order('name', { ascending: true });

  if (error) {
    console.error('Supabase query error:', error.message);
    throw new Error(`Supabase query error`); // Let API routes' try-catch handle it
  }

  const zones: Zone[] = [];

  for (const raw of zonesRaw || []) {
    const mapped = toCamel<Zone>(raw as Record<string, unknown>, ZONE_MAP);

    // Get zone stats
    const { data: clients } = await sb.from('clients').select('id').eq('zone_id', raw.id);
    const { data: loans } = await sb.from('loans').select('id, status, amount').eq('zone_id', raw.id);

    const activeLoans = (loans || []).filter((l) => l.status === 'active' || l.status === 'mora');
    const moraLoans = (loans || []).filter((l) => l.status === 'mora');
    const totalLoaned = (loans || []).reduce((s, l) => s + (Number(l.amount) || 0), 0);

    mapped.stats = {
      totalClients: clients?.length || 0,
      totalLoans: loans?.length || 0,
      activeLoans: activeLoans.length,
      totalLoaned,
      moraLoans: moraLoans.length,
    };

    zones.push(mapped);
  }

  return zones;
}

/**
 * Create a new zone
 */
export async function createZone(name: string): Promise<Zone | null> {
  const sb = getSupabaseServerClient();
  if (!sb) return null;

  if (!name) {
    throw new Error('Nombre es requerido');
  }

  try {
    const { data: zone, error } = await sb
      .from('zones')
      .insert({ name })
      .select()
      .single();

    if (error) {
      console.error('Supabase createZone error:', error.message);
      return null; // Return null to fall back to Prisma
    }

    const mapped = toCamel<Zone>(zone as Record<string, unknown>, ZONE_MAP);
    mapped.stats = {
      totalClients: 0,
      totalLoans: 0,
      activeLoans: 0,
      totalLoaned: 0,
      moraLoans: 0,
    };

    return mapped;
  } catch (err) {
    console.error('Supabase createZone failed:', err);
    return null; // Return null to fall back to Prisma
  }
}

// ============================================================
// COLLECTOR QUERIES
// ============================================================

/**
 * Get all collectors (profiles with collector/supervisor/admin roles)
 * Returns empty array if Supabase is not configured or on error
 */
export async function getCollectors(): Promise<Collector[]> {
  const sb = getSupabaseServerClient();
  if (!sb) return [];

  try {
    const { data: collectorsRaw, error } = await sb
      .from('profiles')
      .select('id, name, email, phone, role, is_active')
      .in('role', ['collector', 'supervisor', 'admin'])
      .order('name', { ascending: true });

    if (error) {
    console.error('Supabase query error:', error.message);
    throw new Error(`Supabase query error`); // Let API routes' try-catch handle it
  }

    const collectors: Collector[] = [];

    for (const raw of collectorsRaw || []) {
      const mapped = toCamel<Collector>(raw as Record<string, unknown>, COLLECTOR_MAP);

      // Get loan and payment counts
      const [loanRes, paymentRes] = await Promise.all([
        sb.from('loans').select('id', { count: 'exact', head: true }).eq('collector_id', raw.id),
        sb.from('payments').select('id', { count: 'exact', head: true }).eq('collector_id', raw.id),
      ]);

      mapped.loanCount = loanRes.count || 0;
      mapped.paymentCount = paymentRes.count || 0;

      collectors.push(mapped);
    }

    return collectors;
  } catch (err) {
    console.error('Error in getCollectors:', err);
    return [];
  }
}

/**
 * Create a new collector in Supabase profiles table
 * Returns null if Supabase is not configured or on error
 */
export async function createCollector(data: Record<string, unknown>): Promise<Collector | null> {
  const sb = getSupabaseServerClient();
  if (!sb) return null;

  try {
    const snakeData = toSnake(data, buildReverseMap(COLLECTOR_MAP));
    const { data: result, error } = await sb
      .from('profiles')
      .insert(snakeData)
      .select()
      .single();

    if (error) {
      console.error('Supabase createCollector error:', error.message);
      return null; // Return null to fall back to Prisma
    }

    return toCamel<Collector>(result as Record<string, unknown>, COLLECTOR_MAP);
  } catch (err) {
    console.error('Error in createCollector:', err);
    return null;
  }
}

/**
 * Get collector current locations
 */
export async function getCollectorLocations(): Promise<CollectorLocation[]> {
  const sb = getClient();

  const { data: locationsRaw, error } = await sb
    .from('collector_current_location')
    .select('*');

  if (error) {
    console.error('Supabase query error:', error.message);
    throw new Error(`Supabase query error`); // Let API routes' try-catch handle it
  }

  const locations: CollectorLocation[] = [];

  for (const raw of locationsRaw || []) {
    const mapped = toCamel<CollectorLocation>(raw as Record<string, unknown>, COLLECTOR_LOCATION_MAP);

    // Get collector name
    const { data: collector } = await sb
      .from('profiles')
      .select('id, name')
      .eq('id', raw.collector_id)
      .single();

    mapped.collector = collector ? { id: collector.id, name: collector.name } : null;

    locations.push(mapped);
  }

  return locations;
}
