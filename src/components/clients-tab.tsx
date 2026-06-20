'use client';
import React,{useState,useEffect,useCallback,useMemo}from 'react';
import{Search,RefreshCw,Eye,Pencil,Trash2,ChevronLeft,ChevronRight,Loader2,User,Phone,MapPin,CreditCard,Users,AlertTriangle,CheckCircle2,XCircle,FileText,TrendingUp,Shield,Calendar,UserPlus,IdCard,Globe,CheckCheck,BadgeCheck,BookOpen,Fingerprint,ScanLine}from'lucide-react';
import{Card,CardContent}from'@/components/ui/card';
import{Button}from'@/components/ui/button';
import{Input}from'@/components/ui/input';
import{Label}from'@/components/ui/label';
import{Badge}from'@/components/ui/badge';
import{Progress}from'@/components/ui/progress';
import{ScrollArea}from'@/components/ui/scroll-area';
import{Separator}from'@/components/ui/separator';
import{Dialog,DialogContent,DialogHeader,DialogTitle,DialogDescription,DialogFooter}from'@/components/ui/dialog';
import{Sheet,SheetContent,SheetHeader,SheetTitle,SheetDescription}from'@/components/ui/sheet';
import{Select,SelectContent,SelectItem,SelectTrigger,SelectValue}from'@/components/ui/select';
import{Slider}from'@/components/ui/slider';
import{Skeleton}from'@/components/ui/skeleton';
import{Alert,AlertDescription}from'@/components/ui/alert';
import{AlertDialog,AlertDialogContent,AlertDialogHeader,AlertDialogFooter,AlertDialogTitle,AlertDialogDescription,AlertDialogAction,AlertDialogCancel}from'@/components/ui/alert-dialog';
import{useToast}from'@/hooks/use-toast';
import{useAuth}from'@/hooks/use-auth';

interface PaymentItem{id:string;amount:number;paymentMethod:string;paymentDate:string;status:string}
interface CWS{id:string;name:string;documentType:string;documentNumber:string;phone:string;address:string|null;zoneId:string|null;zone:{id:string;name:string}|null;creditScore:number|null;photoUrl:string|null;createdAt:string;guarantors:{id:string;name:string;phone:string|null}[];loans:{id:string;status:string;amount:number;totalAmount:number;amountPaid:number;payments?:PaymentItem[]}[];stats:{totalLoans:number;activeLoans:number;totalLoaned:number;totalPaid:number;hasMora:boolean}}
interface Zone{id:string;name:string}
interface VR{verified:boolean;documentType:string;documentNumber:string;found:boolean;results:{clients:{id:string;name:string;phone:string;documentType:string;documentNumber:string;zone:string|null;creditScore:number|null;hasActiveLoans:boolean}[];staff:{id:string;name:string;phone:string;role:string}[]}}
type DT='dni'|'carnet_extranjeria'|'pasaporte';
const DTs:{v:DT;lb:string;ic:typeof IdCard;dg:number}[]=[{v:'dni',lb:'DNI',ic:IdCard,dg:8},{v:'carnet_extranjeria',lb:'Carnet de Extranjería',ic:Globe,dg:9},{v:'pasaporte',lb:'Pasaporte',ic:BookOpen,dg:9}];
const dtCfg=(t:string)=>DTs.find(d=>d.v===t)||DTs[0];
const fC=(n:number)=>`S/${n.toLocaleString('es-PE',{minimumFractionDigits:2,maximumFractionDigits:2})}`;
const fD=(s:string)=>new Date(s).toLocaleDateString('es-PE',{day:'2-digit',month:'short',year:'numeric'});
const gDN=(c:CWS)=>(c as Record<string,unknown>).documentNumber as string||(c as Record<string,unknown>).dni as string||'';
const DTL:Record<string,string>={dni:'DNI',carnet_extranjeria:'Carnet Ext.',pasaporte:'Pasaporte'};
const GB='bg-gradient-to-r from-emerald-500 to-teal-500 hover:from-emerald-600 hover:to-teal-600 text-white border-0';
const sC=(s:number|null)=>{if(s===null)return{bg:'bg-slate-100 dark:bg-slate-800',tx:'text-slate-600 dark:text-slate-400',bd:'border-slate-200 dark:border-slate-700',lb:'Sin score',br:'bg-slate-400'};if(s<=30)return{bg:'bg-red-100 dark:bg-red-900/50',tx:'text-red-700 dark:text-red-300',bd:'border-red-200 dark:border-red-800',lb:'Malo',br:'bg-red-500'};if(s<=60)return{bg:'bg-amber-100 dark:bg-amber-900/50',tx:'text-amber-700 dark:text-amber-300',bd:'border-amber-200 dark:border-amber-800',lb:'Regular',br:'bg-amber-500'};return{bg:'bg-emerald-100 dark:bg-emerald-900/50',tx:'text-emerald-700 dark:text-emerald-300',bd:'border-emerald-200 dark:border-emerald-800',lb:'Bueno',br:'bg-emerald-500'}};
const lB=(st:string)=>{const m:Record<string,[string,string]>={active:['bg-emerald-100 dark:bg-emerald-900/50 text-emerald-800 dark:text-emerald-200 border-emerald-200 dark:border-emerald-800','Activo'],mora:['bg-red-100 dark:bg-red-900/50 text-red-800 dark:text-red-200 border-red-200 dark:border-red-800','Mora'],completed:['bg-teal-100 dark:bg-teal-900/50 text-teal-800 dark:text-teal-200 border-teal-200 dark:border-teal-800','Pagado'],paid:['bg-teal-100 dark:bg-teal-900/50 text-teal-800 dark:text-teal-200 border-teal-200 dark:border-teal-800','Pagado'],cancelled:['bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 border-slate-200 dark:border-slate-700','Cancelado'],refinanced:['bg-amber-100 dark:bg-amber-900/50 text-amber-800 dark:text-amber-200 border-amber-200 dark:border-amber-800','Refinanciado']};return m[st]||['bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 border-slate-200 dark:border-slate-700',st]};
const dSB=(t:string)=>{if(t==='dni'||t==='peruano')return['DNI','bg-blue-50 dark:bg-blue-950/50 text-blue-700 dark:text-blue-300 border-blue-200'];if(t==='carnet_extranjeria'||t==='extranjero')return['CE','bg-purple-50 dark:bg-purple-950/50 text-purple-700 dark:text-purple-300 border-purple-200'];if(t==='pasaporte')return['PAS','bg-amber-50 dark:bg-amber-950/50 text-amber-700 dark:text-amber-300 border-amber-200'];return['DOC','bg-slate-50 dark:bg-slate-800 text-slate-600 dark:text-slate-400 border-slate-200']};
const vDoc=(v:string,t:DT)=>{const c=dtCfg(t),cl=v.replace(/\D/g,'');if(!cl)return[false,`Ingrese ${c.lb}`];if(cl.length!==c.dg)return[false,`${c.dg} dígitos requeridos`];return[true,`${c.lb} válido`]};
const vPh=(v:string)=>{const cl=v.replace(/\D/g,'');if(!cl)return[false,'Ingrese teléfono'];if(!cl.startsWith('9'))return[false,'Debe iniciar con 9'];if(cl.length!==9)return[false,'9 dígitos requeridos'];return[true,'Teléfono válido']};
const vB=(v:[boolean,string]|null)=>v?(v[0]?'border-emerald-400 focus-visible:ring-emerald-400':'border-red-400 focus-visible:ring-red-400'):'';
const avt=(c:CWS)=>c.stats.hasMora?['bg-red-100 dark:bg-red-900/50','text-red-600 dark:text-red-300']:c.stats.activeLoans>0?['bg-emerald-100 dark:bg-emerald-900/50','text-emerald-600 dark:text-emerald-300']:['bg-teal-100 dark:bg-teal-900/50','text-teal-600 dark:text-teal-300'];
const PAYMENT_METHOD_LABELS: Record<string, string> = {efectivo:'Efectivo',yape:'Yape',plin:'Plin',transferencia:'Transferencia'};
const fDT2=(s:string)=>new Date(s).toLocaleDateString('es-PE',{day:'2-digit',month:'short',year:'numeric',hour:'2-digit',minute:'2-digit'});

