'use client';

import React, { useState, useEffect, useCallback } from 'react';
import {
  DollarSign,
  TrendingUp,
  AlertTriangle,
  Activity,
  ArrowUpRight,
  Zap,
  RefreshCw,
  Users,
  Loader2,
  Bell,
  CalendarDays,
} from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import { ScrollArea } from '@/components/ui/scroll-area';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
  Legend,
  Area,
  AreaChart,
} from 'recharts';
import { useToast } from '@/hooks/use-toast';
import { useAuth } from '@/hooks/use-auth';
import type { OverviewData, RiskAssessment, CollectorPerformance, TrendData } from '@/lib/types';
import { formatCurrency, getRiskBadge, getRiskLabel } from '@/lib/format-helpers';

interface Reminder {
  id: string;
  clientName: string;
  clientPhone: string;
  loanId: string;
  installmentNumber: number;
  amount: number;
  dueDate: string;
}

interface ReportData {
  collectionsByDay: { date: string; totalAmount: number; count: number }[];
  loansByStatus: { active: number; mora: number; completed: number; cancelled: number; refinanced: number };
  collectorRanking: { collectorId: string; collectorName: string; totalCollected: number; count: number; totalLoans: number }[];
  zonePerformance: { zoneName: string; activeLoans: number; moraLoans: number; totalLoaned: number }[];
}

const CHART_COLORS = ['#10b981', '#f59e0b', '#ef4444', '#8b5cf6', '#06b6d4', '#ec4899'];

