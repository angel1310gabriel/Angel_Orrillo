'use client';

import { useState, useEffect } from 'react';
import { Wallet, Plus, Loader2, CheckCircle2, XCircle, Clock, Tag, Calendar } from 'lucide-react';
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
import { Card, CardContent } from '@/components/ui/card';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Textarea } from '@/components/ui/textarea';
import { useToast } from '@/hooks/use-toast';
import { formatCurrency } from '@/lib/format-helpers';
import { useAuth } from '@/hooks/use-auth';

interface Expense {
  id: string;
  collectorId: string;
  amount: number;
  category: string;
  description: string | null;
  expenseDate: string;
  receiptPhoto: string | null;
  status: string;
  approvedBy: string | null;
  createdAt: string;
}

interface CollectorExpensesPanelProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  collectorId: string | null;
  collectorName: string;
}

const CATEGORY_LABELS: Record<string, string> = {
  combustible: 'Combustible',
  viaticos: 'Viáticos',
  mantenimiento: 'Mantenimiento',
  otros: 'Otros',
};

const STATUS_LABELS: Record<string, string> = {
  pending: 'Pendiente',
  approved: 'Aprobado',
  rejected: 'Rechazado',
};

const STATUS_CLASSES: Record<string, string> = {
  pending: 'bg-amber-100 dark:bg-amber-900/50 text-amber-800 dark:text-amber-200 border-amber-200 dark:border-amber-800',
  approved:
    'bg-emerald-100 dark:bg-emerald-900/50 text-emerald-800 dark:text-emerald-200 border-emerald-200 dark:border-emerald-800',
  rejected: 'bg-red-100 dark:bg-red-900/50 text-red-800 dark:text-red-200 border-red-200 dark:border-red-800',
};

