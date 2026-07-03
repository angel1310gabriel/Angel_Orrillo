'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { Users, Shield, Eye, UserCheck, Search, RefreshCw, Loader2, CheckCircle2, XCircle, User, Mail, Phone, MapPin, Trash2, UserPlus, KeyRound, IdCard, Globe, AlertTriangle, DollarSign, Wallet } from 'lucide-react';
import CollectorExpensesPanel from './collector-expenses-panel';
import CollectorLocationsMap from './collector-locations-map';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Switch } from '@/components/ui/switch';
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription } from '@/components/ui/sheet';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { useToast } from '@/hooks/use-toast';
import { useAuth } from '@/hooks/use-auth';

interface StaffMember {
  id: string; name: string | null; email: string; phone: string | null;
  address: string | null; role: string; isActive: boolean; documentType: string;
  documentNumber: string | null; photoUrl: string | null; createdAt: string;
  zoneIds: string[]; dailyGoal: number | null;
  _count: { loans: number; payments: number };
}

interface Zone {
  id: string;
  name: string;
}
interface VerifyResult {
  verified: boolean; documentType: string; documentNumber: string; found: boolean;
  results: { clients: Array<{ id: string; name: string; phone: string; documentType: string; documentNumber: string; zone: string | null; creditScore: number | null; hasActiveLoans: boolean }>; staff: Array<{ id: string; name: string; phone: string; role: string; isActive: boolean }> };
}
interface Props { refreshTrigger?: number }

const DOC_TYPES = [
  { value: 'dni', label: 'DNI', digits: 8, icon: IdCard },
  { value: 'carnet_extranjeria', label: 'Carnet Ext.', digits: 9, icon: Globe },
  { value: 'pasaporte', label: 'Pasaporte', digits: 9, icon: Globe },
] as const;

const ROLES = [
  { value: 'admin', label: 'Admin', desc: 'Acceso total al sistema', color: 'red', icon: Shield },
  { value: 'supervisor', label: 'Supervisor', desc: 'Supervisa cobradores', color: 'amber', icon: Eye },
  { value: 'collector', label: 'Cobrador', desc: 'Cobros diarios y pagos', color: 'emerald', icon: UserCheck },
] as const;

const RS: Record<string, { c: string; l: string }> = {
  admin: { c: 'bg-red-100 dark:bg-red-900/50 text-red-800 dark:text-red-200 border-red-200', l: 'Admin' },
  supervisor: { c: 'bg-amber-100 dark:bg-amber-900/50 text-amber-800 dark:text-amber-200 border-amber-200', l: 'Supervisor' },
  collector: { c: 'bg-emerald-100 dark:bg-emerald-900/50 text-emerald-800 dark:text-emerald-200 border-emerald-200', l: 'Cobrador' },
};
const DS: Record<string, { c: string; l: string }> = {
  dni: { c: 'bg-blue-50 dark:bg-blue-950/50 text-blue-700 dark:text-blue-300 border-blue-200', l: 'DNI' },
  carnet_extranjeria: { c: 'bg-purple-50 dark:bg-purple-950/50 text-purple-700 dark:text-purple-300 border-purple-200', l: 'CE' },
  pasaporte: { c: 'bg-orange-50 dark:bg-orange-950/50 text-orange-700 dark:text-orange-300 border-orange-200', l: 'PAS' },
};
const RI: Record<string, React.ComponentType<{ className?: string }>> = { admin: Shield, supervisor: Eye, collector: UserCheck };
const RC: Record<string, { s: string; u: string; ib: string; ic: string; ck: string; lb: string }> = {
  red: { s: 'border-red-300 bg-red-50/80 dark:bg-red-950/30 ring-2 ring-red-100', u: 'border-input bg-white dark:bg-[#05060b]/80 hover:border-red-200 hover:bg-red-50/30 dark:hover:bg-red-950/30', ib: 'bg-red-100 dark:bg-red-900/50', ic: 'text-red-600 dark:text-red-300', ck: 'text-red-500', lb: 'text-red-700 dark:text-red-300' },
  amber: { s: 'border-amber-300 bg-amber-50/80 dark:bg-amber-950/30 ring-2 ring-amber-100', u: 'border-input bg-white dark:bg-[#05060b]/80 hover:border-amber-200 hover:bg-amber-50/30 dark:hover:bg-amber-950/30', ib: 'bg-amber-100 dark:bg-amber-900/50', ic: 'text-amber-600 dark:text-amber-300', ck: 'text-amber-500', lb: 'text-amber-700 dark:text-amber-300' },
  emerald: { s: 'border-emerald-300 bg-emerald-50/80 dark:bg-emerald-950/30 ring-2 ring-emerald-100', u: 'border-input bg-white dark:bg-[#05060b]/80 hover:border-emerald-200 hover:bg-emerald-50/30 dark:hover:bg-emerald-950/30', ib: 'bg-emerald-100 dark:bg-emerald-900/50', ic: 'text-emerald-600 dark:text-emerald-300', ck: 'text-emerald-500', lb: 'text-emerald-700 dark:text-emerald-300' },
};

