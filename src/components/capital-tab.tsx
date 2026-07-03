'use client';

import React, { useState, useEffect, useCallback } from 'react';
import {
  TrendingUp,
  TrendingDown,
  DollarSign,
  Wallet,
  ArrowUpCircle,
  ArrowDownCircle,
  RefreshCw,
  Loader2,
  ArrowRight,
  CircleDollarSign,
  Banknote,
} from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Textarea } from '@/components/ui/textarea';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
  Tooltip as RechartsTooltip,
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Area,
  AreaChart,
} from 'recharts';
import { useToast } from '@/hooks/use-toast';

// ============================================================
// Types
// ============================================================

interface CapitalMovement {
  id: string;
  type: string;
  amount: number;
  previousCapital: number;
  newCapital: number;
  description: string | null;
  createdAt: string;
}

interface CapitalSummary {
  totalInjections: number;
  totalWithdrawals: number;
  totalLoansOut: number;
  activeLoansOut: number;
}

interface CapitalData {
  currentCapital: number;
  summary: CapitalSummary;
  movements: CapitalMovement[];
}

interface CapitalTabProps {
  refreshTrigger?: number;
}

// ============================================================
// Helpers
// ============================================================

const formatCurrency = (amount: number) =>
  `S/${amount.toLocaleString('es-PE', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

const formatDateTime = (dateStr: string) => {
  const date = new Date(dateStr);
  return date.toLocaleDateString('es-PE', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
};

const formatDateShort = (dateStr: string) => {
  const date = new Date(dateStr);
  return date.toLocaleDateString('es-PE', {
    day: '2-digit',
    month: 'short',
  });
};

const getTypeBadge = (type: string) => {
  switch (type) {
    case 'INYECCION':
      return 'bg-emerald-100 dark:bg-emerald-900/50 text-emerald-800 dark:text-emerald-200 border-emerald-200';
    case 'RETIRO':
      return 'bg-amber-100 dark:bg-amber-900/50 text-amber-800 dark:text-amber-200 border-amber-200';
    case 'PRESTAMO':
      return 'bg-red-100 dark:bg-red-900/50 text-red-800 dark:text-red-200 border-red-200';
    default:
      return 'bg-background/70 dark:bg-[#05060b]/70 text-slate-800 dark:text-foreground border-input';
  }
};

const getTypeLabel = (type: string) => {
  switch (type) {
    case 'INYECCION':
      return 'Inyección';
    case 'RETIRO':
      return 'Retiro';
    case 'PRESTAMO':
      return 'Préstamo';
    default:
      return type;
  }
};

// ============================================================
// Capital Tab Component
// ============================================================

export default function CapitalTab({ refreshTrigger }: CapitalTabProps) {
  const { toast } = useToast();

  // State
  const [capitalData, setCapitalData] = useState<CapitalData | null>(null);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [dialogType, setDialogType] = useState<'INYECCION' | 'RETIRO'>('INYECCION');
  const [formAmount, setFormAmount] = useState('');
  const [formDescription, setFormDescription] = useState('');
  const [submitting, setSubmitting] = useState(false);

  // Fetch capital data
  const fetchCapital = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/capital');
      if (res.ok) {
        const data = await res.json();
        setCapitalData(data);
      } else {
        toast({
          title: 'Error',
          description: 'No se pudo cargar los datos de capital',
          variant: 'destructive',
        });
      }
    } catch {
      toast({
        title: 'Error',
        description: 'Error de conexión al cargar capital',
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  }, [toast]);

  useEffect(() => {
    fetchCapital();
  }, [fetchCapital, refreshTrigger]);

  // Open dialog
  const openDialog = (type: 'INYECCION' | 'RETIRO') => {
    setDialogType(type);
    setFormAmount('');
    setFormDescription('');
    setDialogOpen(true);
  };

  // Submit movement
  const handleSubmit = async () => {
    const amount = parseFloat(formAmount);
    if (!amount || amount <= 0) {
      toast({
        title: 'Monto inválido',
        description: 'Ingrese un monto mayor a 0',
        variant: 'destructive',
      });
      return;
    }

    if (dialogType === 'RETIRO' && capitalData && amount > capitalData.currentCapital) {
      toast({
        title: 'Capital insuficiente',
        description: `Capital disponible: ${formatCurrency(capitalData.currentCapital)}`,
        variant: 'destructive',
      });
      return;
    }

    setSubmitting(true);
    try {
      const res = await fetch('/api/capital', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          type: dialogType,
          amount,
          description: formDescription || undefined,
        }),
      });

      if (res.ok) {
        toast({
          title: dialogType === 'INYECCION' ? 'Capital inyectado' : 'Capital retirado',
          description: `${formatCurrency(amount)} ${dialogType === 'INYECCION' ? 'inyectado' : 'retirado'} exitosamente`,
        });
        setDialogOpen(false);
        fetchCapital();
      } else {
        const data = await res.json();
        toast({
          title: 'Error',
          description: data.error || 'No se pudo registrar el movimiento',
          variant: 'destructive',
        });
      }
    } catch {
      toast({
        title: 'Error',
        description: 'Error de conexión',
        variant: 'destructive',
      });
    } finally {
      setSubmitting(false);
    }
  };

  // Computed values
  const currentCapital = capitalData?.currentCapital || 0;
  const activeLoansOut = capitalData?.summary.activeLoansOut || 0;
  const totalInjections = capitalData?.summary.totalInjections || 0;
  const totalWithdrawals = capitalData?.summary.totalWithdrawals || 0;
  const totalInvested = currentCapital + activeLoansOut;

  // Donut chart data
  const pieData = [
    { name: 'Capital Disponible', value: currentCapital, fill: '#10b981' },
    { name: 'Prestado Activo', value: activeLoansOut, fill: '#14b8a6' },
  ].filter((d) => d.value > 0);

  // If no data at all, show placeholder
  if (pieData.length === 0) {
    pieData.push({ name: 'Sin datos', value: 1, fill: '#e2e8f0' });
  }

  // Capital trend chart data - reverse movements to show chronological order
  const trendData = capitalData
    ? [...capitalData.movements]
        .reverse()
        .map((m) => ({
          date: formatDateShort(m.createdAt),
          capital: m.newCapital,
          type: m.type,
          amount: m.amount,
        }))
    : [];

  // Calculate new capital preview for dialog
  const previewNewCapital =
    dialogType === 'INYECCION'
      ? currentCapital + (parseFloat(formAmount) || 0)
      : currentCapital - (parseFloat(formAmount) || 0);

  // Loading state
  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="h-8 w-8 animate-spin text-emerald-500" />
        <span className="ml-3 text-muted-foreground dark:text-muted-foreground">Cargando capital...</span>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* ============================================================ */}
      {/* Capital Overview - Big Hero Display */}
      {/* ============================================================ */}
      <Card className="border-0 shadow-lg overflow-hidden">
        <div className="bg-gradient-to-r from-emerald-600 via-teal-600 to-emerald-700 p-6 md:p-8">
          <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-6">
            <div className="flex-1">
              <p className="text-emerald-100 text-sm font-medium flex items-center gap-2">
                <CircleDollarSign className="h-4 w-4" />
                Capital Disponible del Negocio
              </p>
              <p className="text-4xl md:text-5xl font-bold text-white mt-2 tracking-tight">
                {formatCurrency(currentCapital)}
              </p>
              <div className="flex flex-wrap items-center gap-4 mt-4">
                <div className="flex items-center gap-2 bg-white/15 rounded-lg px-3 py-1.5">
                  <div className="w-2.5 h-2.5 rounded-full bg-emerald-300" />
                  <span className="text-white/90 text-xs font-medium">Disponible: {formatCurrency(currentCapital)}</span>
                </div>
                <div className="flex items-center gap-2 bg-white/15 rounded-lg px-3 py-1.5">
                  <div className="w-2.5 h-2.5 rounded-full bg-teal-300" />
                  <span className="text-white/90 text-xs font-medium">Prestado: {formatCurrency(activeLoansOut)}</span>
                </div>
                <div className="flex items-center gap-2 bg-white/15 rounded-lg px-3 py-1.5">
                  <div className="w-2.5 h-2.5 rounded-full bg-white/50" />
                  <span className="text-white/90 text-xs font-medium">Total: {formatCurrency(totalInvested)}</span>
                </div>
              </div>
            </div>
            <div className="w-full md:w-auto flex gap-3">
              <Button
                onClick={() => openDialog('INYECCION')}
                className="bg-white dark:bg-[#05060b]/80 text-emerald-700 dark:text-emerald-300 hover:bg-emerald-50 dark:hover:bg-emerald-950/50 font-semibold shadow-lg flex-1 md:flex-none"
              >
                <ArrowUpCircle className="h-4 w-4 mr-2" />
                Inyectar Capital
              </Button>
              <Button
                onClick={() => openDialog('RETIRO')}
                variant="outline"
                className="border-white/30 text-white bg-white/15 hover:bg-white/25 font-semibold flex-1 md:flex-none"
              >
                <ArrowDownCircle className="h-4 w-4 mr-2" />
                Retirar Capital
              </Button>
            </div>
          </div>
        </div>
      </Card>

      {/* ============================================================ */}
      {/* Summary Cards */}
      {/* ============================================================ */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {/* Capital Disponible - Emerald */}
        <Card className="border-0 shadow-md bg-gradient-to-br from-emerald-500 to-emerald-600 text-white">
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-emerald-100 text-xs font-medium">Capital Disponible</p>
                <p className="text-xl font-bold mt-1">{formatCurrency(currentCapital)}</p>
              </div>
              <Wallet className="h-7 w-7 text-emerald-200" />
            </div>
          </CardContent>
        </Card>

        {/* Préstamos Activos - Teal */}
        <Card className="border-0 shadow-md bg-gradient-to-br from-teal-500 to-teal-600 text-white">
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-teal-100 text-xs font-medium">Préstamos Activos</p>
                <p className="text-xl font-bold mt-1">{formatCurrency(activeLoansOut)}</p>
              </div>
              <TrendingUp className="h-7 w-7 text-teal-200" />
            </div>
          </CardContent>
        </Card>

        {/* Total Inyectado - Sky */}
        <Card className="border-0 shadow-md bg-gradient-to-br from-sky-500 to-sky-600 text-white">
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sky-100 text-xs font-medium">Total Inyectado</p>
                <p className="text-xl font-bold mt-1">{formatCurrency(totalInjections)}</p>
              </div>
              <ArrowUpCircle className="h-7 w-7 text-sky-200" />
            </div>
          </CardContent>
        </Card>

        {/* Total Retirado - Amber */}
        <Card className="border-0 shadow-md bg-gradient-to-br from-amber-500 to-amber-600 text-white">
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-amber-100 text-xs font-medium">Total Retirado</p>
                <p className="text-xl font-bold mt-1">{formatCurrency(totalWithdrawals)}</p>
              </div>
              <ArrowDownCircle className="h-7 w-7 text-amber-200" />
            </div>
          </CardContent>
        </Card>
      </div>

      {/* ============================================================ */}
      {/* Charts Row: Donut + Trend */}
      {/* ============================================================ */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Capital Distribution Donut */}
        <Card className="shadow-lg border-0">
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2">
              <Banknote className="h-4 w-4 text-emerald-500" />
              Distribución del Capital
            </CardTitle>
            <CardDescription>Capital disponible vs. capital prestado activo</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="flex items-center justify-center">
              <ResponsiveContainer width="100%" height={260}>
                <PieChart>
                  <Pie
                    data={pieData}
                    cx="50%"
                    cy="50%"
                    innerRadius={65}
                    outerRadius={100}
                    paddingAngle={3}
                    dataKey="value"
                    label={({ name, percent }) =>
                      `${name} ${(percent * 100).toFixed(0)}%`
                    }
                    labelLine={false}
                  >
                    {pieData.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={entry.fill} stroke="none" />
                    ))}
                  </Pie>
                  <RechartsTooltip
                    formatter={(value: number) => [formatCurrency(value), '']}
                  />
                </PieChart>
              </ResponsiveContainer>
            </div>
            {/* Legend */}
            <div className="flex items-center justify-center gap-6 mt-2">
              <div className="flex items-center gap-2">
                <div className="w-3 h-3 rounded-full bg-emerald-500" />
                <span className="text-xs text-foreground/70 dark:text-muted-foreground">Disponible ({formatCurrency(currentCapital)})</span>
              </div>
              <div className="flex items-center gap-2">
                <div className="w-3 h-3 rounded-full bg-teal-500" />
                <span className="text-xs text-foreground/70 dark:text-muted-foreground">Prestado ({formatCurrency(activeLoansOut)})</span>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Capital Trend Line Chart */}
        <Card className="shadow-lg border-0">
          <CardHeader>
            <div className="flex items-center justify-between">
              <div>
                <CardTitle className="text-base flex items-center gap-2">
                  <TrendingUp className="h-4 w-4 text-teal-500" />
                  Tendencia del Capital
                </CardTitle>
                <CardDescription>Evolución del capital en el tiempo</CardDescription>
              </div>
              <Button
                size="sm"
                variant="outline"
                className="border-input"
                onClick={fetchCapital}
              >
                <RefreshCw className="h-3.5 w-3.5 mr-1" />
                Actualizar
              </Button>
            </div>
          </CardHeader>
          <CardContent>
            {trendData.length > 0 ? (
              <ResponsiveContainer width="100%" height={280}>
                <AreaChart data={trendData}>
                  <defs>
                    <linearGradient id="capitalGradient" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#10b981" stopOpacity={0.3} />
                      <stop offset="95%" stopColor="#10b981" stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                  <XAxis
                    dataKey="date"
                    tick={{ fontSize: 10 }}
                  />
                  <YAxis
                    tick={{ fontSize: 10 }}
                    tickFormatter={(v: number) => `S/${(v / 1000).toFixed(0)}k`}
                  />
                  <RechartsTooltip
                    formatter={(value: number) => [formatCurrency(value), 'Capital']}
                    labelFormatter={(label: string) => `Fecha: ${label}`}
                  />
                  <Area
                    type="monotone"
                    dataKey="capital"
                    stroke="#10b981"
                    fill="url(#capitalGradient)"
                    strokeWidth={2.5}
                    name="Capital"
                    dot={{ r: 3, fill: '#10b981', stroke: '#fff', strokeWidth: 2 }}
                    activeDot={{ r: 5, fill: '#10b981', stroke: '#fff', strokeWidth: 2 }}
                  />
                </AreaChart>
              </ResponsiveContainer>
            ) : (
              <div className="flex items-center justify-center h-[280px] text-muted-foreground">
                <div className="text-center">
                  <DollarSign className="h-12 w-12 mx-auto mb-2 opacity-30" />
                  <p className="text-sm">Sin movimientos registrados</p>
                  <p className="text-xs mt-1">Inyecte capital para ver la tendencia</p>
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* ============================================================ */}
      {/* Movement History Table */}
      {/* ============================================================ */}
      <Card className="shadow-lg border-0">
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="text-base flex items-center gap-2">
                <DollarSign className="h-4 w-4 text-emerald-500" />
                Historial de Movimientos de Capital
              </CardTitle>
              <CardDescription>
                Registro de inyecciones, retiros y préstamos
              </CardDescription>
            </div>
            <Badge variant="outline" className="bg-background/50 dark:bg-[#05060b]/70 text-foreground/70 dark:text-muted-foreground border-input">
              {capitalData?.movements.length || 0} movimientos
            </Badge>
          </div>
        </CardHeader>
        <CardContent className="p-0">
          {capitalData && capitalData.movements.length > 0 ? (
            <ScrollArea className="max-h-96">
              <Table>
                <TableHeader>
                  <TableRow className="bg-background/50/80 dark:bg-[#05060b]/70/80">
                    <TableHead className="font-semibold">Fecha</TableHead>
                    <TableHead className="font-semibold">Tipo</TableHead>
                    <TableHead className="font-semibold text-right">Monto</TableHead>
                    <TableHead className="font-semibold text-right hidden md:table-cell">Capital Anterior</TableHead>
                    <TableHead className="font-semibold text-right hidden md:table-cell">Capital Nuevo</TableHead>
                    <TableHead className="font-semibold hidden lg:table-cell">Descripción</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {capitalData.movements.map((m) => (
                    <TableRow key={m.id} className="hover:bg-background/50/50 dark:hover:bg-white/10/50">
                      <TableCell className="text-sm text-foreground/70 dark:text-muted-foreground whitespace-nowrap">
                        {formatDateTime(m.createdAt)}
                      </TableCell>
                      <TableCell>
                        <Badge variant="outline" className={getTypeBadge(m.type)}>
                          {getTypeLabel(m.type)}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-right font-semibold whitespace-nowrap">
                        <span
                          className={
                            m.type === 'INYECCION'
                              ? 'text-emerald-600 dark:text-emerald-300'
                              : m.type === 'RETIRO'
                              ? 'text-amber-600 dark:text-amber-300'
                              : 'text-red-600 dark:text-red-300'
                          }
                        >
                          {m.type === 'INYECCION' ? '+' : '-'}
                          {formatCurrency(m.amount)}
                        </span>
                      </TableCell>
                      <TableCell className="text-right text-sm text-muted-foreground dark:text-muted-foreground hidden md:table-cell whitespace-nowrap">
                        {formatCurrency(m.previousCapital)}
                      </TableCell>
                      <TableCell className="text-right text-sm font-medium text-foreground/80 dark:text-foreground/80 hidden md:table-cell whitespace-nowrap">
                        {formatCurrency(m.newCapital)}
                      </TableCell>
                      <TableCell className="text-sm text-muted-foreground dark:text-muted-foreground max-w-48 truncate hidden lg:table-cell">
                        {m.description || '—'}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </ScrollArea>
          ) : (
            <div className="flex items-center justify-center py-12 text-muted-foreground">
              <div className="text-center">
                <DollarSign className="h-12 w-12 mx-auto mb-2 opacity-30" />
                <p className="text-sm">No hay movimientos de capital</p>
                <p className="text-xs mt-1">
                  Haga clic en &quot;Inyectar Capital&quot; para comenzar
                </p>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* ============================================================ */}
      {/* Movement Dialog (Inyectar / Retirar) */}
      {/* ============================================================ */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle
              className={`flex items-center gap-2 ${
                dialogType === 'INYECCION' ? 'text-emerald-700 dark:text-emerald-300' : 'text-amber-700 dark:text-amber-300'
              }`}
            >
              {dialogType === 'INYECCION' ? (
                <ArrowUpCircle className="h-5 w-5" />
              ) : (
                <ArrowDownCircle className="h-5 w-5" />
              )}
              {dialogType === 'INYECCION' ? 'Inyectar Capital' : 'Retirar Capital'}
            </DialogTitle>
            <DialogDescription>
              {dialogType === 'INYECCION'
                ? 'Agregue capital al negocio para incrementar el fondo disponible.'
                : 'Retire capital del negocio. El monto no puede exceder el capital disponible.'}
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-2">
            {/* Type indicator */}
            <div className="flex items-center gap-2 p-3 rounded-lg bg-background/50 dark:bg-[#05060b]/70 border border-input/50 dark:border-emerald-500/10">
              <span className="text-sm text-muted-foreground dark:text-muted-foreground">Tipo:</span>
              <Badge
                variant="outline"
                className={
                  dialogType === 'INYECCION'
                    ? 'bg-emerald-100 dark:bg-emerald-900/50 text-emerald-800 dark:text-emerald-200 border-emerald-200'
                    : 'bg-amber-100 dark:bg-amber-900/50 text-amber-800 dark:text-amber-200 border-amber-200'
                }
              >
                {dialogType === 'INYECCION' ? 'Inyección' : 'Retiro'}
              </Badge>
            </div>

            {/* Amount */}
            <div className="space-y-2">
              <Label htmlFor="capital-amount" className="font-medium">
                Monto (S/)
              </Label>
              <Input
                id="capital-amount"
                type="number"
                min="0"
                step="0.01"
                placeholder="0.00"
                value={formAmount}
                onChange={(e) => setFormAmount(e.target.value)}
                className="text-lg font-semibold"
              />
            </div>

            {/* Description */}
            <div className="space-y-2">
              <Label htmlFor="capital-description" className="font-medium">
                Descripción <span className="text-muted-foreground font-normal">(opcional)</span>
              </Label>
              <Textarea
                id="capital-description"
                placeholder={
                  dialogType === 'INYECCION'
                    ? 'Ej: Aporte personal, préstamo bancario...'
                    : 'Ej: Gasto operativo, pago de servicio...'
                }
                value={formDescription}
                onChange={(e) => setFormDescription(e.target.value)}
                rows={2}
              />
            </div>

            <Separator />

            {/* Confirmation Preview */}
            <div className="rounded-lg bg-background/50 dark:bg-[#05060b]/70 border border-input/50 dark:border-emerald-500/10 p-4">
              <p className="text-xs font-medium text-muted-foreground dark:text-muted-foreground mb-2">Vista previa del movimiento</p>
              <div className="flex items-center justify-between">
                <div className="text-center">
                  <p className="text-xs text-muted-foreground">Capital anterior</p>
                  <p className="text-sm font-semibold text-foreground/80 dark:text-foreground/80">
                    {formatCurrency(currentCapital)}
                  </p>
                </div>
                <div className="flex flex-col items-center">
                  {dialogType === 'INYECCION' ? (
                    <ArrowUpCircle className="h-5 w-5 text-emerald-500" />
                  ) : (
                    <ArrowDownCircle className="h-5 w-5 text-amber-500" />
                  )}
                  <span className="text-xs font-medium mt-0.5">
                    {formAmount ? formatCurrency(parseFloat(formAmount) || 0) : 'S/0.00'}
                  </span>
                </div>
                <ArrowRight className="h-4 w-4 text-slate-300" />
                <div className="text-center">
                  <p className="text-xs text-muted-foreground">Capital nuevo</p>
                  <p
                    className={`text-sm font-bold ${
                      previewNewCapital >= currentCapital
                        ? 'text-emerald-600 dark:text-emerald-300'
                        : 'text-amber-600 dark:text-amber-300'
                    }`}
                  >
                    {formatCurrency(Math.max(0, previewNewCapital))}
                  </p>
                </div>
              </div>
            </div>

            {/* Warning for withdrawal */}
            {dialogType === 'RETIRO' &&
              formAmount &&
              parseFloat(formAmount) > currentCapital && (
                <div className="flex items-center gap-2 p-3 rounded-lg bg-red-50 dark:bg-red-950/50 border border-red-100">
                  <span className="text-red-600 dark:text-red-300 text-sm font-medium">
                    El monto excede el capital disponible ({formatCurrency(currentCapital)})
                  </span>
                </div>
              )}
          </div>

          <DialogFooter className="flex gap-2 sm:gap-2">
            <Button
              variant="outline"
              onClick={() => setDialogOpen(false)}
              disabled={submitting}
            >
              Cancelar
            </Button>
            <Button
              onClick={handleSubmit}
              disabled={
                submitting ||
                !formAmount ||
                parseFloat(formAmount) <= 0 ||
                (dialogType === 'RETIRO' && parseFloat(formAmount) > currentCapital)
              }
              className={
                dialogType === 'INYECCION'
                  ? 'bg-emerald-600 hover:bg-emerald-700'
                  : 'bg-amber-600 hover:bg-amber-700'
              }
            >
              {submitting ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Procesando...
                </>
              ) : dialogType === 'INYECCION' ? (
                <>
                  <ArrowUpCircle className="h-4 w-4 mr-2" />
                  Inyectar
                </>
              ) : (
                <>
                  <ArrowDownCircle className="h-4 w-4 mr-2" />
                  Retirar
                </>
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
