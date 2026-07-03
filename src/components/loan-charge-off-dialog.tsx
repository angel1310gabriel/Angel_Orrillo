'use client';

import React, { useState, useEffect } from 'react';
import {
  AlertTriangle,
  DollarSign,
  FileText,
  Loader2,
  Calendar,
  History,
} from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Separator } from '@/components/ui/separator';
import { useToast } from '@/hooks/use-toast';

interface ChargeOffHistoryEntry {
  id: string;
  amountWrittenOff: number;
  reason: string;
  notes: string | null;
  createdAt: string;
  createdBy: string | null;
}

interface LoanChargeOffDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  loanId: string | null;
  clientName: string;
}

export default function LoanChargeOffDialog({
  open,
  onOpenChange,
  loanId,
  clientName,
}: LoanChargeOffDialogProps) {
  const { toast } = useToast();

  const [amount, setAmount] = useState('');
  const [reason, setReason] = useState('');
  const [notes, setNotes] = useState('');
  const [chargeOffHistory, setChargeOffHistory] = useState<ChargeOffHistoryEntry[]>([]);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!open || !loanId) return;

    const fetchHistory = async () => {
      setLoading(true);
      try {
        const res = await fetch(`/api/charge-off?loanId=${loanId}`);
        if (res.ok) {
          const data = await res.json();
          const history = data.chargeOffHistory || data.history || data || [];
          const entries = Array.isArray(history) ? history : [];
          setChargeOffHistory(entries);
          if (entries.length > 0 && !amount) {
            setAmount(entries[0].amountWrittenOff.toString());
          }
        }
      } catch {
        // silent fail
      } finally {
        setLoading(false);
      }
    };

    fetchHistory();
  }, [open, loanId]);

  const handleSubmit = async () => {
    if (!loanId || !reason.trim()) {
      toast({
        title: 'Campo requerido',
        description: 'El motivo del castigo es obligatorio',
        variant: 'destructive',
      });
      return;
    }

    const parsedAmount = parseFloat(amount);
    if (isNaN(parsedAmount) || parsedAmount <= 0) {
      toast({
        title: 'Monto inválido',
        description: 'Ingrese un monto válido mayor a 0',
        variant: 'destructive',
      });
      return;
    }

    setSaving(true);
    try {
      const res = await fetch('/api/charge-off', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          loanId,
          amountWrittenOff: parsedAmount,
          reason: reason.trim(),
          notes: notes.trim() || null,
        }),
      });

      if (res.ok) {
        toast({
          title: 'Préstamo castigado',
          description: `El préstamo de ${clientName} ha sido castigado exitosamente`,
        });
        onOpenChange(false);
        window.dispatchEvent(
          new CustomEvent('navigate-to-tab', { detail: { tab: 'loans' } })
        );
      } else {
        const data = await res.json();
        toast({
          title: 'Error',
          description: data.error || 'No se pudo castigar el préstamo',
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
      setSaving(false);
    }
  };

  const formatCurrency = (val: number) =>
    `S/${val.toLocaleString('es-PE', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

  const formatDate = (dateStr: string) => {
    const date = new Date(dateStr);
    return date.toLocaleDateString('es-PE', {
      day: '2-digit',
      month: 'short',
      year: 'numeric',
    });
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg max-h-[90vh] flex flex-col p-0">
        <DialogHeader className="px-6 pt-6 pb-4 border-b border-slate-100 dark:border-slate-800">
          <DialogTitle className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-red-500 to-rose-600 flex items-center justify-center">
              <AlertTriangle className="h-4 w-4 text-white" />
            </div>
            Castigar Préstamo
          </DialogTitle>
          <DialogDescription>
            {clientName}
          </DialogDescription>
        </DialogHeader>

        <ScrollArea className="flex-1 px-6">
          <div className="py-4 space-y-5">
            <Alert variant="destructive">
              <AlertTriangle className="h-4 w-4" />
              <AlertDescription>
                Esta acción es irreversible. El préstamo será marcado como castigado y no podrá
                revertirse.
              </AlertDescription>
            </Alert>

            <div>
              <Label htmlFor="charge-off-amount" className="text-sm font-semibold text-slate-700 dark:text-slate-300">
                Monto a Castigar
              </Label>
              <div className="relative mt-1.5">
                <DollarSign className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
                <Input
                  id="charge-off-amount"
                  type="number"
                  step="0.01"
                  min="0"
                  placeholder="0.00"
                  value={amount}
                  onChange={(e) => setAmount(e.target.value)}
                  className="pl-9"
                />
              </div>
            </div>

            <div>
              <Label htmlFor="charge-off-reason" className="text-sm font-semibold text-slate-700 dark:text-slate-300">
                Motivo <span className="text-red-500">*</span>
              </Label>
              <textarea
                id="charge-off-reason"
                className="flex mt-1.5 w-full rounded-md border border-input bg-transparent px-3 py-2 text-sm shadow-xs placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-[3px] focus-visible:ring-ring/50 disabled:cursor-not-allowed disabled:opacity-50 aria-invalid:ring-destructive/20 dark:aria-invalid:ring-destructive/40 aria-invalid:border-destructive min-h-[80px]"
                placeholder="Describa el motivo del castigo..."
                value={reason}
                onChange={(e) => setReason(e.target.value)}
              />
            </div>

            <div>
              <Label htmlFor="charge-off-notes" className="text-sm font-semibold text-slate-700 dark:text-slate-300">
                Notas Adicionales
              </Label>
              <textarea
                id="charge-off-notes"
                className="flex mt-1.5 w-full rounded-md border border-input bg-transparent px-3 py-2 text-sm shadow-xs placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-[3px] focus-visible:ring-ring/50 disabled:cursor-not-allowed disabled:opacity-50 aria-invalid:ring-destructive/20 dark:aria-invalid:ring-destructive/40 aria-invalid:border-destructive min-h-[80px]"
                placeholder="Notas opcionales..."
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
              />
            </div>

            {loading ? (
              <div className="flex items-center justify-center py-4">
                <Loader2 className="h-5 w-5 animate-spin text-slate-400" />
              </div>
            ) : chargeOffHistory.length > 0 && (
              <>
                <Separator />
                <div>
                  <h4 className="flex items-center gap-2 text-sm font-semibold text-slate-700 dark:text-slate-300 mb-3">
                    <History className="h-4 w-4" />
                    Historial de Castigos
                  </h4>
                  <div className="space-y-3">
                    {chargeOffHistory.map((entry) => (
                      <div
                        key={entry.id}
                        className="rounded-lg border border-slate-200 dark:border-slate-700 p-3 space-y-2"
                      >
                        <div className="flex items-center justify-between">
                          <Badge variant="destructive" className="text-xs">
                            {formatCurrency(entry.amountWrittenOff)}
                          </Badge>
                          <span className="flex items-center gap-1 text-xs text-slate-500">
                            <Calendar className="h-3 w-3" />
                            {formatDate(entry.createdAt)}
                          </span>
                        </div>
                        <p className="text-sm text-slate-700 dark:text-slate-300">
                          {entry.reason}
                        </p>
                        {entry.notes && (
                          <p className="text-xs text-slate-500 dark:text-slate-400 flex items-start gap-1">
                            <FileText className="h-3 w-3 mt-0.5 shrink-0" />
                            {entry.notes}
                          </p>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              </>
            )}
          </div>
        </ScrollArea>

        <DialogFooter className="px-6 py-4 border-t border-slate-100 dark:border-slate-800">
          <Button
            variant="outline"
            onClick={() => onOpenChange(false)}
          >
            Cancelar
          </Button>
          <Button
            variant="destructive"
            className="shadow-lg shadow-red-600/25 hover:shadow-red-600/40"
            onClick={handleSubmit}
            disabled={saving}
          >
            {saving ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin" />
                Castigando...
              </>
            ) : (
              <>
                <AlertTriangle className="h-4 w-4" />
                Castigar Préstamo
              </>
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