const vb = (v: string, ok: boolean) => v ? (ok ? 'border-emerald-300 focus-visible:ring-emerald-200' : 'border-red-300 focus-visible:ring-red-200') : 'border-input';
const STAT_CARDS = [
  { k: 'total', label: 'Total Personal', g: 'from-emerald-500 to-emerald-600', tc: 'text-emerald-100', Icon: Users, ic: 'text-emerald-200' },
  { k: 'collector', label: 'Cobradores', g: 'from-teal-500 to-teal-600', tc: 'text-teal-100', Icon: UserCheck, ic: 'text-teal-200' },
  { k: 'supervisor', label: 'Supervisores', g: 'from-amber-500 to-amber-600', tc: 'text-amber-100', Icon: Eye, ic: 'text-amber-200' },
  { k: 'admin', label: 'Admins', g: 'from-red-500 to-red-600', tc: 'text-red-100', Icon: Shield, ic: 'text-red-200' },
];

function VInput({ value, valid, ...p }: { value: string; valid: boolean } & React.ComponentProps<typeof Input>) {
  return <div className="relative"><Input value={value} className={`pr-10 bg-white dark:bg-[#05060b]/80 ${vb(value, valid)}`} {...p} />{value.length > 0 && <div className="absolute right-3 top-1/2 -translate-y-1/2">{valid ? <CheckCircle2 className="h-4 w-4 text-emerald-500" /> : <XCircle className="h-4 w-4 text-red-400" />}</div>}</div>;
}

