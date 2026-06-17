'use client';

import React, { useState, useEffect, useCallback } from 'react';
import {
  CheckCircle2,
  Clock,
  DollarSign,
  TrendingUp,
  AlertTriangle,
  Loader2,
  Search,
  RefreshCw,
  Plus,
  Banknote,
  Smartphone,
  Wifi,
  ArrowRightLeft,
  User,
  Phone as PhoneIcon,
  MapPin,
  Calendar,
  CreditCard,
  PartyPopper,
  ChevronLeft,
  ChevronRight,
  X,
  Upload,
  Send,
  Trash2,
} from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
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
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Skeleton } from '@/components/ui/skeleton';
import { Alert, AlertDescription } from '@/components/ui/alert';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Calendar as CalendarComponent } from '@/components/ui/calendar';
import { useToast } from '@/hooks/use-toast';
import { useAuth } from '@/hooks/use-auth';

// ============================================================
// Types
// ============================================================

interface LoanForCollection {
  id: string;
  clientId: string;
  collectorId: string | null;
  amount: number;
  totalAmount: number;
  interest: number;
  days: number;
  dailyPayment: number;
  amountPaid: number;
  status: string;
  startDate: string | null;
  endDate: string | null;
  remaining: number;
  progressPercent: number;
  client: {
    id: string;
    name: string;
    documentNumber: string;
    documentType: string;
    phone: string;
  };
  collector: { id: string; name: string | null } | null;
}

interface PaymentRecord {
  id: string;
  loanId: string;
  collectorId: string | null;
  clientId: string | null;
  amount: number;
  interest: number | null;
  paymentMethod: string;
  status: string;
  observation: string | null;
  proofPhoto: string | null;
  gpsLatitude: number | null;
  gpsLongitude: number | null;
  paymentDate: string;
  createdAt: string;
  loan: {
    id: string;
    client: { id: string; name: string; documentNumber: string; documentType: string; phone: string };
    amount: number;
    totalAmount: number;
    amountPaid: number;
    dailyPayment: number;
    status: string;
  };
  collector: { id: string; name: string | null } | null;
}

interface Collector {
  id: string;
  name: string | null;
  email: string;
  phone?: string | null;
  role: string;
  isActive: boolean;
}

interface PaymentsTabProps {
  refreshTrigger?: number;
}

// ============================================================
// Helpers
// ============================================================

