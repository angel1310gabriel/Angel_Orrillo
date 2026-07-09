'use client';

import { useRef, useEffect } from 'react';

export default function StarfieldBg() {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    let stars: {
      x: number; y: number; r: number; alpha: number; maxAlpha: number;
      speed: number; state: string; vx: number; vy: number; color: string;
    }[] = [];
    let meteors: {
      x: number; y: number; vx: number; vy: number; len: number; alpha: number;
      r: number; life: number; maxLife: number;
    }[] = [];
    let animId: number;
    let meteorTimer = 0;

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
        const colors = ['rgba(255,255,255,', 'rgba(147,197,253,', 'rgba(52,211,153,', 'rgba(167,139,250,'];
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

    function spawnMeteor() {
      const angle = Math.random() * Math.PI * 2;
      const speed = 4 + Math.random() * 6;
      const x = Math.random() * canvas!.width;
      const y = Math.random() * canvas!.height * 0.3;
      meteors.push({
        x, y,
        vx: Math.cos(angle) * speed,
        vy: Math.sin(angle) * speed + 2,
        len: 60 + Math.random() * 80,
        alpha: 0.8 + Math.random() * 0.4,
        r: 1.5 + Math.random(),
        life: 0,
        maxLife: 40 + Math.random() * 30,
      });
    }

    function drawMeteor(m: typeof meteors[0]) {
      const speed = Math.sqrt(m.vx * m.vx + m.vy * m.vy) || 1;
      const tailX = m.x - (m.vx / speed) * m.len;
      const tailY = m.y - (m.vy / speed) * m.len;
      const gradient = ctx!.createLinearGradient(m.x, m.y, tailX, tailY);
      gradient.addColorStop(0, `rgba(255,255,255,${m.alpha})`);
      gradient.addColorStop(0.3, `rgba(52,211,153,${m.alpha * 0.6})`);
      gradient.addColorStop(1, `rgba(52,211,153,0)`);
      ctx!.beginPath();
      ctx!.moveTo(m.x, m.y);
      ctx!.lineTo(tailX, tailY);
      ctx!.strokeStyle = gradient;
      ctx!.lineWidth = m.r;
      ctx!.lineCap = 'round';
      ctx!.stroke();
      ctx!.beginPath();
      ctx!.arc(m.x, m.y, m.r * 1.5, 0, Math.PI * 2);
      ctx!.fillStyle = `rgba(255,255,255,${m.alpha * 0.9})`;
      ctx!.fill();
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

      meteorTimer++;
      if (meteorTimer > 120 + Math.random() * 200) {
        spawnMeteor();
        meteorTimer = 0;
      }

      meteors = meteors.filter(m => {
        m.life++;
        m.x += m.vx;
        m.y += m.vy;
        m.alpha *= 0.98;
        drawMeteor(m);
        return m.life < m.maxLife && m.alpha > 0.05;
      });

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

  return <canvas ref={canvasRef} className="fixed inset-0 z-0 pointer-events-none" />;
}
