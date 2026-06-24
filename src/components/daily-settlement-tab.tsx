'use client';
import { useState, useEffect, useCallback, useMemo } from 'react';
import { useAuth } from '@/hooks/use-auth';
import { useToast } from '@/hooks/use-toast';
import { formatCurrency } from '@/lib/format-helpers';
import { CheckCircle2, XCircle, Clock, DollarSign, TrendingUp, TrendingDown, Wallet } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';

interface DailySettlement {
  id: string;
  collectorId: string;
  collectorName?: string;
  date: string;
  expectedCount: number;
  expectedAmount: number;
  collectedCount: number;
  collectedAmount: number;
  difference: number;
  notes: string | null;
  status: 'pending' | 'approved' | 'disputed';
  createdAt: string;
}

interface ActiveLoan {
  id: string;
  clientId: string;
  dailyPayment: number;
  client: { name: string };
}

interface Payment {
  id: string;
  amount: number;
  paymentMethod: string;
}

const STATUS_BADGE: Record<string, { label: string; class: string }> = {
  pending: { label: 'Pendiente', class: 'bg-amber-100 text-amber-800 border-amber-200' },
  approved: { label: 'Aprobado', class: 'bg-emerald-100 text-emerald-800 border-emerald-200' },
  disputed: { label: 'Disputado', class: 'bg-red-100 text-red-800 border-red-200' },
};

const STATUS_ICON: Record<string, React.ReactNode> = {
  pending: <Clock className="h-3.5 w-3.5" />,
  approved: <CheckCircle2 className="h-3.5 w-3.5" />,
  disputed: <XCircle className="h-3.5 w-3.5" />,
};

const PAYMENT_METHOD_CONFIG: Record<string, { label: string; bgClass: string; borderClass: string; textClass: string; lightBg: string }> = {
  efectivo: { label: 'Efectivo', bgClass: 'bg-emerald-50 dark:bg-emerald-950', borderClass: 'border-emerald-200 dark:border-emerald-800', textClass: 'text-emerald-700 dark:text-emerald-300', lightBg: 'bg-emerald-100 dark:bg-emerald-900' },
  yape: { label: 'Yape', bgClass: 'bg-blue-50 dark:bg-blue-950', borderClass: 'border-blue-200 dark:border-blue-800', textClass: 'text-blue-700 dark:text-blue-300', lightBg: 'bg-blue-100 dark:bg-blue-900' },
  plin: { label: 'Plin', bgClass: 'bg-purple-50 dark:bg-purple-950', borderClass: 'border-purple-200 dark:border-purple-800', textClass: 'text-purple-700 dark:text-purple-300', lightBg: 'bg-purple-100 dark:bg-purple-900' },
  transferencia: { label: 'Transferencia', bgClass: 'bg-amber-50 dark:bg-amber-950', borderClass: 'border-amber-200 dark:border-amber-800', textClass: 'text-amber-700 dark:text-amber-300', lightBg: 'bg-amber-100 dark:bg-amber-900' },
};

export default function DailySettlementTab() {
  const { user } = useAuth();
  const { toast } = useToast();
  const isAdmin = user?.role === 'admin' || user?.role === 'supervisor';

  if (!user) return null;

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <div className="p-2.5 rounded-xl bg-emerald-50 dark:bg-emerald-950 border border-emerald-100 dark:border-emerald-900">
          <Wallet className="h-5 w-5 text-emerald-600 dark:text-emerald-400" />
        </div>
        <div>
          <h2 className="text-xl font-bold text-slate-900 dark:text-slate-100">Cierre de Caja</h2>
          <p className="text-sm text-slate-500">
            {isAdmin ? 'Administración de cierres de cobradores' : 'Registra tu cierre diario'}
          </p>
        </div>
      </div>

      {isAdmin ? (
        <AdminView user={user} toast={toast} />
      ) : (
        <CollectorView user={user} toast={toast} />
      )}
    </div>
  );
}

