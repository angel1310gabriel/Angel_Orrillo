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
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Loader2, BarChart3, Download, TrendingUp, DollarSign, MapPin, Calendar, X } from 'lucide-react';
import { formatCurrency } from '@/lib/format-helpers';

interface ReportsDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export default function ReportsDialog({ open, onOpenChange }: ReportsDialogProps) {
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(false);
  const [activeTab, setActiveTab] = useState('collections');

  useEffect(() => {
    if (!open) return;
    setLoading(true);
    fetch('/api/reports')
      .then(r => r.json())
      .then(d => setData(d))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [open]);

  const handleDownload = () => {
    window.open('/api/reports?format=csv', '_blank');
  };

  const totalCollected = data?.collectionsByDay?.reduce((s: number, d: any) => s + d.totalAmount, 0) || 0;
  const totalTransactions = data?.collectionsByDay?.reduce((s: number, d: any) => s + d.count, 0) || 0;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90dvh] flex flex-col p-0 gap-0" showCloseButton={false}>
        <DialogHeader className="px-5 pt-5 pb-4 border-b border-input/50 dark:border-emerald-500/10 shrink-0">
          <div className="flex items-center justify-between">
            <DialogTitle className="flex items-center gap-3 text-lg">
              <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-emerald-500 to-teal-600 flex items-center justify-center shadow-lg shadow-emerald-500/20">
                <BarChart3 className="h-5 w-5 text-white" />
              </div>
              Reportes
            </DialogTitle>
            <div className="flex items-center gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={handleDownload}
                className="border-emerald-200 text-emerald-700 hover:bg-emerald-50 dark:border-emerald-800 dark:text-emerald-300"
              >
                <Download className="h-4 w-4 mr-1.5" />
                Descargar CSV
              </Button>
              <button
                onClick={() => onOpenChange(false)}
                className="p-1.5 rounded-lg hover:bg-background/70 dark:hover:bg-card/90 transition-colors"
              >
                <X className="h-4 w-4 text-muted-foreground" />
              </button>
            </div>
          </div>
        </DialogHeader>