export default function DashboardTab() {
  const { toast } = useToast();
  const { user } = useAuth();
  const isAdmin = user?.role === 'admin';
  const [overview, setOverview] = useState<OverviewData | null>(null);
  const [prediction, setPrediction] = useState<{ summary: { total: number; low: number; medium: number; high: number; critical: number; avgRiskScore: number; predictedMoraNext7Days: number }; assessments: RiskAssessment[] } | null>(null);
  const [trends, setTrends] = useState<TrendData | null>(null);
  const [collectors, setCollectors] = useState<CollectorPerformance[]>([]);
  const [reminders, setReminders] = useState<Reminder[]>([]);
  const [reports, setReports] = useState<ReportData | null>(null);
  const [loading, setLoading] = useState(true);

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const [overviewRes, predictionRes, trendsRes, collectorsRes, remindersRes, reportsRes] = await Promise.all([
        fetch('/api/analytics?type=overview'),
        fetch('/api/analytics?type=mora-prediction'),
        fetch('/api/analytics?type=trends'),
        fetch('/api/analytics?type=collectors'),
        fetch(`/api/reminders${!isAdmin && user?.id ? `?collectorId=${user.id}` : ''}`),
        fetch('/api/reports'),
      ]);

      if (overviewRes.ok) {
        try { setOverview(await overviewRes.json()); } catch { /* ignore */ }
      }
      if (predictionRes.ok) {
        try { setPrediction(await predictionRes.json()); } catch { /* ignore */ }
      }
      if (trendsRes.ok) {
        try { setTrends(await trendsRes.json()); } catch { /* ignore */ }
      }
      if (collectorsRes.ok) {
        try {
          const data = await collectorsRes.json();
          setCollectors(data?.collectors || []);
        } catch { /* ignore */ }
      }
      if (remindersRes.ok) {
        try { setReminders(await remindersRes.json()); } catch { /* ignore */ }
      }
      if (reportsRes.ok) {
        try { setReports(await reportsRes.json()); } catch { /* ignore */ }
      }
    } catch (error) {
      console.error('Error fetching dashboard:', error);
      toast({ title: 'Error', description: 'No se pudo cargar el dashboard', variant: 'destructive' });
    } finally {
      setLoading(false);
    }
  }, [toast, isAdmin, user?.id]);

  useEffect(() => { fetchData(); }, [fetchData]);

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="h-8 w-8 animate-spin text-emerald-500" />
        <span className="ml-3 text-slate-500 dark:text-slate-400">Cargando dashboard...</span>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* KPI Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Card className="border-0 shadow-md bg-gradient-to-br from-emerald-500 to-emerald-600 text-white">
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-emerald-100 text-xs font-medium">Capital Actual</p>
                <p className="text-lg sm:text-xl md:text-2xl font-bold mt-1">{formatCurrency(overview?.capital?.current || 0)}</p>
              </div>
              <DollarSign className="h-8 w-8 text-emerald-200" />
            </div>
          </CardContent>
        </Card>

        <Card className="border-0 shadow-md bg-gradient-to-br from-teal-500 to-teal-600 text-white">
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-teal-100 text-xs font-medium">Préstamos Activos</p>
                <p className="text-2xl font-bold mt-1">{overview?.loans?.active || 0}</p>
              </div>
              <TrendingUp className="h-8 w-8 text-teal-200" />
            </div>
          </CardContent>
        </Card>

        <Card className="border-0 shadow-md bg-gradient-to-br from-amber-500 to-orange-500 text-white">
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-amber-100 text-xs font-medium">Tasa de Mora</p>
                <p className="text-2xl font-bold mt-1">{overview?.rates?.moraRate || 0}%</p>
              </div>
              <AlertTriangle className="h-8 w-8 text-amber-200" />
            </div>
          </CardContent>
        </Card>

      </div>

      {/* Second row - Financial Details */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card className="shadow-md border-0">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-slate-500 dark:text-slate-400">Total Prestado</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold text-slate-900 dark:text-slate-100">{formatCurrency(overview?.financials?.totalLoaned || 0)}</p>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">Interés esperado: {formatCurrency(overview?.financials?.totalInterest || 0)}</p>
          </CardContent>
        </Card>

        <Card className="shadow-md border-0">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-slate-500 dark:text-slate-400">Total Cobrado</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold text-emerald-600 dark:text-emerald-300">{formatCurrency(overview?.financials?.totalCollected || 0)}</p>
            <p className="text-xs text-emerald-600 dark:text-emerald-300 mt-1 flex items-center gap-1">
              <ArrowUpRight className="h-3 w-3" />
              {overview?.payments?.last30Days || 0} pagos (30 días)
            </p>
          </CardContent>
        </Card>

        <Card className="shadow-md border-0">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-slate-500 dark:text-slate-400">Mora Pendiente</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold text-red-600 dark:text-red-300">{formatCurrency(overview?.financials?.moraOutstanding || 0)}</p>
            <p className="text-xs text-red-500 mt-1">{overview?.loans?.mora || 0} préstamos en mora</p>
          </CardContent>
        </Card>
      </div>

      {/* Mora Prediction Section */}
      <Card className="shadow-lg border-0">
        <CardHeader className="bg-gradient-to-r from-slate-800 to-slate-900 text-white rounded-t-lg">
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="flex items-center gap-2">
                <Zap className="h-5 w-5 text-amber-400" />
                Predicción de Mora - Próximos 7 Días
              </CardTitle>
              <CardDescription className="text-slate-300 mt-1">
                Análisis de riesgo basado en score crediticio, historial de pagos y tendencias
              </CardDescription>
            </div>
            <Button size="sm" variant="outline" className="border-slate-500 text-white bg-slate-700/50 hover:bg-slate-600" onClick={() => fetchData()}>
              <RefreshCw className="h-4 w-4 mr-1" />
              Actualizar
            </Button>
          </div>
        </CardHeader>
        <CardContent className="p-6">
          {prediction?.summary ? (
            <>
              <div className="grid grid-cols-2 md:grid-cols-5 gap-3 mb-6">
                <div className="text-center p-3 rounded-xl bg-emerald-50 dark:bg-emerald-950/50 border border-emerald-200">
                  <p className="text-2xl font-bold text-emerald-600 dark:text-emerald-300">{prediction.summary.low}</p>
                  <p className="text-xs font-medium text-emerald-700 dark:text-emerald-300">Riesgo Bajo</p>
                </div>
                <div className="text-center p-3 rounded-xl bg-amber-50 dark:bg-amber-950/50 border border-amber-200">
                  <p className="text-2xl font-bold text-amber-600 dark:text-amber-300">{prediction.summary.medium}</p>
                  <p className="text-xs font-medium text-amber-700 dark:text-amber-300">Riesgo Medio</p>
                </div>
                <div className="text-center p-3 rounded-xl bg-orange-50 dark:bg-orange-950/50 border border-orange-200">
                  <p className="text-2xl font-bold text-orange-600 dark:text-orange-300">{prediction.summary.high}</p>
                  <p className="text-xs font-medium text-orange-700 dark:text-orange-300">Riesgo Alto</p>
                </div>
                <div className="text-center p-3 rounded-xl bg-red-50 dark:bg-red-950/50 border border-red-200">
                  <p className="text-2xl font-bold text-red-600 dark:text-red-300">{prediction.summary.critical}</p>
                  <p className="text-xs font-medium text-red-700 dark:text-red-300">Riesgo Crítico</p>
                </div>
                <div className="text-center p-3 rounded-xl bg-slate-800 col-span-2 md:col-span-1">
                  <p className="text-2xl font-bold text-white">{prediction.summary.predictedMoraNext7Days}</p>
                  <p className="text-xs font-medium text-slate-300">Predicción Mora 7d</p>
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-6">
                <div>
                  <h3 className="text-sm font-semibold text-slate-700 dark:text-slate-300 mb-3">Distribución de Riesgo</h3>
                  <ResponsiveContainer width="100%" height={200}>
                    <PieChart>
                      <Pie
                        data={[
                          { name: 'Bajo', value: prediction.summary.low, fill: '#10b981' },
                          { name: 'Medio', value: prediction.summary.medium, fill: '#f59e0b' },
                          { name: 'Alto', value: prediction.summary.high, fill: '#f97316' },
                          { name: 'Crítico', value: prediction.summary.critical, fill: '#ef4444' },
                        ]}
                        cx="50%" cy="50%" innerRadius={50} outerRadius={80} paddingAngle={3} dataKey="value"
                      >
                        {[
                          { fill: '#10b981' }, { fill: '#f59e0b' }, { fill: '#f97316' }, { fill: '#ef4444' },
                        ].map((entry, index) => (
                          <Cell key={`cell-${index}`} fill={entry.fill} />
                        ))}
                      </Pie>
                      <Tooltip formatter={(value: number) => [`${value} préstamos`, '']} />
                    </PieChart>
                  </ResponsiveContainer>
                </div>

                <div>
                  <h3 className="text-sm font-semibold text-slate-700 dark:text-slate-300 mb-3">Score de Riesgo Promedio</h3>
                  <div className="flex flex-col items-center justify-center h-[200px]">
                    <div className="relative w-32 h-32">
                      <svg className="w-full h-full -rotate-90" viewBox="0 0 120 120">
                        <circle cx="60" cy="60" r="50" fill="none" stroke="#e2e8f0" strokeWidth="12" />
                        <circle
                          cx="60" cy="60" r="50" fill="none"
                          stroke={prediction.summary.avgRiskScore > 60 ? '#ef4444' : prediction.summary.avgRiskScore > 40 ? '#f59e0b' : '#10b981'}
                          strokeWidth="12"
                          strokeDasharray={`${(prediction.summary.avgRiskScore / 100) * 314} 314`}
                          strokeLinecap="round"
                        />
                      </svg>
                      <div className="absolute inset-0 flex flex-col items-center justify-center">
                        <span className={`text-3xl font-bold ${prediction.summary.avgRiskScore > 60 ? 'text-red-600 dark:text-red-300' : prediction.summary.avgRiskScore > 40 ? 'text-amber-600 dark:text-amber-300' : 'text-emerald-600 dark:text-emerald-300'}`}>
                          {prediction.summary.avgRiskScore}
                        </span>
                        <span className="text-xs text-slate-500 dark:text-slate-400">/100</span>
                      </div>
                    </div>
                    <p className="text-sm text-slate-600 dark:text-slate-400 mt-2">
                      {prediction.summary.avgRiskScore > 60 ? '⚠️ Riesgo elevado' : prediction.summary.avgRiskScore > 40 ? '⚡ Riesgo moderado' : '✅ Riesgo controlado'}
                    </p>
                  </div>
                </div>
              </div>

              <h3 className="text-sm font-semibold text-slate-700 dark:text-slate-300 mb-3">Préstamos en Riesgo (ordenado por score)</h3>
              <ScrollArea className="max-h-96">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Cliente</TableHead>
                      <TableHead>Monto</TableHead>
                      <TableHead>Pagado</TableHead>
                      <TableHead>Score Crédito</TableHead>
                      <TableHead>Días Rest.</TableHead>
                      <TableHead>Riesgo</TableHead>
                      <TableHead>Factores</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {(prediction.assessments || []).map((a) => (
                      <TableRow key={a.loanId} className={a.riskLevel === 'critical' ? 'bg-red-50/50 dark:bg-red-950/30' : a.riskLevel === 'high' ? 'bg-orange-50/50 dark:bg-orange-950/30' : ''}>
                        <TableCell className="font-medium">{a.clientName}</TableCell>
                        <TableCell>{formatCurrency(a.amount)}</TableCell>
                        <TableCell>{formatCurrency(a.amountPaid)}</TableCell>
                        <TableCell>
                          <Badge variant="outline" className={
                            (a.creditScore || 0) < 30 ? 'bg-red-50 dark:bg-red-950/50 text-red-700 dark:text-red-300 border-red-200 dark:border-red-800' :
                            (a.creditScore || 0) < 50 ? 'bg-amber-50 dark:bg-amber-950/50 text-amber-700 dark:text-amber-300 border-amber-200 dark:border-amber-800' :
                            'bg-emerald-50 dark:bg-emerald-950/50 text-emerald-700 dark:text-emerald-300 border-emerald-200 dark:border-emerald-800'
                          }>
                            {a.creditScore || 'N/A'}
                          </Badge>
                        </TableCell>
                        <TableCell>
                          <span className={a.daysRemaining !== null && a.daysRemaining < 5 ? 'text-red-600 dark:text-red-300 font-semibold' : ''}>
                            {a.daysRemaining !== null ? `${a.daysRemaining}d` : '—'}
                          </span>
                        </TableCell>
                        <TableCell>
                          <div className="flex items-center gap-2">
                            <Progress value={a.riskScore} className="h-2 w-16" />
                            <Badge variant="outline" className={getRiskBadge(a.riskLevel)}>
                              {getRiskLabel(a.riskLevel)}
                            </Badge>
                          </div>
                        </TableCell>
                        <TableCell>
                          <div className="flex flex-wrap gap-1 max-w-48">
                            {a.factors.slice(0, 2).map((f, i) => (
                              <span key={i} className="text-xs px-1.5 py-0.5 rounded bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400">
                                {f.factor} +{f.impact}
                              </span>
                            ))}
                          </div>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </ScrollArea>
            </>
          ) : null}
        </CardContent>
      </Card>

      {/* Próximos Vencimientos */}
      <Card className="shadow-lg border-0">
        <CardHeader className="bg-gradient-to-r from-amber-500 to-orange-500 text-white rounded-t-lg">
          <div className="flex items-center gap-2">
            <Bell className="h-5 w-5" />
            <CardTitle className="text-base">Próximos Vencimientos</CardTitle>
          </div>
          <CardDescription className="text-amber-100">
            Pagos programados para los próximos 2 días
          </CardDescription>
        </CardHeader>
        <CardContent className="p-4">
          {reminders.length === 0 ? (
            <div className="flex items-center justify-center py-8 text-slate-400 dark:text-slate-500">
              <CalendarDays className="h-5 w-5 mr-2" />
              <span>No hay vencimientos próximos</span>
            </div>
          ) : (
            <ScrollArea className="max-h-64">
              <div className="space-y-2">
                {reminders.map((r) => {
                  const dueDate = new Date(r.dueDate);
                  const today = new Date();
                  today.setHours(0, 0, 0, 0);
                  const daysRemaining = Math.floor((dueDate.getTime() - today.getTime()) / 86400000);
                  return (
                    <div
                      key={r.id}
                      className="flex items-center justify-between p-3 rounded-lg bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800"
                    >
                      <div className="min-w-0 flex-1">
                        <p className="font-medium text-sm text-slate-900 dark:text-slate-100 truncate">
                          {r.clientName}
                        </p>
                        <p className="text-xs text-slate-500 dark:text-slate-400">
                          Cuota #{r.installmentNumber} · {r.clientPhone}
                        </p>
                      </div>
                      <div className="text-right ml-4 flex-shrink-0">
                        <p className="font-semibold text-sm text-amber-700 dark:text-amber-300">
                          {formatCurrency(r.amount)}
                        </p>
                        <Badge
                          variant="outline"
                          className={
                            daysRemaining <= 0
                              ? 'bg-red-50 dark:bg-red-950/50 text-red-700 dark:text-red-300 border-red-200 dark:border-red-800'
                              : daysRemaining === 1
                              ? 'bg-orange-50 dark:bg-orange-950/50 text-orange-700 dark:text-orange-300 border-orange-200 dark:border-orange-800'
                              : 'bg-amber-50 dark:bg-amber-950/50 text-amber-700 dark:text-amber-300 border-amber-200 dark:border-amber-800'
                          }
                        >
                          {daysRemaining <= 0 ? 'Hoy' : daysRemaining === 1 ? 'Mañana' : `${daysRemaining} días`}
                        </Badge>
                      </div>
                    </div>
                  );
                })}
              </div>
            </ScrollArea>
          )}
        </CardContent>
      </Card>

      {/* Charts Row */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card className="shadow-lg border-0">
          <CardHeader>
            <CardTitle className="text-base">Tendencia de Cobros (30 días)</CardTitle>
            <CardDescription>Montos cobrados diariamente</CardDescription>
          </CardHeader>
          <CardContent>
            {trends?.dailyPayments && trends.dailyPayments.length > 0 && (
              <ResponsiveContainer width="100%" height={280}>
                <AreaChart data={trends.dailyPayments}>
                  <defs>
                    <linearGradient id="colorAmount" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#10b981" stopOpacity={0.3} />
                      <stop offset="95%" stopColor="#10b981" stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                  <XAxis dataKey="date" tick={{ fontSize: 10 }} tickFormatter={(v) => v.slice(5)} />
                  <YAxis tick={{ fontSize: 10 }} tickFormatter={(v) => `S/${(v / 1000).toFixed(0)}k`} />
                  <Tooltip formatter={(value: number) => formatCurrency(value)} labelFormatter={(label) => `Fecha: ${label}`} />
                  <Area type="monotone" dataKey="amount" stroke="#10b981" fill="url(#colorAmount)" strokeWidth={2} name="Monto" />
                </AreaChart>
              </ResponsiveContainer>
            )}
          </CardContent>
        </Card>

        <Card className="shadow-lg border-0">
          <CardHeader>
            <CardTitle className="text-base">Métodos de Pago</CardTitle>
            <CardDescription>Distribución por método de pago</CardDescription>
          </CardHeader>
          <CardContent>
            {trends?.paymentMethods && trends.paymentMethods.length > 0 && (
              <ResponsiveContainer width="100%" height={280}>
                <PieChart>
                  <Pie
                    data={trends.paymentMethods.map((pm) => ({
                      name: pm.method,
                      value: pm.count,
                      amount: pm.amount,
                    }))}
                    cx="50%" cy="50%" outerRadius={90} paddingAngle={3} dataKey="value"
                    label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`}
                  >
                    {trends.paymentMethods.map((_, index) => (
                      <Cell key={`cell-${index}`} fill={CHART_COLORS[index % CHART_COLORS.length]} />
                    ))}
                  </Pie>
                  <Tooltip formatter={(value: number, name: string, props: { payload?: { amount?: number } }) => [`${value} pagos (${formatCurrency(props.payload?.amount || 0)})`, '']} />
                </PieChart>
              </ResponsiveContainer>
            )}
          </CardContent>
        </Card>

        <Card className="shadow-lg border-0">
          <CardHeader>
            <CardTitle className="text-base">Actividad Semanal</CardTitle>
            <CardDescription>Nuevos préstamos vs cambios a mora</CardDescription>
          </CardHeader>
          <CardContent>
            {trends?.weeklyActions && trends.weeklyActions.length > 0 && (
              <ResponsiveContainer width="100%" height={280}>
                <BarChart data={trends.weeklyActions}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                  <XAxis dataKey="week" tick={{ fontSize: 10 }} />
                  <YAxis tick={{ fontSize: 10 }} />
                  <Tooltip />
                  <Legend />
                  <Bar dataKey="loanCreations" name="Nuevos Préstamos" fill="#10b981" radius={[4, 4, 0, 0]} />
                  <Bar dataKey="moraChanges" name="Cambios a Mora" fill="#ef4444" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            )}
          </CardContent>
        </Card>

        <Card className="shadow-lg border-0">
          <CardHeader>
            <CardTitle className="text-base">Mora por Zona</CardTitle>
            <CardDescription>Tasa de mora y montos pendientes</CardDescription>
          </CardHeader>
          <CardContent>
            {trends?.zoneMora && trends.zoneMora.length > 0 && (
              <ResponsiveContainer width="100%" height={280}>
                <BarChart data={trends.zoneMora} layout="vertical">
                  <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                  <XAxis type="number" tick={{ fontSize: 10 }} tickFormatter={(v) => `${v}%`} />
                  <YAxis type="category" dataKey="zone" tick={{ fontSize: 11 }} width={80} />
                  <Tooltip formatter={(value: number) => `${value}%`} />
                  <Bar dataKey="moraRate" name="Tasa Mora" fill="#f59e0b" radius={[0, 4, 4, 0]} />
                </BarChart>
              </ResponsiveContainer>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Collector Performance */}
      <Card className="shadow-lg border-0">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Users className="h-5 w-5 text-emerald-500" />
            Rendimiento de Cobradores
          </CardTitle>
          <CardDescription>Comparativa de eficiencia de cobro y tasa de mora</CardDescription>
        </CardHeader>
        <CardContent>
          <ScrollArea className="max-h-80">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Cobrador</TableHead>
                  <TableHead>Préstamos</TableHead>
                  <TableHead>En Mora</TableHead>
                  <TableHead>% Mora</TableHead>
                  <TableHead>Cobrado (7d)</TableHead>
                  <TableHead>Eficiencia</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {collectors.map((c) => (
                  <TableRow key={c.id}>
                    <TableCell className="font-medium">{c.name}</TableCell>
                    <TableCell>{c.totalLoans}</TableCell>
                    <TableCell>
                      <span className={c.moraLoans > 0 ? 'text-red-600 dark:text-red-300 font-semibold' : 'text-emerald-600 dark:text-emerald-300'}>
                        {c.moraLoans}
                      </span>
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center gap-2">
                        <Progress value={c.moraRate} className="h-2 w-16" />
                        <span className={c.moraRate > 30 ? 'text-red-600 dark:text-red-300' : c.moraRate > 15 ? 'text-amber-600 dark:text-amber-300' : 'text-emerald-600 dark:text-emerald-300'}>
                          {c.moraRate}%
                        </span>
                      </div>
                    </TableCell>
                    <TableCell>{formatCurrency(c.amount7Days)}</TableCell>
                    <TableCell>
                      <div className="flex items-center gap-2">
                        <Progress value={c.collectionRate} className="h-2 w-16" />
                        <span className={c.collectionRate > 70 ? 'text-emerald-600 dark:text-emerald-300' : c.collectionRate > 50 ? 'text-amber-600 dark:text-amber-300' : 'text-red-600 dark:text-red-300'}>
                          {c.collectionRate}%
                        </span>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </ScrollArea>
        </CardContent>
      </Card>

      {/* Reportes Avanzados */}
      <div className="space-y-6">
        <div className="flex items-center gap-2 border-b pb-2">
          <Activity className="h-5 w-5 text-emerald-500" />
          <h2 className="text-lg font-semibold text-slate-800 dark:text-slate-200">Reportes</h2>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Cobros por Día */}
          <Card className="shadow-lg border-0">
            <CardHeader>
              <CardTitle className="text-base">Cobros por Día</CardTitle>
              <CardDescription>Últimos 14 días</CardDescription>
            </CardHeader>
            <CardContent>
              {reports?.collectionsByDay && reports.collectionsByDay.length > 0 && (
                <ResponsiveContainer width="100%" height={280}>
                  <BarChart data={reports.collectionsByDay.slice(-14)}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                    <XAxis dataKey="date" tick={{ fontSize: 10 }} tickFormatter={(v) => v.slice(5)} />
                    <YAxis tick={{ fontSize: 10 }} tickFormatter={(v) => `S/${(v / 1000).toFixed(0)}k`} />
                    <Tooltip formatter={(value: number) => formatCurrency(value)} labelFormatter={(label) => `Fecha: ${label}`} />
                    <Bar dataKey="totalAmount" name="Monto Cobrado" fill="#10b981" radius={[4, 4, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              )}
            </CardContent>
          </Card>

          {/* Estado de Préstamos */}
          <Card className="shadow-lg border-0">
            <CardHeader>
              <CardTitle className="text-base">Estado de Préstamos</CardTitle>
              <CardDescription>Distribución actual</CardDescription>
            </CardHeader>
            <CardContent>
              {reports?.loansByStatus && (
                <ResponsiveContainer width="100%" height={280}>
                  <PieChart>
                    <Pie
                      data={[
                        { name: 'Activos', value: reports.loansByStatus.active, fill: '#10b981' },
                        { name: 'Mora', value: reports.loansByStatus.mora, fill: '#ef4444' },
                        { name: 'Completados', value: reports.loansByStatus.completed, fill: '#8b5cf6' },
                        { name: 'Cancelados', value: reports.loansByStatus.cancelled, fill: '#94a3b8' },
                        { name: 'Refinanciados', value: reports.loansByStatus.refinanced, fill: '#06b6d4' },
                      ]}
                      cx="50%" cy="50%" outerRadius={90} paddingAngle={3} dataKey="value"
                      label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`}
                    >
                      {[
                        { fill: '#10b981' },
                        { fill: '#ef4444' },
                        { fill: '#8b5cf6' },
                        { fill: '#94a3b8' },
                        { fill: '#06b6d4' },
                      ].map((entry, index) => (
                        <Cell key={`cell-${index}`} fill={entry.fill} />
                      ))}
                    </Pie>
                    <Tooltip formatter={(value: number) => [`${value} préstamos`, '']} />
                    <Legend />
                  </PieChart>
                </ResponsiveContainer>
              )}
            </CardContent>
          </Card>

          {/* Rendimiento por Zona */}
          <Card className="shadow-lg border-0">
            <CardHeader>
              <CardTitle className="text-base">Rendimiento por Zona</CardTitle>
              <CardDescription>Préstamos activos y en mora</CardDescription>
            </CardHeader>
            <CardContent>
              {reports?.zonePerformance && reports.zonePerformance.length > 0 && (
                <ResponsiveContainer width="100%" height={280}>
                  <BarChart data={reports.zonePerformance}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                    <XAxis dataKey="zoneName" tick={{ fontSize: 10 }} />
                    <YAxis tick={{ fontSize: 10 }} />
                    <Tooltip />
                    <Legend />
                    <Bar dataKey="activeLoans" name="Activos" fill="#10b981" radius={[4, 4, 0, 0]} />
                    <Bar dataKey="moraLoans" name="En Mora" fill="#ef4444" radius={[4, 4, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              )}
            </CardContent>
          </Card>

          {/* Ranking de Cobradores */}
          <Card className="shadow-lg border-0">
            <CardHeader>
              <CardTitle className="text-base">Ranking de Cobradores</CardTitle>
              <CardDescription>Top 5 por monto cobrado</CardDescription>
            </CardHeader>
            <CardContent>
              {reports?.collectorRanking && reports.collectorRanking.length > 0 && (
                <ScrollArea className="max-h-72">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>#</TableHead>
                        <TableHead>Cobrador</TableHead>
                        <TableHead className="text-right">Préstamos</TableHead>
                        <TableHead className="text-right">Total Cobrado</TableHead>
                        <TableHead className="text-right">Pagos</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {reports.collectorRanking.map((c, i) => (
                        <TableRow key={c.collectorId}>
                          <TableCell>
                            <span className={`inline-flex items-center justify-center w-6 h-6 rounded-full text-xs font-bold ${
                              i === 0 ? 'bg-amber-100 text-amber-700 dark:bg-amber-900 dark:text-amber-300' :
                              i === 1 ? 'bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-300' :
                              i === 2 ? 'bg-orange-100 text-orange-700 dark:bg-orange-900 dark:text-orange-300' :
                              'bg-slate-50 text-slate-500 dark:bg-slate-900 dark:text-slate-400'
                            }`}>
                              {i + 1}
                            </span>
                          </TableCell>
                          <TableCell className="font-medium">{c.collectorName}</TableCell>
                          <TableCell className="text-right text-slate-500 dark:text-slate-400">
                            {c.totalLoans}
                          </TableCell>
                          <TableCell className="text-right font-semibold text-emerald-600 dark:text-emerald-300">
                            {formatCurrency(c.totalCollected)}
                          </TableCell>
                          <TableCell className="text-right text-slate-500 dark:text-slate-400">
                            {c.count}
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </ScrollArea>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
