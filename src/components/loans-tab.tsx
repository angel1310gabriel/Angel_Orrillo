'use client';

import React, { useState, useEffect, useCallback } from 'react';
import {
  Plus,
  Search,
  Filter,
  RefreshCw,
  Eye,
  XCircle,
  Trash2,
  ChevronLeft,
  ChevronRight,
  Loader2,
  DollarSign,
  User,
  Phone,
  MapPin,
  Calendar,
  FileText,
  TrendingUp,
  AlertTriangle,
  CheckCircle2,
  Clock,
  ArrowRight,
  ArrowLeft,
  UserPlus,
  Calculator,
  Info,
  CreditCard,
  Users,
  Bell,
  Upload,
  Banknote,
  Wifi,
  ArrowRightLeft,
  Link2,
  Send,
  Mail,
  Download,
  Save,
  MoreHorizontal,
  Star,
  Trash,
} from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Separator } from '@/components/ui/separator';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription } from '@/components/ui/sheet';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Skeleton } from '@/components/ui/skeleton';
import { Alert, AlertDescription } from '@/components/ui/alert';
import BulkActions, { useBulkSelection } from '@/components/bulk-actions';
import FilterManager from '@/components/filter-manager';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { useToast } from '@/hooks/use-toast';
import { useAuth } from '@/hooks/use-auth';
import LoanChargeOffDialog from './loan-charge-off-dialog';
import PaymentLinksPanel from './payment-links-panel';
import PaymentScheduleView from './payment-schedule-view';

// ============================================================
// Types
// ============================================================

interface Client {
  id: string;
  name: string;
  documentNumber: string;
  documentType: string;
  phone: string;
  address?: string | null;
  zoneId?: string | null;
  creditScore: number | null;
  zone?: { id: string; name: string } | null;
  stats?: {
    totalLoans: number;
    activeLoans: number;
    totalLoaned: number;
    totalPaid: number;
    hasMora: boolean;
  };
}

interface Collector {
  id: string;
  name: string | null;
  email: string;
  phone?: string | null;
  role: string;
  isActive: boolean;
}

interface Zone {
  id: string;
  name: string;
  stats?: {
    totalClients: number;
    totalLoans: number;
    activeLoans: number;
  };
}

interface Payment {
  id: string;
  amount: number;
  paymentMethod: string;
  status: string;
  observation?: string | null;
  paymentDate: string;
  collector?: { id: string; name: string | null } | null;
}

interface PaymentScheduleItem {
  id: string;
  installmentNumber: number;
  amount: number;
  dueDate: string;
  status: string;
}

interface LateFeeItem {
  id: string;
  daysLate: number;
  amount: number;
  ratePerDay: number;
  status: string;
  generatedAt: string;
}

interface Loan {
  id: string;
  clientId: string;
  collectorId: string | null;
  zoneId: string | null;
  amount: number;
  totalAmount: number;
  interest: number;
  days: number;
  dailyPayment: number;
  paymentFrequency: string;
  numCuotas: number;
  amountPaid: number;
  startDate: string | null;
  endDate: string | null;
  status: string;
  notes: string | null;
  creditApproved: boolean;
  signature: string | null;
  restDays: string;
  cancellationReason: string | null;
  cancelledBy: string | null;
  cancelledAt: string | null;
  completedAt: string | null;
  nextPaymentDate: string | null;
  chargedOff: boolean;
  chargedOffAt: string | null;
  chargedOffBy: string | null;
  recoveryCollectorId: string | null;
  createdBy: string | null;
  createdAt: string;
  progressPercent: number;
  remaining: number;
  daysElapsed: number;
  daysRemaining: number | null;
  isOverdue: boolean;
  pendingLateFees: number;
  client: { id: string; name: string; documentNumber: string; documentType: string; phone: string; creditScore: number | null };
  collector: { id: string; name: string | null } | null;
  zone: { id: string; name: string } | null;
  payments: Payment[];
  lateFees: LateFeeItem[];
  schedule: PaymentScheduleItem[];
}

interface LoansTabProps {
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
  return date.toLocaleDateString('es-PE', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit', timeZone: 'America/Lima' });
};

const PAYMENT_METHODS = [
  { value: 'cash', label: 'Efectivo', icon: Banknote, color: 'text-emerald-600 dark:text-emerald-300', bg: 'bg-emerald-50 dark:bg-emerald-950/50 border-emerald-200 hover:bg-emerald-100 dark:hover:bg-emerald-900/70' },
  { value: 'plin', label: 'Plin', icon: Wifi, color: 'text-sky-600 dark:text-sky-300', bg: 'bg-sky-50 dark:bg-sky-950/50 border-sky-200 dark:border-sky-800 hover:bg-sky-100 dark:hover:bg-sky-900/70' },
  { value: 'transfer', label: 'Transferencia', icon: ArrowRightLeft, color: 'text-teal-600 dark:text-teal-300', bg: 'bg-teal-50 dark:bg-teal-950/50 border-teal-200 dark:border-teal-800 hover:bg-teal-100 dark:hover:bg-teal-900/70' },
] as const;

const getStatusBadge = (status: string) => {
  switch (status) {
    case 'active':
      return { className: 'bg-emerald-100 dark:bg-emerald-900/50 text-emerald-800 dark:text-emerald-200 border-emerald-200 dark:border-emerald-800', label: 'Activo', icon: <TrendingUp className="h-3 w-3" /> };
    case 'mora':
      return { className: 'bg-red-100 dark:bg-red-900/50 text-red-800 dark:text-red-200 border-red-200 dark:border-red-800', label: 'Mora', icon: <AlertTriangle className="h-3 w-3" /> };
    case 'paid':
      return { className: 'bg-teal-100 dark:bg-teal-900/50 text-teal-800 dark:text-teal-200 border-teal-200 dark:border-teal-800', label: 'Pagado', icon: <CheckCircle2 className="h-3 w-3" /> };
    case 'completed':
      return { className: 'bg-teal-100 dark:bg-teal-900/50 text-teal-800 dark:text-teal-200 border-teal-200 dark:border-teal-800', label: 'Completado', icon: <CheckCircle2 className="h-3 w-3" /> };
    case 'cancelled':
      return { className: 'bg-background/70 dark:bg-[#05060b]/70 text-foreground/70 dark:text-muted-foreground border-input dark:border-emerald-500/5', label: 'Cancelado', icon: <XCircle className="h-3 w-3" /> };
    case 'refinanced':
      return { className: 'bg-amber-100 dark:bg-amber-900/50 text-amber-800 dark:text-amber-200 border-amber-200 dark:border-amber-800', label: 'Refinanciado', icon: <RefreshCw className="h-3 w-3" /> };
    default:
      return { className: 'bg-background/70 dark:bg-[#05060b]/70 text-foreground/70 dark:text-muted-foreground border-input dark:border-emerald-500/5', label: status, icon: <Info className="h-3 w-3" /> };
  }
};

const getProgressColor = (percent: number, status: string) => {
  if (status === 'mora') return '[&>div]:bg-red-500';
  if (status === 'cancelled') return '[&>div]:bg-slate-400';
  if (percent >= 75) return '[&>div]:bg-emerald-500';
  if (percent >= 50) return '[&>div]:bg-teal-500';
  if (percent >= 25) return '[&>div]:bg-amber-500';
  return '[&>div]:bg-orange-500';
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

const PAYMENT_METHOD_LABELS: Record<string, string> = {
  cash: 'Efectivo',
  yape: 'Yape',
  plin: 'Plin',
  transfer: 'Transferencia',
};

// ============================================================
// Main Component
// ============================================================

export default function LoansTab({ refreshTrigger }: LoansTabProps) {
  const { toast } = useToast();
  const { user } = useAuth();
  const isAdmin = user?.role === 'admin';

  // Loan list state
  const [loans, setLoans] = useState<Loan[]>([]);
  const [loading, setLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [total, setTotal] = useState(0);
  const [capital, setCapital] = useState(0);

  // Bulk selection
  const {
    selectedIds,
    setSelectedIds,
    toggle,
    toggleAll,
    clear,
    isSelected,
    isAllSelected,
    isIndeterminate,
    count,
  } = useBulkSelection(loans);

  // Create loan dialog state
  const [createOpen, setCreateOpen] = useState(false);
  const [createStep, setCreateStep] = useState(1);
  const [creating, setCreating] = useState(false);

  // Step 1 - Client selection
  const [clients, setClients] = useState<Client[]>([]);
  const [clientSearch, setClientSearch] = useState('');
  const [selectedClientId, setSelectedClientId] = useState('');
  const [showNewClient, setShowNewClient] = useState(false);
  const [newClient, setNewClient] = useState({ name: '', documentNumber: '', documentType: 'dni', phone: '', address: '', zoneId: '' });
  const [creatingClient, setCreatingClient] = useState(false);

  // Step 2 - Loan parameters
  const [loanAmount, setLoanAmount] = useState('');
  const [interestRate, setInterestRate] = useState('');
  const [loanDays, setLoanDays] = useState('24');
  const [paymentFrequency, setPaymentFrequency] = useState('daily');
  const [restDays, setRestDays] = useState<number[]>([]);
  const DAYS = ['Dom', 'Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb'];

  // Auto-set interest when loanDays changes
  const handleLoanDaysChange = (val: string) => {
    setLoanDays(val);
    if (val === '24') setInterestRate('20');
    else if (val === '36') setInterestRate('32.10');
  };

  // Step 3 - Details
  const [collectorId, setCollectorId] = useState('');
  const [zoneId, setZoneId] = useState('');
  const [loanNotes, setLoanNotes] = useState('');
  const [startDate, setStartDate] = useState('');

  // Reference data
  const [collectors, setCollectors] = useState<Collector[]>([]);
  const [zones, setZones] = useState<Zone[]>([]);

  // Detail dialog state
  const [detailLoan, setDetailLoan] = useState<Loan | null>(null);
  const [detailOpen, setDetailOpen] = useState(false);

  // Cancel confirmation
  const [cancelLoanId, setCancelLoanId] = useState<string | null>(null);
  const [cancelReason, setCancelReason] = useState('');
  const [cancelling, setCancelling] = useState(false);

  // Delete confirmation
  const [deleteLoanId, setDeleteLoanId] = useState<string | null>(null);
  const [deleting, setDeleting] = useState(false);

  // Payment dialog state
  const [payOpen, setPayOpen] = useState(false);
  const [payRegistering, setPayRegistering] = useState(false);
  const [payAmount, setPayAmount] = useState('');
  const [paySelectedInstallments, setPaySelectedInstallments] = useState<string[]>([]);
  const [payMethod, setPayMethod] = useState('cash');
  const [payObservation, setPayObservation] = useState('');
  const [payProofFileBase64, setPayProofFileBase64] = useState('');
  const [payProofPreview, setPayProofPreview] = useState('');
  const [payCashReceived, setPayCashReceived] = useState('');
  const [payQrDataUrl, setPayQrDataUrl] = useState('');
  const [paySettings, setPaySettings] = useState<Record<string, string>>({});

  // New integration states
  const [chargeOffOpen, setChargeOffOpen] = useState(false);
  const [scheduleOpen, setScheduleOpen] = useState(false);
  const [linksOpen, setLinksOpen] = useState(false);
  const [selectedLoanId, setSelectedLoanId] = useState<string | null>(null);
  const [refinanceOpen, setRefinanceOpen] = useState(false);
  const [refinanceNewAmount, setRefinanceNewAmount] = useState('');
  const [refinanceNewDays, setRefinanceNewDays] = useState('');
  const [refinanceReason, setRefinanceReason] = useState('');
  const [refinancing, setRefinancing] = useState(false);

  // ============================================================
  // Data Fetching
  // ============================================================

  const fetchLoans = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams({
        page: page.toString(),
        limit: '20',
      });
      if (statusFilter !== 'all') params.set('status', statusFilter);
      if (zoneId) params.set('zoneId', zoneId);

      const res = await fetch(`/api/loans?${params}`);
      if (res.ok) {
        const data = await res.json();
        let filteredLoans = data.loans || [];
        // Client-side search filter
        if (searchQuery.trim()) {
          const q = searchQuery.toLowerCase();
          filteredLoans = filteredLoans.filter(
            (l: Loan) =>
              l.client?.name?.toLowerCase().includes(q) ||
              l.client?.documentNumber?.includes(q) ||
              l.client?.phone?.includes(q) ||
              l.id?.includes(q)
          );
        }
        setLoans(filteredLoans);
        setTotalPages(data.pagination?.totalPages || 1);
        setTotal(data.pagination?.total || 0);
      }
    } catch (error) {
      console.error('Error fetching loans:', error);
      toast({ title: 'Error', description: 'No se pudieron cargar los préstamos', variant: 'destructive' });
    } finally {
      setLoading(false);
    }
  }, [page, statusFilter, searchQuery, toast]);

  const fetchCapital = useCallback(async () => {
    try {
      const res = await fetch('/api/capital');
      if (res.ok) {
        const data = await res.json();
        setCapital(data?.currentCapital || 0);
      }
    } catch {
      // silent fail
    }
  }, []);

  const fetchClients = useCallback(async () => {
    try {
      const params = new URLSearchParams({ limit: '50' });
      if (clientSearch) params.set('search', clientSearch);
      const res = await fetch(`/api/clients?${params}`);
      if (res.ok) {
        const data = await res.json();
        setClients(data?.clients || []);
      }
    } catch {
      // silent fail
    }
  }, [clientSearch]);

  const fetchReferenceData = useCallback(async () => {
    try {
      const [collectorsRes, zonesRes] = await Promise.all([
        fetch('/api/collectors'),
        fetch(`/api/zones${isAdmin ? '' : `?collectorId=${user?.id}`}`),
      ]);
      if (collectorsRes.ok) {
        const data = await collectorsRes.json();
        setCollectors(data?.collectors || []);
      }
      if (zonesRes.ok) {
        const data = await zonesRes.json();
        const zoneList = data?.zones || [];
        setZones(zoneList);
        if (!isAdmin && zoneList.length === 1) {
          setZoneId(zoneList[0].id);
        }
      }
    } catch {
      // silent fail
    }
  }, [isAdmin, user?.id]);

  useEffect(() => {
    fetchLoans();
  }, [fetchLoans]);

  useEffect(() => {
    fetchCapital();
  }, [fetchCapital]);

  useEffect(() => {
    if (refreshTrigger) fetchLoans();
  }, [refreshTrigger, fetchLoans]);

  // Auto-filter by collector's zone for non-admin users
  useEffect(() => {
    if (isAdmin || !user) return;
    const autoFilterZones = async () => {
      try {
        const r = await fetch(`/api/collectors`);
        if (r.ok) {
          const d = await r.json();
          const cs = d?.collectors || [];
          const me = cs.find((c: any) => c.id === user.id);
          if (me?.zoneIds?.length && me.zoneIds[0] !== zoneId) setZoneId(me.zoneIds[0]);
        }
      } catch {}
    };
    autoFilterZones();
  }, [isAdmin, user]);

