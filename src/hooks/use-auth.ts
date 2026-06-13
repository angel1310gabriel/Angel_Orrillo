'use client';

import { create } from 'zustand';
import { persist } from 'zustand/middleware';

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

export interface AuthState {
  user: AuthUser | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  error: string | null;

  // Actions
  login: (username: string, password: string) => Promise<boolean>;
  logout: () => void;
  checkSession: () => Promise<void>;
  refreshRole: () => Promise<void>;
  hasRole: (roles: string[]) => boolean;
  changePassword: (currentPassword: string, newPassword: string) => Promise<boolean>;
  clearError: () => void;
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
  ],
  supervisor: [
    'dashboard',
    'loans',
    'clients',
    'payments',
    'collectors',
    'audit',
    'late-fee',
  ],
  collector: [
    'loans',
    'clients',
    'payments',
  ],
};

// ============================================================
// Auth Store with Zustand + Persist
// Login con DNI, Email o Celular via Supabase
// ============================================================

export const useAuth = create<AuthState>()(
  persist(
    (set, get) => ({
      user: null,
      isAuthenticated: false,
      isLoading: false,
      error: null,

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
            console.log('[Auth] checkSession - Updated role from server:', updatedUser.role, 'name:', updatedUser.name);
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
            });
          } else {
            set({
              user: null,
              isAuthenticated: false,
            });
          }
        } catch {
          // Keep cached session during network issues
        }
      },

      // Force refresh role from server - always called on page load
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
            // Always update from server - this fixes cached wrong roles
            if (serverUser.role !== user.role || serverUser.name !== user.name) {
              console.log('[Auth] refreshRole - Role/name mismatch! Cache:', user.role, user.name, '→ Server:', serverUser.role, serverUser.name);
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

      clearError: () => {
        set({ error: null });
      },
    }),
    {
      // Changed key name to completely invalidate old cache with wrong role
      name: 'kc-cobranzas-auth-v3',
      version: 3,
      partialize: (state) => ({
        user: state.user,
        isAuthenticated: state.isAuthenticated,
      }),
      migrate: (persistedState: unknown, version: number) => {
        // If coming from any older version, clear it completely
        if (version < 3) {
          return null as unknown as Partial<AuthState>;
        }
        return persistedState as Partial<AuthState>;
      },
    }
  )
);