'use client';

import React, { useState, useEffect, useCallback } from 'react';
import {
  Database,
  Plug,
  CheckCircle2,
  XCircle,
  AlertTriangle,
  Eye,
  EyeOff,
  RefreshCw,
  Loader2,
  ExternalLink,
  Shield,
  Copy,
  Server,
  ArrowRight,
  ArrowDown,
  Smartphone,
  Globe,
  CheckCircle,
  Zap,
} from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';
import { Progress } from '@/components/ui/progress';
import { useToast } from '@/hooks/use-toast';

// ============================================================
// Types
// ============================================================

interface ConnectionStatus {
  isConfigured: boolean;
  connectionStatus: 'not_configured' | 'connecting' | 'connected' | 'error';
  tables: string[];
  errorMessage: string | null;
  configSource: 'env' | 'database' | null;
  url: string;
  hasKey: boolean;
  anonKey: string;
  hasServiceRoleKey: boolean;
  keyType: 'service_role' | 'anon' | null;
  accessMode: 'read_write' | 'read_only' | null;
}

interface ConfigTabProps {
  refreshTrigger?: number;
}

// ============================================================
// Main Component
// ============================================================

export default function ConfigTab({ refreshTrigger }: ConfigTabProps) {
  const { toast } = useToast();

  // Connection state
  const [status, setStatus] = useState<ConnectionStatus | null>(null);
  const [loading, setLoading] = useState(true);
  const [testing, setTesting] = useState(false);
  const [saving, setSaving] = useState(false);
  const [disconnecting, setDisconnecting] = useState(false);
  const [latency, setLatency] = useState<number | null>(null);

  // Form state
  const [supabaseUrl, setSupabaseUrl] = useState('https://pmojbfvmlvtaekqfzasz.supabase.co');
  const [anonKey, setAnonKey] = useState('');
  const [serviceRoleKey, setServiceRoleKey] = useState('');
  const [showAnonKey, setShowAnonKey] = useState(false);
  const [showServiceKey, setShowServiceKey] = useState(false);

  // Test result state
  const [testResult, setTestResult] = useState<{
    success: boolean;
    message: string;
    tables: string[];
  } | null>(null);

  // Sync state
  const [syncing, setSyncing] = useState(false);
  const [syncResult, setSyncResult] = useState<{ success: boolean; message: string; count: number } | null>(null);

  // Disconnect confirmation
  const [showDisconnectDialog, setShowDisconnectDialog] = useState(false);

  // ============================================================
  // Data Fetching
  // ============================================================

  const fetchStatus = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/supabase-config');
      if (res.ok) {
        const data = await res.json();
        setStatus(data);
        // Pre-fill form fields from API response when configured
        if (data.isConfigured) {
          if (data.url) setSupabaseUrl(data.url);
          if (data.anonKey) setAnonKey(data.anonKey);
        }
      }
    } catch (error) {
      console.error('Error fetching Supabase status:', error);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchStatus();
  }, [fetchStatus]);

  useEffect(() => {
    if (refreshTrigger) fetchStatus();
  }, [refreshTrigger, fetchStatus]);

  // ============================================================
  // Handlers
  // ============================================================

  const handleTestConnection = async () => {
    if (!supabaseUrl || !anonKey) {
      toast({
        title: 'Campos requeridos',
        description: 'URL y Anon Key son obligatorios para probar la conexión',
        variant: 'destructive',
      });
      return;
    }

    setTesting(true);
    setTestResult(null);
    const startTime = Date.now();

    try {
      const res = await fetch('/api/supabase-config', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          url: supabaseUrl,
          anonKey,
          serviceRoleKey: serviceRoleKey || undefined,
        }),
      });

      const elapsed = Date.now() - startTime;
      setLatency(elapsed);
      const data = await res.json();

      if (data.success) {
        setTestResult({
          success: true,
          message: data.message,
          tables: data.tables || [],
        });
        toast({
          title: 'Conexión exitosa',
          description: `Se detectaron ${(data.tables || []).length} tablas`,
        });
      } else {
        setTestResult({
          success: false,
          message: data.message || data.error || 'Error de conexión',
          tables: [],
        });
        toast({
          title: 'Error de conexión',
          description: data.message || 'No se pudo conectar a Supabase',
          variant: 'destructive',
        });
      }
    } catch {
      const elapsed = Date.now() - startTime;
      setLatency(elapsed);
      setTestResult({
        success: false,
        message: 'Error de red al intentar conectar',
        tables: [],
      });
      toast({
        title: 'Error',
        description: 'Error de conexión al servidor',
        variant: 'destructive',
      });
    } finally {
      setTesting(false);
    }
  };

  const handleSave = async () => {
    if (!supabaseUrl || !anonKey) {
      toast({
        title: 'Campos requeridos',
        description: 'URL y Anon Key son obligatorios',
        variant: 'destructive',
      });
      return;
    }

    setSaving(true);
    try {
      const res = await fetch('/api/supabase-config', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          url: supabaseUrl,
          anonKey,
          serviceRoleKey: serviceRoleKey || undefined,
        }),
      });

      const data = await res.json();

      if (data.success) {
        toast({
          title: 'Configuración guardada',
          description: 'La conexión a Supabase se ha configurado exitosamente',
        });
        fetchStatus();
      } else {
        toast({
          title: 'Error',
          description: data.message || data.error || 'No se pudo guardar la configuración',
          variant: 'destructive',
        });
      }
    } catch {
      toast({
        title: 'Error',
        description: 'Error de conexión al servidor',
        variant: 'destructive',
      });
    } finally {
      setSaving(false);
    }
  };

  const handleDisconnect = async () => {
    setDisconnecting(true);
    try {
      const res = await fetch('/api/supabase-config', { method: 'DELETE' });
      if (res.ok) {
        toast({
          title: 'Desconectado',
          description: 'La configuración de Supabase ha sido eliminada',
        });
        setSupabaseUrl('');
        setAnonKey('');
        setServiceRoleKey('');
        setTestResult(null);
        setLatency(null);
        fetchStatus();
      } else {
        toast({
          title: 'Error',
          description: 'No se pudo desconectar',
          variant: 'destructive',
        });
      }
    } catch {
      toast({
        title: 'Error',
        description: 'Error de conexión al servidor',
        variant: 'destructive',
      });
    } finally {
      setDisconnecting(false);
      setShowDisconnectDialog(false);
    }
  };

  const copyToClipboard = (text: string, label: string) => {
    navigator.clipboard.writeText(text);
    toast({ title: 'Copiado', description: `${label} copiado al portapapeles` });
  };

  const handleSyncZones = async () => {
    setSyncing(true);
    setSyncResult(null);
    try {
      const res = await fetch('/api/supabase-sync', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ direction: 'pull', tables: ['zones'] }),
      });
      const data = await res.json();
      if (data.success) {
        const synced = data.tables?.[0]?.synced || 0;
        setSyncResult({ success: true, message: `${synced} zonas sincronizadas desde Supabase`, count: synced });
        toast({ title: 'Zonas sincronizadas', description: `${synced} zonas importadas desde Supabase` });
      } else {
        setSyncResult({ success: false, message: data.error || 'Error al sincronizar', count: 0 });
        toast({ title: 'Error', description: data.error || 'No se pudo sincronizar', variant: 'destructive' });
      }
    } catch {
      setSyncResult({ success: false, message: 'Error de conexión', count: 0 });
      toast({ title: 'Error', description: 'Error de conexión al servidor', variant: 'destructive' });
    } finally {
      setSyncing(false);
    }
  };

  // ============================================================
  // Render Helpers
  // ============================================================

  const getStatusIcon = () => {
    if (loading) return <Loader2 className="h-5 w-5 text-slate-400 animate-spin" />;
    if (!status?.isConfigured) return <XCircle className="h-5 w-5 text-slate-400" />;
    if (status.connectionStatus === 'connected') return <CheckCircle2 className="h-5 w-5 text-emerald-500" />;
    if (status.connectionStatus === 'error') return <AlertTriangle className="h-5 w-5 text-red-500" />;
    return <XCircle className="h-5 w-5 text-slate-400" />;
  };

  const getStatusBadge = () => {
    if (loading) return <Badge variant="outline" className="bg-slate-50 text-slate-500 border-slate-200">Verificando...</Badge>;
    if (!status?.isConfigured) return <Badge variant="outline" className="bg-slate-100 text-slate-600 border-slate-200">No configurado</Badge>;
    if (status.connectionStatus === 'connected') return <Badge variant="outline" className="bg-emerald-50 text-emerald-700 border-emerald-200">Conectado</Badge>;
    if (status.connectionStatus === 'error') return <Badge variant="outline" className="bg-red-50 text-red-700 border-red-200">Error</Badge>;
    return <Badge variant="outline" className="bg-slate-100 text-slate-600 border-slate-200">Desconocido</Badge>;
  };

  // ============================================================
  // Render
  // ============================================================

  return (
    <div className="space-y-6">
      {/* Connection Status Card */}
      <Card className="border-0 shadow-lg overflow-hidden">
        <CardHeader className="bg-gradient-to-r from-emerald-600 to-teal-600 text-white pb-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-white/20 flex items-center justify-center">
                <Database className="h-5 w-5 text-white" />
              </div>
              <div>
                <CardTitle className="text-lg">Conexión Supabase</CardTitle>
                <CardDescription className="text-emerald-100">
                  Gestiona la conexión con tu base de datos Supabase
                </CardDescription>
              </div>
            </div>
            <div className="flex items-center gap-2">
              {getStatusBadge()}
              <Button
                size="sm"
                variant="outline"
                className="border-white/30 text-white hover:bg-white/20"
                onClick={() => fetchStatus()}
              >
                <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
              </Button>
            </div>
          </div>
        </CardHeader>
        <CardContent className="p-6">
          {/* Status Indicator */}
          <div className="flex items-center gap-3 mb-6">
            {getStatusIcon()}
            <div className="flex-1">
              <p className="font-semibold text-slate-900">
                {loading ? 'Verificando estado...' :
                 !status?.isConfigured ? 'Sin configurar' :
                 status.connectionStatus === 'connected' ? 'Conectado exitosamente' :
                 status.connectionStatus === 'error' ? 'Error de conexión' :
                 'Estado desconocido'}
              </p>
              {status?.isConfigured && status.connectionStatus === 'connected' && (
                <p className="text-sm text-slate-500">
                  URL: <span className="font-mono text-xs">{status.url}</span>
                  {status.configSource && (
                    <Badge variant="outline" className="ml-2 text-xs bg-teal-50 text-teal-700 border-teal-200">
                      {status.configSource === 'env' ? 'Variables de entorno' : 'Base de datos'}
                    </Badge>
                  )}
                </p>
              )}
              {status?.isConfigured && status.connectionStatus === 'error' && status.errorMessage && (
                <p className="text-sm text-red-600">{status.errorMessage}</p>
              )}
            </div>
          </div>

          {/* Connected Info */}
          {status?.isConfigured && status.connectionStatus === 'connected' && (
            <div className="space-y-4 mb-6">
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <div className="bg-emerald-50 rounded-xl p-4 border border-emerald-100">
                  <div className="flex items-center gap-2 mb-1">
                    <Database className="h-4 w-4 text-emerald-600" />
                    <span className="text-sm font-medium text-emerald-700">Tablas detectadas</span>
                  </div>
                  <p className="text-2xl font-bold text-emerald-800">{status.tables.length}</p>
                </div>
                <div className="bg-teal-50 rounded-xl p-4 border border-teal-100">
                  <div className="flex items-center gap-2 mb-1">
                    <Shield className="h-4 w-4 text-teal-600" />
                    <span className="text-sm font-medium text-teal-700">Fuente de config</span>
                  </div>
                  <p className="text-lg font-bold text-teal-800">
                    {status.configSource === 'env' ? 'Env Vars' : 'Base de datos'}
                  </p>
                </div>
                <div className={`${status.accessMode === 'read_write' ? 'bg-emerald-50 border-emerald-100' : 'bg-amber-50 border-amber-100'} rounded-xl p-4 border`}>
                  <div className="flex items-center gap-2 mb-1">
                    {status.accessMode === 'read_write' ? (
                      <Zap className="h-4 w-4 text-emerald-600" />
                    ) : (
                      <AlertTriangle className="h-4 w-4 text-amber-600" />
                    )}
                    <span className="text-sm font-medium">Modo de acceso</span>
                  </div>
                  <p className={`text-lg font-bold ${status.accessMode === 'read_write' ? 'text-emerald-800' : 'text-amber-800'}`}>
                    {status.accessMode === 'read_write' ? 'Lectura/Escritura' : 'Solo lectura'}
                  </p>
                  {status.accessMode === 'read_only' && (
                    <p className="text-xs text-amber-600 mt-1">Necesitas Service Role Key</p>
                  )}
                </div>
              </div>

              {/* Service Role Key Warning */}
              {status.accessMode === 'read_only' && (
                <Alert className="bg-amber-50 border-amber-200">
                  <AlertTriangle className="h-4 w-4 text-amber-600" />
                  <AlertDescription className="text-amber-800 text-sm">
                    <span className="font-semibold">Se necesita Service Role Key para escribir datos.</span>{' '}
                    Sin esta clave, las operaciones de escritura (crear zonas, clientes, préstamos, etc.) estarán bloqueadas por las políticas de seguridad (RLS) de Supabase.
                    Agrégala en el campo "Service Role Key" abajo o como <code className="bg-amber-100 px-1 rounded text-xs">SUPABASE_SERVICE_ROLE_KEY</code> en tu archivo .env
                  </AlertDescription>
                </Alert>
              )}

              {/* Sync Zones Button */}
              <div className="flex items-center gap-3 p-4 rounded-xl bg-gradient-to-r from-emerald-50 to-teal-50 border border-emerald-100">
                <Database className="h-5 w-5 text-emerald-600 shrink-0" />
                <div className="flex-1">
                  <p className="text-sm font-semibold text-emerald-800">Sincronizar datos desde Supabase</p>
                  <p className="text-xs text-emerald-600">Jala zonas, clientes, préstamos y pagos desde tu base de datos Supabase</p>
                </div>
                <Button
                  className="bg-gradient-to-r from-emerald-500 to-teal-500 hover:from-emerald-600 hover:to-teal-600 text-white shadow-md"
                  onClick={handleSyncZones}
                  disabled={syncing}
                  size="sm"
                >
                  {syncing ? (
                    <><Loader2 className="h-4 w-4 mr-1.5 animate-spin" /> Sincronizando...</>
                  ) : (
                    <><RefreshCw className="h-4 w-4 mr-1.5" /> Sincronizar</>
                  )}
                </Button>
              </div>

              {syncResult && (
                <div className={`p-3 rounded-lg border ${syncResult.success ? 'bg-emerald-50 border-emerald-200' : 'bg-red-50 border-red-200'}`}>
                  <p className={`text-sm font-medium ${syncResult.success ? 'text-emerald-800' : 'text-red-800'}`}>
                    {syncResult.success ? '✓' : '✗'} {syncResult.message}
                  </p>
                </div>
              )}
            </div>
          )}

          {/* Tables found */}
          {status?.isConfigured && status.connectionStatus === 'connected' && status.tables.length > 0 && (
            <div className="mb-6">
              <h4 className="text-sm font-semibold text-slate-700 mb-2">Tablas disponibles</h4>
              <div className="flex flex-wrap gap-2">
                {status.tables.map((table) => (
                  <Badge key={table} variant="outline" className="bg-slate-50 text-slate-700 border-slate-200 font-mono text-xs">
                    {table}
                  </Badge>
                ))}
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Architecture Diagram */}
      <Card className="border-0 shadow-lg">
        <CardHeader className="pb-4">
          <CardTitle className="text-base flex items-center gap-2">
            <Globe className="h-5 w-5 text-teal-600" />
            Arquitectura del Sistema
          </CardTitle>
          <CardDescription>
            Flujo de datos entre la aplicación móvil y el panel web
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex flex-col sm:flex-row items-center justify-center gap-4 sm:gap-6 py-6">
            {/* Flutter App */}
            <div className="flex flex-col items-center gap-2">
              <div className="w-20 h-20 rounded-2xl bg-gradient-to-br from-sky-400 to-sky-600 flex items-center justify-center shadow-lg shadow-sky-500/20">
                <Smartphone className="h-9 w-9 text-white" />
              </div>
              <span className="text-sm font-semibold text-slate-700">App Flutter</span>
              <span className="text-xs text-slate-500">Cobradores</span>
            </div>

            {/* Arrow Right */}
            <div className="flex flex-col items-center gap-1">
              <ArrowRight className="h-6 w-6 text-emerald-500 hidden sm:block" />
              <ArrowDown className="h-6 w-6 text-emerald-500 sm:hidden" />
              <span className="text-[10px] text-slate-400 font-medium">Sync</span>
            </div>

            {/* Supabase */}
            <div className="flex flex-col items-center gap-2">
              <div className="w-20 h-20 rounded-2xl bg-gradient-to-br from-emerald-400 to-teal-600 flex items-center justify-center shadow-lg shadow-emerald-500/20 relative">
                <Database className="h-9 w-9 text-white" />
                {status?.connectionStatus === 'connected' && (
                  <div className="absolute -top-1 -right-1 w-4 h-4 rounded-full bg-emerald-500 border-2 border-white flex items-center justify-center">
                    <CheckCircle className="h-2.5 w-2.5 text-white" />
                  </div>
                )}
              </div>
              <span className="text-sm font-semibold text-slate-700">Supabase</span>
              <span className="text-xs text-slate-500">Base de datos</span>
            </div>

            {/* Arrow Right */}
            <div className="flex flex-col items-center gap-1">
              <ArrowRight className="h-6 w-6 text-emerald-500 hidden sm:block" />
              <ArrowDown className="h-6 w-6 text-emerald-500 sm:hidden" />
              <span className="text-[10px] text-slate-400 font-medium">API</span>
            </div>

            {/* Web App */}
            <div className="flex flex-col items-center gap-2">
              <div className="w-20 h-20 rounded-2xl bg-gradient-to-br from-teal-400 to-emerald-600 flex items-center justify-center shadow-lg shadow-teal-500/20">
                <Globe className="h-9 w-9 text-white" />
              </div>
              <span className="text-sm font-semibold text-slate-700">Panel Web</span>
              <span className="text-xs text-slate-500">Administración</span>
            </div>
          </div>

          {/* Data flow legend */}
          <div className="mt-4 flex flex-wrap items-center justify-center gap-4 text-xs text-slate-500">
            <span className="flex items-center gap-1.5">
              <div className="w-3 h-0.5 bg-sky-500" />
              Lectura/Escritura
            </span>
            <span className="flex items-center gap-1.5">
              <div className="w-3 h-0.5 bg-emerald-500" />
              Sincronización bidireccional
            </span>
            <span className="flex items-center gap-1.5">
              <div className="w-3 h-0.5 bg-teal-500" />
              Consultas y reportes
            </span>
          </div>
        </CardContent>
      </Card>

      {/* Configuration Form */}
      <Card className="border-0 shadow-lg">
        <CardHeader className="pb-4">
          <CardTitle className="text-base flex items-center gap-2">
            <Plug className="h-5 w-5 text-emerald-600" />
            Configuración de Conexión
          </CardTitle>
          <CardDescription>
            Ingresa las credenciales de tu proyecto Supabase
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-5">
          {/* Supabase URL */}
          <div className="space-y-2">
            <Label htmlFor="supabase-url" className="text-sm font-semibold text-slate-700">
              URL del Proyecto <span className="text-red-500">*</span>
            </Label>
            <div className="relative">
              <Server className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
              <Input
                id="supabase-url"
                placeholder="https://your-project.supabase.co"
                value={supabaseUrl}
                onChange={(e) => setSupabaseUrl(e.target.value)}
                className="pl-9 bg-white border-slate-200"
              />
            </div>
            <p className="text-xs text-slate-400">
              Se encuentra en Project Settings → API → Project URL
            </p>
          </div>

          {/* Anon Key */}
          <div className="space-y-2">
            <Label htmlFor="anon-key" className="text-sm font-semibold text-slate-700">
              Anon Key <span className="text-red-500">*</span>
            </Label>
            <div className="relative">
              <Shield className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
              <Input
                id="anon-key"
                type={showAnonKey ? 'text' : 'password'}
                placeholder="eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."
                value={anonKey}
                onChange={(e) => setAnonKey(e.target.value)}
                className="pl-9 pr-20 bg-white border-slate-200"
              />
              <div className="absolute right-1 top-1/2 -translate-y-1/2 flex items-center gap-0.5">
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  className="h-7 w-7"
                  onClick={() => setShowAnonKey(!showAnonKey)}
                >
                  {showAnonKey ? <EyeOff className="h-3.5 w-3.5" /> : <Eye className="h-3.5 w-3.5" />}
                </Button>
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  className="h-7 w-7"
                  onClick={() => copyToClipboard(anonKey, 'Anon Key')}
                  disabled={!anonKey}
                >
                  <Copy className="h-3.5 w-3.5" />
                </Button>
              </div>
            </div>
            <p className="text-xs text-slate-400">
              Clave pública del proyecto. Segura para uso en el cliente.
            </p>
          </div>

          {/* Service Role Key */}
          <div className="space-y-2">
            <Label htmlFor="service-key" className="text-sm font-semibold text-slate-700">
              Service Role Key <span className="text-slate-400 font-normal">(recomendado)</span>
            </Label>
            <div className="relative">
              <Zap className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-amber-500" />
              <Input
                id="service-key"
                type={showServiceKey ? 'text' : 'password'}
                placeholder="eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."
                value={serviceRoleKey}
                onChange={(e) => setServiceRoleKey(e.target.value)}
                className="pl-9 pr-20 bg-white border-slate-200"
              />
              <div className="absolute right-1 top-1/2 -translate-y-1/2 flex items-center gap-0.5">
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  className="h-7 w-7"
                  onClick={() => setShowServiceKey(!showServiceKey)}
                >
                  {showServiceKey ? <EyeOff className="h-3.5 w-3.5" /> : <Eye className="h-3.5 w-3.5" />}
                </Button>
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  className="h-7 w-7"
                  onClick={() => copyToClipboard(serviceRoleKey, 'Service Role Key')}
                  disabled={!serviceRoleKey}
                >
                  <Copy className="h-3.5 w-3.5" />
                </Button>
              </div>
            </div>
            <Alert className="bg-amber-50 border-amber-200 mt-2">
              <AlertTriangle className="h-4 w-4 text-amber-600" />
              <AlertDescription className="text-amber-800 text-xs">
                Permite acceso completo sin restricciones de RLS. Solo usar en el servidor. Se encuentra en Project Settings → API → service_role key.
              </AlertDescription>
            </Alert>
          </div>

          <Separator />

          {/* Action Buttons */}
          <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3">
            <Button
              variant="outline"
              className="border-emerald-200 text-emerald-700 hover:bg-emerald-50"
              onClick={handleTestConnection}
              disabled={testing || !supabaseUrl || !anonKey}
            >
              {testing ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Probando...
                </>
              ) : (
                <>
                  <Plug className="h-4 w-4 mr-2" />
                  Probar Conexión
                </>
              )}
            </Button>

            <Button
              className="bg-gradient-to-r from-emerald-500 to-teal-500 hover:from-emerald-600 hover:to-teal-600 text-white border-0 shadow-lg shadow-emerald-500/20"
              onClick={handleSave}
              disabled={saving || !supabaseUrl || !anonKey}
            >
              {saving ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Guardando...
                </>
              ) : (
                <>
                  <CheckCircle2 className="h-4 w-4 mr-2" />
                  Guardar Configuración
                </>
              )}
            </Button>

            {status?.isConfigured && (
              <Button
                variant="outline"
                className="border-red-200 text-red-600 hover:bg-red-50 ml-auto"
                onClick={() => setShowDisconnectDialog(true)}
              >
                <XCircle className="h-4 w-4 mr-2" />
                Desconectar
              </Button>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Test Results */}
      {testResult && (
        <Card className={`border-0 shadow-lg ${testResult.success ? 'ring-2 ring-emerald-200' : 'ring-2 ring-red-200'}`}>
          <CardHeader className="pb-4">
            <CardTitle className="text-base flex items-center gap-2">
              {testResult.success ? (
                <CheckCircle2 className="h-5 w-5 text-emerald-600" />
              ) : (
                <XCircle className="h-5 w-5 text-red-600" />
              )}
              Resultado de la Prueba de Conexión
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {/* Status */}
            <div className="flex items-center gap-3">
              <Badge
                variant="outline"
                className={
                  testResult.success
                    ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                    : 'bg-red-50 text-red-700 border-red-200'
                }
              >
                {testResult.success ? 'Exitoso' : 'Fallido'}
              </Badge>
              <span className="text-sm text-slate-600">{testResult.message}</span>
            </div>

            {/* Latency */}
            {latency !== null && (
              <div className="flex items-center gap-2">
                <span className="text-xs text-slate-500">Latencia:</span>
                <Badge
                  variant="outline"
                  className={
                    latency < 500
                      ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                      : latency < 1500
                      ? 'bg-amber-50 text-amber-700 border-amber-200'
                      : 'bg-red-50 text-red-700 border-red-200'
                  }
                >
                  {latency < 500 ? 'Rápido' : latency < 1500 ? 'Normal' : 'Lento'} — {latency}ms
                </Badge>
              </div>
            )}

            {/* Tables Found */}
            {testResult.success && testResult.tables.length > 0 && (
              <div>
                <h4 className="text-sm font-semibold text-slate-700 mb-2">
                  Tablas encontradas ({testResult.tables.length})
                </h4>
                <div className="flex flex-wrap gap-2">
                  {testResult.tables.map((table) => (
                    <Badge key={table} variant="outline" className="bg-emerald-50 text-emerald-700 border-emerald-200 font-mono text-xs">
                      <Database className="h-3 w-3 mr-1" />
                      {table}
                    </Badge>
                  ))}
                </div>
              </div>
            )}

            {/* Error Details */}
            {!testResult.success && (
              <Alert className="bg-red-50 border-red-200">
                <XCircle className="h-4 w-4 text-red-600" />
                <AlertDescription className="text-red-700">
                  {testResult.message}
                </AlertDescription>
              </Alert>
            )}
          </CardContent>
        </Card>
      )}

      {/* Setup Guide (when not configured) */}
      {status && !status.isConfigured && (
        <Card className="border-0 shadow-lg">
          <CardHeader className="pb-4">
            <CardTitle className="text-base flex items-center gap-2">
              <ExternalLink className="h-5 w-5 text-teal-600" />
              Guía de Configuración
            </CardTitle>
            <CardDescription>
              Sigue estos pasos para conectar tu proyecto Supabase
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {[
                {
                  step: 1,
                  title: 'Crear proyecto en Supabase',
                  description: 'Ve a supabase.com y crea un nuevo proyecto. Configura la base de datos con la región más cercana.',
                  icon: <Globe className="h-4 w-4" />,
                },
                {
                  step: 2,
                  title: 'Obtener credenciales',
                  description: 'En Project Settings → API, encuentra tu Project URL y las claves (anon public y service_role).',
                  icon: <Shield className="h-4 w-4" />,
                },
                {
                  step: 3,
                  title: 'Configurar tablas',
                  description: 'Ejecuta el script SQL para crear las tablas necesarias: profiles, clients, loans, payments, etc.',
                  icon: <Database className="h-4 w-4" />,
                },
                {
                  step: 4,
                  title: 'Conectar desde aquí',
                  description: 'Ingresa las credenciales en el formulario de arriba y haz clic en "Probar Conexión".',
                  icon: <Plug className="h-4 w-4" />,
                },
              ].map((item) => (
                <div
                  key={item.step}
                  className="flex items-start gap-4 p-4 rounded-xl bg-slate-50 border border-slate-100"
                >
                  <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-emerald-500 to-teal-500 flex items-center justify-center text-white font-bold text-sm shrink-0">
                    {item.step}
                  </div>
                  <div className="flex-1">
                    <div className="flex items-center gap-2 mb-1">
                      {item.icon}
                      <span className="font-semibold text-slate-800 text-sm">{item.title}</span>
                    </div>
                    <p className="text-xs text-slate-500">{item.description}</p>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Disconnect Confirmation Dialog */}
      <Dialog open={showDisconnectDialog} onOpenChange={setShowDisconnectDialog}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <div className="w-8 h-8 rounded-lg bg-red-100 flex items-center justify-center">
                <AlertTriangle className="h-4 w-4 text-red-600" />
              </div>
              Desconectar Supabase
            </DialogTitle>
            <DialogDescription>
              ¿Estás seguro de que deseas eliminar la configuración de Supabase?
              Se borrarán las credenciales almacenadas y la sincronización se detendrá.
            </DialogDescription>
          </DialogHeader>
          <div className="py-2">
            <Alert className="bg-amber-50 border-amber-200">
              <AlertTriangle className="h-4 w-4 text-amber-600" />
              <AlertDescription className="text-amber-800 text-sm">
                Los datos existentes en la base de datos local no se eliminarán, pero la sincronización con Supabase dejará de funcionar.
              </AlertDescription>
            </Alert>
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setShowDisconnectDialog(false)}
              disabled={disconnecting}
            >
              Cancelar
            </Button>
            <Button
              variant="destructive"
              onClick={handleDisconnect}
              disabled={disconnecting}
            >
              {disconnecting ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Desconectando...
                </>
              ) : (
                <>
                  <XCircle className="h-4 w-4 mr-2" />
                  Desconectar
                </>
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