export default function ClientsTab({refreshTrigger}:{refreshTrigger?:number}){
const{toast}=useToast();
const{user}=useAuth();
const isAdmin=user?.role==='admin';
const[clients,setClients]=useState<CWS[]>([]);
const[zones,setZones]=useState<Zone[]>([]);
const[loading,setLoading]=useState(true);
const[totalC,setTotalC]=useState(0);
const[totalP,setTotalP]=useState(1);
const[page,setPage]=useState(1);
const[search,setSearch]=useState('');
const[zoneF,setZoneF]=useState('all');
const[fOpen,setFOpen]=useState(false);
const[editing,setEditing]=useState<CWS|null>(null);
const[saving,setSaving]=useState(false);
const[fName,setFName]=useState('');
const[fDT,setFDT]=useState<DT>('dni');
const[fDN,setFDN]=useState('');
const[fPh,setFPh]=useState('');
const[fAddr,setFAddr]=useState('');
const[fZone,setFZone]=useState('');
const[fScore,setFScore]=useState([50]);
const[phOk,setPhOk]=useState(false);
const[vDocing,setVDocing]=useState(false);
const[vRes,setVRes]=useState<VR|null>(null);
const[detC,setDetC]=useState<CWS|null>(null);
const[detO,setDetO]=useState(false);
const[delC,setDelC]=useState<CWS|null>(null);
const[deling,setDeling]=useState(false);

const docV=useMemo(()=>fDN?vDoc(fDN,fDT):null,[fDN,fDT]);
const phV=useMemo(()=>fPh?vPh(fPh):null,[fPh]);
const nOk=fName.trim().length>0;
const dOk=docV?.[0]??false;
const pOk=phV?.[0]??false;
const formOk=nOk&&dOk&&pOk;

const fetchC=useCallback(async()=>{
setLoading(true);
try{const p=new URLSearchParams({page:page.toString(),limit:'20'});if(search.trim())p.set('search',search.trim());if(zoneF!=='all')p.set('zoneId',zoneF);const r=await fetch(`/api/clients?${p}`);if(r.ok){const d=await r.json();setClients(d.clients);setTotalC(d.pagination.total);setTotalP(d.pagination.totalPages)}}catch{toast({title:'Error',description:'No se pudieron cargar los clientes',variant:'destructive'})}
finally{setLoading(false)}
},[page,search,zoneF,toast]);

const fetchZ=useCallback(async()=>{try{const r=await fetch('/api/zones');if(r.ok)setZones((await r.json()).zones)}catch{}},[]);
useEffect(()=>{fetchC()},[fetchC]);
useEffect(()=>{fetchZ()},[fetchZ]);
useEffect(()=>{if(refreshTrigger)fetchC()},[refreshTrigger,fetchC]);

const wA=clients.filter(c=>c.stats.activeLoans>0).length;
const iM=clients.filter(c=>c.stats.hasMora).length;
const aS=clients.length?Math.round(clients.filter(c=>c.creditScore!==null).reduce((s,c)=>s+(c.creditScore||0),0)/Math.max(clients.filter(c=>c.creditScore!==null).length,1)):0;

const reset=()=>{setFName('');setFDT('dni');setFDN('');setFPh('');setFAddr('');setFZone('');setFScore([50]);setPhOk(false);setVDocing(false);setVRes(null);setEditing(null)};
const openNew=()=>{reset();setFOpen(true)};
const openEdit=(c:CWS)=>{setEditing(c);setFName(c.name);let dt:DT='dni';if(c.documentType==='carnet_extranjeria'||c.documentType==='extranjero')dt='carnet_extranjeria';else if(c.documentType==='pasaporte')dt='pasaporte';setFDT(dt);setFDN(gDN(c));setFPh(c.phone);setFAddr(c.address||'');setFZone(c.zoneId||'');setFScore([c.creditScore??50]);setPhOk(vPh(c.phone)[0]);setVRes(null);setFOpen(true)};
const onDTC=(t:DT)=>{setFDT(t);setFDN('');setVRes(null)};
const onDNC=(v:string)=>{setFDN(v.replace(/\D/g,'').slice(0,dtCfg(fDT).dg));setVRes(null)};
const onPhC=(v:string)=>{setFPh(v.replace(/\D/g,'').slice(0,9));setPhOk(false)};
const verPh=()=>{const v=vPh(fPh);if(v[0]){setPhOk(true);toast({title:'Teléfono verificado'})}else{setPhOk(false);toast({title:'Teléfono inválido',description:v[1],variant:'destructive'})}};
const verDoc=async()=>{if(!dOk)return;setVDocing(true);setVRes(null);try{const r=await fetch(`/api/verify-document?documentType=${fDT}&documentNumber=${fDN}`);if(r.ok){const d:VR=await r.json();setVRes(d);toast(d.found?{title:'Documento encontrado',description:`${d.results.clients.length} cliente(s), ${d.results.staff.length} personal(es)`}:{title:'Verificado',description:'Sin registros previos'})}else toast({title:'Error',description:'No se pudo verificar',variant:'destructive'})}catch{toast({title:'Error',description:'Error de conexión',variant:'destructive'})}finally{setVDocing(false)}};
const save=async()=>{if(!fName.trim()){toast({title:'Campo requerido',description:'Nombre obligatorio',variant:'destructive'});return}const dv=vDoc(fDN,fDT);if(!dv[0]){toast({title:'Documento inválido',description:dv[1],variant:'destructive'});return}const pv=vPh(fPh);if(!pv[0]){toast({title:'Teléfono inválido',description:pv[1],variant:'destructive'});return}setSaving(true);try{const body={name:fName.trim(),documentType:fDT,documentNumber:fDN.trim(),phone:fPh.trim(),address:fAddr.trim()||null,zoneId:fZone||null,creditScore:fScore[0],...(editing?{id:editing.id}:{})};const r=await fetch('/api/clients',{method:editing?'PUT':'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(body)});if(r.ok){toast({title:editing?'Cliente actualizado':'Cliente creado'});setFOpen(false);reset();fetchC()}else{const d=await r.json();toast({title:'Error',description:d.error||'Error al guardar',variant:'destructive'})}}catch{toast({title:'Error',description:'Error de conexión',variant:'destructive'})}finally{setSaving(false)}};
const del=async()=>{if(!delC)return;setDeling(true);try{const r=await fetch(`/api/clients?id=${delC.id}`,{method:'DELETE'});if(r.ok){toast({title:'Eliminado',description:`${delC.name} eliminado`});setDelC(null);fetchC()}else{const d=await r.json();toast({title:'Error',description:d.error||'Error',variant:'destructive'})}}catch{toast({title:'Error',description:'Error de conexión',variant:'destructive'})}finally{setDeling(false)}};

const curD=dtCfg(fDT);
const stCards:[string,string|number,string,typeof Users,string,string][]=[['Total Clientes',totalC,'from-emerald-500 to-emerald-600',Users,'text-emerald-200','text-emerald-100'],['Con Préstamo',wA,'from-teal-500 to-teal-600',CreditCard,'text-teal-200','text-teal-100'],['En Mora',iM,'from-red-500 to-rose-600',AlertTriangle,'text-red-200','text-red-100'],['Score Promedio',`${aS}/100`,'from-amber-500 to-orange-500',Shield,'text-amber-200','text-amber-100']];

return(
<div className="space-y-6">
{/* Summary */}
<div className="grid grid-cols-2 md:grid-cols-4 gap-4">
{stCards.map(([lb,val,gr,Ic,ic,lc],i)=>(
<Card key={i} className={`border-0 shadow-md bg-gradient-to-br ${gr} text-white`}>
<CardContent className="p-4"><div className="flex items-center justify-between"><div><p className={`${lc} text-xs font-medium`}>{lb}</p><p className="text-2xl font-bold mt-1">{val}</p></div><Ic className={`h-8 w-8 ${ic}`}/></div></CardContent>
</Card>))}
</div>

{/* Toolbar */}
<div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
<div className="flex items-center gap-2 flex-wrap">
<div className="relative"><Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400"/><Input placeholder="Buscar..." value={search} onChange={e=>{setSearch(e.target.value);setPage(1)}} className="pl-9 w-full sm:w-64 bg-white dark:bg-slate-900 border-slate-200"/></div>
<Select value={zoneF} onValueChange={v=>{setZoneF(v);setPage(1)}}><SelectTrigger className="w-full sm:w-44 bg-white dark:bg-slate-900 border-slate-200"><MapPin className="h-4 w-4 mr-2 text-slate-400"/><SelectValue placeholder="Zonas"/></SelectTrigger><SelectContent><SelectItem value="all">Todas</SelectItem>{zones.map(z=><SelectItem key={z.id} value={z.id}>{z.name}</SelectItem>)}</SelectContent></Select>
</div>
<div className="flex items-center gap-2 w-full sm:w-auto">
<Button variant="outline" size="icon" className="border-slate-200" onClick={fetchC}><RefreshCw className="h-4 w-4"/></Button>
<Button className={`${GB} shadow-lg shadow-emerald-500/20`} onClick={openNew}><UserPlus className="h-4 w-4 mr-2"/><span className="hidden sm:inline">Nuevo Cliente</span><span className="sm:hidden">Nuevo</span></Button>
</div>
</div>

{/* List */}
{loading?<div className="space-y-4">{[...Array(5)].map((_,i)=><Card key={i} className="border-0 shadow-md"><CardContent className="p-4"><div className="flex items-center gap-4"><Skeleton className="h-12 w-12 rounded-full"/><div className="flex-1 space-y-2"><Skeleton className="h-4 w-48"/><Skeleton className="h-3 w-32"/></div></div></CardContent></Card>)}</div>
:!clients.length?<Card className="border-0 shadow-md"><CardContent className="p-12 text-center"><div className="w-16 h-16 rounded-full bg-slate-100 dark:bg-slate-800 flex items-center justify-center mx-auto mb-4"><Users className="h-8 w-8 text-slate-400 dark:text-slate-500"/></div><h3 className="text-lg font-semibold text-slate-700 dark:text-slate-300 mb-2">No hay clientes</h3><p className="text-slate-500 dark:text-slate-400 mb-4">{search||zoneF!=='all'?'Sin resultados':'Registre el primer cliente'}</p><Button className={GB} onClick={openNew}><UserPlus className="h-4 w-4 mr-2"/>Registrar</Button></CardContent></Card>
:<div className="space-y-3">
{clients.map(c=>{const sc=sC(c.creditScore),[dl,dc]=dSB(c.documentType),dn=gDN(c),[ab,at]=avt(c);return(
<Card key={c.id} className={`border-0 shadow-md hover:shadow-lg transition-all cursor-pointer ${c.stats.hasMora?'border-l-4 border-l-red-500':''}`} onClick={()=>{setDetC(c);setDetO(true)}}>
<CardContent className="p-4">
<div className="flex items-center gap-3">
<div className={`w-10 h-10 rounded-full flex items-center justify-center shrink-0 ${ab}`}><User className={`h-5 w-5 ${at}`}/></div>
<div className="flex-1 min-w-0">
<div className="flex items-center gap-2 flex-wrap"><h4 className="font-semibold text-slate-900 dark:text-slate-100 truncate">{c.name}</h4><Badge variant="outline" className={`text-[10px] px-1.5 py-0 h-5 ${dc}`}>{dl}</Badge>{c.stats.hasMora&&<Badge variant="outline" className="bg-red-100 dark:bg-red-900/50 text-red-800 dark:text-red-200 border-red-200 dark:border-red-800 text-xs"><AlertTriangle className="h-3 w-3 mr-1"/>Mora</Badge>}</div>
<div className="flex items-center gap-3 text-xs text-slate-500 dark:text-slate-400 mt-0.5 flex-wrap"><span className="flex items-center gap-1"><FileText className="h-3 w-3"/>{dn}</span><span className="flex items-center gap-1"><Phone className="h-3 w-3"/>{c.phone}</span>{c.zone&&<span className="flex items-center gap-1"><MapPin className="h-3 w-3"/>{c.zone.name}</span>}<Badge variant="outline" className={`${sc.bg} ${sc.tx} ${sc.bd} text-[10px] font-semibold hidden sm:inline-flex`}>{c.creditScore??'N/A'} {sc.lb}</Badge></div>
</div>
<div className="hidden md:flex items-center gap-4 text-center shrink-0"><div><p className="text-[10px] text-slate-400">Préstamos</p><p className="font-bold text-sm">{c.stats.activeLoans}/{c.stats.totalLoans}</p></div><div><p className="text-[10px] text-slate-400">Prestado</p><p className="font-bold text-sm">{fC(c.stats.totalLoaned)}</p></div><div><p className="text-[10px] text-slate-400">Pagado</p><p className="font-bold text-sm text-emerald-600 dark:text-emerald-300">{fC(c.stats.totalPaid)}</p></div></div>
<div className="flex items-center gap-1 shrink-0" onClick={e=>e.stopPropagation()}>
<Button variant="ghost" size="icon" className="h-8 w-8 text-slate-400 hover:text-emerald-600 dark:text-emerald-300" onClick={()=>{setDetC(c);setDetO(true)}}><Eye className="h-4 w-4"/></Button>
<Button variant="ghost" size="icon" className="h-8 w-8 text-slate-400 hover:text-amber-600 dark:text-amber-300" onClick={()=>openEdit(c)}><Pencil className="h-4 w-4"/></Button>
{isAdmin&&<Button variant="ghost" size="icon" className={`h-8 w-8 ${c.stats.activeLoans>0?'text-slate-300':'text-slate-400 hover:text-red-600 dark:text-red-300'}`} disabled={c.stats.activeLoans>0} onClick={()=>!c.stats.activeLoans&&setDelC(c)}><Trash2 className="h-4 w-4"/></Button>}
</div>
</div>
</CardContent>
</Card>)})}
{totalP>1&&<div className="flex items-center justify-center gap-2 pt-4"><Button variant="outline" size="sm" disabled={page<=1} onClick={()=>setPage(page-1)}><ChevronLeft className="h-4 w-4"/></Button><span className="text-sm text-slate-600 dark:text-slate-400">{page}/{totalP}</span><Button variant="outline" size="sm" disabled={page>=totalP} onClick={()=>setPage(page+1)}><ChevronRight className="h-4 w-4"/></Button></div>}
</div>}

{/* Form Dialog */}
<Dialog open={fOpen} onOpenChange={o=>{if(!o)reset();setFOpen(o)}}>
<DialogContent className="max-w-xl max-h-[85vh] overflow-hidden flex flex-col p-0 gap-0 sm:max-h-[90vh]">
<DialogHeader className="px-6 pt-6 pb-4 border-b border-slate-100 dark:border-slate-800 bg-gradient-to-r from-slate-50 to-white dark:from-slate-900 dark:to-slate-900">
<DialogTitle className="flex items-center gap-3"><div className="w-10 h-10 rounded-xl bg-gradient-to-br from-emerald-500 to-teal-600 flex items-center justify-center shadow-lg shadow-emerald-500/25">{editing?<Pencil className="h-5 w-5 text-white"/>:<UserPlus className="h-5 w-5 text-white"/>}</div><div><span>{editing?'Editar':'Nuevo'} Cliente</span><DialogDescription className="text-sm mt-0.5">{editing?'Modifica los datos':'Registra un nuevo cliente'}</DialogDescription></div></DialogTitle>
</DialogHeader>
<ScrollArea className="flex-1 min-h-0 overflow-y-auto">
<div className="px-6 py-5 space-y-5">
{/* Doc Type */}
<div className="space-y-2">
<Label className="text-sm font-semibold text-slate-700 dark:text-slate-300 flex items-center gap-2"><Fingerprint className="h-4 w-4 text-emerald-600 dark:text-emerald-300"/>Tipo de documento <span className="text-red-500">*</span></Label>
<div className="grid grid-cols-3 gap-3">{DTs.map(dt=>{const sel=fDT===dt.v;const Ic=dt.ic;return(
              <button key={dt.v} type="button" onClick={()=>onDTC(dt.v)} disabled={editing} className={`relative flex flex-col items-center gap-1.5 p-3 rounded-xl border-2 transition-all cursor-pointer focus:outline-none focus:ring-2 focus:ring-emerald-400 ${sel?'border-emerald-500 bg-emerald-50 shadow-md ring-1 ring-emerald-500/30':'border-slate-200 bg-white dark:bg-slate-900 hover:border-emerald-300'} ${editing?'opacity-60 cursor-not-allowed':''}`}>
{sel&&<div className="absolute -top-1.5 -right-1.5 w-5 h-5 bg-emerald-500 rounded-full flex items-center justify-center"><CheckCircle2 className="h-3 w-3 text-white"/></div>}
<div className={`w-9 h-9 rounded-lg flex items-center justify-center ${sel?'bg-emerald-500':'bg-slate-100 dark:bg-slate-800'}`}><Ic className={`h-5 w-5 ${sel?'text-white':'text-slate-500 dark:text-slate-400'}`}/></div>
<span className={`text-sm font-bold ${sel?'text-emerald-700 dark:text-emerald-300':'text-slate-700 dark:text-slate-300'}`}>{DTL[dt.v]}</span>
<span className={`text-[11px] ${sel?'text-emerald-600 dark:text-emerald-300':'text-slate-400'}`}>{dt.dg} dígitos</span>
</button>)})}</div>
</div>
{/* Doc Number */}
<div className="space-y-2">
<Label htmlFor="dn" className="text-sm font-semibold text-slate-700 dark:text-slate-300">Número de {curD.lb} <span className="text-red-500">*</span></Label>
<div className="flex items-center gap-2">
<div className="relative flex-1">
                              <Input id="dn" placeholder={curD.dg===8?'12345678':'123456789'} value={fDN} onChange={e=>onDNC(e.target.value)} maxLength={curD.dg} className={`bg-white dark:bg-slate-900 pr-20 h-11 font-mono tracking-wider ${vB(docV)}`} disabled={editing}/>
<div className={`absolute right-3 top-1/2 -translate-y-1/2 flex items-center gap-1.5 ${docV?.[0]?'text-emerald-600 dark:text-emerald-300':'text-slate-400'}`}><span className="text-xs font-mono">{fDN.length}/{curD.dg}</span>{docV&&(docV[0]?<CheckCircle2 className="h-4 w-4 text-emerald-500"/>:<XCircle className="h-4 w-4 text-red-400"/>)}</div>
</div>
                              <Button type="button" variant="outline" className={`h-11 shrink-0 px-4 font-semibold ${dOk?'border-emerald-300 text-emerald-700 dark:text-emerald-300 bg-emerald-50/50 dark:bg-emerald-950/30':'border-slate-200 text-slate-400'}`} onClick={verDoc} disabled={!dOk||vDocing||editing}>{vDocing?<Loader2 className="h-4 w-4 mr-1.5 animate-spin"/>:vRes?<CheckCheck className="h-4 w-4 mr-1.5 text-emerald-600 dark:text-emerald-300"/>:<ScanLine className="h-4 w-4 mr-1.5"/>}{vDocing?'Verif...':vRes?'Verificado':'Verificar'}</Button>
</div>
{docV&&<p className={`text-xs ${docV[0]?'text-emerald-600 dark:text-emerald-300':'text-red-500'}`}>{docV[1]}</p>}
{vRes&&<div className="mt-2 rounded-lg border border-slate-200 dark:border-slate-700 overflow-hidden text-sm">
<div className={`px-3 py-2 flex items-center gap-2 ${vRes.found?'bg-amber-50 dark:bg-amber-950/50 border-b border-amber-200':'bg-emerald-50 dark:bg-emerald-950/50 border-b border-emerald-200'}`}>{vRes.found?<><AlertTriangle className="h-4 w-4 text-amber-600 dark:text-amber-300"/><span className="font-semibold text-amber-700 dark:text-amber-300">Registros encontrados</span></>:<><CheckCircle2 className="h-4 w-4 text-emerald-600 dark:text-emerald-300"/><span className="font-semibold text-emerald-700 dark:text-emerald-300">Sin registros previos</span></>}</div>
{vRes.found&&<div className="p-2 space-y-1.5 max-h-36 overflow-y-auto bg-white dark:bg-slate-900">
{vRes.results.clients.map(cr=><div key={cr.id} className="flex items-center gap-2 p-2 bg-slate-50 dark:bg-slate-800/50 rounded-md text-xs"><User className="h-3.5 w-3.5 text-emerald-600 dark:text-emerald-300"/><span className="font-medium truncate">{cr.name}</span><span className="text-slate-500 dark:text-slate-400">{cr.phone}</span><Badge variant="outline" className={`text-[10px] ml-auto ${cr.hasActiveLoans?'bg-amber-50 dark:bg-amber-950/50 text-amber-700 dark:text-amber-300 border-amber-200':'bg-emerald-50 dark:bg-emerald-950/50 text-emerald-700 dark:text-emerald-300 border-emerald-200'}`}>{cr.hasActiveLoans?'Con préstamo':'Cliente'}</Badge></div>)}
{vRes.results.staff.map(sr=><div key={sr.id} className="flex items-center gap-2 p-2 bg-slate-50 dark:bg-slate-800/50 rounded-md text-xs"><Shield className="h-3.5 w-3.5 text-purple-600 dark:text-purple-300"/><span className="font-medium truncate">{sr.name}</span><span className="text-slate-500 dark:text-slate-400">{sr.phone}</span><Badge variant="outline" className="text-[10px] ml-auto bg-purple-50 dark:bg-purple-950/50 text-purple-700 dark:text-purple-300 border-purple-200">{sr.role}</Badge></div>)}
</div>}</div>}
</div>
{/* Name */}
<div className="space-y-2">
<Label htmlFor="nm" className="text-sm font-semibold text-slate-700 dark:text-slate-300">Nombre completo <span className="text-red-500">*</span></Label>
<div className="relative">                              <Input id="nm" placeholder="Juan Pérez García" value={fName} onChange={e=>setFName(e.target.value)} className={`bg-white dark:bg-slate-900 h-11 pr-10 ${fName?(nOk?'border-emerald-400 focus-visible:ring-emerald-400':'border-red-400 focus-visible:ring-red-400'):''}`} disabled={editing}/>{fName&&<div className="absolute right-3 top-1/2 -translate-y-1/2">{nOk?<CheckCircle2 className="h-4 w-4 text-emerald-500"/>:<XCircle className="h-4 w-4 text-red-400"/>}</div>}</div>
</div>
{/* Phone */}
<div className="space-y-2">
<Label htmlFor="ph" className="text-sm font-semibold text-slate-700 dark:text-slate-300">Teléfono <span className="text-red-500">*</span></Label>
<div className="flex items-center gap-2">
<div className="relative flex-1">
<Input id="ph" placeholder="999888777" value={fPh} onChange={e=>onPhC(e.target.value)} maxLength={9} className={`bg-white dark:bg-slate-900 h-11 pr-20 font-mono tracking-wider ${vB(phV)}`}/>
<div className={`absolute right-3 top-1/2 -translate-y-1/2 flex items-center gap-1.5 ${phV?.[0]?'text-emerald-600 dark:text-emerald-300':'text-slate-400'}`}><span className="text-xs font-mono">{fPh.length}/9</span>{phV&&(phOk?<BadgeCheck className="h-5 w-5 text-emerald-500"/>:phV[0]?<CheckCircle2 className="h-4 w-4 text-emerald-500"/>:<XCircle className="h-4 w-4 text-red-400"/>)}</div>
</div>
<Button type="button" variant="outline" className={`h-11 shrink-0 px-4 font-semibold ${phOk?'bg-emerald-50 dark:bg-emerald-950/50 border-emerald-300 text-emerald-700 dark:text-emerald-300':pOk?'border-emerald-300 text-emerald-700 dark:text-emerald-300':'border-slate-200 text-slate-400'}`} onClick={verPh} disabled={!pOk}>{phOk?<><CheckCheck className="h-4 w-4 mr-1.5"/>Verificado</>:<><BadgeCheck className="h-4 w-4 mr-1.5"/>Verificar</>}</Button>
</div>
{phV&&<p className={`text-xs ${phV[0]?'text-emerald-600 dark:text-emerald-300':'text-red-500'}`}>{phV[1]}</p>}
</div>
{/* Address */}
<div className="space-y-2">
<Label htmlFor="ad" className="text-sm font-semibold text-slate-700 dark:text-slate-300">Dirección <span className="text-slate-400 font-normal">(opcional)</span></Label>
<Input id="ad" placeholder="Av. Principal 123" value={fAddr} onChange={e=>setFAddr(e.target.value)} className="bg-white dark:bg-slate-900 h-11"/>
</div>
{/* Zone */}
<div className="space-y-2">
<Label className="text-sm font-semibold text-slate-700 dark:text-slate-300">Zona <span className="text-slate-400 font-normal">(opcional)</span></Label>
<Select value={fZone} onValueChange={setFZone}><SelectTrigger className="bg-white dark:bg-slate-900 border-slate-200 h-11"><MapPin className="h-4 w-4 mr-2 text-slate-400"/><SelectValue placeholder="Seleccionar zona"/></SelectTrigger><SelectContent>{zones.map(z=><SelectItem key={z.id} value={z.id}>{z.name}</SelectItem>)}</SelectContent></Select>
</div>
{/* Score */}
<div className="space-y-3">
<div className="flex items-center justify-between"><Label className="text-sm font-semibold text-slate-700 dark:text-slate-300">Score crediticio</Label><Badge variant="outline" className={`${sC(fScore[0]).bg} ${sC(fScore[0]).tx} ${sC(fScore[0]).bd} font-semibold`}>{fScore[0]} — {sC(fScore[0]).lb}</Badge></div>
<Slider value={fScore} onValueChange={setFScore} min={0} max={100} step={1}/>
<div className="flex justify-between text-xs text-slate-400"><span>0</span><span>30</span><span>60</span><span>100</span></div>
</div>
</div>
</ScrollArea>
<DialogFooter className="px-6 py-4 border-t border-slate-100 dark:border-slate-800 bg-gradient-to-r from-slate-50 to-white dark:from-slate-900 dark:to-slate-900">
<Button variant="outline" onClick={()=>{setFOpen(false);reset()}} disabled={saving} className="border-slate-200">Cancelar</Button>
<Button className={`${GB} shadow-lg shadow-emerald-500/20 min-w-[160px]`} onClick={save} disabled={saving||!formOk}>{saving?<><Loader2 className="h-4 w-4 mr-2 animate-spin"/>Guardando...</>:editing?<><CheckCircle2 className="h-4 w-4 mr-2"/>Actualizar</>:<><UserPlus className="h-4 w-4 mr-2"/>Registrar</>}</Button>
</DialogFooter>
</DialogContent>
</Dialog>

{/* Delete */}
<AlertDialog open={!!delC} onOpenChange={o=>{if(!o)setDelC(null)}}>
<AlertDialogContent>
<AlertDialogHeader>
<AlertDialogTitle className="flex items-center gap-2"><div className="w-8 h-8 rounded-lg bg-red-100 dark:bg-red-900/50 flex items-center justify-center"><AlertTriangle className="h-4 w-4 text-red-600 dark:text-red-300"/></div>Eliminar Cliente</AlertDialogTitle>
<AlertDialogDescription>¿Eliminar a <strong>{delC?.name}</strong>? No se puede deshacer.</AlertDialogDescription>
</AlertDialogHeader>
{delC&&delC.stats.activeLoans>0&&<Alert className="bg-red-50 dark:bg-red-950/50 border-red-200"><AlertTriangle className="h-4 w-4 text-red-600 dark:text-red-300"/><AlertDescription className="text-red-700 dark:text-red-300">Tiene {delC.stats.activeLoans} préstamo(s) activo(s).</AlertDescription></Alert>}
<AlertDialogFooter>
<AlertDialogCancel disabled={deling}>Cancelar</AlertDialogCancel>
<AlertDialogAction className="bg-red-600 hover:bg-red-700 text-white" onClick={del} disabled={deling||(delC?.stats.activeLoans??0)>0}>{deling?<><Loader2 className="h-4 w-4 mr-2 animate-spin"/>Eliminando...</>:'Eliminar'}</AlertDialogAction>
</AlertDialogFooter>
</AlertDialogContent>
</AlertDialog>

{/* Detail Sheet */}
<Sheet open={detO} onOpenChange={setDetO}>
<SheetContent side="right" className="w-full sm:max-w-xl overflow-y-auto">
{detC&&(()=>{const c=detC,dn=gDN(c),[dl,dc]=dSB(c.documentType),sc=sC(c.creditScore),[ab,at]=avt(c);return(<>
<SheetHeader className="pb-4 border-b border-slate-100 dark:border-slate-800">
<div className="flex items-center gap-3"><div className={`w-12 h-12 rounded-full flex items-center justify-center ${ab}`}><User className={`h-6 w-6 ${at}`}/></div><div><SheetTitle className="text-lg">{c.name}</SheetTitle><SheetDescription className="flex items-center gap-2 mt-0.5"><Badge variant="outline" className={`text-[10px] px-1.5 py-0 h-5 ${dc}`}>{dl}</Badge>{dn}</SheetDescription></div></div>
</SheetHeader>
<div className="p-4 space-y-5">
<Card className="border-0 shadow-sm"><CardContent className="p-4">
<div className="flex items-center justify-between mb-2"><span className="text-sm font-medium text-slate-700 dark:text-slate-300">Score</span><Badge variant="outline" className={`font-bold ${sc.bg} ${sc.tx} ${sc.bd}`}>{c.creditScore??'N/A'} — {sc.lb}</Badge></div>
{c.creditScore!==null&&<><Progress value={c.creditScore} className={`h-3 [&>div]:${sc.br}`}/><div className="flex justify-between text-xs text-slate-400"><span>0</span><span>30</span><span>60</span><span>100</span></div></>}
</CardContent></Card>
<div className="space-y-2">
<h3 className="text-sm font-semibold text-slate-700 dark:text-slate-300 flex items-center gap-2"><Phone className="h-4 w-4 text-emerald-500"/>Información</h3>
<div className="flex items-center gap-3 p-3 bg-slate-50 dark:bg-slate-800/50 rounded-lg"><IdCard className="h-4 w-4 text-slate-400"/><div><p className="text-xs text-slate-400">Documento</p><p className="text-sm font-medium">{dl} {dn}</p></div></div>
<div className="flex items-center gap-3 p-3 bg-slate-50 dark:bg-slate-800/50 rounded-lg"><Phone className="h-4 w-4 text-slate-400"/><div><p className="text-xs text-slate-400">Teléfono</p><p className="text-sm font-medium">{c.phone}</p></div></div>
{c.address&&<div className="flex items-center gap-3 p-3 bg-slate-50 dark:bg-slate-800/50 rounded-lg"><MapPin className="h-4 w-4 text-slate-400"/><div><p className="text-xs text-slate-400">Dirección</p><p className="text-sm font-medium">{c.address}</p></div></div>}
{c.zone&&<div className="flex items-center gap-3 p-3 bg-slate-50 dark:bg-slate-800/50 rounded-lg"><MapPin className="h-4 w-4 text-slate-400"/><div><p className="text-xs text-slate-400">Zona</p><p className="text-sm font-medium">{c.zone.name}</p></div></div>}
<div className="flex items-center gap-3 p-3 bg-slate-50 dark:bg-slate-800/50 rounded-lg"><Calendar className="h-4 w-4 text-slate-400"/><div><p className="text-xs text-slate-400">Registro</p><p className="text-sm font-medium">{fD(c.createdAt)}</p></div></div>
</div>
<Separator/>
<div className="space-y-3">
<h3 className="text-sm font-semibold text-slate-700 dark:text-slate-300 flex items-center gap-2"><TrendingUp className="h-4 w-4 text-emerald-500"/>Financiero</h3>
<div className="grid grid-cols-2 gap-3">
<div className="p-3 bg-emerald-50 dark:bg-emerald-950/50 rounded-lg text-center border border-emerald-100"><p className="text-xs text-emerald-600 dark:text-emerald-300">Prestado</p><p className="text-lg font-bold text-emerald-700 dark:text-emerald-300">{fC(c.stats.totalLoaned)}</p></div>
<div className="p-3 bg-teal-50 dark:bg-teal-950/50 rounded-lg text-center border border-teal-100"><p className="text-xs text-teal-600 dark:text-teal-300">Pagado</p><p className="text-lg font-bold text-teal-700 dark:text-teal-300">{fC(c.stats.totalPaid)}</p></div>
<div className="p-3 bg-slate-50 dark:bg-slate-800/50 rounded-lg text-center border border-slate-100 dark:border-slate-700"><p className="text-xs text-slate-600 dark:text-slate-400">Préstamos</p><p className="text-lg font-bold text-slate-700 dark:text-slate-300">{c.stats.totalLoans}</p></div>
<div className={`p-3 rounded-lg text-center border ${c.stats.hasMora?'bg-red-50 dark:bg-red-950/50 border-red-100':'bg-emerald-50 dark:bg-emerald-950/50 border-emerald-100'}`}><p className={`text-xs font-medium ${c.stats.hasMora?'text-red-600 dark:text-red-300':'text-emerald-600 dark:text-emerald-300'}`}>Estado</p><p className={`text-lg font-bold ${c.stats.hasMora?'text-red-700 dark:text-red-300':'text-emerald-700 dark:text-emerald-300'}`}>{c.stats.hasMora?'En Mora':'Al día'}</p></div>
</div>
</div>
{c.guarantors.length>0&&<><Separator/><div className="space-y-2"><h3 className="text-sm font-semibold text-slate-700 dark:text-slate-300 flex items-center gap-2"><Shield className="h-4 w-4 text-emerald-500"/>Avalistas ({c.guarantors.length})</h3>{c.guarantors.map(g=><div key={g.id} className="flex items-center gap-3 p-3 bg-slate-50 dark:bg-slate-800/50 rounded-lg"><div className="w-8 h-8 rounded-full bg-amber-100 dark:bg-amber-900/50 flex items-center justify-center"><User className="h-4 w-4 text-amber-600 dark:text-amber-300"/></div><div><p className="text-sm font-medium">{g.name}</p>{g.phone&&<p className="text-xs text-slate-500 dark:text-slate-400">{g.phone}</p>}</div></div>)}</div></>}
{c.loans.length>0&&<><Separator/><div className="space-y-2"><h3 className="text-sm font-semibold text-slate-700 dark:text-slate-300 flex items-center gap-2"><CreditCard className="h-4 w-4 text-emerald-500"/>Préstamos ({c.loans.length})</h3>{c.loans.map(l=>{const[cn,lb]=lB(l.status),pct=l.totalAmount>0?Math.round((l.amountPaid/l.totalAmount)*100):0;return<div key={l.id} className="p-3 bg-slate-50 dark:bg-slate-800/50 rounded-lg space-y-2"><div className="flex items-center justify-between"><Badge variant="outline" className={`text-xs ${cn}`}>{lb}</Badge><span className="text-sm font-bold">{fC(l.amount)}</span></div><div className="flex justify-between text-xs text-slate-500 dark:text-slate-400"><span>Pagado: {fC(l.amountPaid)}</span><span>{pct}%</span></div><Progress value={pct} className="h-1.5"/>{l.payments&&l.payments.length>0&&<div className="mt-1 pt-2 border-t border-slate-200 dark:border-slate-700 space-y-1">{l.payments.map(p=><div key={p.id} className="flex items-center justify-between text-xs"><span className="text-slate-500">{fDT2(p.paymentDate)}</span><span className="font-semibold text-emerald-600 dark:text-emerald-400">{fC(p.amount)}</span><Badge variant="outline" className="text-[10px] bg-white dark:bg-slate-900">{PAYMENT_METHOD_LABELS[p.paymentMethod]||p.paymentMethod}</Badge></div>)}</div>}</div>})}</div></>}
<div className="flex gap-3 pt-2">
<Button className={`flex-1 ${GB}`} onClick={()=>{setDetO(false);openEdit(c)}}><Pencil className="h-4 w-4 mr-2"/>Editar</Button>
<Button variant="outline" className="flex-1 border-slate-200" onClick={()=>setDetO(false)}>Cerrar</Button>
</div>
</div>
</>);})()}
</SheetContent>
</Sheet>
</div>);
}
