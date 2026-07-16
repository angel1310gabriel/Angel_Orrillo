'use client';

import React, { useState, useRef, useEffect, useMemo } from 'react';
import { useAuth } from '@/hooks/use-auth';
import { Loader2, Eye, EyeOff, Mail, Lock, IdCard, Smartphone, Fingerprint, LogIn } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { auth } from '@/lib/firebase-client';
import { signInWithEmailAndPassword, sendPasswordResetEmail, type UserCredential } from 'firebase/auth';

function detectLoginType(input: string): { type: string; icon: any; label: string; placeholder: string } {
  const clean = input.replace(/\D/g, '');
  if (clean.length === 8 && /^\d{8}$/.test(clean)) return { type: 'dni', icon: IdCard, label: 'DNI', placeholder: '12345678' };
  if (clean.length === 9 && /^9\d{8}$/.test(clean)) return { type: 'phone', icon: Smartphone, label: 'Celular', placeholder: '999888777' };
  if (input.includes('@')) return { type: 'email', icon: Mail, label: 'Email', placeholder: 'usuario@email.com' };
  return { type: 'unknown', icon: Mail, label: 'Usuario', placeholder: 'Email, DNI o Celular' };
}

async function tryBiometricLogin(): Promise<{ email: string; password: string } | null> {
  try {
    if (!navigator.credentials || !navigator.credentials.get) return null;
    const cred = await navigator.credentials.get({
      password: true,
      mediation: 'optional',
    }) as any;
    if (cred?.type === 'password') {
      return { email: cred.id || '', password: cred.name || '' };
    }
    return null;
  } catch { return null; }
}

async function saveBiometricCredential(email: string, password: string) {
  try {
    if (!navigator.credentials || !navigator.credentials.create) return;
    await navigator.credentials.create({
      password: { id: email, name: password, type: 'password' } as any,
    } as CredentialCreationOptions);
  } catch { /* silent */ }
}

