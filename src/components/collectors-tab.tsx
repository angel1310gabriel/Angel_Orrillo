'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { Users, Shield, Eye, UserCheck, Search, RefreshCw, Loader2, CheckCircle2, XCircle, User, Mail, Phone, MapPin, Trash2, UserPlus, KeyRound, IdCard, Globe, AlertTriangle } from 'lucide-react';
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

interface StaffMember {
  id: string; name: string | null; email: string; phone: string | null;
  address: string | null; role: string; isActive: boolean; documentType: string;
  documentNumber: string | null; photoUrl: string | null; createdAt: string;
  _count: { loans: number; payments: number };
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
  admin: { c: 'bg-red-100 text-red-800 border-red-200', l: 'Admin' },
  supervisor: { c: 'bg-amber-100 text-amber-800 border-amber-200', l: 'Supervisor' },
  collector: { c: 'bg-emerald-100 text-emerald-800 border-emerald-200', l: 'Cobrador' },
};
const DS: Record<string, { c: string; l: string }> = {
  dni: { c: 'bg-blue-50 text-blue-700 border-blue-200', l: 'DNI' },
  carnet_extranjeria: { c: 'bg-purple-50 text-purple-700 border-purple-200', l: 'CE' },
  pasaporte: { c: 'bg-orange-50 text-orange-700 border-orange-200', l: 'PAS' },
};
const RI: Record<string, React.ComponentType<{ className?: string }>> = { admin: Shield, supervisor: Eye, collector: UserCheck };
const RC: Record<string, { s: string; u: string; ib: string; ic: string; ck: string; lb: string }> = {
  red: { s: 'border-red-300 bg-red-50/80 ring-2 ring-red-100', u: 'border-slate-200 bg-white hover:border-red-200 hover:bg-red-50/30', ib: 'bg-red-100', ic: 'text-red-600', ck: 'text-red-500', lb: 'text-red-700' },
  amber: { s: 'border-amber-300 bg-amber-50/80 ring-2 ring-amber-100', u: 'border-slate-200 bg-white hover:border-amber-200 hover:bg-amber-50/30', ib: 'bg-amber-100', ic: 'text-amber-600', ck: 'text-amber-500', lb: 'text-amber-700' },
  emerald: { s: 'border-emerald-300 bg-emerald-50/80 ring-2 ring-emerald-100', u: 'border-slate-200 bg-white hover:border-emerald-200 hover:bg-emerald-50/30', ib: 'bg-emerald-100', ic: 'text-emerald-600', ck: 'text-emerald-500', lb: 'text-emerald-700' },
};

const vb = (v: string, ok: boolean) => v ? (ok ? 'border-emerald-300 focus-visible:ring-emerald-200' : 'border-red-300 focus-visible:ring-red-200') : 'border-slate-200';
const STAT_CARDS = [
  { k: 'total', label: 'Total Personal', g: 'from-emerald-500 to-emerald-600', tc: 'text-emerald-100', Icon: Users, ic: 'text-emerald-200' },
  { k: 'collector', label: 'Cobradores', g: 'from-teal-500 to-teal-600', tc: 'text-teal-100', Icon: UserCheck, ic: 'text-teal-200' },
  { k: 'supervisor', label: 'Supervisores', g: 'from-amber-500 to-amber-600', tc: 'text-amber-100', Icon: Eye, ic: 'text-amber-200' },
  { k: 'admin', label: 'Admins', g: 'from-red-500 to-red-600', tc: 'text-red-100', Icon: Shield, ic: 'text-red-200' },
];

function VInput({ value, valid, ...p }: { value: string; valid: boolean } & React.ComponentProps<typeof Input>) {
  return <div className="relative"><Input value={value} className={`pr-10 bg-white ${vb(value, valid)}`} {...p} />{value.length > 0 && <div className="absolute right-3 top-1/2 -translate-y-1/2">{valid ? <CheckCircle2 className="h-4 w-4 text-emerald-500" /> : <XCircle className="h-4 w-4 text-red-400" />}</div>}</div>;
}

