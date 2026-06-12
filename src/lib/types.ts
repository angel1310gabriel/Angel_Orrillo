// ============================================================
// Shared Types for KC Cobranzas
// ============================================================

export interface AuditLog {
  id: string;
  userId: string | null;
  action: string;
  entityType: string;
  entityId: string | null;
  entityName: string | null;
  changes: string | null;
  severity: string;
  notes: string | null;
  createdAt: string;
  user: { id: string; name: string | null; email: string; role: string } | null;
}

export interface AuditStats {
  byAction: { action: string; count: number }[];
  bySeverity: { severity: string; count: number }[];
  byEntityType: { entityType: string; count: number }[];
}

export interface LateFeeExecution {
  id: string;
  executionDate: string;
  loansProcessed: number;
  feesGenerated: number;
  totalFeeAmount: number;
  loansMovedToMora: number;
  status: string;
  errorMessage: string | null;
  executionTimeMs: number;
  triggeredBy: string;
  createdAt: string;
}

export interface MoraStatus {
  lastExecution: LateFeeExecution | null;
  loansInPotentialMora: number;
  totalMoraLoans: number;
  totalPendingFees: number;
  totalPendingFeeAmount: number;
  moraLoans: {
    id: string;
    clientName: string;
    amount: number;
    totalAmount: number;
    amountPaid: number;
    daysOverdue: number;
    creditScore: number | null;
    pendingFees: number;
  }[];
}

export interface LateFeeConfig {
  lateFeeRatePerDay: number;
  lateFeeEnabled: boolean;
  moraThresholdDays: number;
  autoMoraEnabled: boolean;
}

export interface OverviewData {
  loans: { total: number; active: number; mora: number; completed: number; cancelled: number };
  financials: { totalLoaned: number; totalExpected: number; totalCollected: number; totalInterest: number; moraOutstanding: number };
  payments: { total: number; last7Days: number; last30Days: number; amountLast30Days: number };
  clients: { total: number; withActiveLoans: number; inMora: number; avgCreditScore: number };
  lateFees: { pending: number; paid: number; waived: number };
  capital: { current: number };
  rates: { moraRate: number; collectionEfficiency: number };
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

export interface TrendData {
  dailyPayments: { date: string; amount: number; count: number }[];
  weeklyActions: { week: string; moraChanges: number; loanCreations: number }[];
  paymentMethods: { method: string; count: number; amount: number }[];
  zoneMora: { zone: string; totalLoans: number; moraLoans: number; moraAmount: number; moraRate: number }[];
}
