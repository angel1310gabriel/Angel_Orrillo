'use client';

import React, { useState, useEffect, useCallback } from 'react';
import {
  Calendar,
  DollarSign,
  Loader2,
  CheckCircle2,
  AlertTriangle,
  Clock,
} from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { ScrollArea } from '@/components/ui/scroll-area';
import { useToast } from '@/hooks/use-toast';
import { formatCurrency, formatDate } from '@/lib/format-helpers';

interface ScheduleEntry {
  id: string;
  loanId: string;
  installmentNumber: number;
  amount: number;
  dueDate: string;
  status: string;
  createdAt: string;
}

interface PaymentScheduleViewProps {
  loanId: string | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  loanAmount?: number;
  numInstallments?: number;
}

const statusConfig: Record<string, { icon: React.ReactNode; className: string }> = {
  pending: {
    icon: <Clock className="h-3 w-3" />,
    className: 'bg-amber-100 text-amber-800 border-amber-200 dark:bg-amber-900/50 dark:text-amber-200 dark:border-amber-800',
  },
  paid: {
    icon: <CheckCircle2 className="h-3 w-3" />,
    className: 'bg-emerald-100 text-emerald-800 border-emerald-200 dark:bg-emerald-900/50 dark:text-emerald-200 dark:border-emerald-800',
  },
  late: {
    icon: <AlertTriangle className="h-3 w-3" />,
    className: 'bg-red-100 text-red-800 border-red-200 dark:bg-red-900/50 dark:text-red-200 dark:border-red-800',
  },
};

const statusLabels: Record<string, string> = {
  pending: 'Pendiente',
  paid: 'Pagado',
  late: 'Vencido',
};