export default function CollectorsTab({ refreshTrigger }: Props) {
  const { toast } = useToast();
  const [staff, setStaff] = useState<StaffMember[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [regOpen, setRegOpen] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [fDT, setFDT] = useState('dni'), [fDN, setFDN] = useState(''), [fN, setFN] = useState(''), [fE, setFE] = useState('');
  const [fPh, setFPh] = useState(''), [fAd, setFAd] = useState(''), [fR, setFR] = useState('collector'), [fPw, setFPw] = useState('');
  const [phOk, setPhOk] = useState(false);
  const [vDoc, setVDoc] = useState(false), [dOk, setDOk] = useState(false), [dRes, setDRes] = useState<VerifyResult | null>(null);
  const [vPh, setVPh] = useState(false);
  const [sel, setSel] = useState<StaffMember | null>(null), [detOpen, setDetOpen] = useState(false);
  const [toggling, setToggling] = useState<string | null>(null), [deleting, setDeleting] = useState<string | null>(null);

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

  const cnt = { total: staff.length, collector: staff.filter(s => s.role === 'collector').length, supervisor: staff.filter(s => s.role === 'supervisor').length, admin: staff.filter(s => s.role === 'admin').length };
  const q = search.toLowerCase().trim();
  const filtered = q ? staff.filter(s => (s.name || '').toLowerCase().includes(q) || (s.documentNumber || '').includes(q) || s.email.toLowerCase().includes(q)) : staff;

  const reset = () => { setFDT('dni'); setFDN(''); setFN(''); setFE(''); setFPh(''); setFAd(''); setFR('collector'); setFPw(''); setPhOk(false); setDOk(false); setDRes(null); };

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
      const r = await fetch('/api/collectors', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ name: fN.trim(), email: fE.trim(), password: fPw, documentType: fDT, documentNumber: fDN, phone: fPh, address: fAd || undefined, role: fR }) });
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

  const openDet = (m: StaffMember) => { setSel(m); setDetOpen(true); };
  const actBadge = (a: boolean) => a ? 'bg-emerald-50 text-emerald-700 border-emerald-200' : 'bg-slate-100 text-slate-500 border-slate-200';
  const actLabel = (a: boolean) => a ? 'Activo' : 'Inactivo';

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {STAT_CARDS.map(sc => <Card key={sc.k} className={`border-0 shadow-md bg-gradient-to-br ${sc.g} text-white`}><CardContent className="p-4"><div className="flex items-center justify-between"><div><p className={`${sc.tc} text-xs font-medium`}>{sc.label}</p><p className="text-2xl font-bold mt-1">{cnt[sc.k as keyof typeof cnt]}</p></div><sc.Icon className={`h-8 w-8 ${sc.ic}`} /></div></CardContent></Card>)}
      </div>

      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div className="relative"><Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" /><Input placeholder="Buscar por nombre, documento o email..." value={search} onChange={e => setSearch(e.target.value)} className="pl-9 w-full sm:w-80 bg-white border-slate-200" /></div>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="icon" className="border-slate-200" onClick={() => fetchS()}><RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} /></Button>
          <Button className="bg-gradient-to-r from-emerald-500 to-teal-500 hover:from-emerald-600 hover:to-teal-600 text-white shadow-md" onClick={() => { reset(); setRegOpen(true); }}><UserPlus className="h-4 w-4 mr-2" /> Registro Personal</Button>
        </div>
      </div>

      {loading ? (
        <div className="space-y-3">{[0,1,2].map(i => <Card key={i} className="border-0 shadow-md"><CardContent className="p-4"><div className="flex items-center gap-4"><div className="w-12 h-12 rounded-full bg-slate-100 animate-pulse" /><div className="flex-1 space-y-2"><div className="h-4 w-48 bg-slate-100 rounded animate-pulse" /><div className="h-3 w-32 bg-slate-100 rounded animate-pulse" /></div></div></CardContent></Card>)}</div>
      ) : filtered.length === 0 ? (
        <Card className="border-0 shadow-md"><CardContent className="p-12 text-center"><div className="w-16 h-16 rounded-full bg-slate-100 flex items-center justify-center mx-auto mb-4"><Users className="h-8 w-8 text-slate-400" /></div><h3 className="text-lg font-semibold text-slate-700 mb-2">No hay personal</h3><p className="text-slate-500">{search ? 'Sin resultados' : 'No hay personal registrado'}</p></CardContent></Card>
      ) : (
        <div className="space-y-2 max-h-96 overflow-y-auto">
          {filtered.map(m => { const rs = RS[m.role] || { c: 'bg-slate-100 text-slate-600 border-slate-200', l: m.role }; const ds = DS[m.documentType] || { c: 'bg-slate-50 text-slate-600 border-slate-200', l: m.documentType }; const Ic = RI[m.role] || User; return (
            <Card key={m.id} className="border-0 shadow-sm hover:shadow-md transition-shadow cursor-pointer" onClick={() => openDet(m)}>
              <CardContent className="p-3"><div className="flex items-center gap-3">
                <div className={`w-9 h-9 rounded-full flex items-center justify-center shrink-0 ${m.isActive ? 'bg-emerald-100' : 'bg-slate-100'}`}><Ic className={`h-4 w-4 ${m.isActive ? 'text-emerald-600' : 'text-slate-400'}`} /></div>
                <div className="flex-1 min-w-0"><div className="flex items-center gap-2 flex-wrap"><span className="font-semibold text-slate-900 text-sm truncate">{m.name || 'Sin nombre'}</span><Badge variant="outline" className={`text-xs ${rs.c}`}>{rs.l}</Badge><Badge variant="outline" className={`text-xs ${ds.c}`}>{ds.l}: {m.documentNumber || '—'}</Badge><Badge variant="outline" className={`text-xs ${actBadge(m.isActive)}`}>{actLabel(m.isActive)}</Badge></div><div className="flex items-center gap-3 text-xs text-slate-500 mt-0.5"><span className="truncate">{m.email}</span>{m.phone && <span>{m.phone}</span>}{m.role === 'collector' && <span>Préstamos: {m._count.loans}</span>}</div></div>
                <Button variant="ghost" size="icon" className="h-8 w-8 text-slate-400 hover:text-emerald-600 shrink-0" onClick={e => { e.stopPropagation(); openDet(m); }}><Eye className="h-4 w-4" /></Button>
              </div></CardContent>
            </Card>); })}
        </div>
      )}

      <Dialog open={regOpen} onOpenChange={setRegOpen}>
        <DialogContent className="sm:max-w-2xl max-h-[85vh] sm:max-h-[92vh] overflow-hidden flex flex-col p-0 gap-0">
          <DialogHeader className="px-6 pt-6 pb-3 border-b border-slate-100">
            <DialogTitle className="flex items-center gap-2 text-lg"><div className="w-9 h-9 rounded-lg bg-gradient-to-br from-emerald-500 to-teal-500 flex items-center justify-center shadow-sm"><UserPlus className="h-5 w-5 text-white" /></div> Registro Personal</DialogTitle>
            <DialogDescription className="text-slate-500">Registre un nuevo miembro. Los campos con * son obligatorios.</DialogDescription>
          </DialogHeader>
          <ScrollArea className="flex-1 min-h-0 overflow-y-auto">
            <div className="px-6 py-5 space-y-5">
              <div className="space-y-2">
                <Label className="text-sm font-semibold text-slate-700 flex items-center gap-2"><IdCard className="h-4 w-4 text-emerald-600" /> Tipo de Documento *</Label>
                <div className="grid grid-cols-3 gap-3">{DOC_TYPES.map(dt => { const s = fDT === dt.value; return <button key={dt.value} type="button" className={`relative flex flex-col items-center gap-2 p-3 rounded-xl border-2 transition-all cursor-pointer group ${s ? 'border-emerald-400 bg-emerald-50/80 ring-2 ring-emerald-200 shadow-sm' : 'border-slate-200 bg-white hover:border-emerald-200 hover:bg-emerald-50/30'}`} onClick={() => { setFDT(dt.value); setFDN(''); setDOk(false); setDRes(null); }}>{s && <div className="absolute -top-1.5 -right-1.5"><CheckCircle2 className="h-5 w-5 text-emerald-500 fill-emerald-500 stroke-white" /></div>}<div className={`w-9 h-9 rounded-full flex items-center justify-center ${s ? 'bg-emerald-100' : 'bg-slate-100 group-hover:bg-emerald-50'}`}><dt.icon className={`h-4 w-4 ${s ? 'text-emerald-600' : 'text-slate-400 group-hover:text-emerald-500'}`} /></div><div className="text-center"><p className={`font-semibold text-sm ${s ? 'text-emerald-700' : 'text-slate-700'}`}>{dt.label}</p><p className="text-xs text-slate-400">{dt.digits} dígitos</p></div></button>; })}</div>
              </div>

              <div className="space-y-2">
                <Label className="text-sm font-semibold text-slate-700 flex items-center gap-2"><IdCard className="h-4 w-4 text-slate-400" /> Número de Documento *</Label>
                <div className="flex items-center gap-2">
                  <div className="relative flex-1"><Input placeholder={fDT === 'dni' ? 'Ej: 12345678' : 'Ej: 123456789'} value={fDN} onChange={e => { setFDN(e.target.value.replace(/\D/g, '').slice(0, maxDig)); setDOk(false); setDRes(null); }} maxLength={maxDig} className={`pr-16 bg-white font-mono tracking-wider ${vb(fDN, docOk)}`} /><div className="absolute right-3 top-1/2 -translate-y-1/2 flex items-center gap-1">{fDN.length > 0 && (docOk ? <CheckCircle2 className="h-3.5 w-3.5 text-emerald-500" /> : <XCircle className="h-3.5 w-3.5 text-red-400" />)}<span className={`text-xs font-medium tabular-nums ${fDN.length === maxDig ? 'text-emerald-600' : 'text-slate-400'}`}>{fDN.length}/{maxDig}</span></div></div>
                  <Button type="button" variant="outline" className={`shrink-0 h-10 ${dOk && !dRes?.found ? 'bg-emerald-50 border-emerald-200 text-emerald-700 hover:bg-emerald-100' : 'border-slate-200'}`} disabled={!docOk || vDoc} onClick={onVerifyDoc}>{vDoc ? <Loader2 className="h-4 w-4 mr-1.5 animate-spin" /> : dOk && !dRes?.found ? <CheckCircle2 className="h-4 w-4 mr-1.5" /> : null} Verificar</Button>
                </div>
                {dOk && dRes && (
                  <div className={`mt-2 p-3 rounded-xl border ${dRes.found ? 'bg-amber-50 border-amber-200' : 'bg-emerald-50 border-emerald-200'}`}>
                    {dRes.found ? (<div className="space-y-1.5"><div className="flex items-center gap-2"><AlertTriangle className="h-4 w-4 text-amber-600 shrink-0" /><p className="text-sm font-semibold text-amber-800">Ya registrado ({dRes.results.clients.length + dRes.results.staff.length} resultado{dRes.results.clients.length + dRes.results.staff.length > 1 ? 's' : ''})</p></div>{dRes.results.staff.map(s => <div key={s.id} className="flex items-center gap-2 p-1.5 rounded-lg bg-white/80 border border-amber-100"><User className="h-3.5 w-3.5 text-amber-600 shrink-0" /><span className="text-sm font-medium">{s.name || 'Sin nombre'}</span><Badge variant="outline" className={`text-xs ${RS[s.role]?.c || ''}`}>{RS[s.role]?.l || s.role}</Badge><Badge variant="outline" className={`text-xs ${actBadge(s.isActive)}`}>{actLabel(s.isActive)}</Badge></div>)}{dRes.results.clients.map(c => <div key={c.id} className="flex items-center gap-2 p-1.5 rounded-lg bg-white/80 border border-amber-100"><Users className="h-3.5 w-3.5 text-sky-600 shrink-0" /><span className="text-sm font-medium">{c.name}</span><Badge variant="outline" className="text-xs bg-sky-50 text-sky-700 border-sky-200">Cliente</Badge>{c.zone && <span className="text-xs text-slate-500">{c.zone}</span>}</div>)}</div>)
                    : <div className="flex items-center gap-2"><CheckCircle2 className="h-4 w-4 text-emerald-600 shrink-0" /><p className="text-sm text-emerald-700">Documento disponible</p></div>}
                  </div>
                )}
              </div>

              <Separator />
              <div className="space-y-2"><Label className="text-sm font-semibold text-slate-700 flex items-center gap-2"><User className="h-4 w-4 text-slate-400" /> Nombre Completo *</Label><VInput value={fN} valid={nmOk} placeholder="Ej: Juan Pérez García" onChange={e => setFN(e.target.value)} /></div>
              <div className="space-y-2"><Label className="text-sm font-semibold text-slate-700 flex items-center gap-2"><Mail className="h-4 w-4 text-slate-400" /> Email *</Label><VInput value={fE} valid={emOk} type="email" placeholder="correo@ejemplo.com" onChange={e => setFE(e.target.value)} /></div>

              <div className="space-y-2">
                <Label className="text-sm font-semibold text-slate-700 flex items-center gap-2"><Phone className="h-4 w-4 text-slate-400" /> Teléfono *</Label>
                <div className="flex items-center gap-2">
                  <div className="relative flex-1"><Input placeholder="Ej: 999888777" value={fPh} onChange={e => { setFPh(e.target.value.replace(/\D/g, '').slice(0, 9)); setPhOk(false); }} className={`pr-14 bg-white font-mono tracking-wider ${vb(fPh, phOk_)}`} /><div className="absolute right-3 top-1/2 -translate-y-1/2 flex items-center gap-1">{fPh.length > 0 && (phOk_ ? <CheckCircle2 className="h-3.5 w-3.5 text-emerald-500" /> : <XCircle className="h-3.5 w-3.5 text-red-400" />)}<span className={`text-xs font-medium tabular-nums ${fPh.length === 9 ? 'text-emerald-600' : 'text-slate-400'}`}>{fPh.length}/9</span></div></div>
                  <Button type="button" variant="outline" className={`shrink-0 h-10 ${phOk && phOk_ ? 'bg-emerald-50 border-emerald-200 text-emerald-700 hover:bg-emerald-100' : 'border-slate-200'}`} disabled={!phOk_ || vPh} onClick={onVerifyPh}>{vPh ? <Loader2 className="h-4 w-4 mr-1.5 animate-spin" /> : phOk && phOk_ ? <CheckCircle2 className="h-4 w-4 mr-1.5" /> : null} Verificar</Button>
                </div>
                <p className="text-xs text-slate-400">9 dígitos, empieza con 9</p>
              </div>

              <div className="space-y-2"><Label className="text-sm font-semibold text-slate-700 flex items-center gap-2"><MapPin className="h-4 w-4 text-slate-400" /> Dirección <span className="text-slate-400 font-normal">(opcional)</span></Label><Input placeholder="Ej: Av. Principal 123, Lima" value={fAd} onChange={e => setFAd(e.target.value)} className="bg-white border-slate-200" /></div>

              <Separator />
              <div className="space-y-2">
                <Label className="text-sm font-semibold text-slate-700 flex items-center gap-2"><Shield className="h-4 w-4 text-emerald-600" /> Rol *</Label>
                <div className="grid grid-cols-3 gap-3">{ROLES.map(o => { const s = fR === o.value; const c = RC[o.color]; return <button key={o.value} type="button" className={`relative flex flex-col items-center gap-2 p-3 rounded-xl border-2 transition-all cursor-pointer text-center group ${s ? c.s : c.u}`} onClick={() => setFR(o.value)}>{s && <div className="absolute -top-1.5 -right-1.5"><CheckCircle2 className={`h-5 w-5 ${c.ck} fill-current stroke-white`} /></div>}<div className={`w-9 h-9 rounded-full flex items-center justify-center ${s ? c.ib : 'bg-slate-100'}`}><o.icon className={`h-4 w-4 ${s ? c.ic : 'text-slate-400'}`} /></div><div><p className={`font-semibold text-sm ${s ? c.lb : 'text-slate-700'}`}>{o.label}</p><p className="text-xs text-slate-500 mt-0.5 leading-tight">{o.desc}</p></div></button>; })}</div>
              </div>

              <Separator />
              <div className="space-y-2"><Label className="text-sm font-semibold text-slate-700 flex items-center gap-2"><KeyRound className="h-4 w-4 text-slate-400" /> Contraseña *</Label><VInput value={fPw} valid={pwOk} type="password" placeholder="Mínimo 4 caracteres" onChange={e => setFPw(e.target.value)} /></div>

              <div className="pt-3 flex items-center gap-3">
                <Button className="flex-1 bg-gradient-to-r from-emerald-500 to-teal-500 hover:from-emerald-600 hover:to-teal-600 text-white shadow-md h-11 text-sm font-semibold" onClick={onRegister} disabled={!formOk || submitting}>{submitting ? <><Loader2 className="h-4 w-4 mr-2 animate-spin" /> Registrando...</> : <><UserPlus className="h-4 w-4 mr-2" /> Registrar Personal</>}</Button>
                <Button variant="outline" className="border-slate-200 h-11" onClick={() => setRegOpen(false)} disabled={submitting}>Cancelar</Button>
              </div>
            </div>
          </ScrollArea>
        </DialogContent>
      </Dialog>

      <Sheet open={detOpen} onOpenChange={setDetOpen}>
        <SheetContent side="right" className="w-full sm:max-w-xl overflow-y-auto">
          {sel && (() => { const rs = RS[sel.role] || { c: 'bg-slate-100 text-slate-600 border-slate-200', l: sel.role }; const ds = DS[sel.documentType] || { c: 'bg-slate-50 text-slate-600 border-slate-200', l: sel.documentType }; const Ic = RI[sel.role] || User; return (
            <>
              <SheetHeader className="pb-4 border-b border-slate-100"><div className="flex items-center gap-3"><div className={`w-12 h-12 rounded-full flex items-center justify-center ${sel.isActive ? 'bg-emerald-100' : 'bg-slate-100'}`}><Ic className={`h-6 w-6 ${sel.isActive ? 'text-emerald-600' : 'text-slate-400'}`} /></div><div className="flex-1 min-w-0"><SheetTitle className="text-lg">{sel.name || 'Sin nombre'}</SheetTitle><SheetDescription className="flex items-center gap-2 mt-0.5 flex-wrap"><Badge variant="outline" className={`text-xs ${rs.c}`}>{rs.l}</Badge><Badge variant="outline" className={`text-xs ${ds.c}`}>{ds.l}: {sel.documentNumber || '—'}</Badge><Badge variant="outline" className={`text-xs ${actBadge(sel.isActive)}`}>{actLabel(sel.isActive)}</Badge></SheetDescription></div></div></SheetHeader>
              <div className="p-4 space-y-5">
                <div className="space-y-2"><h4 className="text-sm font-semibold text-slate-700">Contacto</h4><div className="space-y-1.5 text-sm text-slate-600"><div className="flex items-center gap-2"><Mail className="h-4 w-4 text-slate-400 shrink-0" />{sel.email}</div>{sel.phone && <div className="flex items-center gap-2"><Phone className="h-4 w-4 text-slate-400 shrink-0" />{sel.phone}</div>}{sel.address && <div className="flex items-center gap-2"><MapPin className="h-4 w-4 text-slate-400 shrink-0" />{sel.address}</div>}</div></div>
                <Separator />
                <div className="space-y-2"><h4 className="text-sm font-semibold text-slate-700">Documento</h4><div className="flex items-center gap-3 p-2.5 rounded-xl bg-slate-50 border border-slate-100"><Badge variant="outline" className={`text-xs ${ds.c}`}>{ds.l}</Badge><span className="text-lg font-mono font-semibold text-slate-800">{sel.documentNumber || '—'}</span></div></div>
                <Separator />
                {sel.role === 'collector' && (<><div className="space-y-2"><h4 className="text-sm font-semibold text-slate-700">Estadísticas</h4><div className="grid grid-cols-2 gap-3"><div className="p-3 rounded-xl bg-emerald-50 border border-emerald-100"><p className="text-2xl font-bold text-emerald-700">{sel._count.loans}</p><p className="text-xs text-emerald-600">Préstamos</p></div><div className="p-3 rounded-xl bg-teal-50 border border-teal-100"><p className="text-2xl font-bold text-teal-700">{sel._count.payments}</p><p className="text-xs text-teal-600">Pagos</p></div></div></div><Separator /></>)}
                <p className="text-sm text-slate-500">Registrado el {new Date(sel.createdAt).toLocaleDateString('es-PE', { day: '2-digit', month: 'long', year: 'numeric' })}</p>
                <Separator />
                <div className="space-y-3"><h4 className="text-sm font-semibold text-slate-700">Acciones</h4><div className="flex items-center justify-between p-3 rounded-xl bg-slate-50 border border-slate-100"><div><p className="text-sm font-medium text-slate-800">{sel.isActive ? 'Desactivar' : 'Activar'} Personal</p><p className="text-xs text-slate-500">{sel.isActive ? 'No podrá acceder al sistema' : 'Podrá acceder nuevamente'}</p></div><Switch checked={sel.isActive} onCheckedChange={() => onToggle(sel)} disabled={toggling === sel.id} className="data-[state=checked]:bg-emerald-500" /></div><Button variant="outline" className="w-full border-red-200 text-red-600 hover:bg-red-50 hover:text-red-700 hover:border-red-300" disabled={deleting === sel.id} onClick={() => onDel(sel)}>{deleting === sel.id ? <><Loader2 className="h-4 w-4 mr-2 animate-spin" /> Eliminando...</> : <><Trash2 className="h-4 w-4 mr-2" /> Eliminar Personal</>}</Button></div>
              </div>
            </>
          ); })()}
        </SheetContent>
      </Sheet>
    </div>
  );
}
