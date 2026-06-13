'use client';

import React, { useState, useRef, useEffect } from 'react';
import dynamic from 'next/dynamic';
import LoansTab from '@/components/loans-tab';
import CapitalTab from '@/components/capital-tab';
import ClientsTab from '@/components/clients-tab';
import PaymentsTab from '@/components/payments-tab';
import ConfigTab from '@/components/config-tab';
import CollectorsTab from '@/components/collectors-tab';
import LoginScreen from '@/components/login-screen';
import { ErrorBoundary } from '@/components/error-boundary';
import { useSupabaseRealtime } from '@/hooks/use-supabase-realtime';
import { useAuth, ROLE_PERMISSIONS } from '@/hooks/use-auth';
import ChangePassword from '@/components/change-password';
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
  Wifi,
  Menu,
  X,
  ChevronLeft,
  ChevronRight,
  LogOut,
  User,
  KeyRound,
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
  const { user, isAuthenticated, logout, checkSession, refreshRole } = useAuth();
  const [showChangePassword, setShowChangePassword] = useState(false);
  const [activeTab, setActiveTab] = useState('loans');
  const [refreshKey, setRefreshKey] = useState(0);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [isHydrated, setIsHydrated] = useState(false);
  const navScrollRef = useRef<HTMLDivElement>(null);
  const [canScrollLeft, setCanScrollLeft] = useState(false);
  const [canScrollRight, setCanScrollRight] = useState(false);
  const hasCheckedSession = useRef(false);

  // Wait for hydration of persisted zustand store
  useEffect(() => {
    if (!hasCheckedSession.current) {
      hasCheckedSession.current = true;
      Promise.resolve().then(() => {
        setIsHydrated(true);
        checkSession();
        // Always force-refresh role from server to fix cached wrong roles
        refreshRole();
      });
    }
  }, [checkSession, refreshRole]);

  // Supabase Realtime
  const handleRealtimeChange = () => {
    setRefreshKey((prev) => prev + 1);
  };

  useSupabaseRealtime(
    ['zones', 'profiles', 'clients', 'loans', 'payments', 'capital_movements', 'settings', 'late_fees'],
    handleRealtimeChange,
    { debounceMs: 1500, enabled: isAuthenticated }
  );

  // Check scroll position
  const checkScroll = () => {
    const el = navScrollRef.current;
    if (!el) return;
    setCanScrollLeft(el.scrollLeft > 5);
    setCanScrollRight(el.scrollLeft < el.scrollWidth - el.clientWidth - 5);
  };

  useEffect(() => {
    checkScroll();
    const el = navScrollRef.current;
    if (el) {
      el.addEventListener('scroll', checkScroll);
      window.addEventListener('resize', checkScroll);
    }
    return () => {
      el?.removeEventListener('scroll', checkScroll);
      window.removeEventListener('resize', checkScroll);
    };
  }, []);

  useEffect(() => {
    const el = navScrollRef.current;
    if (!el) return;
    const activeBtn = el.querySelector(`[data-tab="${activeTab}"]`);
    if (activeBtn) {
      activeBtn.scrollIntoView({ behavior: 'smooth', block: 'nearest', inline: 'center' });
    }
    setTimeout(checkScroll, 100);
  }, [activeTab]);

  const scrollNav = (direction: 'left' | 'right') => {
    const el = navScrollRef.current;
    if (!el) return;
    el.scrollBy({ left: direction === 'left' ? -150 : 150, behavior: 'smooth' });
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
    { value: 'late-fee', icon: Clock, label: 'Mora Auto' },
    { value: 'config', icon: Database, label: 'Config' },
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
    <div className="min-h-screen flex bg-slate-50">
      {/* SIDEBAR - Desktop */}
      <aside className="hidden lg:flex lg:flex-col lg:w-64 bg-white border-r border-slate-200 shadow-sm fixed inset-y-0 left-0 z-30">
        {/* Logo */}
        <div className="flex items-center gap-3 px-5 h-16 border-b border-slate-100">
          <img src="/logo.png" alt="KC Cobranzas" className="w-9 h-9 rounded-xl object-cover shadow-lg shadow-emerald-500/20" />
          <div>
            <h1 className="text-base font-bold text-slate-900 tracking-tight">KC Cobranzas</h1>
            <p className="text-[10px] text-slate-400 -mt-0.5">Panel de Administración</p>
          </div>
        </div>

        {/* Navigation */}
        <nav className="flex-1 py-3 px-3 overflow-y-auto">
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
                  : 'text-slate-600 hover:bg-slate-50 hover:text-slate-900'
                  }`}
              >
                <Icon className={`h-4.5 w-4.5 ${isActive ? 'text-white' : 'text-slate-400'}`} />
                <span>{item.label}</span>
              </button>
            );
          })}
        </nav>

        {/* Sidebar Footer */}
        <div className="px-3 py-3 border-t border-slate-100 space-y-2">
          <div className="flex items-center gap-3 px-2 py-2">
            <div className="w-8 h-8 rounded-full bg-gradient-to-br from-emerald-400 to-teal-500 flex items-center justify-center text-white text-xs font-bold shadow-sm">
              {user.name?.charAt(0)?.toUpperCase() || 'U'}
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-xs font-medium text-slate-900 truncate">{user.name}</p>
              <Badge variant="outline" className={`text-[9px] px-1.5 py-0 ${roleBadge.color}`}>
                {roleBadge.label}
              </Badge>
            </div>
            <div className="flex items-center gap-1">
              <Button
                variant="ghost"
                size="icon"
                onClick={() => setShowChangePassword(true)}
                className="h-8 w-8 text-slate-400 hover:text-emerald-500 hover:bg-emerald-50"
                title="Cambiar contraseña"
              >
                <KeyRound className="h-4 w-4" />
              </Button>
              <Button
                variant="ghost"
                size="icon"
                onClick={handleLogout}
                className="h-8 w-8 text-slate-400 hover:text-red-500 hover:bg-red-50"
                title="Cerrar sesión"
              >
                <LogOut className="h-4 w-4" />
              </Button>
            </div>
          </div>
          <Badge variant="outline" className="bg-emerald-50 text-emerald-700 border-emerald-200 text-[10px] w-full justify-center">
            <Activity className="h-3 w-3 mr-1" />
            Sistema en línea
          </Badge>
        </div>
      </aside>

      {/* Change Password Dialog */}
      {showChangePassword && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-sm mx-4 border border-slate-100">
            <ChangePassword onClose={() => setShowChangePassword(false)} />
          </div>
        </div>
      )}

      {/* MOBILE HEADER */}
      <div className="lg:hidden fixed top-0 left-0 right-0 z-40 bg-white/80 backdrop-blur-lg border-b border-slate-200 shadow-sm">
        <div className="flex items-center justify-between h-14 px-4">
          <div className="flex items-center gap-3">
            <img src="/logo.png" alt="KC Cobranzas" className="w-8 h-8 rounded-lg object-cover" />
            <div>
              <h1 className="text-sm font-bold text-slate-900">KC Cobranzas</h1>
              <p className="text-[10px] text-slate-400 -mt-0.5">{getActiveLabel()}</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Badge variant="outline" className={`${roleBadge.color} text-[10px]`}>
              <User className="h-2.5 w-2.5 mr-0.5" />
              {roleBadge.label}
            </Badge>
            <button
              onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
              className="p-2 rounded-lg hover:bg-slate-100 transition-colors"
              aria-label="Menú de navegación"
            >
              {mobileMenuOpen ? <X className="h-5 w-5 text-slate-600" /> : <Menu className="h-5 w-5 text-slate-600" />}
            </button>
          </div>
        </div>

        {/* Mobile horizontal nav */}
        {!mobileMenuOpen && (
          <div className="relative">
            {canScrollLeft && (
              <button
                onClick={() => scrollNav('left')}
                className="absolute left-0 top-0 bottom-0 w-8 bg-gradient-to-r from-white/90 to-transparent z-10 flex items-center justify-center"
                aria-label="Desplazar izquierda"
              >
                <ChevronLeft className="h-4 w-4 text-slate-400" />
              </button>
            )}
            <div
              ref={navScrollRef}
              className="flex overflow-x-auto gap-1 px-3 pb-2 scrollbar-none"
              style={{ scrollbarWidth: 'none', msOverflowStyle: 'none' }}
            >
              {navItems.map((item) => {
                const Icon = item.icon;
                const isActive = activeTab === item.value;
                return (
                  <button
                    key={item.value}
                    data-tab={item.value}
                    onClick={() => handleTabChange(item.value)}
                    className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium whitespace-nowrap transition-all flex-shrink-0 ${isActive
                      ? 'bg-gradient-to-r from-emerald-500 to-teal-500 text-white shadow-sm'
                      : 'bg-slate-100 text-slate-600'
                      }`}
                  >
                    <Icon className="h-3.5 w-3.5" />
                    {item.label}
                  </button>
                );
              })}
            </div>
            {canScrollRight && (
              <button
                onClick={() => scrollNav('right')}
                className="absolute right-0 top-0 bottom-0 w-8 bg-gradient-to-l from-white/90 to-transparent z-10 flex items-center justify-center"
                aria-label="Desplazar derecha"
              >
                <ChevronRight className="h-4 w-4 text-slate-400" />
              </button>
            )}
          </div>
        )}
      </div>

      {/* MOBILE DRAWER */}
      {mobileMenuOpen && (
        <div className="lg:hidden fixed inset-0 z-50">
          <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" onClick={() => setMobileMenuOpen(false)} />
          <div className="absolute right-0 top-0 bottom-0 w-72 bg-white shadow-2xl flex flex-col">
            <div className="flex items-center justify-between px-5 h-16 border-b border-slate-100">
              <div className="flex items-center gap-3">
                <img src="/logo.png" alt="KC Cobranzas" className="w-8 h-8 rounded-lg object-cover" />
                <h2 className="text-sm font-bold text-slate-900">Menú</h2>
              </div>
              <button onClick={() => setMobileMenuOpen(false)} className="p-2 rounded-lg hover:bg-slate-100">
                <X className="h-5 w-5 text-slate-500" />
              </button>
            </div>

            <div className="px-5 py-3 border-b border-slate-100 bg-slate-50/50">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-full bg-gradient-to-br from-emerald-400 to-teal-500 flex items-center justify-center text-white text-sm font-bold shadow-sm">
                  {user.name?.charAt(0)?.toUpperCase() || 'U'}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-slate-900 truncate">{user.name}</p>
                  <p className="text-xs text-slate-500 truncate">{user.email}</p>
                  <Badge variant="outline" className={`text-[9px] px-1.5 py-0 mt-0.5 ${roleBadge.color}`}>
                    {roleBadge.label}
                  </Badge>
                </div>
              </div>
            </div>

            <nav className="flex-1 py-3 px-3 overflow-y-auto">
              {navItems.map((item) => {
                const Icon = item.icon;
                const isActive = activeTab === item.value;
                return (
                  <button
                    key={item.value}
                    onClick={() => handleTabChange(item.value)}
                    className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-medium transition-all duration-200 mb-1 ${isActive
                      ? 'bg-gradient-to-r from-emerald-500 to-teal-500 text-white shadow-md shadow-emerald-500/20'
                      : 'text-slate-600 hover:bg-slate-50 hover:text-slate-900'
                      }`}
                  >
                    <Icon className={`h-5 w-5 ${isActive ? 'text-white' : 'text-slate-400'}`} />
                    <span>{item.label}</span>
                  </button>
                );
              })}
            </nav>
            <div className="px-5 py-3 border-t border-slate-100 space-y-2">
              <Button
                variant="outline"
                onClick={() => { setMobileMenuOpen(false); setShowChangePassword(true); }}
                className="w-full justify-center text-emerald-600 border-emerald-200 hover:bg-emerald-50 hover:text-emerald-700"
              >
                <KeyRound className="h-4 w-4 mr-2" />
                Cambiar Contraseña
              </Button>
              <Button
                variant="outline"
                onClick={handleLogout}
                className="w-full justify-center text-red-600 border-red-200 hover:bg-red-50 hover:text-red-700"
              >
                <LogOut className="h-4 w-4 mr-2" />
                Cerrar Sesión
              </Button>
              <Badge variant="outline" className="bg-emerald-50 text-emerald-700 border-emerald-200 text-[10px] w-full justify-center">
                <Activity className="h-3 w-3 mr-1" />
                Sistema en línea
              </Badge>
            </div>
          </div>
        </div>
      )}

      {/* MAIN CONTENT */}
      <main className="flex-1 lg:ml-64 min-h-screen flex flex-col">
        {/* Desktop top bar */}
        <header className="hidden lg:flex items-center justify-between h-14 px-6 bg-white border-b border-slate-100">
          <div>
            <h2 className="text-lg font-semibold text-slate-900">{getActiveLabel()}</h2>
          </div>
          <div className="flex items-center gap-3">
            <Badge variant="outline" className={`text-xs ${roleBadge.color}`}>
              <User className="h-3 w-3 mr-1" />
              {user.name} — {roleBadge.label}
            </Badge>
            <Badge variant="outline" className="bg-emerald-50 text-emerald-700 border-emerald-200 text-xs">
              <Activity className="h-3 w-3 mr-1" />
              En línea
            </Badge>
            {process.env.NEXT_PUBLIC_SUPABASE_URL && (
              <Badge variant="outline" className="bg-blue-50 text-blue-700 border-blue-200 text-xs">
                <Wifi className="h-3 w-3 mr-1" />
                Realtime
              </Badge>
            )}
            <Button
              variant="ghost"
              size="sm"
              onClick={handleLogout}
              className="text-slate-400 hover:text-red-500 hover:bg-red-50"
            >
              <LogOut className="h-4 w-4 mr-1" />
              Salir
            </Button>
          </div>
        </header>

        {/* Content */}
        <div className="flex-1 px-4 sm:px-6 lg:px-8 py-6 pt-20 lg:pt-6">
          {activeTab === 'dashboard' && <ErrorBoundary><DashboardTab key={`dashboard-${refreshKey}`} /></ErrorBoundary>}
          {activeTab === 'loans' && <LoansTab key={`loans-${refreshKey}`} />}
          {activeTab === 'clients' && <ClientsTab key={`clients-${refreshKey}`} />}
          {activeTab === 'payments' && <PaymentsTab key={`payments-${refreshKey}`} />}
          {activeTab === 'collectors' && <CollectorsTab key={`collectors-${refreshKey}`} />}
          {activeTab === 'audit' && <ErrorBoundary><AuditTab key={`audit-${refreshKey}`} /></ErrorBoundary>}
          {activeTab === 'capital' && <CapitalTab key={`capital-${refreshKey}`} />}
          {activeTab === 'late-fee' && <ErrorBoundary><LateFeeTab key={`latefee-${refreshKey}`} /></ErrorBoundary>}
          {activeTab === 'config' && <ConfigTab key={`config-${refreshKey}`} />}
        </div>

        {/* Footer */}
        <footer className="bg-white border-t border-slate-100 py-3 mt-auto">
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
