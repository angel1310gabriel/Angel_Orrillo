'use client';

import React, { useState, useRef, useEffect, useCallback } from 'react';
import dynamic from 'next/dynamic';
import LoansTab from '@/components/loans-tab';
import CapitalTab from '@/components/capital-tab';
import ClientsTab from '@/components/clients-tab';
import PaymentsTab from '@/components/payments-tab';
import ConfigTab from '@/components/config-tab';
import CollectorsTab from '@/components/collectors-tab';
import DailySettlementTab from '@/components/daily-settlement-tab';
import CajaTab from '@/components/caja-tab';
import ChatTab from '@/components/chat-tab';
import LoginScreen from '@/components/login-screen';
import { ErrorBoundary } from '@/components/error-boundary';
import DataToolsDialog from '@/components/data-tools';
import ReportsDialog from '@/components/reports-dialog';
import CompanySelector from '@/components/company-selector';
import { useSupabaseRealtime } from '@/hooks/use-supabase-realtime';
import { useAuth, ROLE_PERMISSIONS } from '@/hooks/use-auth';

import ChangePassword from '@/components/change-password';
import { InactivityTracker } from '@/components/inactivity-tracker';
import {
  ShieldCheck,
  Clock,
  BarChart3,
  Users,
  DollarSign,
  Activity,
  Wallet,
  Loader2,
  CreditCard,
  Database,
  Navigation,
  MessageCircle,
  Wifi,
  Menu,
  X,
  LogOut,
  User,
  KeyRound,
  Download,
  Upload,
  Map,
  Bell,
  BellRing,
  CheckCheck,
  Trash2,
  ExternalLink,
  Sun,
  Moon,
} from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';

// Dynamic imports for heavy components (recharts) — lazy loaded, no SSR
const DashboardTab = dynamic(() => import('@/components/dashboard-tab'), {
  ssr: false,
  loading: () => (
    <div className="flex items-center justify-center py-20">
      <Loader2 className="h-8 w-8 animate-spin text-emerald-500" />
      <span className="ml-3 text-slate-500">Cargando dashboard...</span>
    </div>
  ),
});

const AuditTab = dynamic(() => import('@/components/audit-tab'), {
  ssr: false,
  loading: () => (
    <div className="flex items-center justify-center py-20">
      <Loader2 className="h-8 w-8 animate-spin text-emerald-500" />
      <span className="ml-3 text-slate-500">Cargando auditoría...</span>
    </div>
  ),
});

const LateFeeTab = dynamic(() => import('@/components/late-fee-tab'), {
  ssr: false,
  loading: () => (
    <div className="flex items-center justify-center py-20">
      <Loader2 className="h-8 w-8 animate-spin text-emerald-500" />
      <span className="ml-3 text-slate-500">Cargando sistema de mora...</span>
    </div>
  ),
});

const MapTab = dynamic(() => import('@/components/map-tab'), {
  ssr: false,
  loading: () => (
    <div className="flex items-center justify-center py-20">
      <Loader2 className="h-8 w-8 animate-spin text-emerald-500" />
      <span className="ml-3 text-slate-500">Cargando mapa...</span>
    </div>
  ),
});

// ============================================================
// Role badge colors
// ============================================================

const ROLE_BADGE: Record<string, { label: string; color: string }> = {
  admin: { label: 'Administrador', color: 'bg-emerald-50 text-emerald-700 border-emerald-200' },
  supervisor: { label: 'Supervisor', color: 'bg-amber-50 text-amber-700 border-amber-200' },
  collector: { label: 'Cobrador', color: 'bg-slate-50 text-slate-700 border-slate-200' },
};

// ============================================================
// Main Page Component
// ============================================================