export default function CollectorExpensesPanel({
  open,
  onOpenChange,
  collectorId,
  collectorName,
}: CollectorExpensesPanelProps) {
  const { toast } = useToast();
  const { user } = useAuth();
  const [expenses, setExpenses] = useState<Expense[]>([]);
  const [loading, setLoading] = useState(false);
  const [showForm, setShowForm] = useState(false);
  const [saving, setSaving] = useState(false);
  const [newExpense, setNewExpense] = useState({
    amount: 0,
    category: '',
    description: '',
    expenseDate: new Date().toISOString().split('T')[0],
  });

  const isAdmin = user?.role === 'admin';

  const fetchExpenses = async () => {
    if (!collectorId) return;
    setLoading(true);
    try {
      const res = await fetch(`/api/collector-expenses?collectorId=${collectorId}`);
      if (res.ok) {
        const data = await res.json();
        setExpenses(data?.expenses || data || []);
      }
    } catch {
      toast({
        title: 'Error',
        description: 'No se pudieron cargar los gastos',
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (open && collectorId) {
      fetchExpenses();
    }
  }, [open, collectorId]);

  const handleSubmit = async () => {
    if (!collectorId || !newExpense.category || !newExpense.expenseDate || newExpense.amount <= 0) {
      toast({
        title: 'Campos requeridos',
        description: 'Complete todos los campos obligatorios',
        variant: 'destructive',
      });
      return;
    }

    setSaving(true);
    try {
      const res = await fetch('/api/collector-expenses', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          collectorId,
          amount: newExpense.amount,
          category: newExpense.category,
          description: newExpense.description || null,
          expenseDate: newExpense.expenseDate,
        }),
      });

      if (res.ok) {
        toast({ title: 'Gasto registrado', description: 'El gasto fue registrado exitosamente' });
        setShowForm(false);
        setNewExpense({
          amount: 0,
          category: '',
          description: '',
          expenseDate: new Date().toISOString().split('T')[0],
        });
        await fetchExpenses();
      } else {
        const data = await res.json();
        toast({
          title: 'Error',
          description: data.error || 'No se pudo registrar el gasto',
          variant: 'destructive',
        });
      }
    } catch {
      toast({ title: 'Error', description: 'Error de conexión', variant: 'destructive' });
    } finally {
      setSaving(false);
    }
  };

  const handleStatusChange = async (id: string, status: 'approved' | 'rejected') => {
    try {
      const res = await fetch(`/api/collector-expenses?id=${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status, approvedBy: 'admin' }),
      });

      if (res.ok) {
        toast({
          title: status === 'approved' ? 'Gasto aprobado' : 'Gasto rechazado',
          description: `El gasto fue ${status === 'approved' ? 'aprobado' : 'rechazado'} exitosamente`,
        });
        await fetchExpenses();
      } else {
        const data = await res.json();
        toast({
          title: 'Error',
          description: data.error || 'No se pudo actualizar el estado',
          variant: 'destructive',
        });
      }
    } catch {
      toast({ title: 'Error', description: 'Error de conexión', variant: 'destructive' });
    }
  };

  const formatDate = (dateStr: string) => {
    return new Date(dateStr).toLocaleDateString('es-PE', {
      day: '2-digit',
      month: 'short',
      year: 'numeric',
    });
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-xl max-h-[85vh] flex flex-col p-0">
        <DialogHeader className="px-6 pt-6 pb-4 border-b border-slate-100 dark:border-slate-800">
          <DialogTitle className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-emerald-500 to-teal-600 shadow-lg shadow-emerald-500/25 flex items-center justify-center"><Wallet className="h-4 w-4 text-white" /></div>
            Gastos de {collectorName}
          </DialogTitle>
        </DialogHeader>

        <div className="px-6 py-4">
          {showForm ? (
            <div className="space-y-4 p-4 rounded-xl border border-emerald-200 bg-emerald-50/50 dark:bg-emerald-950/30">
              <div>
                <Label className="text-sm font-semibold text-slate-700 dark:text-slate-300">Monto</Label>
                <Input
                  type="number"
                  step="0.01"
                  min="0"
                  placeholder="0.00"
                  value={newExpense.amount || ''}
                  onChange={(e) => setNewExpense({ ...newExpense, amount: parseFloat(e.target.value) || 0 })}
                  className="mt-1.5"
                />
              </div>
              <div>
                <Label className="text-sm font-semibold text-slate-700 dark:text-slate-300">Categoría</Label>
                <Select
                  value={newExpense.category}
                  onValueChange={(v) => setNewExpense({ ...newExpense, category: v })}
                >
                  <SelectTrigger className="mt-1.5">
                    <SelectValue placeholder="Seleccionar categoría" />
                  </SelectTrigger>
                  <SelectContent>
                    {Object.entries(CATEGORY_LABELS).map(([value, label]) => (
                      <SelectItem key={value} value={value}>
                        {label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label className="text-sm font-semibold text-slate-700 dark:text-slate-300">Descripción</Label>
                <Textarea
                  placeholder="Descripción del gasto..."
                  value={newExpense.description}
                  onChange={(e) => setNewExpense({ ...newExpense, description: e.target.value })}
                  className="mt-1.5"
                  rows={2}
                />
              </div>
              <div>
                <Label className="text-sm font-semibold text-slate-700 dark:text-slate-300">Fecha</Label>
                <Input
                  type="date"
                  value={newExpense.expenseDate}
                  onChange={(e) => setNewExpense({ ...newExpense, expenseDate: e.target.value })}
                  className="mt-1.5"
                />
              </div>
              <div className="flex gap-2 pt-1">
                <Button
                  className="flex-1 bg-emerald-600 hover:bg-emerald-700 text-white"
                  onClick={handleSubmit}
                  disabled={saving}
                >
                  {saving ? (
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  ) : (
                    <Wallet className="h-4 w-4 mr-2" />
                  )}
                  Guardar
                </Button>
                <Button variant="outline" onClick={() => setShowForm(false)}>
                  Cancelar
                </Button>
              </div>
            </div>
          ) : (
            <Button
              className="w-full bg-emerald-600 hover:bg-emerald-700 text-white"
              onClick={() => setShowForm(true)}
            >
              <Plus className="h-4 w-4 mr-2" />
              Registrar Gasto
            </Button>
          )}
        </div>

        <ScrollArea className="flex-1 px-6 pb-6">
          {loading ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="h-6 w-6 animate-spin text-emerald-600" />
            </div>
          ) : expenses.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-12 text-muted-foreground">
              <div className="w-12 h-12 rounded-full bg-emerald-50 dark:bg-emerald-950/30 flex items-center justify-center mb-3">
                <Wallet className="h-6 w-6 text-emerald-400" />
              </div>
              <p className="text-sm text-slate-500 dark:text-slate-400">Sin gastos registrados</p>
            </div>
          ) : (
            <div className="space-y-3">
              {expenses.map((expense) => (
                <Card key={expense.id} className="border border-slate-100 dark:border-slate-800 shadow-sm">
                  <CardContent className="p-4 space-y-3">
                    <div className="flex items-start justify-between gap-2">
                      <div className="space-y-1">
                        <span className="font-bold text-lg text-slate-900 dark:text-slate-100">
                          {formatCurrency(expense.amount)}
                        </span>
                        <div className="flex items-center gap-2 flex-wrap">
                          <Badge
                            variant="outline"
                            className="text-xs bg-sky-50 dark:bg-sky-950/50 text-sky-700 dark:text-sky-300 border-sky-200 dark:border-sky-800"
                          >
                            <Tag className="h-3 w-3 mr-1" />
                            {CATEGORY_LABELS[expense.category] || expense.category}
                          </Badge>
                          <Badge
                            variant="outline"
                            className={`text-xs ${STATUS_CLASSES[expense.status] || STATUS_CLASSES.pending}`}
                          >
                            {expense.status === 'pending' && <Clock className="h-3 w-3 mr-1" />}
                            {expense.status === 'approved' && <CheckCircle2 className="h-3 w-3 mr-1" />}
                            {expense.status === 'rejected' && <XCircle className="h-3 w-3 mr-1" />}
                            {STATUS_LABELS[expense.status] || expense.status}
                          </Badge>
                        </div>
                      </div>
                      <span className="flex items-center gap-1 text-xs text-slate-500 shrink-0">
                        <Calendar className="h-3 w-3" />
                        {formatDate(expense.expenseDate)}
                      </span>
                    </div>

                    {expense.description && (
                      <p className="text-sm text-slate-600 dark:text-slate-400">{expense.description}</p>
                    )}

                    {isAdmin && expense.status === 'pending' && (
                      <div className="flex items-center gap-2 pt-1">
                        <Button
                          size="sm"
                          variant="outline"
                          className="text-emerald-700 border-emerald-300 hover:bg-emerald-50 dark:text-emerald-300 dark:border-emerald-700 dark:hover:bg-emerald-950/50"
                          onClick={() => handleStatusChange(expense.id, 'approved')}
                        >
                          <CheckCircle2 className="h-3.5 w-3.5 mr-1.5" />
                          Aprobar
                        </Button>
                        <Button
                          size="sm"
                          variant="outline"
                          className="text-red-700 border-red-300 hover:bg-red-50 dark:text-red-300 dark:border-red-700 dark:hover:bg-red-950/50"
                          onClick={() => handleStatusChange(expense.id, 'rejected')}
                        >
                          <XCircle className="h-3.5 w-3.5 mr-1.5" />
                          Rechazar
                        </Button>
                      </div>
                    )}
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </ScrollArea>
      </DialogContent>
    </Dialog>
  );
}