export default function LoginScreen() {
  const { _setUser, isLoading, error, clearError } = useAuth();
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [localLoading, setLocalLoading] = useState(false);
  const [localError, setLocalError] = useState<string | null>(null);
  const [bioSupported, setBioSupported] = useState(false);
  const [bioLoading, setBioLoading] = useState(false);
  const [resetSent, setResetSent] = useState(false);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const cardRef = useRef<HTMLDivElement>(null);
  const wrapperRef = useRef<HTMLDivElement>(null);
  const pwRef = useRef<HTMLInputElement>(null);

  const displayError = localError || error;

  const loginType = useMemo(() => detectLoginType(username), [username]);
  const LoginIcon = loginType.icon;

  useEffect(() => {
    setBioSupported(!!(navigator.credentials && navigator.credentials.get));
    tryBiometricLogin().then(cred => {
      if (cred && cred.email) {
        setUsername(cred.email);
        if (cred.password) setPassword(cred.password);
        setTimeout(() => pwRef.current?.focus(), 100);
      }
    });
  }, []);

  const buildEmail = (input: string): string => {
    const clean = input.replace(/\D/g, '');
    if (clean.length === 8 && /^\d{8}$/.test(clean)) return `${clean}@kc-cobranzas.app`;
    if (clean.length === 9 && /^9\d{8}$/.test(clean)) return `${clean}@phone.kc-cobranzas.app`;
    if (input.includes('@')) return input.trim().toLowerCase();
    return `${input}@kc-cobranzas.app`;
  };

  const tryEmailVariants = async (base: string, pw: string): Promise<UserCredential | null> => {
    const variants = [base];
    const at = base.lastIndexOf('@');
    if (at > 0) {
      const local = base.slice(0, at);
      const domain = base.slice(at);
      if (domain === '@kc-cobranzas.app') {
        variants.push(`${local}@bio.kc-cobranzas.app`);
      } else if (domain === '@bio.kc-cobranzas.app') {
        variants.push(`${local}@kc-cobranzas.app`);
      } else {
        const clean = local.replace(/\D/g, '');
        if (clean.length === 8) {
          variants.push(`${local}@kc-cobranzas.app`, `${local}@bio.kc-cobranzas.app`);
        }
      }
    }
    const seen = new Set<string>();
    let lastErr: any = null;
    for (const v of variants) {
      if (seen.has(v)) continue;
      seen.add(v);
      try {
        return await signInWithEmailAndPassword(auth, v, pw);
      } catch (e: any) {
        lastErr = e;
        if (e?.code !== 'auth/user-not-found' && e?.code !== 'auth/invalid-credential') throw e;
      }
    }
    throw lastErr || new Error('Error al ingresar');
  };

  const doLogin = async (email: string, pw: string) => {
    setLocalLoading(true);
    setLocalError(null);
    try {
      const cred = await tryEmailVariants(email, pw);
      let role = 'collector';
      let name = cred.user.email?.split('@')[0] || 'Usuario';
      let phone: string | null = null;
      let documentNumber: string | null = null;
      let photoUrl: string | null = null;
      let isActive = true;
      try {
        const res = await fetch(`/api/profile?uid=${encodeURIComponent(cred.user.uid)}`);
        if (res.ok) {
          const p = await res.json();
          role = p.role || 'collector';
          name = p.name || name;
          phone = p.phone || null;
          documentNumber = p.documentNumber || null;
          photoUrl = p.photoUrl || null;
          isActive = p.isActive ?? true;
        }
      } catch {}
      _setUser({
        id: cred.user.uid,
        email: cred.user.email || email,
        name,
        role: role as 'admin' | 'supervisor' | 'collector',
        phone,
        documentNumber,
        isActive,
        photoUrl: photoUrl || undefined,
      });
      saveBiometricCredential(cred.user.email || email, pw);
    } catch (err: any) {
      const msg = err?.code === 'auth/user-not-found' || err?.code === 'auth/invalid-credential'
        ? 'Usuario o contraseña incorrectos'
        : err?.code === 'auth/too-many-requests'
        ? 'Demasiados intentos. Espera un momento'
        : err?.message || 'Error al ingresar';
      setLocalError(msg);
    } finally {
      setLocalLoading(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    clearError();
    if (!username || !password) { setLocalError('Ingresa usuario y contraseña'); return; }
    const clean = username.replace(/\D/g, '');
    // If DNI or phone, try to look up the real Firebase email from DB first
    if ((clean.length === 8 && /^\d{8}$/.test(clean)) || (clean.length === 9 && /^9\d{8}$/.test(clean))) {
      const param = clean.length === 8 ? 'dni' : 'phone';
      try {
        const res = await fetch(`/api/profile/lookup?${param}=${clean}`);
        if (res.ok) {
          const data = await res.json();
          if (data.firebaseEmail) {
            doLogin(data.firebaseEmail, password);
            return;
          }
        }
      } catch {}
    }
    const email = buildEmail(username);
    doLogin(email, password);
  };

  const handleBioLogin = async () => {
    if (!bioSupported) return;
    setBioLoading(true);
    try {
      const cred = await tryBiometricLogin();
      if (cred && cred.email) {
        doLogin(cred.email, cred.password);
      } else {
        setLocalError('No hay credenciales guardadas. Inicia sesión primero para guardarlas.');
      }
    } catch { setLocalError('Error al leer huella digital'); }
    finally { setBioLoading(false); }
  };

  // Starfield Canvas
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    let stars: { x: number; y: number; r: number; alpha: number; maxAlpha: number; speed: number; state: string; vx: number; vy: number; color: string }[] = [];
    let animId: number;
    function resize() { canvas!.width = window.innerWidth; canvas!.height = window.innerHeight; initStars(); }
    class Star {
      x: number; y: number; r: number; alpha: number; maxAlpha: number; speed: number; state: string; vx: number; vy: number; color: string;
      constructor(x?: number, y?: number) { this.x = x ?? Math.random() * canvas!.width; this.y = y ?? Math.random() * canvas!.height; this.reset(); }
      reset() {
        this.r = Math.random() * 1.8 + 0.3; this.alpha = 0; this.maxAlpha = Math.random() * 0.7 + 0.3;
        this.speed = Math.random() * 0.008 + 0.002; this.state = 'growing'; this.vx = (Math.random() - 0.5) * 0.03; this.vy = (Math.random() - 0.5) * 0.03;
        const colors = ['rgba(255,255,255,', 'rgba(147,197,253,', 'rgba(52,211,153,', 'rgba(167,139,250,'];
        this.color = colors[Math.floor(Math.random() * colors.length)];
      }
      draw() {
        ctx!.beginPath(); ctx!.arc(this.x, this.y, this.r, 0, Math.PI * 2);
        ctx!.fillStyle = this.color + this.alpha + ')'; ctx!.fill();
        if (this.alpha > 0.3) { ctx!.beginPath(); ctx!.arc(this.x, this.y, this.r * 3, 0, Math.PI * 2); ctx!.fillStyle = this.color + this.alpha * 0.12 + ')'; ctx!.fill(); }
      }
      update() {
        this.x += this.vx; this.y += this.vy;
        const w = canvas!.width, h = canvas!.height;
        if (this.x < 0) this.x = w; if (this.x > w) this.x = 0; if (this.y < 0) this.y = h; if (this.y > h) this.y = 0;
        if (this.state === 'growing') { this.alpha += this.speed; if (this.alpha >= this.maxAlpha) this.state = 'fading'; }
        else { this.alpha -= this.speed; if (this.alpha <= 0) { this.alpha = 0; this.x = Math.random() * w; this.y = Math.random() * h; this.reset(); } }
      }
    }
    function initStars() {
      stars = []; const count = Math.min(Math.max(Math.floor((canvas!.width * canvas!.height) / 6000), 100), 250);
      for (let i = 0; i < count; i++) { const s = new Star(); s.alpha = Math.random() * s.maxAlpha; s.state = Math.random() > 0.5 ? 'growing' : 'fading'; stars.push(s); }
    }
    function animate() { ctx!.clearRect(0, 0, canvas!.width, canvas!.height); stars.forEach(s => { s.update(); s.draw(); }); animId = requestAnimationFrame(animate); }
    resize(); animate();
    window.addEventListener('resize', resize);
    return () => { cancelAnimationFrame(animId); window.removeEventListener('resize', resize); };
  }, []);

  // 3D Tilt
  useEffect(() => {
    const card = cardRef.current;
    if (!card) return;
    let isMobile = 'ontouchstart' in window;
    const handleMouse = (ev: MouseEvent) => {
      const rect = card.getBoundingClientRect();
      const x = ev.clientX - rect.left, y = ev.clientY - rect.top;
      const cx = rect.width / 2, cy = rect.height / 2;
      const rx = (y - cy) / cy * -12, ry = (x - cx) / cx * 12;
      card.style.setProperty('--rx', `${rx}deg`); card.style.setProperty('--ry', `${ry}deg`);
      card.style.transform = `perspective(800px) rotateX(${rx}deg) rotateY(${ry}deg)`;
    };
    const handleLeave = () => { card.style.transform = 'perspective(800px) rotateX(0deg) rotateY(0deg)'; };
    const handleOrientation = (ev: DeviceOrientationEvent) => {
      if (ev.gamma == null || ev.beta == null) return;
      const rx = Math.max(-12, Math.min(12, (ev.beta - 45) * 0.4));
      const ry = Math.max(-12, Math.min(12, ev.gamma * 0.6));
      card.style.setProperty('--rx', `${rx}deg`); card.style.setProperty('--ry', `${ry}deg`);
      card.style.transform = `perspective(800px) rotateX(${rx}deg) rotateY(${ry}deg)`;
    };
    if (!isMobile) { card.addEventListener('mousemove', handleMouse); card.addEventListener('mouseleave', handleLeave); }
    else {
      const request = (DeviceOrientationEvent as any).requestPermission;
      if (typeof request === 'function') { request().then((r: string) => { if (r === 'granted') window.addEventListener('deviceorientation', handleOrientation); }).catch(() => {}); }
      else { window.addEventListener('deviceorientation', handleOrientation); }
    }
    return () => { card.removeEventListener('mousemove', handleMouse); card.removeEventListener('mouseleave', handleLeave); window.removeEventListener('deviceorientation', handleOrientation); };
  }, []);

  return (
    <div className="min-h-screen flex items-center justify-center bg-[#05060b] relative overflow-hidden">
      <canvas ref={canvasRef} className="absolute inset-0 z-0" />
      <div className="fixed top-[-200px] left-[-200px] w-[600px] h-[600px] bg-emerald-500/8 rounded-full blur-[120px] pointer-events-none z-0" />
      <div className="fixed bottom-[-200px] right-[-200px] w-[600px] h-[600px] bg-emerald-500/6 rounded-full blur-[120px] pointer-events-none z-0" />
      <div ref={wrapperRef} className="relative z-10 w-full max-w-md mx-4" style={{ perspective: '800px' }}>
        <div ref={cardRef} className="backdrop-blur-2xl rounded-3xl border border-emerald-500/20 shadow-[0_8px_60px_rgba(16,185,129,0.15)] p-8 sm:p-10 transition-transform duration-200 ease-out" style={{ transform: 'perspective(800px) rotateX(0deg) rotateY(0deg)', background: 'linear-gradient(135deg, rgba(16,185,129,0.08), rgba(16,185,129,0.02))' }}>
          <div className="text-center mb-8">
            <div className="mb-4">
              <img src="/logo.png" alt="KC Cobranzas" className="w-16 h-16 rounded-2xl mx-auto shadow-lg shadow-emerald-500/30" />
            </div>
            <h1 className="text-2xl font-bold text-white tracking-tight">KC Cobranzas</h1>
            <p className="text-sm text-emerald-400/80 mt-1 font-medium">Panel de Administración</p>
          </div>
          {displayError && (
            <div className="mb-4 p-3 rounded-xl bg-red-500/10 border border-red-500/20 text-red-400 text-sm text-center animate-[fadeIn_200ms_ease-out]">
              {displayError}
            </div>
          )}
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-1.5">
              <label className="text-xs font-medium text-emerald-400/80">{loginType.label}</label>
              <div className="relative">
                <LoginIcon className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-emerald-400/60" />
                <input
                  type="text"
                  value={username}
                  onChange={e => { setUsername(e.target.value); setLocalError(null); }}
                  placeholder={loginType.placeholder}
                  className="w-full pl-10 pr-4 py-2.5 rounded-xl bg-white/5 border border-emerald-500/20 text-white placeholder-emerald-400/30 focus:outline-none focus:ring-2 focus:ring-emerald-500/40 focus:border-emerald-500/40 transition-all text-sm"
                  autoFocus
                  disabled={localLoading}
                />
                {username.length > 0 && loginType.type !== 'unknown' && (
                  <div className="absolute right-3 top-1/2 -translate-y-1/2">
                    <span className="text-[10px] text-emerald-400/50 font-medium bg-emerald-500/10 px-1.5 py-0.5 rounded">{loginType.label}</span>
                  </div>
                )}
              </div>
            </div>
            <div className="space-y-1.5">
              <label className="text-xs font-medium text-emerald-400/80">Contraseña</label>
              <div className="relative">
                <Lock className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-emerald-400/60" />
                <input
                  ref={pwRef}
                  type={showPassword ? 'text' : 'password'}
                  value={password}
                  onChange={e => { setPassword(e.target.value); setLocalError(null); }}
                  placeholder="••••••••"
                  className="w-full pl-10 pr-10 py-2.5 rounded-xl bg-white/5 border border-emerald-500/20 text-white placeholder-emerald-400/30 focus:outline-none focus:ring-2 focus:ring-emerald-500/40 focus:border-emerald-500/40 transition-all text-sm"
                  disabled={localLoading}
                />
                <button type="button" onClick={() => setShowPassword(!showPassword)} className="absolute right-3 top-1/2 -translate-y-1/2 text-emerald-400/60 hover:text-emerald-400 transition-colors">
                  {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
              </div>
            </div>
            <div className="flex justify-end -mt-1">
              <button
                type="button"
                onClick={async () => {
                  const e = buildEmail(username);
                  if (!e.includes('@')) { setLocalError('Ingresa un usuario válido primero'); return; }
                  try {
                    await sendPasswordResetEmail(auth, e);
                    setResetSent(true);
                    setLocalError(null);
                    setTimeout(() => setResetSent(false), 5000);
                  } catch { setLocalError('Error al enviar correo de restablecimiento'); }
                }}
                className="text-[11px] text-emerald-400/50 hover:text-emerald-400 transition-colors"
              >
                {resetSent ? '✓ Correo enviado' : '¿Olvidaste tu contraseña?'}
              </button>
            </div>
            <div className="flex gap-2">
              <Button
                type="submit"
                disabled={localLoading || !username || !password}
                className="flex-1 py-2.5 rounded-xl bg-gradient-to-r from-emerald-500 to-teal-500 text-white font-semibold text-sm hover:from-emerald-600 hover:to-teal-600 disabled:opacity-50 disabled:cursor-not-allowed transition-all shadow-lg shadow-emerald-500/25 hover:shadow-emerald-500/40"
              >
                {localLoading ? <><Loader2 className="h-4 w-4 animate-spin mr-2" /> Ingresando...</> : <><LogIn className="h-4 w-4 mr-2" /> Ingresar</>}
              </Button>
              {bioSupported && (
                <Button
                  type="button"
                  disabled={bioLoading || localLoading}
                  onClick={handleBioLogin}
                  className="px-3 py-2.5 rounded-xl bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 hover:bg-emerald-500/20 disabled:opacity-50 transition-all"
                  title="Iniciar con huella digital"
                >
                  {bioLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Fingerprint className="h-4 w-4" />}
                </Button>
              )}
            </div>
          </form>
          <p className="text-center text-[10px] text-emerald-400/30 mt-6">KC Cobranzas v2.0 — Sistema de Gestión</p>
        </div>
      </div>
    </div>
  );
}
