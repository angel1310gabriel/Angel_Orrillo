'use client';

import { useState, useEffect, useCallback } from 'react';
import {
  TrendingUp, DollarSign, Users, AlertTriangle,
  Activity, BarChart3, Wallet, ArrowUp, ArrowDown,
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
        <Loader2 className="h-8 w-8 animate-spin text-emerald-500" />
        <span className="ml-3 text-muted-foreground">Cargando dashboard...</span>
      </div>
    );
  }

  const o = data?.overview;
  const efficiency = o?.totalLoaned && o?.totalCollected
    ? Math.min(100, Math.round((o.totalCollected / o.totalLoaned) * 100))
    : 0;

  const kpis = [
    { label: 'Capital', value: o?.totalLoaned ?? 0, icon: DollarSign, color: 'from-emerald-500 to-emerald-600', prefix: 'S/ ' },
    { label: 'Total Cobrado', value: o?.totalCollected ?? 0, icon: Wallet, color: 'from-teal-500 to-teal-600', prefix: 'S/ ' },
    { label: 'En Mora', value: o?.moraLoans ?? 0, icon: AlertTriangle, color: 'from-amber-500 to-orange-500', prefix: '' },
    { label: 'Tasa Eficiencia', value: efficiency, icon: TrendingUp, color: 'from-blue-500 to-blue-600', suffix: '%', prefix: '' },
  ];

  const maxPay = maxVal(data?.recentPayments ?? []);
  const totalMethodCount = (data?.paymentMethods ?? []).reduce((s, m) => s + m.count, 0);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold tracking-tight">Dashboard</h1>
        <button
          onClick={fetchData}
          className="inline-flex items-center gap-2 rounded-lg bg-emerald-600 px-4 py-2 text-sm font-medium text-white hover:bg-emerald-700 transition-colors"
        >
          <BarChart3 className="h-4 w-4" />
          Actualizar
        </button>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {kpis.map((k) => {
          const Icon = k.icon;
          const val = typeof k.value === 'number' ? k.value : 0;
          return (
            <Card key={k.label} className={`border-0 shadow-md bg-gradient-to-br ${k.color} text-white`}>
              <CardContent className="p-4">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-white/70 text-xs font-medium">{k.label}</p>
                    <p className="text-xl sm:text-2xl font-bold mt-1">
                      {k.prefix}{k.label === 'Tasa Eficiencia' ? val : val.toLocaleString('es-PE')}{k.suffix ?? ''}
                    </p>
                  </div>
                  <Icon className="h-8 w-8 text-white/40" />
                </div>
              </CardContent>
            </Card>
          );
        })}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card className="shadow-md border-0">
          <CardContent className="p-5">
            <div className="flex items-center gap-2 mb-4">
              <Activity className="h-5 w-5 text-emerald-500" />
              <h3 className="font-semibold text-sm">Pagos últimos 7 días</h3>
            </div>
            <div className="flex items-end gap-2 h-40">
              {(data?.recentPayments ?? []).map((p) => (
                <div key={p.date} className="flex-1 flex flex-col items-center gap-1">
                  <span className="text-[10px] text-muted-foreground">
                    S/ {(p.amount / 1000).toFixed(1)}k
                  </span>
                  <div
                    className="w-full bg-emerald-500 rounded-t"
                    style={{ height: `${(p.amount / maxPay) * 100}%`, minHeight: 4 }}
                  />
                  <span className="text-[10px] text-muted-foreground">
                    {new Date(p.date).getDate()}/{new Date(p.date).getMonth() + 1}
                  </span>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

        <Card className="shadow-md border-0">
          <CardContent className="p-5">
            <div className="flex items-center gap-2 mb-4">
              <Wallet className="h-5 w-5 text-emerald-500" />
              <h3 className="font-semibold text-sm">Métodos de pago</h3>
            </div>
            <div className="flex items-center gap-1 h-8 mb-4">
              {(data?.paymentMethods ?? []).map((m, i) => (
                <div
                  key={m.method}
                  className="h-full rounded"
                  style={{
                    flex: m.count,
                    backgroundColor: colors[i % colors.length],
                  }}
                  title={`${m.method}: ${m.count} pagos`}
                />
              ))}
            </div>
            <div className="grid grid-cols-2 gap-2">
              {(data?.paymentMethods ?? []).map((m, i) => (
                <div key={m.method} className="flex items-center gap-2 text-xs">
                  <span className="w-3 h-3 rounded-sm" style={{ backgroundColor: colors[i % colors.length] }} />
                  <span className="text-muted-foreground truncate flex-1">{m.method}</span>
                  <span className="font-medium">
                    {totalMethodCount ? Math.round((m.count / totalMethodCount) * 100) : 0}%
                  </span>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      </div>

      {data?.topClients && data.topClients.length > 0 && (
        <Card className="shadow-md border-0">
          <CardContent className="p-5">
            <div className="flex items-center gap-2 mb-4">
              <Users className="h-5 w-5 text-emerald-500" />
              <h3 className="font-semibold text-sm">Top Clientes</h3>
            </div>
            <div className="space-y-3">
              {data.topClients.slice(0, 5).map((c) => {
                const pct = c.totalLoaned ? Math.round((c.totalPaid / c.totalLoaned) * 100) : 0;
                return (
                  <div key={c.name} className="flex items-center gap-3">
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium truncate">{c.name}</p>
                      <div className="flex items-center gap-2 mt-1">
                        <div className="flex-1 h-2 bg-muted rounded-full overflow-hidden">
                          <div
                            className="h-full bg-emerald-500 rounded-full transition-all"
                            style={{ width: `${pct}%` }}
                          />
                        </div>
                        <span className="text-xs text-muted-foreground shrink-0">{pct}%</span>
                      </div>
                    </div>
                    <div className="text-right shrink-0">
                      <p className="text-sm font-semibold">S/ {(c.totalLoaned ?? 0).toLocaleString('es-PE')}</p>
                      <p className="text-[11px] text-muted-foreground">
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
