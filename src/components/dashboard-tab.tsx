'use client';

import { useState, useEffect, useCallback } from 'react';
import {
  TrendingUp, DollarSign, Users, AlertTriangle,
  Activity, BarChart3, Wallet, ArrowUp, ArrowDown,
  RefreshCw,
} from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Loader2 } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';

type Overview = {
  totalLoaned: number; totalCollected: number; totalInterest: number;
  activeLoans: number; moraLoans: number; completedLoans: number;
};
type RecentPayment = { date: string; amount: number };
type PaymentMethod = { method: string; amount: number; count: number };
type TopClient = { name: string; totalLoaned: number; totalPaid: number };
type Analytics = {
  overview: Overview; recentPayments: RecentPayment[];
  paymentMethods: PaymentMethod[]; topClients: TopClient[];
};

const maxVal = (arr: { amount: number }[]) =>
  Math.max(...arr.map((d) => d.amount), 1);

const colors = ['#10b981', '#f59e0b', '#8b5cf6', '#ef4444'];

const kpiConfig = [
  { key: 'totalLoaned', label: 'Total Prestado', icon: DollarSign, gradient: 'from-emerald-500 to-emerald-600', bgLight: 'bg-emerald-50 dark:bg-emerald-950/30', iconBg: 'bg-emerald-100 dark:bg-emerald-900/50' },
  { key: 'totalCollected', label: 'Total Cobrado', icon: Wallet, gradient: 'from-teal-500 to-teal-600', bgLight: 'bg-teal-50 dark:bg-teal-950/30', iconBg: 'bg-teal-100 dark:bg-teal-900/50' },
  { key: 'moraLoans', label: 'En Mora', icon: AlertTriangle, gradient: 'from-amber-500 to-orange-500', bgLight: 'bg-amber-50 dark:bg-amber-950/30', iconBg: 'bg-amber-100 dark:bg-amber-900/50' },
  { key: 'efficiency', label: 'Tasa Eficiencia', icon: TrendingUp, gradient: 'from-blue-500 to-blue-600', bgLight: 'bg-blue-50 dark:bg-blue-950/30', iconBg: 'bg-blue-100 dark:bg-blue-900/50' },
];

const formatVal = (v: number) => {
  if (v >= 1000000) return `S/ ${(v / 1000000).toFixed(1)}M`;
  if (v >= 1000) return `S/ ${(v / 1000).toFixed(1)}k`;
  return `S/ ${v.toFixed(2)}`;
};

