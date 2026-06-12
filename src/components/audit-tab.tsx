'use client';

import React, { useState, useEffect, useCallback } from 'react';
import {
  ShieldCheck,
  CheckCircle2,
  Activity,
  XCircle,
  FileText,
  Search,
  Filter,
  RefreshCw,
  ChevronLeft,
  ChevronRight,
  Info,
  AlertTriangle,
  Skull,
  Loader2,
} from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { ScrollArea } from '@/components/ui/scroll-area';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
} from 'recharts';
import type { AuditLog, AuditStats } from '@/lib/types';
import { formatDateTime } from '@/lib/format-helpers';

const getActionIcon = (action: string) => {
  switch (action) {
    case 'CREATE': return <CheckCircle2 className="h-4 w-4 text-emerald-500" />;
    case 'UPDATE': return <Activity className="h-4 w-4 text-amber-500" />;
    case 'DELETE': return <XCircle className="h-4 w-4 text-red-500" />;
    case 'CANCEL': return <XCircle className="h-4 w-4 text-red-600" />;
    case 'WAIVE': return <ShieldCheck className="h-4 w-4 text-sky-500" />;
    case 'APPROVE': return <CheckCircle2 className="h-4 w-4 text-emerald-600" />;
    case 'REJECT': return <XCircle className="h-4 w-4 text-orange-500" />;
    default: return <Info className="h-4 w-4 text-gray-500" />;
  }
};

const getActionBadge = (action: string) => {
  const colors: Record<string, string> = {
    CREATE: 'bg-emerald-100 text-emerald-800 border-emerald-200',
    UPDATE: 'bg-amber-100 text-amber-800 border-amber-200',
    DELETE: 'bg-red-100 text-red-800 border-red-200',
    CANCEL: 'bg-red-100 text-red-900 border-red-300',
    WAIVE: 'bg-sky-100 text-sky-800 border-sky-200',
    APPROVE: 'bg-emerald-100 text-emerald-900 border-emerald-300',
    REJECT: 'bg-orange-100 text-orange-800 border-orange-200',
  };
  return colors[action] || 'bg-gray-100 text-gray-800 border-gray-200';
};

const getSeverityBadge = (severity: string) => {
  const colors: Record<string, string> = {
    info: 'bg-slate-100 text-slate-700 border-slate-200',
    warning: 'bg-amber-100 text-amber-800 border-amber-200',
    critical: 'bg-red-100 text-red-800 border-red-200',
  };
  const icons: Record<string, React.ReactNode> = {
    info: <Info className="h-3 w-3" />,
    warning: <AlertTriangle className="h-3 w-3" />,
    critical: <Skull className="h-3 w-3" />,
  };
  return { className: colors[severity] || colors.info, icon: icons[severity] || icons.info };
};