  // Auto-fetch clients when search changes (debounced)
  useEffect(() => {
    if (!createOpen) return;
    const timer = setTimeout(() => {
      fetchClients();
    }, 300);
    return () => clearTimeout(timer);
  }, [clientSearch, createOpen, fetchClients]);

  // ============================================================
  // Loan Creation Logic
  // ============================================================

  const calcInterest = loanAmount && interestRate ? parseFloat(loanAmount) * parseFloat(interestRate) / 100 : 0;
  const calcTotalAmount = loanAmount ? parseFloat(loanAmount) + calcInterest : 0;
  const calcDailyRate = calcTotalAmount && loanDays ? calcTotalAmount / parseInt(loanDays) : 0;

  const totalDays = parseInt(loanDays) || 0;
  const fullWeeks = Math.floor(totalDays / 7);
  const remainingDays = totalDays % 7;

  // Weekly with rest day: equal weekly payments over ceil(days/7) weeks
  const weeklyHasRest = paymentFrequency === 'weekly' && restDays.length > 0;
  const weeklyWeeks = Math.ceil(totalDays / 7);
  const calcNumCuotas = weeklyHasRest ? weeklyWeeks : (paymentFrequency === 'weekly' ? fullWeeks + remainingDays : totalDays);
  const calcPaymentAmount = calcDailyRate;
  const calcWeeklyPayment = weeklyHasRest ? calcTotalAmount / weeklyWeeks : calcDailyRate * 7;

  const calcSchedule = (() => {
    if (!totalDays || !calcDailyRate || !startDate) return [];
    const restSet = new Set(restDays);
    const schedule: { date: string; amount: number; num: number; type: string }[] = [];
    let num = 0;

    const nextBusinessDay = (d: Date) => {
      const d2 = new Date(d);
      while (restSet.has(d2.getDay())) d2.setDate(d2.getDate() + 1);
      return d2;
    };

    // First payment: weekly = +7 days, daily = +1 day
    let cursor = new Date(startDate);
    cursor.setDate(cursor.getDate() + (paymentFrequency === 'weekly' ? 7 : 1));
    cursor = nextBusinessDay(cursor);

    if (paymentFrequency === 'weekly') {
      if (weeklyHasRest) {
        for (let w = 0; w < weeklyWeeks; w++) {
          num++;
          schedule.push({
            date: cursor.toLocaleDateString('es-PE', { day: '2-digit', month: 'short' }),
            amount: calcWeeklyPayment,
            num,
            type: 'Semana',
          });
          cursor.setDate(cursor.getDate() + 7);
          cursor = nextBusinessDay(cursor);
        }
      } else {
        for (let w = 0; w < fullWeeks; w++) {
          num++;
          schedule.push({
            date: cursor.toLocaleDateString('es-PE', { day: '2-digit', month: 'short' }),
            amount: calcDailyRate * 7,
            num,
            type: 'Semana',
          });
          cursor.setDate(cursor.getDate() + 7);
          cursor = nextBusinessDay(cursor);
        }
        for (let d = 0; d < remainingDays; d++) {
          num++;
          schedule.push({
            date: cursor.toLocaleDateString('es-PE', { day: '2-digit', month: 'short' }),
            amount: calcDailyRate,
            num,
            type: 'Día',
          });
          cursor.setDate(cursor.getDate() + 1);
          cursor = nextBusinessDay(cursor);
        }
      }
    } else {
      for (let i = 0; i < totalDays; i++) {
        num++;
        schedule.push({
          date: cursor.toLocaleDateString('es-PE', { day: '2-digit', month: 'short' }),
          amount: calcDailyRate,
          num,
          type: 'Día',
        });
        cursor.setDate(cursor.getDate() + 1);
        cursor = nextBusinessDay(cursor);
      }
    }
    return schedule;
  })();

  const selectedClient = clients.find((c) => c.id === selectedClientId);
  const selectedClientHasActiveLoan = selectedClient?.stats?.activeLoans ? selectedClient.stats.activeLoans > 0 : false;

  const canProceedStep1 = selectedClientId && !selectedClientHasActiveLoan;
  const canProceedStep2 = parseFloat(loanAmount) > 0 && parseFloat(interestRate) >= 0 && parseInt(loanDays) > 0;
  const canProceedStep3 = true; // collector and zone are optional

