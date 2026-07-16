'use client';

import { useRef, useEffect } from 'react';

interface BlobConfig {
  cx: number;
  cy: number;
  r: number;
  color: string;
  speed: number;
  driftX: number;
  driftY: number;
  scale: number;
}

export default function LiquidBg() {
  const svgRef = useRef<SVGSVGElement>(null);

  useEffect(() => {
    const svg = svgRef.current;
    if (!svg) return;

    const blobs: BlobConfig[] = [
      { cx: 15, cy: 20, r: 25, color: 'rgba(16,185,129,0.04)', speed: 0.3, driftX: 4, driftY: 3, scale: 1 },
      { cx: 80, cy: 70, r: 30, color: 'rgba(52,211,153,0.03)', speed: 0.2, driftX: -3, driftY: 5, scale: 1.1 },
      { cx: 50, cy: 45, r: 20, color: 'rgba(20,184,166,0.03)', speed: 0.25, driftX: 5, driftY: -4, scale: 0.9 },
      { cx: 30, cy: 80, r: 22, color: 'rgba(16,185,129,0.02)', speed: 0.15, driftX: -4, driftY: -3, scale: 1.2 },
      { cx: 65, cy: 25, r: 18, color: 'rgba(52,211,153,0.025)', speed: 0.35, driftX: 3, driftY: 4, scale: 0.8 },
    ];

    let time = 0;
    let animId: number;

    function generatePath(cx: number, cy: number, r: number, t: number): string {
      const variance = r * 0.4;
      const p1x = cx + r * Math.cos(t * 0.7);
      const p1y = cy + r * Math.sin(t * 0.7);
      const p2x = cx + r * Math.cos(t * 0.5 + 1.2);
      const p2y = cy + r * Math.sin(t * 0.5 + 1.2);
      const p3x = cx + r * Math.cos(t * 0.3 + 2.5);
      const p3y = cy + r * Math.sin(t * 0.3 + 2.5);
      const p4x = cx + r * Math.cos(t * 0.6 + 4.0);
      const p4y = cy + r * Math.sin(t * 0.6 + 4.0);

      const c1x = cx + (p1x + p2x) / 2 + variance * Math.sin(t);
      const c1y = cy + (p1y + p2y) / 2 + variance * Math.cos(t * 0.8);
      const c2x = cx + (p2x + p3x) / 2 + variance * Math.sin(t * 1.2);
      const c2y = cy + (p2y + p3y) / 2 + variance * Math.cos(t * 0.6);
      const c3x = cx + (p3x + p4x) / 2 + variance * Math.sin(t * 0.9);
      const c3y = cy + (p3y + p4y) / 2 + variance * Math.cos(t * 1.1);
      const c4x = cx + (p4x + p1x) / 2 + variance * Math.sin(t * 1.3);
      const c4y = cy + (p4y + p1y) / 2 + variance * Math.cos(t * 0.7);

      return `M ${p1x},${p1y} C ${c1x},${c1y} ${c2x},${c2y} ${p2x},${p2y} C ${c3x},${c3y} ${c4x},${c4y} ${p3x},${p3y} C ${c4x},${c4y} ${c1x},${c1y} ${p4x},${p4y} Z`;
    }

    function animate() {
      time += 0.02;
      const paths = svg!.querySelectorAll('path');
      blobs.forEach((blob, i) => {
        if (paths[i]) {
          const driftX = Math.sin(time * blob.speed * 0.5) * blob.driftX;
          const driftY = Math.cos(time * blob.speed * 0.4) * blob.driftY;
          const cx = blob.cx + driftX;
          const cy = blob.cy + driftY;
          const r = blob.r * blob.scale;
          (paths[i] as SVGPathElement).setAttribute('d', generatePath(cx, cy, r, time * blob.speed));
        }
      });
      animId = requestAnimationFrame(animate);
    }

    animate();
    return () => cancelAnimationFrame(animId);
  }, []);

  return (
    <svg
      ref={svgRef}
      className="fixed inset-0 w-full h-full pointer-events-none z-[1]"
      viewBox="0 0 100 100"
      preserveAspectRatio="xMidYMid slice"
      style={{ filter: 'blur(40px)' }}
    >
      <path fill="rgba(16,185,129,0.04)" />
      <path fill="rgba(52,211,153,0.03)" />
      <path fill="rgba(20,184,166,0.03)" />
      <path fill="rgba(16,185,129,0.02)" />
      <path fill="rgba(52,211,153,0.025)" />
    </svg>
  );
}