export default function AuditTab() {
  const [auditLogs, setAuditLogs] = useState<AuditLog[]>([]);
  const [auditStats, setAuditStats] = useState<AuditStats | null>(null);
  const [auditPage, setAuditPage] = useState(1);
  const [auditTotal, setAuditTotal] = useState(0);
  const [auditTotalPages, setAuditTotalPages] = useState(0);
  const [loading, setLoading] = useState(true);
  const [auditFilters, setAuditFilters] = useState({ action: '', entityType: '', severity: '', search: '' });

  const fetchAuditLogs = useCallback(async (page = 1) => {
    setLoading(true);
    try {
      const params = new URLSearchParams({ page: page.toString(), limit: '15' });
      if (auditFilters.action) params.set('action', auditFilters.action);
      if (auditFilters.entityType) params.set('entityType', auditFilters.entityType);
      if (auditFilters.severity) params.set('severity', auditFilters.severity);
      if (auditFilters.search) params.set('search', auditFilters.search);

      const res = await fetch(`/api/audit?${params}`);
      if (res.ok) {
        try {
          const data = await res.json();
          setAuditLogs(data?.logs || []);
          setAuditStats(data?.stats || null);
          setAuditTotal(data?.pagination?.total || 0);
          setAuditTotalPages(data?.pagination?.totalPages || 0);
          setAuditPage(page);
        } catch {
          setAuditLogs([]);
        }
      }
    } catch (error) {
      console.error('Error fetching audit logs:', error);
    } finally {
      setLoading(false);
    }
  }, [auditFilters]);

  useEffect(() => { fetchAuditLogs(1); }, [fetchAuditLogs]);

  return (
    <div className="space-y-6">
      {/* Audit Stats Cards */}
      {auditStats?.byAction ? (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <Card className="shadow-md border-0 bg-gradient-to-br from-emerald-500 to-emerald-600 text-white">
            <CardContent className="p-4 flex items-center gap-3">
              <CheckCircle2 className="h-8 w-8 text-emerald-200" />
              <div>
                <p className="text-emerald-100 text-xs">Creaciones</p>
                <p className="text-2xl font-bold">{auditStats.byAction.find((a) => a.action === 'CREATE')?.count || 0}</p>
              </div>
            </CardContent>
          </Card>

          <Card className="shadow-md border-0 bg-gradient-to-br from-amber-500 to-orange-500 text-white">
            <CardContent className="p-4 flex items-center gap-3">
              <Activity className="h-8 w-8 text-amber-200" />
              <div>
                <p className="text-amber-100 text-xs">Modificaciones</p>
                <p className="text-2xl font-bold">{auditStats.byAction.find((a) => a.action === 'UPDATE')?.count || 0}</p>
              </div>
            </CardContent>
          </Card>

          <Card className="shadow-md border-0 bg-gradient-to-br from-red-500 to-red-600 text-white">
            <CardContent className="p-4 flex items-center gap-3">
              <XCircle className="h-8 w-8 text-red-200" />
              <div>
                <p className="text-red-100 text-xs">Eliminaciones</p>
                <p className="text-2xl font-bold">{auditStats.byAction.filter((a) => ['DELETE', 'CANCEL'].includes(a.action)).reduce((s, a) => s + a.count, 0)}</p>
              </div>
            </CardContent>
          </Card>

          <Card className="shadow-md border-0 bg-gradient-to-br from-sky-500 to-blue-500 text-white">
            <CardContent className="p-4 flex items-center gap-3">
              <ShieldCheck className="h-8 w-8 text-sky-200" />
              <div>
                <p className="text-sky-100 text-xs">Condonaciones</p>
                <p className="text-2xl font-bold">{auditStats.byAction.find((a) => a.action === 'WAIVE')?.count || 0}</p>
              </div>
            </CardContent>
          </Card>
        </div>
      ) : null}

      {/* Audit Severity Chart & Entity Distribution */}
      {auditStats?.bySeverity && auditStats.bySeverity.length > 0 && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <Card className="shadow-md border-0">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm">Distribución por Severidad</CardTitle>
            </CardHeader>
            <CardContent>
              <ResponsiveContainer width="100%" height={180}>
                <PieChart>
                  <Pie
                    data={auditStats.bySeverity.map((s) => ({
                      name: s.severity === 'info' ? 'Info' : s.severity === 'warning' ? 'Advertencia' : 'Crítico',
                      value: s.count,
                      fill: s.severity === 'info' ? '#94a3b8' : s.severity === 'warning' ? '#f59e0b' : '#ef4444',
                    }))}
                    cx="50%" cy="50%" innerRadius={40} outerRadius={70} paddingAngle={3} dataKey="value"
                  >
                    {auditStats.bySeverity.map((s, i) => (
                      <Cell key={i} fill={s.severity === 'info' ? '#94a3b8' : s.severity === 'warning' ? '#f59e0b' : '#ef4444'} />
                    ))}
                  </Pie>
                  <Tooltip />
                </PieChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>

          <Card className="shadow-md border-0">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm">Actividad por Tipo de Entidad</CardTitle>
            </CardHeader>
            <CardContent>
              <ResponsiveContainer width="100%" height={180}>
                <BarChart data={auditStats.byEntityType || []}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                  <XAxis dataKey="entityType" tick={{ fontSize: 10 }} />
                  <YAxis tick={{ fontSize: 10 }} />
                  <Tooltip />
                  <Bar dataKey="count" fill="#8b5cf6" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Audit Filters */}
      <Card className="shadow-md border-0">
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <CardTitle className="flex items-center gap-2 text-base">
              <FileText className="h-5 w-5 text-emerald-500" />
              Registro de Auditoría
            </CardTitle>
            <div className="flex items-center gap-2">
              <Badge variant="outline" className="text-xs">{auditTotal} registros</Badge>
              <Button size="sm" variant="outline" onClick={() => fetchAuditLogs(auditPage)}>
                <RefreshCw className="h-4 w-4" />
              </Button>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <div className="flex flex-wrap gap-3 mb-4">
            <div className="relative flex-1 min-w-48">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
              <Input
                placeholder="Buscar en auditoría..."
                className="pl-10"
                value={auditFilters.search}
                onChange={(e) => setAuditFilters((f) => ({ ...f, search: e.target.value }))}
                onKeyDown={(e) => e.key === 'Enter' && fetchAuditLogs(1)}
              />
            </div>
            <Select value={auditFilters.action || 'all'} onValueChange={(v) => { setAuditFilters((f) => ({ ...f, action: v === 'all' ? '' : v })); }}>
              <SelectTrigger className="w-36"><SelectValue placeholder="Acción" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todas</SelectItem>
                <SelectItem value="CREATE">Crear</SelectItem>
                <SelectItem value="UPDATE">Modificar</SelectItem>
                <SelectItem value="DELETE">Eliminar</SelectItem>
                <SelectItem value="CANCEL">Cancelar</SelectItem>
                <SelectItem value="WAIVE">Condonar</SelectItem>
                <SelectItem value="APPROVE">Aprobar</SelectItem>
                <SelectItem value="REJECT">Rechazar</SelectItem>
              </SelectContent>
            </Select>
            <Select value={auditFilters.entityType || 'all'} onValueChange={(v) => { setAuditFilters((f) => ({ ...f, entityType: v === 'all' ? '' : v })); }}>
              <SelectTrigger className="w-36"><SelectValue placeholder="Entidad" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todas</SelectItem>
                <SelectItem value="loan">Préstamo</SelectItem>
                <SelectItem value="payment">Pago</SelectItem>
                <SelectItem value="client">Cliente</SelectItem>
                <SelectItem value="expense">Gasto</SelectItem>
                <SelectItem value="late_fee">Mora</SelectItem>
                <SelectItem value="setting">Configuración</SelectItem>
              </SelectContent>
            </Select>
            <Select value={auditFilters.severity || 'all'} onValueChange={(v) => { setAuditFilters((f) => ({ ...f, severity: v === 'all' ? '' : v })); }}>
              <SelectTrigger className="w-36"><SelectValue placeholder="Severidad" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todas</SelectItem>
                <SelectItem value="info">Info</SelectItem>
                <SelectItem value="warning">Advertencia</SelectItem>
                <SelectItem value="critical">Crítico</SelectItem>
              </SelectContent>
            </Select>
            <Button size="sm" onClick={() => fetchAuditLogs(1)} className="bg-emerald-500 hover:bg-emerald-600">
              <Filter className="h-4 w-4 mr-1" />
              Filtrar
            </Button>
          </div>

          {/* Audit Log Table */}
          {loading ? (
            <div className="flex items-center justify-center py-10">
              <Loader2 className="h-6 w-6 animate-spin text-emerald-500" />
              <span className="ml-2 text-slate-500">Cargando...</span>
            </div>
          ) : (
            <>
              <ScrollArea className="max-h-[500px]">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="w-10">Icon</TableHead>
                      <TableHead>Acción</TableHead>
                      <TableHead>Entidad</TableHead>
                      <TableHead>Nombre</TableHead>
                      <TableHead>Severidad</TableHead>
                      <TableHead>Usuario</TableHead>
                      <TableHead>Notas</TableHead>
                      <TableHead>Fecha</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {auditLogs.map((log) => {
                      const sevBadge = getSeverityBadge(log.severity);
                      return (
                        <TableRow key={log.id} className="hover:bg-slate-50/80">
                          <TableCell>{getActionIcon(log.action)}</TableCell>
                          <TableCell>
                            <Badge variant="outline" className={getActionBadge(log.action)}>
                              {log.action}
                            </Badge>
                          </TableCell>
                          <TableCell>
                            <span className="text-xs font-mono text-slate-500">{log.entityType}</span>
                          </TableCell>
                          <TableCell className="font-medium max-w-40 truncate">{log.entityName || '—'}</TableCell>
                          <TableCell>
                            <Badge variant="outline" className={`gap-1 ${sevBadge.className}`}>
                              {sevBadge.icon}
                              {log.severity}
                            </Badge>
                          </TableCell>
                          <TableCell>
                            <div className="flex flex-col">
                              <span className="text-xs font-medium">{log.user?.name || 'Sistema'}</span>
                              <span className="text-xs text-slate-400">{log.user?.role || ''}</span>
                            </div>
                          </TableCell>
                          <TableCell className="max-w-48">
                            <span className="text-xs text-slate-600 line-clamp-2">{log.notes || '—'}</span>
                          </TableCell>
                          <TableCell className="whitespace-nowrap">
                            <span className="text-xs text-slate-500">{formatDateTime(log.createdAt)}</span>
                          </TableCell>
                        </TableRow>
                      );
                    })}
                  </TableBody>
                </Table>
              </ScrollArea>

              {/* Pagination */}
              <div className="flex items-center justify-between mt-4 pt-4 border-t border-slate-100">
                <p className="text-sm text-slate-500">
                  Página {auditPage} de {auditTotalPages} ({auditTotal} registros)
                </p>
                <div className="flex items-center gap-2">
                  <Button size="sm" variant="outline" disabled={auditPage <= 1} onClick={() => fetchAuditLogs(auditPage - 1)}>
                    <ChevronLeft className="h-4 w-4" />
                  </Button>
                  <Button size="sm" variant="outline" disabled={auditPage >= auditTotalPages} onClick={() => fetchAuditLogs(auditPage + 1)}>
                    <ChevronRight className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            </>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
