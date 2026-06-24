'use client';

import React, { useState, useEffect } from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Loader2, BarChart3, Download, Calendar, MapPin, User, DollarSign } from 'lucide-react';
import { formatCurrency } from '@/lib/format-helpers';

interface ReportsDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export default function ReportsDialog({ open, onOpenChange }: ReportsDialogProps) {
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    if (!open) return;
    setLoading(true);
    setError('');
    fetch('/api/reports')
      .then(r => r.json())
      .then(d => {
        if (d.error) { setError(d.error); setData(null); }
        else setData(d);
      })
      .catch(() => setError('Error de conexión'))
      .finally(() => setLoading(false));
  }, [open]);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90dvh] flex flex-col p-0 gap-0">
        <DialogHeader className="px-5 pt-5 pb-4 border-b border-slate-100 dark:border-slate-800 shrink-0">
          <div className="flex items-center justify-between">
            <DialogTitle className="flex items-center gap-3 text-lg">
              <div className="w-9 h-9 rounded-xl bg-emerald-600 flex items-center justify-center shadow-md shadow-emerald-500/20">
                <BarChart3 className="h-5 w-5 text-white" />
              </div>
              Reportes
            </DialogTitle>
            <Button variant="outline" size="sm" onClick={() => window.open('/api/reports?format=csv', '_blank')} className="border-emerald-200 text-emerald-700 hover:bg-emerald-50 dark:border-emerald-800 dark:text-emerald-300">
              <Download className="h-4 w-4 mr-1" />
              CSV
            </Button>
          </div>
        </DialogHeader>

        {loading ? (
          <div className="flex-1 flex items-center justify-center py-20">
            <Loader2 className="h-8 w-8 animate-spin text-emerald-600" />
            <span className="ml-3 text-slate-500">Cargando reportes...</span>
          </div>
        ) : error ? (
          <div className="flex-1 flex flex-col items-center justify-center py-16 gap-3">
            <BarChart3 className="h-12 w-12 text-slate-300" />
            <p className="text-slate-500 text-sm">{error}</p>
            <Button variant="outline" size="sm" onClick={() => window.open('/api/reports?format=csv', '_blank')}>
              <Download className="h-4 w-4 mr-1" />
              Descargar CSV Directo
            </Button>
          </div>
        ) : !data ? null : (
          <ScrollArea className="flex-1 px-5 py-4">
            {/* Summary */}
            <div className="grid grid-cols-2 gap-3 mb-6">
              <div className="rounded-xl bg-emerald-50 dark:bg-emerald-950/30 p-4 text-center">
                <p className="text-xs text-emerald-600 dark:text-emerald-400 uppercase">Total Cobrado (30d)</p>
                <p className="text-xl font-bold text-emerald-600 dark:text-emerald-300 mt-1">
                  {formatCurrency((data.collectionsByDay || []).reduce((s: number, d: any) => s + d.totalAmount, 0))}
                </p>
              </div>
              <div className="rounded-xl bg-blue-50 dark:bg-blue-950/30 p-4 text-center">
                <p className="text-xs text-blue-600 dark:text-blue-400 uppercase">Transacciones (30d)</p>
                <p className="text-xl font-bold text-blue-600 dark:text-blue-300 mt-1">
                  {(data.collectionsByDay || []).reduce((s: number, d: any) => s + d.count, 0)}
                </p>
              </div>
            </div>

            {/* Collections by Day */}
            <div className="mb-6">
              <h3 className="text-sm font-semibold text-slate-700 dark:text-slate-300 mb-3 flex items-center gap-2">
                <Calendar className="h-4 w-4 text-emerald-500" />
                Cobranzas por Día (últimos 30)
              </h3>
              <div className="space-y-1">
                {(data.collectionsByDay || []).filter((d: any) => d.totalAmount > 0).slice(-15).map((d: any) => (
                  <div key={d.date} className="flex items-center justify-between py-1.5 px-3 rounded-lg bg-slate-50 dark:bg-slate-800/30">
                    <span className="text-sm text-slate-500">
                      {new Date(d.date + 'T00:00:00').toLocaleDateString('es-PE', { day: '2-digit', month: 'short' })}
                    </span>
                    <div className="flex items-center gap-3">
                      <span className="text-sm font-semibold text-emerald-600">{formatCurrency(d.totalAmount)}</span>
                      <Badge variant="outline" className="text-xs">{d.count}</Badge>
                    </div>
                  </div>
                ))}
                {(data.collectionsByDay || []).filter((d: any) => d.totalAmount > 0).length === 0 && (
                  <p className="text-sm text-slate-400 text-center py-4">Sin cobros en los últimos 30 días</p>
                )}
              </div>
            </div>

            {/* Loans by Status */}
            <div className="mb-6 rounded-xl border border-slate-100 dark:border-slate-800 overflow-hidden">
              <div className="p-3 bg-slate-50 dark:bg-slate-800/50 border-b border-slate-100 dark:border-slate-800">
                <h3 className="text-sm font-semibold text-slate-700 dark:text-slate-300">Préstamos por Estado</h3>
              </div>
              <div className="p-3 space-y-2">
                {Object.entries(data.loansByStatus || {}).map(([status, count]) => (
                  <div key={status} className="flex items-center justify-between">
                    <span className="text-sm capitalize text-slate-600 dark:text-slate-400">
                      {status === 'active' ? 'Activos' : status === 'mora' ? 'En Mora' : status === 'completed' ? 'Completados' : status}
                    </span>
                    <Badge className={
                      status === 'active' ? 'bg-emerald-100 text-emerald-800' :
                      status === 'mora' ? 'bg-red-100 text-red-800' :
                      'bg-slate-100 text-slate-700'
                    }>{count as number}</Badge>
                  </div>
                ))}
              </div>
            </div>

            {/* Collector Ranking */}
            <div className="mb-6">
              <h3 className="text-sm font-semibold text-slate-700 dark:text-slate-300 mb-3 flex items-center gap-2">
                <User className="h-4 w-4 text-emerald-500" />
                Ranking Cobradores
              </h3>
              {(data.collectorRanking || []).length > 0 ? (
                <div className="space-y-2">
                  {(data.collectorRanking || []).map((c: any, i: number) => (
                    <div key={c.collectorId || i} className="flex items-center justify-between p-3 rounded-xl bg-slate-50 dark:bg-slate-800/30">
                      <div className="flex items-center gap-3">
                        <div className="w-7 h-7 rounded-full bg-emerald-100 dark:bg-emerald-900/50 flex items-center justify-center text-xs font-bold text-emerald-700">
                          {i + 1}
                        </div>
                        <span className="text-sm font-medium text-slate-700">{c.collectorName}</span>
                      </div>
                      <div className="text-right">
                        <p className="text-sm font-bold text-emerald-600">{formatCurrency(c.totalCollected)}</p>
                        <p className="text-xs text-slate-400">{c.count} cobros</p>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-sm text-slate-400 text-center py-4">Sin datos</p>
              )}
            </div>

            {/* Zone Performance */}
            <div className="mb-2">
              <h3 className="text-sm font-semibold text-slate-700 dark:text-slate-300 mb-3 flex items-center gap-2">
                <MapPin className="h-4 w-4 text-emerald-500" />
                Rendimiento por Zona
              </h3>
              {(data.zonePerformance || []).length > 0 ? (
                <div className="space-y-2">
                  {(data.zonePerformance || []).map((z: any) => (
                    <div key={z.zoneName} className="p-3 rounded-xl bg-slate-50 dark:bg-slate-800/30">
                      <p className="text-sm font-semibold text-slate-700 mb-2">{z.zoneName}</p>
                      <div className="grid grid-cols-3 gap-2 text-center text-xs">
                        <div className="p-2 rounded bg-emerald-50 dark:bg-emerald-950/30">
                          <p className="text-emerald-600 font-bold">{z.activeLoans}</p>
                          <p className="text-emerald-500">Activos</p>
                        </div>
                        <div className="p-2 rounded bg-red-50 dark:bg-red-950/30">
                          <p className="text-red-600 font-bold">{z.moraLoans}</p>
                          <p className="text-red-500">Mora</p>
                        </div>
                        <div className="p-2 rounded bg-slate-50 dark:bg-slate-800/50">
                          <p className="text-slate-700 font-bold">{formatCurrency(z.totalLoaned)}</p>
                          <p className="text-slate-500">Total</p>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-sm text-slate-400 text-center py-4">Sin datos</p>
              )}
            </div>
          </ScrollArea>
        )}
      </DialogContent>
    </Dialog>
  );
}
