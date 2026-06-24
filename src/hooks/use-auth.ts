'use client';

import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';

// ============================================================
// Types
// ============================================================

export interface AuthUser {
  id: string;
  email: string;
  name: string;
  role: 'admin' | 'supervisor' | 'collector';
  phone: string | null;
  documentNumber: string | null;
  isActive: boolean;
}

export const INACTIVITY_TIMEOUT = 5 * 60 * 1000; // 5 minutos

export interface AuthState {
  user: AuthUser | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  error: string | null;
  lastActivity: number;

  // Actions
  login: (username: string, password: string) => Promise<boolean>;
  logout: () => void;
  checkSession: () => Promise<void>;
  refreshRole: () => Promise<void>;
  hasRole: (roles: string[]) => boolean;
  changePassword: (currentPassword: string, newPassword: string) => Promise<boolean>;
  clearError: () => void;
  updateActivity: () => void;
}

// ============================================================
// Role Permissions Map
// ============================================================

export const ROLE_PERMISSIONS: Record<string, string[]> = {
  admin: [
    'dashboard',
    'loans',
    'clients',
    'payments',
    'collectors',
    'audit',
    'capital',
    'late-fee',
    'config',
    'chat',
    'daily-settlement',
    'caja',
    'map',
  ],
  supervisor: [
    'dashboard',
    'loans',
    'clients',
    'payments',
    'collectors',
    'audit',
    'late-fee',
    'chat',
    'daily-settlement',
    'caja',
    'map',
  ],
  collector: [
    'loans',
    'clients',
    'payments',
    'chat',
    'daily-settlement',
    'map',
  ],
};

// ============================================================
// Sync initial state from localStorage (synchronous!)
// This runs at module level, BEFORE any React render
// ============================================================

const STORAGE_KEY = 'kc-cobranzas-auth-v3';

function getStoredState(): { user: AuthUser | null; isAuthenticated: boolean; lastActivity: number } {
  if (typeof window === 'undefined') return { user: null, isAuthenticated: false, lastActivity: Date.now() };
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      const data = parsed?.state || parsed;
      if (data?.user && data?.isAuthenticated) {
        return {
          user: data.user as AuthUser,
          isAuthenticated: true,
          lastActivity: Date.now(),
        };
      }
    }
  } catch {}
  return { user: null, isAuthenticated: false, lastActivity: Date.now() };
}

const initialStored = getStoredState();

// ============================================================
// Auth Store with Zustand + Persist
// Login con DNI, Email o Celular via Supabase
// ============================================================

export const useAuth = create<AuthState>()(
  persist(
    (set, get) => ({
      user: initialStored.user,
      isAuthenticated: initialStored.isAuthenticated,
      isLoading: false,
      error: null,
      lastActivity: initialStored.lastActivity,

      login: async (username: string, password: string) => {
        set({ isLoading: true, error: null });

        try {
          const response = await fetch('/api/auth', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ action: 'login', username, password }),
          });

          const data = await response.json();

          if (!data.success) {
            set({
              isLoading: false,
              error: data.error || 'Error al iniciar sesión',
              user: null,
              isAuthenticated: false,
            });
            return false;
          }

          const user = data.user as AuthUser;

          set({
            user: {
              id: user.id,
              email: user.email,
              name: user.name || user.email.split('@')[0],
              role: user.role ?? 'collector',
              phone: user.phone || null,
              documentNumber: user.documentNumber || null,
              isActive: user.isActive !== false,
            },
            isAuthenticated: true,
            isLoading: false,
            error: null,
            lastActivity: Date.now(),
          });

          return true;
        } catch {
          set({
            isLoading: false,
            error: 'Error de conexión. Verifique su conexión a internet.',
            user: null,
            isAuthenticated: false,
          });
          return false;
        }
      },

      logout: () => {
        fetch('/api/auth', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ action: 'logout' }),
        }).catch(() => { });

        set({
          user: null,
          isAuthenticated: false,
          isLoading: false,
          error: null,
        });
      },

      checkSession: async () => {
        const { user } = get();
        if (!user) {
          set({ isAuthenticated: false });
          return;
        }

        try {
          const response = await fetch('/api/auth', {
            headers: {
              Authorization: `Bearer ${user.id}`,
            },
          });

          const data = await response.json();

          if (data.success && data.user) {
            const updatedUser = data.user as AuthUser;
            set({
              user: {
                id: updatedUser.id,
                email: updatedUser.email,
                name: updatedUser.name || updatedUser.email.split('@')[0],
                role: updatedUser.role ?? 'collector',
                phone: updatedUser.phone || null,
                documentNumber: updatedUser.documentNumber || null,
                isActive: updatedUser.isActive !== false,
              },
              isAuthenticated: true,
              lastActivity: Date.now(),
            });
          } else if (response.status === 404) {
            console.warn('[Auth] checkSession - User not found (404), clearing session');
            set({
              user: null,
              isAuthenticated: false,
            });
          } else {
            console.warn('[Auth] checkSession - Server returned error, keeping cached session');
          }
        } catch {
          // Keep cached session during network issues
        }
      },

      refreshRole: async () => {
        const { user } = get();
        if (!user) return;

        try {
          const response = await fetch('/api/auth', {
            headers: {
              Authorization: `Bearer ${user.id}`,
            },
          });

          const data = await response.json();

          if (data.success && data.user) {
            const serverUser = data.user as AuthUser;
            if (serverUser.role !== user.role || serverUser.name !== user.name) {
              set({
                user: {
                  id: serverUser.id,
                  email: serverUser.email,
                  name: serverUser.name || serverUser.email.split('@')[0],
                  role: serverUser.role ?? 'collector',
                  phone: serverUser.phone || null,
                  documentNumber: serverUser.documentNumber || null,
                  isActive: serverUser.isActive !== false,
                },
              });
            }
          }
        } catch {
          // Silent - don't disrupt the UI
        }
      },

      hasRole: (roles: string[]) => {
        const { user } = get();
        if (!user) return false;
        return roles.includes(user.role);
      },

      changePassword: async (currentPassword: string, newPassword: string) => {
        const { user } = get();
        if (!user) return false;

        try {
          const response = await fetch('/api/auth', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              action: 'change-password',
              userId: user.id,
              currentPassword,
              newPassword,
            }),
          });

          const data = await response.json();

          if (!data.success) {
            set({ error: data.error || 'Error al cambiar contraseña' });
            return false;
          }

          return true;
        } catch {
          set({ error: 'Error de conexión al cambiar contraseña' });
          return false;
        }
      },

      updateActivity: () => {
        set({ lastActivity: Date.now() });
      },

      clearError: () => {
        set({ error: null });
      },
    }),
    {
      name: STORAGE_KEY,
      storage: createJSONStorage(() => localStorage),
      partialize: (state) => ({
        user: state.user,
        isAuthenticated: state.isAuthenticated,
        lastActivity: state.lastActivity,
      }),
    }
  )
);