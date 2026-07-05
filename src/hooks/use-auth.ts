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
  type User as FirebaseUser,
} from 'firebase/auth';
import { doc, getDoc, setDoc } from 'firebase/firestore';
import { auth, db } from '@/lib/firebase-client';

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
  _hasHydrated: boolean;
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

function getStoredState() {
  if (typeof window === 'undefined') return { user: null, isAuthenticated: false, lastActivity: Date.now() };
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      const data = parsed?.state || parsed;
      if (data?.user && data?.isAuthenticated) {
        return { user: data.user as AuthUser, isAuthenticated: true, lastActivity: data.lastActivity || Date.now() };
      }
    }
  } catch { }
  return { user: null, isAuthenticated: false, lastActivity: Date.now() };
}

// Convert Firebase user + Firestore profile to AuthUser
async function buildAuthUser(fbUser: FirebaseUser): Promise<AuthUser | null> {
  try {
    const profileDoc = await getDoc(doc(db, 'profiles', fbUser.uid));
    if (profileDoc.exists()) {
      const p = profileDoc.data();
      return {
        id: fbUser.uid,
        email: p.email || fbUser.email || '',
        name: p.name || fbUser.email?.split('@')[0] || 'Usuario',
        role: p.role || 'collector',
        phone: p.phone || null,
        documentNumber: p.dni || null,
        isActive: p.is_active ?? true,
        photoUrl: p.photo_url || null,
      };
    }
    return null;
  } catch { return null; }
}

export const useAuth = create<AuthState>()(
  persist(
    (set, get) => {
      // Listen to Firebase auth state changes
      if (typeof window !== 'undefined') {
        onAuthStateChanged(auth, async (fbUser) => {
          const state = get();
          if (fbUser && !state._initialized) {
            const authUser = await buildAuthUser(fbUser);
            if (authUser) {
              set({ user: authUser, isAuthenticated: true, isLoading: false, _initialized: true });
            } else {
              // No profile in Firestore yet, create a basic one
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
        _hasHydrated: false,
        _initialized: false,

        login: async (username: string, password: string) => {
          set({ isLoading: true, error: null });
          try {
            const isEmail = username.includes('@');
            const email = isEmail ? username : `${username}@kc-cobranzas.app`;
            const cred = await signInWithEmailAndPassword(auth, email, password);
            const authUser = await buildAuthUser(cred.user);
            if (authUser) {
              set({ user: authUser, isAuthenticated: true, isLoading: false, error: null, lastActivity: Date.now() });
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
            const authUser = await buildAuthUser(fbUser);
            if (authUser) set({ user: authUser, isAuthenticated: true, isLoading: false });
          } else {
            set({ user: null, isAuthenticated: false, isLoading: false });
          }
        },

        refreshRole: async () => {
          const fbUser = auth.currentUser;
          if (fbUser) {
            const authUser = await buildAuthUser(fbUser);
            if (authUser) set({ user: authUser, isAuthenticated: true });
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
        if (state) state._hasHydrated = true;
      },
    }
  )
);

// Helper for inactivity check (called from page.tsx)
export function checkInactivity(lastActivity: number): boolean {
  return Date.now() - lastActivity > INACTIVITY_TIMEOUT;
}