export default function KCobranzasDashboard() {
  const { user, isAuthenticated, logout, refreshRole } = useAuth();
  const [showChangePassword, setShowChangePassword] = useState(false);
  const [showDataTools, setShowDataTools] = useState(false);
  const [showProfile, setShowProfile] = useState(false);
  const [showReports, setShowReports] = useState(false);
  const [profileName, setProfileName] = useState('');
  const [profileEmail, setProfileEmail] = useState('');
  const [savingProfile, setSavingProfile] = useState(false);
  const [activeTab, setActiveTab] = useState(() => {
    if (typeof window !== 'undefined') {
      return new URLSearchParams(window.location.search).get('tab') || 'dashboard';
    }
    return 'dashboard';
  });
  const [refreshKey, setRefreshKey] = useState(0);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [notifOpen, setNotifOpen] = useState(false);
  const [notifications, setNotifications] = useState<{id:string;title:string;body:string|null;type:string|null;isRead:boolean;createdAt:string;referenceType:string|null;referenceId:string|null}[]>([]);
  const notifRef = useRef<HTMLDivElement>(null);
  const unreadCount = notifications.filter(n=>!n.isRead).length;
  const [isHydrated, setIsHydrated] = useState(() => {
    if (typeof window !== 'undefined') {
      try {
        const stored = localStorage.getItem('kc-cobranzas-auth-v3');
        if (stored) {
          const parsed = JSON.parse(stored);
          if (parsed?.state?.isAuthenticated && parsed?.state?.user) {
            return true;
          }
        }
      } catch {}
    }
    return false;
  });
  const hasCheckedSession = useRef(false);

  // Location tracking state + refs — must be before early returns to satisfy React's rules of hooks
  const [locationTracking, setLocationTracking] = useState(false);
  const watchIdRef = useRef<number | null>(null);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const lastSentRef = useRef<{latitude: number; longitude: number; accuracy: number | null; speed: number | null} | null>(null);

  // Background role refresh on first load
  useEffect(() => {
    if (!hasCheckedSession.current) {
      hasCheckedSession.current = true;
      setIsHydrated(true);
      refreshRole();
    }
  }, [refreshRole]);

  // Location tracking effect — must be before early returns
  useEffect(() => {
    const isCollector = user?.role === 'collector';
    const collectorId = user?.id;
    if (!isCollector || !collectorId || !navigator.geolocation) return;
    const watchId = navigator.geolocation.watchPosition(
      (position) => {
        lastSentRef.current = { latitude: position.coords.latitude, longitude: position.coords.longitude, accuracy: position.coords.accuracy ?? null, speed: position.coords.speed ?? null };
      },
      () => {},
      { enableHighAccuracy: true, timeout: 10000, maximumAge: 5000 }
    );
    watchIdRef.current = watchId;
    setLocationTracking(true);
    const interval = setInterval(() => {
      if (lastSentRef.current) {
        fetch('/api/locations', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ collectorId, ...lastSentRef.current }) }).catch(() => {});
      }
    }, 30000);
    intervalRef.current = interval;
    return () => {
      navigator.geolocation.clearWatch(watchId);
      clearInterval(interval);
      setLocationTracking(false);
    };
  }, [user?.role, user?.id]);

  // Listen for external tab navigation events (from child components)
  useEffect(() => {
    const handler = (e: CustomEvent) => {
      if (e.detail?.tab) {
        setActiveTab(e.detail.tab);
        setMobileMenuOpen(false);
      }
    };
    window.addEventListener('navigate-to-tab', handler as EventListener);
    return () => window.removeEventListener('navigate-to-tab', handler as EventListener);
  }, []);

  // Sync activeTab to URL
  useEffect(() => {
    if (typeof window !== 'undefined') {
      const url = new URL(window.location.href);
      if (url.searchParams.get('tab') !== activeTab) {
        url.searchParams.set('tab', activeTab);
        window.history.replaceState({}, '', url.toString());
      }
    }
  }, [activeTab]);

  // Supabase Realtime
  const handleRealtimeChange = () => {
    setRefreshKey((prev) => prev + 1);
  };

  useSupabaseRealtime(
    ['zones', 'profiles', 'clients', 'loans', 'payments', 'capital_movements', 'settings', 'late_fees', 'daily_settlements', 'caja_movements'],
    handleRealtimeChange,
    { debounceMs: 1500, enabled: isAuthenticated }
  );

  // Dark mode persistence
  useEffect(() => {
    const saved = localStorage.getItem('kc-dark-mode');
    if (saved === 'dark') document.documentElement.classList.add('dark');
    else if (saved === 'light') document.documentElement.classList.remove('dark');
  }, []);

  // Fetch notifications
  const fetchNotifs = useCallback(async () => {
    if (!user?.id) return;
    try {
      const res = await fetch(`/api/notifications?collectorId=${user.id}`);
      if (res.ok) {
        const data = await res.json();
        setNotifications(data);
      }
    } catch {}
  }, [user?.id]);

  useEffect(() => {
    fetchNotifs();
    const iv = setInterval(fetchNotifs, 30000);
    return () => clearInterval(iv);
  }, [fetchNotifs]);

  // Close notifications on click outside
  useEffect(() => {
    if (!notifOpen) return;
    const handler = (e: MouseEvent) => {
      if (notifRef.current && !notifRef.current.contains(e.target as Node)) setNotifOpen(false);
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [notifOpen]);

  const markRead = async (ids: string[]) => {
    try {
      await fetch('/api/notifications', { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ ids }) });
      setNotifications(prev => prev.map(n => ids.includes(n.id) ? { ...n, isRead: true } : n));
    } catch {}
  };

  const delNotif = async (id: string) => {
    try {
      await fetch(`/api/notifications?id=${id}`, { method: 'DELETE' });
      setNotifications(prev => prev.filter(n => n.id !== id));
    } catch {}
  };

  const handleTabChange = (tab: string) => {
    setActiveTab(tab);
    setMobileMenuOpen(false);
  };

  const handleLogout = () => {
    logout();
    setMobileMenuOpen(false);
  };

  // All navigation items
  const allNavItems = [
    { value: 'dashboard', icon: BarChart3, label: 'Dashboard' },
    { value: 'loans', icon: DollarSign, label: 'Préstamos' },
    { value: 'clients', icon: Users, label: 'Clientes' },
    { value: 'payments', icon: CreditCard, label: 'Cobros' },
    { value: 'collectors', icon: Navigation, label: 'Personal' },
    { value: 'audit', icon: ShieldCheck, label: 'Auditoría' },
    { value: 'capital', icon: Wallet, label: 'Capital' },
    { value: 'chat', icon: MessageCircle, label: 'Mensajes' },
    { value: 'late-fee', icon: Clock, label: 'Mora Auto' },
    { value: 'daily-settlement', icon: Wallet, label: 'Cierre de Caja' },
    { value: 'caja', icon: Wallet, label: 'Caja' },
    { value: 'map', icon: Map, label: 'Mapa' },
  ];

  // Filter navigation items based on user role
  const navItems = isAuthenticated && user
    ? allNavItems.filter((item) => {
      const allowedTabs = ROLE_PERMISSIONS[user.role] || [];
      return allowedTabs.includes(item.value);
    })
    : allNavItems;

  // Compute effective active tab
  const effectiveTab = (isAuthenticated && user && navItems.length > 0)
    ? (navItems.some((n) => n.value === activeTab) ? activeTab : navItems[0].value)
    : activeTab;

  if (effectiveTab !== activeTab) {
    setActiveTab(effectiveTab);
  }

  const getActiveLabel = () => navItems.find(n => n.value === activeTab)?.label || 'Dashboard';

  // Show loading state during hydration
  if (!isHydrated) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50">
        <div className="flex items-center gap-3">
          <Loader2 className="h-8 w-8 animate-spin text-emerald-500" />
          <span className="text-slate-500">Cargando...</span>
        </div>
      </div>
    );
  }

  // Show login screen if not authenticated
  if (!isAuthenticated || !user) {
    return <LoginScreen />;
  }

  const roleBadge = ROLE_BADGE[user.role] || ROLE_BADGE.collector;

  return (
    <div className="min-h-screen flex bg-slate-50 dark:bg-slate-950">
      <InactivityTracker />
      {/* SIDEBAR - Desktop */}
      <aside className="hidden lg:flex lg:flex-col lg:w-64 bg-white dark:bg-slate-900 border-r border-slate-200 dark:border-slate-800 fixed inset-y-0 left-0 z-30">
        {/* Logo - gradient header */}
        <div className="bg-gradient-to-br from-emerald-600 to-teal-600 px-5 py-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-white/15 backdrop-blur-sm border border-white/20 flex items-center justify-center shadow-lg">
              <ShieldCheck className="w-5 h-5 text-white" />
            </div>
            <div>
              <h1 className="text-base font-bold text-white tracking-tight">KC Cobranzas</h1>
              <p className="text-[10px] text-emerald-100/80">Panel de Administración</p>
            </div>
          </div>
        </div>

        {/* Navigation */}
        <nav className="flex-1 py-4 px-3 overflow-y-auto">
          <p className="px-3 mb-2 text-[10px] font-semibold text-slate-400 uppercase tracking-wider">Menú Principal</p>
          {navItems.map((item) => {
            const Icon = item.icon;
            const isActive = activeTab === item.value;
            return (
              <button
                key={item.value}
                onClick={() => setActiveTab(item.value)}
                className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition-all duration-200 mb-0.5 ${isActive
                  ? 'bg-gradient-to-r from-emerald-500 to-teal-500 text-white shadow-md shadow-emerald-500/20'
                  : 'text-slate-600 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-800 hover:text-slate-900 dark:hover:text-slate-100'
                  }`}
              >
                <Icon className={`h-4.5 w-4.5 ${isActive ? 'text-white' : 'text-slate-400'}`} />
                <span>{item.label}</span>
              </button>
            );
          })}
        </nav>

        {/* Sidebar Footer */}
        <div className="px-3 py-3 border-t border-slate-100 dark:border-slate-800">
          <div className="flex items-center gap-3 px-2 py-2">
            <div className="w-8 h-8 rounded-full bg-gradient-to-br from-emerald-400 to-teal-500 flex items-center justify-center text-white text-xs font-bold shadow-sm shrink-0">
              {user.name?.charAt(0)?.toUpperCase() || 'U'}
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-xs font-medium text-slate-900 dark:text-slate-100 truncate">{user.name}</p>
              <Badge variant="outline" className={`text-[9px] px-1.5 py-0 ${roleBadge.color}`}>
                {roleBadge.label}
              </Badge>
            </div>
            <div className="flex items-center gap-0.5">
              <Button variant="ghost" size="icon" onClick={() => { setProfileName(user.name || ''); setProfileEmail(user.email || ''); setShowProfile(true); }} className="h-7 w-7 text-slate-400 hover:text-emerald-500 hover:bg-emerald-50" title="Perfil">
                <User className="h-3.5 w-3.5" />
              </Button>
              <Button variant="ghost" size="icon" onClick={() => setShowChangePassword(true)} className="h-7 w-7 text-slate-400 hover:text-emerald-500 hover:bg-emerald-50" title="Cambiar contraseña">
                <KeyRound className="h-3.5 w-3.5" />
              </Button>
              <Button variant="ghost" size="icon" onClick={() => { const isDark = document.documentElement.classList.toggle('dark'); localStorage.setItem('kc-dark-mode', isDark ? 'dark' : 'light'); }} className="h-7 w-7 text-slate-400 hover:text-amber-500 hover:bg-amber-50" title="Modo oscuro/claro">
                {typeof window !== 'undefined' && document.documentElement.classList.contains('dark') ? <Sun className="h-3.5 w-3.5" /> : <Moon className="h-3.5 w-3.5" />}
              </Button>
              <Button variant="ghost" size="icon" onClick={handleLogout} className="h-7 w-7 text-slate-400 hover:text-red-500 hover:bg-red-50" title="Cerrar sesión">
                <LogOut className="h-3.5 w-3.5" />
              </Button>
            </div>
          </div>
        </div>
      </aside>

      {/* Profile Dialog */}
      {showProfile && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm">
          <div className="bg-white dark:bg-slate-900 rounded-2xl shadow-2xl w-full max-w-sm mx-4 border border-slate-100 dark:border-slate-800 p-6">
            <h3 className="text-lg font-semibold text-slate-900 dark:text-slate-100 mb-4">Editar Perfil</h3>
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">Nombre</label>
                <input type="text" value={profileName} onChange={e => setProfileName(e.target.value)} className="w-full px-3 py-2 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-emerald-500" />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">Email</label>
                <input type="email" value={profileEmail} onChange={e => setProfileEmail(e.target.value)} className="w-full px-3 py-2 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-emerald-500" />
              </div>
              <div className="flex justify-end gap-2 pt-2">
                <Button variant="outline" onClick={() => setShowProfile(false)}>Cancelar</Button>
                <Button onClick={async () => {
                  setSavingProfile(true);
                  try {
                    const res = await fetch('/api/collectors', { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ id: user.id, name: profileName, email: profileEmail }) });
                    if (res.ok) {
                      setShowProfile(false);
                      refreshRole();
                    }
                  } catch {} finally {
                    setSavingProfile(false);
                  }
                }} disabled={savingProfile}>
                  {savingProfile ? 'Guardando...' : 'Guardar'}
                </Button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Change Password Dialog */}
      {showChangePassword && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm">
          <div className="bg-white dark:bg-slate-900 rounded-2xl shadow-2xl w-full max-w-sm mx-4 border border-slate-100 dark:border-slate-800">
            <ChangePassword onClose={() => setShowChangePassword(false)} />
          </div>
        </div>
      )}
      <DataToolsDialog open={showDataTools} onClose={() => setShowDataTools(false)} />
      <ReportsDialog open={showReports} onOpenChange={setShowReports} />

      {/* MOBILE HEADER */}
      <div className="lg:hidden fixed top-0 left-0 right-0 z-40 bg-white/80 dark:bg-slate-900/80 backdrop-blur-lg border-b border-slate-200 dark:border-slate-800 shadow-sm">
        <div className="flex items-center justify-between h-14 px-4">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-emerald-500 to-teal-600 flex items-center justify-center shadow-sm">
              <ShieldCheck className="w-4 h-4 text-white" />
            </div>
            <div>
              <h1 className="text-sm font-bold text-slate-900 dark:text-slate-100">KC Cobranzas</h1>
              <p className="text-[10px] text-slate-400 -mt-0.5">{getActiveLabel()}</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <div className="relative">
              <button onClick={()=>{setNotifOpen(!notifOpen);if(!notifOpen)markRead(notifications.filter(n=>!n.isRead).map(n=>n.id))}} className="p-1.5 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors relative" aria-label="Notificaciones">
                {unreadCount>0?<BellRing className="h-5 w-5 text-emerald-500"/>:<Bell className="h-5 w-5 text-slate-600 dark:text-slate-400"/>}
                {unreadCount>0&&<span className="absolute -top-0.5 -right-0.5 h-3.5 min-w-[14px] px-0.5 rounded-full bg-red-500 text-[9px] text-white flex items-center justify-center font-bold">{unreadCount>9?'9+':unreadCount}</span>}
              </button>
            </div>
            <div className="w-7 h-7 rounded-full bg-gradient-to-br from-emerald-400 to-teal-500 flex items-center justify-center text-white text-[10px] font-bold">
              {user.name?.charAt(0)?.toUpperCase() || 'U'}
            </div>
            <button
              onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
              className="p-2 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
              aria-label="Menú de navegación"
            >
              {mobileMenuOpen ? <X className="h-5 w-5 text-slate-600 dark:text-slate-400" /> : <Menu className="h-5 w-5 text-slate-600 dark:text-slate-400" />}
            </button>
          </div>
        </div>

      </div>

      {/* MOBILE DRAWER */}
      {mobileMenuOpen && (
        <div className="lg:hidden fixed inset-0 z-[10000]">
          <div className="absolute inset-0 bg-black/50 backdrop-blur-sm animate-[fadeIn_200ms_ease-out]" onClick={() => setMobileMenuOpen(false)} />
          <div className="absolute right-0 top-0 bottom-0 w-72 bg-white dark:bg-slate-900 shadow-2xl flex flex-col animate-[slideInRight_200ms_ease-out]">
            {/* Header with gradient */}
            <div className="bg-gradient-to-br from-emerald-600 to-teal-600 px-5 py-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <ShieldCheck className="w-7 h-7 text-white" />
                  <h2 className="text-sm font-bold text-white">KC Cobranzas</h2>
                </div>
                <button onClick={() => setMobileMenuOpen(false)} className="p-1.5 rounded-lg bg-white/10 hover:bg-white/20 transition-colors">
                  <X className="h-4 w-4 text-white" />
                </button>
              </div>
              <div className="flex items-center gap-3 mt-4">
                <div className="w-9 h-9 rounded-full bg-white/15 backdrop-blur-sm border border-white/20 flex items-center justify-center text-white text-sm font-bold shrink-0">
                  {user.name?.charAt(0)?.toUpperCase() || 'U'}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-white truncate">{user.name}</p>
                  <Badge variant="outline" className={`text-[9px] px-1.5 py-0 bg-white/10 border-white/20 text-white`}>
                    {roleBadge.label}
                  </Badge>
                </div>
              </div>
            </div>

            <nav className="flex-1 py-4 px-3 overflow-y-auto">
              <p className="px-3 mb-2 text-[10px] font-semibold text-slate-400 uppercase tracking-wider">Menú Principal</p>
              {navItems.map((item) => {
                const Icon = item.icon;
                const isActive = activeTab === item.value;
                return (
                  <button
                    key={item.value}
                    onClick={() => handleTabChange(item.value)}
                    className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-medium transition-all duration-200 mb-0.5 ${isActive
                      ? 'bg-gradient-to-r from-emerald-500 to-teal-500 text-white shadow-md shadow-emerald-500/20'
                      : 'text-slate-600 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-800 hover:text-slate-900 dark:hover:text-slate-100'
                      }`}
                  >
                    <Icon className={`h-5 w-5 ${isActive ? 'text-white' : 'text-slate-400'}`} />
                    <span>{item.label}</span>
                  </button>
                );
              })}
            </nav>
            <div className="px-3 py-3 border-t border-slate-100 dark:border-slate-800 space-y-1.5">
              <Button variant="ghost" onClick={() => { setMobileMenuOpen(false); setShowReports(true); }} className="w-full justify-start text-slate-600 dark:text-slate-400 hover:text-emerald-600 hover:bg-emerald-50 dark:hover:bg-emerald-950">
                <BarChart3 className="h-4 w-4 mr-2" /> Reportes
              </Button>
              <Button variant="ghost" onClick={() => { setMobileMenuOpen(false); setShowDataTools(true); }} className="w-full justify-start text-slate-600 dark:text-slate-400 hover:text-emerald-600 hover:bg-emerald-50 dark:hover:bg-emerald-950">
                <Download className="h-4 w-4 mr-2" /> Exportar / Importar
              </Button>
              <Button variant="ghost" onClick={() => { setMobileMenuOpen(false); setShowChangePassword(true); }} className="w-full justify-start text-slate-600 dark:text-slate-400 hover:text-emerald-600 hover:bg-emerald-50 dark:hover:bg-emerald-950">
                <KeyRound className="h-4 w-4 mr-2" /> Cambiar Contraseña
              </Button>
              <Button variant="ghost" onClick={handleLogout} className="w-full justify-start text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-950">
                <LogOut className="h-4 w-4 mr-2" /> Cerrar Sesión
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* MAIN CONTENT */}
      <main className="flex-1 lg:ml-64 min-h-screen flex flex-col">
        {/* Desktop top bar */}
        <header className="hidden lg:flex items-center justify-between h-14 px-6 bg-white/80 dark:bg-slate-900/80 backdrop-blur-lg border-b border-slate-100 dark:border-slate-800 sticky top-0 z-20">
          <div className="flex items-center gap-4">
            <h2 className="text-lg font-semibold text-slate-900 dark:text-slate-100">{getActiveLabel()}</h2>
          </div>
          <div className="flex items-center gap-2">
            <CompanySelector />
            <div className="relative" ref={notifRef}>
              <Button variant="ghost" size="icon" onClick={()=>{setNotifOpen(!notifOpen);if(!notifOpen)markRead(notifications.filter(n=>!n.isRead).map(n=>n.id))}} className="relative h-8 w-8 text-slate-400 hover:text-emerald-500 hover:bg-emerald-50 dark:hover:bg-emerald-950" title="Notificaciones">
                {unreadCount>0?<BellRing className="h-4 w-4 text-emerald-500"/>:<Bell className="h-4 w-4"/>}
                {unreadCount>0&&<span className="absolute -top-0.5 -right-0.5 h-3.5 min-w-[14px] px-1 rounded-full bg-red-500 text-[9px] text-white flex items-center justify-center font-bold">{unreadCount>9?'9+':unreadCount}</span>}
              </Button>
              {notifOpen&&<div className="absolute right-0 top-full mt-2 w-80 sm:w-96 bg-white dark:bg-slate-900 rounded-xl shadow-2xl border border-slate-200 dark:border-slate-700 overflow-hidden z-50">
                <div className="flex items-center justify-between px-4 py-3 border-b border-slate-100 dark:border-slate-800">
                  <span className="text-sm font-semibold text-slate-700 dark:text-slate-300">Notificaciones</span>
                  {unreadCount>0&&<Badge variant="outline" className="bg-emerald-50 dark:bg-emerald-950 text-emerald-700 dark:text-emerald-300 border-emerald-200 text-xs">{unreadCount} sin leer</Badge>}
                </div>
                <div className="max-h-[400px] overflow-y-auto">
                  {notifications.length===0?<div className="p-8 text-center text-slate-400"><Bell className="h-8 w-8 mx-auto mb-2 opacity-50"/><p className="text-sm">Sin notificaciones</p></div>:notifications.map(n=><div key={n.id} className={`flex items-start gap-3 p-3 border-b border-slate-50 dark:border-slate-800/50 hover:bg-slate-50 dark:hover:bg-slate-800/30 transition-colors ${!n.isRead?'bg-emerald-50/50 dark:bg-emerald-950/20':''}`}>
                    <div className={`w-8 h-8 rounded-full flex items-center justify-center shrink-0 ${n.type==='warning'?'bg-amber-100 dark:bg-amber-900/50':n.type==='error'?'bg-red-100 dark:bg-red-900/50':'bg-blue-100 dark:bg-blue-900/50'}`}>
                      {n.type==='warning'?<Activity className="h-4 w-4 text-amber-600 dark:text-amber-300"/>:n.type==='error'?<ShieldCheck className="h-4 w-4 text-red-600 dark:text-red-300"/>:<Bell className="h-4 w-4 text-blue-600 dark:text-blue-300"/>}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className={`text-sm ${!n.isRead?'font-semibold text-slate-800 dark:text-slate-200':'text-slate-600 dark:text-slate-400'}`}>{n.title}</p>
                      {n.body&&<p className="text-xs text-slate-500 mt-0.5 line-clamp-2">{n.body}</p>}
                      <p className="text-[10px] text-slate-400 mt-1">{new Date(n.createdAt).toLocaleDateString('es-PE',{day:'numeric',month:'short',hour:'2-digit',minute:'2-digit'})}</p>
                    </div>
                    <button onClick={()=>delNotif(n.id)} className="shrink-0 p-1 rounded-md hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-400 hover:text-red-500 transition-colors"><Trash2 className="h-3.5 w-3.5"/></button>
                  </div>)}
                </div>
              </div>}
            </div>
            <Button variant="ghost" size="sm" onClick={()=>setShowReports(true)} className="h-8 text-xs text-slate-400 hover:text-emerald-500 hover:bg-emerald-50 dark:hover:bg-emerald-950" title="Ver Reportes">
              <BarChart3 className="h-3.5 w-3.5 mr-1"/>Reportes
            </Button>
            <Button variant="ghost" size="sm" onClick={() => setShowDataTools(true)} className="h-8 text-xs text-slate-400 hover:text-emerald-500 hover:bg-emerald-50 dark:hover:bg-emerald-950" title="Exportar / Importar">
              <Download className="h-3.5 w-3.5 mr-1" />
              Datos
            </Button>
            <span className="w-px h-5 bg-slate-200 dark:bg-slate-700" />
            <div className="flex items-center gap-2">
              <div className="w-7 h-7 rounded-full bg-gradient-to-br from-emerald-400 to-teal-500 flex items-center justify-center text-white text-[10px] font-bold shadow-sm">
                {user.name?.charAt(0)?.toUpperCase() || 'U'}
              </div>
              <span className="text-xs text-slate-500 dark:text-slate-400">{user.name}</span>
            </div>
            <Button variant="ghost" size="icon" onClick={handleLogout} className="h-7 w-7 text-slate-400 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-950" title="Cerrar sesión">
              <LogOut className="h-3.5 w-3.5" />
            </Button>
          </div>
        </header>

        {/* Content */}
        <div className="flex-1 px-3 sm:px-6 lg:px-8 py-4 sm:py-6 pt-16 lg:pt-6">
          {activeTab === 'dashboard' && <ErrorBoundary><DashboardTab key={`dashboard-${refreshKey}`} /></ErrorBoundary>}
          {activeTab === 'loans' && <LoansTab key={`loans-${refreshKey}`} />}
          {activeTab === 'clients' && <ClientsTab key={`clients-${refreshKey}`} />}
          {activeTab === 'payments' && <PaymentsTab key={`payments-${refreshKey}`} />}
          {activeTab === 'collectors' && <CollectorsTab key={`collectors-${refreshKey}`} />}
          {activeTab === 'audit' && <ErrorBoundary><AuditTab key={`audit-${refreshKey}`} /></ErrorBoundary>}
          {activeTab === 'capital' && <CapitalTab key={`capital-${refreshKey}`} />}
          {activeTab === 'chat' && <ChatTab key={`chat-${refreshKey}`} />}
          {activeTab === 'late-fee' && <ErrorBoundary><LateFeeTab key={`latefee-${refreshKey}`} /></ErrorBoundary>}
          {activeTab === 'daily-settlement' && <DailySettlementTab key={`daily-settlement-${refreshKey}`} />}
          {activeTab === 'caja' && <CajaTab key={`caja-${refreshKey}`} />}
          {activeTab === 'map' && <ErrorBoundary><MapTab key={`map-${refreshKey}`} /></ErrorBoundary>}
          {activeTab === 'config' && <ConfigTab key={`config-${refreshKey}`} />}
        </div>

        {/* Footer */}
        <footer className="bg-white dark:bg-slate-900 border-t border-slate-100 dark:border-slate-800 py-3 mt-auto">
          <div className="px-4 sm:px-6 lg:px-8 flex flex-col sm:flex-row items-center justify-between gap-2">
            <p className="text-[10px] text-slate-400">© 2025 KC Cobranzas - Sistema de Gestión de Cobranzas</p>
            <div className="flex items-center gap-4">
              <span className="text-[10px] text-slate-400 flex items-center gap-1">
                <ShieldCheck className="h-2.5 w-2.5 text-emerald-500" />
                Auditoría activa
              </span>
              <span className="text-[10px] text-slate-400 flex items-center gap-1">
                <Clock className="h-2.5 w-2.5 text-emerald-500" />
                Mora automática
              </span>
            </div>
          </div>
        </footer>
      </main>
    </div>
  );
}