export default function CollectorsTab({ refreshTrigger }: Props) {
  const { toast } = useToast();
  const { user } = useAuth();
  const isAdmin = user?.role === 'admin';
  const [staff, setStaff] = useState<StaffMember[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [regOpen, setRegOpen] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [fDT, setFDT] = useState('dni'), [fDN, setFDN] = useState(''), [fN, setFN] = useState(''), [fE, setFE] = useState('');
  const [fPh, setFPh] = useState(''), [fAd, setFAd] = useState(''), [fDailyGoal, setFDailyGoal] = useState(''), [fR, setFR] = useState('collector'), [fPw, setFPw] = useState('');
  const [phOk, setPhOk] = useState(false);
  const [vDoc, setVDoc] = useState(false), [dOk, setDOk] = useState(false), [dRes, setDRes] = useState<VerifyResult | null>(null);
  const [vPh, setVPh] = useState(false);
  const [sel, setSel] = useState<StaffMember | null>(null), [detOpen, setDetOpen] = useState(false), [expensesOpen, setExpensesOpen] = useState(false), [locationsOpen, setLocationsOpen] = useState(false);
  const [toggling, setToggling] = useState<string | null>(null), [deleting, setDeleting] = useState<string | null>(null);
  const [allZones, setAllZones] = useState<Zone[]>([]);
  const [selectedZoneIds, setSelectedZoneIds] = useState<string[]>([]);
  const [savingZones, setSavingZones] = useState(false);

  const maxDig = DOC_TYPES.find(d => d.value === fDT)?.digits ?? 8;
  const docOk = fDN.length === maxDig && /^\d+$/.test(fDN);
  const phOk_ = /^9\d{8}$/.test(fPh), emOk = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(fE), nmOk = fN.trim().length >= 2, pwOk = fPw.length >= 4;
  const formOk = nmOk && emOk && pwOk && docOk && phOk_;

  const fetchS = useCallback(async () => {
    setLoading(true);
    try { const r = await fetch('/api/collectors'); if (r.ok) { const d = await r.json(); setStaff(d?.collectors || []); } else { setStaff([]); } } catch { setStaff([]); toast({ title: 'Error', description: 'No se pudo cargar el personal', variant: 'destructive' }); } finally { setLoading(false); }
  }, [toast]);
  useEffect(() => { fetchS(); }, [fetchS]);
  useEffect(() => { if (refreshTrigger) fetchS(); }, [refreshTrigger, fetchS]);

  const fetchZones = useCallback(async () => {
    try { const r = await fetch('/api/zones'); if (r.ok) { const d = await r.json(); setAllZones(d?.zones || []); } } catch { /* silent */ }
  }, []);
  useEffect(() => { fetchZones(); }, [fetchZones]);

  const cnt = { total: staff.length, collector: staff.filter(s => s.role === 'collector').length, supervisor: staff.filter(s => s.role === 'supervisor').length, admin: staff.filter(s => s.role === 'admin').length };
  const q = search.toLowerCase().trim();
  const filtered = q ? staff.filter(s => (s.name || '').toLowerCase().includes(q) || (s.documentNumber || '').includes(q) || s.email.toLowerCase().includes(q)) : staff;

  const reset = () => { setFDT('dni'); setFDN(''); setFN(''); setFE(''); setFPh(''); setFAd(''); setFDailyGoal(''); setFR('collector'); setFPw(''); setPhOk(false); setDOk(false); setDRes(null); };

  const onVerifyDoc = async () => {
    if (!docOk) return; setVDoc(true);
    try {
      const r = await fetch(`/api/verify-document?documentType=${fDT}&documentNumber=${fDN}`);
      if (r.ok) { const d: VerifyResult = await r.json(); setDRes(d); setDOk(true); if (d.found) { toast({ title: 'Documento encontrado', description: `${d.results.clients.length} cliente(s), ${d.results.staff.length} personal(es)`, variant: 'destructive' }); } else { toast({ title: 'Documento verificado', description: 'Sin registros previos' }); } }
      else toast({ title: 'Error', description: 'No se pudo verificar', variant: 'destructive' });
    } catch { toast({ title: 'Error', description: 'Error de conexión', variant: 'destructive' }); } finally { setVDoc(false); }
  };

  const onVerifyPh = async () => { if (!phOk_) return; setVPh(true); await new Promise(r => setTimeout(r, 600)); setPhOk(true); toast({ title: 'Teléfono verificado', description: `${fPh} es válido` }); setVPh(false); };

  const onRegister = async () => {
    if (!formOk) { toast({ title: 'Error', description: 'Complete todos los campos', variant: 'destructive' }); return; }
    setSubmitting(true);
    try {
      const r = await fetch('/api/collectors', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ name: fN.trim(), email: fE.trim(), password: fPw, documentType: fDT, documentNumber: fDN, phone: fPh, address: fAd || undefined, role: fR, dailyGoal: parseFloat(fDailyGoal) || 0 }) });
      const d = await r.json();
      if (!r.ok) { toast({ title: 'Error', description: d.error || 'No se pudo registrar', variant: 'destructive' }); return; }
      toast({ title: 'Personal registrado', description: `${fN.trim()} como ${RS[fR]?.l || fR}` }); setRegOpen(false); reset(); fetchS();
    } catch { toast({ title: 'Error', description: 'Error de conexión', variant: 'destructive' }); } finally { setSubmitting(false); }
  };

  const onToggle = async (m: StaffMember) => {
    setToggling(m.id);
    try {
      const r = await fetch('/api/collectors', { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ id: m.id, isActive: !m.isActive }) });
      const d = await r.json();
      if (!r.ok) { toast({ title: 'Error', description: d.error || 'No se pudo actualizar', variant: 'destructive' }); return; }
      toast({ title: m.isActive ? 'Desactivado' : 'Activado', description: `${m.name || 'Sin nombre'} ${m.isActive ? 'desactivado' : 'activado'}` }); fetchS(); if (sel?.id === m.id) setSel({ ...m, isActive: !m.isActive });
    } catch { toast({ title: 'Error', description: 'Error de conexión', variant: 'destructive' }); } finally { setToggling(null); }
  };

  const onDel = async (m: StaffMember) => {
    setDeleting(m.id);
    try {
      const r = await fetch(`/api/collectors?id=${m.id}`, { method: 'DELETE' }); const d = await r.json();
      if (!r.ok) { toast({ title: 'Error', description: d.error || 'No se pudo eliminar', variant: 'destructive' }); return; }
      toast({ title: 'Eliminado', description: `${m.name || 'Sin nombre'} eliminado` }); setDetOpen(false); setSel(null); fetchS();
    } catch { toast({ title: 'Error', description: 'Error de conexión', variant: 'destructive' }); } finally { setDeleting(null); }
  };

  const selectZone = (zoneId: string) => {
    setSelectedZoneIds(prev =>
      prev.includes(zoneId) ? [] : [zoneId]
    );
  };

  const handleSaveZones = async () => {
    if (!sel) return;
    setSavingZones(true);
    try {
      const r = await fetch('/api/collectors', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: sel.id, zoneIds: selectedZoneIds }),
      });
      const d = await r.json();
      if (!r.ok) { toast({ title: 'Error', description: d.error || 'No se pudieron guardar las zonas', variant: 'destructive' }); return; }
      toast({ title: 'Zonas guardadas', description: 'Zonas asignadas actualizadas' });
      setSel({ ...sel, zoneIds: selectedZoneIds });
      fetchS();
    } catch { toast({ title: 'Error', description: 'Error de conexión', variant: 'destructive' }); } finally { setSavingZones(false); }
  };

  const openDet = (m: StaffMember) => { setSel(m); setDetOpen(true); setSelectedZoneIds(m.zoneIds || []); };
  const actBadge = (a: boolean) => a ? 'bg-emerald-50 dark:bg-emerald-950/50 text-emerald-700 dark:text-emerald-300 border-emerald-200' : 'bg-background/70 dark:bg-[#05060b]/70 text-muted-foreground dark:text-muted-foreground border-input';
  const actLabel = (a: boolean) => a ? 'Activo' : 'Inactivo';

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {STAT_CARDS.map(sc => <Card key={sc.k} className={`border-0 shadow-md bg-gradient-to-br ${sc.g} text-white`}><CardContent className="p-4"><div className="flex items-center justify-between"><div><p className={`${sc.tc} text-xs font-medium`}>{sc.label}</p><p className="text-2xl font-bold mt-1">{cnt[sc.k as keyof typeof cnt]}</p></div><sc.Icon className={`h-8 w-8 ${sc.ic}`} /></div></CardContent></Card>)}
      </div>

      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div className="relative"><Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" /><Input placeholder="Buscar por nombre, documento o email..." value={search} onChange={e => setSearch(e.target.value)} className="pl-9 w-full sm:w-80 bg-white dark:bg-[#05060b]/80 border-input" /></div>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="icon" className="border-input" onClick={() => fetchS()}><RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} /></Button>
          <Button className="bg-emerald-600 hover:bg-emerald-700 text-white border-0 shadow-lg shadow-emerald-600/25 hover:shadow-emerald-600/40 transition-all" onClick={() => { reset(); setRegOpen(true); }}><UserPlus className="h-4 w-4 mr-2" /> Registro Personal</Button>
        </div>
      </div>

      {loading ? (
        <div className="space-y-3">{[0,1,2].map(i => <Card key={i} className="border-0 shadow-md"><CardContent className="p-4"><div className="flex items-center gap-4"><div className="w-12 h-12 rounded-full bg-background/70 dark:bg-[#05060b]/70 animate-pulse" /><div className="flex-1 space-y-2"><div className="h-4 w-48 bg-background/70 dark:bg-[#05060b]/70 rounded animate-pulse" /><div className="h-3 w-32 bg-background/70 dark:bg-[#05060b]/70 rounded animate-pulse" /></div></div></CardContent></Card>)}</div>
      ) : filtered.length === 0 ? (
        <Card className="border-0 shadow-md"><CardContent className="p-12 text-center"><div className="w-16 h-16 rounded-full bg-background/70 dark:bg-[#05060b]/70 flex items-center justify-center mx-auto mb-4"><Users className="h-8 w-8 text-muted-foreground dark:text-muted-foreground" /></div><h3 className="text-lg font-semibold text-foreground/80 dark:text-foreground/80 mb-2">No hay personal</h3><p className="text-muted-foreground dark:text-muted-foreground">{search ? 'Sin resultados' : 'No hay personal registrado'}</p></CardContent></Card>
      ) : (
        <div className="space-y-2 max-h-96 overflow-y-auto">
          {filtered.map(m => { const rs = RS[m.role] || { c: 'bg-background/70 dark:bg-[#05060b]/70 text-foreground/70 dark:text-muted-foreground border-input dark:border-emerald-500/5', l: m.role }; const ds = DS[m.documentType] || { c: 'bg-background/50 dark:bg-[#05060b]/70 text-foreground/70 dark:text-muted-foreground border-input dark:border-emerald-500/5', l: m.documentType }; const Ic = RI[m.role] || User; return (
            <Card key={m.id} className="border-0 shadow-sm hover:shadow-md transition-shadow cursor-pointer" onClick={() => openDet(m)}>
              <CardContent className="p-3"><div className="flex items-center gap-3">
                <div className={`w-9 h-9 rounded-full flex items-center justify-center shrink-0 ${m.isActive ? 'bg-emerald-100 dark:bg-emerald-900/50' : 'bg-background/70 dark:bg-[#05060b]/70'}`}><Ic className={`h-4 w-4 ${m.isActive ? 'text-emerald-600 dark:text-emerald-300' : 'text-muted-foreground'}`} /></div>
                <div className="flex-1 min-w-0"><div className="flex items-center gap-2 flex-wrap"><span className="font-semibold text-foreground dark:text-foreground text-sm truncate">{m.name || 'Sin nombre'}</span><Badge variant="outline" className={`text-xs ${rs.c}`}>{rs.l}</Badge><Badge variant="outline" className={`text-xs ${ds.c}`}>{ds.l}: {m.documentNumber || '—'}</Badge><Badge variant="outline" className={`text-xs ${actBadge(m.isActive)}`}>{actLabel(m.isActive)}</Badge></div><div className="flex items-center gap-3 text-xs text-muted-foreground dark:text-muted-foreground mt-0.5"><span className="truncate">{m.email}</span>{m.phone && <span>{m.phone}</span>}{m.role === 'collector' && <span>Préstamos: {m._count.loans}</span>}</div>{allZones.filter(z => (m.zoneIds || []).includes(z.id)).length > 0 && <div className="flex flex-wrap gap-1 mt-1.5">{allZones.filter(z => (m.zoneIds || []).includes(z.id)).map(z => <Badge key={z.id} variant="outline" className="text-[10px] bg-emerald-50 dark:bg-emerald-950/30 text-emerald-600 dark:text-emerald-400 border-emerald-200 dark:border-emerald-800">{z.name}</Badge>)}</div>}</div>
                <Button variant="ghost" size="icon" className="h-8 w-8 text-muted-foreground hover:text-emerald-600 dark:text-emerald-300 shrink-0" onClick={e => { e.stopPropagation(); openDet(m); }}><Eye className="h-4 w-4" /></Button>
              </div></CardContent>
            </Card>); })}
        </div>
      )}

      <Dialog open={regOpen} onOpenChange={setRegOpen}>
        <DialogContent className="sm:max-w-2xl max-h-[85vh] sm:max-h-[92vh] overflow-hidden flex flex-col p-0 gap-0">
          <DialogHeader className="px-6 pt-6 pb-3 border-b border-input/50">
            <DialogTitle className="flex items-center gap-2 text-lg"><div className="w-9 h-9 rounded-lg bg-gradient-to-br from-emerald-500 to-teal-500 flex items-center justify-center shadow-sm"><UserPlus className="h-5 w-5 text-white" /></div> Registro Personal</DialogTitle>
            <DialogDescription className="text-muted-foreground dark:text-muted-foreground">Registre un nuevo miembro. Los campos con * son obligatorios.</DialogDescription>
          </DialogHeader>
          <ScrollArea className="flex-1 min-h-0 overflow-y-auto">
            <div className="px-6 py-5 space-y-5">
              <div className="space-y-2">
                <Label className="text-sm font-semibold text-foreground/80 dark:text-foreground/80 flex items-center gap-2"><IdCard className="h-4 w-4 text-emerald-600 dark:text-emerald-300" /> Tipo de Documento *</Label>
                <div className="grid grid-cols-3 gap-3">{DOC_TYPES.map(dt => { const s = fDT === dt.value; return <button key={dt.value} type="button" className={`relative flex flex-col items-center gap-2 p-3 rounded-xl border-2 transition-all cursor-pointer group ${s ? 'border-emerald-400 bg-emerald-50/80 dark:bg-emerald-950/30 ring-2 ring-emerald-200 shadow-sm' : 'border-input bg-white dark:bg-[#05060b]/80 hover:border-emerald-200 hover:bg-emerald-50/30 dark:hover:bg-emerald-950/30'}`} onClick={() => { setFDT(dt.value); setFDN(''); setDOk(false); setDRes(null); }}>{s && <div className="absolute -top-1.5 -right-1.5"><CheckCircle2 className="h-5 w-5 text-emerald-500 fill-emerald-500 stroke-white" /></div>}<div className={`w-9 h-9 rounded-full flex items-center justify-center ${s ? 'bg-emerald-100 dark:bg-emerald-900/50' : 'bg-background/70 dark:bg-[#05060b]/70 group-hover:bg-emerald-50 dark:group-hover:bg-emerald-950/30'}`}><dt.icon className={`h-4 w-4 ${s ? 'text-emerald-600 dark:text-emerald-300' : 'text-muted-foreground group-hover:text-emerald-500'}`} /></div><div className="text-center"><p className={`font-semibold text-sm ${s ? 'text-emerald-700 dark:text-emerald-300' : 'text-foreground/80 dark:text-foreground/80'}`}>{dt.label}</p><p className="text-xs text-muted-foreground">{dt.digits} dígitos</p></div></button>; })}</div>
              </div>

              <div className="space-y-2">
                <Label className="text-sm font-semibold text-foreground/80 dark:text-foreground/80 flex items-center gap-2"><IdCard className="h-4 w-4 text-muted-foreground" /> Número de Documento *</Label>
                <div className="flex items-center gap-2">
                  <div className="relative flex-1"><Input placeholder={fDT === 'dni' ? 'Ej: 12345678' : 'Ej: 123456789'} value={fDN} onChange={e => { setFDN(e.target.value.replace(/\D/g, '').slice(0, maxDig)); setDOk(false); setDRes(null); }} maxLength={maxDig} className={`pr-16 bg-white dark:bg-[#05060b]/80 font-mono tracking-wider ${vb(fDN, docOk)}`} /><div className="absolute right-3 top-1/2 -translate-y-1/2 flex items-center gap-1">{fDN.length > 0 && (docOk ? <CheckCircle2 className="h-3.5 w-3.5 text-emerald-500" /> : <XCircle className="h-3.5 w-3.5 text-red-400" />)}<span className={`text-xs font-medium tabular-nums ${fDN.length === maxDig ? 'text-emerald-600 dark:text-emerald-300' : 'text-muted-foreground'}`}>{fDN.length}/{maxDig}</span></div></div>
                  <Button type="button" variant="outline" className={`shrink-0 h-10 ${dOk && !dRes?.found ? 'bg-emerald-50 dark:bg-emerald-950/50 border-emerald-200 text-emerald-700 dark:text-emerald-300 hover:bg-emerald-100 dark:hover:bg-emerald-900/50' : 'border-input'}`} disabled={!docOk || vDoc} onClick={onVerifyDoc}>{vDoc ? <Loader2 className="h-4 w-4 mr-1.5 animate-spin" /> : dOk && !dRes?.found ? <CheckCircle2 className="h-4 w-4 mr-1.5" /> : null} Verificar</Button>
                </div>
                {dOk && dRes && (
                  <div className={`mt-2 p-3 rounded-xl border ${dRes.found ? 'bg-amber-50 dark:bg-amber-950/50 border-amber-200' : 'bg-emerald-50 dark:bg-emerald-950/50 border-emerald-200'}`}>
                    {dRes.found ? (<div className="space-y-1.5"><div className="flex items-center gap-2"><AlertTriangle className="h-4 w-4 text-amber-600 dark:text-amber-300 shrink-0" /><p className="text-sm font-semibold text-amber-800 dark:text-amber-200">Ya registrado ({dRes.results.clients.length + dRes.results.staff.length} resultado{dRes.results.clients.length + dRes.results.staff.length > 1 ? 's' : ''})</p></div>{dRes.results.staff.map(s => <div key={s.id} className="flex items-center gap-2 p-1.5 rounded-lg bg-white/80 dark:bg-[#05060b]/70/80 border border-amber-100"><User className="h-3.5 w-3.5 text-amber-600 dark:text-amber-300 shrink-0" /><span className="text-sm font-medium">{s.name || 'Sin nombre'}</span><Badge variant="outline" className={`text-xs ${RS[s.role]?.c || ''}`}>{RS[s.role]?.l || s.role}</Badge><Badge variant="outline" className={`text-xs ${actBadge(s.isActive)}`}>{actLabel(s.isActive)}</Badge></div>)}{dRes.results.clients.map(c => <div key={c.id} className="flex items-center gap-2 p-1.5 rounded-lg bg-white/80 dark:bg-[#05060b]/70/80 border border-amber-100"><Users className="h-3.5 w-3.5 text-sky-600 dark:text-sky-300 shrink-0" /><span className="text-sm font-medium">{c.name}</span><Badge variant="outline" className="text-xs bg-sky-50 dark:bg-sky-950/50 text-sky-700 dark:text-sky-300 border-sky-200">Cliente</Badge>{c.zone && <span className="text-xs text-muted-foreground dark:text-muted-foreground">{c.zone}</span>}</div>)}</div>)
                    : <div className="flex items-center gap-2"><CheckCircle2 className="h-4 w-4 text-emerald-600 dark:text-emerald-300 shrink-0" /><p className="text-sm text-emerald-700 dark:text-emerald-300">Documento disponible</p></div>}
                  </div>
                )}
              </div>

              <Separator />
              <div className="space-y-2"><Label className="text-sm font-semibold text-foreground/80 dark:text-foreground/80 flex items-center gap-2"><User className="h-4 w-4 text-muted-foreground" /> Nombre Completo *</Label><VInput value={fN} valid={nmOk} placeholder="Ej: Juan Pérez García" onChange={e => setFN(e.target.value)} /></div>
              <div className="space-y-2"><Label className="text-sm font-semibold text-foreground/80 dark:text-foreground/80 flex items-center gap-2"><Mail className="h-4 w-4 text-muted-foreground" /> Email *</Label><VInput value={fE} valid={emOk} type="email" placeholder="correo@ejemplo.com" onChange={e => setFE(e.target.value)} /></div>

              <div className="space-y-2">
                <Label className="text-sm font-semibold text-foreground/80 dark:text-foreground/80 flex items-center gap-2"><Phone className="h-4 w-4 text-muted-foreground" /> Teléfono *</Label>
                <div className="flex items-center gap-2">
                  <div className="relative flex-1"><Input placeholder="Ej: 999888777" value={fPh} onChange={e => { setFPh(e.target.value.replace(/\D/g, '').slice(0, 9)); setPhOk(false); }} className={`pr-14 bg-white dark:bg-[#05060b]/80 font-mono tracking-wider ${vb(fPh, phOk_)}`} /><div className="absolute right-3 top-1/2 -translate-y-1/2 flex items-center gap-1">{fPh.length > 0 && (phOk_ ? <CheckCircle2 className="h-3.5 w-3.5 text-emerald-500" /> : <XCircle className="h-3.5 w-3.5 text-red-400" />)}<span className={`text-xs font-medium tabular-nums ${fPh.length === 9 ? 'text-emerald-600 dark:text-emerald-300' : 'text-muted-foreground'}`}>{fPh.length}/9</span></div></div>
                  <Button type="button" variant="outline" className={`shrink-0 h-10 ${phOk && phOk_ ? 'bg-emerald-50 dark:bg-emerald-950/50 border-emerald-200 text-emerald-700 dark:text-emerald-300 hover:bg-emerald-100 dark:hover:bg-emerald-900/50' : 'border-input'}`} disabled={!phOk_ || vPh} onClick={onVerifyPh}>{vPh ? <Loader2 className="h-4 w-4 mr-1.5 animate-spin" /> : phOk && phOk_ ? <CheckCircle2 className="h-4 w-4 mr-1.5" /> : null} Verificar</Button>
                </div>
                <p className="text-xs text-muted-foreground">9 dígitos, empieza con 9</p>
              </div>

              <div className="space-y-2"><Label className="text-sm font-semibold text-foreground/80 dark:text-foreground/80 flex items-center gap-2"><MapPin className="h-4 w-4 text-muted-foreground" /> Dirección <span className="text-muted-foreground font-normal">(opcional)</span></Label><Input placeholder="Ej: Av. Principal 123, Lima" value={fAd} onChange={e => setFAd(e.target.value)} className="bg-white dark:bg-[#05060b]/80 border-input" /></div>

              <div className="space-y-2"><Label className="text-sm font-semibold text-foreground/80 dark:text-foreground/80 flex items-center gap-2"><DollarSign className="h-4 w-4 text-emerald-500" /> Meta Diaria (S/) <span className="text-muted-foreground font-normal">(opcional)</span></Label><Input type="number" step="0.01" placeholder="Ej: 100.00" value={fDailyGoal} onChange={e => setFDailyGoal(e.target.value)} className="bg-white dark:bg-[#05060b]/80 border-input" /></div>

              <Separator />
              <div className="space-y-2">
                <Label className="text-sm font-semibold text-foreground/80 dark:text-foreground/80 flex items-center gap-2"><Shield className="h-4 w-4 text-emerald-600 dark:text-emerald-300" /> Rol *</Label>
                <div className="grid grid-cols-3 gap-3">{ROLES.map(o => { const s = fR === o.value; const c = RC[o.color]; return <button key={o.value} type="button" className={`relative flex flex-col items-center gap-2 p-3 rounded-xl border-2 transition-all cursor-pointer text-center group ${s ? c.s : c.u}`} onClick={() => setFR(o.value)}>{s && <div className="absolute -top-1.5 -right-1.5"><CheckCircle2 className={`h-5 w-5 ${c.ck} fill-current stroke-white`} /></div>}<div className={`w-9 h-9 rounded-full flex items-center justify-center ${s ? c.ib : 'bg-background/70 dark:bg-[#05060b]/70'}`}><o.icon className={`h-4 w-4 ${s ? c.ic : 'text-muted-foreground'}`} /></div><div><p className={`font-semibold text-sm ${s ? c.lb : 'text-foreground/80 dark:text-foreground/80'}`}>{o.label}</p><p className="text-xs text-muted-foreground dark:text-muted-foreground mt-0.5 leading-tight">{o.desc}</p></div></button>; })}</div>
              </div>

              <Separator />
              <div className="space-y-2"><Label className="text-sm font-semibold text-foreground/80 dark:text-foreground/80 flex items-center gap-2"><KeyRound className="h-4 w-4 text-muted-foreground" /> Contraseña *</Label><VInput value={fPw} valid={pwOk} type="password" placeholder="Mínimo 4 caracteres" onChange={e => setFPw(e.target.value)} /></div>

              <div className="pt-3 flex items-center gap-3">
                <Button className="flex-1 bg-emerald-600 hover:bg-emerald-700 text-white border-0 shadow-lg shadow-emerald-600/25 hover:shadow-emerald-600/40 transition-all h-11 text-sm font-semibold" onClick={onRegister} disabled={!formOk || submitting}>{submitting ? <><Loader2 className="h-4 w-4 mr-2 animate-spin" /> Registrando...</> : <><UserPlus className="h-4 w-4 mr-2" /> Registrar Personal</>}</Button>
                <Button variant="outline" className="border-emerald-200 dark:border-emerald-800 text-emerald-700 dark:text-emerald-300 hover:bg-emerald-50 dark:hover:bg-emerald-950 h-11" onClick={() => setRegOpen(false)} disabled={submitting}>Cancelar</Button>
              </div>
            </div>
          </ScrollArea>
        </DialogContent>
      </Dialog>

      <Sheet open={detOpen} onOpenChange={setDetOpen}>
        <SheetContent side="right" className="w-full sm:max-w-xl overflow-y-auto">
          {sel && (() => { const rs = RS[sel.role] || { c: 'bg-background/70 text-foreground/70 dark:text-muted-foreground border-input', l: sel.role }; const ds = DS[sel.documentType] || { c: 'bg-background/50 text-foreground/70 dark:text-muted-foreground border-input', l: sel.documentType }; const Ic = RI[sel.role] || User; return (
            <>
              <SheetHeader className="pb-4 border-b border-input/50 dark:border-emerald-500/10"><div className="flex items-center gap-3"><div className={`w-12 h-12 rounded-full flex items-center justify-center ${sel.isActive ? 'bg-emerald-100 dark:bg-emerald-900/50' : 'bg-background/70 dark:bg-[#05060b]/70'}`}><Ic className={`h-6 w-6 ${sel.isActive ? 'text-emerald-600 dark:text-emerald-300' : 'text-muted-foreground'}`} /></div><div className="flex-1 min-w-0"><SheetTitle className="text-lg">{sel.name || 'Sin nombre'}</SheetTitle><SheetDescription className="flex items-center gap-2 mt-0.5 flex-wrap"><Badge variant="outline" className={`text-xs ${rs.c}`}>{rs.l}</Badge><Badge variant="outline" className={`text-xs ${ds.c}`}>{ds.l}: {sel.documentNumber || '—'}</Badge><Badge variant="outline" className={`text-xs ${actBadge(sel.isActive)}`}>{actLabel(sel.isActive)}</Badge></SheetDescription></div></div></SheetHeader>
              <div className="p-4 space-y-5">
                <div className="space-y-2"><h4 className="text-sm font-semibold text-foreground/80 dark:text-foreground/80">Contacto</h4><div className="space-y-1.5 text-sm text-foreground/70 dark:text-muted-foreground"><div className="flex items-center gap-2"><Mail className="h-4 w-4 text-muted-foreground shrink-0" />{sel.email}</div>{sel.phone && <div className="flex items-center gap-2"><Phone className="h-4 w-4 text-muted-foreground shrink-0" />{sel.phone}</div>}{sel.address && <div className="flex items-center gap-2"><MapPin className="h-4 w-4 text-muted-foreground shrink-0" />{sel.address}</div>}{sel.dailyGoal != null && <div className="flex items-center gap-2"><DollarSign className="h-4 w-4 text-emerald-500 shrink-0" />Meta diaria: <strong>S/{Number(sel.dailyGoal).toLocaleString('es-PE',{minimumFractionDigits:2})}</strong></div>}</div></div>
                <Separator />
                <div className="space-y-2"><h4 className="text-sm font-semibold text-foreground/80 dark:text-foreground/80">Documento</h4><div className="flex items-center gap-3 p-2.5 rounded-xl bg-background/50 dark:bg-[#05060b]/70 border border-input/50 dark:border-emerald-500/10"><Badge variant="outline" className={`text-xs ${ds.c}`}>{ds.l}</Badge><span className="text-lg font-mono font-semibold text-slate-800 dark:text-foreground">{sel.documentNumber || '—'}</span></div></div>
                <Separator />
                <div className="space-y-2">
                  <h4 className="text-sm font-semibold text-foreground/80 dark:text-foreground/80">Zona Asignada</h4>
                  <div className="flex flex-wrap gap-2">
                    {allZones.map(z => (
                      <button
                        key={z.id}
                        type="button"
                        onClick={() => selectZone(z.id)}
                        className={`px-3 py-1.5 rounded-lg text-sm border transition-colors flex items-center gap-2 ${
                          selectedZoneIds.includes(z.id)
                            ? 'bg-emerald-50 dark:bg-emerald-950/50 border-emerald-300 text-emerald-700 dark:text-emerald-300 ring-2 ring-emerald-300'
                            : 'bg-white dark:bg-[#05060b]/80 border-input text-foreground/70 dark:text-muted-foreground hover:border-emerald-200'
                        }`}
                      >
                        <div className={`w-4 h-4 rounded-full border-2 flex items-center justify-center ${
                          selectedZoneIds.includes(z.id) ? 'border-emerald-500' : 'border-slate-300'
                        }`}>
                          {selectedZoneIds.includes(z.id) && <div className="w-2 h-2 rounded-full bg-emerald-500" />}
                        </div>
                        {z.name}
                      </button>
                    ))}
                    {allZones.length === 0 && <p className="text-sm text-muted-foreground">No hay zonas disponibles</p>}
                  </div>
                  {isAdmin && <Button size="sm" className="mt-2 bg-emerald-600 hover:bg-emerald-700 text-white shadow-sm" onClick={handleSaveZones} disabled={savingZones}>{savingZones ? <><Loader2 className="h-4 w-4 mr-1.5 animate-spin" /> Guardando...</> : 'Guardar Zona'}</Button>}
                </div>
                <Separator />
                {sel.role === 'collector' && (<><div className="space-y-2"><h4 className="text-sm font-semibold text-foreground/80 dark:text-foreground/80">Estadísticas</h4><div className="grid grid-cols-2 gap-3"><div className="p-3 rounded-xl bg-emerald-50 dark:bg-emerald-950/50 border border-emerald-100"><p className="text-2xl font-bold text-emerald-700 dark:text-emerald-300">{sel._count.loans}</p><p className="text-xs text-emerald-600 dark:text-emerald-300">Préstamos</p></div><div className="p-3 rounded-xl bg-teal-50 dark:bg-teal-950/50 border border-teal-100"><p className="text-2xl font-bold text-teal-700 dark:text-teal-300">{sel._count.payments}</p><p className="text-xs text-teal-600 dark:text-teal-300">Pagos</p></div></div></div><Separator /></>)}
                <p className="text-sm text-muted-foreground dark:text-muted-foreground">Registrado el {new Date(sel.createdAt).toLocaleDateString('es-PE', { day: '2-digit', month: 'long', year: 'numeric' })}</p>
                <Separator />
                <div className="space-y-3"><h4 className="text-sm font-semibold text-foreground/80 dark:text-foreground/80">Acciones</h4><div className="flex gap-2"><Button variant="outline" className="flex-1 border-input" onClick={() => setExpensesOpen(true)}><Wallet className="h-4 w-4 mr-2" /> Gastos</Button><Button variant="outline" className="flex-1 border-input" onClick={() => setLocationsOpen(true)}><MapPin className="h-4 w-4 mr-2" /> Ubicaciones</Button></div>{isAdmin && <div className="flex items-center justify-between p-3 rounded-xl bg-background/50 dark:bg-[#05060b]/70 border border-input/50 dark:border-emerald-500/10"><div><p className="text-sm font-medium text-slate-800 dark:text-foreground">{sel.isActive ? 'Desactivar' : 'Activar'} Personal</p><p className="text-xs text-muted-foreground dark:text-muted-foreground">{sel.isActive ? 'No podrá acceder al sistema' : 'Podrá acceder nuevamente'}</p></div><Switch checked={sel.isActive} onCheckedChange={() => onToggle(sel)} disabled={toggling === sel.id} className="data-[state=checked]:bg-emerald-500" /></div>}
{isAdmin && <Button variant="outline" className="w-full border-red-200 text-red-600 dark:text-red-300 hover:bg-red-50 dark:hover:bg-red-950/50 hover:text-red-700 dark:text-red-300 hover:border-red-300" disabled={deleting === sel.id} onClick={() => onDel(sel)}>{deleting === sel.id ? <><Loader2 className="h-4 w-4 mr-2 animate-spin" /> Eliminando...</> : <><Trash2 className="h-4 w-4 mr-2" /> Eliminar Personal</>}</Button>}</div>
              </div>
            </>
          ); })()}
        </SheetContent>
      </Sheet>

      <CollectorExpensesPanel open={expensesOpen} onOpenChange={setExpensesOpen} collectorId={sel?.id||null} collectorName={sel?.name||''} />
      <CollectorLocationsMap open={locationsOpen} onOpenChange={setLocationsOpen} collectorId={sel?.id||null} collectorName={sel?.name||''} />
    </div>
  );
}
