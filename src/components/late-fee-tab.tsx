'use client';

import React, { useState, useEffect, useCallback } from 'react';
import {
  AlertTriangle,
  Clock,
  DollarSign,
  CheckCircle2,
  Play,
  Settings2,
  Loader2,
  Calendar,
} from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { ScrollArea } from '@/components/ui/scroll-area';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { useToast } from '@/hooks/use-toast';
import type { MoraStatus, LateFeeConfig, LateFeeExecution } from '@/lib/types';
import { formatCurrency, formatDateTime } from '@/lib/format-helpers';

export default function LateFeeTab() {
  const { toast } = useToast();
  const [moraStatus, setMoraStatus] = useState<MoraStatus | null>(null);
  const [lateFeeConfig, setLateFeeConfig] = useState<LateFeeConfig | null>(null);
  const [executions, setExecutions] = useState<LateFeeExecution[]>([]);
  const [loading, setLoading] = useState(true);
  const [runningFee, setRunningFee] = useState(false);
  const [lastRunResult, setLastRunResult] = useState<Record<string, unknown> | null>(null);

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const [statusRes, configRes, historyRes] = await Promise.all([
        fetch('/api/late-fee?type=status'),
        fetch('/api/late-fee?type=config'),
        fetch('/api/late-fee?type=history'),
      ]);

      if (statusRes.ok) {
        try { setMoraStatus(await statusRes.json()); } catch { /* ignore */ }
      }
      if (configRes.ok) {
        try { setLateFeeConfig(await configRes.json()); } catch { /* ignore */ }
      }
      if (historyRes.ok) {
        try {
          const data = await historyRes.json();
          setExecutions(data?.executions || []);
        } catch { /* ignore */ }
      }
    } catch (error) {
      console.error('Error fetching late fee data:', error);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetchData(); }, [fetchData]);

  const runLateFeeCalculation = async () => {
    setRunningFee(true);
    setLastRunResult(null);
    try {
      const res = await fetch('/api/late-fee', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ triggeredBy: 'manual' }),
      });

      if (res.ok) {
        const data = await res.json();
        setLastRunResult(data.details);
        toast({
          title: 'Cálculo ejecutado',
          description: `Se procesaron ${data.details.loansProcessed} préstamos, ${data.details.feesGenerated} moras generadas`,
        });
        fetchData();
      } else {
        toast({ title: 'Error', description: 'No se pudo ejecutar el cálculo', variant: 'destructive' });
      }
    } catch {
      toast({ title: 'Error', description: 'Error de conexión', variant: 'destructive' });
    } finally {
      setRunningFee(false);
    }
  };

  const updateConfig = async (key: string, value: unknown) => {
    if (!lateFeeConfig) return;
    const newConfig = { ...lateFeeConfig, [key]: value };
    setLateFeeConfig(newConfig);

    try {
      await fetch('/api/late-fee', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(newConfig),
      });
      toast({ title: 'Configuración actualizada' });
    } catch {
      toast({ title: 'Error', description: 'No se pudo actualizar', variant: 'destructive' });
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="h-8 w-8 animate-spin text-emerald-500" />
        <span className="ml-3 text-slate-500">Cargando sistema de mora...</span>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Status Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Card className="shadow-md border-0 bg-gradient-to-br from-red-500 to-red-600 text-white">
          <CardContent className="p-4 flex items-center gap-3">
            <AlertTriangle className="h-8 w-8 text-red-200" />
            <div>
              <p className="text-red-100 text-xs">En Mora</p>
              <p className="text-2xl font-bold">{moraStatus?.totalMoraLoans || 0}</p>
            </div>
          </CardContent>
        </Card>

        <Card className="shadow-md border-0 bg-gradient-to-br from-amber-500 to-orange-500 text-white">
          <CardContent className="p-4 flex items-center gap-3">
            <Clock className="h-8 w-8 text-amber-200" />
            <div>
              <p className="text-amber-100 text-xs">Potencial Mora</p>
              <p className="text-2xl font-bold">{moraStatus?.loansInPotentialMora || 0}</p>
            </div>
          </CardContent>
        </Card>

        <Card className="shadow-md border-0 bg-gradient-to-br from-sky-500 to-blue-500 text-white">
          <CardContent className="p-4 flex items-center gap-3">
            <DollarSign className="h-8 w-8 text-sky-200" />
            <div>
              <p className="text-sky-100 text-xs">Mora Pendiente</p>
              <p className="text-2xl font-bold">{formatCurrency(moraStatus?.totalPendingFeeAmount || 0)}</p>
            </div>
          </CardContent>
        </Card>

        <Card className="shadow-md border-0 bg-gradient-to-br from-emerald-500 to-teal-600 text-white">
          <CardContent className="p-4 flex items-center gap-3">
            <CheckCircle2 className="h-8 w-8 text-emerald-200" />
            <div>
              <p className="text-emerald-100 text-xs">Recargos Pend.</p>
              <p className="text-2xl font-bold">{moraStatus?.totalPendingFees || 0}</p>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Run Calculation + Config */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Run Calculation */}
        <Card className="shadow-lg border-0">
          <CardHeader className="bg-gradient-to-r from-emerald-600 to-teal-600 text-white rounded-t-lg">
            <CardTitle className="flex items-center gap-2">
              <Play className="h-5 w-5" />
              Ejecutar Cálculo de Mora
            </CardTitle>
            <CardDescription className="text-emerald-100">
              Ejecutar manualmente el cálculo de mora y recargos
            </CardDescription>
          </CardHeader>
          <CardContent className="p-6">
            {moraStatus?.lastExecution && (
              <div className="mb-4 p-3 rounded-lg bg-slate-50 border border-slate-200">
                <p className="text-xs text-slate-500 mb-1">Última ejecución:</p>
                <p className="text-sm font-medium text-slate-700">
                  {formatDateTime(moraStatus.lastExecution.createdAt)}
                </p>
                <div className="flex gap-3 mt-2">
                  <span className="text-xs text-slate-500">{moraStatus.lastExecution.loansProcessed} procesados</span>
                  <span className="text-xs text-slate-500">{moraStatus.lastExecution.feesGenerated} moras generadas</span>
                  <span className="text-xs text-slate-500">{moraStatus.lastExecution.loansMovedToMora} movidos a mora</span>
                </div>
              </div>
            )}

            {lastRunResult && (
              <div className="mb-4 p-3 rounded-lg bg-emerald-50 border border-emerald-200">
                <p className="text-sm font-semibold text-emerald-800 mb-2">✅ Resultado de la última ejecución:</p>
                <div className="grid grid-cols-2 gap-2">
                  <div className="text-xs">
                    <span className="text-slate-500">Procesados:</span>{' '}
                    <span className="font-semibold">{(lastRunResult as { loansProcessed: number }).loansProcessed}</span>
                  </div>
                  <div className="text-xs">
                    <span className="text-slate-500">Moras generadas:</span>{' '}
                    <span className="font-semibold">{(lastRunResult as { feesGenerated: number }).feesGenerated}</span>
                  </div>
                  <div className="text-xs">
                    <span className="text-slate-500">Movidos a mora:</span>{' '}
                    <span className="font-semibold">{(lastRunResult as { loansMovedToMora: number }).loansMovedToMora}</span>
                  </div>
                  <div className="text-xs">
                    <span className="text-slate-500">Monto recargos:</span>{' '}
                    <span className="font-semibold">{formatCurrency((lastRunResult as { totalFeeAmount: number }).totalFeeAmount)}</span>
                  </div>
                </div>
              </div>
            )}

            <Button
              className="w-full bg-gradient-to-r from-emerald-500 to-teal-500 hover:from-emerald-600 hover:to-teal-600 text-white shadow-lg shadow-emerald-500/20"
              size="lg"
              onClick={runLateFeeCalculation}
              disabled={runningFee}
            >
              {runningFee ? (
                <>
                  <Loader2 className="h-5 w-5 mr-2 animate-spin" />
                  Ejecutando...
                </>
              ) : (
                <>
                  <Play className="h-5 w-5 mr-2" />
                  Ejecutar Cálculo Ahora
                </>
              )}
            </Button>
          </CardContent>
        </Card>

        {/* Configuration */}
        <Card className="shadow-lg border-0">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Settings2 className="h-5 w-5 text-emerald-500" />
              Configuración de Mora
            </CardTitle>
            <CardDescription>Ajustar parámetros del cálculo automático</CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            {lateFeeConfig && (
              <>
                <div className="flex items-center justify-between p-3 rounded-lg bg-slate-50 border border-slate-200">
                  <div>
                    <Label className="text-sm font-medium">Mora Automática</Label>
                    <p className="text-xs text-slate-500">Ejecutar cálculo automáticamente</p>
                  </div>
                  <Switch
                    checked={lateFeeConfig.autoMoraEnabled}
                    onCheckedChange={(v) => updateConfig('autoMoraEnabled', v)}
                  />
                </div>

                <div className="flex items-center justify-between p-3 rounded-lg bg-slate-50 border border-slate-200">
                  <div>
                    <Label className="text-sm font-medium">Recargos Habilitados</Label>
                    <p className="text-xs text-slate-500">Generar recargos por mora</p>
                  </div>
                  <Switch
                    checked={lateFeeConfig.lateFeeEnabled}
                    onCheckedChange={(v) => updateConfig('lateFeeEnabled', v)}
                  />
                </div>

                <div className="p-3 rounded-lg bg-slate-50 border border-slate-200">
                  <div className="flex items-center justify-between mb-2">
                    <Label className="text-sm font-medium">Tasa Diaria de Recargo (S/)</Label>
                    <span className="text-lg font-bold text-emerald-600">
                      S/{lateFeeConfig.lateFeeRatePerDay.toFixed(2)}
                    </span>
                  </div>
                  <Input
                    type="number" step="0.5" min="0"
                    value={lateFeeConfig.lateFeeRatePerDay}
                    onChange={(e) => updateConfig('lateFeeRatePerDay', parseFloat(e.target.value) || 0)}
                  />
                  <p className="text-xs text-slate-400 mt-1">Monto cobrado por día de atraso por préstamo</p>
                </div>

                <div className="p-3 rounded-lg bg-slate-50 border border-slate-200">
                  <div className="flex items-center justify-between mb-2">
                    <Label className="text-sm font-medium">Días Umbral para Mora</Label>
                    <span className="text-lg font-bold text-amber-600">
                      {lateFeeConfig.moraThresholdDays} día{lateFeeConfig.moraThresholdDays !== 1 ? 's' : ''}
                    </span>
                  </div>
                  <Input
                    type="number" min="1" max="30"
                    value={lateFeeConfig.moraThresholdDays}
                    onChange={(e) => updateConfig('moraThresholdDays', parseInt(e.target.value) || 1)}
                  />
                  <p className="text-xs text-slate-400 mt-1">Días de atraso antes de considerar mora</p>
                </div>
              </>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Mora Loans Table */}
      <Card className="shadow-lg border-0">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <AlertTriangle className="h-5 w-5 text-red-500" />
            Préstamos en Mora
          </CardTitle>
          <CardDescription>Detalle de préstamos con pagos atrasados</CardDescription>
        </CardHeader>
        <CardContent>
          <ScrollArea className="max-h-80">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Cliente</TableHead>
                  <TableHead>Monto</TableHead>
                  <TableHead>Total</TableHead>
                  <TableHead>Pagado</TableHead>
                  <TableHead>Días Atraso</TableHead>
                  <TableHead>Score</TableHead>
                  <TableHead>Recargos Pend.</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {(moraStatus?.moraLoans || []).map((loan) => (
                  <TableRow key={loan.id} className={loan.daysOverdue > 15 ? 'bg-red-50/50' : loan.daysOverdue > 7 ? 'bg-amber-50/50' : ''}>
                    <TableCell className="font-medium">{loan.clientName}</TableCell>
                    <TableCell>{formatCurrency(loan.amount)}</TableCell>
                    <TableCell>{formatCurrency(loan.totalAmount)}</TableCell>
                    <TableCell>{formatCurrency(loan.amountPaid)}</TableCell>
                    <TableCell>
                      <Badge variant="outline" className={
                        loan.daysOverdue > 15 ? 'bg-red-100 text-red-800 border-red-200' :
                        loan.daysOverdue > 7 ? 'bg-amber-100 text-amber-800 border-amber-200' :
                        'bg-orange-100 text-orange-800 border-orange-200'
                      }>
                        {loan.daysOverdue}d
                      </Badge>
                    </TableCell>
                    <TableCell>
                      <Badge variant="outline" className={
                        (loan.creditScore || 0) < 30 ? 'bg-red-50 text-red-700 border-red-200' :
                        'bg-amber-50 text-amber-700 border-amber-200'
                      }>
                        {loan.creditScore || 'N/A'}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      <span className="text-sm font-medium">{loan.pendingFees}</span>
                    </TableCell>
                  </TableRow>
                )) || (
                  <TableRow>
                    <TableCell colSpan={7} className="text-center text-slate-400 py-8">
                      No hay préstamos en mora
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </ScrollArea>
        </CardContent>
      </Card>

      {/* Execution History */}
      <Card className="shadow-lg border-0">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Calendar className="h-5 w-5 text-emerald-500" />
            Historial de Ejecuciones
          </CardTitle>
          <CardDescription>Registro de ejecuciones del cálculo de mora</CardDescription>
        </CardHeader>
        <CardContent>
          <ScrollArea className="max-h-64">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Fecha</TableHead>
                  <TableHead>Procesados</TableHead>
                  <TableHead>Moras Gen.</TableHead>
                  <TableHead>Monto Recargos</TableHead>
                  <TableHead>Movidos a Mora</TableHead>
                  <TableHead>Tiempo</TableHead>
                  <TableHead>Estado</TableHead>
                  <TableHead>Tipo</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {executions.map((exec) => (
                  <TableRow key={exec.id}>
                    <TableCell className="whitespace-nowrap text-xs">
                      {formatDateTime(exec.executionDate)}
                    </TableCell>
                    <TableCell>{exec.loansProcessed}</TableCell>
                    <TableCell className="font-semibold">{exec.feesGenerated}</TableCell>
                    <TableCell>{formatCurrency(exec.totalFeeAmount)}</TableCell>
                    <TableCell>
                      <span className={exec.loansMovedToMora > 0 ? 'text-red-600 font-semibold' : ''}>
                        {exec.loansMovedToMora}
                      </span>
                    </TableCell>
                    <TableCell className="text-xs text-slate-500">{exec.executionTimeMs}ms</TableCell>
                    <TableCell>
                      <Badge variant="outline" className={
                        exec.status === 'completed' ? 'bg-emerald-50 text-emerald-700 border-emerald-200' :
                        exec.status === 'failed' ? 'bg-red-50 text-red-700 border-red-200' :
                        'bg-amber-50 text-amber-700 border-amber-200'
                      }>
                        {exec.status === 'completed' ? '✓ Completado' : exec.status === 'failed' ? '✗ Fallido' : '⚡ Parcial'}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      <Badge variant="outline" className="text-xs">
                        {exec.triggeredBy === 'automatic' ? '🤖 Auto' : '👤 Manual'}
                      </Badge>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </ScrollArea>
        </CardContent>
      </Card>
    </div>
  );
}
