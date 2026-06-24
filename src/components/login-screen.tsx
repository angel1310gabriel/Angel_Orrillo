'use client';

import React, { useState } from 'react';
import { useAuth } from '@/hooks/use-auth';
import { Loader2, Eye, EyeOff, ShieldCheck } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';

export default function LoginScreen() {
  const { login, isLoading, error, clearError } = useAuth();
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    clearError();
    await login(username, password);
  };

  return (
    <div className="min-h-screen flex relative overflow-hidden">
      {/* Background gradient overlay */}
      <div className="absolute inset-0 bg-gradient-to-br from-emerald-900 via-emerald-800 to-teal-900" />
      <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top_right,rgba(16,185,129,0.15),transparent_60%)]" />
      <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_bottom_left,rgba(20,184,166,0.1),transparent_50%)]" />

      {/* Pattern grid overlay */}
      <div className="absolute inset-0 opacity-[0.03]" style={{ backgroundImage: 'url("data:image/svg+xml,%3Csvg width=\'60\' height=\'60\' viewBox=\'0 0 60 60\' xmlns=\'http://www.w3.org/2000/svg\'%3E%3Cg fill=\'none\' fill-rule=\'evenodd\'%3E%3Cg fill=\'%23ffffff\' fill-opacity=\'1\'%3E%3Cpath d=\'M36 34v-4h-2v4h-4v2h4v4h2v-4h4v-2h-4zm0-30V0h-2v4h-4v2h4v4h2V6h4V4h-4zM6 34v-4H4v4H0v2h4v4h2v-4h4v-2H6zM6 4V0H4v4H0v2h4v4h2V6h4V4H6z\'/%3E%3C/g%3E%3C/g%3E%3C/svg%3E")' }} />

      {/* Floating decorative elements */}
      <div className="absolute top-20 left-10 w-72 h-72 bg-emerald-500/10 rounded-full blur-3xl" />
      <div className="absolute bottom-20 right-10 w-96 h-96 bg-teal-500/10 rounded-full blur-3xl" />

      {/* Content */}
      <div className="relative z-10 w-full flex items-center justify-center p-4">
        <div className="w-full max-w-[420px]">
          {/* Logo section */}
          <div className="text-center mb-10">
            <div className="inline-flex items-center justify-center w-20 h-20 rounded-2xl bg-white/10 backdrop-blur-sm border border-white/20 shadow-2xl mb-5">
              <ShieldCheck className="w-10 h-10 text-white" />
            </div>
            <h1 className="text-3xl font-bold text-white tracking-tight">KC Cobranzas</h1>
            <p className="text-emerald-200/80 text-sm mt-2 font-medium">Sistema de Gestión de Cobranzas</p>
          </div>

          {/* Login Card */}
          <div className="bg-white dark:bg-slate-900 rounded-2xl shadow-2xl shadow-black/20 border border-white/10 dark:border-slate-800 p-8">
            <div className="mb-6">
              <h2 className="text-lg font-semibold text-slate-900 dark:text-slate-100">Bienvenido</h2>
              <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">Ingrese sus credenciales para acceder</p>
            </div>

            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label htmlFor="username" className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1.5">
                  DNI, Correo o Celular
                </label>
                <Input
                  id="username"
                  type="text"
                  placeholder="Ej: 71057098, correo@gmail.com"
                  value={username}
                  onChange={(e) => {
                    setUsername(e.target.value);
                    clearError();
                  }}
                  required
                  autoComplete="username"
                  className="h-11 border-slate-200 dark:border-slate-700 focus:ring-2 focus:ring-emerald-500/20"
                  disabled={isLoading}
                />
              </div>

              <div>
                <label htmlFor="password" className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1.5">
                  Contraseña
                </label>
                <div className="relative">
                  <Input
                    id="password"
                    type={showPassword ? 'text' : 'password'}
                    placeholder="••••••••"
                    value={password}
                    onChange={(e) => {
                      setPassword(e.target.value);
                      clearError();
                    }}
                    required
                    autoComplete="current-password"
                    className="h-11 pr-10 border-slate-200 dark:border-slate-700 focus:ring-2 focus:ring-emerald-500/20"
                    disabled={isLoading}
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 dark:hover:text-slate-300 transition-colors"
                    tabIndex={-1}
                  >
                    {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                  </button>
                </div>
              </div>

              {error && (
                <div className="bg-red-50 dark:bg-red-950/50 border border-red-200 dark:border-red-900 rounded-lg px-4 py-3">
                  <p className="text-sm text-red-700 dark:text-red-300 font-medium">{error}</p>
                </div>
              )}

              <Button
                type="submit"
                className="w-full h-11 bg-emerald-600 hover:bg-emerald-700 text-white font-medium shadow-lg shadow-emerald-600/25 transition-all hover:shadow-emerald-600/40"
                disabled={isLoading}
              >
                {isLoading ? (
                  <>
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    Iniciando sesión...
                  </>
                ) : (
                  'Iniciar Sesión'
                )}
              </Button>
            </form>
          </div>

          <p className="text-center text-emerald-300/50 text-xs mt-6">
            &copy; {new Date().getFullYear()} KC Cobranzas. Todos los derechos reservados.
          </p>
        </div>
      </div>
    </div>
  );
}
