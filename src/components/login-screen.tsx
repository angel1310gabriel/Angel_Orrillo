'use client';

import React, { useState, useRef, useEffect } from 'react';
import { useAuth } from '@/hooks/use-auth';
import { Loader2, Eye, EyeOff, Mail, Lock } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';

export default function LoginScreen() {
  const { login, isLoading, error, clearError } = useAuth();
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const cardRef = useRef<HTMLDivElement>(null);
  const wrapperRef = useRef<HTMLDivElement>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    clearError();
    await login(username, password);
  };

  // Starfield Canvas
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    let stars: {
      x: number; y: number; r: number; alpha: number; maxAlpha: number;
      speed: number; state: string; vx: number; vy: number; color: string;
    }[] = [];
    let animId: number;

    function resize() {
      canvas!.width = window.innerWidth;
      canvas!.height = window.innerHeight;
      initStars();
    }

    class Star {
      x: number; y: number; r: number; alpha: number; maxAlpha: number;
      speed: number; state: string; vx: number; vy: number; color: string;

      constructor(x?: number, y?: number) {
        this.x = x ?? Math.random() * canvas!.width;
        this.y = y ?? Math.random() * canvas!.height;
        this.reset();
      }

      reset() {
        this.r = Math.random() * 1.8 + 0.3;
        this.alpha = 0;
        this.maxAlpha = Math.random() * 0.7 + 0.3;
        this.speed = Math.random() * 0.008 + 0.002;
        this.state = 'growing';
        this.vx = (Math.random() - 0.5) * 0.03;
        this.vy = (Math.random() - 0.5) * 0.03;
        const colors = [
          'rgba(255,255,255,', 'rgba(147,197,253,',
          'rgba(52,211,153,', 'rgba(167,139,250,'
        ];
        this.color = colors[Math.floor(Math.random() * colors.length)];
      }

      draw() {
        ctx!.beginPath();
        ctx!.arc(this.x, this.y, this.r, 0, Math.PI * 2);
        ctx!.fillStyle = this.color + this.alpha + ')';
        ctx!.fill();
        if (this.alpha > 0.3) {
          ctx!.beginPath();
          ctx!.arc(this.x, this.y, this.r * 3, 0, Math.PI * 2);
          ctx!.fillStyle = this.color + this.alpha * 0.12 + ')';
          ctx!.fill();
        }
      }

      update() {
        this.x += this.vx;
        this.y += this.vy;
        const w = canvas!.width;
        const h = canvas!.height;
        if (this.x < 0) this.x = w;
        if (this.x > w) this.x = 0;
        if (this.y < 0) this.y = h;
        if (this.y > h) this.y = 0;

        if (this.state === 'growing') {
          this.alpha += this.speed;
          if (this.alpha >= this.maxAlpha) this.state = 'fading';
        } else {
          this.alpha -= this.speed;
          if (this.alpha <= 0) {
            this.alpha = 0;
            this.x = Math.random() * w;
            this.y = Math.random() * h;
            this.reset();
          }
        }
      }
    }

    function initStars() {
      stars = [];
      const count = Math.min(Math.max(Math.floor((canvas!.width * canvas!.height) / 6000), 100), 250);
      for (let i = 0; i < count; i++) {
        const s = new Star();
        s.alpha = Math.random() * s.maxAlpha;
        s.state = Math.random() > 0.5 ? 'growing' : 'fading';
        stars.push(s);
      }
    }

    function animate() {
      ctx!.clearRect(0, 0, canvas!.width, canvas!.height);
      stars.forEach(s => { s.update(); s.draw(); });
      animId = requestAnimationFrame(animate);
    }

    resize();
    animate();
    window.addEventListener('resize', resize);
    return () => {
      cancelAnimationFrame(animId);
      window.removeEventListener('resize', resize);
    };
  }, []);

  // 3D Tilt Effect (desktop + mobile gyroscope)
  useEffect(() => {
    const wrapper = wrapperRef.current;
    const card = cardRef.current;
    if (!wrapper || !card) return;

    const isTouch = 'ontouchstart' in window;
    let targetX = 0, targetY = 0, currentX = 0, currentY = 0, targetTY = 0, currentTY = 0;
    let isInside = false, isFocused = false, useGyro = false;
    let animId2: number;

    // Gyroscope handler for mobile
    const onOrientation = (e: DeviceOrientationEvent) => {
      if (e.gamma === null || e.beta === null) return;
      useGyro = true;
      isInside = true;
      const rotX = Math.min(Math.max(((e.beta || 0) - 45) / -6, -5), 5);
      const rotY = Math.min(Math.max((e.gamma || 0) / 6, -5), 5);
      targetX = rotX;
      targetY = rotY;
      targetTY = -3;
    };

    if (isTouch) {
      // Request permission for iOS 13+
      const requestGyro = () => {
        if (typeof DeviceOrientationEvent !== 'undefined' && typeof (DeviceOrientationEvent as any).requestPermission === 'function') {
          (DeviceOrientationEvent as any).requestPermission().then((state: string) => {
            if (state === 'granted') window.addEventListener('deviceorientation', onOrientation);
          }).catch(() => {});
        } else {
          window.addEventListener('deviceorientation', onOrientation);
        }
      };
      // Require user gesture for permission
      document.addEventListener('click', requestGyro, { once: true });
      document.addEventListener('touchstart', requestGyro, { once: true });
    }

    const onMouseMove = (e: MouseEvent) => {
      if (useGyro) return;
      isInside = true;
      if (isFocused) { targetX = 0; targetY = 0; targetTY = 0; return; }
      const rect = wrapper.getBoundingClientRect();
      const xc = rect.left + rect.width / 2;
      const yc = rect.top + rect.height / 2;
      const x = e.clientX - xc;
      const y = e.clientY - yc;
      targetX = Math.min(Math.max(-y / 75, -5), 5);
      targetY = Math.min(Math.max(x / 75, -5), 5);
      targetTY = -3;
    };
    const onMouseLeave = () => { isInside = false; targetX = 0; targetY = 0; targetTY = 0; };

    if (!isTouch) {
      window.addEventListener('mousemove', onMouseMove);
      document.addEventListener('mouseleave', onMouseLeave);
      wrapper.addEventListener('focusin', () => { isFocused = true; });
      wrapper.addEventListener('focusout', () => { isFocused = false; });
    }

    function update(time: number) {
      if (!isInside && !isFocused) {
        const t = time * 0.001;
        targetX = Math.sin(t) * 1.5;
        targetY = Math.cos(t * 1.3) * 1.5;
        targetTY = Math.sin(t * 1.6) * 4 - 2;
      }
      currentX += (targetX - currentX) * 0.06;
      currentY += (targetY - currentY) * 0.06;
      currentTY += (targetTY - currentTY) * 0.06;
      card.style.transform = `perspective(1400px) rotateX(${currentX}deg) rotateY(${currentY}deg) translateY(${currentTY}px)`;
      animId2 = requestAnimationFrame(update);
    }
    animId2 = requestAnimationFrame(update);

    return () => {
      cancelAnimationFrame(animId2);
      window.removeEventListener('mousemove', onMouseMove);
      document.removeEventListener('mouseleave', onMouseLeave);
      window.removeEventListener('deviceorientation', onOrientation);
    };
  }, []);

  return (
    <div className="h-dvh flex relative overflow-hidden bg-[#05060b]">
      {/* Starfield Canvas */}
      <canvas ref={canvasRef} className="absolute inset-0 z-0 pointer-events-none" />

      {/* Ambient glow */}
      <div className="absolute top-1/4 -left-20 w-[500px] h-[500px] bg-emerald-500/4 rounded-full blur-[120px]" />
      <div className="absolute bottom-1/4 -right-20 w-[600px] h-[600px] bg-emerald-500/4 rounded-full blur-[120px]" />

      {/* Content */}
      <div className="relative z-10 w-full flex items-center justify-center p-4">
        <div className="w-full max-w-[440px]">
          {/* Logo */}
          <div className="text-center mb-6 animate-[fadeUp_0.6s_ease-out]">
            <img
              src="/logo.png"
              alt="KC Cobranzas"
              className="w-[80px] h-[80px] mx-auto mb-3 rounded-full border-2 border-emerald-500/40 object-cover shadow-[0_0_20px_rgba(16,185,129,0.3)] transition-all duration-500 hover:scale-105 hover:rotate-3 hover:shadow-[0_0_30px_rgba(16,185,129,0.6)]"
            />
            <h1 className="text-[1.7rem] font-black tracking-tight leading-tight bg-gradient-to-r from-white via-emerald-200 to-emerald-400 bg-clip-text text-transparent">
              KC Cobranzas
            </h1>
            <p className="text-muted-foreground text-[13px] mt-1 font-medium">
              Financiera & Gestión de Cobranzas
            </p>
          </div>

          {/* Card */}
          <div ref={wrapperRef}>
            <div
              ref={cardRef}
              className="bg-white/5 backdrop-blur-2xl rounded-[26px] border border-white/10 shadow-[inset_0_1px_0_rgba(255,255,255,0.1),_0_20px_50px_rgba(0,0,0,0.6)] p-[42px_40px] text-center transition-shadow duration-300 hover:shadow-[inset_0_1px_0_rgba(255,255,255,0.15),_0_30px_70px_rgba(0,0,0,0.8)] hover:bg-white/[0.07]"
              style={{ transformStyle: 'preserve-3d' }}
            >
              <div className="mb-4 animate-[fadeUp_0.6s_ease-out_0.1s_both]" style={{ transform: 'translateZ(25px)' }}>
                <h2 className="text-2xl font-black bg-gradient-to-r from-white via-emerald-200 to-emerald-400 bg-clip-text text-transparent">
                  Bienvenido
                </h2>
                <p className="text-muted-foreground text-[13px] mt-1">
                  Acceda a su panel de gestión
                </p>
              </div>

              <form onSubmit={handleSubmit} className="space-y-4" style={{ transformStyle: 'preserve-3d' }}>
                <div style={{ transform: 'translateZ(25px)' }}>
                  <label className="block text-[11px] font-semibold tracking-[0.12em] uppercase text-muted-foreground mb-1.5 text-left">
                    Usuario o Email
                  </label>
                  <div className="relative">
                    <Mail className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground pointer-events-none" />
                    <Input
                      type="text"
                      placeholder="nombre@ejemplo.com"
                      value={username}
                      onChange={(e) => { setUsername(e.target.value); clearError(); }}
                      required
                      autoComplete="username"
                      className="h-[46px] pl-[2.8rem] bg-white/5 border-white/10 text-white placeholder:text-muted-foreground focus:ring-2 focus:ring-emerald-500/30 focus:border-emerald-500/50 focus:bg-emerald-500/5 transition-all duration-300 rounded-[14px] text-[16px]"
                      disabled={isLoading}
                    />
                  </div>
                </div>

                <div style={{ transform: 'translateZ(25px)' }}>
                  <label className="block text-[11px] font-semibold tracking-[0.12em] uppercase text-muted-foreground mb-1.5 text-left">
                    Contraseña
                  </label>
                  <div className="relative">
                    <Lock className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground pointer-events-none" />
                    <Input
                      type={showPassword ? 'text' : 'password'}
                      placeholder="Ingrese su contraseña"
                      value={password}
                      onChange={(e) => { setPassword(e.target.value); clearError(); }}
                      required
                      autoComplete="current-password"
                      className="h-[46px] pl-[2.8rem] pr-10 bg-white/5 border-white/10 text-white placeholder:text-muted-foreground focus:ring-2 focus:ring-emerald-500/30 focus:border-emerald-500/50 focus:bg-emerald-500/5 transition-all duration-300 rounded-[14px] text-[16px]"
                      disabled={isLoading}
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword(!showPassword)}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-emerald-400 transition-colors"
                      tabIndex={-1}
                    >
                      {showPassword ? <EyeOff className="h-[18px] w-[18px]" /> : <Eye className="h-[18px] w-[18px]" />}
                    </button>
                  </div>
                </div>

                {error && (
                  <div
                    className="flex items-center gap-2 px-4 py-3 bg-red-500/15 border border-red-500/30 rounded-[14px] text-sm text-red-300 font-semibold shadow-lg animate-[alertIn_0.3s_cubic-bezier(0.16,1,0.3,1)]"
                    style={{ transform: 'translateZ(25px)' }}
                  >
                    <svg viewBox="0 0 24 24" className="w-[18px] h-[18px] fill-red-500 shrink-0"><path d="M12 2a10 10 0 1 0 0 20 10 10 0 0 0 0-20zm1 15h-2v-2h2v2zm0-4h-2V7h2v6z"/></svg>
                    {error}
                  </div>
                )}

                <Button
                  type="submit"
                  disabled={isLoading}
                  className="w-full h-12 mt-2 bg-gradient-to-r from-emerald-500 via-emerald-500 to-emerald-400 text-white font-bold tracking-widest uppercase rounded-[14px] shadow-[0_6px_25px_rgba(16,185,129,0.4)] transition-all duration-300 hover:shadow-[0_10px_30px_rgba(16,185,129,0.6)] hover:-translate-y-0.5 active:translate-y-0 text-sm"
                  style={{ transform: 'translateZ(30px)' }}
                >
                  {isLoading ? (
                    <><Loader2 className="h-4 w-4 mr-2 animate-spin" /> Ingresando...</>
                  ) : (
                    'Iniciar Sesión'
                  )}
                </Button>
              </form>


            </div>
          </div>

          <p className="text-center text-foreground/70 text-xs mt-6">
            &copy; {new Date().getFullYear()} KC Cobranzas. Todos los derechos reservados.
          </p>
        </div>
      </div>

      <style>{`
        @keyframes alertIn {
          from { opacity: 0; transform: translateY(-10px); }
          to { opacity: 1; transform: translateY(0); }
        }
        @keyframes fadeUp {
          from { opacity: 0; transform: translateY(20px); }
          to { opacity: 1; transform: translateY(0); }
        }
        body { overflow: hidden; }
      `}</style>
    </div>
  );
}