export default function DashboardTab() {
  const { toast } = useToast();
  const [data, setData] = useState<Analytics | null>(null);
  const [loading, setLoading] = useState(true);

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/analytics');
      if (!res.ok) throw new Error('Failed');
      setData(await res.json());
    } catch {
      toast({ title: 'Error', description: 'No se pudo cargar el dashboard', variant: 'destructive' });
    } finally {
      setLoading(false);
    }
  }, [toast]);

  useEffect(() => { fetchData(); }, [fetchData]);

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <div className="flex items-center gap-3 px-5 py-3 rounded-xl bg-white dark:bg-slate-900 shadow-sm border border-slate-100 dark:border-slate-800">
          <Loader2 className="h-5 w-5 animate-spin text-emerald-500" />
          <span className="text-sm text-slate-500">Cargando dashboard...</span>
        </div>
      </div>
    );
  }

  const o = data?.overview;
  const efficiency = o?.totalLoaned && o?.totalCollected
    ? Math.min(100, Math.round((o.totalCollected / o.totalLoaned) * 100))
    : 0;

  const getKpiValue = (key: string) => {
    if (key === 'efficiency') return efficiency;
    if (key === 'totalLoaned') return o?.totalLoaned ?? 0;
    if (key === 'totalCollected') return o?.totalCollected ?? 0;
    if (key === 'moraLoans') return o?.moraLoans ?? 0;
    return 0;
  };

  const maxPay = maxVal(data?.recentPayments ?? []);
  const totalMethodCount = (data?.paymentMethods ?? []).reduce((s, m) => s + m.count, 0);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 dark:text-slate-100 tracking-tight">Panel General</h1>
          <p className="text-sm text-slate-500 dark:text-slate-400 mt-0.5">Resumen de operaciones</p>
        </div>
        <button
          onClick={fetchData}
          className="inline-flex items-center gap-2 rounded-xl bg-emerald-600 px-4 py-2.5 text-sm font-medium text-white hover:bg-emerald-700 transition-all shadow-lg shadow-emerald-600/25 hover:shadow-emerald-600/40"
        >
          <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
          Actualizar
        </button>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {kpiConfig.map((k) => {
          const Icon = k.icon;
          const val = getKpiValue(k.key);
          return (
            <Card key={k.key} className="border-0 shadow-lg overflow-hidden">
              <div className={`bg-gradient-to-br ${k.gradient} p-4 text-white relative`}>
                <div className="flex items-start justify-between">
                  <div className="space-y-1">
                    <p className="text-white/70 text-xs font-medium uppercase tracking-wide">{k.label}</p>
                    <p className="text-2xl font-bold tracking-tight">
                      {k.key === 'efficiency' ? `${val}%` : k.key === 'moraLoans' ? val : formatVal(val)}
                    </p>
                  </div>
                  <div className="w-10 h-10 rounded-xl bg-white/15 backdrop-blur-sm border border-white/20 flex items-center justify-center shadow-lg shrink-0">
                    <Icon className="h-5 w-5 text-white" />
                  </div>
                </div>
              </div>
            </Card>
          );
        })}
      </div>

      {/* Charts Row */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Payment Chart */}
        <Card className="shadow-lg border-0">
          <CardContent className="p-5">
            <div className="flex items-center justify-between mb-5">
              <div className="flex items-center gap-2.5">
                <div className="w-9 h-9 rounded-xl bg-emerald-100 dark:bg-emerald-900/50 flex items-center justify-center">
                  <Activity className="h-5 w-5 text-emerald-600 dark:text-emerald-300" />
                </div>
                <div>
                  <h3 className="font-semibold text-sm text-slate-800 dark:text-slate-200">Pagos Últimos 7 Días</h3>
                  <p className="text-[10px] text-slate-400">Evolución diaria de cobranza</p>
                </div>
              </div>
              <Badge variant="outline" className="bg-emerald-50 dark:bg-emerald-950 text-emerald-700 dark:text-emerald-300 border-emerald-200 dark:border-emerald-800 text-[10px]">
                {data?.recentPayments?.length || 0} registros
              </Badge>
            </div>
            <div className="flex items-end gap-2 h-40">
              {(data?.recentPayments ?? []).map((p) => (
                <div key={p.date} className="flex-1 flex flex-col items-center gap-1.5 group">
                  <span className="text-[10px] text-slate-400 opacity-0 group-hover:opacity-100 transition-opacity">
                    {formatVal(p.amount)}
                  </span>
                  <div
                    className="w-full bg-gradient-to-t from-emerald-500 to-emerald-400 rounded-t-lg transition-all duration-300 hover:from-emerald-600 hover:to-emerald-500 cursor-pointer"
                    style={{ height: `${(p.amount / maxPay) * 100}%`, minHeight: 4 }}
                  />
                  <span className="text-[10px] text-slate-400">
                    {new Date(p.date).toLocaleDateString('es-PE', { weekday: 'short' }).slice(0, 3)}
                  </span>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

        {/* Payment Methods */}
        <Card className="shadow-lg border-0">
          <CardContent className="p-5">
            <div className="flex items-center justify-between mb-5">
              <div className="flex items-center gap-2.5">
                <div className="w-9 h-9 rounded-xl bg-teal-100 dark:bg-teal-900/50 flex items-center justify-center">
                  <Wallet className="h-5 w-5 text-teal-600 dark:text-teal-300" />
                </div>
                <div>
                  <h3 className="font-semibold text-sm text-slate-800 dark:text-slate-200">Métodos de Pago</h3>
                  <p className="text-[10px] text-slate-400">Distribución de cobros</p>
                </div>
              </div>
            </div>
            <div className="flex items-center gap-1 h-8 mb-5 rounded-lg overflow-hidden">
              {(data?.paymentMethods ?? []).map((m, i) => (
                <div
                  key={m.method}
                  className="h-full transition-all duration-300 hover:opacity-80"
                  style={{
                    flex: m.count,
                    backgroundColor: colors[i % colors.length],
                  }}
                  title={`${m.method}: ${m.count} pagos`}
                />
              ))}
            </div>
            <div className="grid grid-cols-2 gap-2.5">
              {(data?.paymentMethods ?? []).map((m, i) => (
                <div key={m.method} className="flex items-center gap-2.5 p-2 rounded-lg bg-slate-50 dark:bg-slate-800/30">
                  <span className="w-3 h-3 rounded-full" style={{ backgroundColor: colors[i % colors.length] }} />
                  <div className="flex-1 min-w-0">
                    <p className="text-xs text-slate-600 dark:text-slate-400 truncate">{m.method}</p>
                    <div className="flex items-center gap-1.5">
                      <div className="flex-1 h-1.5 bg-slate-200 dark:bg-slate-700 rounded-full overflow-hidden">
                        <div
                          className="h-full rounded-full transition-all"
                          style={{
                            width: `${totalMethodCount ? Math.round((m.count / totalMethodCount) * 100) : 0}%`,
                            backgroundColor: colors[i % colors.length],
                          }}
                        />
                      </div>
                      <span className="text-[10px] font-medium text-slate-500 dark:text-slate-400">
                        {totalMethodCount ? Math.round((m.count / totalMethodCount) * 100) : 0}%
                      </span>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Top Clients */}
      {data?.topClients && data.topClients.length > 0 && (
        <Card className="shadow-lg border-0">
          <CardContent className="p-5">
            <div className="flex items-center justify-between mb-5">
              <div className="flex items-center gap-2.5">
                <div className="w-9 h-9 rounded-xl bg-blue-100 dark:bg-blue-900/50 flex items-center justify-center">
                  <Users className="h-5 w-5 text-blue-600 dark:text-blue-300" />
                </div>
                <div>
                  <h3 className="font-semibold text-sm text-slate-800 dark:text-slate-200">Top Clientes</h3>
                  <p className="text-[10px] text-slate-400">Mejores prestatarios</p>
                </div>
              </div>
            </div>
            <div className="space-y-3">
              {data.topClients.slice(0, 5).map((c, i) => {
                const pct = c.totalLoaned ? Math.round((c.totalPaid / c.totalLoaned) * 100) : 0;
                return (
                  <div key={c.name} className="flex items-center gap-3 p-2.5 rounded-xl hover:bg-slate-50 dark:hover:bg-slate-800/30 transition-colors">
                    <div className={`w-8 h-8 rounded-xl flex items-center justify-center text-xs font-bold shrink-0 ${i === 0 ? 'bg-amber-100 dark:bg-amber-900/50 text-amber-600 dark:text-amber-300' : 'bg-slate-100 dark:bg-slate-800 text-slate-500 dark:text-slate-400'}`}>
                      {i + 1}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-slate-800 dark:text-slate-200 truncate">{c.name}</p>
                      <div className="flex items-center gap-2 mt-1.5">
                        <div className="flex-1 h-2 bg-slate-100 dark:bg-slate-800 rounded-full overflow-hidden">
                          <div
                            className="h-full bg-gradient-to-r from-emerald-500 to-emerald-400 rounded-full transition-all"
                            style={{ width: `${pct}%` }}
                          />
                        </div>
                        <span className="text-xs font-medium text-slate-500 dark:text-slate-400 shrink-0">{pct}%</span>
                      </div>
                    </div>
                    <div className="text-right shrink-0">
                      <p className="text-sm font-semibold text-slate-800 dark:text-slate-200">S/ {(c.totalLoaned ?? 0).toLocaleString('es-PE')}</p>
                      <p className="text-[10px] text-slate-400">
                        Pagado: S/ {(c.totalPaid ?? 0).toLocaleString('es-PE')}
                      </p>
                    </div>
                  </div>
                );
              })}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