const formatCurrency = (amount: number) =>
  `S/${amount.toLocaleString('es-PE', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

const formatDate = (dateStr: string) => {
  const date = new Date(dateStr);
  return date.toLocaleDateString('es-PE', { day: '2-digit', month: 'short', year: 'numeric' });
};

const formatDateTime = (dateStr: string) => {
  const date = new Date(dateStr);
  return date.toLocaleDateString('es-PE', {
    day: '2-digit',
    month: 'short',
    hour: '2-digit',
    minute: '2-digit',
  });
};

const getTodayStr = () => {
  const d = new Date();
  return d.toISOString().split('T')[0];
};

const getDocumentLabel = (docType: string) => {
  switch (docType) {
    case 'dni': return 'DNI';
    case 'carnet_extranjeria': return 'Carnet Ext.';
    case 'pasaporte': return 'Pasaporte';
    case 'peruano': return 'DNI'; // backward compat
    case 'extranjero': return 'Carnet Ext.'; // backward compat
    default: return 'Doc.';
  }
};

const PAYMENT_METHODS = [
  { value: 'cash', label: 'Efectivo', icon: Banknote, color: 'text-emerald-600', bg: 'bg-emerald-50 border-emerald-200 hover:bg-emerald-100' },
  { value: 'yape', label: 'Yape', icon: Smartphone, color: 'text-purple-600', bg: 'bg-purple-50 border-purple-200 hover:bg-purple-100' },
  { value: 'plin', label: 'Plin', icon: Wifi, color: 'text-sky-600', bg: 'bg-sky-50 border-sky-200 hover:bg-sky-100' },
  { value: 'transfer', label: 'Transferencia', icon: ArrowRightLeft, color: 'text-teal-600', bg: 'bg-teal-50 border-teal-200 hover:bg-teal-100' },
] as const;

const PAYMENT_METHOD_LABELS: Record<string, string> = {
  cash: 'Efectivo',
  yape: 'Yape',
  plin: 'Plin',
  transfer: 'Transferencia',
};

const getMethodIcon = (method: string) => {
  const found = PAYMENT_METHODS.find((m) => m.value === method);
  return found ? found.icon : Banknote;
};

const getMethodColor = (method: string) => {
  const found = PAYMENT_METHODS.find((m) => m.value === method);
  return found ? found.color : 'text-slate-600';
};

// ============================================================
// Main Component
// ============================================================

export default function PaymentsTab({ refreshTrigger }: PaymentsTabProps) {
  const { toast } = useToast();
  const { user } = useAuth();
  const isAdmin = user?.role === 'admin';

  // Date state
  const [selectedDate, setSelectedDate] = useState<Date>(new Date());
  const [calendarOpen, setCalendarOpen] = useState(false);

  // Loans for daily collection
  const [activeLoans, setActiveLoans] = useState<LoanForCollection[]>([]);
  const [loadingLoans, setLoadingLoans] = useState(true);

  // Today's payments
  const [todayPayments, setTodayPayments] = useState<PaymentRecord[]>([]);
  const [loadingPayments, setLoadingPayments] = useState(true);

  // Collectors
  const [collectors, setCollectors] = useState<Collector[]>([]);

  // Register payment dialog
  const [registerOpen, setRegisterOpen] = useState(false);
  const [registering, setRegistering] = useState(false);
  const [selectedLoanId, setSelectedLoanId] = useState('');
  const [paymentAmount, setPaymentAmount] = useState('');
  const [paymentMethod, setPaymentMethod] = useState('cash');
  const [paymentCollectorId, setPaymentCollectorId] = useState('');
  const [paymentObservation, setPaymentObservation] = useState('');
  const [loanSearch, setLoanSearch] = useState('');

  // Payment method sub-forms
  const [cashReceived, setCashReceived] = useState('');
  const [proofFileBase64, setProofFileBase64] = useState('');
  const [proofPreview, setProofPreview] = useState('');
  const [qrDataUrl, setQrDataUrl] = useState('');

  // Loan completed celebration
  const [completedLoanName, setCompletedLoanName] = useState<string | null>(null);
  const [celebrationOpen, setCelebrationOpen] = useState(false);

  // Payment history pagination
  const [historyPage, setHistoryPage] = useState(1);
  const [historyTotalPages, setHistoryTotalPages] = useState(1);

  // Delete payment
  const [deletePaymentId, setDeletePaymentId] = useState<string | null>(null);
  const [deletingPayment, setDeletingPayment] = useState(false);

  // ============================================================
  // Data Fetching
  // ============================================================

  const dateString = selectedDate.toISOString().split('T')[0];
  const isToday = dateString === getTodayStr();

  const fetchLoans = useCallback(async () => {
    setLoadingLoans(true);
    try {
      const [activeRes, moraRes] = await Promise.all([
        fetch('/api/loans?status=active&limit=200'),
        fetch('/api/loans?status=mora&limit=200'),
      ]);

      const allLoans: LoanForCollection[] = [];

      if (activeRes.ok) {
        const data = await activeRes.json();
        allLoans.push(...data.loans);
      }
      if (moraRes.ok) {
        const data = await moraRes.json();
        allLoans.push(...data.loans);
      }

      // Calculate remaining and progress
      const enriched = allLoans.map((loan) => {
        const remaining = loan.totalAmount - loan.amountPaid;
        const progressPercent = loan.totalAmount > 0 ? (loan.amountPaid / loan.totalAmount) * 100 : 0;
        return { ...loan, remaining: Math.max(0, remaining), progressPercent };
      });

      setActiveLoans(enriched);
    } catch (error) {
      console.error('Error fetching loans:', error);
      toast({ title: 'Error', description: 'No se pudieron cargar los préstamos', variant: 'destructive' });
    } finally {
      setLoadingLoans(false);
    }
  }, [toast]);

  const fetchTodayPayments = useCallback(async () => {
    setLoadingPayments(true);
    try {
      const params = new URLSearchParams({
        date: dateString,
        page: historyPage.toString(),
        limit: '20',
      });
      const res = await fetch(`/api/payments?${params}`);
      if (res.ok) {
        const data = await res.json();
        setTodayPayments(data.payments);
        setHistoryTotalPages(data.pagination.totalPages);
      }
    } catch (error) {
      console.error('Error fetching payments:', error);
      toast({ title: 'Error', description: 'No se pudieron cargar los pagos', variant: 'destructive' });
    } finally {
      setLoadingPayments(false);
    }
  }, [dateString, historyPage, toast]);

  const fetchCollectors = useCallback(async () => {
    try {
      const res = await fetch('/api/collectors');
      if (res.ok) {
        const data = await res.json();
        setCollectors(data.collectors);
      }
    } catch {
      // silent
    }
  }, []);

  useEffect(() => {
    fetchLoans();
  }, [fetchLoans]);

  useEffect(() => {
    fetchTodayPayments();
  }, [fetchTodayPayments]);

  useEffect(() => {
    fetchCollectors();
  }, [fetchCollectors]);

  useEffect(() => {
    if (refreshTrigger) {
      fetchLoans();
      fetchTodayPayments();
    }
  }, [refreshTrigger, fetchLoans, fetchTodayPayments]);

  // ============================================================
  // Computed Values
  // ============================================================

  // Determine which loans have been paid today
  const paidLoanIds = new Set(todayPayments.map((p) => p.loanId));

  const totalExpected = activeLoans.reduce((sum, l) => sum + l.dailyPayment, 0);
  const totalCollected = todayPayments.reduce((sum, p) => sum + p.amount, 0);
  const paidCount = activeLoans.filter((l) => paidLoanIds.has(l.id)).length;
  const pendingCount = activeLoans.length - paidCount;
  const completedTodayCount = todayPayments.filter(
    (p) => p.loan && p.loan.status === 'completed'
  ).length;

  // Filter loans for search in register dialog
  const filteredLoans = loanSearch.trim()
    ? activeLoans.filter(
        (l) =>
          l.client.name.toLowerCase().includes(loanSearch.toLowerCase()) ||
          l.client.documentNumber.includes(loanSearch) ||
          l.client.phone.includes(loanSearch)
      )
    : activeLoans;

  const selectedLoan = activeLoans.find((l) => l.id === selectedLoanId);

  // Generate QR for Yape/Plin
  useEffect(() => {
    if ((paymentMethod === 'yape' || paymentMethod === 'plin') && selectedLoan && paymentAmount) {
      const generateQR = async () => {
        try {
          const QRCode = (await import('qrcode')).default;
          const data = await QRCode.toDataURL(
            `${paymentMethod === 'yape' ? 'Yape' : 'Plin'} - KC Cobranzas - S/${paymentAmount} - Ref: ${selectedLoan.id.slice(0, 8)}`,
            { width: 220, margin: 2, color: { dark: '#000', light: '#fff' } }
          );
          setQrDataUrl(data);
        } catch {
          setQrDataUrl('');
        }
      };
      generateQR();
    } else {
      setQrDataUrl('');
    }
  }, [paymentMethod, paymentAmount, selectedLoan]);

  const vueltoAmount = cashReceived && paymentAmount ? Math.max(0, parseFloat(cashReceived) - parseFloat(paymentAmount)) : 0;

  const BANK_ACCOUNTS = [
    { bank: 'BCP', account: '191-12345678-0-00', holder: 'KC Cobranzas' },
    { bank: 'BBVA', account: '0011-0123-4500123456', holder: 'KC Cobranzas' },
    { bank: 'Interbank', account: '898-1234567890', holder: 'KC Cobranzas' },
  ];

  const handleProofFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      const result = reader.result as string;
      setProofPreview(result);
      setProofFileBase64(result.split(',')[1]);
    };
    reader.readAsDataURL(file);
  };

  const handleSendWhatsApp = (message: string) => {
    if (!selectedLoan?.client.phone) {
      toast({ title: 'Sin teléfono', description: 'El cliente no tiene número registrado', variant: 'destructive' });
      return;
    }
    const phone = selectedLoan.client.phone.replace(/[^0-9]/g, '');
    const fullPhone = phone.startsWith('51') ? phone : `51${phone}`;
    const url = `https://wa.me/${fullPhone}?text=${encodeURIComponent(message)}`;
    window.open(url, '_blank');
  };

  // ============================================================
  // Payment Registration
  // ============================================================

  const handleOpenRegister = (loanId?: string) => {
    setSelectedLoanId(loanId || '');
    setPaymentAmount('');
    setPaymentMethod('cash');
    setPaymentCollectorId('');
    setPaymentObservation('');
    setLoanSearch('');
    setCashReceived('');
    setProofFileBase64('');
    setProofPreview('');
    setQrDataUrl('');
    setRegisterOpen(true);
  };

  const handleSelectLoan = (loanId: string) => {
    setSelectedLoanId(loanId);
    const loan = activeLoans.find((l) => l.id === loanId);
    if (loan) {
      setPaymentAmount(loan.dailyPayment.toString());
    }
    setCashReceived('');
    setProofFileBase64('');
    setProofPreview('');
    setQrDataUrl('');
  };

  const handleRegisterPayment = async () => {
    if (!selectedLoanId || !paymentAmount) {
      toast({ title: 'Campos requeridos', description: 'Seleccione un préstamo e ingrese el monto', variant: 'destructive' });
      return;
    }

    const amount = parseFloat(paymentAmount);
    if (isNaN(amount) || amount <= 0) {
      toast({ title: 'Monto inválido', description: 'El monto debe ser mayor a 0', variant: 'destructive' });
      return;
    }

    setRegistering(true);
    try {
      const body: Record<string, unknown> = {
        loanId: selectedLoanId,
        amount,
        paymentMethod,
        observation: paymentObservation || null,
        proofPhoto: proofFileBase64 || null,
      };
      if (paymentCollectorId) body.collectorId = paymentCollectorId;

      const res = await fetch('/api/payments', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });

      if (res.ok) {
        const data = await res.json();

        if (data.loanCompleted) {
          setCompletedLoanName(data.loan?.client?.name || 'Cliente');
          setCelebrationOpen(true);
        } else {
          toast({
            title: 'Cobro registrado',
            description: `${formatCurrency(amount)} cobrado a ${selectedLoan?.client.name || 'cliente'}`,
          });
        }

        setRegisterOpen(false);
        resetForm();
        fetchLoans();
        fetchTodayPayments();
      } else {
        const data = await res.json();
        toast({ title: 'Error', description: data.error || 'No se pudo registrar el cobro', variant: 'destructive' });
      }
    } catch {
      toast({ title: 'Error', description: 'Error de conexión', variant: 'destructive' });
    } finally {
      setRegistering(false);
    }
  };

  const handleDeletePayment = async () => {
    if (!deletePaymentId) return;
    setDeletingPayment(true);
    try {
      const res = await fetch(`/api/payments?id=${deletePaymentId}`, { method: 'DELETE' });
      if (res.ok) {
        toast({ title: 'Pago eliminado', description: 'El pago ha sido eliminado' });
        setDeletePaymentId(null);
        fetchLoans();
        fetchTodayPayments();
      } else {
        const data = await res.json();
        toast({ title: 'Error', description: data.error || 'No se pudo eliminar', variant: 'destructive' });
      }
    } catch {
      toast({ title: 'Error', description: 'Error de conexión', variant: 'destructive' });
    } finally {
      setDeletingPayment(false);
    }
  };

  const resetForm = () => {
    setSelectedLoanId('');
    setPaymentAmount('');
    setPaymentMethod('cash');
    setPaymentCollectorId('');
    setPaymentObservation('');
    setLoanSearch('');
    setCashReceived('');
    setProofFileBase64('');
    setProofPreview('');
  };

  // ============================================================
  // Render
  // ============================================================

  const dateLabel = isToday
    ? 'Hoy'
    : formatDate(selectedDate.toISOString());

  return (
    <div className="space-y-6">
      {/* ============================================================ */}
      {/* SUMMARY CARDS */}
      {/* ============================================================ */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Card className="border-0 shadow-md bg-gradient-to-br from-emerald-500 to-emerald-600 text-white">
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-emerald-100 text-xs font-medium">Cobrado {isToday ? 'Hoy' : ''}</p>
                <p className="text-lg sm:text-xl md:text-2xl font-bold mt-1">{formatCurrency(totalCollected)}</p>
              </div>
              <DollarSign className="h-8 w-8 text-emerald-200" />
            </div>
          </CardContent>
        </Card>

        <Card className="border-0 shadow-md bg-gradient-to-br from-teal-500 to-teal-600 text-white">
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-teal-100 text-xs font-medium">Pagos {isToday ? 'Hoy' : ''}</p>
                <p className="text-2xl font-bold mt-1">{todayPayments.length}</p>
              </div>
              <CreditCard className="h-8 w-8 text-teal-200" />
            </div>
          </CardContent>
        </Card>

        <Card className="border-0 shadow-md bg-gradient-to-br from-amber-500 to-orange-500 text-white">
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-amber-100 text-xs font-medium">Pendiente {isToday ? 'Hoy' : ''}</p>
                <p className="text-2xl font-bold mt-1">{pendingCount}</p>
              </div>
              <Clock className="h-8 w-8 text-amber-200" />
            </div>
          </CardContent>
        </Card>

        <Card className="border-0 shadow-md bg-gradient-to-br from-rose-500 to-red-600 text-white">
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-rose-100 text-xs font-medium">Completados {isToday ? 'Hoy' : ''}</p>
                <p className="text-2xl font-bold mt-1">{completedTodayCount}</p>
              </div>
              <TrendingUp className="h-8 w-8 text-rose-200" />
            </div>
          </CardContent>
        </Card>
      </div>

      {/* ============================================================ */}
      {/* TOOLBAR */}
      {/* ============================================================ */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div className="flex items-center gap-2">
          <Popover open={calendarOpen} onOpenChange={setCalendarOpen}>
            <PopoverTrigger asChild>
              <Button
                variant="outline"
                className="border-slate-200 gap-2 bg-white"
              >
                <Calendar className="h-4 w-4 text-emerald-600" />
                <span>{dateLabel}</span>
              </Button>
            </PopoverTrigger>
            <PopoverContent className="w-auto p-0" align="start">
              <CalendarComponent
                mode="single"
                selected={selectedDate}
                onSelect={(date) => {
                  if (date) {
                    setSelectedDate(date);
                    setCalendarOpen(false);
                  }
                }}
                initialFocus
              />
            </PopoverContent>
          </Popover>

          {!isToday && (
            <Button
              variant="outline"
              size="sm"
              className="border-emerald-200 text-emerald-600 hover:bg-emerald-50"
              onClick={() => setSelectedDate(new Date())}
            >
              Ir a Hoy
            </Button>
          )}
        </div>

        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="icon"
            className="border-slate-200 bg-white"
            onClick={() => {
              fetchLoans();
              fetchTodayPayments();
            }}
          >
            <RefreshCw className="h-4 w-4" />
          </Button>
          {isToday && (
            <Button
              className="bg-gradient-to-r from-emerald-500 to-teal-500 hover:from-emerald-600 hover:to-teal-600 text-white border-0 shadow-lg shadow-emerald-500/20"
              onClick={() => handleOpenRegister()}
            >
              <Plus className="h-4 w-4 mr-2" />
              <span className="hidden sm:inline">Registrar Cobro</span>
              <span className="sm:hidden">Cobro</span>
            </Button>
          )}
        </div>
      </div>

      {/* Collection Progress Bar */}
      {isToday && activeLoans.length > 0 && (
        <Card className="border-0 shadow-md bg-white">
          <CardContent className="p-4">
            <div className="flex items-center justify-between mb-2">
              <span className="text-sm font-medium text-slate-700">
                Progreso de Cobranza {dateLabel}
              </span>
              <span className="text-sm font-semibold text-emerald-600">
                {formatCurrency(totalCollected)} / {formatCurrency(totalExpected)}
              </span>
            </div>
            <Progress
              value={totalExpected > 0 ? (totalCollected / totalExpected) * 100 : 0}
              className="h-3 [&>div]:bg-gradient-to-r [&>div]:from-emerald-400 [&>div]:to-teal-500"
            />
            <div className="flex items-center justify-between mt-2 text-xs text-slate-500">
              <span className="flex items-center gap-1">
                <CheckCircle2 className="h-3 w-3 text-emerald-500" />
                {paidCount} cobrados
              </span>
              <span className="flex items-center gap-1">
                <Clock className="h-3 w-3 text-amber-500" />
                {pendingCount} pendientes
              </span>
              <span>
                {totalExpected > 0
                  ? `${((totalCollected / totalExpected) * 100).toFixed(1)}%`
                  : '0%'}
              </span>
            </div>
          </CardContent>
        </Card>
      )}

      {/* ============================================================ */}
      {/* DAILY COLLECTION CHECKLIST */}
      {/* ============================================================ */}
      <Card className="border-0 shadow-md bg-white">
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="text-lg flex items-center gap-2">
                <DollarSign className="h-5 w-5 text-emerald-600" />
                Cobranza del Día — {dateLabel}
              </CardTitle>
              <CardDescription>
                {activeLoans.length} préstamos ({paidCount} pagados, {pendingCount} pendientes)
              </CardDescription>
            </div>
            {isToday && (
              <Badge
                variant="outline"
                className={`text-xs ${
                  pendingCount === 0 && activeLoans.length > 0
                    ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                    : 'bg-amber-50 text-amber-700 border-amber-200'
                }`}
              >
                {pendingCount === 0 && activeLoans.length > 0
                  ? 'Todo cobrado'
                  : `${pendingCount} pendiente${pendingCount !== 1 ? 's' : ''}`}
              </Badge>
            )}
          </div>
        </CardHeader>
        <CardContent className="pt-0">
          {loadingLoans ? (
            <div className="space-y-3">
              {[...Array(5)].map((_, i) => (
                <div key={i} className="flex items-center gap-3 p-3">
                  <Skeleton className="h-10 w-10 rounded-full" />
                  <div className="flex-1 space-y-2">
                    <Skeleton className="h-4 w-48" />
                    <Skeleton className="h-3 w-32" />
                  </div>
                  <Skeleton className="h-8 w-24" />
                </div>
              ))}
            </div>
          ) : activeLoans.length === 0 ? (
            <div className="text-center py-12">
              <div className="w-16 h-16 rounded-full bg-slate-100 flex items-center justify-center mx-auto mb-4">
                <CheckCircle2 className="h-8 w-8 text-slate-400" />
              </div>
              <h3 className="text-lg font-semibold text-slate-700 mb-2">Sin cobranzas pendientes</h3>
              <p className="text-slate-500">No hay préstamos activos para cobrar</p>
            </div>
          ) : (
            <ScrollArea className="max-h-[500px]">
              <div className="space-y-2">
                {activeLoans
                  .sort((a, b) => {
                    // Sort: pending first, then paid
                    const aPaid = paidLoanIds.has(a.id);
                    const bPaid = paidLoanIds.has(b.id);
                    if (aPaid === bPaid) return a.client.name.localeCompare(b.client.name);
                    return aPaid ? 1 : -1;
                  })
                  .map((loan) => {
                    const isPaid = paidLoanIds.has(loan.id);
                    const loanPayments = todayPayments.filter((p) => p.loanId === loan.id);
                    const totalPaidForLoan = loanPayments.reduce((s, p) => s + p.amount, 0);
                    const isMora = loan.status === 'mora';

                    return (
                      <div
                        key={loan.id}
                        className={`flex items-center gap-3 p-3 rounded-xl border transition-all ${
                          isPaid
                            ? 'bg-emerald-50/50 border-emerald-200'
                            : isMora
                            ? 'bg-red-50/50 border-red-200'
                            : 'bg-amber-50/50 border-amber-200 hover:border-amber-300'
                        }`}
                      >
                        {/* Status Icon */}
                        <div
                          className={`w-10 h-10 rounded-full flex items-center justify-center shrink-0 ${
                            isPaid
                              ? 'bg-emerald-100'
                              : isMora
                              ? 'bg-red-100'
                              : 'bg-amber-100'
                          }`}
                        >
                          {isPaid ? (
                            <CheckCircle2 className="h-5 w-5 text-emerald-600" />
                          ) : isMora ? (
                            <AlertTriangle className="h-5 w-5 text-red-600" />
                          ) : (
                            <Clock className="h-5 w-5 text-amber-600" />
                          )}
                        </div>

                        {/* Client Info */}
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2">
                            <h4 className="font-semibold text-sm text-slate-900 truncate">
                              {loan.client.name}
                            </h4>
                            {isMora && (
                              <Badge variant="outline" className="bg-red-100 text-red-700 border-red-200 text-xs shrink-0">
                                Mora
                              </Badge>
                            )}
                            {isPaid && (
                              <Badge variant="outline" className="bg-emerald-100 text-emerald-700 border-emerald-200 text-xs shrink-0">
                                Pagado
                              </Badge>
                            )}
                          </div>
                          <div className="flex items-center gap-3 text-xs text-slate-500 mt-0.5">
                            <span className="flex items-center gap-1">
                              <PhoneIcon className="h-3 w-3" />
                              {loan.client.phone}
                            </span>
                            {loan.collector && (
                              <span className="flex items-center gap-1">
                                <User className="h-3 w-3" />
                                {loan.collector.name}
                              </span>
                            )}
                          </div>
                        </div>

                        {/* Amount */}
                        <div className="text-right shrink-0">
                          <p className="font-bold text-sm text-slate-900">
                            {formatCurrency(loan.dailyPayment)}
                          </p>
                          {isPaid && totalPaidForLoan !== loan.dailyPayment && (
                            <p className="text-xs text-emerald-600">
                              Cobrado: {formatCurrency(totalPaidForLoan)}
                            </p>
                          )}
                          {!isPaid && loan.remaining > 0 && (
                            <p className="text-xs text-slate-400">
                              Restante: {formatCurrency(loan.remaining)}
                            </p>
                          )}
                        </div>

                        {/* Quick Pay Button */}
                        {isToday && !isPaid && (
                          <Button
                            size="sm"
                            className="bg-gradient-to-r from-emerald-500 to-teal-500 hover:from-emerald-600 hover:to-teal-600 text-white border-0 shadow-sm shrink-0"
                            onClick={() => handleOpenRegister(loan.id)}
                          >
                            <DollarSign className="h-4 w-4 mr-1" />
                            Cobrar
                          </Button>
                        )}

                        {isPaid && (
                          <div className="shrink-0">
                            <CheckCircle2 className="h-6 w-6 text-emerald-500" />
                          </div>
                        )}
                      </div>
                    );
                  })}
              </div>
            </ScrollArea>
          )}
        </CardContent>
      </Card>

      {/* ============================================================ */}
      {/* PAYMENT HISTORY TABLE */}
      {/* ============================================================ */}
      <Card className="border-0 shadow-md bg-white">
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="text-lg flex items-center gap-2">
                <CreditCard className="h-5 w-5 text-teal-600" />
                Historial de Cobros — {dateLabel}
              </CardTitle>
              <CardDescription>
                {todayPayments.length} pago{todayPayments.length !== 1 ? 's' : ''} registrado{todayPayments.length !== 1 ? 's' : ''}
              </CardDescription>
            </div>
          </div>
        </CardHeader>
        <CardContent className="pt-0">
          {loadingPayments ? (
            <div className="space-y-3">
              {[...Array(3)].map((_, i) => (
                <div key={i} className="flex items-center gap-4">
                  <Skeleton className="h-4 w-24" />
                  <Skeleton className="h-4 w-32" />
                  <Skeleton className="h-4 w-20" />
                  <Skeleton className="h-4 w-20" />
                </div>
              ))}
            </div>
          ) : todayPayments.length === 0 ? (
            <div className="text-center py-8">
              <CreditCard className="h-10 w-10 text-slate-300 mx-auto mb-3" />
              <p className="text-slate-500 text-sm">No hay cobros registrados para {dateLabel}</p>
            </div>
          ) : (
            <>
              {/* Desktop Table */}
              <div className="hidden md:block">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Hora</TableHead>
                      <TableHead>Cliente</TableHead>
                      <TableHead>Monto</TableHead>
                      <TableHead>Método</TableHead>
                      <TableHead>Cobrador</TableHead>
                      <TableHead>Obs.</TableHead>
                      {isAdmin && <TableHead className="w-12"></TableHead>}
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {todayPayments.map((payment) => {
                      const MethodIcon = getMethodIcon(payment.paymentMethod);
                      const methodColor = getMethodColor(payment.paymentMethod);
                      return (
                        <TableRow key={payment.id}>
                          <TableCell className="text-sm text-slate-600">
                            {formatDateTime(payment.paymentDate)}
                          </TableCell>
                          <TableCell>
                            <div>
                              <p className="font-medium text-sm text-slate-900">
                                {payment.loan?.client?.name || '—'}
                              </p>
                              <p className="text-xs text-slate-500">
                                {payment.loan?.client?.documentNumber || ''}
                              </p>
                            </div>
                          </TableCell>
                          <TableCell className="font-bold text-emerald-600">
                            {formatCurrency(payment.amount)}
                          </TableCell>
                          <TableCell>
                            <div className="flex items-center gap-1.5">
                              <MethodIcon className={`h-4 w-4 ${methodColor}`} />
                              <span className="text-sm">
                                {PAYMENT_METHOD_LABELS[payment.paymentMethod] || payment.paymentMethod}
                              </span>
                            </div>
                          </TableCell>
                          <TableCell className="text-sm text-slate-600">
                            {payment.collector?.name || '—'}
                          </TableCell>
                          <TableCell className="text-xs text-slate-500 max-w-32 truncate">
                            {payment.observation || '—'}
                          </TableCell>
                          {isAdmin && (
                            <TableCell>
                              <Button
                                variant="ghost"
                                size="icon"
                                className="h-7 w-7 text-slate-400 hover:text-red-600 hover:bg-red-50"
                                onClick={() => setDeletePaymentId(payment.id)}
                              >
                                <Trash2 className="h-3.5 w-3.5" />
                              </Button>
                            </TableCell>
                          )}
                        </TableRow>
                      );
                    })}
                  </TableBody>
                </Table>
              </div>

              {/* Mobile Cards */}
              <div className="md:hidden space-y-3">
                {todayPayments.map((payment) => {
                  const MethodIcon = getMethodIcon(payment.paymentMethod);
                  const methodColor = getMethodColor(payment.paymentMethod);
                  return (
                    <div
                      key={payment.id}
                      className="p-3 rounded-xl border border-slate-100 bg-slate-50/50"
                    >
                      <div className="flex items-center justify-between mb-2">
                        <p className="font-semibold text-sm text-slate-900">
                          {payment.loan?.client?.name || '—'}
                        </p>
                        <div className="flex items-center gap-2">
                          <p className="font-bold text-emerald-600">
                            {formatCurrency(payment.amount)}
                          </p>
                          {isAdmin && (
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-7 w-7 text-slate-400 hover:text-red-600 hover:bg-red-50"
                              onClick={() => setDeletePaymentId(payment.id)}
                            >
                              <Trash2 className="h-3.5 w-3.5" />
                            </Button>
                          )}
                        </div>
                      </div>
                      <div className="flex items-center justify-between text-xs text-slate-500">
                        <div className="flex items-center gap-2">
                          <MethodIcon className={`h-3.5 w-3.5 ${methodColor}`} />
                          <span>{PAYMENT_METHOD_LABELS[payment.paymentMethod] || payment.paymentMethod}</span>
                          <span>•</span>
                          <span>{payment.collector?.name || '—'}</span>
                        </div>
                        <span>{formatDateTime(payment.paymentDate)}</span>
                      </div>
                    </div>
                  );
                })}
              </div>

              {/* Pagination */}
              {historyTotalPages > 1 && (
                <div className="flex items-center justify-center gap-2 pt-4">
                  <Button
                    variant="outline"
                    size="sm"
                    disabled={historyPage <= 1}
                    onClick={() => setHistoryPage(historyPage - 1)}
                  >
                    <ChevronLeft className="h-4 w-4" />
                  </Button>
                  <span className="text-sm text-slate-600">
                    Página {historyPage} de {historyTotalPages}
                  </span>
                  <Button
                    variant="outline"
                    size="sm"
                    disabled={historyPage >= historyTotalPages}
                    onClick={() => setHistoryPage(historyPage + 1)}
                  >
                    <ChevronRight className="h-4 w-4" />
                  </Button>
                </div>
              )}
            </>
          )}
        </CardContent>
      </Card>

      {/* ============================================================ */}
      {/* REGISTER PAYMENT DIALOG */}
      {/* ============================================================ */}
      <Dialog
        open={registerOpen}
        onOpenChange={(open) => {
          if (!open) resetForm();
          setRegisterOpen(open);
        }}
      >
        <DialogContent className="max-w-lg max-h-[90vh] overflow-hidden flex flex-col p-0">
          <DialogHeader className="px-6 pt-6 pb-4 border-b border-slate-100">
            <DialogTitle className="flex items-center gap-2 text-xl">
              <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-emerald-500 to-teal-500 flex items-center justify-center">
                <DollarSign className="h-4 w-4 text-white" />
              </div>
              Registrar Cobro
            </DialogTitle>
            <DialogDescription>
              Registre el cobro diario de un préstamo
            </DialogDescription>
          </DialogHeader>

          <ScrollArea className="flex-1 px-6">
            <div className="py-4 space-y-5">
              {/* Loan Selection */}
              {!selectedLoanId ? (
                <div className="space-y-3">
                  <Label className="text-sm font-semibold text-slate-700">
                    Seleccionar Préstamo
                  </Label>
                  <div className="relative">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
                    <Input
                      placeholder="Buscar por nombre, DNI o teléfono..."
                      value={loanSearch}
                      onChange={(e) => setLoanSearch(e.target.value)}
                      className="pl-9"
                    />
                  </div>
                  <ScrollArea className="max-h-64">
                    <div className="space-y-1.5 pr-2">
                      {filteredLoans.length === 0 ? (
                        <p className="text-sm text-slate-500 text-center py-4">
                          No se encontraron préstamos
                        </p>
                      ) : (
                        filteredLoans.map((loan) => {
                          const isPaid = paidLoanIds.has(loan.id);
                          const isMora = loan.status === 'mora';
                          return (
                            <button
                              key={loan.id}
                              className={`w-full text-left p-3 rounded-lg border transition-all ${
                                isPaid
                                  ? 'border-emerald-200 bg-emerald-50/50 opacity-60'
                                  : isMora
                                  ? 'border-red-200 bg-red-50/50 hover:border-red-300 hover:bg-red-50'
                                  : 'border-slate-200 hover:border-emerald-300 hover:bg-emerald-50/50'
                              }`}
                              onClick={() => !isPaid && handleSelectLoan(loan.id)}
                              disabled={isPaid}
                            >
                              <div className="flex items-center justify-between">
                                <div>
                                  <div className="flex items-center gap-2">
                                    <p className="font-medium text-sm text-slate-900">
                                      {loan.client.name}
                                    </p>
                                    {isPaid && (
                                      <Badge variant="outline" className="bg-emerald-100 text-emerald-700 border-emerald-200 text-xs">
                                        Pagado
                                      </Badge>
                                    )}
                                    {isMora && !isPaid && (
                                      <Badge variant="outline" className="bg-red-100 text-red-700 border-red-200 text-xs">
                                        Mora
                                      </Badge>
                                    )}
                                  </div>
                                  <p className="text-xs text-slate-500 mt-0.5">
                                    {getDocumentLabel(loan.client.documentType)}: {loan.client.documentNumber} | Tel: {loan.client.phone}
                                  </p>
                                </div>
                                <div className="text-right">
                                  <p className="font-bold text-sm text-emerald-600">
                                    {formatCurrency(loan.dailyPayment)}
                                  </p>
                                  <p className="text-xs text-slate-400">
                                    Restante: {formatCurrency(loan.remaining)}
                                  </p>
                                </div>
                              </div>
                            </button>
                          );
                        })
                      )}
                    </div>
                  </ScrollArea>
                </div>
              ) : (
                <>
                  {/* Selected Loan Summary */}
                  <Alert className="bg-emerald-50 border-emerald-200">
                    <CheckCircle2 className="h-4 w-4 text-emerald-600" />
                    <AlertDescription className="text-emerald-800">
                      <div className="flex items-center justify-between">
                        <div>
                          <span className="font-semibold">{selectedLoan?.client.name}</span>
                          <span className="text-emerald-600 text-xs ml-2">
                            {getDocumentLabel(selectedLoan?.client.documentType || 'dni')}: {selectedLoan?.client.documentNumber}
                          </span>
                        </div>
                        <Button
                          variant="ghost"
                          size="sm"
                          className="h-6 w-6 p-0 text-emerald-600 hover:bg-emerald-100"
                          onClick={() => {
                            setSelectedLoanId('');
                            setPaymentAmount('');
                          }}
                        >
                          <X className="h-3 w-3" />
                        </Button>
                      </div>
                    </AlertDescription>
                  </Alert>

                  {/* Loan Details */}
                  <div className="grid grid-cols-3 gap-3">
                    <div className="p-3 rounded-lg bg-slate-50 text-center">
                      <p className="text-xs text-slate-500">Monto</p>
                      <p className="font-bold text-sm text-slate-900">
                        {formatCurrency(selectedLoan?.amount || 0)}
                      </p>
                    </div>
                    <div className="p-3 rounded-lg bg-slate-50 text-center">
                      <p className="text-xs text-slate-500">Cuota Diaria</p>
                      <p className="font-bold text-sm text-emerald-600">
                        {formatCurrency(selectedLoan?.dailyPayment || 0)}
                      </p>
                    </div>
                    <div className="p-3 rounded-lg bg-slate-50 text-center">
                      <p className="text-xs text-slate-500">Restante</p>
                      <p className="font-bold text-sm text-amber-600">
                        {formatCurrency(selectedLoan?.remaining || 0)}
                      </p>
                    </div>
                  </div>

                  {/* Progress */}
                  <div>
                    <div className="flex items-center justify-between mb-1">
                      <span className="text-xs text-slate-500">Progreso del préstamo</span>
                      <span className="text-xs font-semibold text-emerald-600">
                        {selectedLoan?.progressPercent.toFixed(1)}%
                      </span>
                    </div>
                    <Progress
                      value={selectedLoan?.progressPercent || 0}
                      className="h-2 [&>div]:bg-gradient-to-r [&>div]:from-emerald-400 [&>div]:to-teal-500"
                    />
                    <div className="flex items-center justify-between mt-1">
                      <span className="text-xs text-slate-400">
                        {formatCurrency(selectedLoan?.amountPaid || 0)}
                      </span>
                      <span className="text-xs text-slate-400">
                        {formatCurrency(selectedLoan?.totalAmount || 0)}
                      </span>
                    </div>
                  </div>

                  <Separator />

                  {/* Payment Amount */}
                  <div>
                    <Label className="text-sm font-semibold text-slate-700">
                      Monto del Cobro
                    </Label>
                    <div className="relative mt-1.5">
                      <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500 text-sm font-medium">
                        S/
                      </span>
                      <Input
                        type="number"
                        step="0.01"
                        min="0"
                        value={paymentAmount}
                        onChange={(e) => setPaymentAmount(e.target.value)}
                        className="pl-9 text-lg font-bold"
                        placeholder="0.00"
                      />
                    </div>
                    <div className="flex items-center gap-2 mt-2">
                      <Button
                        variant="outline"
                        size="sm"
                        className="text-xs border-emerald-200 text-emerald-600 hover:bg-emerald-50"
                        onClick={() => setPaymentAmount(selectedLoan?.dailyPayment?.toString() || '')}
                      >
                        Cuota: {formatCurrency(selectedLoan?.dailyPayment || 0)}
                      </Button>
                      {selectedLoan?.remaining && selectedLoan.remaining > 0 && (
                        <Button
                          variant="outline"
                          size="sm"
                          className="text-xs border-amber-200 text-amber-600 hover:bg-amber-50"
                          onClick={() => setPaymentAmount(selectedLoan.remaining.toString())}
                        >
                          Saldo: {formatCurrency(selectedLoan.remaining)}
                        </Button>
                      )}
                    </div>
                  </div>

                  {/* Payment Method */}
                  <div>
                    <Label className="text-sm font-semibold text-slate-700 mb-3 block">
                      Método de Pago
                    </Label>
                    <RadioGroup
                      value={paymentMethod}
                      onValueChange={setPaymentMethod}
                      className="grid grid-cols-2 sm:grid-cols-3 gap-2"
                    >
                      {PAYMENT_METHODS.map((method) => {
                        const Icon = method.icon;
                        return (
                          <Label
                            key={method.value}
                            className={`flex items-center gap-2 p-3 rounded-lg border cursor-pointer transition-all ${
                              paymentMethod === method.value
                                ? method.bg + ' ring-2 ring-offset-1 ring-emerald-400'
                                : 'border-slate-200 hover:border-slate-300'
                            }`}
                          >
                            <RadioGroupItem value={method.value} />
                            <Icon className={`h-4 w-4 ${method.color}`} />
                            <span className="text-sm font-medium">{method.label}</span>
                          </Label>
                        );
                      })}
                    </RadioGroup>
                  </div>

                  {/* Payment Method Sub-forms */}
                  {paymentMethod === 'cash' && (
                    <div className="space-y-3 p-4 rounded-xl bg-amber-50 border border-amber-200">
                      <Label className="text-sm font-semibold text-amber-800">
                        Monto Recibido en Efectivo
                      </Label>
                      <div className="relative">
                        <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500 text-sm font-medium">
                          S/
                        </span>
                        <Input
                          type="number"
                          step="0.01"
                          min="0"
                          value={cashReceived}
                          onChange={(e) => setCashReceived(e.target.value)}
                          className="pl-9 bg-white border-amber-200"
                          placeholder="0.00"
                        />
                      </div>
                      {vueltoAmount > 0 && (
                        <div className="flex items-center justify-between p-3 rounded-lg bg-white border border-amber-200">
                          <span className="text-sm font-medium text-amber-700">Vuelto</span>
                          <span className="text-lg font-bold text-emerald-600">
                            {formatCurrency(vueltoAmount)}
                          </span>
                        </div>
                      )}
                      {parseFloat(cashReceived || '0') > 0 && parseFloat(cashReceived) < parseFloat(paymentAmount) && (
                        <p className="text-xs text-amber-600">
                          El monto recibido es menor al cobro
                        </p>
                      )}
                    </div>
                  )}

                  {(paymentMethod === 'yape' || paymentMethod === 'plin') && (
                    <div className="space-y-4 p-4 rounded-xl bg-purple-50 border border-purple-200">
                      {qrDataUrl && (
                        <div className="flex flex-col items-center gap-2">
                          <img
                            src={qrDataUrl}
                            alt="QR de pago"
                            className="w-48 h-48 rounded-xl bg-white p-2 shadow-sm"
                          />
                          <p className="text-xs text-purple-600 font-medium">
                            {paymentMethod === 'yape' ? 'Yape' : 'Plin'} - S/{parseFloat(paymentAmount || '0').toFixed(2)}
                          </p>
                        </div>
                      )}
                      <div className="flex gap-2">
                        {selectedLoan?.client.phone && (
                          <Button
                            variant="outline"
                            size="sm"
                            className="flex-1 border-purple-200 text-purple-600 hover:bg-purple-100 text-xs"
                            onClick={() => handleSendWhatsApp(
                              `*${paymentMethod === 'yape' ? 'YAPE' : 'PLIN'} - KC Cobranzas*\n\nMonto: S/${parseFloat(paymentAmount || '0').toFixed(2)}\nCliente: ${selectedLoan?.client.name}\nRef: ${selectedLoan?.id.slice(0, 8)}\n\nAdjunto el comprobante del pago.`
                            )}
                          >
                            <Send className="h-3.5 w-3.5 mr-1" />
                            Enviar por WhatsApp
                          </Button>
                        )}
                      </div>
                      <div>
                        <Label className="text-xs font-semibold text-purple-800">
                          Subir Comprobante
                        </Label>
                        <div className="mt-1.5 flex items-center gap-3">
                          <label className="flex items-center gap-2 px-3 py-2 rounded-lg border border-purple-200 bg-white cursor-pointer hover:bg-purple-50 text-xs text-purple-700">
                            <Upload className="h-3.5 w-3.5" />
                            {proofPreview ? 'Cambiar archivo' : 'Seleccionar imagen'}
                            <input
                              type="file"
                              accept="image/*"
                              onChange={handleProofFile}
                              className="hidden"
                            />
                          </label>
                          {proofFileBase64 && (
                            <button
                              className="text-xs text-red-500 hover:text-red-700"
                              onClick={() => { setProofFileBase64(''); setProofPreview(''); }}
                            >
                              Eliminar
                            </button>
                          )}
                        </div>
                        {proofPreview && (
                          <div className="mt-2">
                            <img
                              src={proofPreview}
                              alt="Comprobante"
                              className="w-full max-h-40 object-contain rounded-lg border border-purple-200 bg-white"
                            />
                          </div>
                        )}
                      </div>
                    </div>
                  )}

                  {paymentMethod === 'transfer' && (
                    <div className="space-y-4 p-4 rounded-xl bg-teal-50 border border-teal-200">
                      <Label className="text-sm font-semibold text-teal-800">
                        Transferencia Bancaria
                      </Label>
                      <div className="space-y-2">
                        {BANK_ACCOUNTS.map((acc, i) => (
                          <div
                            key={i}
                            className="flex items-center justify-between p-2.5 rounded-lg bg-white border border-teal-200"
                          >
                            <div>
                              <p className="text-sm font-semibold text-slate-800">{acc.bank}</p>
                              <p className="text-xs text-slate-500 font-mono">{acc.account}</p>
                            </div>
                          </div>
                        ))}
                      </div>
                      {selectedLoan?.client.phone && (
                        <Button
                          variant="outline"
                          size="sm"
                          className="w-full border-teal-200 text-teal-600 hover:bg-teal-100 text-xs"
                          onClick={() => handleSendWhatsApp(
                            `*Transferencia - KC Cobranzas*\n\nMonto: S/${parseFloat(paymentAmount || '0').toFixed(2)}\nCliente: ${selectedLoan?.client.name}\n\nDatos bancarios:\n${BANK_ACCOUNTS.map(a => `• ${a.bank}: ${a.account}`).join('\n')}\n\nAdjunto el comprobante de la transferencia.`
                          )}
                        >
                          <Send className="h-3.5 w-3.5 mr-1" />
                          Enviar datos por WhatsApp
                        </Button>
                      )}
                      <div>
                        <Label className="text-xs font-semibold text-teal-800">
                          Subir Comprobante
                        </Label>
                        <div className="mt-1.5 flex items-center gap-3">
                          <label className="flex items-center gap-2 px-3 py-2 rounded-lg border border-teal-200 bg-white cursor-pointer hover:bg-teal-50 text-xs text-teal-700">
                            <Upload className="h-3.5 w-3.5" />
                            {proofPreview ? 'Cambiar archivo' : 'Seleccionar imagen'}
                            <input
                              type="file"
                              accept="image/*"
                              onChange={handleProofFile}
                              className="hidden"
                            />
                          </label>
                          {proofFileBase64 && (
                            <button
                              className="text-xs text-red-500 hover:text-red-700"
                              onClick={() => { setProofFileBase64(''); setProofPreview(''); }}
                            >
                              Eliminar
                            </button>
                          )}
                        </div>
                        {proofPreview && (
                          <div className="mt-2">
                            <img
                              src={proofPreview}
                              alt="Comprobante"
                              className="w-full max-h-40 object-contain rounded-lg border border-teal-200 bg-white"
                            />
                          </div>
                        )}
                      </div>
                    </div>
                  )}

                  {/* Collector */}
                  <div>
                    <Label className="text-sm font-semibold text-slate-700">
                      Cobrador
                    </Label>
                    <Select value={paymentCollectorId} onValueChange={setPaymentCollectorId}>
                      <SelectTrigger className="mt-1.5 bg-white border-slate-200">
                        <SelectValue placeholder="Seleccionar cobrador (opcional)" />
                      </SelectTrigger>
                      <SelectContent>
                        {collectors.map((c) => (
                          <SelectItem key={c.id} value={c.id}>
                            {c.name || c.email}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  {/* Observation */}
                  <div>
                    <Label className="text-sm font-semibold text-slate-700">
                      Observación
                    </Label>
                    <Textarea
                      value={paymentObservation}
                      onChange={(e) => setPaymentObservation(e.target.value)}
                      placeholder="Observación opcional..."
                      className="mt-1.5 bg-white border-slate-200 resize-none"
                      rows={2}
                    />
                  </div>
                </>
              )}
            </div>
          </ScrollArea>

          {/* Footer */}
          {selectedLoanId && (
            <DialogFooter className="px-6 py-4 border-t border-slate-100 bg-slate-50/50">
              <div className="flex items-center justify-between w-full gap-4">
                <div>
                  <p className="text-xs text-slate-500">Total a cobrar</p>
                  <p className="text-lg font-bold text-emerald-600">
                    {formatCurrency(parseFloat(paymentAmount) || 0)}
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  <Button
                    variant="outline"
                    onClick={() => {
                      resetForm();
                      setRegisterOpen(false);
                    }}
                    disabled={registering}
                  >
                    Cancelar
                  </Button>
                  <Button
                    className="bg-gradient-to-r from-emerald-500 to-teal-500 hover:from-emerald-600 hover:to-teal-600 text-white border-0 shadow-lg shadow-emerald-500/20 min-w-32"
                    onClick={handleRegisterPayment}
                    disabled={registering || !paymentAmount || parseFloat(paymentAmount) <= 0}
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
                </div>
              </div>
            </DialogFooter>
          )}
        </DialogContent>
      </Dialog>

      {/* ============================================================ */}
      {/* LOAN COMPLETED CELEBRATION */}
      {/* ============================================================ */}
      <Dialog open={celebrationOpen} onOpenChange={setCelebrationOpen}>
        <DialogContent className="max-w-sm text-center p-8">
          <div className="flex flex-col items-center gap-4">
            <div className="w-20 h-20 rounded-full bg-gradient-to-br from-emerald-400 to-teal-500 flex items-center justify-center shadow-lg shadow-emerald-500/30">
              <PartyPopper className="h-10 w-10 text-white" />
            </div>
            <div>
              <h2 className="text-2xl font-bold text-emerald-600">
                PRÉSTAMO COMPLETADO
              </h2>
              <p className="text-slate-500 mt-2">
                El préstamo de <span className="font-semibold text-slate-700">{completedLoanName}</span> ha sido completamente pagado.
              </p>
            </div>
            <div className="w-full p-4 rounded-xl bg-emerald-50 border border-emerald-200">
              <p className="text-sm text-emerald-700">
                El capital + interés han sido retornados al fondo de capital.
              </p>
            </div>
            <Button
              className="w-full bg-gradient-to-r from-emerald-500 to-teal-500 hover:from-emerald-600 hover:to-teal-600 text-white border-0 shadow-lg shadow-emerald-500/20"
              onClick={() => setCelebrationOpen(false)}
            >
              Continuar
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* ============================================================ */}
      {/* DELETE PAYMENT CONFIRMATION */}
      {/* ============================================================ */}
      <Dialog open={!!deletePaymentId} onOpenChange={(open) => { if (!open) setDeletePaymentId(null); }}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-red-700">
              <AlertTriangle className="h-5 w-5" />
              Eliminar Pago
            </DialogTitle>
            <DialogDescription>
              ¿Está seguro que desea eliminar este pago permanentemente? El monto será descontado del progreso del préstamo.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter className="flex items-center gap-2 sm:gap-2">
            <Button variant="outline" onClick={() => setDeletePaymentId(null)} disabled={deletingPayment}>
              No, volver
            </Button>
            <Button variant="destructive" onClick={handleDeletePayment} disabled={deletingPayment}>
              {deletingPayment ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Trash2 className="h-4 w-4 mr-2" />}
              Sí, eliminar pago
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
