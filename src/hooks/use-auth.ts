'use client';

import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import {
  signInWithEmailAndPassword,
  signOut,
  onAuthStateChanged,
  sendPasswordResetEmail,
  updatePassword,
  EmailAuthProvider,
  reauthenticateWithCredential,
} from 'firebase/auth';
import { auth } from '@/lib/firebase-client';

export interface AuthUser {
  id: string;
  email: string;
  name: string;
  role: 'admin' | 'supervisor' | 'collector';
  phone: string | null;
  documentNumber: string | null;
  isActive: boolean;
  photoUrl?: string | null;
}

export const INACTIVITY_TIMEOUT = 5 * 60 * 1000;

export interface AuthState {
  user: AuthUser | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  error: string | null;
  lastActivity: number;
  _initialized: boolean;
  login: (username: string, password: string) => Promise<boolean>;
  logout: () => Promise<void>;
  checkSession: () => Promise<void>;
  refreshRole: () => Promise<void>;
  hasRole: (roles: string[]) => boolean;
  changePassword: (currentPassword: string, newPassword: string) => Promise<boolean>;
  clearError: () => void;
  updateActivity: () => void;
  _setUser: (u: AuthUser | null) => void;
}

export const ROLE_PERMISSIONS: Record<string, string[]> = {
  admin: ['dashboard', 'loans', 'clients', 'payments', 'collectors', 'audit', 'capital', 'late-fee', 'config', 'chat', 'daily-settlement', 'caja', 'map'],
  supervisor: ['dashboard', 'loans', 'clients', 'payments', 'collectors', 'audit', 'late-fee', 'chat', 'daily-settlement', 'caja', 'map'],
  collector: ['loans', 'clients', 'payments', 'chat', 'daily-settlement', 'map'],
};

const STORAGE_KEY = 'kc-cobranzas-auth-v3';

async function fetchProfile(uid: string): Promise<AuthUser | null> {
  try {
    const res = await fetch(`/api/profile?uid=${encodeURIComponent(uid)}`);
    if (!res.ok) return null;
    const data = await res.json();
    return {
      id: data.id,
      email: data.email || '',
      name: data.name || 'Usuario',
      role: data.role || 'collector',
      phone: data.phone || null,
      documentNumber: data.documentNumber || null,
      isActive: data.isActive ?? true,
    };
  } catch {
    return null;
  }
}

export const useAuth = create<AuthState>()(
  persist(
    (set, get) => {
      if (typeof window !== 'undefined') {
        onAuthStateChanged(auth, async (fbUser) => {
          const state = get();
          if (fbUser && !state._initialized) {
            const profile = await fetchProfile(fbUser.uid);
            if (profile) {
              set({ user: profile, isAuthenticated: true, isLoading: false, _initialized: true });
            } else {
              const basicUser: AuthUser = {
                id: fbUser.uid,
                email: fbUser.email || '',
                name: fbUser.email?.split('@')[0] || 'Usuario',
                role: 'collector',
                phone: null,
                documentNumber: null,
                isActive: true,
              };
              set({ user: basicUser, isAuthenticated: true, isLoading: false, _initialized: true });
            }
          } else if (!fbUser && !state._initialized) {
            set({ user: null, isAuthenticated: false, isLoading: false, _initialized: true });
          }
        });
      }

      return {
        user: null,
        isAuthenticated: false,
        isLoading: true,
        error: null,
        lastActivity: Date.now(),
        _initialized: false,

        login: async (username: string, password: string) => {
          set({ isLoading: true, error: null });
          try {
            const clean = username.replace(/\D/g, '');
            const email = username.includes('@') ? username.trim().toLowerCase()
              : clean.length === 8 && /^\d{8}$/.test(clean) ? `${clean}@kc-cobranzas.app`
              : clean.length === 9 && /^9\d{8}$/.test(clean) ? `${clean}@phone.kc-cobranzas.app`
              : `${username}@kc-cobranzas.app`;

            const cred = await signInWithEmailAndPassword(auth, email, password);
            const profile = await fetchProfile(cred.user.uid);
            if (profile) {
              set({ user: profile, isAuthenticated: true, isLoading: false, error: null, lastActivity: Date.now() });
              return true;
            }
            const basicUser: AuthUser = {
              id: cred.user.uid,
              email: cred.user.email || email,
              name: cred.user.email?.split('@')[0] || 'Usuario',
              role: 'collector',
              phone: null,
              documentNumber: null,
              isActive: true,
            };
            set({ user: basicUser, isAuthenticated: true, isLoading: false, error: null, lastActivity: Date.now() });
            return true;
          } catch (err: any) {
            const msg = err?.code === 'auth/user-not-found' || err?.code === 'auth/invalid-credential'
              ? 'Usuario o contraseña incorrectos'
              : err?.code === 'auth/too-many-requests'
              ? 'Demasiados intentos. Espera un momento'
              : err?.message || 'Error al iniciar sesión';
            set({ isLoading: false, error: msg });
            return false;
          }
        },

        logout: async () => {
          await signOut(auth);
          set({ user: null, isAuthenticated: false, error: null });
        },

        checkSession: async () => {
          const fbUser = auth.currentUser;
          if (fbUser) {
            const profile = await fetchProfile(fbUser.uid);
            if (profile) set({ user: profile, isAuthenticated: true, isLoading: false });
            else set({ isLoading: false });
          } else {
            set({ user: null, isAuthenticated: false, isLoading: false });
          }
        },

        refreshRole: async () => {
          const fbUser = auth.currentUser;
          if (fbUser) {
            const profile = await fetchProfile(fbUser.uid);
            if (profile) set({ user: profile, isAuthenticated: true });
          }
        },

        hasRole: (roles: string[]) => {
          const { user } = get();
          return user ? roles.includes(user.role) : false;
        },

        changePassword: async (currentPassword: string, newPassword: string) => {
          try {
            const fbUser = auth.currentUser;
            if (!fbUser || !fbUser.email) return false;
            const cred = EmailAuthProvider.credential(fbUser.email, currentPassword);
            await reauthenticateWithCredential(fbUser, cred);
            await updatePassword(fbUser, newPassword);
            return true;
          } catch { return false; }
        },

        clearError: () => set({ error: null }),

        updateActivity: () => set({ lastActivity: Date.now() }),

        _setUser: (u) => set({ user: u, isAuthenticated: !!u }),
      };
    },
    {
      name: STORAGE_KEY,
      storage: createJSONStorage(() => localStorage),
      partialize: (state) => ({
        user: state.user,
        isAuthenticated: state.isAuthenticated,
        lastActivity: state.lastActivity,
      }),
      onRehydrateStorage: () => (state) => {
        if (state) state._initialized = true;
      },
    }
  )
);

export function checkInactivity(lastActivity: number): boolean {
  return Date.now() - lastActivity > INACTIVITY_TIMEOUT;
}
