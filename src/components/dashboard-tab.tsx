'use client';

import { useState, useEffect, useCallback } from 'react';
import {
  TrendingUp, DollarSign, Users, AlertTriangle,
  Activity, BarChart3, Wallet, ArrowUp, ArrowDown,
  RefreshCw, Building2, Target, PiggyBank,
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

const formatVal = (v: number) => {
  if (v >= 1000000) return `S/ ${(v / 1000000).toFixed(1)}M`;
  if (v >= 1000) return `S/ ${(v / 1000).toFixed(1)}k`;
  return `S/ ${v.toFixed(2)}`;
};

export default function DashboardTab() {
  const { toast } = useToast();
  const [data, setData] = useState<Analytics | null>(null);
  const [loading, setLoading] = useState(false);

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/analytics');
      if (!res.ok) throw new Error('Failed');
      setData(await res.json());
    } catch {}
    setLoading(false);
  }, []);

  useEffect(() => { fetchData(); }, [fetchData]);

  const o = data?.overview;
  const efficiency = o?.totalLoaned && o?.totalCollected
    ? Math.min(100, Math.round((o.totalCollected / o.totalLoaned) * 100))
    : 0;

  const kpiData = [
    { key: 'totalLoaned', label: 'Total Prestado', value: formatVal(o?.totalLoaned ?? 0), icon: DollarSign, gradient: 'from-emerald-500 to-emerald-600', subtitle: 'Capital en circulación' },
    { key: 'totalCollected', label: 'Total Cobrado', value: formatVal(o?.totalCollected ?? 0), icon: Wallet, gradient: 'from-teal-500 to-teal-600', subtitle: 'Ingresos recibidos' },
    { key: 'moraLoans', label: 'En Mora', value: o?.moraLoans?.toString() ?? '0', icon: AlertTriangle, gradient: 'from-amber-500 to-orange-500', subtitle: 'Préstamos vencidos' },
    { key: 'efficiency', label: 'Tasa de Eficiencia', value: `${efficiency}%`, icon: Target, gradient: 'from-blue-500 to-blue-600', subtitle: 'Cobrado / Prestado' },
  ];

  const activeLoans = o?.activeLoans ?? 0;
  const completedLoans = o?.completedLoans ?? 0;

  const maxPay = maxVal(data?.recentPayments ?? []);
  const totalMethodCount = (data?.paymentMethods ?? []).reduce((s, m) => s + m.count, 0);

  return (
    <div className="space-y-6">
      {/* Animated Background */}
      <div className="absolute inset-0 pointer-events-none overflow-hidden -z-10">
        <div
          className="absolute w-[700px] h-[700px] -top-20 -left-20 rounded-full opacity-[0.03]"
          style={{
            background: 'radial-gradient(circle, #10b981 0%, transparent 70%)',
            animation: 'drift 20s ease-in-out infinite',
          }}
        />
        <div
          className="absolute w-[500px] h-[500px] -bottom-10 -right-10 rounded-full opacity-[0.03]"
          style={{
            background: 'radial-gradient(circle, #14b8a6 0%, transparent 70%)',
            animation: 'drift 25s ease-in-out infinite reverse',
          }}
        />
        <div
          className="absolute w-[400px] h-[400px] top-1/3 left-1/2 rounded-full opacity-[0.02]"
          style={{
            background: 'radial-gradient(circle, #3b82f6 0%, transparent 70%)',
            animation: 'drift 18s ease-in-out infinite 5s',
          }}
        />
      </div>

      {/* Header */}
      <div className="flex items-center justify-between relative" style={{ animation: 'fadeUp 0.5s ease-out both' }}>
        <div>
          <h1 className="text-2xl font-bold text-foreground dark:text-foreground tracking-tight">Panel General</h1>
          <p className="text-sm text-muted-foreground dark:text-muted-foreground mt-0.5">Resumen general de operaciones financieras</p>
        </div>
        <button
          onClick={fetchData}
          className="inline-flex items-center gap-2 rounded-xl bg-gradient-to-r from-emerald-600 to-teal-600 px-4 py-2.5 text-sm font-semibold text-white hover:from-emerald-700 hover:to-teal-700 transition-all shadow-lg shadow-emerald-600/25 hover:shadow-emerald-600/40"
        >
          <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
          Actualizar
        </button>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        {kpiData.map((k, i) => {
          const Icon = k.icon;
          return (
            <div key={k.key} className="group relative overflow-hidden rounded-xl glass-panel shadow-lg hover:shadow-xl transition-all duration-500 hover:-translate-y-0.5" style={{ animation: `fadeUp 0.5s ease-out ${i * 0.1}s both` }}>
              <div className={`absolute inset-0 bg-gradient-to-br ${k.gradient} opacity-90`} />
              <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top_right,_rgba(255,255,255,0.2),_transparent_50%)]" />
              <div className="relative p-3 sm:p-4">
                <div className="flex items-start justify-between mb-2">
                  <div className="w-8 h-8 rounded-lg bg-white/20 backdrop-blur-sm border border-white/20 flex items-center justify-center group-hover:scale-110 transition-transform duration-300">
                    <Icon className="h-4 w-4 text-white" />
                  </div>
                  {k.key === 'moraLoans' && parseInt(k.value) > 0 && (
                    <span className="px-1.5 py-0.5 rounded-full bg-white/20 text-[9px] font-semibold text-white animate-pulse">Urgente</span>
                  )}
                </div>
                <p className="text-white/70 text-[10px] font-medium uppercase tracking-wider">{k.label}</p>
                <p className="text-xl sm:text-2xl font-bold text-white mt-0.5 tracking-tight">{k.value}</p>
                <p className="text-white/50 text-[9px] mt-0.5">{k.subtitle}</p>
              </div>
              {/* Shimmer overlay on hover */}
              <div className="absolute inset-0 -translate-x-full group-hover:translate-x-full transition-transform duration-1000 bg-gradient-to-r from-transparent via-white/5 to-transparent" />
            </div>
          );
        })}
      </div>

      {/* Secondary Stats */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="rounded-xl glass-panel p-4 flex items-center justify-between shadow-sm transition-all duration-300 hover:-translate-y-0.5 hover:shadow-md hover:border-emerald-500/20" style={{ animation: 'fadeUp 0.5s ease-out 0.4s both' }}>
          <div>
            <p className="text-xs text-muted-foreground dark:text-muted-foreground">Préstamos Activos</p>
            <p className="text-xl font-bold text-foreground dark:text-foreground">{activeLoans}</p>
          </div>
          <div className="w-9 h-9 rounded-lg bg-emerald-50 dark:bg-emerald-950/50 flex items-center justify-center group-hover:scale-110 transition-transform">
            <Activity className="h-4 w-4 text-emerald-600 dark:text-emerald-400" />
          </div>
        </div>
        <div className="rounded-xl glass-panel p-4 flex items-center justify-between shadow-sm transition-all duration-300 hover:-translate-y-0.5 hover:shadow-md hover:border-teal-500/20" style={{ animation: 'fadeUp 0.5s ease-out 0.5s both' }}>
          <div>
            <p className="text-xs text-muted-foreground dark:text-muted-foreground">Préstamos Completados</p>
            <p className="text-xl font-bold text-foreground dark:text-foreground">{completedLoans}</p>
          </div>
          <div className="w-9 h-9 rounded-lg bg-teal-50 dark:bg-teal-950/50 flex items-center justify-center">
            <PiggyBank className="h-4 w-4 text-teal-600 dark:text-teal-400" />
          </div>
        </div>
        <div className="rounded-xl glass-panel p-4 flex items-center justify-between shadow-sm transition-all duration-300 hover:-translate-y-0.5 hover:shadow-md hover:border-amber-500/20" style={{ animation: 'fadeUp 0.5s ease-out 0.6s both' }}>
          <div>
            <p className="text-xs text-muted-foreground dark:text-muted-foreground">Interés Generado</p>
            <p className="text-xl font-bold text-foreground dark:text-foreground">{formatVal(o?.totalInterest ?? 0)}</p>
          </div>
          <div className="w-9 h-9 rounded-lg bg-amber-50 dark:bg-amber-950/50 flex items-center justify-center">
            <TrendingUp className="h-4 w-4 text-amber-600 dark:text-amber-400" />
          </div>
        </div>
        <div className="rounded-xl glass-panel p-4 flex items-center justify-between shadow-sm transition-all duration-300 hover:-translate-y-0.5 hover:shadow-md hover:border-blue-500/20" style={{ animation: 'fadeUp 0.5s ease-out 0.7s both' }}>
          <div>
            <p className="text-xs text-muted-foreground dark:text-muted-foreground">Clientes Activos</p>
            <p className="text-xl font-bold text-foreground dark:text-foreground">{data?.topClients?.length ?? 0}</p>
          </div>
          <div className="w-9 h-9 rounded-lg bg-blue-50 dark:bg-blue-950/50 flex items-center justify-center">
            <Users className="h-4 w-4 text-blue-600 dark:text-blue-400" />
          </div>
        </div>
      </div>

      {/* Charts Row */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Payment Chart */}
        <div className="rounded-2xl glass-panel shadow-lg overflow-hidden transition-all duration-500 hover:shadow-xl hover:-translate-y-0.5" style={{ animation: 'fadeUp 0.5s ease-out 0.8s both' }}>
          <div className="px-5 py-4 border-b border-input/50 dark:border-emerald-500/10">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-emerald-500 to-emerald-600 flex items-center justify-center shadow-lg shadow-emerald-500/20">
                  <Activity className="h-5 w-5 text-white" />
                </div>
                <div>
                  <h3 className="font-semibold text-sm text-slate-800 dark:text-foreground">Pagos Últimos 7 Días</h3>
                  <p className="text-[11px] text-muted-foreground">Evolución diaria de cobranza</p>
                </div>
              </div>
              <Badge variant="outline" className="bg-emerald-50 dark:bg-emerald-950 text-emerald-700 dark:text-emerald-300 border-emerald-200 dark:border-emerald-800 text-[10px]">
                {data?.recentPayments?.length || 0} registros
              </Badge>
            </div>
          </div>
          <div className="p-5">
            <div className="flex items-end gap-2 h-44">
              {(data?.recentPayments ?? []).map((p) => (
                <div key={p.date} className="flex-1 flex flex-col items-center gap-2 group">
                  <span className="text-[10px] text-muted-foreground opacity-0 group-hover:opacity-100 transition-all font-medium">
                    {formatVal(p.amount)}
                  </span>
                  <div className="w-full relative rounded-lg overflow-hidden bar-hover" style={{ height: `${(p.amount / maxPay) * 100}%`, minHeight: 6, animation: 'growBar 0.6s ease-out both' }}>
                    <div className="absolute inset-0 bg-gradient-to-t from-emerald-500 to-emerald-400 transition-all duration-300 group-hover:from-emerald-600 group-hover:to-emerald-500 cursor-pointer" />
                  </div>
                  <span className="text-[10px] text-muted-foreground dark:text-muted-foreground font-medium">
                    {new Date(p.date).toLocaleDateString('es-PE', { weekday: 'short' }).slice(0, 3)}
                  </span>
                </div>
              ))}
              {(!data?.recentPayments || data.recentPayments.length === 0) && (
                <div className="w-full text-center py-10 text-muted-foreground text-sm">Sin datos de pagos recientes</div>
              )}
            </div>
          </div>
        </div>

        {/* Payment Methods */}
        <div className="rounded-2xl glass-panel shadow-lg overflow-hidden transition-all duration-500 hover:shadow-xl hover:-translate-y-0.5" style={{ animation: 'fadeUp 0.5s ease-out 0.9s both' }}>
          <div className="px-5 py-4 border-b border-input/50 dark:border-emerald-500/10">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-teal-500 to-teal-600 flex items-center justify-center shadow-lg shadow-teal-500/20">
                <Wallet className="h-5 w-5 text-white" />
              </div>
              <div>
                <h3 className="font-semibold text-sm text-slate-800 dark:text-foreground">Métodos de Pago</h3>
                <p className="text-[11px] text-muted-foreground">Distribución de cobros</p>
              </div>
            </div>
          </div>
          <div className="p-5 space-y-4">
            <div className="flex items-center gap-1 h-10 rounded-xl overflow-hidden bg-background/50 dark:bg-[#05060b]/70 p-0.5">
              {(data?.paymentMethods ?? []).map((m, i) => (
                <div
                  key={m.method}
                  className="h-full rounded-lg transition-all duration-300 hover:opacity-80 flex items-center justify-center text-[10px] font-semibold text-white"
                  style={{
                    flex: m.count || 1,
                    backgroundColor: colors[i % colors.length],
                  }}
                  title={`${m.method}: ${m.count} pagos`}
                >
                  {totalMethodCount > 0 && (m.count / totalMethodCount) > 0.15 && m.method}
                </div>
              ))}
            </div>
            <div className="grid grid-cols-2 gap-3">
              {(data?.paymentMethods ?? []).map((m, i) => {
                const pct = totalMethodCount ? Math.round((m.count / totalMethodCount) * 100) : 0;
                return (
                  <div key={m.method} className="flex items-center gap-3 p-3 rounded-xl bg-background/50 dark:bg-[#05060b]/50 border border-input/50 dark:border-emerald-500/5 transition-all duration-300 hover:bg-background/70 dark:hover:bg-[#05060b]/90 hover:border-emerald-500/30">
                    <span className="w-3.5 h-3.5 rounded-full shrink-0 animate-pulse-once" style={{ backgroundColor: colors[i % colors.length], animationDelay: `${i * 0.2}s` }} />
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between">
                        <p className="text-sm font-medium text-foreground/80 dark:text-foreground/80 capitalize">{m.method}</p>
                        <span className="text-xs font-bold text-muted-foreground dark:text-muted-foreground">{pct}%</span>
                      </div>
                      <div className="mt-1.5 h-2 bg-slate-200 dark:bg-[#05060b]/60 rounded-full overflow-hidden">
                        <div className="h-full rounded-full transition-all duration-1000 ease-out" style={{ width: `${pct}%`, backgroundColor: colors[i % colors.length], animation: 'fillBar 1s ease-out both', animationDelay: `${i * 0.15}s` }} />
                      </div>
                      <p className="text-[10px] text-muted-foreground mt-0.5">{m.count} transacciones · {formatVal(m.amount)}</p>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      </div>

      {/* Top Clients */}
      {data?.topClients && data.topClients.length > 0 && (
        <div className="rounded-2xl glass-panel shadow-lg overflow-hidden transition-all duration-500 hover:shadow-xl hover:-translate-y-0.5" style={{ animation: 'fadeUp 0.5s ease-out 1s both' }}>
          <div className="px-5 py-4 border-b border-input/50 dark:border-emerald-500/10">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-blue-500 to-blue-600 flex items-center justify-center shadow-lg shadow-blue-500/20">
                <Users className="h-5 w-5 text-white" />
              </div>
              <div>
                <h3 className="font-semibold text-sm text-slate-800 dark:text-foreground">Top Clientes</h3>
                <p className="text-[11px] text-muted-foreground">Mejores prestatarios por monto</p>
              </div>
            </div>
          </div>
          <div className="p-5">
            <div className="space-y-3">
              {data.topClients.slice(0, 5).map((c, i) => {
                const pct = c.totalLoaned ? Math.round((c.totalPaid / c.totalLoaned) * 100) : 0;
                return (
                  <div key={c.name} className="flex items-center gap-4 p-3 rounded-xl hover:bg-background/50 dark:hover:bg-[#05060b]/90 transition-all hover:-translate-x-0.5" style={{ animation: `fadeUp 0.4s ease-out ${0.2 + i * 0.08}s both` }}>
                    <div className={`w-9 h-9 rounded-xl flex items-center justify-center text-sm font-bold shrink-0 transition-transform duration-300 hover:scale-110 ${
                      i === 0 ? 'bg-gradient-to-br from-amber-400 to-amber-600 text-white shadow-lg shadow-amber-500/20' :
                      i === 1 ? 'bg-gradient-to-br from-slate-300 to-slate-400 text-white shadow-md' :
                      i === 2 ? 'bg-gradient-to-br from-amber-700 to-amber-800 text-white shadow-md' :
                      'bg-background/70 dark:bg-card/80 text-muted-foreground dark:text-muted-foreground'
                    }`}>
                      {i + 1}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-semibold text-slate-800 dark:text-foreground truncate">{c.name}</p>
                      <div className="flex items-center gap-3 mt-1.5">
                        <div className="flex-1 h-2.5 bg-background/70 dark:bg-card/80 rounded-full overflow-hidden">
                          <div
                            className="h-full bg-gradient-to-r from-emerald-500 to-emerald-400 rounded-full transition-all duration-1000 ease-out"
                            style={{ width: `${pct}%`, animation: 'fillBar 1.2s ease-out both', animationDelay: `${0.3 + i * 0.1}s` }}
                          />
                        </div>
                        <span className="text-[11px] font-semibold text-muted-foreground dark:text-muted-foreground shrink-0">{pct}%</span>
                      </div>
                    </div>
                    <div className="text-right shrink-0">
                      <p className="text-sm font-bold text-slate-800 dark:text-foreground">{formatVal(c.totalLoaned)}</p>
                      <p className="text-[10px] text-muted-foreground">
                        Pagado: {formatVal(c.totalPaid)}
                      </p>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      )}

      {/* Empty State */}
      {!data && !loading && (
        <div className="text-center py-20 text-muted-foreground">
          <BarChart3 className="h-12 w-12 mx-auto mb-4 opacity-30" />
          <p className="text-lg font-medium">Sin datos disponibles</p>
          <p className="text-sm mt-1">Conecta con la base de datos para ver las estadísticas</p>
        </div>
      )}

      <style>{`
        @keyframes fadeUp {
          from { opacity: 0; transform: translateY(20px); }
          to { opacity: 1; transform: translateY(0); }
        }
        @keyframes growBar {
          from { height: 0px; }
        }
        @keyframes fillBar {
          from { width: 0% !important; }
        }
        @keyframes drift {
          0%, 100% { transform: translate(0, 0); }
          25% { transform: translate(30px, -20px); }
          50% { transform: translate(-20px, 10px); }
          75% { transform: translate(15px, -30px); }
        }
        @keyframes shimmer {
          0% { background-position: -200% center; }
          100% { background-position: 200% center; }
        }
        .bar-hover {
          transition: all 0.3s ease;
        }
        .bar-hover:hover {
          filter: brightness(1.2);
          transform: scaleY(1.05);
          transform-origin: bottom;
        }
        .value-pulse {
          display: inline-block;
        }
      `}</style>
    </div>
  );
}