        {loading ? (
          <div className="flex-1 flex items-center justify-center py-20">
            <Loader2 className="h-8 w-8 animate-spin text-emerald-600" />
            <span className="ml-3 text-muted-foreground">Cargando reportes...</span>
          </div>
        ) : !data ? (
          <div className="flex-1 flex items-center justify-center py-20 text-muted-foreground">Error al cargar reportes</div>
        ) : (
          <Tabs value={activeTab} onValueChange={setActiveTab} className="flex-1 flex flex-col">
            <div className="px-5 pt-3">
              <TabsList className="grid grid-cols-3 w-full">
                <TabsTrigger value="collections" className="text-xs">Cobranzas</TabsTrigger>
                <TabsTrigger value="collectors" className="text-xs">Cobradores</TabsTrigger>
                <TabsTrigger value="zones" className="text-xs">Zonas</TabsTrigger>
              </TabsList>
            </div>

            <ScrollArea className="flex-1 px-5 py-4">
              <TabsContent value="collections" className="m-0 space-y-4">
                <div className="grid grid-cols-3 gap-3">
                  <div className="rounded-xl glass-panel p-3 text-center">
                    <p className="text-xs text-emerald-600 dark:text-emerald-400 uppercase tracking-wide">Total Cobrado</p>
                    <p className="text-lg font-bold text-emerald-600 dark:text-emerald-300 mt-1">{formatCurrency(totalCollected)}</p>
                  </div>
                  <div className="rounded-xl glass-panel p-3 text-center">
                    <p className="text-xs text-blue-600 dark:text-blue-400 uppercase tracking-wide">Transacciones</p>
                    <p className="text-lg font-bold text-blue-600 dark:text-blue-300 mt-1">{totalTransactions}</p>
                  </div>
                  <div className="rounded-xl glass-panel p-3 text-center">
                    <p className="text-xs text-muted-foreground dark:text-muted-foreground uppercase tracking-wide">Días</p>
                    <p className="text-lg font-bold text-foreground/80 dark:text-foreground/80 mt-1">{data.collectionsByDay?.length || 0}</p>
                  </div>
                </div>

                <div className="space-y-1.5">
                  <h4 className="text-sm font-semibold text-foreground/80 dark:text-foreground/80">Últimos 30 días</h4>
                  <div className="space-y-1">
                    {data.collectionsByDay?.filter((d: any) => d.totalAmount > 0 || d.count > 0)
                      .slice(-15).map((d: any) => (
                      <div key={d.date} className="flex items-center justify-between py-1.5 px-3 rounded-lg bg-background/50 dark:bg-card/50">
                        <div className="flex items-center gap-2">
                          <Calendar className="h-3 w-3 text-muted-foreground" />
                          <span className="text-sm text-foreground/70 dark:text-muted-foreground">
                            {new Date(d.date + 'T00:00:00').toLocaleDateString('es-PE', { day: '2-digit', month: 'short' })}
                          </span>
                        </div>
                        <div className="flex items-center gap-3">
                          <span className="text-sm font-semibold text-emerald-600 dark:text-emerald-300">
                            {d.totalAmount > 0 ? formatCurrency(d.totalAmount) : '—'}
                          </span>
                          <Badge variant="outline" className="text-xs bg-background/70 dark:bg-card/80">{d.count}</Badge>
                        </div>
                      </div>
                    ))}
                    {(!data.collectionsByDay || data.collectionsByDay.every((d: any) => d.totalAmount === 0)) && (
                      <p className="text-sm text-muted-foreground text-center py-4">Sin cobranzas en los últimos 30 días</p>
                    )}
                  </div>
                </div>

                <div className="rounded-xl glass-panel border border-emerald-500/10 w-full overflow-hidden">
                  <div className="px-4 py-3 border-b border-emerald-500/10">
                    <h4 className="text-sm font-semibold text-foreground">Préstamos por Estado</h4>
                  </div>
                  <div className="p-4 space-y-3">
                    {Object.entries(data.loansByStatus || {}).map(([status, count]) => (
                      <div key={status} className="flex items-center justify-between">
                        <span className="text-sm text-foreground/70 dark:text-muted-foreground">
                          {status === 'active' ? 'Activos' : status === 'mora' ? 'En Mora' : status === 'completed' ? 'Completados' : status === 'cancelled' ? 'Cancelados' : status === 'refinanced' ? 'Refinanciados' : status}
                        </span>
                        <Badge className={
                          status === 'active' ? 'bg-emerald-100 text-emerald-800 dark:bg-emerald-900/50 dark:text-emerald-200' :
                          status === 'mora' ? 'bg-red-100 text-red-800 dark:bg-red-900/50 dark:text-red-200' :
                          'bg-background/70 text-foreground/80 dark:bg-card/80 dark:text-foreground/80'
                        }>{count as number}</Badge>
                      </div>
                    ))}
                  </div>
                </div>
              </TabsContent>

              <TabsContent value="collectors" className="m-0 space-y-3">
                {data.collectorRanking?.length > 0 ? (
                  data.collectorRanking.map((c: any, i: number) => (
                    <div key={c.collectorId} className="flex items-center justify-between p-3 rounded-xl glass-panel">
                      <div className="flex items-center gap-3">
                        <div className="w-8 h-8 rounded-full bg-emerald-100 dark:bg-emerald-900/50 flex items-center justify-center text-sm font-bold text-emerald-700 dark:text-emerald-300">
                          {i + 1}
                        </div>
                        <div>
                          <p className="text-sm font-semibold text-foreground/80 dark:text-foreground/80">{c.collectorName}</p>
                          <p className="text-xs text-muted-foreground">{c.count} cobros · {c.totalLoans} préstamos</p>
                        </div>
                      </div>
                      <p className="text-sm font-bold text-emerald-600 dark:text-emerald-300">{formatCurrency(c.totalCollected)}</p>
                    </div>
                  ))
                ) : (
                  <p className="text-sm text-muted-foreground text-center py-8">Sin datos de cobradores</p>
                )}
              </TabsContent>

              <TabsContent value="zones" className="m-0 space-y-3">
                {data.zonePerformance?.length > 0 ? (
                  data.zonePerformance.map((z: any) => (
                    <div key={z.zoneName} className="p-3 rounded-xl glass-panel">
                      <div className="flex items-center gap-2 mb-2">
                        <MapPin className="h-4 w-4 text-emerald-500" />
                        <p className="text-sm font-semibold text-foreground/80 dark:text-foreground/80">{z.zoneName}</p>
                      </div>
                      <div className="grid grid-cols-3 gap-2 text-center">
                        <div>
                          <p className="text-xs text-muted-foreground">Activos</p>
                          <p className="text-sm font-bold text-emerald-600 dark:text-emerald-300">{z.activeLoans}</p>
                        </div>
                        <div>
                          <p className="text-xs text-muted-foreground">Mora</p>
                          <p className="text-sm font-bold text-red-500">{z.moraLoans}</p>
                        </div>
                        <div>
                          <p className="text-xs text-muted-foreground">Total</p>
                          <p className="text-sm font-bold text-foreground/80 dark:text-foreground/80">{formatCurrency(z.totalLoaned)}</p>
                        </div>
                      </div>
                    </div>
                  ))
                ) : (
                  <p className="text-sm text-muted-foreground text-center py-8">Sin datos de zonas</p>
                )}
              </TabsContent>
            </ScrollArea>
          </Tabs>
        )}
      </DialogContent>
    </Dialog>
  );
}