  const handleCreateClient = async () => {
    if (!newClient.name || !newClient.documentNumber || !newClient.phone) {
      toast({ title: 'Campos requeridos', description: 'Nombre, documento y teléfono son obligatorios', variant: 'destructive' });
      return;
    }
    setCreatingClient(true);
    if (!isAdmin && zoneId) {
      newClient.zoneId = zoneId;
    }
    try {
      const res = await fetch('/api/clients', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...newClient,
          creditScore: 50,
          documentType: newClient.documentType || 'dni',
        }),
      });
      if (res.ok) {
        const client = await res.json();
        setSelectedClientId(client.id);
        await fetchClients();
        setShowNewClient(false);
        toast({ title: 'Cliente creado', description: `${client.name} registrado exitosamente` });
      } else {
        const data = await res.json();
        toast({ title: 'Error', description: data.error || 'No se pudo crear el cliente', variant: 'destructive' });
      }
    } catch {
      toast({ title: 'Error', description: 'Error de conexión', variant: 'destructive' });
    } finally {
      setCreatingClient(false);
    }
  };

  const handleCreateLoan = async () => {
    setCreating(true);
    try {
      const body: Record<string, unknown> = {
        clientId: selectedClientId,
        amount: parseFloat(loanAmount),
        interestRate: parseFloat(interestRate),
        days: parseInt(loanDays),
        numCuotas: calcNumCuotas,
        dailyPayment: parseFloat((paymentFrequency === 'weekly' ? calcWeeklyPayment : calcPaymentAmount).toFixed(2)),
        paymentFrequency,
        restDays: restDays.join(','),
        notes: loanNotes || null,
        guarantors: [],
      };
      if (collectorId) body.collectorId = collectorId;
      if (zoneId) body.zoneId = zoneId;
      if (startDate) body.startDate = startDate;

      const res = await fetch('/api/loans', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });

      if (res.ok) {
        toast({
          title: 'Préstamo creado',
          description: `Préstamo de ${formatCurrency(parseFloat(loanAmount))} para ${selectedClient?.name} registrado exitosamente`,
        });
        resetCreateForm();
        setCreateOpen(false);
        fetchLoans();
        fetchCapital();
      } else {
        const data = await res.json();
        toast({ title: 'Error', description: data.error || 'No se pudo crear el préstamo', variant: 'destructive' });
      }
    } catch {
      toast({ title: 'Error', description: 'Error de conexión', variant: 'destructive' });
    } finally {
      setCreating(false);
    }
  };

  const resetCreateForm = () => {
    setCreateStep(1);
    setSelectedClientId('');
    setClientSearch('');
    setShowNewClient(false);
    setNewClient({ name: '', documentNumber: '', documentType: 'dni', phone: '', address: '', zoneId: '' });
    setLoanAmount('');
    setLoanDays('24');
    setInterestRate('20');
    setPaymentFrequency('daily');
    setRestDays([]);
    setCollectorId(isAdmin ? '' : (user?.id || ''));
    setZoneId('');
    setLoanNotes('');
    setStartDate(new Date().toISOString().split('T')[0]);
  };

  const handleRecordar = async (loan: Loan) => {
    try {
      if (!loan.client.phone) return;
      const phone = loan.client.phone.replace(/[^0-9]/g, '');
      const fullPhone = phone.startsWith('51') ? phone : `51${phone}`;

      const res = await fetch('/api/payment-settings');
      const settings = res.ok ? await res.json() : {};
      const hour = new Date().getHours();
      let greeting = 'Buenos días';
      if (hour >= 12 && hour < 19) greeting = 'Buenas tardes';
      else if (hour >= 19) greeting = 'Buenas noches';

      const lines = [
        `${greeting} *${loan.client.name}*`,
        '',
        'Le hago recordar del pago pendiente de su préstamo.',
        'Recuerde que puede realizar el pago a través de:',
        '',
        `📍 *Plin*: Al número ${settings.payment_phone_plin || '951959763'} a nombre de *Keysy Otero Cañola*`,
        settings.payment_qr_plin ? `📷 Código QR Plin: ${settings.payment_qr_plin}` : null,
        '',
        '📍 *Transferencia Bancaria*:',
        `Banco: ${settings.payment_bank_name || 'Interbank'}`,
        `CCI: ${settings.payment_bank_cci || '00371401349270785038'}`,
        `Cuenta de Ahorro: ${settings.payment_bank_cuenta || '7143492707850'}`,
        `A nombre de *Keysy Otero Cañola*`,
        '',
        'Por favor, enviar el comprobante de pago por este medio.',
        '',
        '¡Gracias!',
      ].filter(Boolean).join('\n');

      window.open(`https://wa.me/${fullPhone}?text=${encodeURIComponent(lines)}`, '_blank');
    } catch {
      // If fetch fails, still send with defaults
    }
  };

  const handleCancelLoan = async () => {
    if (!cancelLoanId) return;
    setCancelling(true);
    try {
      const res = await fetch('/api/loans', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: cancelLoanId, status: 'cancelled', cancellationReason: cancelReason || null }),
      });
      if (res.ok) {
        toast({ title: 'Préstamo cancelado', description: 'El préstamo ha sido cancelado exitosamente' });
        setCancelLoanId(null);
        setCancelReason('');
        fetchLoans();
        fetchCapital();
      } else {
        const data = await res.json();
        toast({ title: 'Error', description: data.error || 'No se pudo cancelar', variant: 'destructive' });
      }
    } catch {
      toast({ title: 'Error', description: 'Error de conexión', variant: 'destructive' });
    } finally {
      setCancelling(false);
    }
  };

  const handleDeleteLoan = async () => {
    if (!deleteLoanId) return;
    setDeleting(true);
    try {
      const res = await fetch(`/api/loans?id=${deleteLoanId}`, { method: 'DELETE' });
      if (res.ok) {
        toast({ title: 'Préstamo eliminado', description: 'El préstamo ha sido eliminado' });
        setDeleteLoanId(null);
        fetchLoans();
      } else {
        const data = await res.json();
        toast({ title: 'Error', description: data.error || 'No se pudo eliminar', variant: 'destructive' });
      }
    } catch {
      toast({ title: 'Error', description: 'Error de conexión', variant: 'destructive' });
    } finally {
      setDeleting(false);
    }
  };

  const handleRefinance = async () => {
    if (!detailLoan || !refinanceReason) return;
    setRefinancing(true);
    try {
      const res = await fetch('/api/loans', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: detailLoan.id, status: 'refinanced', refinanceReason: refinanceReason }),
      });
      if (res.ok) {
        toast({ title: 'Préstamo refinanciado', description: 'El préstamo ha sido refinanciado exitosamente' });
        setRefinanceOpen(false);
        setDetailOpen(false);
        fetchLoans();
        fetchCapital();
      } else {
        const data = await res.json();
        toast({ title: 'Error', description: data.error || 'No se pudo refinanciar', variant: 'destructive' });
      }
    } catch {
      toast({ title: 'Error', description: 'Error de conexión', variant: 'destructive' });
    } finally {
      setRefinancing(false);
    }
  };

  // Payment handler
  const handlePayRegister = async () => {
    if (!detailLoan || paySelectedInstallments.length === 0 || !payAmount) {
      toast({ title: 'Campos requeridos', description: 'Seleccione al menos una cuota a cancelar', variant: 'destructive' });
      return;
    }
    const amount = parseFloat(payAmount);
    if (isNaN(amount) || amount <= 0) {
      toast({ title: 'Monto inválido', description: 'El monto debe ser mayor a 0', variant: 'destructive' });
      return;
    }
    setPayRegistering(true);
    try {
      const body: Record<string, unknown> = {
        loanId: detailLoan.id,
        amount,
        paymentMethod: payMethod,
        observation: payObservation || null,
        proofPhoto: payProofFileBase64 || null,
        collectorId: user?.id,
      };
      const res = await fetch('/api/payments', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
      if (res.ok) {
        const data = await res.json();
        if (data.loanCompleted) {
          toast({ title: 'Préstamo completado', description: 'El préstamo ha sido pagado en su totalidad', variant: 'default' });
        } else {
          toast({ title: 'Cobro registrado', description: `${formatCurrency(amount)} cobrado a ${detailLoan.client?.name || 'cliente'}`, variant: 'default' });
        }
        setPayOpen(false);
        setDetailOpen(false);
        fetchLoans();
      } else {
        const data = await res.json();
        toast({ title: 'Error', description: data.error || 'No se pudo registrar el cobro', variant: 'destructive' });
      }
    } catch {
      toast({ title: 'Error', description: 'Error de conexión', variant: 'destructive' });
    } finally {
      setPayRegistering(false);
    }
  };

  // ============================================================
  // Stats
  // ============================================================

  const activeLoans = loans.filter((l) => l.status === 'active').length;
  const moraLoans = loans.filter((l) => l.status === 'mora').length;
  const totalLoaned = loans.reduce((s, l) => s + l.amount, 0);
  const totalCollected = loans.reduce((s, l) => s + l.amountPaid, 0);

  // ============================================================
  // Render
  // ============================================================

  const statusFilters = [
    { key: 'all', label: 'Todos', count: total },
    { key: 'active', label: 'Activos' },
    { key: 'mora', label: 'Mora' },
    { key: 'completed', label: 'Completados' },
    { key: 'cancelled', label: 'Cancelados' },
  ];

  return (
    <div className="space-y-6">
      {/* Summary Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Card className="border-0 shadow-md bg-gradient-to-br from-emerald-500 to-emerald-600 text-white">
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-emerald-100 text-xs font-medium">Capital Disponible</p>
                <p className="text-lg sm:text-xl md:text-2xl font-bold mt-1">{formatCurrency(capital)}</p>
              </div>
              <DollarSign className="h-8 w-8 text-emerald-200" />
            </div>
          </CardContent>
        </Card>

        <Card className="border-0 shadow-md bg-gradient-to-br from-teal-500 to-teal-600 text-white">
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-teal-100 text-xs font-medium">Total Prestado</p>
                <p className="text-lg sm:text-xl md:text-2xl font-bold mt-1">{formatCurrency(totalLoaned)}</p>
              </div>
              <TrendingUp className="h-8 w-8 text-teal-200" />
            </div>
          </CardContent>
        </Card>

        <Card className="border-0 shadow-md bg-gradient-to-br from-amber-500 to-orange-500 text-white">
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-amber-100 text-xs font-medium">Total Cobrado</p>
                <p className="text-lg sm:text-xl md:text-2xl font-bold mt-1">{formatCurrency(totalCollected)}</p>
              </div>
              <CreditCard className="h-8 w-8 text-amber-200" />
            </div>
          </CardContent>
        </Card>

        <Card className="border-0 shadow-md bg-gradient-to-br from-red-500 to-rose-600 text-white">
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-red-100 text-xs font-medium">En Mora</p>
                <p className="text-2xl font-bold mt-1">{moraLoans}</p>
              </div>
              <AlertTriangle className="h-8 w-8 text-red-200" />
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Toolbar */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div className="flex items-stretch gap-2.5 flex-wrap">
          {statusFilters.map((filter) => (
            <Button
              key={filter.key}
              variant={statusFilter === filter.key ? 'default' : 'outline'}
              size="sm"
              className={
                (statusFilter === filter.key
                  ? 'bg-emerald-600 hover:bg-emerald-700 text-white border-0 shadow-lg shadow-emerald-600/25 hover:shadow-emerald-600/40 transition-all '
                  : 'border-input dark:border-emerald-500/5 hover:border-emerald-300 hover:text-emerald-600 dark:hover:text-emerald-400 text-foreground/70 dark:text-foreground/80 hover:bg-emerald-50 dark:hover:bg-emerald-950/30 ') +
                'px-4 flex-1 sm:flex-none'
              }
              onClick={() => { setStatusFilter(filter.key); setPage(1); }}
            >
              {filter.label}
            </Button>
          ))}
        </div>

        <div className="flex items-center gap-2 w-full sm:w-auto">
          <div className="relative flex-1 sm:flex-initial">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Buscar cliente, DNI..."
              value={searchQuery}
              onChange={(e) => { setSearchQuery(e.target.value); setPage(1); }}
              className="pl-9 w-full sm:w-64 bg-white dark:bg-[#05060b]/80 border-input"
            />
          </div>
          <Button
            variant="outline"
            size="icon"
            className="border-input"
            onClick={() => fetchLoans()}
          >
            <RefreshCw className="h-4 w-4" />
          </Button>
          <FilterManager
            tab="loans"
            currentFilters={{ status: statusFilter, search: searchQuery }}
            onFiltersChange={(f) => { if (f.status) setStatusFilter(f.status); if (f.search !== undefined) setSearchQuery(f.search); setPage(1); }}
            showSaveButton
            showClearButton
          />
          <Button
            className="bg-emerald-600 hover:bg-emerald-700 text-white border-0 shadow-lg shadow-emerald-600/25 hover:shadow-emerald-600/40 transition-all"
            onClick={() => {
              resetCreateForm();
              setCreateOpen(true);
              fetchClients();
              fetchReferenceData();
              fetchCapital();
            }}
          >
            <Plus className="h-4 w-4 mr-2" />
            <span className="hidden sm:inline">Nuevo Préstamo</span>
            <span className="sm:hidden">Nuevo</span>
          </Button>
        </div>
      </div>

      {/* Loan List */}
      {loading ? (
        <div className="space-y-4">
          {[...Array(5)].map((_, i) => (
            <Card key={i} className="border-0 shadow-md">
              <CardContent className="p-4">
                <div className="flex items-center gap-4">
                  <Skeleton className="h-12 w-12 rounded-full" />
                  <div className="flex-1 space-y-2">
                    <Skeleton className="h-4 w-48" />
                    <Skeleton className="h-3 w-32" />
                  </div>
                  <Skeleton className="h-8 w-24" />
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      ) : loans.length === 0 ? (
        <Card className="border-0 shadow-md">
          <CardContent className="p-12 text-center">
            <div className="w-16 h-16 rounded-full bg-background/70 dark:bg-[#05060b]/70 flex items-center justify-center mx-auto mb-4">
              <FileText className="h-8 w-8 text-muted-foreground dark:text-muted-foreground" />
            </div>
            <h3 className="text-lg font-semibold text-foreground/80 dark:text-foreground/80 mb-2">No hay préstamos</h3>
            <p className="text-muted-foreground dark:text-muted-foreground mb-4">
              {statusFilter !== 'all'
                ? `No se encontraron préstamos con estado "${statusFilters.find(f => f.key === statusFilter)?.label}"`
                : 'Aún no se han registrado préstamos'}
            </p>
            <Button
              className="bg-emerald-600 hover:bg-emerald-700 text-white border-0"
              onClick={() => {
                resetCreateForm();
                setCreateOpen(true);
                fetchClients();
                fetchReferenceData();
                fetchCapital();
              }}
            >
              <Plus className="h-4 w-4 mr-2" />
              Crear Primer Préstamo
            </Button>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-3">
          {loans.map((loan) => {
            const statusBadge = getStatusBadge(loan.status);
            const progressColor = getProgressColor(loan.progressPercent, loan.status);
            const checked = isSelected(loan.id);
            return (
              <Card
                key={loan.id}
                className={`border-0 shadow-md hover:shadow-lg transition-all duration-200 ${checked ? 'ring-2 ring-emerald-500 bg-emerald-50/30' : 'cursor-pointer'} ${
                  loan.status === 'mora' ? 'border-l-4 border-l-red-500' : ''
                }`}
                onClick={(e) => {
                  if ((e.target as HTMLElement).closest('label')) return;
                  setDetailLoan(loan); setDetailOpen(true);
                }}
              >
                <CardContent className="p-4 sm:p-5">
                  <div className="flex flex-col sm:flex-row sm:items-center gap-4">
                    {/* Selection checkbox */}
                    <label className="inline-flex items-center cursor-pointer shrink-0 ml-1">
                      <input
                        type="checkbox"
                        checked={checked}
                        onChange={(e) => { e.stopPropagation(); toggle(loan.id); }}
                        className="sr-only"
                      />
                      <div className={`w-4 h-4 rounded border-2 flex items-center justify-center transition-colors ${
                        checked ? 'bg-emerald-600 border-emerald-600' : 'border-slate-300 dark:border-slate-600'
                      }`}>
                        {checked && <Check className="w-3 h-3 text-white" />}
                      </div>
                    </label>
                    {/* Client Info */}
                    <div className="flex items-center gap-3 flex-1 min-w-0">
                      <div className={`w-10 h-10 rounded-full flex items-center justify-center shrink-0 ${
                        loan.status === 'mora' ? 'bg-red-100' :
                        loan.status === 'completed' || loan.status === 'paid' ? 'bg-emerald-100' :
                        'bg-teal-100'
                      }`}>
                        <User className={`h-5 w-5 ${
                          loan.status === 'mora' ? 'text-red-600 dark:text-red-300' :
                          loan.status === 'completed' || loan.status === 'paid' ? 'text-emerald-600 dark:text-emerald-300' :
                          'text-teal-600 dark:text-teal-300'
                        }`} />
                      </div>
                      <div className="min-w-0">
                        <div className="flex items-center gap-2">
                          <h4 className="font-semibold text-foreground dark:text-foreground truncate">{loan.client.name}</h4>
                          <Badge variant="outline" className={`text-xs shrink-0 ${statusBadge.className}`}>
                            {statusBadge.icon}
                            <span className="ml-1">{statusBadge.label}</span>
                          </Badge>
                        </div>
                        <div className="flex items-center gap-3 text-xs text-muted-foreground dark:text-muted-foreground mt-0.5">
                          <span className="flex items-center gap-1"><Phone className="h-3 w-3" />{loan.client.phone}</span>
                          {loan.zone && <span className="flex items-center gap-1"><MapPin className="h-3 w-3" />{loan.zone.name}</span>}
                          {loan.collector && <span className="flex items-center gap-1"><Users className="h-3 w-3" />{loan.collector.name}</span>}
                        </div>
                      </div>
                    </div>

                    {/* Financial Info */}
                    <div className="flex items-center gap-6 sm:gap-8">
                      <div className="hidden md:flex flex-col items-center gap-3">
                        <div className="text-center">
                          <p className="text-xs text-muted-foreground dark:text-muted-foreground">Monto</p>
                          <p className="font-bold text-foreground dark:text-foreground">{formatCurrency(loan.amount)}</p>
                        </div>
                        <div className="text-center">
                          <p className="text-xs text-muted-foreground dark:text-muted-foreground">Total</p>
                          <p className="font-bold text-foreground/80 dark:text-foreground/80">{formatCurrency(loan.totalAmount)}</p>
                        </div>
                      </div>

                      <div className="hidden md:flex flex-col items-center">
                        <p className="text-xs text-muted-foreground dark:text-muted-foreground">Cuota {loan.paymentFrequency === 'daily' ? 'Diaria' : 'Semanal'}</p>
                        <p className="font-bold text-emerald-600 dark:text-emerald-300">{formatCurrency(loan.dailyPayment)}</p>
                      </div>

                      {/* Progress */}
                      <div className="w-32 sm:w-40">
                        <div className="flex items-center justify-between mb-1">
                          <span className="text-xs text-muted-foreground dark:text-muted-foreground">Progreso</span>
                          <span className={`text-xs font-semibold ${
                            loan.status === 'mora' ? 'text-red-600 dark:text-red-300' :
                            loan.progressPercent >= 75 ? 'text-emerald-600 dark:text-emerald-300' :
                            'text-amber-600 dark:text-amber-300'
                          }`}>
                            {loan.progressPercent.toFixed(1)}%
                          </span>
                        </div>
                        <Progress value={loan.progressPercent} className={`h-2 ${progressColor}`} />
                        <div className="flex items-center justify-between mt-1">
                          <span className="text-xs text-muted-foreground">{formatCurrency(loan.amountPaid)}</span>
                          <span className="text-xs text-muted-foreground">{formatCurrency(loan.totalAmount)}</span>
                        </div>
                      </div>

                      {/* Days Remaining */}
                      <div className="hidden lg:flex flex-col items-center">
                        <p className="text-xs text-muted-foreground dark:text-muted-foreground">Días Rest.</p>
                        <p className={`font-bold ${
                          loan.daysRemaining !== null && loan.daysRemaining < 0 ? 'text-red-600 dark:text-red-300' :
                          loan.daysRemaining !== null && loan.daysRemaining < 5 ? 'text-amber-600 dark:text-amber-300' :
                          'text-foreground/80 dark:text-foreground/80'
                        }`}>
                          {loan.daysRemaining !== null ? `${loan.daysRemaining}d` : '—'}
                        </p>
                      </div>

                      {/* Actions */}
                      <div className="flex items-center gap-1">
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-8 w-8 text-muted-foreground hover:text-emerald-600 dark:text-emerald-300 hover:bg-emerald-50 dark:hover:bg-emerald-950/50"
                          onClick={(e) => {
                            e.stopPropagation();
                            setDetailLoan(loan);
                            setDetailOpen(true);
                          }}
                        >
                          <Eye className="h-4 w-4" />
                        </Button>
                        {isAdmin && (loan.status === 'active' || loan.status === 'mora') && (
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-8 w-8 text-muted-foreground hover:text-red-600 dark:text-red-300 hover:bg-red-50 dark:hover:bg-red-950/50"
                            onClick={(e) => {
                              e.stopPropagation();
                              setCancelLoanId(loan.id);
                            }}
                          >
                            <XCircle className="h-4 w-4" />
                          </Button>
                        )}
                        {isAdmin && (loan.status === 'cancelled' || loan.status === 'completed') && (
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-8 w-8 text-muted-foreground hover:text-red-600 dark:text-red-300 hover:bg-red-50 dark:hover:bg-red-950/50"
                            onClick={(e) => {
                              e.stopPropagation();
                              setDeleteLoanId(loan.id);
                            }}
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        )}
                      </div>
                    </div>
                  </div>

                  {/* Mobile-only financial row */}
                  <div className="flex md:hidden items-center justify-between mt-3 pt-3 border-t border-input/50 dark:border-emerald-500/10">
                    <div className="flex items-center gap-4">
                      <div>
                        <p className="text-xs text-muted-foreground dark:text-muted-foreground">Monto</p>
                        <p className="font-bold text-sm text-foreground dark:text-foreground">{formatCurrency(loan.amount)}</p>
                      </div>
                      <div>
                        <p className="text-xs text-muted-foreground dark:text-muted-foreground">Cuota</p>
                        <p className="font-bold text-sm text-emerald-600 dark:text-emerald-300">{formatCurrency(loan.dailyPayment)}</p>
                      </div>
                    </div>
                    <div className="text-right">
                      <p className="text-xs text-muted-foreground dark:text-muted-foreground">Restante</p>
                      <p className="font-bold text-sm text-foreground/80 dark:text-foreground/80">{formatCurrency(loan.remaining)}</p>
                    </div>
                  </div>
                </CardContent>
              </Card>
            );
          })}

          {/* Pagination */}
          {totalPages > 1 && (
            <div className="flex items-center justify-center gap-2 pt-4">
              <Button
                variant="outline"
                size="sm"
                disabled={page <= 1}
                onClick={() => setPage(page - 1)}
              >
                <ChevronLeft className="h-4 w-4" />
              </Button>
              <span className="text-sm text-foreground/70 dark:text-muted-foreground">
                Página {page} de {totalPages}
              </span>
              <Button
                variant="outline"
                size="sm"
                disabled={page >= totalPages}
                onClick={() => setPage(page + 1)}
              >
                <ChevronRight className="h-4 w-4" />
              </Button>
            </div>
          )}

          {/* Bulk Actions */}
          {count > 0 && (
            <BulkActions
              selectedIds={selectedIds}
              onSelectionChange={setSelectedIds}
              actions={[
                {
                  label: 'Recordar pago',
                  icon: <Bell className="h-4 w-4" />,
                  action: async (ids) => {
                    await fetch('/api/bulk/loans', {
                      method: 'POST',
                      headers: { 'Content-Type': 'application/json' },
                      body: JSON.stringify({ action: 'remind', loanIds: ids }),
                    });
                    toast({ title: 'Recordatorios enviados', description: `${ids.length} recordatorios` });
                  },
                },
                {
                  label: 'Enviar link de pago',
                  icon: <Mail className="h-4 w-4" />,
                  action: async (ids) => {
                    await fetch('/api/bulk/loans', {
                      method: 'POST',
                      headers: { 'Content-Type': 'application/json' },
                      body: JSON.stringify({ action: 'send_link', loanIds: ids }),
                    });
                    toast({ title: 'Links generados', description: `${ids.length} links de pago` });
                  },
                },
                {
                  label: 'Exportar seleccionados',
                  icon: <Download className="h-4 w-4" />,
                  action: async (ids) => {
                    const url = `/api/export?type=loans&ids=${ids.join(',')}`;
                    window.open(url, '_blank');
                  },
                  variant: 'outline',
                },
                {
                  label: 'Cancelar préstamos',
                  icon: <AlertTriangle className="h-4 w-4" />,
                  action: async (ids) => {
                    if (!confirm(`¿Cancelar ${ids.length} préstamos?`)) return;
                    await fetch('/api/bulk/loans', {
                      method: 'POST',
                      headers: { 'Content-Type': 'application/json' },
                      body: JSON.stringify({ action: 'cancel', loanIds: ids }),
                    });
                    toast({ title: 'Cancelados', description: `${ids.length} préstamos cancelados` });
                  },
                  variant: 'destructive',
                },
              ]}
              allIds={loans.map(l => l.id)}
            />
          )}
        </div>
      )}

      {/* ============================================================ */}
      {/* CREATE LOAN DIALOG (Multi-Step) */}
      {/* ============================================================ */}
      <Dialog open={createOpen} onOpenChange={(open) => { if (!open) resetCreateForm(); else if (!isAdmin && user?.id) { setCollectorId(user.id); } setCreateOpen(open); }}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto flex flex-col p-0">
          <DialogHeader className="px-6 pt-6 pb-4 border-b border-input/50 dark:border-emerald-500/10">
            <DialogTitle className="flex items-center gap-2 text-xl">
              <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-emerald-500 to-teal-500 flex items-center justify-center">
                <Plus className="h-4 w-4 text-white" />
              </div>
              Nuevo Préstamo
            </DialogTitle>
            <DialogDescription>
              Paso {createStep} de 3 — {createStep === 1 ? 'Seleccionar cliente' : createStep === 2 ? 'Parámetros del préstamo' : 'Detalles adicionales'}
            </DialogDescription>
          </DialogHeader>

          {/* Step Indicator */}
          <div className="px-6 py-4 bg-background/50 dark:bg-[#05060b]/70 border-b border-input/50 dark:border-emerald-500/10">
            <div className="flex items-center gap-3">
              {[1, 2, 3].map((step) => (
                <React.Fragment key={step}>
                  <div className={`flex items-center gap-2 ${createStep >= step ? 'text-emerald-600 dark:text-emerald-300' : 'text-muted-foreground'}`}>
                    <div className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold shrink-0 ${
                      createStep > step
                        ? 'bg-emerald-500 text-white'
                        : createStep === step
                        ? 'bg-emerald-100 text-emerald-700 dark:text-emerald-300 border-2 border-emerald-500'
                        : 'bg-slate-200 text-muted-foreground dark:text-muted-foreground'
                    }`}>
                      {createStep > step ? <CheckCircle2 className="h-4 w-4" /> : step}
                    </div>
                    <span className="text-xs font-medium hidden sm:inline">
                      {step === 1 ? 'Cliente' : step === 2 ? 'Parámetros' : 'Detalles'}
                    </span>
                  </div>
                  {step < 3 && (
                    <div className={`flex-1 h-0.5 ${createStep > step ? 'bg-emerald-500' : 'bg-slate-200'}`} />
                  )}
                </React.Fragment>
              ))}
            </div>
          </div>

          <ScrollArea className="flex-1 px-6">
            <div className="py-4 space-y-5">
              {/* ========== STEP 1: Client Selection ========== */}
              {createStep === 1 && (
                <>
                  <div>
                    <Label className="text-sm font-semibold text-foreground/80 dark:text-foreground/80">Buscar Cliente</Label>
                    <div className="relative mt-1.5">
                      <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                      <Input
                        placeholder="Buscar por nombre, DNI o teléfono..."
                        value={clientSearch}
                        onChange={(e) => setClientSearch(e.target.value)}
                        className="pl-9"
                      />
                    </div>
                  </div>

                  {clientSearch && (
                    <ScrollArea className="max-h-56">
                      <div className="space-y-2">
                        {clients.length === 0 ? (
                          <p className="text-sm text-muted-foreground dark:text-muted-foreground text-center py-4">No se encontraron clientes</p>
                        ) : (
                          clients.map((client) => {
                            const hasActive = (client.stats?.activeLoans || 0) > 0;
                            const isSelected = selectedClientId === client.id;
                            return (
                              <button
                                key={client.id}
                                className={`w-full text-left p-4 rounded-lg border transition-all ${
                                  isSelected
                                    ? 'border-emerald-500 bg-emerald-50 dark:bg-emerald-950/50 ring-2 ring-emerald-200'
                                    : hasActive
                                    ? 'border-input bg-background/50 dark:bg-[#05060b]/70 opacity-60 cursor-not-allowed'
                                    : 'border-input hover:border-emerald-300 hover:bg-emerald-50/50 dark:hover:bg-emerald-950/30'
                                }`}
                                onClick={() => { if (!hasActive) { setSelectedClientId(client.id); setClientSearch(''); } }}
                                disabled={hasActive}
                              >
                                <div className="flex items-center justify-between">
                                  <div>
                                    <p className="font-medium text-sm text-foreground dark:text-foreground">{client.name}</p>
                                    <p className="text-xs text-muted-foreground dark:text-muted-foreground">{getDocumentLabel(client.documentType)}: {client.documentNumber} | Tel: {client.phone}</p>
                                  </div>
                                  {hasActive ? (
                                    <Badge variant="outline" className="bg-amber-50 dark:bg-amber-950/50 text-amber-700 dark:text-amber-300 border-amber-200 text-xs shrink-0 ml-2">
                                      Préstamo activo
                                    </Badge>
                                  ) : client.zone ? (
                                    <Badge variant="outline" className="bg-background/50 dark:bg-[#05060b]/70 text-foreground/70 dark:text-muted-foreground border-input text-xs shrink-0 ml-2">
                                      {client.zone.name}
                                    </Badge>
                                  ) : null}
                                </div>
                                {client.creditScore !== null && (
                                  <div className="mt-2 flex items-center gap-1.5">
                                    <span className="text-xs text-muted-foreground">Score:</span>
                                    <span className={`text-xs font-semibold ${
                                      client.creditScore < 30 ? 'text-red-600 dark:text-red-300' :
                                      client.creditScore < 50 ? 'text-amber-600 dark:text-amber-300' :
                                      'text-emerald-600 dark:text-emerald-300'
                                    }`}>
                                      {client.creditScore}/100
                                    </span>
                                  </div>
                                )}
                              </button>
                            );
                          })
                        )}
                      </div>
                    </ScrollArea>
                  )}

                  {/* Selected client summary */}
                  {selectedClientId && selectedClient && (
                    <Alert className="bg-emerald-50 dark:bg-emerald-950/50 border-emerald-200">
                      <CheckCircle2 className="h-4 w-4 text-emerald-600 dark:text-emerald-300" />
                      <AlertDescription className="text-emerald-800 dark:text-emerald-200">
                        <span className="font-semibold">{selectedClient.name}</span> — {getDocumentLabel(selectedClient.documentType)}: {selectedClient.documentNumber} | Tel: {selectedClient.phone}
                        {selectedClient.creditScore !== null && ` | Score: ${selectedClient.creditScore}/100`}
                      </AlertDescription>
                    </Alert>
                  )}

                  <Separator />

                  {/* Create new client inline */}
                  <div>
                    <Button
                      variant="outline"
                      size="sm"
                      className="text-emerald-600 dark:text-emerald-300 border-emerald-200 hover:bg-emerald-50"
                      onClick={() => setShowNewClient(!showNewClient)}
                    >
                      <UserPlus className="h-4 w-4 mr-2" />
                      {showNewClient ? 'Ocultar formulario' : 'Crear nuevo cliente'}
                    </Button>

                    {showNewClient && (
                      <Card className="mt-3 border-emerald-200 bg-emerald-50/30 dark:bg-emerald-950/30">
                        <CardContent className="p-4 space-y-3">
                          <div className="space-y-3">
                            <div>
                              <Label className="text-xs">Tipo Doc. *</Label>
                              <Select value={newClient.documentType} onValueChange={(v) => setNewClient({ ...newClient, documentType: v })}>
                                <SelectTrigger className="mt-1">
                                  <SelectValue />
                                </SelectTrigger>
                                <SelectContent>
                                  <SelectItem value="dni">DNI</SelectItem>
                                  <SelectItem value="carnet_extranjeria">Carnet Ext.</SelectItem>
                                  <SelectItem value="pasaporte">Pasaporte</SelectItem>
                                </SelectContent>
                              </Select>
                            </div>
                            <div>
                              <Label className="text-xs">N° Documento *</Label>
                              <Input
                                placeholder={newClient.documentType === 'dni' ? '12345678' : 'N° documento'}
                                value={newClient.documentNumber}
                                onChange={(e) => setNewClient({ ...newClient, documentNumber: e.target.value })}
                                className="mt-1"
                                maxLength={newClient.documentType === 'dni' ? 8 : 20}
                              />
                            </div>
                            <div>
                              <Label className="text-xs">Nombre completo *</Label>
                              <Input
                                placeholder="Juan Pérez"
                                value={newClient.name}
                                onChange={(e) => setNewClient({ ...newClient, name: e.target.value })}
                                className="mt-1"
                              />
                            </div>
                            <div>
                              <Label className="text-xs">Teléfono *</Label>
                              <Input
                                placeholder="999111222"
                                value={newClient.phone}
                                onChange={(e) => setNewClient({ ...newClient, phone: e.target.value })}
                                className="mt-1"
                              />
                            </div>
                            <div>
                              <Label className="text-xs">Dirección</Label>
                              <Input
                                placeholder="Av. Principal 123"
                                value={newClient.address}
                                onChange={(e) => setNewClient({ ...newClient, address: e.target.value })}
                                className="mt-1"
                              />
                            </div>
                            {isAdmin && (
                            <div>
                              <Label className="text-xs">Zona</Label>
                              <Select value={newClient.zoneId} onValueChange={(v) => setNewClient({ ...newClient, zoneId: v })}>
                                <SelectTrigger className="mt-1">
                                  <SelectValue placeholder="Seleccionar zona" />
                                </SelectTrigger>
                                <SelectContent>
                                  {zones.map((z) => (
                                    <SelectItem key={z.id} value={z.id}>{z.name}</SelectItem>
                                  ))}
                                </SelectContent>
                              </Select>
                            </div>
                            )}
                          </div>
                            <Button
                              className="w-full bg-emerald-600 hover:bg-emerald-700 text-white border-0 shadow-lg shadow-emerald-600/25 hover:shadow-emerald-600/40 transition-all"
                              onClick={handleCreateClient}
                              disabled={creatingClient}
                            >
                              {creatingClient ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <UserPlus className="h-4 w-4 mr-2" />}
                              Registrar Cliente
                            </Button>
                        </CardContent>
                      </Card>
                    )}
                  </div>
                </>
              )}

              {/* ========== STEP 2: Loan Parameters ========== */}
              {createStep === 2 && (
                <>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div>
                      <Label className="text-sm font-semibold text-foreground/80 dark:text-foreground/80">
                        Monto del Préstamo (S/) *
                      </Label>
                      <div className="relative mt-1.5">
                        <DollarSign className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                        <Input
                          type="number"
                          placeholder="1000.00"
                          value={loanAmount}
                          onChange={(e) => setLoanAmount(e.target.value)}
                          className="pl-9 text-lg font-semibold"
                          min="0"
                          step="0.01"
                        />
                      </div>
                      {parseFloat(loanAmount) > capital && (
                        <p className="text-xs text-red-500 mt-1 flex items-center gap-1">
                          <AlertTriangle className="h-3 w-3" />
                          Capital insuficiente. Disponible: {formatCurrency(capital)}
                        </p>
                      )}
                    </div>

                    <div className="bg-emerald-50 dark:bg-emerald-950/50 rounded-lg border border-emerald-100 px-3 py-2.5 flex items-center justify-between">
                      <span className="text-xs text-muted-foreground dark:text-muted-foreground font-medium">Tasa de Interés</span>
                      <span className="text-sm font-bold text-emerald-600 dark:text-emerald-300">{interestRate || '20'}% <span className="font-normal text-muted-foreground dark:text-muted-foreground">· {loanDays === '36' ? '32.10%' : '20%'} fijo</span></span>
                    </div>

                    <div>
                      <Label className="text-xs font-semibold text-muted-foreground dark:text-muted-foreground uppercase tracking-wider">
                        Plazo
                      </Label>
                      <div className="grid grid-cols-2 gap-1.5 mt-1">
                        {['24', '36'].map(d => (
                          <button
                            key={d}
                            type="button"
                            onClick={() => handleLoanDaysChange(d)}
                            className={`py-2 rounded-lg text-xs font-medium transition-all duration-200 border ${loanDays === d
                              ? 'border-emerald-500 bg-emerald-50 dark:bg-emerald-950/50 text-emerald-700 dark:text-emerald-300 shadow-sm'
                              : 'border-input bg-white dark:bg-[#05060b]/80 text-muted-foreground dark:text-muted-foreground hover:border-emerald-300 hover:text-emerald-600 dark:text-emerald-300'
                              }`}
                          >
                            {d} días
                          </button>
                        ))}
                      </div>
                    </div>

                    <div>
                      <Label className="text-xs font-semibold text-muted-foreground dark:text-muted-foreground uppercase tracking-wider">
                        Frecuencia
                      </Label>
                      <div className="grid grid-cols-2 gap-1.5 mt-1">
                        {[
                          { value: 'daily', label: 'Diario' },
                          { value: 'weekly', label: 'Semanal' },
                        ].map(f => (
                          <button
                            key={f.value}
                            type="button"
                            onClick={() => setPaymentFrequency(f.value)}
                            className={`py-2 rounded-lg text-xs font-medium transition-all duration-200 border ${paymentFrequency === f.value
                              ? 'border-emerald-500 bg-emerald-50 dark:bg-emerald-950/50 text-emerald-700 dark:text-emerald-300 shadow-sm'
                              : 'border-input bg-white dark:bg-[#05060b]/80 text-muted-foreground dark:text-muted-foreground hover:border-emerald-300 hover:text-emerald-600 dark:text-emerald-300'
                              }`}
                          >
                            {f.label}
                          </button>
                        ))}
                      </div>
                    </div>
                  </div>

                  {/* Rest Days */}
                  <div className="space-y-2">
                    <Label className="text-sm font-semibold text-foreground/80 dark:text-foreground/80">
                      Día de Descanso (sin cobro)
                    </Label>
                    <div className="flex flex-wrap gap-1.5">
                      {DAYS.map((day, idx) => {
                        const active = restDays.includes(idx);
                        return (
                          <button
                            key={idx}
                            type="button"
                            onClick={() => setRestDays(active ? [] : [idx])}
                            className={`px-4 py-2 rounded-xl text-sm font-medium transition-all duration-200 border-2 ${active
                              ? 'border-red-400 bg-red-50 dark:bg-red-950/50 text-red-600 dark:text-red-300 shadow-md shadow-red-500/10'
                              : 'border-input bg-white dark:bg-[#05060b]/80 text-foreground/70 dark:text-muted-foreground hover:border-red-300 hover:bg-red-50/50 dark:hover:bg-red-950/30'
                              }`}
                          >
                            {day}
                          </button>
                        );
                      })}
                    </div>
                    <p className="text-xs text-muted-foreground dark:text-muted-foreground">
                      {paymentFrequency === 'daily'
                        ? 'Los cobros saltarán este día de la semana'
                        : 'El cobro semanal se programará evitando este día'}
                    </p>
                  </div>

                  <div>
                    <Label className="text-sm font-semibold text-foreground/80 dark:text-foreground/80">Fecha de Inicio</Label>
                    <Input
                      type="date"
                      value={startDate}
                      onChange={(e) => setStartDate(e.target.value)}
                      className="mt-1.5"
                    />
                  </div>

                  {/* Live Calculation Preview */}
                  {parseFloat(loanAmount) > 0 && parseFloat(interestRate) >= 0 && parseInt(loanDays) > 0 && (
                    <Card className="border-2 border-emerald-200 bg-gradient-to-br from-emerald-50 to-teal-50 dark:from-emerald-950/50 dark:to-teal-950/50 shadow-lg shadow-emerald-500/10">
                      <CardHeader className="pb-2">
                        <CardTitle className="flex items-center gap-2 text-base">
                          <Calculator className="h-5 w-5 text-emerald-600 dark:text-emerald-300" />
                          Vista Previa del Préstamo
                        </CardTitle>
                      </CardHeader>
                      <CardContent className="space-y-3">
                        <div className="grid grid-cols-2 gap-3">
                          <div className="bg-white dark:bg-[#05060b]/80 rounded-lg p-3 border border-emerald-100">
                            <p className="text-xs text-muted-foreground dark:text-muted-foreground">Monto Prestado</p>
                            <p className="text-lg font-bold text-foreground dark:text-foreground">{formatCurrency(parseFloat(loanAmount) || 0)}</p>
                          </div>
                          <div className="bg-white dark:bg-[#05060b]/80 rounded-lg p-3 border border-emerald-100">
                            <p className="text-xs text-muted-foreground dark:text-muted-foreground">Interés ({interestRate}%)</p>
                            <p className="text-lg font-bold text-amber-600 dark:text-amber-300">{formatCurrency(calcInterest)}</p>
                          </div>
                          <div className="bg-white dark:bg-[#05060b]/80 rounded-lg p-3 border border-emerald-100">
                            <p className="text-xs text-muted-foreground dark:text-muted-foreground">Total a Pagar</p>
                            <p className="text-lg font-bold text-emerald-700 dark:text-emerald-300">{formatCurrency(calcTotalAmount)}</p>
                          </div>
                          <div className="bg-white dark:bg-[#05060b]/80 rounded-lg p-3 border border-emerald-100">
                            <p className="text-xs text-muted-foreground dark:text-muted-foreground">
                              Cuota {paymentFrequency === 'daily' ? 'Diaria' : 'Semanal'}
                            </p>
                            <p className="text-lg font-bold text-emerald-600 dark:text-emerald-300">{formatCurrency(paymentFrequency === 'weekly' ? calcWeeklyPayment : calcPaymentAmount)}</p>
                          </div>
                        </div>
                        <Separator />
                        <div className="flex items-center justify-between text-sm">
                          <span className="text-foreground/70 dark:text-muted-foreground">Ganancia esperada:</span>
                          <span className="font-bold text-emerald-600 dark:text-emerald-300">{formatCurrency(calcInterest)}</span>
                        </div>
                        <div className="flex items-center justify-between text-sm">
                          <span className="text-foreground/70 dark:text-muted-foreground">Número de cuotas:</span>
                          <span className="font-bold text-foreground/80 dark:text-foreground/80">{calcNumCuotas}</span>
                        </div>
                        {restDays.length > 0 && (
                          <div className="flex items-center justify-between text-sm">
                            <span className="text-foreground/70 dark:text-muted-foreground">Días de descanso:</span>
                            <span className="font-bold text-red-500">{restDays.sort().map(d => DAYS[d]).join(', ')}</span>
                          </div>
                        )}
                        {startDate && calcSchedule.length > 0 && (
                          <div className="bg-white dark:bg-[#05060b]/80 rounded-lg border border-emerald-100 max-h-40 overflow-y-auto">
                            <table className="w-full text-xs">
                              <thead>
                                <tr className="bg-emerald-50 dark:bg-emerald-950/50 text-emerald-700 dark:text-emerald-300">
                                  <th className="px-2 py-1.5 text-left font-semibold">#</th>
                                  <th className="px-2 py-1.5 text-left font-semibold">Tipo</th>
                                  <th className="px-2 py-1.5 text-left font-semibold">Fecha</th>
                                  <th className="px-2 py-1.5 text-right font-semibold">Monto</th>
                                </tr>
                              </thead>
                              <tbody>
                                {calcSchedule.slice(0, 15).map((row) => (
                                  <tr key={row.num} className="border-t border-emerald-50">
                                    <td className="px-2 py-1 text-muted-foreground dark:text-muted-foreground">{row.num}</td>
                                    <td className="px-2 py-1"><span className={`text-[10px] font-medium px-1.5 py-0.5 rounded ${row.type === 'Semana' ? 'bg-emerald-100 dark:bg-emerald-900/50 text-emerald-700 dark:text-emerald-300' : 'bg-background/70 dark:bg-[#05060b]/70 text-foreground/70 dark:text-muted-foreground'}`}>{row.type}</span></td>
                                    <td className="px-2 py-1 text-foreground/80 dark:text-foreground/80">{row.date}</td>
                                    <td className="px-2 py-1 text-right font-medium text-emerald-600 dark:text-emerald-300">{formatCurrency(row.amount)}</td>
                                  </tr>
                                ))}
                                {calcSchedule.length > 15 && (
                                  <tr className="border-t border-emerald-50">
                                    <td colSpan={4} className="px-2 py-1.5 text-center text-muted-foreground italic">
                                      ... y {calcSchedule.length - 15} pagos más
                                    </td>
                                  </tr>
                                )}
                              </tbody>
                            </table>
                          </div>
                        )}
                        {parseFloat(loanAmount) > capital && (
                          <Alert className="bg-red-50 dark:bg-red-950/50 border-red-200">
                            <AlertTriangle className="h-4 w-4 text-red-600 dark:text-red-300" />
                            <AlertDescription className="text-red-700 dark:text-red-300">
                              Capital insuficiente. Disponible: <strong>{formatCurrency(capital)}</strong>, Necesario: <strong>{formatCurrency(parseFloat(loanAmount))}</strong>
                            </AlertDescription>
                          </Alert>
                        )}
                      </CardContent>
                    </Card>
                  )}
                </>
              )}

              {/* ========== STEP 3: Additional Details ========== */}
              {createStep === 3 && (
                <>
                  {/* Summary of loan */}
                  <Card className="border-2 border-emerald-200 bg-emerald-50/50 dark:bg-emerald-950/30">
                    <CardContent className="p-4">
                      <h4 className="font-semibold text-sm text-emerald-800 dark:text-emerald-200 mb-2">Resumen del Préstamo</h4>
                      <div className="grid grid-cols-2 gap-2 text-sm">
                        <div>
                          <span className="text-muted-foreground dark:text-muted-foreground">Cliente:</span>
                          <p className="font-semibold text-foreground dark:text-foreground">{selectedClient?.name}</p>
                        </div>
                        <div>
                          <span className="text-muted-foreground dark:text-muted-foreground">{getDocumentLabel(selectedClient?.documentType || 'dni')}:</span>
                          <p className="font-semibold text-foreground dark:text-foreground">{selectedClient?.documentNumber}</p>
                        </div>
                        <div>
                          <span className="text-muted-foreground dark:text-muted-foreground">Monto:</span>
                          <p className="font-semibold text-foreground dark:text-foreground">{formatCurrency(parseFloat(loanAmount) || 0)}</p>
                        </div>
                        <div>
                          <span className="text-muted-foreground dark:text-muted-foreground">Total a Pagar:</span>
                          <p className="font-semibold text-emerald-700 dark:text-emerald-300">{formatCurrency(calcTotalAmount)}</p>
                        </div>
                        <div>
                          <span className="text-muted-foreground dark:text-muted-foreground">Cuota {paymentFrequency === 'daily' ? 'Diaria' : 'Semanal'}:</span>
                          <p className="font-semibold text-emerald-600 dark:text-emerald-300">{formatCurrency(paymentFrequency === 'weekly' ? calcWeeklyPayment : calcPaymentAmount)}</p>
                        </div>
                        <div>
                          <span className="text-muted-foreground dark:text-muted-foreground">Cuotas:</span>
                          <p className="font-semibold text-foreground dark:text-foreground">{calcNumCuotas}</p>
                        </div>
                      </div>
                    </CardContent>
                  </Card>

                  <div className={`grid grid-cols-1 ${isAdmin ? 'sm:grid-cols-2' : ''} gap-8`}>
                    {isAdmin && (
                      <div className="bg-background/50 dark:bg-[#05060b]/70 rounded-lg p-4 border border-input dark:border-emerald-500/5">
                        <Label className="text-sm font-semibold text-foreground/80 dark:text-foreground/80">Cobrador</Label>
                        <Select value={collectorId} onValueChange={setCollectorId}>
                          <SelectTrigger className="mt-2">
                            <SelectValue placeholder="Seleccionar cobrador (opcional)" />
                          </SelectTrigger>
                          <SelectContent>
                            {collectors.map((c) => (
                              <SelectItem key={c.id} value={c.id}>
                                {c.name || c.email} ({c.role})
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                    )}

                    <div className="bg-background/50 dark:bg-[#05060b]/70 rounded-lg p-4 border border-input dark:border-emerald-500/5">
                      <Label className="text-sm font-semibold text-foreground/80 dark:text-foreground/80">Zona</Label>
                      <Select value={zoneId} onValueChange={setZoneId}>
                        <SelectTrigger className="mt-2">
                          <SelectValue placeholder="Seleccionar zona (opcional)" />
                        </SelectTrigger>
                        <SelectContent>
                          {zones.map((z) => (
                            <SelectItem key={z.id} value={z.id}>{z.name}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                  </div>

                  <div>
                    <Label className="text-sm font-semibold text-foreground/80 dark:text-foreground/80">Notas</Label>
                    <Textarea
                      placeholder="Observaciones adicionales sobre el préstamo..."
                      value={loanNotes}
                      onChange={(e) => setLoanNotes(e.target.value)}
                      className="mt-1.5"
                      rows={3}
                    />
                  </div>
                </>
              )}
            </div>
          </ScrollArea>

          {/* Dialog Footer - Navigation */}
          <div className="px-6 py-4 border-t border-input/50 dark:border-emerald-500/10 bg-background/50 dark:bg-[#05060b]/70">
            <div className="flex items-center justify-between">
              <Button
                variant="outline"
                className="border-emerald-200 dark:border-emerald-800 text-emerald-700 dark:text-emerald-300 hover:bg-emerald-50 dark:hover:bg-emerald-950"
                onClick={() => {
                  if (createStep > 1) {
                    setCreateStep(createStep - 1);
                  } else {
                    setCreateOpen(false);
                    resetCreateForm();
                  }
                }}
              >
                <ArrowLeft className="h-4 w-4 mr-2" />
                {createStep > 1 ? 'Anterior' : 'Cancelar'}
              </Button>

              {createStep < 3 ? (
                <Button
                  className="bg-emerald-600 hover:bg-emerald-700 text-white border-0 shadow-lg shadow-emerald-600/25 hover:shadow-emerald-600/40 transition-all"
                  disabled={
                    (createStep === 1 && !canProceedStep1) ||
                    (createStep === 2 && !canProceedStep2)
                  }
                  onClick={() => setCreateStep(createStep + 1)}
                >
                  Siguiente
                  <ArrowRight className="h-4 w-4 ml-2" />
                </Button>
              ) : (
                <Button
                  className="bg-emerald-600 hover:bg-emerald-700 text-white border-0 shadow-lg shadow-emerald-600/25 hover:shadow-emerald-600/40 transition-all"
                  disabled={creating || parseFloat(loanAmount) > capital}
                  onClick={handleCreateLoan}
                >
                  {creating ? (
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  ) : (
                    <CheckCircle2 className="h-4 w-4 mr-2" />
                  )}
                  Crear Préstamo
                </Button>
              )}
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* ============================================================ */}
      {/* LOAN DETAIL SHEET */}
      {/* ============================================================ */}
      <Sheet open={detailOpen} onOpenChange={setDetailOpen}>
        <SheetContent className="w-full sm:max-w-2xl overflow-y-auto p-6">
          {detailLoan && (
            <>
              <SheetHeader className="border-b border-input/50 dark:border-emerald-500/10 p-0">
                <div className="flex items-center gap-3">
                  <div className={`w-10 h-10 rounded-full flex items-center justify-center ${
                    detailLoan.status === 'mora' ? 'bg-red-100 dark:bg-red-900/50' :
                    detailLoan.status === 'completed' || detailLoan.status === 'paid' ? 'bg-emerald-100 dark:bg-emerald-900/50' :
                    'bg-teal-100 dark:bg-teal-900/50'
                  }`}>
                    <DollarSign className={`h-5 w-5 ${
                      detailLoan.status === 'mora' ? 'text-red-600 dark:text-red-300' :
                      detailLoan.status === 'completed' || detailLoan.status === 'paid' ? 'text-emerald-600 dark:text-emerald-300' :
                      'text-teal-600 dark:text-teal-300'
                    }`} />
                  </div>
                  <div>
                    <SheetTitle className="text-lg">{detailLoan.client.name}</SheetTitle>
                    <SheetDescription className="flex items-center gap-2">
                      <Badge variant="outline" className={getStatusBadge(detailLoan.status).className}>
                        {getStatusBadge(detailLoan.status).icon}
                        <span className="ml-1">{getStatusBadge(detailLoan.status).label}</span>
                      </Badge>
                      <span className="text-xs">ID: ...{detailLoan.id.slice(-6)}</span>
                    </SheetDescription>
                  </div>
                </div>
              </SheetHeader>

              <div className="space-y-6">
                {/* Client Info */}
                <div className="grid grid-cols-2 gap-3 text-sm">
                  <div className="flex items-center gap-2">
                    <Phone className="h-4 w-4 text-muted-foreground" />
                    <span className="text-muted-foreground dark:text-muted-foreground">Tel:</span>
                    <span className="font-medium">{detailLoan.client.phone}</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <User className="h-4 w-4 text-muted-foreground" />
                    <span className="text-muted-foreground dark:text-muted-foreground">{getDocumentLabel(detailLoan.client.documentType || 'dni')}:</span>
                    <span className="font-medium">{detailLoan.client.documentNumber}</span>
                  </div>
                  {detailLoan.zone && (
                    <div className="flex items-center gap-2">
                      <MapPin className="h-4 w-4 text-muted-foreground" />
                      <span className="text-muted-foreground dark:text-muted-foreground">Zona:</span>
                      <span className="font-medium">{detailLoan.zone.name}</span>
                    </div>
                  )}
                  {detailLoan.collector && (
                    <div className="flex items-center gap-2">
                      <Users className="h-4 w-4 text-muted-foreground" />
                      <span className="text-muted-foreground dark:text-muted-foreground">Cobrador:</span>
                      <span className="font-medium">{detailLoan.collector.name}</span>
                    </div>
                  )}
                  {detailLoan.client.creditScore !== null && (
                    <div className="flex items-center gap-2">
                      <CreditCard className="h-4 w-4 text-muted-foreground" />
                      <span className="text-muted-foreground dark:text-muted-foreground">Score:</span>
                      <span className={`font-semibold ${
                        detailLoan.client.creditScore < 30 ? 'text-red-600 dark:text-red-300' :
                        detailLoan.client.creditScore < 50 ? 'text-amber-600 dark:text-amber-300' :
                        'text-emerald-600 dark:text-emerald-300'
                      }`}>
                        {detailLoan.client.creditScore}/100
                      </span>
                    </div>
                  )}
                </div>

                <Separator />

                {/* Financial Summary */}
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                  <div className="bg-background/50 dark:bg-[#05060b]/70 rounded-lg p-3 text-center">
                    <p className="text-xs text-muted-foreground dark:text-muted-foreground">Monto</p>
                    <p className="text-base font-bold text-foreground dark:text-foreground">{formatCurrency(detailLoan.amount)}</p>
                  </div>
                  <div className="bg-amber-50 dark:bg-amber-950/50 rounded-lg p-3 text-center">
                    <p className="text-xs text-muted-foreground dark:text-muted-foreground">Interés</p>
                    <p className="text-base font-bold text-amber-600 dark:text-amber-300">{formatCurrency(detailLoan.interest)}</p>
                  </div>
                  <div className="bg-emerald-50 dark:bg-emerald-950/50 rounded-lg p-3 text-center">
                    <p className="text-xs text-muted-foreground dark:text-muted-foreground">Total</p>
                    <p className="text-base font-bold text-emerald-700 dark:text-emerald-300">{formatCurrency(detailLoan.totalAmount)}</p>
                  </div>
                  <div className="bg-teal-50 dark:bg-teal-950/50 rounded-lg p-3 text-center">
                    <p className="text-xs text-muted-foreground dark:text-muted-foreground">Cuota</p>
                    <p className="text-base font-bold text-teal-600 dark:text-teal-300">{formatCurrency(detailLoan.dailyPayment)}</p>
                  </div>
                </div>

                {/* Progress */}
                <Card className="border-0 shadow-sm">
                  <CardContent className="p-4">
                    <div className="flex items-center justify-between mb-2">
                      <span className="text-sm font-semibold text-foreground/80 dark:text-foreground/80">Progreso de Pago</span>
                      <span className={`text-sm font-bold ${
                        detailLoan.status === 'mora' ? 'text-red-600 dark:text-red-300' :
                        detailLoan.progressPercent >= 75 ? 'text-emerald-600 dark:text-emerald-300' :
                        'text-amber-600 dark:text-amber-300'
                      }`}>
                        {detailLoan.progressPercent.toFixed(1)}%
                      </span>
                    </div>
                    <Progress value={detailLoan.progressPercent} className={`h-3 ${getProgressColor(detailLoan.progressPercent, detailLoan.status)}`} />
                    <div className="flex items-center justify-between mt-2 text-xs text-muted-foreground dark:text-muted-foreground">
                      <span>Pagado: {formatCurrency(detailLoan.amountPaid)}</span>
                      <span>Restante: {formatCurrency(detailLoan.remaining)}</span>
                    </div>
                  </CardContent>
                </Card>

                {/* Dates */}
                <div className="grid grid-cols-2 gap-4">
                  <div className="flex items-center gap-2">
                    <Calendar className="h-4 w-4 text-emerald-500" />
                    <div>
                      <p className="text-xs text-muted-foreground dark:text-muted-foreground">Fecha Inicio</p>
                      <p className="text-sm font-medium">{detailLoan.startDate ? formatDate(detailLoan.startDate) : 'No definida'}</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <Clock className="h-4 w-4 text-amber-500" />
                    <div>
                      <p className="text-xs text-muted-foreground dark:text-muted-foreground">Fecha Fin</p>
                      <p className="text-sm font-medium">{detailLoan.endDate ? formatDate(detailLoan.endDate) : 'No definida'}</p>
                    </div>
                  </div>
                </div>

                {/* Time info */}
                <div className="grid grid-cols-3 gap-3 text-center">
                  <div className="bg-background/50 dark:bg-[#05060b]/70 rounded-lg p-2">
                    <p className="text-xs text-muted-foreground dark:text-muted-foreground">Días Transcurridos</p>
                    <p className="text-sm font-bold text-foreground/80 dark:text-foreground/80">{detailLoan.daysElapsed}d</p>
                  </div>
                  <div className="bg-background/50 dark:bg-[#05060b]/70 rounded-lg p-2">
                    <p className="text-xs text-muted-foreground dark:text-muted-foreground">Días Restantes</p>
                    <p className={`text-sm font-bold ${
                      detailLoan.daysRemaining !== null && detailLoan.daysRemaining < 0 ? 'text-red-600 dark:text-red-300' :
                      detailLoan.daysRemaining !== null && detailLoan.daysRemaining < 5 ? 'text-amber-600 dark:text-amber-300' :
                      'text-foreground/80 dark:text-foreground/80'
                    }`}>
                      {detailLoan.daysRemaining !== null ? `${detailLoan.daysRemaining}d` : '—'}
                    </p>
                  </div>
                  <div className="bg-background/50 dark:bg-[#05060b]/70 rounded-lg p-2">
                    <p className="text-xs text-muted-foreground dark:text-muted-foreground">Frecuencia</p>
                    <p className="text-sm font-bold text-foreground/80 dark:text-foreground/80">
                      {detailLoan.paymentFrequency === 'daily' ? 'Diario' : 'Semanal'}
                    </p>
                  </div>
                </div>

                {/* Notes */}
                {detailLoan.notes && (
                  <div>
                    <h4 className="text-sm font-semibold text-foreground/80 dark:text-foreground/80 mb-1 flex items-center gap-1">
                      <FileText className="h-4 w-4" /> Notas
                    </h4>
                    <p className="text-sm text-foreground/70 dark:text-muted-foreground bg-background/50 dark:bg-[#05060b]/70 p-3 rounded-lg">{detailLoan.notes}</p>
                  </div>
                )}

                {/* Cancellation Info */}
                {detailLoan.status === 'cancelled' && (
                  <div>
                    <h4 className="text-sm font-semibold text-red-700 dark:text-red-300 mb-2 flex items-center gap-1">
                      <XCircle className="h-4 w-4" /> Cancelación
                    </h4>
                    <div className="bg-red-50 dark:bg-red-950/50 p-3 rounded-lg border border-red-100 space-y-1.5">
                      {detailLoan.cancellationReason && (
                        <p className="text-sm text-red-800 dark:text-red-200">
                          <span className="font-medium">Motivo:</span> {detailLoan.cancellationReason}
                        </p>
                      )}
                      {detailLoan.cancelledAt && (
                        <p className="text-xs text-red-600 dark:text-red-400">
                          <span className="font-medium">Cancelado el:</span> {formatDate(detailLoan.cancelledAt)}
                        </p>
                      )}
                    </div>
                  </div>
                )}

                {/* Late Fees */}
                {detailLoan.lateFees && detailLoan.lateFees.length > 0 && (
                  <div>
                    <h4 className="text-sm font-semibold text-foreground/80 dark:text-foreground/80 mb-2 flex items-center gap-1">
                      <AlertTriangle className="h-4 w-4 text-red-500" /> Recargos por Mora
                    </h4>
                    <div className="space-y-2">
                      {detailLoan.lateFees.map((fee) => (
                        <div key={fee.id} className="flex items-center justify-between bg-red-50 dark:bg-red-950/50 p-3 rounded-lg border border-red-100">
                          <div>
                            <p className="text-sm font-medium text-red-800 dark:text-red-200">{fee.daysLate} días de atraso</p>
                            <p className="text-xs text-red-600 dark:text-red-300">Tasa: S/{fee.ratePerDay}/día</p>
                          </div>
                          <div className="text-right">
                            <p className="font-bold text-red-700 dark:text-red-300">{formatCurrency(fee.amount)}</p>
                            <Badge variant="outline" className={`text-xs ${
                              fee.status === 'pending' ? 'bg-red-100 dark:bg-red-900/50 text-red-700 dark:text-red-300 border-red-200' :
                              fee.status === 'paid' ? 'bg-emerald-100 dark:bg-emerald-900/50 text-emerald-700 dark:text-emerald-300 border-emerald-200' :
                              'bg-background/70 dark:bg-[#05060b]/70 text-foreground/70 dark:text-muted-foreground border-input'
                            }`}>
                              {fee.status === 'pending' ? 'Pendiente' : fee.status === 'paid' ? 'Pagado' : 'Condonado'}
                            </Badge>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                <Separator />

                {/* Payment Schedule */}
                {detailLoan.schedule && detailLoan.schedule.length > 0 && (
                  <div>
                    <h4 className="text-sm font-semibold text-foreground/80 dark:text-foreground/80 mb-2 flex items-center gap-1">
                      <Calendar className="h-4 w-4 text-emerald-500" /> Cronograma de Pagos
                    </h4>
                    <ScrollArea className="max-h-64">
                      <Table>
                        <TableHeader>
                          <TableRow className="bg-emerald-50 dark:bg-emerald-950/50 text-emerald-700 dark:text-emerald-300">
                            <TableHead className="text-xs px-3 py-2">#</TableHead>
                            <TableHead className="text-xs px-3 py-2">Fecha</TableHead>
                            <TableHead className="text-xs px-3 py-2 text-right">Monto</TableHead>
                            <TableHead className="text-xs px-3 py-2">Estado</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {detailLoan.schedule.map((s) => (
                            <TableRow key={s.id} className="hover:bg-background/50 dark:hover:bg-white/10/30 transition-colors">
                              <TableCell className="text-xs font-medium px-3 py-2">{s.installmentNumber}</TableCell>
                              <TableCell className="text-xs px-3 py-2">{formatDate(s.dueDate)}</TableCell>
                              <TableCell className="text-xs font-semibold px-3 py-2 text-right">{formatCurrency(s.amount)}</TableCell>
                              <TableCell className="px-3 py-2">
                                {(() => {
                                  const isOverdue = s.status === 'pending' && new Date(s.dueDate) < new Date(new Date().toDateString());
                                  return (
                                    <Badge variant="outline" className={`text-xs ${
                                      s.status === 'paid'
                                        ? 'bg-emerald-100 dark:bg-emerald-900/50 text-emerald-700 dark:text-emerald-300 border-emerald-200'
                                        : isOverdue
                                          ? 'bg-red-100 dark:bg-red-950/50 text-red-700 dark:text-red-300 border-red-200'
                                          : 'bg-background/70 dark:bg-[#05060b]/70 text-foreground/70 dark:text-muted-foreground border-input'
                                    }`}>
                                      {s.status === 'paid' ? 'Pagado' : isOverdue ? 'No canceló' : 'Pendiente'}
                                    </Badge>
                                  );
                                })()}
                              </TableCell>
                            </TableRow>
                          ))}
                        </TableBody>
                      </Table>
                    </ScrollArea>
                  </div>
                )}

                {/* Recent Payments */}
                {detailLoan.payments && detailLoan.payments.length > 0 && (
                  <div>
                    <h4 className="text-sm font-semibold text-foreground/80 dark:text-foreground/80 mb-2 flex items-center gap-1">
                      <CreditCard className="h-4 w-4 text-teal-500" /> Últimos Pagos
                    </h4>
                    <ScrollArea className="max-h-64">
                      <Table>
                        <TableHeader>
                          <TableRow className="bg-emerald-50 dark:bg-emerald-950/50 text-emerald-700 dark:text-emerald-300">
                            <TableHead className="text-xs px-3 py-2">Fecha</TableHead>
                            <TableHead className="text-xs px-3 py-2 text-right">Monto</TableHead>
                            <TableHead className="text-xs px-3 py-2">Método</TableHead>
                            <TableHead className="text-xs px-3 py-2">Cobrador</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {detailLoan.payments.map((p) => (
                            <TableRow key={p.id} className="hover:bg-background/50 dark:hover:bg-white/10/30 transition-colors">
                              <TableCell className="text-xs whitespace-nowrap px-3 py-2">{formatDateTime(p.paymentDate)}</TableCell>
                              <TableCell className="text-xs font-semibold px-3 py-2 text-right">{formatCurrency(p.amount)}</TableCell>
                              <TableCell className="px-3 py-2">
                                <Badge variant="outline" className="text-xs bg-emerald-50 dark:bg-emerald-950/30 text-emerald-700 dark:text-emerald-300 border-emerald-200">
                                  {PAYMENT_METHOD_LABELS[p.paymentMethod] || p.paymentMethod}
                                </Badge>
                              </TableCell>
                              <TableCell className="text-xs text-muted-foreground dark:text-muted-foreground px-3 py-2">
                                {p.collector?.name || '—'}
                              </TableCell>
                            </TableRow>
                          ))}
                        </TableBody>
                      </Table>
                    </ScrollArea>
                  </div>
                )}

                {/* Actions */}
                {(detailLoan.status === 'active' || detailLoan.status === 'mora') && (
                  <>
                    <Separator />
                    <div className="space-y-2">
                      {/* Primary action - Cobrar */}
                      <Button
                        className="relative w-full bg-gradient-to-r from-emerald-600 via-emerald-500 to-teal-500 hover:from-emerald-500 hover:via-emerald-400 hover:to-teal-400 text-white border-0 shadow-lg shadow-emerald-600/30 hover:shadow-emerald-500/50 transition-all duration-300 h-11 overflow-hidden group"
                        onClick={() => {
                          setDetailOpen(false);
                          setPaySelectedInstallments([]);
                          setPayAmount('');
                          setPayMethod('cash');
                          setPayObservation('');
                          setPayProofFileBase64('');
                          setPayProofPreview('');
                          setPayCashReceived('');
                          setPayQrDataUrl('');
                          fetch('/api/payment-settings').then(r => r.ok && r.json()).then(d => { if (d) setPaySettings(d); }).catch(() => {});
                          setPayOpen(true);
                        }}
                      >
                        <span className="absolute inset-0 bg-gradient-to-r from-transparent via-white/20 to-transparent -translate-x-full group-hover:translate-x-full transition-all duration-700" />
                        <DollarSign className="h-5 w-5 mr-2" />
                        <span className="relative">Cobrar</span>
                      </Button>
                      {/* Secondary actions grid */}
                      <div className="grid grid-cols-2 gap-2">
                        <Button
                          variant="outline"
                          className="border-emerald-500/20 text-emerald-400 hover:text-emerald-300 hover:bg-emerald-500/10 hover:border-emerald-500/40 h-10 transition-all duration-200"
                          onClick={() => handleRecordar(detailLoan)}
                        >
                          <Bell className="h-4 w-4 mr-2" />
                          Recordar
                        </Button>
                        <Button
                          variant="outline"
                          className="border-emerald-500/20 text-emerald-400 hover:text-emerald-300 hover:bg-emerald-500/10 hover:border-emerald-500/40 h-10 transition-all duration-200"
                          onClick={() => { setSelectedLoanId(detailLoan.id); setScheduleOpen(true); }}
                        >
                          <Calendar className="h-4 w-4 mr-2 text-emerald-500" />
                          Cronograma
                        </Button>
                        <Button
                          variant="outline"
                          className="border-emerald-200 dark:border-emerald-800 text-emerald-700 dark:text-emerald-300 hover:bg-emerald-50 dark:hover:bg-emerald-950 h-10"
                          onClick={() => { setSelectedLoanId(detailLoan.id); setLinksOpen(true); }}
                        >
                          <Link2 className="h-4 w-4 mr-2 text-amber-500" />
                          Links Pago
                        </Button>
                        <Button
                          variant="outline"
                          className="border-red-200 dark:border-red-900 text-red-700 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-950 h-10"
                          onClick={() => { setSelectedLoanId(detailLoan.id); setChargeOffOpen(true); }}
                        >
                          <AlertTriangle className="h-4 w-4 mr-2 text-red-500" />
                          Castigar
                        </Button>
                      </div>
                      {/* Admin actions */}
                      {isAdmin && (
                        <div className="grid grid-cols-2 gap-2">
                          <Button
                            variant="outline"
                            className="border-amber-200 dark:border-amber-900 text-amber-700 dark:text-amber-400 hover:bg-amber-50 dark:hover:bg-amber-950 h-10"
                            onClick={() => { setRefinanceOpen(true); setRefinanceNewAmount(String(detailLoan.amount)); setRefinanceNewDays(String(detailLoan.days)); setRefinanceReason(''); }}
                          >
                            <RefreshCw className="h-4 w-4 mr-2" />
                            Refinanciar
                          </Button>
                          <Button
                            variant="destructive"
                            className="h-10"
                            onClick={() => {
                              setCancelLoanId(detailLoan.id);
                              setDetailOpen(false);
                            }}
                          >
                            <XCircle className="h-4 w-4 mr-2" />
                            Cancelar
                          </Button>
                        </div>
                      )}
                    </div>
                  </>
                )}
                {(detailLoan.status === 'completed' || detailLoan.status === 'paid') && (
                  <>
                    <Separator />
                    <div className="flex items-center gap-2">
                      <Button
                        className="flex-1 bg-emerald-600 hover:bg-emerald-700 text-white border-0"
                        onClick={() => {
                          setDetailOpen(false);
                          setTimeout(() => {
                            resetCreateForm();
                            setSelectedClientId(detailLoan.client.id);
                            setLoanAmount(String(detailLoan.amount));
                            setLoanDays(String(detailLoan.days));
                            setPaymentFrequency(detailLoan.paymentFrequency);
                            setCollectorId(detailLoan.collector?.id || '');
                            setZoneId(detailLoan.zone?.id || '');
                            setCreateStep(2);
                            setCreateOpen(true);
                          }, 300);
                        }}
                      >
                        <RefreshCw className="h-4 w-4 mr-2" />
                        Renovar
                      </Button>
                      {isAdmin && (
                        <Button
                          variant="destructive"
                          onClick={() => {
                            setDeleteLoanId(detailLoan.id);
                            setDetailOpen(false);
                          }}
                        >
                          <Trash2 className="h-4 w-4 mr-2" />
                          Eliminar
                        </Button>
                      )}
                    </div>
                  </>
                )}
                {isAdmin && detailLoan.status === 'cancelled' && (
                  <>
                    <Separator />
                    <div className="flex items-center gap-2">
                      <Button
                        variant="destructive"
                        className="flex-1"
                        onClick={() => {
                          setDeleteLoanId(detailLoan.id);
                          setDetailOpen(false);
                        }}
                      >
                        <Trash2 className="h-4 w-4 mr-2" />
                        Eliminar Préstamo
                      </Button>
                    </div>
                  </>
                )}
              </div>
            </>
          )}
        </SheetContent>
      </Sheet>

      {/* ============================================================ */}
      {/* LOAN CHARGE OFF DIALOG */}
      {/* ============================================================ */}
      <LoanChargeOffDialog open={chargeOffOpen} onOpenChange={setChargeOffOpen} loanId={selectedLoanId} clientName={detailLoan?.client?.name || ''} />

      {/* ============================================================ */}
      {/* PAYMENT SCHEDULE VIEW */}
      {/* ============================================================ */}
      <PaymentScheduleView open={scheduleOpen} onOpenChange={setScheduleOpen} loanId={selectedLoanId} loanAmount={detailLoan?.totalAmount} numInstallments={detailLoan?.numCuotas} />

      {/* ============================================================ */}
      {/* PAYMENT LINKS PANEL */}
      {/* ============================================================ */}
      <PaymentLinksPanel loanId={selectedLoanId} clientId={detailLoan?.clientId || null} />

      {/* ============================================================ */}
      {/* REFINANCE DIALOG */}
      {/* ============================================================ */}
      <Dialog open={refinanceOpen} onOpenChange={setRefinanceOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-amber-700 dark:text-amber-300">
              <RefreshCw className="h-5 w-5" />
              Refinanciar Préstamo
            </DialogTitle>
            <DialogDescription>
              Complete los datos para refinanciar el préstamo de {detailLoan?.client?.name || ''}.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div>
              <Label>Nuevo Monto (S/)</Label>
              <Input
                type="number"
                value={refinanceNewAmount}
                onChange={(e) => setRefinanceNewAmount(e.target.value)}
                placeholder="0.00"
              />
            </div>
            <div>
              <Label>Nuevos Días</Label>
              <Input
                type="number"
                value={refinanceNewDays}
                onChange={(e) => setRefinanceNewDays(e.target.value)}
                placeholder="24"
              />
            </div>
            <div>
              <Label>Motivo de Refinanciamiento</Label>
              <Textarea
                value={refinanceReason}
                onChange={(e) => setRefinanceReason(e.target.value)}
                placeholder="Ingrese el motivo..."
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" className="border-emerald-200 dark:border-emerald-800 text-emerald-700 dark:text-emerald-300 hover:bg-emerald-50 dark:hover:bg-emerald-950" onClick={() => setRefinanceOpen(false)} disabled={refinancing}>
              Cancelar
            </Button>
            <Button
              className="bg-amber-600 hover:bg-amber-700 text-white border-0 shadow-lg shadow-amber-600/25 hover:shadow-amber-600/40 transition-all"
              onClick={handleRefinance}
              disabled={!refinanceReason || refinancing}
            >
              {refinancing ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <RefreshCw className="h-4 w-4 mr-2" />}
              Refinanciar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ============================================================ */}
      {/* CANCEL CONFIRMATION DIALOG */}
      {/* ============================================================ */}
      <Dialog open={!!cancelLoanId} onOpenChange={(open) => { if (!open) setCancelLoanId(null); }}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-red-700 dark:text-red-300">
              <AlertTriangle className="h-5 w-5" />
              Confirmar Cancelación
            </DialogTitle>
            <DialogDescription>
              ¿Está seguro que desea cancelar este préstamo? Esta acción no se puede deshacer. El monto pendiente será devuelto al capital.
            </DialogDescription>
            <div className="space-y-2">
              <label className="text-sm font-medium">Motivo de cancelación</label>
              <textarea
                className="w-full min-h-[80px] rounded-md border border-input bg-background px-3 py-2 text-sm placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring"
                placeholder="Ingrese el motivo de la cancelación..."
                value={cancelReason}
                onChange={(e) => setCancelReason(e.target.value)}
              />
            </div>
          </DialogHeader>
          <DialogFooter className="flex items-center gap-2 sm:gap-2">
            <Button variant="outline" className="border-emerald-200 dark:border-emerald-800 text-emerald-700 dark:text-emerald-300 hover:bg-emerald-50 dark:hover:bg-emerald-950" onClick={() => { setCancelLoanId(null); setCancelReason(''); }} disabled={cancelling}>
              No, volver
            </Button>
            <Button variant="destructive" className="shadow-lg shadow-red-600/25 hover:shadow-red-600/40" onClick={handleCancelLoan} disabled={cancelling}>
              {cancelling ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <XCircle className="h-4 w-4 mr-2" />}
              Sí, cancelar préstamo
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ============================================================ */}
      {/* DELETE CONFIRMATION DIALOG */}
      {/* ============================================================ */}
      <Dialog open={!!deleteLoanId} onOpenChange={(open) => { if (!open) setDeleteLoanId(null); }}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-red-700 dark:text-red-300">
              <AlertTriangle className="h-5 w-5" />
              Eliminar Préstamo
            </DialogTitle>
            <DialogDescription>
              ¿Está seguro que desea eliminar este préstamo permanentemente? Esta acción no se puede deshacer.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter className="flex items-center gap-2 sm:gap-2">
            <Button variant="outline" className="border-emerald-200 dark:border-emerald-800 text-emerald-700 dark:text-emerald-300 hover:bg-emerald-50 dark:hover:bg-emerald-950" onClick={() => setDeleteLoanId(null)} disabled={deleting}>
              No, volver
            </Button>
            <Button variant="destructive" className="shadow-lg shadow-red-600/25 hover:shadow-red-600/40" onClick={handleDeleteLoan} disabled={deleting}>
              {deleting ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Trash2 className="h-4 w-4 mr-2" />}
              Sí, eliminar préstamo
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ============================================================ */}
      {/* PAYMENT DIALOG */}
      {/* ============================================================ */}
      <Dialog open={payOpen} onOpenChange={(open) => { if (!open) { setPayOpen(false); } }}>
        <DialogContent className="max-w-lg max-h-[90dvh] flex flex-col p-0">
          <DialogHeader className="px-6 pt-6 pb-3 shrink-0">
            <DialogTitle className="text-lg flex items-center gap-2">
              <DollarSign className="h-5 w-5 text-emerald-500" />
              Registrar Cobro
            </DialogTitle>
            <DialogDescription>
              {detailLoan ? `Préstamo de ${detailLoan.client?.name || ''} — ${formatCurrency(detailLoan.amount)}` : ''}
            </DialogDescription>
          </DialogHeader>

          <div className="px-6 pb-4 overflow-y-auto space-y-5">
            {/* Loan summary */}
            {detailLoan && (
              <div className="grid grid-cols-3 gap-3 p-3 rounded-xl bg-background/50 dark:bg-[#05060b]/70 border border-input/50 dark:border-emerald-500/10">
                <div>
                  <p className="text-xs text-muted-foreground dark:text-muted-foreground">Monto</p>
                  <p className="text-sm font-bold text-foreground dark:text-foreground">{formatCurrency(detailLoan.amount)}</p>
                </div>
                <div>
                  <p className="text-xs text-muted-foreground dark:text-muted-foreground">Diario</p>
                  <p className="text-sm font-bold text-emerald-600 dark:text-emerald-300">{formatCurrency(detailLoan.dailyPayment)}</p>
                </div>
                <div>
                  <p className="text-xs text-muted-foreground dark:text-muted-foreground">Restante</p>
                  <p className="text-sm font-bold text-amber-600 dark:text-amber-300">{formatCurrency(detailLoan.remaining)}</p>
                </div>
              </div>
            )}

            {/* Installments */}
            <div>
              <Label className="text-sm font-semibold text-foreground/80 dark:text-foreground/80">Seleccionar Cuota(s)</Label>
              <p className="text-xs text-muted-foreground mt-0.5 mb-1">Seleccione una o más cuotas a cancelar</p>
              <ScrollArea className="max-h-48 mt-1">
                <div className="space-y-1.5">
                  {detailLoan?.schedule?.filter(s => s.status === 'pending').map(s => {
                    const selected = paySelectedInstallments.includes(s.id);
                    return (
                      <button
                        key={s.id}
                        type="button"
                        onClick={() => {
                          let newSelected: string[];
                          if (selected) {
                            newSelected = paySelectedInstallments.filter(id => id !== s.id);
                          } else {
                            newSelected = [...paySelectedInstallments, s.id];
                          }
                          setPaySelectedInstallments(newSelected);
                          const totalAmount = newSelected.reduce((sum, id) => {
                            const inst = detailLoan?.schedule?.find(sch => sch.id === id);
                            return sum + (inst ? inst.amount : 0);
                          }, 0);
                          setPayAmount(totalAmount.toString());
                        }}
                        className={`w-full flex items-center justify-between p-2.5 rounded-lg text-sm border transition-colors ${
                          selected
                            ? 'bg-emerald-50 dark:bg-emerald-950/50 border-emerald-300 text-emerald-700 dark:text-emerald-300 ring-2 ring-emerald-300'
                            : 'bg-white dark:bg-[#05060b]/80 border-input text-foreground/70 dark:text-muted-foreground hover:border-emerald-200'
                        }`}
                      >
                        <div className="flex items-center gap-2">
                          <div className={`w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold ${
                            selected
                              ? 'bg-emerald-500 text-white'
                              : 'bg-background/70 dark:bg-[#05060b]/70 text-muted-foreground'
                          }`}>
                            {selected ? '✓' : s.installmentNumber}
                          </div>
                          <div className="text-left">
                            <p className="text-xs text-muted-foreground">{formatDate(s.dueDate)}</p>
                          </div>
                        </div>
                        <span className="font-semibold">{formatCurrency(s.amount)}</span>
                      </button>
                    );
                  })}
                  {(!detailLoan?.schedule || detailLoan.schedule.filter(s => s.status === 'pending').length === 0) && (
                    <p className="text-sm text-muted-foreground text-center py-4">No hay cuotas pendientes</p>
                  )}
                </div>
              </ScrollArea>
            </div>

            {/* Amount */}
            {paySelectedInstallments.length > 0 && (
              <div className="mt-6 text-center">
                <div className="relative inline-block">
                  <div className="absolute inset-0 bg-gradient-to-r from-emerald-500/20 via-teal-500/20 to-emerald-500/20 rounded-2xl blur-xl animate-pulse" />
                  <div className="relative bg-gradient-to-br from-[#05060b]/90 to-[#05060b]/70 backdrop-blur-2xl border border-emerald-500/20 rounded-2xl px-8 py-5 shadow-[0_0_40px_rgba(16,185,129,0.15)]">
                    <p className="text-xs font-medium text-emerald-400/80 uppercase tracking-[0.2em] mb-1">Total a Cobrar</p>
                    <p className="text-3xl font-black bg-gradient-to-r from-emerald-400 via-teal-300 to-emerald-400 bg-clip-text text-transparent drop-shadow-[0_0_12px_rgba(16,185,129,0.5)]">{formatCurrency(parseFloat(payAmount) || 0)}</p>
                    <p className="text-xs text-emerald-400/60 mt-1">{paySelectedInstallments.length} cuota(s) seleccionada(s)</p>
                  </div>
                </div>
              </div>
            )}

            {/* Payment Method */}
            <div className="mt-10">
              <Label className="text-sm font-semibold text-foreground/80 dark:text-foreground/80">Método de Pago</Label>
              <RadioGroup value={payMethod} onValueChange={setPayMethod} className="flex gap-2 mt-2">
                {PAYMENT_METHODS.map((method) => {
                  const Icon = method.icon;
                  return (
                    <Label
                      key={method.value}
                      className={`flex-1 flex flex-col items-center gap-1.5 p-3 rounded-xl border cursor-pointer transition-all ${
                        payMethod === method.value
                          ? `ring-2 ring-emerald-300 ${method.bg}`
                          : 'bg-white dark:bg-[#05060b]/80 border-input hover:border-emerald-200'
                      }`}
                    >
                      <input type="radio" name="payMethod" value={method.value} checked={payMethod === method.value} onChange={() => setPayMethod(method.value)} className="sr-only" />
                      <Icon className={`h-5 w-5 ${method.color}`} />
                      <span className="text-xs font-medium text-foreground/80 dark:text-foreground/80">{method.label}</span>
                    </Label>
                  );
                })}
              </RadioGroup>
            </div>

            {/* Cash: Received amount + photo */}
            {payMethod === 'cash' && (
              <div className="space-y-3">
                <div>
                  <Label className="text-sm font-semibold text-foreground/80 dark:text-foreground/80">Monto Recibido</Label>
                  <div className="relative mt-1.5">
                    <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground font-medium">S/</span>
                    <Input
                      type="number"
                      step="0.01"
                      min="0"
                      value={payCashReceived}
                      onChange={(e) => {
                        const val = e.target.value;
                        if (val === '' || parseFloat(val) >= 0) setPayCashReceived(val);
                      }}
                      placeholder="0.00"
                      className="pl-8 bg-white dark:bg-[#05060b]/80 border-input"
                    />
                  </div>
                </div>
                {payCashReceived && parseFloat(payCashReceived) > parseFloat(payAmount) && (
                  <p className="text-xs text-emerald-600 dark:text-emerald-400">
                    Vuelto: {formatCurrency(parseFloat(payCashReceived) - parseFloat(payAmount))}
                  </p>
                )}
                <div>
                  <Label className="text-sm font-semibold text-foreground/80 dark:text-foreground/80">Foto del Comprobante</Label>
                  <Button
                    variant="outline"
                    size="sm"
                    className="mt-1.5 border-input"
                    onClick={() => {
                      const input = document.createElement('input');
                      input.type = 'file';
                      input.accept = 'image/*';
                      input.capture = 'environment';
                      input.onchange = (e) => {
                        const file = (e.target as HTMLInputElement).files?.[0];
                        if (file) {
                          const reader = new FileReader();
                          reader.onload = (ev) => {
                            const result = ev.target?.result as string;
                            setPayProofFileBase64(result);
                            setPayProofPreview(result);
                          };
                          reader.readAsDataURL(file);
                        }
                      };
                      input.click();
                    }}
                  >
                    <Upload className="h-4 w-4 mr-2" />
                    {payProofPreview ? 'Cambiar Foto' : 'Tomar Foto'}
                  </Button>
                  {payProofPreview && (
                    <img src={payProofPreview} alt="Comprobante" className="mt-2 w-full max-h-32 object-contain rounded-lg border" />
                  )}
                </div>
              </div>
            )}

            {/* Plin: QR + phone + WhatsApp */}
            {payMethod === 'plin' && (
              <div className="space-y-4 p-4 rounded-xl bg-sky-50 dark:bg-sky-950/50 border border-sky-200">
                <p className="text-sm font-semibold text-sky-800 dark:text-sky-200">Pagar con Plin</p>
                {paySettings.payment_qr_plin && (
                  <div className="flex flex-col items-center gap-2">
                    <img src={paySettings.payment_qr_plin} alt="QR Plin" className="w-48 h-48 object-contain rounded-xl bg-white dark:bg-[#05060b]/80 p-2 shadow-sm" />
                    <p className="text-xs text-sky-600 dark:text-sky-300 font-medium">
                      Plin - S/{parseFloat(payAmount || '0').toFixed(2)}
                    </p>
                  </div>
                )}
                {paySettings.payment_phone_plin && (
                  <p className="text-xs text-muted-foreground dark:text-muted-foreground text-center">
                    Número: <a href={`tel:${paySettings.payment_phone_plin}`} className="font-medium text-sky-600 dark:text-sky-300 hover:underline">{paySettings.payment_phone_plin}</a> a nombre de <strong>Keysy Otero Cañola</strong>
                  </p>
                )}
                {detailLoan?.client.phone && (
                  <Button
                    variant="outline"
                    size="sm"
                    className="w-full border-sky-200 text-sky-600 dark:text-sky-300 hover:bg-sky-100 dark:hover:bg-sky-900/50 text-xs"
                    onClick={() => {
                      const phone = detailLoan.client.phone.replace(/[^0-9]/g, '');
                      const fullPhone = phone.startsWith('51') ? phone : `51${phone}`;
                      const msg = `*Plin - KC Cobranzas*\n\nMonto: S/${parseFloat(payAmount || '0').toFixed(2)}\nCliente: ${detailLoan.client.name}\nNúmero: ${paySettings.payment_phone_plin || '951959763'}\nA nombre de: Keysy Otero Cañola\n\nAdjunto el comprobante del pago.`;
                      window.open(`https://wa.me/${fullPhone}?text=${encodeURIComponent(msg)}`, '_blank');
                    }}
                  >
                    <Send className="h-3.5 w-3.5 mr-1" />
                    Enviar por WhatsApp
                  </Button>
                )}
                <div>
                  <Label className="text-xs font-semibold text-sky-800 dark:text-sky-200">Subir Comprobante</Label>
                  <div className="mt-1.5 flex items-center gap-3">
                    <label className="flex items-center gap-2 px-3 py-2.5 rounded-lg border border-sky-200 bg-white dark:bg-[#05060b]/80 cursor-pointer hover:bg-sky-50 dark:hover:bg-sky-950/50 text-xs text-sky-700 dark:text-sky-300">
                      <Upload className="h-4 w-4" />
                      {payProofPreview ? 'Cambiar foto' : 'Tomar foto'}
                      <input
                        type="file"
                        accept="image/*"
                        capture="environment"
                        onChange={(e) => {
                          const file = e.target.files?.[0];
                          if (file) {
                            const reader = new FileReader();
                            reader.onload = (ev) => {
                              const result = ev.target?.result as string;
                              setPayProofFileBase64(result);
                              setPayProofPreview(result);
                            };
                            reader.readAsDataURL(file);
                          }
                        }}
                        className="hidden"
                      />
                    </label>
                    {payProofFileBase64 && (
                      <button
                        className="text-xs text-red-500 hover:text-red-700 dark:text-red-300"
                        onClick={() => { setPayProofFileBase64(''); setPayProofPreview(''); }}
                      >
                        Eliminar
                      </button>
                    )}
                  </div>
                  {payProofPreview && (
                    <div className="mt-2">
                      <img src={payProofPreview} alt="Comprobante" className="w-full max-h-40 object-contain rounded-lg border border-sky-200 bg-white dark:bg-[#05060b]/80" />
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* Transfer: Bank data + WhatsApp */}
            {payMethod === 'transfer' && (
              <div className="space-y-4 p-4 rounded-xl bg-teal-50 dark:bg-teal-950/50 border border-teal-200">
                <p className="text-sm font-semibold text-teal-800 dark:text-teal-200">Transferencia Bancaria</p>
                <div className="text-xs text-teal-600 dark:text-teal-400 space-y-1">
                  {paySettings.payment_bank_name && (
                    <div className="p-2.5 rounded-lg bg-white dark:bg-[#05060b]/80 border border-teal-200">
                      <p className="text-sm font-semibold text-slate-800 dark:text-foreground">{paySettings.payment_bank_name}</p>
                      {paySettings.payment_bank_cuenta && (
                        <p className="text-xs text-muted-foreground dark:text-muted-foreground font-mono">Cuenta Ahorro: <span className="select-all cursor-pointer hover:text-teal-600">{paySettings.payment_bank_cuenta}</span></p>
                      )}
                      {paySettings.payment_bank_cci && (
                        <p className="text-xs text-muted-foreground dark:text-muted-foreground font-mono">CCI: <span className="select-all cursor-pointer hover:text-teal-600">{paySettings.payment_bank_cci}</span></p>
                      )}
                      <p className="text-xs text-muted-foreground dark:text-muted-foreground mt-1">A nombre de <strong>Keysy Otero Cañola</strong></p>
                    </div>
                  )}
                </div>
                {detailLoan?.client.phone && (
                  <Button
                    variant="outline"
                    size="sm"
                    className="w-full border-teal-200 text-teal-600 dark:text-teal-300 hover:bg-teal-100 dark:hover:bg-teal-900/50 text-xs"
                    onClick={() => {
                      const phone = detailLoan.client.phone.replace(/[^0-9]/g, '');
                      const fullPhone = phone.startsWith('51') ? phone : `51${phone}`;
                      const msg = `*Transferencia Bancaria - KC Cobranzas*\n\nMonto: S/${parseFloat(payAmount || '0').toFixed(2)}\nCliente: ${detailLoan.client.name}\n\nDatos bancarios:\n• Banco: ${paySettings.payment_bank_name || 'Interbank'}\n• CCI: ${paySettings.payment_bank_cci || ''}\n• Cuenta Ahorro: ${paySettings.payment_bank_cuenta || ''}\nA nombre de: Keysy Otero Cañola\n\nAdjunto el comprobante de la transferencia.`;
                      window.open(`https://wa.me/${fullPhone}?text=${encodeURIComponent(msg)}`, '_blank');
                    }}
                  >
                    <Send className="h-3.5 w-3.5 mr-1" />
                    Enviar datos por WhatsApp
                  </Button>
                )}
                <div>
                  <Label className="text-xs font-semibold text-teal-800 dark:text-teal-200">Subir Comprobante</Label>
                  <div className="mt-1.5 flex items-center gap-3">
                    <label className="flex items-center gap-2 px-3 py-2.5 rounded-lg border border-teal-200 bg-white dark:bg-[#05060b]/80 cursor-pointer hover:bg-teal-50 dark:hover:bg-teal-950/50 text-xs text-teal-700 dark:text-teal-300">
                      <Upload className="h-4 w-4" />
                      {payProofPreview ? 'Cambiar foto' : 'Tomar foto'}
                      <input
                        type="file"
                        accept="image/*"
                        capture="environment"
                        onChange={(e) => {
                          const file = e.target.files?.[0];
                          if (file) {
                            const reader = new FileReader();
                            reader.onload = (ev) => {
                              const result = ev.target?.result as string;
                              setPayProofFileBase64(result);
                              setPayProofPreview(result);
                            };
                            reader.readAsDataURL(file);
                          }
                        }}
                        className="hidden"
                      />
                    </label>
                    {payProofFileBase64 && (
                      <button
                        className="text-xs text-red-500 hover:text-red-700 dark:text-red-300"
                        onClick={() => { setPayProofFileBase64(''); setPayProofPreview(''); }}
                      >
                        Eliminar
                      </button>
                    )}
                  </div>
                  {payProofPreview && (
                    <div className="mt-2">
                      <img src={payProofPreview} alt="Comprobante" className="w-full max-h-40 object-contain rounded-lg border border-teal-200 bg-white dark:bg-[#05060b]/80" />
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* Collector */}
            <div className="mt-6">
              <Label className="text-sm font-semibold text-foreground/80 dark:text-foreground/80">Cobrador</Label>
              <div className="mt-1.5 p-2.5 rounded-lg bg-background/50 dark:bg-[#05060b]/70 border border-input dark:border-emerald-500/5 text-sm font-medium text-foreground/80 dark:text-foreground/80 flex items-center gap-2">
                <User className="h-4 w-4 text-muted-foreground" />
                {user?.name || 'Cobrador'}
              </div>
            </div>

            {/* Observation */}
            <div className="mt-6">
              <Label className="text-sm font-semibold text-foreground/80 dark:text-foreground/80">Observación</Label>
              <Textarea
                value={payObservation}
                onChange={(e) => setPayObservation(e.target.value)}
                placeholder="Observación opcional..."
                className="mt-1.5 bg-white dark:bg-[#05060b]/80 border-input resize-none"
                rows={2}
              />
            </div>
          </div>

          {/* Footer */}
          <DialogFooter className="px-6 py-4 border-t border-input/50 dark:border-emerald-500/10 bg-background/50/50 dark:bg-[#05060b]/70 shrink-0">
            <div className="flex items-center justify-between w-full">
              <p className="text-sm text-muted-foreground">
                Total: <strong className="text-emerald-600 dark:text-emerald-300">{payAmount ? formatCurrency(parseFloat(payAmount)) : '—'}</strong>
              </p>
              <div className="flex items-center gap-2">
                <Button variant="outline" className="border-emerald-200 dark:border-emerald-800 text-emerald-700 dark:text-emerald-300 hover:bg-emerald-50 dark:hover:bg-emerald-950" onClick={() => { setPayOpen(false); }} disabled={payRegistering}>
                  Cancelar
                </Button>
                <Button
                  className="relative bg-gradient-to-r from-emerald-600 via-emerald-500 to-teal-500 hover:from-emerald-500 hover:via-emerald-400 hover:to-teal-400 text-white border-0 shadow-lg shadow-emerald-600/30 hover:shadow-emerald-500/50 transition-all duration-300 overflow-hidden group"
                  onClick={handlePayRegister}
                  disabled={paySelectedInstallments.length === 0 || !payAmount || payRegistering}
                >
                  <span className="absolute inset-0 bg-gradient-to-r from-transparent via-white/20 to-transparent -translate-x-full group-hover:translate-x-full transition-all duration-700" />
                  {payRegistering ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <DollarSign className="h-4 w-4 mr-2" />}
                  <span className="relative">Registrar Cobro</span>
                </Button>
              </div>
            </div>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
