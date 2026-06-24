'use client';

import React, { useState, useEffect, useCallback } from 'react';
import {
  Wallet,
  TrendingUp,
  TrendingDown,
  DollarSign,
  Plus,
  Loader2,
  Calendar,
  Tag,
  ArrowUp,
  ArrowDown,
} from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Textarea } from '@/components/ui/textarea';
import { useToast } from '@/hooks/use-toast';

const CATEGORIES = [
  { value: 'prestamos', label: 'Préstamos' },
  { value: 'intereses', label: 'Intereses' },
  { value: 'gastos_operativos', label: 'Gastos Operativos' },
  { value: 'viaticos', label: 'Viáticos' },
  { value: 'comisiones', label: 'Comisiones' },
  { value: 'otros', label: 'Otros' },
];

const CATEGORY_LABEL: Record<string, string> = {};
CATEGORIES.forEach((c) => { CATEGORY_LABEL[c.value] = c.label; });

interface CajaMovement {
  id: string;
  type: 'income' | 'expense';
  amount: number;
  category: string;
  description: string | null;
  referenceType: string | null;
  referenceId: string | null;
  createdBy: string | null;
  createdAt: string;
}

const formatCurrency = (amount: number) =>
  `S/${amount.toLocaleString('es-PE', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

const formatDateTime = (dateStr: string) => {
  const d = new Date(dateStr);
  return d.toLocaleDateString('es-PE', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' });
};

const formatDateShort = (dateStr: string) => {
  const d = new Date(dateStr);
  return d.toLocaleDateString('es-PE', { day: '2-digit', month: 'short' });
};

export default function CajaTab() {
  const { toast } = useToast();

  const [movements, setMovements] = useState<CajaMovement[]>([]);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);

  const [formType, setFormType] = useState<'income' | 'expense'>('income');
  const [formAmount, setFormAmount] = useState('');
  const [formCategory, setFormCategory] = useState('');
  const [formDescription, setFormDescription] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const fetchMovements = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/caja?limit=100');
      if (res.ok) {
        const data = await res.json();
        setMovements(data.movements || []);
      } else {
        toast({ title: 'Error', description: 'No se pudo cargar movimientos', variant: 'destructive' });
      }
    } catch {
      toast({ title: 'Error', description: 'Error de conexión', variant: 'destructive' });
    } finally {
      setLoading(false);
    }
  }, [toast]);

  useEffect(() => {
    fetchMovements();
  }, [fetchMovements]);

  const openDialog = (type: 'income' | 'expense') => {
    setFormType(type);
    setFormAmount('');
    setFormCategory('');
    setFormDescription('');
    setDialogOpen(true);
  };

  const handleSubmit = async () => {
    const amount = parseFloat(formAmount);
    if (!amount || amount <= 0) {
      toast({ title: 'Monto inválido', description: 'Ingrese un monto mayor a 0', variant: 'destructive' });
      return;
    }
    if (!formCategory) {
      toast({ title: 'Categoría requerida', description: 'Seleccione una categoría', variant: 'destructive' });
      return;
    }

    setSubmitting(true);
    try {
      const res = await fetch('/api/caja', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          type: formType,
          amount,
          category: formCategory,
          description: formDescription || null,
        }),
      });

      if (res.ok) {
        toast({
          title: formType === 'income' ? 'Ingreso registrado' : 'Egreso registrado',
          description: `${formatCurrency(amount)} registrado exitosamente`,
        });
        setDialogOpen(false);
        fetchMovements();
      } else {
        const data = await res.json();
        toast({ title: 'Error', description: data.error || 'No se pudo registrar', variant: 'destructive' });
      }
    } catch {
      toast({ title: 'Error', description: 'Error de conexión', variant: 'destructive' });
    } finally {
      setSubmitting(false);
    }
  };

  const today = new Date();
  const todayStr = today.toISOString().slice(0, 10);

  const todayMovements = movements.filter((m) => m.createdAt.startsWith(todayStr));
  const todayIncome = todayMovements.filter((m) => m.type === 'income').reduce((s, m) => s + m.amount, 0);
  const todayExpense = todayMovements.filter((m) => m.type === 'expense').reduce((s, m) => s + m.amount, 0);
  const todayBalance = todayIncome - todayExpense;

  const totalIncome = movements.filter((m) => m.type === 'income').reduce((s, m) => s + m.amount, 0);
  const totalExpense = movements.filter((m) => m.type === 'expense').reduce((s, m) => s + m.amount, 0);
  const totalBalance = totalIncome - totalExpense;

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="h-8 w-8 animate-spin text-emerald-500" />
        <span className="ml-3 text-slate-500 dark:text-slate-400">Cargando caja...</span>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <Card className="border-emerald-100 dark:border-emerald-900">
          <CardContent className="p-4 flex items-center gap-3">
            <div className="p-2 rounded-lg bg-emerald-100 dark:bg-emerald-900/50">
              <TrendingUp className="h-5 w-5 text-emerald-600 dark:text-emerald-400" />
            </div>
            <div>
              <p className="text-xs text-slate-500 dark:text-slate-400">Ingresos (Hoy)</p>
              <p className="text-lg font-bold text-emerald-600 dark:text-emerald-400">{formatCurrency(todayIncome)}</p>
            </div>
          </CardContent>
        </Card>

        <Card className="border-red-100 dark:border-red-900">
          <CardContent className="p-4 flex items-center gap-3">
            <div className="p-2 rounded-lg bg-red-100 dark:bg-red-900/50">
              <TrendingDown className="h-5 w-5 text-red-600 dark:text-red-400" />
            </div>
            <div>
              <p className="text-xs text-slate-500 dark:text-slate-400">Egresos (Hoy)</p>
              <p className="text-lg font-bold text-red-600 dark:text-red-400">{formatCurrency(todayExpense)}</p>
            </div>
          </CardContent>
        </Card>

        <Card className="border-blue-100 dark:border-blue-900">
          <CardContent className="p-4 flex items-center gap-3">
            <div className="p-2 rounded-lg bg-blue-100 dark:bg-blue-900/50">
              <DollarSign className="h-5 w-5 text-blue-600 dark:text-blue-400" />
            </div>
            <div>
              <p className="text-xs text-slate-500 dark:text-slate-400">Saldo del Día</p>
              <p className={`text-lg font-bold ${todayBalance >= 0 ? 'text-emerald-600 dark:text-emerald-400' : 'text-red-600 dark:text-red-400'}`}>
                {formatCurrency(todayBalance)}
              </p>
            </div>
          </CardContent>
        </Card>

        <Card className="border-emerald-100 dark:border-emerald-900">
          <CardContent className="p-4 flex items-center gap-3">
            <div className="p-2 rounded-lg bg-emerald-100 dark:bg-emerald-900/50">
              <Wallet className="h-5 w-5 text-emerald-600 dark:text-emerald-400" />
            </div>
            <div>
              <p className="text-xs text-slate-500 dark:text-slate-400">Total en Caja</p>
              <p className={`text-lg font-bold ${totalBalance >= 0 ? 'text-emerald-600 dark:text-emerald-400' : 'text-red-600 dark:text-red-400'}`}>
                {formatCurrency(totalBalance)}
              </p>
            </div>
          </CardContent>
        </Card>
      </div>

      <div className="flex gap-2">
        <Button onClick={() => openDialog('income')} className="bg-emerald-600 hover:bg-emerald-700 text-white">
          <Plus className="h-4 w-4 mr-1" />
          Nuevo Ingreso
        </Button>
        <Button onClick={() => openDialog('expense')} variant="outline" className="border-red-300 text-red-600 hover:bg-red-50 dark:hover:bg-red-950">
          <Plus className="h-4 w-4 mr-1" />
          Nuevo Egreso
        </Button>
      </div>

      <Card>
        <CardContent className="p-0">
          <ScrollArea className="max-h-[500px]">
            {movements.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-16 text-slate-400">
                <Wallet className="h-12 w-12 mb-3 opacity-50" />
                <p className="text-sm">No hay movimientos registrados</p>
              </div>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-24">Fecha</TableHead>
                    <TableHead>Categoría</TableHead>
                    <TableHead>Descripción</TableHead>
                    <TableHead className="w-20">Tipo</TableHead>
                    <TableHead className="w-28 text-right">Monto</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {movements.map((m) => (
                    <TableRow key={m.id}>
                      <TableCell className="text-xs text-slate-500">{formatDateShort(m.createdAt)}</TableCell>
                      <TableCell>
                        <div className="flex items-center gap-1.5">
                          <Tag className="h-3.5 w-3.5 text-slate-400" />
                          <span className="text-sm">{CATEGORY_LABEL[m.category] || m.category}</span>
                        </div>
                      </TableCell>
                      <TableCell className="text-sm text-slate-600 dark:text-slate-400 max-w-[200px] truncate">
                        {m.description || '-'}
                      </TableCell>
                      <TableCell>
                        <Badge
                          variant="outline"
                          className={
                            m.type === 'income'
                              ? 'bg-emerald-50 dark:bg-emerald-900/50 text-emerald-700 dark:text-emerald-300 border-emerald-200'
                              : 'bg-red-50 dark:bg-red-900/50 text-red-700 dark:text-red-300 border-red-200'
                          }
                        >
                          {m.type === 'income' ? (
                            <ArrowUp className="h-3 w-3 mr-0.5" />
                          ) : (
                            <ArrowDown className="h-3 w-3 mr-0.5" />
                          )}
                          {m.type === 'income' ? 'Ingreso' : 'Egreso'}
                        </Badge>
                      </TableCell>
                      <TableCell className={`text-sm font-medium text-right ${m.type === 'income' ? 'text-emerald-600 dark:text-emerald-400' : 'text-red-600 dark:text-red-400'}`}>
                        {m.type === 'income' ? '+' : '-'}{formatCurrency(m.amount)}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </ScrollArea>
        </CardContent>
      </Card>

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>
              {formType === 'income' ? 'Nuevo Ingreso' : 'Nuevo Egreso'}
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label>Tipo</Label>
                <Select
                  value={formType}
                  onValueChange={(v) => setFormType(v as 'income' | 'expense')}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="income">Ingreso</SelectItem>
                    <SelectItem value="expense">Egreso</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label>Monto</Label>
                <Input
                  type="number"
                  step="0.01"
                  min="0.01"
                  placeholder="0.00"
                  value={formAmount}
                  onChange={(e) => setFormAmount(e.target.value)}
                />
              </div>
            </div>
            <div className="space-y-1.5">
              <Label>Categoría</Label>
              <Select value={formCategory} onValueChange={setFormCategory}>
                <SelectTrigger>
                  <SelectValue placeholder="Seleccionar categoría" />
                </SelectTrigger>
                <SelectContent>
                  {CATEGORIES.map((c) => (
                    <SelectItem key={c.value} value={c.value}>{c.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label>Descripción</Label>
              <Textarea
                placeholder="Descripción opcional"
                value={formDescription}
                onChange={(e) => setFormDescription(e.target.value)}
                rows={3}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogOpen(false)} disabled={submitting}>
              Cancelar
            </Button>
            <Button onClick={handleSubmit} disabled={submitting}>
              {submitting && <Loader2 className="h-4 w-4 mr-1 animate-spin" />}
              {formType === 'income' ? 'Registrar Ingreso' : 'Registrar Egreso'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
