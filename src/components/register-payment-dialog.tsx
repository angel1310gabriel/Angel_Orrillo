'use client';

import React, { useState, useEffect, useCallback } from 'react';
import {
  CheckCircle2,
  DollarSign,
  Loader2,
  Search,
  Banknote,
  Wifi,
  ArrowRightLeft,
  User,
  X,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Separator } from '@/components/ui/separator';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { useToast } from '@/hooks/use-toast';
import { formatCurrency } from '@/lib/format-helpers';

interface LoanForPayment {
  id: string;
  clientId: string;
  amount: number;
  totalAmount: number;
  amountPaid: number;
  status: string;
  client: {
    id: string;
    name: string;
    documentNumber: string;
    documentType: string;
    phone: string;
  };
}

interface RegisterPaymentDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  preselectedClientId?: string;
  preselectedClientName?: string;
  onSuccess?: () => void;
}

export default function RegisterPaymentDialog({
  open,
  onOpenChange,
  preselectedClientId,
  preselectedClientName,
  onSuccess,
}: RegisterPaymentDialogProps) {
  const { toast } = useToast();

  const [loans, setLoans] = useState<LoanForPayment[]>([]);
  const [loadingLoans, setLoadingLoans] = useState(false);
  const [loanSearch, setLoanSearch] = useState('');
  const [selectedLoanId, setSelectedLoanId] = useState('');
  const [amount, setAmount] = useState('');
  const [paymentMethod, setPaymentMethod] = useState('cash');
  const [observation, setObservation] = useState('');
  const [registering, setRegistering] = useState(false);

  // Reset on dialog close
  const reset = useCallback(() => {
    setLoans([]);
    setLoanSearch('');
    setSelectedLoanId('');
    setAmount('');
    setPaymentMethod('cash');
    setObservation('');
  }, []);

  // Fetch loans when preselectedClientId is provided
  useEffect(() => {
    if (open && preselectedClientId) {
      (async () => {
        setLoadingLoans(true);
        try {
          const r = await fetch(`/api/loans?clientId=${preselectedClientId}`);
          if (r.ok) {
            const d = await r.json();
            setLoans(d.loans || []);
          } else {
            setLoans([]);
          }
        } catch {
          setLoans([]);
        } finally {
          setLoadingLoans(false);
        }
      })();
    }
  }, [open, preselectedClientId]);

  // Fetch all active loans when no client is preselected and dialog opens
  useEffect(() => {
    if (open && !preselectedClientId) {
      (async () => {
        setLoadingLoans(true);
        try {
          const r = await fetch('/api/loans?status=active,mora');
          if (r.ok) {
            const d = await r.json();
            setLoans(d.loans || []);
          } else {
            setLoans([]);
          }
        } catch {
          setLoans([]);
        } finally {
          setLoadingLoans(false);
        }
      })();
    }
  }, [open, preselectedClientId]);

  const filteredLoans = loans.filter((l) => {
    if (selectedLoanId) return true;
    const q = loanSearch.toLowerCase();
    if (!q) return l.status === 'active' || l.status === 'mora';
    const c = l.client;
    return (
      c.name.toLowerCase().includes(q) ||
      c.documentNumber.includes(q) ||
      c.phone.includes(q)
    );
  });

  const selectedLoan = loans.find((l) => l.id === selectedLoanId) || null;

  const handleSelectLoan = (loanId: string) => {
    setSelectedLoanId(loanId);
    setAmount('');
  };

  const handleSubmit = async () => {
    if (!selectedLoanId || !amount || parseFloat(amount) <= 0) return;
    setRegistering(true);
    try {
      const r = await fetch('/api/payments', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          loanId: selectedLoanId,
          amount: parseFloat(amount),
          paymentMethod,
          observation: observation || null,
        }),
      });
      if (r.ok) {
        const d = await r.json();
        if (d.loanCompleted) {
          toast({
            title: 'Préstamo Completado',
            description: `${selectedLoan?.client.name} ha pagado totalmente`,
          });
        } else {
          toast({
            title: 'Cobro registrado',
            description: `${formatCurrency(parseFloat(amount))} cobrado a ${selectedLoan?.client.name}`,
          });
        }
        reset();
        onOpenChange(false);
        onSuccess?.();
      } else {
        const d = await r.json();
        toast({
          title: 'Error',
          description: d.error || 'No se pudo registrar el cobro',
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
      setRegistering(false);
    }
  };

  return (
    <Dialog
      open={open}
      onOpenChange={(o) => {
        if (!o) reset();
        onOpenChange(o);
      }}
    >
      <DialogContent className="max-w-lg max-h-[85vh] overflow-hidden flex flex-col p-0 gap-0">
        <DialogHeader className="px-5 pt-5 pb-4 border-b border-input/50 dark:border-emerald-500/10 shrink-0">
          <DialogTitle className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-emerald-500 to-teal-600 flex items-center justify-center shadow-lg shadow-emerald-500/20">
              <DollarSign className="h-5 w-5 text-white" />
            </div>
            <div>
              <span>Registrar Cobro</span>
              <DialogDescription className="text-xs mt-0.5 text-muted-foreground">
                {preselectedClientName || 'Seleccione un préstamo'}
              </DialogDescription>
            </div>
          </DialogTitle>
        </DialogHeader>

        <ScrollArea className="flex-1 min-h-0 overflow-y-auto">
          <div className="p-5 space-y-5">
            {loadingLoans ? (
              <div className="flex items-center justify-center py-10">
                <Loader2 className="h-5 w-5 animate-spin text-emerald-500 mr-2" />
                Cargando...
              </div>
            ) : !selectedLoanId ? (
              <>
                {/* Search (only when no preselected client) */}
                {!preselectedClientId && (
                  <div className="relative">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                    <Input
                      placeholder="Buscar por nombre, DNI o teléfono..."
                      value={loanSearch}
                      onChange={(e) => setLoanSearch(e.target.value)}
                      className="pl-9"
                    />
                  </div>
                )}

                {/* Loan List */}
                <div className="space-y-2">
                  <Label className="text-sm font-semibold text-foreground/80 dark:text-foreground/80 block">
                    Seleccionar Préstamo
                  </Label>
                  {filteredLoans.length === 0 ? (
                    <p className="text-sm text-muted-foreground text-center py-6">
                      No se encontraron préstamos activos
                    </p>
                  ) : (
                    <div className="space-y-1.5">
                      {filteredLoans.map((l) => {
                        const isMora = l.status === 'mora';
                        return (
                          <button
                            key={l.id}
                            type="button"
                            onClick={() => handleSelectLoan(l.id)}
                            className={`w-full text-left p-3 rounded-lg border-2 transition-all ${
                              isMora
                                ? 'border-red-200 bg-red-50/50 dark:bg-red-950/30 hover:border-red-300 hover:bg-red-50 dark:hover:bg-red-950/50'
                                : 'border-input dark:border-emerald-500/5 bg-white dark:bg-[#05060b]/80 hover:border-emerald-300 hover:bg-emerald-50/50 dark:hover:bg-emerald-950/30'
                            }`}
                          >
                            <div className="flex items-center justify-between">
                              <div className="flex items-center gap-3">
                                <div className="w-8 h-8 rounded-full bg-emerald-100 dark:bg-emerald-900/50 flex items-center justify-center">
                                  <User className="h-4 w-4 text-emerald-600 dark:text-emerald-300" />
                                </div>
                                <div>
                                  <p className="font-medium text-sm text-foreground dark:text-foreground">
                                    {l.client.name}
                                  </p>
                                  <p className="text-xs text-muted-foreground dark:text-muted-foreground">
                                    {l.client.documentType === 'dni' ? 'DNI' : l.client.documentType === 'carnet_extranjeria' ? 'CE' : 'PAS'}: {l.client.documentNumber}
                                  </p>
                                </div>
                              </div>
                              <div className="text-right">
                                <p className="font-bold text-sm text-emerald-600 dark:text-emerald-300">
                                  {formatCurrency(l.amount)}
                                </p>
                                <Badge
                                  variant="outline"
                                  className={`text-[10px] ${
                                    isMora
                                      ? 'bg-red-100 text-red-800 border-red-200'
                                      : 'bg-emerald-100 text-emerald-800 border-emerald-200'
                                  }`}
                                >
                                  {isMora ? 'Mora' : 'Activo'}
                                </Badge>
                              </div>
                            </div>
                          </button>
                        );
                      })}
                    </div>
                  )}
                </div>
              </>
            ) : (
              <>
                {/* Selected Loan Summary */}
                <div className="flex items-center justify-between p-3 rounded-lg bg-emerald-50 dark:bg-emerald-950/50 border border-emerald-200">
                  <div className="flex items-center gap-2">
                    <CheckCircle2 className="h-4 w-4 text-emerald-600 dark:text-emerald-300 shrink-0" />
                    <div>
                      <span className="font-semibold text-sm text-emerald-800 dark:text-emerald-200">
                        {selectedLoan?.client.name}
                      </span>
                      <p className="text-xs text-emerald-600 dark:text-emerald-300">
                        {formatCurrency(selectedLoan?.amount || 0)}
                      </p>
                    </div>
                  </div>
                  <Button
                    variant="ghost"
                    size="sm"
                    className="h-6 w-6 p-0 text-emerald-600 dark:text-emerald-300 hover:bg-emerald-100 dark:hover:bg-emerald-900/50"
                    onClick={() => setSelectedLoanId('')}
                  >
                    <X className="h-3 w-3" />
                  </Button>
                </div>

                <Separator />

                {/* Amount */}
                <div>
                  <Label className="text-sm font-semibold text-foreground/80 dark:text-foreground/80 mb-2 block">
                    Monto a Cobrar
                  </Label>
                  <div className="relative">
                    <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground text-sm">
                      S/
                    </span>
                    <Input
                      type="number"
                      step="0.01"
                      min="0.01"
                      value={amount}
                      onChange={(e) => setAmount(e.target.value)}
                      className="pl-9 h-11 bg-white dark:bg-[#05060b]/80 border-input"
                      placeholder="0.00"
                    />
                  </div>
                </div>

                {/* Payment Method */}
                {amount && parseFloat(amount) > 0 && (
                  <div>
                    <Label className="text-sm font-semibold text-foreground/80 dark:text-foreground/80 mb-3 block">
                      Método de Pago
                    </Label>
                    <RadioGroup
                      value={paymentMethod}
                      onValueChange={setPaymentMethod}
                      className="grid grid-cols-3 gap-2"
                    >
                      {[
                        { v: 'cash', l: 'Efectivo', ic: Banknote, c: 'text-emerald-600' },
                        { v: 'plin', l: 'Plin', ic: Wifi, c: 'text-sky-600' },
                        { v: 'transfer', l: 'Transferencia', ic: ArrowRightLeft, c: 'text-teal-600' },
                      ].map((m) => {
                        const Ic = m.ic;
                        return (
                          <Label
                            key={m.v}
                            className={`flex items-center gap-2 p-3 rounded-lg border cursor-pointer transition-all ${
                              paymentMethod === m.v
                                ? 'border-emerald-500 bg-emerald-50 dark:bg-emerald-950/50 ring-2 ring-emerald-500/20'
                                : 'border-input dark:border-emerald-500/5 hover:border-emerald-300'
                            }`}
                          >
                            <RadioGroupItem value={m.v} />
                            <Ic className={`h-4 w-4 ${m.c}`} />
                            <span className="text-sm font-medium">{m.l}</span>
                          </Label>
                        );
                      })}
                    </RadioGroup>
                  </div>
                )}

                {/* Observation */}
                {amount && parseFloat(amount) > 0 && (
                  <div>
                    <Label className="text-sm font-semibold text-foreground/80 dark:text-foreground/80 mb-2 block">
                      Observación
                    </Label>
                    <Input
                      value={observation}
                      onChange={(e) => setObservation(e.target.value)}
                      className="bg-white dark:bg-[#05060b]/80 border-input"
                      placeholder="Opcional"
                    />
                  </div>
                )}
              </>
            )}
          </div>
        </ScrollArea>

        <DialogFooter className="px-5 py-4 border-t border-input/50 dark:border-emerald-500/10 bg-background/50/50 dark:bg-[#05060b]/70 shrink-0">
          <Button
            variant="outline"
            onClick={() => {
              reset();
              onOpenChange(false);
            }}
            className="border-input"
          >
            Cancelar
          </Button>
          <Button
            className="bg-gradient-to-r from-emerald-500 to-teal-600 text-white border-0 shadow-lg shadow-emerald-500/20 min-w-[160px]"
            disabled={!selectedLoanId || !amount || parseFloat(amount) <= 0 || registering}
            onClick={handleSubmit}
          >
            {registering ? (
              <>
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                Registrando...
              </>
            ) : (
              <>
                <DollarSign className="h-4 w-4 mr-2" />
                Registrar Cobro
              </>
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
