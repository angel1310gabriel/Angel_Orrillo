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
import PaymentReceipt, { ReceiptPayment } from '@/components/payment-receipt';

// ============================================================
// Types
// ============================================================

interface ScheduleEntry {
  id: string;
  loanId: string;
  installmentNumber: number;
  amount: number;
  dueDate: string;
  status: string;
}

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
  schedule?: ScheduleEntry[];
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
  { value: 'cash', label: 'Efectivo', icon: Banknote, color: 'text-emerald-600 dark:text-emerald-300', bg: 'bg-emerald-50 dark:bg-emerald-950/50 border-emerald-200 hover:bg-emerald-100 dark:hover:bg-emerald-900/70' },
  { value: 'plin', label: 'Plin', icon: Wifi, color: 'text-sky-600 dark:text-sky-300', bg: 'bg-sky-50 border-sky-200 hover:bg-sky-100' },
  { value: 'transfer', label: 'Transferencia', icon: ArrowRightLeft, color: 'text-teal-600 dark:text-teal-300', bg: 'bg-teal-50 border-teal-200 hover:bg-teal-100' },
] as const;

const PAYMENT_METHOD_LABELS: Record<string, string> = {
  cash: 'Efectivo',
  plin: 'Plin',
  transfer: 'Transferencia',
};

const getMethodIcon = (method: string) => {
  const found = PAYMENT_METHODS.find((m) => m.value === method);
  return found ? found.icon : Banknote;
};

