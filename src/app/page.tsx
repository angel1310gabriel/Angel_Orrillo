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
import DashboardTab from '@/components/dashboard-tab';
import LoginScreen from '@/components/login-screen';
import { ErrorBoundary } from '@/components/error-boundary';
import DataToolsDialog from '@/components/data-tools';
import ReportsDialog from '@/components/reports-dialog';
import { useSupabaseRealtime } from '@/hooks/use-supabase-realtime';
import { useAuth, ROLE_PERMISSIONS } from '@/hooks/use-auth';
import { usePush } from '@/hooks/use-push';

import ChangePassword from '@/components/change-password';
import StarfieldBg from '@/components/starfield-bg';
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
  AlertTriangle,
} from 'lucide-react';
import { ChevronDown, Plus, Camera, Target, MessageSquare } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  AlertDialog,
  AlertDialogContent,
  AlertDialogHeader,
  AlertDialogFooter,
  AlertDialogTitle,
  AlertDialogDescription,
  AlertDialogAction,
  AlertDialogCancel,
} from '@/components/ui/alert-dialog';

// ============================================================
// Skeleton loader for dynamic tabs
// ============================================================
function TabSkeleton({ label, rows = 4 }: { label?: string; rows?: number }) {
  return (
    <div className="flex flex-col gap-4 p-6">
      {label && <div className="h-5 w-40 skeleton-shimmer" />}
      {Array.from({ length: rows }).map((_, i) => (
        <div key={i} className="flex gap-4">
          <div className="h-12 flex-1 skeleton-shimmer" />
          <div className="h-12 w-24 skeleton-shimmer" />
          <div className="h-12 w-32 skeleton-shimmer" />
        </div>
      ))}
    </div>
  );
}

// Dynamic imports for heavy components (recharts) — lazy loaded, no SSR
const AuditTab = dynamic(() => import('@/components/audit-tab'), {
  ssr: false,
  loading: () => <TabSkeleton label="Auditoría" rows={5} />,
});

const LateFeeTab = dynamic(() => import('@/components/late-fee-tab'), {
  ssr: false,
  loading: () => <TabSkeleton label="Sistema de Mora" rows={4} />,
});

const MapTab = dynamic(() => import('@/components/map-tab'), {
  ssr: false,
  loading: () => <TabSkeleton label="Mapa" rows={3} />,
});

// ============================================================
// Role badge colors
// ============================================================

