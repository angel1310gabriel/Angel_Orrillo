'use client';

import React, { useState } from 'react';
import { useAuth } from '@/hooks/use-auth';
import { Loader2, Eye, EyeOff, KeyRound } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';

// ============================================================
// KC Cobranzas - Change Password Component
// ============================================================

interface ChangePasswordProps {
  onClose: () => void;
}

export default function ChangePassword({ onClose }: ChangePasswordProps) {
  const { changePassword, clearError, error } = useAuth();
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [success, setSuccess] = useState(false);
  const [showCurrent, setShowCurrent] = useState(false);
  const [showNew, setShowNew] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    clearError();

    if (newPassword !== confirmPassword) {
      return;
    }

    if (newPassword.length < 6) {
      return;
    }

    setIsSubmitting(true);
    const result = await changePassword(currentPassword, newPassword);
    setIsSubmitting(false);

    if (result) {
      setSuccess(true);
      setTimeout(() => onClose(), 2000);
    }
  };

  const passwordsMatch = newPassword === confirmPassword;
  const passwordLongEnough = newPassword.length >= 6;
  const canSubmit = currentPassword && newPassword && confirmPassword && passwordsMatch && passwordLongEnough;

  if (success) {
    return (
      <div className="p-6 text-center">
        <div className="w-12 h-12 rounded-full bg-emerald-100 flex items-center justify-center mx-auto mb-3">
          <KeyRound className="h-6 w-6 text-emerald-600" />
        </div>
        <h3 className="text-lg font-semibold text-slate-900">Contraseña actualizada</h3>
        <p className="text-sm text-slate-500 mt-1">La contraseña se actualizó correctamente</p>
      </div>
    );
  }

  return (
    <div className="p-6">
      <div className="mb-4">
        <h3 className="text-lg font-semibold text-slate-900">Cambiar Contraseña</h3>
        <p className="text-sm text-slate-500 mt-1">Actualiza tu contraseña de acceso</p>
      </div>

      <form onSubmit={handleSubmit} className="space-y-4">
        {/* Current Password */}
        <div>
          <label className="block text-sm font-medium text-slate-700 mb-1.5">Contraseña actual</label>
          <div className="relative">
            <Input
              type={showCurrent ? 'text' : 'password'}
              value={currentPassword}
              onChange={(e) => setCurrentPassword(e.target.value)}
              required
              className="h-10 pr-10"
              disabled={isSubmitting}
            />
            <button
              type="button"
              onClick={() => setShowCurrent(!showCurrent)}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400"
              tabIndex={-1}
            >
              {showCurrent ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
            </button>
          </div>
        </div>

        {/* New Password */}
        <div>
          <label className="block text-sm font-medium text-slate-700 mb-1.5">Nueva contraseña</label>
          <div className="relative">
            <Input
              type={showNew ? 'text' : 'password'}
              value={newPassword}
              onChange={(e) => setNewPassword(e.target.value)}
              required
              className="h-10 pr-10"
              disabled={isSubmitting}
            />
            <button
              type="button"
              onClick={() => setShowNew(!showNew)}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400"
              tabIndex={-1}
            >
              {showNew ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
            </button>
          </div>
          {newPassword && !passwordLongEnough && (
            <p className="text-xs text-amber-600 mt-1">Mínimo 6 caracteres</p>
          )}
        </div>

        {/* Confirm Password */}
        <div>
          <label className="block text-sm font-medium text-slate-700 mb-1.5">Confirmar contraseña</label>
          <Input
            type="password"
            value={confirmPassword}
            onChange={(e) => setConfirmPassword(e.target.value)}
            required
            className="h-10"
            disabled={isSubmitting}
          />
          {confirmPassword && !passwordsMatch && (
            <p className="text-xs text-red-600 mt-1">Las contraseñas no coinciden</p>
          )}
        </div>

        {/* Error */}
        {error && (
          <div className="bg-red-50 border border-red-200 rounded-lg px-3 py-2">
            <p className="text-sm text-red-700">{error}</p>
          </div>
        )}

        {/* Buttons */}
        <div className="flex gap-3 pt-2">
          <Button
            type="button"
            variant="outline"
            onClick={onClose}
            className="flex-1"
            disabled={isSubmitting}
          >
            Cancelar
          </Button>
          <Button
            type="submit"
            className="flex-1 bg-emerald-500 hover:bg-emerald-600 text-white"
            disabled={!canSubmit || isSubmitting}
          >
            {isSubmitting ? (
              <>
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                Actualizando...
              </>
            ) : (
              'Cambiar'
            )}
          </Button>
        </div>
      </form>
    </div>
  );
}