// ============================================================
// Collector View
// ============================================================
function CollectorView({ user, toast }: { user: { id: string; name: string }; toast: ReturnType<typeof useToast>['toast'] }) {
  const [loading, setLoading] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [activeLoans, setActiveLoans] = useState<ActiveLoan[]>([]);
  const [settlements, setSettlements] = useState<DailySettlement[]>([]);
  const [lastSettlement, setLastSettlement] = useState<DailySettlement | null>(null);
  const [payments, setPayments] = useState<Payment[]>([]);
  const [collectedCount, setCollectedCount] = useState('');
  const [collectedAmount, setCollectedAmount] = useState('');
  const [notes, setNotes] = useState('');

  const today = new Date().toISOString().split('T')[0];
  const todayFormatted = new Date().toLocaleDateString('es-PE', {
    weekday: 'long', day: 'numeric', month: 'long', year: 'numeric',
  });

  const expectedCount = activeLoans.length;
  const expectedAmount = activeLoans.reduce((sum, l) => sum + l.dailyPayment, 0);
  const diff = parseFloat(collectedAmount || '0') - expectedAmount;

  const paymentBreakdown = useMemo(() => {
    const map: Record<string, { count: number; total: number }> = {};
    for (const p of payments) {
      if (!map[p.paymentMethod]) map[p.paymentMethod] = { count: 0, total: 0 };
      map[p.paymentMethod].count++;
      map[p.paymentMethod].total += p.amount;
    }
    return map;
  }, [payments]);

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const [loansRes, settlementsRes, paymentsRes, allLoansRes] = await Promise.all([
        fetch(`/api/loans?status=active&collectorId=${user.id}&limit=500`),
        fetch(`/api/daily-settlements?collectorId=${user.id}`),
        fetch(`/api/payments?collectorId=${user.id}&date=${today}&limit=500`),
        fetch(`/api/loans?status=mora&collectorId=${user.id}&limit=500`),
      ]);
      const loansData = await loansRes.json();
      const settlementsData = await settlementsRes.json();
      const paymentsData = await paymentsRes.json();
      const moraLoansData = await allLoansRes.json();

      const loans = [...(Array.isArray(loansData) ? loansData : loansData?.loans || []), ...(Array.isArray(moraLoansData) ? moraLoansData : moraLoansData?.loans || [])];
      setActiveLoans(loans);

      const s = Array.isArray(settlementsData) ? settlementsData : [];
      setSettlements(s);

      const todayPayments = Array.isArray(paymentsData) ? paymentsData : paymentsData?.payments || [];
      setPayments(todayPayments);

      const todaySettlement = s.find((st: DailySettlement) => st.date === today);
      if (todaySettlement) {
        setLastSettlement(todaySettlement);
        setCollectedCount(String(todaySettlement.collectedCount));
        setCollectedAmount(String(todaySettlement.collectedAmount));
        setNotes(todaySettlement.notes || '');
      } else {
        const totalAmount = todayPayments.reduce((sum: number, p: Payment) => sum + p.amount, 0);
        setCollectedCount(String(todayPayments.length));
        setCollectedAmount(String(totalAmount));
      }
    } catch (err) {
      console.error('Error fetching data:', err);
    } finally {
      setLoading(false);
    }
  }, [user.id, today]);

  useEffect(() => { fetchData(); }, [fetchData]);

  const handleSubmit = async () => {
    const count = parseInt(collectedCount);
    const amount = parseFloat(collectedAmount);
    if (isNaN(count) || count < 0) {
      toast({ title: 'Error', description: 'Ingrese un número válido de cobros realizados', variant: 'destructive' });
      return;
    }
    if (isNaN(amount) || amount < 0) {
      toast({ title: 'Error', description: 'Ingrese un monto recaudado válido', variant: 'destructive' });
      return;
    }

    setSubmitting(true);
    try {
      const method = lastSettlement ? 'PUT' : 'POST';
      const body = lastSettlement
        ? { id: lastSettlement.id, status: 'pending' }
        : {
            collectorId: user.id,
            date: today,
            expectedCount,
            expectedAmount,
            collectedCount: count,
            collectedAmount: amount,
            difference: amount - expectedAmount,
            notes: notes || null,
          };

      const res = await fetch('/api/daily-settlements', {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });

      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || 'Error al registrar cierre');
      }

      const data = await res.json();
      setLastSettlement(data);
      toast({ title: 'Cierre registrado', description: 'Cierre de caja guardado exitosamente' });
      fetchData();
    } catch (err) {
      toast({ title: 'Error', description: err instanceof Error ? err.message : 'Error al guardar', variant: 'destructive' });
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-emerald-500" />
      </div>
    );
  }

  const recentSettlements = settlements.filter((s) => s.date !== today).slice(0, 10);

  return (
    <div className="space-y-6">
      {/* Today's Summary Card */}
      <Card>
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <CardTitle className="text-base">Cierre de Caja - Hoy</CardTitle>
            <Badge variant="outline" className="text-xs font-normal capitalize">
              {todayFormatted}
            </Badge>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          {lastSettlement?.status === 'approved' && (
            <div className="p-3 rounded-lg bg-emerald-50 dark:bg-emerald-950 border border-emerald-200 dark:border-emerald-800 flex items-center gap-2 text-sm text-emerald-700 dark:text-emerald-300">
              <CheckCircle2 className="h-4 w-4" />
              Cierre aprobado
            </div>
          )}
          {lastSettlement?.status === 'disputed' && (
            <div className="p-3 rounded-lg bg-red-50 dark:bg-red-950 border border-red-200 dark:border-red-800 flex items-center gap-2 text-sm text-red-700 dark:text-red-300">
              <XCircle className="h-4 w-4" />
              Cierre disputado - Pendiente de revisión
            </div>
          )}

          {/* Expected */}
          <div className="grid grid-cols-2 gap-4">
            <div className="p-4 rounded-xl bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800">
              <div className="flex items-center gap-2 text-sm text-slate-500 mb-2">
                <DollarSign className="h-4 w-4" />
                Esperado
              </div>
              <p className="text-2xl font-bold text-slate-900 dark:text-slate-100">{formatCurrency(expectedAmount)}</p>
              <p className="text-xs text-slate-400">{expectedCount} cobro{expectedCount !== 1 ? 's' : ''} pendiente{expectedCount !== 1 ? 's' : ''}</p>
            </div>
            <div className="p-4 rounded-xl bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800">
              <div className="flex items-center gap-2 text-sm text-slate-500 mb-2">
                <Wallet className="h-4 w-4" />
                Recaudado
              </div>
              <p className="text-2xl font-bold text-emerald-600 dark:text-emerald-400">
                {collectedAmount ? formatCurrency(parseFloat(collectedAmount)) : formatCurrency(0)}
              </p>
              <p className="text-xs text-slate-400">{collectedCount || '0'} cobro{parseInt(collectedCount || '0') !== 1 ? 's' : ''}</p>
            </div>
          </div>

          {/* Difference */}
          {parseFloat(collectedAmount || '0') > 0 && (
            <div className={`p-3 rounded-lg flex items-center gap-2 text-sm ${diff >= 0
              ? 'bg-emerald-50 dark:bg-emerald-950 text-emerald-700 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800'
              : 'bg-red-50 dark:bg-red-950 text-red-700 dark:text-red-300 border border-red-200 dark:border-red-800'
              }`}>
              {diff >= 0 ? <TrendingUp className="h-4 w-4" /> : <TrendingDown className="h-4 w-4" />}
              Diferencia: {formatCurrency(Math.abs(diff))} ({diff >= 0 ? 'sobre' : 'debajo'} lo esperado)
            </div>
          )}

          {/* Payment Method Breakdown */}
          <div>
            <h4 className="text-sm font-medium text-slate-700 dark:text-slate-300 mb-3">Desglose por método de pago</h4>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              {Object.entries(PAYMENT_METHOD_CONFIG).map(([key, config]) => {
                const data = paymentBreakdown[key];
                return (
                  <div key={key} className={`p-3 rounded-xl ${config.bgClass} border ${config.borderClass}`}>
                    <p className={`text-xs font-medium ${config.textClass} mb-1`}>{config.label}</p>
                    {data ? (
                      <>
                        <p className={`text-lg font-bold ${config.textClass}`}>{formatCurrency(data.total)}</p>
                        <p className={`text-xs ${config.textClass} opacity-75`}>{data.count} pago{data.count !== 1 ? 's' : ''}</p>
                      </>
                    ) : (
                      <>
                        <p className={`text-lg font-bold ${config.textClass}`}>{formatCurrency(0)}</p>
                        <p className={`text-xs ${config.textClass} opacity-75`}>0 pagos</p>
                      </>
                    )}
                  </div>
                );
              })}
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="notes">Notas (opcional)</Label>
            <Textarea
              id="notes"
              placeholder="Observaciones del día..."
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              disabled={!!lastSettlement}
              rows={3}
            />
          </div>

          {!lastSettlement && (
            <Button onClick={handleSubmit} disabled={submitting} className="w-full">
              {submitting ? 'Guardando...' : 'Registrar Cierre'}
            </Button>
          )}
          {lastSettlement && (
            <div className="p-4 rounded-xl bg-blue-50 dark:bg-blue-950 border border-blue-200 dark:border-blue-800">
              <p className="text-sm font-medium text-blue-700 dark:text-blue-300 flex items-center gap-2">
                <CheckCircle2 className="h-4 w-4" />
                Cierre registrado hoy
              </p>
              <div className="mt-2 text-sm text-blue-600 dark:text-blue-400 space-y-1">
                <p>Esperado: {formatCurrency(lastSettlement.expectedAmount)} ({lastSettlement.expectedCount} cobros)</p>
                <p>Recaudado: {formatCurrency(lastSettlement.collectedAmount)} ({lastSettlement.collectedCount} cobros)</p>
                <p>Diferencia: {formatCurrency(lastSettlement.difference)}</p>
                <Badge variant="outline" className={`mt-1 ${STATUS_BADGE[lastSettlement.status]?.class}`}>
                  {STATUS_ICON[lastSettlement.status]}
                  <span className="ml-1">{STATUS_BADGE[lastSettlement.status]?.label}</span>
                </Badge>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Recent Settlements */}
      {recentSettlements.length > 0 && (
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base">Cierres Anteriores</CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            <Table>
              <TableHeader>
                <TableRow className="bg-emerald-50 dark:bg-emerald-950/50 text-emerald-700 dark:text-emerald-300">
                  <TableHead className="px-3 py-2">Fecha</TableHead>
                  <TableHead className="px-3 py-2 text-right">Esperado</TableHead>
                  <TableHead className="px-3 py-2 text-right">Recaudado</TableHead>
                  <TableHead className="px-3 py-2 text-right">Dif.</TableHead>
                  <TableHead className="px-3 py-2">Estado</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {recentSettlements.map((s) => (
                  <TableRow key={s.id} className="hover:bg-slate-50 dark:hover:bg-slate-800/30 transition-colors">
                    <TableCell className="text-sm px-3 py-2">{new Date(s.date).toLocaleDateString('es-PE')}</TableCell>
                    <TableCell className="px-3 py-2 text-right">{formatCurrency(s.expectedAmount)}</TableCell>
                    <TableCell className="px-3 py-2 text-right">{formatCurrency(s.collectedAmount)}</TableCell>
                    <TableCell className="px-3 py-2 text-right">
                      <span className={s.difference >= 0 ? 'text-emerald-600' : 'text-red-600'}>
                        {s.difference >= 0 ? '+' : ''}{formatCurrency(s.difference)}
                      </span>
                    </TableCell>
                    <TableCell className="px-3 py-2">
                      <Badge variant="outline" className={`text-xs ${STATUS_BADGE[s.status]?.class}`}>
                        {STATUS_ICON[s.status]}
                        <span className="ml-1">{STATUS_BADGE[s.status]?.label}</span>
                      </Badge>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      )}
    </div>
  );
}

// ============================================================
// Admin View
// ============================================================
function AdminView({ user, toast }: { user: { id: string; name: string }; toast: ReturnType<typeof useToast>['toast'] }) {
  const [settlements, setSettlements] = useState<DailySettlement[]>([]);
  const [loading, setLoading] = useState(true);
  const [filterCollector, setFilterCollector] = useState('');
  const [filterDate, setFilterDate] = useState('');
  const [filterStatus, setFilterStatus] = useState('');
  const [collectors, setCollectors] = useState<{ id: string; name: string }[]>([]);

  const fetchSettlements = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (filterCollector) params.set('collectorId', filterCollector);
      if (filterDate) params.set('date', filterDate);
      if (filterStatus) params.set('status', filterStatus);

      const res = await fetch(`/api/daily-settlements?${params.toString()}`);
      const data = await res.json();
      setSettlements(Array.isArray(data) ? data : []);
    } catch (err) {
      console.error('Error fetching settlements:', err);
    } finally {
      setLoading(false);
    }
  }, [filterCollector, filterDate, filterStatus]);

  useEffect(() => {
    fetchSettlements();
    // Fetch collectors for filter
    fetch('/api/collectors').then((r) => r.json()).then((data) => {
      const list = Array.isArray(data) ? data : data?.collectors || [];
      setCollectors(list);
    }).catch(() => {});
  }, [fetchSettlements]);

  const handleApprove = async (id: string) => {
    try {
      const res = await fetch('/api/daily-settlements', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id, status: 'approved' }),
      });
      if (!res.ok) throw new Error('Error al aprobar');
      toast({ title: 'Aprobado', description: 'Cierre de caja aprobado' });
      fetchSettlements();
    } catch (err) {
      toast({ title: 'Error', description: 'Error al aprobar cierre', variant: 'destructive' });
    }
  };

  const handleDispute = async (id: string) => {
    try {
      const res = await fetch('/api/daily-settlements', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id, status: 'disputed' }),
      });
      if (!res.ok) throw new Error('Error al disputar');
      toast({ title: 'Disputado', description: 'Cierre de caja marcado como disputado' });
      fetchSettlements();
    } catch (err) {
      toast({ title: 'Error', description: 'Error al disputar cierre', variant: 'destructive' });
    }
  };

  // Summary stats
  const totalExpected = settlements.reduce((s, x) => s + x.expectedAmount, 0);
  const totalCollected = settlements.reduce((s, x) => s + x.collectedAmount, 0);
  const totalDiff = settlements.reduce((s, x) => s + x.difference, 0);
  const pendingCount = settlements.filter((s) => s.status === 'pending').length;

  return (
    <div className="space-y-6">
      {/* Summary */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        <Card>
          <CardContent className="pt-4">
            <p className="text-xs text-slate-500">Total Esperado</p>
            <p className="text-lg font-bold text-slate-900 dark:text-slate-100">{formatCurrency(totalExpected)}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4">
            <p className="text-xs text-slate-500">Total Recaudado</p>
            <p className="text-lg font-bold text-emerald-600">{formatCurrency(totalCollected)}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4">
            <p className="text-xs text-slate-500">Diferencia</p>
            <p className={`text-lg font-bold ${totalDiff >= 0 ? 'text-emerald-600' : 'text-red-600'}`}>
              {totalDiff >= 0 ? '+' : ''}{formatCurrency(totalDiff)}
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4">
            <p className="text-xs text-slate-500">Pendientes</p>
            <p className="text-lg font-bold text-amber-600">{pendingCount}</p>
          </CardContent>
        </Card>
      </div>

      {/* Filters */}
      <Card>
        <CardContent className="pt-4">
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div className="space-y-1">
              <Label className="text-xs">Cobrador</Label>
              <Select value={filterCollector} onValueChange={setFilterCollector}>
                <SelectTrigger>
                  <SelectValue placeholder="Todos" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value=" ">Todos</SelectItem>
                  {collectors.map((c) => (
                    <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1">
              <Label className="text-xs">Fecha</Label>
              <Input type="date" value={filterDate} onChange={(e) => setFilterDate(e.target.value)} />
            </div>
            <div className="space-y-1">
              <Label className="text-xs">Estado</Label>
              <Select value={filterStatus} onValueChange={setFilterStatus}>
                <SelectTrigger>
                  <SelectValue placeholder="Todos" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value=" ">Todos</SelectItem>
                  <SelectItem value="pending">Pendiente</SelectItem>
                  <SelectItem value="approved">Aprobado</SelectItem>
                  <SelectItem value="disputed">Disputado</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Table */}
      <Card>
        <CardContent className="p-0">
          {loading ? (
            <div className="flex items-center justify-center py-20">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-emerald-500" />
            </div>
          ) : settlements.length === 0 ? (
            <div className="text-center py-20 text-slate-400">
              <Wallet className="h-12 w-12 mx-auto mb-3 opacity-50" />
              <p>No hay cierres de caja registrados</p>
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow className="bg-emerald-50 dark:bg-emerald-950/50 text-emerald-700 dark:text-emerald-300">
                  <TableHead className="px-3 py-2">Cobrador</TableHead>
                  <TableHead className="px-3 py-2">Fecha</TableHead>
                  <TableHead className="px-3 py-2 text-right">Esperado</TableHead>
                  <TableHead className="px-3 py-2 text-right">Recaudado</TableHead>
                  <TableHead className="px-3 py-2 text-right">Dif.</TableHead>
                  <TableHead className="px-3 py-2">Estado</TableHead>
                  <TableHead className="px-3 py-2 text-right">Acciones</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {settlements.map((s) => (
                  <TableRow key={s.id} className="hover:bg-slate-50 dark:hover:bg-slate-800/30 transition-colors">
                    <TableCell className="font-medium px-3 py-2">{s.collectorName || '—'}</TableCell>
                    <TableCell className="px-3 py-2">{new Date(s.date).toLocaleDateString('es-PE')}</TableCell>
                    <TableCell className="px-3 py-2 text-right">{formatCurrency(s.expectedAmount)}</TableCell>
                    <TableCell className="px-3 py-2 text-right">{formatCurrency(s.collectedAmount)}</TableCell>
                    <TableCell className="px-3 py-2 text-right">
                      <span className={s.difference >= 0 ? 'text-emerald-600' : 'text-red-600'}>
                        {s.difference >= 0 ? '+' : ''}{formatCurrency(s.difference)}
                      </span>
                    </TableCell>
                    <TableCell className="px-3 py-2">
                      <Badge variant="outline" className={`text-xs ${STATUS_BADGE[s.status]?.class}`}>
                        {STATUS_ICON[s.status]}
                        <span className="ml-1">{STATUS_BADGE[s.status]?.label}</span>
                      </Badge>
                    </TableCell>
                    <TableCell className="px-3 py-2 text-right">
                      {s.status === 'pending' && (
                        <div className="flex items-center justify-end gap-2">
                          <Button
                            size="sm"
                            variant="outline"
                            className="text-emerald-700 border-emerald-200 dark:border-emerald-800 dark:text-emerald-300 hover:bg-emerald-50 dark:hover:bg-emerald-950 text-xs h-8"
                            onClick={() => handleApprove(s.id)}
                          >
                            <CheckCircle2 className="h-3.5 w-3.5 mr-1" />
                            Aprobar
                          </Button>
                          <Button
                            size="sm"
                            variant="outline"
                            className="text-red-600 border-red-200 hover:bg-red-50 text-xs h-8"
                            onClick={() => handleDispute(s.id)}
                          >
                            <XCircle className="h-3.5 w-3.5 mr-1" />
                            Disputar
                          </Button>
                        </div>
                      )}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