export default function PaymentScheduleView({
  loanId,
  open,
  onOpenChange,
  loanAmount = 0,
  numInstallments = 0,
}: PaymentScheduleViewProps) {
  const { toast } = useToast();
  const [schedule, setSchedule] = useState<ScheduleEntry[]>([]);
  const [loading, setLoading] = useState(false);
  const [generating, setGenerating] = useState(false);
  const [newSchedule, setNewSchedule] = useState({
    numInstallments: numInstallments || 24,
    startDate: new Date().toISOString().split('T')[0],
  });

  const fetchSchedule = useCallback(async () => {
    if (!loanId) return;
    setLoading(true);
    try {
      const res = await fetch(`/api/payment-schedule?loanId=${loanId}`);
      if (res.ok) {
        const data = await res.json();
        setSchedule(data.schedule || data || []);
      } else {
        setSchedule([]);
      }
    } catch {
      setSchedule([]);
    } finally {
      setLoading(false);
    }
  }, [loanId]);

  useEffect(() => {
    if (open && loanId) {
      fetchSchedule();
      setNewSchedule((prev) => ({
        ...prev,
        numInstallments: numInstallments || prev.numInstallments,
      }));
    }
  }, [open, loanId, fetchSchedule, numInstallments]);

  const handleGenerate = async () => {
    if (!loanId) return;
    setGenerating(true);
    try {
      const res = await fetch('/api/payment-schedule', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          loanId,
          totalAmount: loanAmount,
          numInstallments: newSchedule.numInstallments,
          startDate: newSchedule.startDate,
          frequency: 'daily',
        }),
      });

      if (res.ok) {
        toast({
          title: 'Cronograma generado',
          description: `Se generaron ${newSchedule.numInstallments} cuotas correctamente`,
        });
        await fetchSchedule();
      } else {
        const data = await res.json();
        toast({
          title: 'Error',
          description: data.error || 'No se pudo generar el cronograma',
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
      setGenerating(false);
    }
  };

  const totalAmount = schedule.reduce((sum, item) => sum + item.amount, 0);

  const getStatusBadge = (status: string) => {
    const config = statusConfig[status] || statusConfig.pending;
    return (
      <Badge variant="outline" className={config.className}>
        {config.icon}
        <span className="ml-1">{statusLabels[status] || status}</span>
      </Badge>
    );
  };

  const paidCount = schedule.filter((s) => s.status === 'paid').length;
  const progressPercent = schedule.length > 0 ? Math.round((paidCount / schedule.length) * 100) : 0;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90dvh] flex flex-col p-0 gap-0">
        <DialogHeader className="px-5 pt-5 pb-4 border-b border-slate-100 dark:border-slate-800 shrink-0">
          <DialogTitle className="flex items-center gap-3 text-lg">
            <div className="w-9 h-9 rounded-xl bg-emerald-600 flex items-center justify-center shadow-md shadow-emerald-500/20">
              <Calendar className="h-5 w-5 text-white" />
            </div>
            <div>
              <span>Cronograma de Pagos</span>
              {schedule.length > 0 && (
                <span className="text-sm font-normal text-slate-500 dark:text-slate-400 ml-2">
                  ({paidCount}/{schedule.length} cuotas)
                </span>
              )}
            </div>
          </DialogTitle>
        </DialogHeader>

        {loading ? (
          <div className="flex-1 flex flex-col items-center justify-center py-16">
            <Loader2 className="h-10 w-10 animate-spin text-emerald-600" />
            <p className="mt-4 text-sm text-slate-500 dark:text-slate-400">Cargando cronograma...</p>
          </div>
        ) : schedule.length === 0 ? (
          <ScrollArea className="flex-1">
            <div className="px-5 py-5 space-y-5">
              <div className="text-center py-6">
                <div className="w-16 h-16 rounded-2xl bg-slate-100 dark:bg-slate-800 flex items-center justify-center mx-auto mb-4">
                  <Calendar className="h-8 w-8 text-slate-400" />
                </div>
                <h3 className="text-base font-semibold text-slate-700 dark:text-slate-300">
                  Sin cronograma de pagos
                </h3>
                <p className="text-sm text-slate-500 dark:text-slate-400 mt-1 max-w-xs mx-auto">
                  Genere el cronograma de cuotas para este préstamo
                </p>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <Label htmlFor="numInstallments" className="text-sm font-medium text-slate-700 dark:text-slate-300">
                    Número de Cuotas
                  </Label>
                  <Input
                    id="numInstallments"
                    type="number"
                    min={1}
                    className="h-10"
                    value={newSchedule.numInstallments}
                    onChange={(e) =>
                      setNewSchedule((prev) => ({
                        ...prev,
                        numInstallments: parseInt(e.target.value) || 1,
                      }))
                    }
                  />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="startDate" className="text-sm font-medium text-slate-700 dark:text-slate-300">
                    Fecha de Inicio
                  </Label>
                  <Input
                    id="startDate"
                    type="date"
                    value={newSchedule.startDate}
                    onChange={(e) =>
                      setNewSchedule((prev) => ({
                        ...prev,
                        startDate: e.target.value,
                      }))
                    }
                  />
                </div>
              </div>

              <div className="p-4 rounded-xl bg-gradient-to-r from-emerald-50 to-teal-50 dark:from-emerald-950/30 dark:to-teal-950/30 border border-emerald-100 dark:border-emerald-900/50">
                <div className="flex items-center justify-between">
                  <span className="text-sm text-emerald-700 dark:text-emerald-300">
                    Cuota por cuota:
                  </span>
                  <span className="text-xl font-bold text-emerald-600 dark:text-emerald-300">
                    {formatCurrency(
                      newSchedule.numInstallments > 0
                        ? (loanAmount || 0) / newSchedule.numInstallments
                        : 0
                    )}
                  </span>
                </div>
              </div>

              <Button
                className="w-full bg-emerald-600 hover:bg-emerald-700 text-white border-0 shadow-lg shadow-emerald-600/25 hover:shadow-emerald-600/40 transition-all h-11"
                onClick={handleGenerate}
                disabled={generating}
              >
                {generating ? (
                  <>
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    Generando...
                  </>
                ) : (
                  <>
                    <DollarSign className="h-4 w-4 mr-2" />
                    Generar Cronograma
                  </>
                )}
              </Button>
            </div>
          </ScrollArea>
        ) : (
          <ScrollArea className="flex-1">
            <div className="px-5 py-5 space-y-5">
              {/* Summary card */}
              <div className="grid grid-cols-3 gap-3">
                <div className="rounded-xl bg-slate-50 dark:bg-slate-800/50 p-3 text-center">
                  <p className="text-xs text-slate-500 dark:text-slate-400 uppercase tracking-wide">Total</p>
                  <p className="text-lg font-bold text-slate-800 dark:text-slate-200 mt-1">{formatCurrency(totalAmount)}</p>
                </div>
                <div className="rounded-xl bg-emerald-50 dark:bg-emerald-950/30 p-3 text-center">
                  <p className="text-xs text-emerald-600 dark:text-emerald-400 uppercase tracking-wide">Pagado</p>
                  <p className="text-lg font-bold text-emerald-600 dark:text-emerald-300 mt-1">{paidCount} cuotas</p>
                </div>
                <div className="rounded-xl bg-amber-50 dark:bg-amber-950/30 p-3 text-center">
                  <p className="text-xs text-amber-600 dark:text-amber-400 uppercase tracking-wide">Pendiente</p>
                  <p className="text-lg font-bold text-amber-600 dark:text-amber-300 mt-1">{schedule.length - paidCount} cuotas</p>
                </div>
              </div>

              {/* Progress bar */}
              <div className="space-y-1.5">
                <div className="flex justify-between text-xs text-slate-500 dark:text-slate-400">
                  <span>Progreso</span>
                  <span>{progressPercent}%</span>
                </div>
                <div className="h-2.5 bg-slate-100 dark:bg-slate-800 rounded-full overflow-hidden">
                  <div
                    className="h-full bg-gradient-to-r from-emerald-500 to-emerald-600 rounded-full transition-all duration-500"
                    style={{ width: `${Math.min(100, progressPercent)}%` }}
                  />
                </div>
              </div>

              {/* Schedule table */}
              <div className="rounded-xl border border-slate-100 dark:border-slate-800 overflow-hidden">
                <Table>
                  <TableHeader>
                    <TableRow className="bg-slate-50 dark:bg-slate-800/50">
                      <TableHead className="text-xs font-semibold text-slate-500 uppercase">#</TableHead>
                      <TableHead className="text-xs font-semibold text-slate-500 uppercase">Vencimiento</TableHead>
                      <TableHead className="text-right text-xs font-semibold text-slate-500 uppercase">Monto</TableHead>
                      <TableHead className="text-center text-xs font-semibold text-slate-500 uppercase">Estado</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {schedule
                      .sort((a, b) => a.installmentNumber - b.installmentNumber)
                      .map((item, idx) => (
                        <TableRow key={item.id} className={idx % 2 === 0 ? 'bg-white dark:bg-transparent' : 'bg-slate-50/50 dark:bg-slate-800/20'}>
                          <TableCell className="text-sm font-semibold text-slate-900 dark:text-slate-100 w-12">
                            {item.installmentNumber}
                          </TableCell>
                          <TableCell className="text-sm text-slate-600 dark:text-slate-400">
                            <span className="inline-flex items-center gap-1.5">
                              <Calendar className="h-3.5 w-3.5 text-slate-400" />
                              {formatDate(item.dueDate)}
                            </span>
                          </TableCell>
                          <TableCell className="text-right text-sm font-bold text-emerald-600 dark:text-emerald-300">
                            {formatCurrency(item.amount)}
                          </TableCell>
                          <TableCell className="text-center">
                            {getStatusBadge(item.status)}
                          </TableCell>
                        </TableRow>
                      ))}
                    <TableRow className="bg-slate-100 dark:bg-slate-800/70 font-bold">
                      <TableCell colSpan={2} className="text-sm text-slate-800 dark:text-slate-200">
                        Total {schedule.length} cuotas
                      </TableCell>
                      <TableCell className="text-right text-sm text-emerald-600 dark:text-emerald-300">
                        {formatCurrency(totalAmount)}
                      </TableCell>
                      <TableCell />
                    </TableRow>
                  </TableBody>
                </Table>
              </div>
            </div>
          </ScrollArea>
        )}
      </DialogContent>
    </Dialog>
  );
}
