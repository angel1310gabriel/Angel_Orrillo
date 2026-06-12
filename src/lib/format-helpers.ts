// ============================================================
// Shared Formatting Helpers for KC Cobranzas
// ============================================================

export const formatCurrency = (amount: number) =>
  `S/${amount.toLocaleString('es-PE', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

export const formatDate = (dateStr: string) => {
  const date = new Date(dateStr);
  return date.toLocaleDateString('es-PE', { day: '2-digit', month: 'short', year: 'numeric' });
};

export const formatDateTime = (dateStr: string) => {
  const date = new Date(dateStr);
  return date.toLocaleDateString('es-PE', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' });
};

export const getRiskBadge = (level: string) => {
  switch (level) {
    case 'low': return 'bg-emerald-100 text-emerald-800 border-emerald-200';
    case 'medium': return 'bg-amber-100 text-amber-800 border-amber-200';
    case 'high': return 'bg-orange-100 text-orange-800 border-orange-200';
    case 'critical': return 'bg-red-100 text-red-800 border-red-200';
    default: return 'bg-gray-100 text-gray-800 border-gray-200';
  }
};

export const getRiskLabel = (level: string) => {
  switch (level) {
    case 'low': return 'Bajo';
    case 'medium': return 'Medio';
    case 'high': return 'Alto';
    case 'critical': return 'Crítico';
    default: return level;
  }
};

export const CHART_COLORS = ['#10b981', '#f59e0b', '#ef4444', '#8b5cf6', '#06b6d4', '#ec4899'];

export const PAYMENT_METHOD_LABELS: Record<string, string> = {
  cash: 'Efectivo',
  yape: 'Yape',
  plin: 'Plin',
  transfer: 'Transferencia',
  lukita: 'Lukita',
};