const getMethodColor = (method: string) => {
  const found = PAYMENT_METHODS.find((m) => m.value === method);
  return found ? found.color : 'text-slate-600 dark:text-slate-400';
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
  const [selectedInstallment, setSelectedInstallment] = useState<string>('');
  const [paymentMethod, setPaymentMethod] = useState('cash');
  const [paymentCollectorId, setPaymentCollectorId] = useState('');
  const [paymentObservation, setPaymentObservation] = useState('');
  const [loanSearch, setLoanSearch] = useState('');

  // Payment method sub-forms
  const [cashReceived, setCashReceived] = useState('');
  const [proofFileBase64, setProofFileBase64] = useState('');
  const [proofPreview, setProofPreview] = useState('');
  const [qrDataUrl, setQrDataUrl] = useState('');
  const [paymentSettings, setPaymentSettings] = useState<Record<string, string>>({});

  // Loan completed celebration
  const [completedLoanName, setCompletedLoanName] = useState<string | null>(null);
  const [celebrationOpen, setCelebrationOpen] = useState(false);

  // Payment history pagination
  const [historyPage, setHistoryPage] = useState(1);
  const [historyTotalPages, setHistoryTotalPages] = useState(1);

  // Delete payment
  const [deletePaymentId, setDeletePaymentId] = useState<string | null>(null);
  const [deletingPayment, setDeletingPayment] = useState(false);

  // Payment receipt
  const [receiptOpen, setReceiptOpen] = useState(false);
  const [receiptPayment, setReceiptPayment] = useState<ReceiptPayment | null>(null);
  const [pendingCelebration, setPendingCelebration] = useState(false);

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

  const fetchPaymentSettings = useCallback(async () => {
    try {
      const res = await fetch('/api/payment-settings');
      if (res.ok) {
        const data = await res.json();
        setPaymentSettings(data);
      }
    } catch (e) {
      console.error('Error fetching payment settings:', e);
    }
  }, []);

  useEffect(() => {
    fetchPaymentSettings();
  }, [fetchPaymentSettings]);

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

  // Check for pending payment from loan detail (Cobrar button)
  useEffect(() => {
    const pendingLoanId = sessionStorage.getItem('pendingPaymentLoanId');
    if (pendingLoanId && activeLoans.length > 0) {
      const loan = activeLoans.find(l => l.id === pendingLoanId);
      if (loan) {
        handleOpenRegister(pendingLoanId);
        sessionStorage.removeItem('pendingPaymentLoanId');
      }
    }
  }, [activeLoans.length]);

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
    setSelectedInstallment('');
    setPaymentAmount('');
    setPaymentMethod('cash');
    setPaymentCollectorId(user?.id || '');
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
    setSelectedInstallment('');
    setPaymentAmount('');
    setCashReceived('');
    setProofFileBase64('');
    setProofPreview('');
    setQrDataUrl('');
  };

  const handleRegisterPayment = async () => {
    if (!selectedLoanId || !selectedInstallment || !paymentAmount) {
      toast({ title: 'Campos requeridos', description: 'Seleccione un préstamo y una cuota a cancelar', variant: 'destructive' });
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
        const paymentData = data.payment || data;

        setReceiptPayment({
          id: paymentData.id,
          amount: paymentData.amount || amount,
          method: paymentData.paymentMethod || paymentMethod,
          date: paymentData.paymentDate || paymentData.createdAt || new Date().toISOString(),
          clientName: paymentData.loan?.client?.name || selectedLoan?.client.name || '',
          clientDoc: paymentData.loan?.client?.documentNumber || selectedLoan?.client.documentNumber || '',
          loanAmount: paymentData.loan?.amount || selectedLoan?.amount || 0,
          collectorName: paymentData.collector?.name || user?.name || '—',
        });
        setReceiptOpen(true);

        if (data.loanCompleted) {
          setCompletedLoanName(data.loan?.client?.name || 'Cliente');
          setPendingCelebration(true);
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
    setSelectedInstallment('');
    setPaymentMethod('cash');
    setPaymentCollectorId(user?.id || '');
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
                className="border-slate-200 gap-2 bg-white dark:bg-slate-900"
              >
                <Calendar className="h-4 w-4 text-emerald-600 dark:text-emerald-300" />
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
              className="border-emerald-200 text-emerald-600 dark:text-emerald-300 hover:bg-emerald-50 dark:hover:bg-emerald-950/50"
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
            className="border-slate-200 bg-white dark:bg-slate-900"
            onClick={() => {
              fetchLoans();
              fetchTodayPayments();
            }}
          >
            <RefreshCw className="h-4 w-4" />
          </Button>
          {isToday && (
            <Button
              className="bg-emerald-600 hover:bg-emerald-700 text-white border-0 shadow-lg shadow-emerald-600/25 hover:shadow-emerald-600/40 transition-all"
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
        <Card className="border-0 shadow-md bg-white dark:bg-slate-900">
          <CardContent className="p-4">
            <div className="flex items-center justify-between mb-2">
              <span className="text-sm font-medium text-slate-700 dark:text-slate-300">
                Progreso de Cobranza {dateLabel}
              </span>
              <span className="text-sm font-semibold text-emerald-600 dark:text-emerald-300">
                {formatCurrency(totalCollected)} / {formatCurrency(totalExpected)}
              </span>
            </div>
            <Progress
              value={totalExpected > 0 ? (totalCollected / totalExpected) * 100 : 0}
              className="h-3 [&>div]:bg-gradient-to-r [&>div]:from-emerald-400 [&>div]:to-teal-500"
            />
            <div className="flex items-center justify-between mt-2 text-xs text-slate-500 dark:text-slate-400">
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
      <Card className="border-0 shadow-md bg-white dark:bg-slate-900">
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="text-lg flex items-center gap-2 text-slate-900 dark:text-slate-100">
                <DollarSign className="h-5 w-5 text-emerald-600 dark:text-emerald-300" />
                Cobranza del Día — {dateLabel}
              </CardTitle>
              <CardDescription className="text-slate-500 dark:text-slate-400">
                {activeLoans.length} préstamos ({paidCount} pagados, {pendingCount} pendientes)
              </CardDescription>
            </div>
            {isToday && (
              <Badge
                variant="outline"
                className={`text-xs ${
                  pendingCount === 0 && activeLoans.length > 0
                    ? 'bg-emerald-50 text-emerald-700 dark:text-emerald-300 border-emerald-200'
                    : 'bg-amber-50 text-amber-700 dark:text-amber-300 border-amber-200'
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
              <div                 className="w-16 h-16 rounded-full bg-slate-100 dark:bg-slate-800 flex items-center justify-center mx-auto mb-4">
                <CheckCircle2 className="h-8 w-8 text-slate-400 dark:text-slate-500" />
              </div>
              <h3 className="text-lg font-semibold text-slate-700 dark:text-slate-300 mb-2">Sin cobranzas pendientes</h3>
              <p className="text-slate-500 dark:text-slate-400">No hay préstamos activos para cobrar</p>
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
                            ? 'bg-emerald-50/50 dark:bg-emerald-950/30 border-emerald-200'
                            : isMora
                            ? 'bg-red-50/50 dark:bg-red-950/30 border-red-200'
                            : 'bg-amber-50/50 dark:bg-amber-950/30 border-amber-200 hover:border-amber-300'
                        }`}
                      >
                        {/* Status Icon */}
                        <div
                          className={`w-10 h-10 rounded-full flex items-center justify-center shrink-0 ${
                            isPaid
                              ? 'bg-emerald-100 dark:bg-emerald-900/50'
                              : isMora
                              ? 'bg-red-100 dark:bg-red-900/50'
                              : 'bg-amber-100 dark:bg-amber-900/50'
                          }`}
                        >
                          {isPaid ? (
                            <CheckCircle2 className="h-5 w-5 text-emerald-600 dark:text-emerald-300" />
                          ) : isMora ? (
                            <AlertTriangle className="h-5 w-5 text-red-600 dark:text-red-300" />
                          ) : (
                            <Clock className="h-5 w-5 text-amber-600 dark:text-amber-300" />
                          )}
                        </div>

                        {/* Client Info */}
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2">
                            <h4 className="font-semibold text-sm text-slate-900 dark:text-slate-100 truncate">
                              {loan.client.name}
                            </h4>
                            {isMora && (
                              <Badge variant="outline" className="bg-red-100 dark:bg-red-900/50 text-red-700 dark:text-red-300 border-red-200 text-xs shrink-0">
                                Mora
                              </Badge>
                            )}
                            {isPaid && (
                              <Badge variant="outline" className="bg-emerald-100 dark:bg-emerald-900/50 text-emerald-700 dark:text-emerald-300 border-emerald-200 text-xs shrink-0">
                                Pagado
                              </Badge>
                            )}
                          </div>
                          <div className="flex items-center gap-3 text-xs text-slate-500 dark:text-slate-400 mt-0.5">
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
                          <p className="font-bold text-sm text-slate-900 dark:text-slate-100">
                            {formatCurrency(loan.dailyPayment)}
                          </p>
                          {isPaid && totalPaidForLoan !== loan.dailyPayment && (
                            <p className="text-xs text-emerald-600 dark:text-emerald-300">
                              Cobrado: {formatCurrency(totalPaidForLoan)}
                            </p>
                          )}
                          {!isPaid && loan.remaining > 0 && (
                            <p className="text-xs text-slate-400 dark:text-slate-500">
                              Restante: {formatCurrency(loan.remaining)}
                            </p>
                          )}
                        </div>

                        {/* Quick Pay Button */}
                        {isToday && !isPaid && (
                          <Button
                            size="sm"
                            className="bg-emerald-600 hover:bg-emerald-700 text-white border-0 shadow-sm shrink-0"
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
      <Card className="border-0 shadow-md bg-white dark:bg-slate-900">
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="text-lg flex items-center gap-2 text-slate-900 dark:text-slate-100">
                <CreditCard className="h-5 w-5 text-teal-600 dark:text-teal-300" />
                Historial de Cobros — {dateLabel}
              </CardTitle>
              <CardDescription className="text-slate-500 dark:text-slate-400">
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
              <p className="text-slate-500 dark:text-slate-400 text-sm">No hay cobros registrados para {dateLabel}</p>
            </div>
          ) : (
            <>
              {/* Desktop Table */}
              <div className="hidden md:block">
                <Table>
                  <TableHeader>
                    <TableRow className="bg-emerald-50 dark:bg-emerald-950/50 text-emerald-700 dark:text-emerald-300">
                      <TableHead className="px-3 py-2">Hora</TableHead>
                      <TableHead className="px-3 py-2">Cliente</TableHead>
                      <TableHead className="px-3 py-2 text-right">Monto</TableHead>
                      <TableHead className="px-3 py-2">Método</TableHead>
                      <TableHead className="px-3 py-2">Cobrador</TableHead>
                      <TableHead className="px-3 py-2">Obs.</TableHead>
                      {isAdmin && <TableHead className="w-12 px-3 py-2"></TableHead>}
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {todayPayments.map((payment) => {
                      const MethodIcon = getMethodIcon(payment.paymentMethod);
                      const methodColor = getMethodColor(payment.paymentMethod);
                      return (
                        <TableRow key={payment.id} className="hover:bg-slate-50 dark:hover:bg-slate-800/30 transition-colors">
                          <TableCell className="text-sm text-slate-600 dark:text-slate-400 px-3 py-2">
                            {formatDateTime(payment.paymentDate)}
                          </TableCell>
                          <TableCell className="px-3 py-2">
                            <div>
                              <p className="font-medium text-sm text-slate-900 dark:text-slate-100">
                                {payment.loan?.client?.name || '—'}
                              </p>
                              <p className="text-xs text-slate-500 dark:text-slate-400">
                                {payment.loan?.client?.documentNumber || ''}
                              </p>
                            </div>
                          </TableCell>
                          <TableCell className="font-bold text-emerald-600 dark:text-emerald-300 px-3 py-2 text-right">
                            {formatCurrency(payment.amount)}
                          </TableCell>
                          <TableCell className="px-3 py-2">
                            <div className="flex items-center gap-1.5">
                              <MethodIcon className={`h-4 w-4 ${methodColor}`} />
                              <span className="text-sm">
                                {PAYMENT_METHOD_LABELS[payment.paymentMethod] || payment.paymentMethod}
                              </span>
                            </div>
                          </TableCell>
                          <TableCell className="text-sm text-slate-600 dark:text-slate-400 px-3 py-2">
                            {payment.collector?.name || '—'}
                          </TableCell>
                          <TableCell className="text-xs text-slate-500 dark:text-slate-400 max-w-32 truncate px-3 py-2">
                            {payment.observation || '—'}
                          </TableCell>
                          {isAdmin && (
                            <TableCell className="px-3 py-2">
                              <Button
                                variant="ghost"
                                size="icon"
                                className="h-7 w-7 text-slate-400 hover:text-red-600 dark:text-red-300 hover:bg-red-50 dark:hover:bg-red-950/50"
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
                      className="p-3 rounded-xl border border-slate-100 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-800/50"
                    >
                      <div className="flex items-center justify-between mb-2">
                        <p className="font-semibold text-sm text-slate-900 dark:text-slate-100">
                          {payment.loan?.client?.name || '—'}
                        </p>
                        <div className="flex items-center gap-2">
                          <p className="font-bold text-emerald-600 dark:text-emerald-300">
                            {formatCurrency(payment.amount)}
                          </p>
                          {isAdmin && (
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-7 w-7 text-slate-400 hover:text-red-600 dark:text-red-300 hover:bg-red-50 dark:hover:bg-red-950/50"
                              onClick={() => setDeletePaymentId(payment.id)}
                            >
                              <Trash2 className="h-3.5 w-3.5" />
                            </Button>
                          )}
                        </div>
                      </div>
                      <div className="flex items-center justify-between text-xs text-slate-500 dark:text-slate-400">
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
                  <span className="text-sm text-slate-600 dark:text-slate-400">
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
        <DialogContent className="max-w-lg max-h-[90dvh] flex flex-col p-0">
          <DialogHeader className="px-6 pt-6 pb-4 border-b border-slate-100 dark:border-slate-800 shrink-0">
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

          <div className="overflow-y-auto flex-1 px-6 min-h-0">
            <div className="py-4 space-y-5">
              {/* Loan Selection */}
              {!selectedLoanId ? (
                <div className="space-y-3">
                  <Label className="text-sm font-semibold text-slate-700 dark:text-slate-300">
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
                        <p className="text-sm text-slate-500 dark:text-slate-400 text-center py-4">
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
                                  ? 'border-emerald-200 bg-emerald-50/50 dark:bg-emerald-950/30 opacity-60'
                                  : isMora
                                  ? 'border-red-200 bg-red-50/50 dark:bg-red-950/30 hover:border-red-300 hover:bg-red-50 dark:hover:bg-red-950/50'
                                  : 'border-slate-200 hover:border-emerald-300 hover:bg-emerald-50/50 dark:hover:bg-emerald-950/30'
                              }`}
                              onClick={() => !isPaid && handleSelectLoan(loan.id)}
                              disabled={isPaid}
                            >
                              <div className="flex items-center justify-between">
                                <div>
                                  <div className="flex items-center gap-2">
                                    <p className="font-medium text-sm text-slate-900 dark:text-slate-100">
                                      {loan.client.name}
                                    </p>
                                    {isPaid && (
                                      <Badge variant="outline" className="bg-emerald-100 dark:bg-emerald-900/50 text-emerald-700 dark:text-emerald-300 border-emerald-200 text-xs">
                                        Pagado
                                      </Badge>
                                    )}
                                    {isMora && !isPaid && (
                                      <Badge variant="outline" className="bg-red-100 dark:bg-red-900/50 text-red-700 dark:text-red-300 border-red-200 text-xs">
                                        Mora
                                      </Badge>
                                    )}
                                  </div>
                                  <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                                    {getDocumentLabel(loan.client.documentType)}: {loan.client.documentNumber} | Tel: {loan.client.phone}
                                  </p>
                                </div>
                                <div className="text-right">
                                  <p className="font-bold text-sm text-emerald-600 dark:text-emerald-300">
                                    {formatCurrency(loan.dailyPayment)}
                                  </p>
                                  <p className="text-xs text-slate-400 dark:text-slate-500">
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
                  <Alert className="bg-emerald-50 dark:bg-emerald-950/50 border-emerald-200">
                    <CheckCircle2 className="h-4 w-4 text-emerald-600 dark:text-emerald-300" />
                    <AlertDescription className="text-emerald-800 dark:text-emerald-200">
                      <div className="flex items-center justify-between">
                        <div>
                          <span className="font-semibold">{selectedLoan?.client.name}</span>
                          <span className="text-emerald-600 dark:text-emerald-300 text-xs ml-2">
                            {getDocumentLabel(selectedLoan?.client.documentType || 'dni')}: {selectedLoan?.client.documentNumber}
                          </span>
                        </div>
                        <Button
                          variant="ghost"
                          size="sm"
                          className="h-6 w-6 p-0 text-emerald-600 dark:text-emerald-300 hover:bg-emerald-100 dark:hover:bg-emerald-900/50"
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
                    <div className="p-3 rounded-lg bg-slate-50 dark:bg-slate-800/50 text-center">
                      <p className="text-xs text-slate-500 dark:text-slate-400">Monto</p>
                      <p className="font-bold text-sm text-slate-900 dark:text-slate-100">
                        {formatCurrency(selectedLoan?.amount || 0)}
                      </p>
                    </div>
                    <div className="p-3 rounded-lg bg-slate-50 dark:bg-slate-800/50 text-center">
                      <p className="text-xs text-slate-500 dark:text-slate-400">Cuota Diaria</p>
                      <p className="font-bold text-sm text-emerald-600 dark:text-emerald-300">
                        {formatCurrency(selectedLoan?.dailyPayment || 0)}
                      </p>
                    </div>
                    <div className="p-3 rounded-lg bg-slate-50 dark:bg-slate-800/50 text-center">
                      <p className="text-xs text-slate-500 dark:text-slate-400">Restante</p>
                      <p className="font-bold text-sm text-amber-600 dark:text-amber-300">
                        {formatCurrency(selectedLoan?.remaining || 0)}
                      </p>
                    </div>
                  </div>

                  {/* Progress */}
                  <div>
                    <div className="flex items-center justify-between mb-1">
                      <span className="text-xs text-slate-500 dark:text-slate-400">Progreso del préstamo</span>
                      <span className="text-xs font-semibold text-emerald-600 dark:text-emerald-300">
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

                  {/* Installment Selection */}
                  <div>
                    <Label className="text-sm font-semibold text-slate-700 dark:text-slate-300 mb-2 block">
                      Seleccionar Cuota a Cancelar
                    </Label>
                    {(() => {
                      const pending = (selectedLoan?.schedule || []).filter(s => s.status === 'pending');
                      if (pending.length === 0) {
                        return (
                          <div className="text-sm text-slate-500 dark:text-slate-400 text-center py-4 bg-slate-50 dark:bg-slate-800/50 rounded-lg">
                            No hay cuotas pendientes
                          </div>
                        );
                      }
                      return (
                        <div className="space-y-1.5 max-h-56 overflow-y-auto pr-1">
                          {pending.map(s => {
                            const isSelected = selectedInstallment === s.id;
                            return (
                              <button
                                key={s.id}
                                type="button"
                                onClick={() => {
                                  setSelectedInstallment(s.id);
                                  setPaymentAmount(s.amount.toString());
                                }}
                                className={`w-full flex items-center justify-between p-3 rounded-lg border-2 transition-all text-left ${
                                  isSelected
                                    ? 'border-emerald-500 bg-emerald-50 dark:bg-emerald-950/50 ring-2 ring-emerald-500/20'
                                    : 'border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 hover:border-emerald-300 hover:bg-emerald-50/50'
                                }`}
                              >
                                <div className="flex items-center gap-3">
                                  <div className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold ${
                                    isSelected
                                      ? 'bg-emerald-500 text-white'
                                      : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400'
                                  }`}>
                                    {s.installmentNumber}
                                  </div>
                                  <div>
                                    <p className={`text-sm font-semibold ${isSelected ? 'text-emerald-700 dark:text-emerald-300' : 'text-slate-700 dark:text-slate-300'}`}>
                                      Cuota #{s.installmentNumber}
                                    </p>
                                    <p className="text-xs text-slate-500 dark:text-slate-400">
                                      {new Date(s.dueDate).toLocaleDateString('es-PE', { day: '2-digit', month: 'short' })}
                                    </p>
                                  </div>
                                </div>
                                <p className={`text-base font-bold ${isSelected ? 'text-emerald-700 dark:text-emerald-300' : 'text-slate-900 dark:text-slate-100'}`}>
                                  {formatCurrency(s.amount)}
                                </p>
                              </button>
                            );
                          })}
                        </div>
                      );
                    })()}
                    {selectedInstallment && paymentAmount && (
                      <div className="mt-3 flex items-center justify-between p-3 bg-emerald-50 dark:bg-emerald-950/30 rounded-lg border border-emerald-200 dark:border-emerald-800">
                        <span className="text-sm font-semibold text-emerald-700 dark:text-emerald-300">Total a cobrar</span>
                        <span className="text-lg font-bold text-emerald-700 dark:text-emerald-300">{formatCurrency(parseFloat(paymentAmount) || 0)}</span>
                      </div>
                    )}
                  </div>

                  {/* Payment Method */}
                  <div>
                    <Label className="text-sm font-semibold text-slate-700 dark:text-slate-300 mb-3 block">
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
                    <div className="space-y-3 p-4 rounded-xl bg-amber-50 dark:bg-amber-950/50 border border-amber-200">
                      <Label className="text-sm font-semibold text-amber-800 dark:text-amber-200">
                        Monto Recibido en Efectivo
                      </Label>
                      <div className="relative">
                        <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500 dark:text-slate-400 text-sm font-medium">
                          S/
                        </span>
                        <Input
                          type="number"
                          step="0.01"
                          min="0"
                          value={cashReceived}
                          onChange={(e) => setCashReceived(e.target.value)}
                          className="pl-9 bg-white dark:bg-slate-900 border-amber-200"
                          placeholder="0.00"
                        />
                      </div>
                      {vueltoAmount > 0 && (
                        <div className="flex items-center justify-between p-3 rounded-lg bg-white dark:bg-slate-900 border border-amber-200">
                          <span className="text-sm font-medium text-amber-700 dark:text-amber-300">Vuelto</span>
                          <span className="text-lg font-bold text-emerald-600 dark:text-emerald-300">
                            {formatCurrency(vueltoAmount)}
                          </span>
                        </div>
                      )}
                      {parseFloat(cashReceived || '0') > 0 && parseFloat(cashReceived) < parseFloat(paymentAmount) && (
                        <p className="text-xs text-amber-600 dark:text-amber-300">
                          El monto recibido es menor al cobro
                        </p>
                      )}
                      <div>
                        <Label className="text-xs font-semibold text-amber-800 dark:text-amber-200">
                          Subir Comprobante (opcional)
                        </Label>
                        <div className="mt-1.5 flex items-center gap-3">
                          <label className="flex items-center gap-2 px-3 py-2.5 rounded-lg border border-amber-200 bg-white dark:bg-slate-900 cursor-pointer hover:bg-amber-50 dark:hover:bg-amber-950/50 text-xs text-amber-700 dark:text-amber-300">
                            <Upload className="h-4 w-4" />
                            {proofPreview ? 'Cambiar foto' : 'Tomar foto'}
                            <input
                              type="file"
                              accept="image/*"
                              capture="environment"
                              onChange={handleProofFile}
                              className="hidden"
                            />
                          </label>
                          {proofFileBase64 && (
                            <button
                              className="text-xs text-red-500 hover:text-red-700 dark:text-red-300"
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
                              className="w-full max-h-40 object-contain rounded-lg border border-amber-200 bg-white dark:bg-slate-900"
                            />
                          </div>
                        )}
                      </div>
                    </div>
                  )}

                  {paymentMethod === 'plin' && (
                    <div className="space-y-4 p-4 rounded-xl bg-sky-50 dark:bg-sky-950/50 border border-sky-200">
                      {paymentSettings.payment_qr_plin && (
                        <div className="flex flex-col items-center gap-2">
                          <img
                            src={paymentSettings.payment_qr_plin}
                            alt="QR Plin"
                            className="w-48 h-48 object-contain rounded-xl bg-white dark:bg-slate-900 p-2 shadow-sm"
                          />
                          <p className="text-xs text-sky-600 dark:text-sky-300 font-medium">
                            Plin - S/{parseFloat(paymentAmount || '0').toFixed(2)}
                          </p>
                          {paymentSettings.payment_phone_plin && (
                            <p className="text-xs text-slate-500 dark:text-slate-400">
                              Número: <a href={`tel:${paymentSettings.payment_phone_plin}`} className="font-medium text-sky-600 dark:text-sky-300 hover:underline">{paymentSettings.payment_phone_plin}</a> a nombre de <strong>Keysy Otero Cañola</strong>
                            </p>
                          )}
                        </div>
                      )}
                      <div className="flex gap-2">
                        {selectedLoan?.client.phone && (
                          <Button
                            variant="outline"
                            size="sm"
                            className="flex-1 border-sky-200 text-sky-600 dark:text-sky-300 hover:bg-sky-100 dark:hover:bg-sky-900/50 text-xs"
                            onClick={() => handleSendWhatsApp(
                              `*Plin - KC Cobranzas*\n\nMonto: S/${parseFloat(paymentAmount || '0').toFixed(2)}\nCliente: ${selectedLoan?.client.name}\nNúmero: ${paymentSettings.payment_phone_plin || '951959763'}\nA nombre de: Keysy Otero Cañola\n\nAdjunto el comprobante del pago.`
                            )}
                          >
                            <Send className="h-3.5 w-3.5 mr-1" />
                            Enviar por WhatsApp
                          </Button>
                        )}
                      </div>
                      <div>
                        <Label className="text-xs font-semibold text-sky-800 dark:text-sky-200">
                          Subir Comprobante
                        </Label>
                        <div className="mt-1.5 flex items-center gap-3">
                          <label className="flex items-center gap-2 px-3 py-2.5 rounded-lg border border-sky-200 bg-white dark:bg-slate-900 cursor-pointer hover:bg-sky-50 dark:hover:bg-sky-950/50 text-xs text-sky-700 dark:text-sky-300">
                            <Upload className="h-4 w-4" />
                            {proofPreview ? 'Cambiar foto' : 'Tomar foto'}
                            <input
                              type="file"
                              accept="image/*"
                              capture="environment"
                              onChange={handleProofFile}
                              className="hidden"
                            />
                          </label>
                          {proofFileBase64 && (
                            <button
                              className="text-xs text-red-500 hover:text-red-700 dark:text-red-300"
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
                              className="w-full max-h-40 object-contain rounded-lg border border-sky-200 bg-white dark:bg-slate-900"
                            />
                          </div>
                        )}
                      </div>
                    </div>
                  )}

                  {paymentMethod === 'transfer' && (
                    <div className="space-y-4 p-4 rounded-xl bg-teal-50 dark:bg-teal-950/50 border border-teal-200">
                      <Label className="text-sm font-semibold text-teal-800 dark:text-teal-200">
                        Transferencia Bancaria
                      </Label>
                      <div className="space-y-2">
                        {paymentSettings.payment_bank_name && (
                          <div className="p-2.5 rounded-lg bg-white dark:bg-slate-900 border border-teal-200">
                            <p className="text-sm font-semibold text-slate-800 dark:text-slate-200">{paymentSettings.payment_bank_name}</p>
                            {paymentSettings.payment_bank_cuenta && (
                              <p className="text-xs text-slate-500 dark:text-slate-400 font-mono">Cuenta Ahorro: <span className="select-all cursor-pointer hover:text-teal-600">{paymentSettings.payment_bank_cuenta}</span></p>
                            )}
                            {paymentSettings.payment_bank_cci && (
                              <p className="text-xs text-slate-500 dark:text-slate-400 font-mono">CCI: <span className="select-all cursor-pointer hover:text-teal-600">{paymentSettings.payment_bank_cci}</span></p>
                            )}
                            <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">A nombre de <strong>Keysy Otero Cañola</strong></p>
                          </div>
                        )}
                      </div>
                      {selectedLoan?.client.phone && (
                        <Button
                          variant="outline"
                          size="sm"
                          className="w-full border-teal-200 text-teal-600 dark:text-teal-300 hover:bg-teal-100 dark:hover:bg-teal-900/50 text-xs"
                          onClick={() => handleSendWhatsApp(
                            `*Transferencia Bancaria - KC Cobranzas*\n\nMonto: S/${parseFloat(paymentAmount || '0').toFixed(2)}\nCliente: ${selectedLoan?.client.name}\n\nDatos bancarios:\n• Banco: ${paymentSettings.payment_bank_name || 'Interbank'}\n• CCI: ${paymentSettings.payment_bank_cci || ''}\n• Cuenta Ahorro: ${paymentSettings.payment_bank_cuenta || ''}\nA nombre de: Keysy Otero Cañola\n\nAdjunto el comprobante de la transferencia.`
                          )}
                        >
                          <Send className="h-3.5 w-3.5 mr-1" />
                          Enviar datos por WhatsApp
                        </Button>
                      )}
                      <div>
                        <Label className="text-xs font-semibold text-teal-800 dark:text-teal-200">
                          Subir Comprobante
                        </Label>
                        <div className="mt-1.5 flex items-center gap-3">
                          <label className="flex items-center gap-2 px-3 py-2.5 rounded-lg border border-teal-200 bg-white dark:bg-slate-900 cursor-pointer hover:bg-teal-50 dark:hover:bg-teal-950/50 text-xs text-teal-700 dark:text-teal-300">
                            <Upload className="h-4 w-4" />
                            {proofPreview ? 'Cambiar foto' : 'Tomar foto'}
                            <input
                              type="file"
                              accept="image/*"
                              capture="environment"
                              onChange={handleProofFile}
                              className="hidden"
                            />
                          </label>
                          {proofFileBase64 && (
                            <button
                              className="text-xs text-red-500 hover:text-red-700 dark:text-red-300"
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
                              className="w-full max-h-40 object-contain rounded-lg border border-teal-200 bg-white dark:bg-slate-900"
                            />
                          </div>
                        )}
                      </div>
                    </div>
                  )}

                  {/* Collector */}
                  <div>
                    <Label className="text-sm font-semibold text-slate-700 dark:text-slate-300">
                      Cobrador
                    </Label>
                    <div className="mt-1.5 p-2.5 rounded-lg bg-slate-50 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-700 text-sm font-medium text-slate-700 dark:text-slate-300 flex items-center gap-2">
                      <User className="h-4 w-4 text-slate-400" />
                      {user?.name || 'Cobrador'}
                    </div>
                  </div>

                  {/* Observation */}
                  <div>
                    <Label className="text-sm font-semibold text-slate-700 dark:text-slate-300">
                      Observación
                    </Label>
                    <Textarea
                      value={paymentObservation}
                      onChange={(e) => setPaymentObservation(e.target.value)}
                      placeholder="Observación opcional..."
                      className="mt-1.5 bg-white dark:bg-slate-900 border-slate-200 resize-none"
                      rows={2}
                    />
                  </div>
                </>
              )}
            </div>
          </div>

          {/* Footer */}
          {selectedLoanId && (
            <DialogFooter className="px-6 py-4 border-t border-slate-100 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-800/50 shrink-0">
              <div className="flex items-center justify-between w-full gap-4">
                <div>
                  <p className="text-xs text-slate-500 dark:text-slate-400">Total a cobrar</p>
                  <p className="text-lg font-bold text-emerald-600 dark:text-emerald-300">
                    {formatCurrency(parseFloat(paymentAmount) || 0)}
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  <Button
                    variant="outline"
                    className="border-emerald-200 dark:border-emerald-800 text-emerald-700 dark:text-emerald-300 hover:bg-emerald-50 dark:hover:bg-emerald-950"
                    onClick={() => {
                      resetForm();
                      setRegisterOpen(false);
                    }}
                    disabled={registering}
                  >
                    Cancelar
                  </Button>
                  <Button
                    className="bg-emerald-600 hover:bg-emerald-700 text-white border-0 shadow-lg shadow-emerald-600/25 hover:shadow-emerald-600/40 transition-all min-w-32"
                    onClick={handleRegisterPayment}
                    disabled={registering || !selectedInstallment || !paymentAmount || parseFloat(paymentAmount) <= 0}
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
              <h2 className="text-2xl font-bold text-emerald-600 dark:text-emerald-300">
                PRÉSTAMO COMPLETADO
              </h2>
              <p className="text-slate-500 dark:text-slate-400 mt-2">
                El préstamo de <span className="font-semibold text-slate-700 dark:text-slate-300">{completedLoanName}</span> ha sido completamente pagado.
              </p>
            </div>
            <div className="w-full p-4 rounded-xl bg-emerald-50 dark:bg-emerald-950/50 border border-emerald-200">
              <p className="text-sm text-emerald-700 dark:text-emerald-300">
                El capital + interés han sido retornados al fondo de capital.
              </p>
            </div>
            <Button
              className="w-full bg-emerald-600 hover:bg-emerald-700 text-white border-0 shadow-lg shadow-emerald-600/25 hover:shadow-emerald-600/40 transition-all"
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
            <DialogTitle className="flex items-center gap-2 text-red-700 dark:text-red-300">
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

      {/* ============================================================ */}
      {/* PAYMENT RECEIPT */}
      {/* ============================================================ */}
      <PaymentReceipt
        open={receiptOpen}
        onOpenChange={(open) => {
          setReceiptOpen(open);
          if (!open && pendingCelebration) {
            setCelebrationOpen(true);
            setPendingCelebration(false);
          }
        }}
        payment={receiptPayment}
      />
    </div>
  );
}