const ROLE_BADGE: Record<string, { label: string; color: string }> = {
  admin: { label: 'Administrador', color: 'bg-emerald-50 text-emerald-700 border-emerald-200' },
  supervisor: { label: 'Supervisor', color: 'bg-amber-50 text-amber-700 border-amber-200' },
  collector: { label: 'Cobrador', color: 'bg-background/50 text-foreground/80 border-input' },
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
  const [mounted, setMounted] = useState(false);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [notifOpen, setNotifOpen] = useState(false);
  const [notifications, setNotifications] = useState<{id:string;title:string;body:string|null;type:string|null;isRead:boolean;createdAt:string;referenceType:string|null;referenceId:string|null}[]>([]);
  const notifRef = useRef<HTMLDivElement>(null);
  const unreadCount = notifications.filter(n=>!n.isRead).length;
  const [fabOpen, setFabOpen] = useState(false);
  const fabRef = useRef<HTMLDivElement>(null);
  const [expandedGroups, setExpandedGroups] = useState<Record<string, boolean>>({
    panel: true, gestion: true, personal: true, finanzas: true, seguimiento: true, sistema: true,
  });
  const toggleGroup = (key: string) => setExpandedGroups(prev => ({ ...prev, [key]: !prev[key] }));
  const hasCheckedSession = useRef(false);

  // Live clock
  const [clock, setClock] = useState('');
  useEffect(() => {
    const tick = () => setClock(new Date().toLocaleTimeString('es-PE', { hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: false }));
    tick(); const iv = setInterval(tick, 1000); return () => clearInterval(iv);
  }, []);

  // Connection status
  const [isOnline, setIsOnline] = useState(true);
  useEffect(() => {
    setIsOnline(navigator.onLine);
    const go = () => setIsOnline(true);
    const goAway = () => setIsOnline(false);
    window.addEventListener('online', go); window.addEventListener('offline', goAway);
    return () => { window.removeEventListener('online', go); window.removeEventListener('offline', goAway); };
  }, []);

  // Location tracking state + refs — must be before early returns to satisfy React's rules of hooks
  const [locationTracking, setLocationTracking] = useState(false);
  const watchIdRef = useRef<number | null>(null);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const lastSentRef = useRef<{latitude: number; longitude: number; accuracy: number | null; speed: number | null} | null>(null);

  // Track mounted state (browser-side) and refresh role on first load
  useEffect(() => {
    setMounted(true);
    if (!hasCheckedSession.current) {
      hasCheckedSession.current = true;
      refreshRole();
    }
  }, [refreshRole]);

  // Initialize push notifications (must be before early returns for hook consistency)
  usePush();

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

  // Close notifications / FAB on click outside
  useEffect(() => {
    if (!notifOpen && !fabOpen) return;
    const handler = (e: MouseEvent) => {
      if (notifRef.current && !notifRef.current.contains(e.target as Node)) setNotifOpen(false);
      if (fabRef.current && !fabRef.current.contains(e.target as Node)) setFabOpen(false);
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [notifOpen, fabOpen]);

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

  const [showLogoutConfirm, setShowLogoutConfirm] = useState(false);

  const handleLogout = () => {
    setShowLogoutConfirm(true);
    setMobileMenuOpen(false);
  };

  const confirmLogout = () => {
    setShowLogoutConfirm(false);
    logout();
  };

  // Navigation groups with collapsible sections
  const navGroups = [
    { key: 'panel', title: 'Panel', items: [
      { value: 'dashboard', icon: BarChart3, label: 'Dashboard' },
    ]},
    { key: 'gestion', title: 'Gestión', items: [
      { value: 'loans', icon: DollarSign, label: 'Préstamos' },
      { value: 'clients', icon: Users, label: 'Clientes' },
      { value: 'payments', icon: CreditCard, label: 'Cobros' },
    ]},
    { key: 'personal', title: 'Personal', items: [
      { value: 'collectors', icon: Navigation, label: 'Personal' },
      { value: 'audit', icon: ShieldCheck, label: 'Auditoría' },
    ]},
    { key: 'finanzas', title: 'Finanzas', items: [
      { value: 'capital', icon: Wallet, label: 'Capital' },
      { value: 'caja', icon: Wallet, label: 'Caja' },
      { value: 'daily-settlement', icon: Wallet, label: 'Cierre de Caja' },
    ]},
    { key: 'seguimiento', title: 'Seguimiento', items: [
      { value: 'chat', icon: MessageCircle, label: 'Mensajes' },
      { value: 'map', icon: Map, label: 'Mapa' },
    ]},
    { key: 'sistema', title: 'Sistema', items: [
      { value: 'late-fee', icon: Clock, label: 'Mora Auto' },
    ]},
  ];

  // Filter items in each group based on user role, remove empty groups
  const filteredGroups = isAuthenticated && user
    ? navGroups
        .map(g => ({
          ...g,
          items: g.items.filter(item => (ROLE_PERMISSIONS[user.role] || []).includes(item.value)),
        }))
        .filter(g => g.items.length > 0)
    : navGroups;

  // Flatten for backward compatibility (effective tab, etc.)
  const allNavItems = filteredGroups.flatMap(g => g.items);

  // Compute effective active tab
  const effectiveTab = (isAuthenticated && user && allNavItems.length > 0)
    ? (allNavItems.some((n) => n.value === activeTab) ? activeTab : allNavItems[0].value)
    : activeTab;

  if (effectiveTab !== activeTab) {
    setActiveTab(effectiveTab);
  }

  const getActiveLabel = () => allNavItems.find(n => n.value === activeTab)?.label || 'Dashboard';

  // Show loading until component mounts in browser (SSR guard)
  if (!mounted) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background/50">
        <div className="flex items-center gap-3">
          <Loader2 className="h-8 w-8 animate-spin text-emerald-500" />
          <span className="text-muted-foreground">Cargando...</span>
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
    <ErrorBoundary>
    <div className="min-h-screen flex relative bg-[#05060b] overflow-hidden">
      <StarfieldBg />
      {/* Ambient glows */}
      <div className="fixed top-[-200px] left-[-200px] w-[600px] h-[600px] bg-emerald-500/4 rounded-full blur-[120px] pointer-events-none z-0" />
      <div className="fixed bottom-[-200px] right-[-200px] w-[600px] h-[600px] bg-emerald-500/3 rounded-full blur-[120px] pointer-events-none z-0" />
      <InactivityTracker />
{/* SIDEBAR - Desktop */}
      <aside className="hidden lg:flex lg:flex-col lg:w-64 backdrop-blur-2xl border-r border-emerald-500/10 shadow-[2px_0_20px_rgba(16,185,129,0.06)] fixed inset-y-0 left-0 z-30 bg-transparent">
        {/* Logo - premium header */}
        <div className="h-14 px-5 flex items-center border-b border-emerald-500/20 shadow-[inset_0_-1px_20px_rgba(16,185,129,0.08)] bg-transparent">
          <div className="flex items-center gap-3">
            <img src="/logo.png" alt="KC Cobranzas" className="w-10 h-10 rounded-lg shadow-lg shadow-black/30" />
            <div>
              <h1 className="text-base font-bold text-white tracking-tight">KC Cobranzas</h1>
              <p className="text-[10px] text-muted-foreground font-medium">Panel de Administración</p>
            </div>
          </div>
        </div>

        {/* Navigation */}
        <nav className="flex-1 py-4 px-3 overflow-y-auto scrollbar-thin scrollbar-thumb-slate-700 scrollbar-track-transparent hover:scrollbar-thumb-slate-600 [&::-webkit-scrollbar]:w-1 [&::-webkit-scrollbar-thumb]:rounded-full [&::-webkit-scrollbar-thumb]:bg-slate-700 [&::-webkit-scrollbar-track]:bg-transparent hover:[&::-webkit-scrollbar-thumb]:bg-slate-600 bg-transparent scrollbar-custom">
          {filteredGroups.map((group) => {
            const isExpanded = expandedGroups[group.key];
            return (
              <div key={group.key} className="mb-2">
                <button
                  onClick={() => toggleGroup(group.key)}
                  className="w-full flex items-center justify-between px-3 py-1.5 rounded-lg text-[10px] font-semibold text-muted-foreground uppercase tracking-wider hover:text-white/80 transition-colors"
                >
                  <span>{group.title}</span>
                  <ChevronDown className={`h-3 w-3 transition-transform duration-200 ${isExpanded ? 'rotate-0' : '-rotate-90'}`} />
                </button>
                {isExpanded && group.items.map((item) => {
                  const Icon = item.icon;
                  const isActive = activeTab === item.value;
                  return (
                    <button
                      key={item.value}
                      onClick={() => setActiveTab(item.value)}
                      className={`w-full flex items-center gap-3 px-3 py-2 rounded-xl text-sm font-medium transition-all duration-200 mb-0.5 group relative overflow-hidden ${isActive
                        ? 'gradient-border-active text-emerald-100 shadow-lg shadow-emerald-500/10'
                        : 'text-muted-foreground hover:bg-white/5 hover:text-white'
                      }`}
                    >
                      <Icon className={`h-4 w-4 ${isActive ? 'text-emerald-200' : 'text-muted-foreground group-hover:scale-110'} transition-transform duration-300`} />
                      <span>{item.label}</span>
                    </button>
                  );
                })}
              </div>
            );
          })}
        </nav>

        {/* Sidebar Footer - User Section */}
        <div className="border-t border-emerald-500/20 shadow-[inset_0_1px_20px_rgba(16,185,129,0.08)] px-4 pt-4 pb-3">
          <div className="flex items-center justify-center gap-3 mb-3">
            <div className="relative shrink-0">
              <div className="absolute inset-0 bg-gradient-to-r from-emerald-500 to-teal-500 rounded-full blur-lg animate-pulse" />
              <div className="relative w-10 h-10 rounded-full bg-gradient-to-br from-emerald-400 via-teal-400 to-emerald-500 flex items-center justify-center text-white text-base font-bold shadow-lg shadow-emerald-500/30 ring-2 ring-emerald-500/40">
                {user.name?.charAt(0)?.toUpperCase() || 'U'}
              </div>
            </div>
            <div className="text-left">
              <p className="text-sm font-bold text-white truncate max-w-[150px]">{user.name}</p>
              <span className={`inline-block text-[10px] font-semibold px-2 py-0.5 rounded-full mt-0.5 ${roleBadge.color}`}>
                {roleBadge.label}
              </span>
            </div>
          </div>
          <div className="flex items-center justify-center gap-1.5">
            <button onClick={() => { setProfileName(user.name || ''); setProfileEmail(user.email || ''); setShowProfile(true); }} className="flex items-center gap-1 px-3 py-1.5 rounded-lg text-[11px] font-medium text-muted-foreground hover:text-white hover:bg-white/10 hover:shadow-[0_0_20px_rgba(255,255,255,0.05)] transition-all duration-200" title="Perfil"><User className="h-3.5 w-3.5" />Perfil</button>
            <span className="w-px h-4 bg-emerald-500/20" />
            <button onClick={() => setShowChangePassword(true)} className="flex items-center gap-1 px-3 py-1.5 rounded-lg text-[11px] font-medium text-muted-foreground hover:text-amber-400 hover:bg-amber-500/10 hover:shadow-[0_0_20px_rgba(251,191,36,0.1)] transition-all duration-200" title="Cambiar Contraseña"><KeyRound className="h-3.5 w-3.5" />Clave</button>
            <span className="w-px h-4 bg-emerald-500/20" />
            <button onClick={handleLogout} className="flex items-center gap-1 px-3 py-1.5 rounded-lg text-[11px] font-medium text-muted-foreground hover:text-red-400 hover:bg-red-500/10 hover:shadow-[0_0_20px_rgba(239,68,68,0.1)] transition-all duration-200" title="Cerrar sesión"><LogOut className="h-3.5 w-3.5" />Salir</button>
          </div>
        </div>
      </aside>

      {/* Profile Dialog */}
      {showProfile && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm">
          <div className="bg-white dark:bg-[#05060b]/90 rounded-2xl shadow-2xl w-full max-w-sm mx-4 border border-input/50 dark:border-emerald-500/10 p-6">
            <h3 className="text-lg font-semibold text-foreground dark:text-foreground mb-4">Editar Perfil</h3>
            <div className="space-y-4">
              {/* Photo Upload */}
              <div className="flex flex-col items-center gap-3">
                <div className="relative w-24 h-24 rounded-full bg-gradient-to-br from-emerald-400 via-teal-400 to-emerald-500 flex items-center justify-center text-white text-2xl font-bold shadow-lg shadow-emerald-500/30 ring-2 ring-emerald-500/40 overflow-hidden">
                  {user.photoUrl ? (
                    <img src={user.photoUrl} alt={user.name} className="w-full h-full object-cover" />
                  ) : (
                    <span className="text-2xl font-bold">{user.name?.charAt(0)?.toUpperCase() || 'U'}</span>
                  )}
                </div>
                <label className="cursor-pointer flex items-center gap-2 px-3 py-1.5 rounded-lg bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-400 text-sm font-medium transition-colors">
                  <Camera className="h-4 w-4" />
                  <span>Cambiar foto</span>
<input
                    type="file"
                    accept="image/*"
                    capture="environment"
                    className="hidden"
                    onChange={(e) => {
                      const file = e.target.files?.[0];
                      if (file) {
                        const reader = new FileReader();
                        reader.onload = async (e) => {
                          const base64 = e.target?.result as string;
                          try {
                            const res = await fetch('/api/collectors', {
                              method: 'PUT',
                              headers: { 'Content-Type': 'application/json' },
                              body: JSON.stringify({ id: user.id, photoUrl: base64 })
                            });
                            if (res.ok) {
                              refreshRole();
                            }
                          } catch {}
                        };
                        reader.readAsDataURL(file);
                      }
                    }}
                  />
                </label>
              </div>
              <div>
                <label className="block text-sm font-medium text-foreground/80 dark:text-foreground/80 mb-1">Nombre</label>
                <input type="text" value={profileName} onChange={e => setProfileName(e.target.value)} className="w-full px-3 py-2 rounded-lg border border-input dark:border-emerald-500/5 bg-white dark:bg-[#05060b]/70 text-foreground dark:text-foreground focus:outline-none focus:ring-2 focus:ring-emerald-500" />
              </div>
              <div>
                <label className="block text-sm font-medium text-foreground/80 dark:text-foreground/80 mb-1">Email</label>
                <input type="email" value={profileEmail} onChange={e => setProfileEmail(e.target.value)} className="w-full px-3 py-2 rounded-lg border border-input dark:border-emerald-500/5 bg-white dark:bg-[#05060b]/70 text-foreground dark:text-foreground focus:outline-none focus:ring-2 focus:ring-emerald-500" />
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
          <div className="bg-white dark:bg-[#05060b]/90 rounded-2xl shadow-2xl w-full max-w-sm mx-4 border border-input/50 dark:border-emerald-500/10">
            <ChangePassword onClose={() => setShowChangePassword(false)} />
          </div>
        </div>
      )}
      {/* Logout Confirmation */}
      <AlertDialog open={showLogoutConfirm} onOpenChange={setShowLogoutConfirm}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-red-500 to-rose-600 flex items-center justify-center shadow-lg shadow-red-500/20">
                <LogOut className="h-5 w-5 text-white" />
              </div>
              <span>Cerrar Sesión</span>
            </AlertDialogTitle>
            <AlertDialogDescription className="text-muted-foreground dark:text-muted-foreground pt-2 text-sm">
              ¿Estás seguro de que deseas cerrar sesión?
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter className="gap-2">
            <AlertDialogCancel className="border-input dark:border-emerald-500/5">Cancelar</AlertDialogCancel>
            <AlertDialogAction
              onClick={confirmLogout}
              className="bg-gradient-to-r from-red-500 to-rose-600 text-white hover:from-red-600 hover:to-rose-700 shadow-lg shadow-red-500/20 border-0"
            >
              <LogOut className="h-4 w-4 mr-2" />
              Cerrar Sesión
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
      <DataToolsDialog open={showDataTools} onClose={() => setShowDataTools(false)} />
      <ReportsDialog open={showReports} onOpenChange={setShowReports} />

      {/* MOBILE HEADER */}
      <div className="lg:hidden fixed top-0 left-0 right-0 z-40 backdrop-blur-2xl border-b border-emerald-500/20 shadow-[inset_0_-1px_20px_rgba(16,185,129,0.08)]">
        <div className="flex items-center justify-between h-14 px-4">
          <div className="flex items-center gap-3">
            <img src="/logo.png" alt="KC Cobranzas" className="w-7 h-7 rounded-md" />
            <div>
              <h1 className="text-sm font-bold text-foreground dark:text-foreground">KC Cobranzas</h1>
              <p className="text-[10px] text-muted-foreground -mt-0.5">{getActiveLabel()}</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <div className="relative">
              <button onClick={()=>{setNotifOpen(!notifOpen);if(!notifOpen)markRead(notifications.filter(n=>!n.isRead).map(n=>n.id))}} className="p-1.5 rounded-lg hover:bg-background/70 dark:hover:bg-white/10 transition-colors relative" aria-label="Notificaciones">
                {unreadCount>0?<BellRing className="h-5 w-5 text-emerald-500"/>:<Bell className="h-5 w-5 text-foreground/70 dark:text-muted-foreground"/>}
                {unreadCount>0&&<span className="absolute -top-0.5 -right-0.5 h-3.5 min-w-[14px] px-0.5 rounded-full bg-red-500 text-[9px] text-white flex items-center justify-center font-bold">{unreadCount>9?'9+':unreadCount}</span>}
              </button>
            </div>
            <div className="w-7 h-7 rounded-full bg-gradient-to-br from-emerald-400 to-teal-500 flex items-center justify-center text-white text-[10px] font-bold">
              {user.name?.charAt(0)?.toUpperCase() || 'U'}
            </div>
            <button
              onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
              className="p-2 rounded-lg hover:bg-background/70 dark:hover:bg-white/10 transition-colors"
              aria-label="Menú de navegación"
            >
              {mobileMenuOpen ? <X className="h-5 w-5 text-foreground/70 dark:text-muted-foreground" /> : <Menu className="h-5 w-5 text-foreground/70 dark:text-muted-foreground" />}
            </button>
          </div>
        </div>

      </div>

      {/* MOBILE DRAWER */}
      {mobileMenuOpen && (
        <div className="lg:hidden fixed inset-0 z-[10000]">
          <div className="absolute inset-0 bg-black/50 backdrop-blur-sm animate-[fadeIn_200ms_ease-out]" onClick={() => setMobileMenuOpen(false)} />
          <div className="absolute right-0 top-0 bottom-0 w-72 backdrop-blur-2xl shadow-2xl flex flex-col animate-[slideInRight_200ms_ease-out]">
            {/* Header with gradient */}
            <div className="px-5 py-4 border-b border-emerald-500/20">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <img src="/logo.png" alt="KC Cobranzas" className="w-8 h-8 rounded-lg shadow-lg shadow-black/30" />
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
              {filteredGroups.map((group) => {
                const isExpanded = expandedGroups[group.key];
                return (
                  <div key={group.key} className="mb-2">
                    <button
                      onClick={() => toggleGroup(group.key)}
                      className="w-full flex items-center justify-between px-3 py-2 rounded-lg text-[10px] font-semibold text-muted-foreground uppercase tracking-wider hover:text-white/80 transition-colors"
                    >
                      <span>{group.title}</span>
                      <ChevronDown className={`h-3 w-3 transition-transform duration-200 ${isExpanded ? 'rotate-0' : '-rotate-90'}`} />
                    </button>
                    {isExpanded && group.items.map((item) => {
                      const Icon = item.icon;
                      const isActive = activeTab === item.value;
                      return (
                        <button
                          key={item.value}
                          onClick={() => handleTabChange(item.value)}
                          className={`w-full flex items-center gap-3 px-4 py-2.5 rounded-xl text-sm font-medium transition-all duration-200 mb-0.5 ${isActive
                            ? 'bg-gradient-to-r from-emerald-500 to-teal-500 text-white shadow-md shadow-emerald-500/20'
                            : 'text-foreground/70 dark:text-muted-foreground hover:bg-background/50 dark:hover:bg-white/10 hover:text-foreground dark:hover:text-slate-100'
                          }`}
                        >
                          <Icon className={`h-4 w-4 ${isActive ? 'text-white' : 'text-muted-foreground'}`} />
                          <span>{item.label}</span>
                        </button>
                      );
                    })}
                  </div>
                );
              })}
            </nav>
            <div className="px-3 pt-3 border-t border-emerald-500/20">
              <p className="px-3 mb-2 text-[10px] font-semibold text-muted-foreground uppercase tracking-wider">Acciones</p>
              <div className="space-y-0.5">
                <Button variant="ghost" onClick={() => { setMobileMenuOpen(false); setShowReports(true); }} className="w-full justify-start rounded-lg px-3 py-2.5 text-sm text-foreground/70 dark:text-muted-foreground hover:text-emerald-600 hover:bg-emerald-50 dark:hover:bg-emerald-950/50">
                  <BarChart3 className="h-4 w-4 mr-2.5" /> Reportes
                </Button>
                <Button variant="ghost" onClick={() => { setMobileMenuOpen(false); setShowDataTools(true); }} className="w-full justify-start rounded-lg px-3 py-2.5 text-sm text-foreground/70 dark:text-muted-foreground hover:text-emerald-600 hover:bg-emerald-50 dark:hover:bg-emerald-950/50">
                  <Download className="h-4 w-4 mr-2.5" /> Exportar / Importar
                </Button>
                <Button variant="ghost" onClick={() => { setMobileMenuOpen(false); setShowChangePassword(true); }} className="w-full justify-start rounded-lg px-3 py-2.5 text-sm text-foreground/70 dark:text-muted-foreground hover:text-emerald-600 hover:bg-emerald-50 dark:hover:bg-emerald-950/50">
                  <KeyRound className="h-4 w-4 mr-2.5" /> Cambiar Contraseña
                </Button>
              </div>
              <div className="mt-1 pt-2 border-t border-emerald-500/10">
                <Button variant="ghost" onClick={handleLogout} className="w-full justify-start rounded-lg px-3 py-2.5 text-sm text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-950/50">
                  <LogOut className="h-4 w-4 mr-2.5" /> Cerrar Sesión
                </Button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* MAIN CONTENT */}
      <main className="flex-1 lg:ml-64 min-h-screen flex flex-col relative z-10">
        {/* Desktop top bar */}
<header className="hidden lg:flex items-center justify-between h-14 px-6 backdrop-blur-2xl border-b border-emerald-500/20 shadow-[inset_0_-1px_20px_rgba(16,185,129,0.08)] sticky top-0 z-20">
          <div className="flex items-center gap-4">
            <h2 className="text-lg font-semibold text-foreground dark:text-foreground">{getActiveLabel()}</h2>
            <span className="h-4 w-px bg-emerald-500/20" />
            <div className="flex items-center gap-3 text-xs text-muted-foreground">
              <div className="flex items-center gap-1.5 font-mono tracking-wider">
                <span className="text-emerald-400">{clock || '--:--:--'}</span>
                <span className="text-emerald-500/50">|</span>
                <span>{new Date().toLocaleDateString('es-PE', { day: 'numeric', month: 'short', year: 'numeric' })}</span>
              </div>
              <div className="flex items-center gap-1.5">
                <span className={`inline-block w-1.5 h-1.5 rounded-full ${isOnline ? 'bg-emerald-500' : 'bg-red-500'} ${isOnline ? 'animate-pulse' : ''}`} />
                <span className={`text-[10px] ${isOnline ? 'text-emerald-400/70' : 'text-red-400/70'}`}>
                  {isOnline ? 'En línea' : 'Desconectado'}
                </span>
              </div>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Button variant="ghost" size="icon" onClick={()=>setActiveTab('chat')} className="relative h-8 w-8 text-muted-foreground hover:text-emerald-500 hover:bg-emerald-50 dark:hover:bg-emerald-950" title="Mensajes">
              <MessageSquare className="h-4 w-4" />
            </Button>
            <div className="relative" ref={notifRef}>
              <Button variant="ghost" size="icon" onClick={()=>{setNotifOpen(!notifOpen);if(!notifOpen)markRead(notifications.filter(n=>!n.isRead).map(n=>n.id))}} className="relative h-8 w-8 text-muted-foreground hover:text-emerald-500 hover:bg-emerald-50 dark:hover:bg-emerald-950" title="Notificaciones">
                {unreadCount>0?<BellRing className="h-4 w-4 text-emerald-500"/>:<Bell className="h-4 w-4"/>}
                {unreadCount>0&&<span className="absolute -top-0.5 -right-0.5 h-3.5 min-w-[14px] px-1 rounded-full bg-red-500 text-[9px] text-white flex items-center justify-center font-bold">{unreadCount>9?'9+':unreadCount}</span>}
              </Button>
              {notifOpen&&<div className="absolute right-0 top-full mt-2 w-80 sm:w-96 bg-white dark:bg-[#05060b]/90 rounded-xl shadow-2xl border border-input dark:border-emerald-500/5 overflow-hidden z-50">
                <div className="flex items-center justify-between px-4 py-3 border-b border-input/50 dark:border-emerald-500/10">
                  <span className="text-sm font-semibold text-foreground/80 dark:text-foreground/80">Notificaciones</span>
                  {unreadCount>0&&<Badge variant="outline" className="bg-emerald-50 dark:bg-emerald-950 text-emerald-700 dark:text-emerald-300 border-emerald-200 text-xs">{unreadCount} sin leer</Badge>}
                </div>
                <div className="max-h-[400px] overflow-y-auto">
{notifications.length===0?<div className="p-8 text-center text-muted-foreground"><Bell className="h-8 w-8 mx-auto mb-2 opacity-50"/><p className="text-sm">Sin notificaciones</p></div>:notifications.map(n=><div key={n.id} className={`flex items-start gap-3 p-3 border-b border-slate-50 dark:border-emerald-500/10/50 hover:bg-background/50 dark:hover:bg-white/10/30 transition-colors ${!n.isRead?'bg-emerald-50/50 dark:bg-emerald-950/20':''}`}>
                    <div className={`w-8 h-8 rounded-full flex items-center justify-center shrink-0 ${n.type==='overdue'?'bg-red-100 dark:bg-red-900/50':n.type==='upcoming'?'bg-amber-100 dark:bg-amber-900/50':n.type==='payment_received'?'bg-emerald-100 dark:bg-emerald-900/50':n.type==='goal_achieved'?'bg-emerald-100 dark:bg-emerald-900/50':n.type==='inactive'?'bg-amber-100 dark:bg-amber-900/50':'bg-blue-100 dark:bg-blue-900/50'}`}>
                      {n.type==='overdue'?<Activity className="h-4 w-4 text-red-600 dark:text-red-300"/>:n.type==='upcoming'?<Activity className="h-4 w-4 text-amber-600 dark:text-amber-300"/>:n.type==='payment_received'?<DollarSign className="h-4 w-4 text-emerald-600 dark:text-emerald-300"/>:n.type==='goal_achieved'?<Target className="h-4 w-4 text-emerald-600 dark:text-emerald-300"/>:n.type==='inactive'?<Activity className="h-4 w-4 text-amber-600 dark:text-amber-300"/>:<Bell className="h-4 w-4 text-blue-600 dark:text-blue-300"/>}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className={`text-sm ${!n.isRead?'font-semibold text-slate-800 dark:text-foreground':'text-foreground/70 dark:text-muted-foreground'}`}>{n.title}</p>
                      {n.body&&<p className="text-xs text-muted-foreground mt-0.5 line-clamp-2">{n.body}</p>}
                      <p className="text-[10px] text-muted-foreground mt-1">{new Date(n.createdAt).toLocaleDateString('es-PE',{day:'numeric',month:'short',hour:'2-digit',minute:'2-digit'})}</p>
                    </div>
                    <div className="flex items-center gap-1 shrink-0">
                      {!n.isRead && <button onClick={()=>markRead([n.id])} className="px-2 py-1 text-xs rounded-md bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 hover:bg-emerald-500/20 transition-colors" title="Marcar como leída">Leída</button>}
                      {(n.referenceType==='loan' || n.referenceType==='payment') && <button onClick={()=>{setActiveTab(n.referenceType==='loan'?'loans':'payments');setNotifOpen(false);}} className="px-2 py-1 text-xs rounded-md bg-blue-500/10 text-blue-600 dark:text-blue-400 hover:bg-blue-500/20 transition-colors" title={`Ver ${n.referenceType==='loan'?'préstamo':'pago'}`}>Ver</button>}
                      <button onClick={()=>delNotif(n.id)} className="shrink-0 p-1 rounded-md hover:bg-slate-200 dark:hover:bg-slate-700 text-muted-foreground hover:text-red-500 transition-colors" title="Eliminar"><Trash2 className="h-3.5 w-3.5"/></button>
                    </div>
                  </div>)}
                </div>
              </div>}
            </div>
<Button variant="ghost" size="sm" onClick={()=>setShowReports(true)} className="h-8 text-xs text-muted-foreground hover:text-emerald-500 hover:bg-emerald-50 dark:hover:bg-emerald-950" title="Ver Reportes">
              <BarChart3 className="h-3.5 w-3.5 mr-1"/>Reportes
            </Button>
            <Button variant="ghost" size="sm" onClick={() => setShowDataTools(true)} className="h-8 text-xs text-muted-foreground hover:text-emerald-500 hover:bg-emerald-50 dark:hover:bg-emerald-950" title="Exportar / Importar">
              <Download className="h-3.5 w-3.5 mr-1" />
              Datos
            </Button>
          <span className="w-px h-5 bg-slate-200 dark:bg-[#05060b]/70" />
          <div className="w-7 h-7 rounded-full bg-gradient-to-br from-emerald-400 to-teal-500 flex items-center justify-center text-white text-[10px] font-bold shadow-sm">
            {user.name?.charAt(0)?.toUpperCase() || 'U'}
          </div>
<Button variant="ghost" size="icon" onClick={handleLogout} className="h-7 w-7 text-muted-foreground hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-950" title="Cerrar sesión">
              <LogOut className="h-3.5 w-3.5" />
            </Button>
          </div>
        </header>

        {/* Content */}
        <div className="flex-1 px-3 sm:px-6 lg:px-8 py-4 sm:py-6 pt-16 lg:pt-6">
          <div key={activeTab} style={{animation:'pageIn 0.35s ease-out both'}}>
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
        </div>

        {/* Footer */}
        <footer className="backdrop-blur-2xl border-t border-emerald-500/20 shadow-[inset_0_1px_20px_rgba(16,185,129,0.08)] py-3 mt-auto">
          <div className="px-4 sm:px-6 lg:px-8 flex flex-col sm:flex-row items-center justify-between gap-2">
            <p className="text-[10px] text-muted-foreground">© 2025 KC Cobranzas - Sistema de Gestión de Cobranzas</p>
            <div className="flex items-center gap-4">
              <span className="text-[10px] text-muted-foreground flex items-center gap-1">
                <ShieldCheck className="h-2.5 w-2.5 text-emerald-500" />
                Auditoría activa
              </span>
              <span className="text-[10px] text-muted-foreground flex items-center gap-1">
                <Clock className="h-2.5 w-2.5 text-emerald-500" />
                Mora automática
              </span>
            </div>
          </div>
        </footer>

        {/* FAB - Floating Action Button */}
        <div ref={fabRef} className="fixed bottom-6 right-6 z-50">
          <div className="flex flex-col items-end gap-3 mb-3">
            {fabOpen && (
              <>
                <button onClick={() => { setFabOpen(false); setActiveTab('loans'); }} className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-emerald-500 text-white text-sm font-medium shadow-xl shadow-emerald-500/30 hover:bg-emerald-400 transition-all duration-200 animate-[fab-action_0.2s_ease-out] whitespace-nowrap" style={{ animationDelay: '0ms' }}>
                  <DollarSign className="h-4 w-4" /><span>Nuevo Préstamo</span>
                </button>
                <button onClick={() => { setFabOpen(false); setActiveTab('clients'); }} className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-emerald-500 text-white text-sm font-medium shadow-xl shadow-emerald-500/30 hover:bg-emerald-400 transition-all duration-200 animate-[fab-action_0.25s_ease-out] whitespace-nowrap" style={{ animationDelay: '50ms' }}>
                  <Users className="h-4 w-4" /><span>Nuevo Cliente</span>
                </button>
                <button onClick={() => { setFabOpen(false); setActiveTab('payments'); }} className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-emerald-500 text-white text-sm font-medium shadow-xl shadow-emerald-500/30 hover:bg-emerald-400 transition-all duration-200 animate-[fab-action_0.3s_ease-out] whitespace-nowrap" style={{ animationDelay: '100ms' }}>
                  <CreditCard className="h-4 w-4" /><span>Registrar Pago</span>
                </button>
                <button onClick={() => { setFabOpen(false); setActiveTab('chat'); }} className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-emerald-500 text-white text-sm font-medium shadow-xl shadow-emerald-500/30 hover:bg-emerald-400 transition-all duration-200 animate-[fab-action_0.35s_ease-out] whitespace-nowrap" style={{ animationDelay: '150ms' }}>
                  <MessageSquare className="h-4 w-4" /><span>Mensaje Rápido</span>
                </button>
              </>
            )}
          </div>
          <button
            onClick={() => setFabOpen(!fabOpen)}
            className={`w-14 h-14 rounded-full bg-gradient-to-br from-emerald-500 to-teal-500 text-white shadow-xl shadow-emerald-500/30 hover:shadow-2xl hover:shadow-emerald-500/40 hover:scale-105 active:scale-95 transition-all duration-300 flex items-center justify-center ${fabOpen ? 'rotate-45' : ''}`}
          >
            <Plus className="h-6 w-6" />
          </button>
        </div>
      </main>
    </div>
    <style>{`
      @keyframes pageIn {
        from { opacity: 0; transform: translateY(12px); }
        to { opacity: 1; transform: translateY(0); }
      }
    `}</style>
    </ErrorBoundary>
  );
}
