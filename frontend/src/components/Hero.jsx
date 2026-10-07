import React, { useRef, useEffect } from 'react';
import { ArrowRight, ShieldCheck } from '@phosphor-icons/react';
import { sound } from '../utils/sound.js';

export default function Hero({ onAnalyzeClick }) {
  const containerRef = useRef(null);
  const cardRef = useRef(null);

  const handleAction = (e) => {
    e.preventDefault();
    sound.playClick();
    if (onAnalyzeClick) {
      onAnalyzeClick();
    } else {
      const target = document.getElementById('analyze');
      if (target) {
        target.scrollIntoView({ behavior: 'smooth' });
      }
    }
  };

  useEffect(() => {
    const container = containerRef.current;
    const card = cardRef.current;
    if (!container || !card) return;

    // Check for reduced motion preference
    const prefersReducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    if (prefersReducedMotion) return;

    let targetRotX = 0;
    let targetRotY = 0;
    let currentRotX = 0;
    let currentRotY = 0;
    let isHovered = false;
    let animationFrameId;

    const handleMouseMove = (e) => {
      const rect = container.getBoundingClientRect();
      const x = e.clientX - rect.left;
      const y = e.clientY - rect.top;

      // Normalized coordinates from -1 to 1
      const normX = (x / rect.width - 0.5) * 2;
      const normY = (y / rect.height - 0.5) * 2;

      // Max tilt angles: 20 deg X, 24 deg Y
      targetRotX = -normY * 20;
      targetRotY = normX * 24;

      // Calculate specular light position
      const lightX = ((x / rect.width) * 100).toFixed(1);
      const lightY = ((y / rect.height) * 100).toFixed(1);
      card.style.setProperty('--light-x', `${lightX}%`);
      card.style.setProperty('--light-y', `${lightY}%`);
    };

    const handleMouseEnter = () => {
      isHovered = true;
    };

    const handleMouseLeave = () => {
      isHovered = false;
      targetRotX = 0;
      targetRotY = 0;
    };

    container.addEventListener('mousemove', handleMouseMove, { passive: true });
    container.addEventListener('mouseenter', handleMouseEnter);
    container.addEventListener('mouseleave', handleMouseLeave);

    // Spring interpolation loop (Apple WWDC damping equivalent)
    const springDamping = 0.08;
    let tickCount = 0;

    const updatePhysics = () => {
      tickCount++;

      // Subtle ambient breathing float when idle
      const idleFloatX = isHovered ? 0 : Math.sin(tickCount * 0.02) * 3;
      const idleFloatY = isHovered ? 0 : Math.cos(tickCount * 0.015) * 4;

      currentRotX += (targetRotX + idleFloatX - currentRotX) * springDamping;
      currentRotY += (targetRotY + idleFloatY - currentRotY) * springDamping;

      card.style.transform = `rotateX(${currentRotX.toFixed(2)}deg) rotateY(${currentRotY.toFixed(2)}deg)`;

      animationFrameId = requestAnimationFrame(updatePhysics);
    };

    updatePhysics();

    return () => {
      cancelAnimationFrame(animationFrameId);
      container.removeEventListener('mousemove', handleMouseMove);
      container.removeEventListener('mouseenter', handleMouseEnter);
      container.removeEventListener('mouseleave', handleMouseLeave);
    };
  }, []);

  return (
    <section
      aria-labelledby="hero-heading"
      className="relative w-full border-b border-zinc-800/80 bg-zinc-950/40 backdrop-blur-xs pt-12 pb-16 sm:pt-16 sm:pb-20 lg:pt-20 lg:pb-24 overflow-hidden"
    >
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <div className="grid grid-cols-1 items-center gap-12 lg:grid-cols-12 lg:gap-8">
          {/* Editorial & Operational Content */}
          <div className="lg:col-span-7">
            {/* Kinetic Shimmer Headline */}
            <h1
              id="hero-heading"
              className="text-4xl font-semibold tracking-[-0.03em] sm:text-5xl lg:text-6xl leading-[1.06] select-none"
            >
              <span className="kinetic-text-shimmer block">
                Check before you scan.
              </span>
            </h1>

            <p className="mt-5 max-w-[52ch] text-base leading-relaxed text-zinc-400 sm:text-lg">
              DeepQR Shield analyzes both the physical QR code image and its decoded URL destination to identify tampering, obfuscation, and malicious redirects before your device opens the link.
            </p>

            {/* Single Dominant Primary Action with Tactile Spring Response */}
            <div className="mt-8 flex items-center gap-4">
              <a
                href="#analyze"
                onClick={handleAction}
                className="group relative inline-flex items-center gap-2.5 rounded-md bg-zinc-100 px-6 py-3 text-sm font-medium text-zinc-950 shadow-md transition-all duration-160 ease-[cubic-bezier(0.23,1,0.32,1)] hover:bg-white hover:shadow-[0_0_25px_rgba(255,255,255,0.2)] active:scale-[0.97] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500/60 focus-visible:ring-offset-2 focus-visible:ring-offset-zinc-950 motion-reduce:transition-none motion-reduce:transform-none"
              >
                <span>Analyze a QR code</span>
                <ArrowRight
                  size={16}
                  weight="bold"
                  className="transition-transform duration-160 ease-[cubic-bezier(0.23,1,0.32,1)] group-hover:translate-x-1"
                />
              </a>

              <div className="hidden sm:flex items-center gap-2 text-xs font-mono text-zinc-500">
                <ShieldCheck size={16} className="text-emerald-400" />
                <span>Zero redirect execution</span>
              </div>
            </div>
          </div>

          {/* 3D Realistic Holographic Scanner Core */}
          <div
            ref={containerRef}
            className="flex items-center justify-center lg:col-span-5 perspective-1200 py-6"
            aria-hidden="true"
          >
            <div
              ref={cardRef}
              style={{
                '--light-x': '50%',
                '--light-y': '50%',
                transformStyle: 'preserve-3d',
              }}
              className="relative flex aspect-square w-full max-w-[340px] sm:max-w-[380px] flex-col justify-between rounded-2xl border border-white/[0.12] bg-zinc-900/60 p-8 shadow-[inset_0_1px_0_rgba(255,255,255,0.1),0_20px_50px_rgba(0,0,0,0.6)] backdrop-blur-xl transition-shadow duration-300 hover:shadow-[inset_0_1px_0_rgba(255,255,255,0.15),0_25px_60px_rgba(16,185,129,0.1)] cursor-grab active:cursor-grabbing select-none"
            >
              {/* Layer 0: Dynamic Specular Reflection Sheen */}
              <div
                className="pointer-events-none absolute inset-0 rounded-2xl opacity-70 transition-opacity duration-300 motion-reduce:hidden"
                style={{
                  background:
                    'radial-gradient(400px circle at var(--light-x, 50%) var(--light-y, 50%), rgba(52, 211, 153, 0.12), rgba(255, 255, 255, 0.04) 30%, transparent 70%)',
                }}
              />

              {/* Layer 1: 3D Tactical Coordinate Grid (translateZ: 18px) */}
              <div
                style={{ transform: 'translateZ(18px)' }}
                className="pointer-events-none absolute inset-4 rounded-xl border border-dashed border-zinc-800/80"
              >
                {/* Coordinate tick marks */}
                <div className="absolute top-1/2 left-0 h-px w-2 bg-zinc-700" />
                <div className="absolute top-1/2 right-0 h-px w-2 bg-zinc-700" />
                <div className="absolute top-0 left-1/2 w-px h-2 bg-zinc-700" />
                <div className="absolute bottom-0 left-1/2 w-px h-2 bg-zinc-700" />
              </div>

              {/* Layer 2: 3D Holographic Laser Scanning Beam (translateZ: 36px) */}
              <div
                style={{ transform: 'translateZ(36px)' }}
                className="pointer-events-none absolute inset-x-6 top-6 bottom-6 overflow-hidden"
              >
                <div className="relative h-full w-full">
                  <div className="animate-laser-sweep absolute left-0 right-0 h-0.5 bg-gradient-to-r from-transparent via-emerald-400 to-transparent shadow-[0_0_14px_rgba(52,211,153,0.9)]">
                    <div className="absolute -inset-y-3 inset-x-0 bg-emerald-400/10 blur-xs" />
                  </div>
                </div>
              </div>

              {/* Layer 3: 3D QR Matrix Geometry (translateZ: 54px) */}
              <div
                style={{ transform: 'translateZ(54px)' }}
                className="relative z-10 flex flex-col justify-between h-full"
              >
                {/* Top Row: Dual 3D Finder Patterns */}
                <div className="flex items-center justify-between">
                  {/* Top-Left Finder Pattern with 3D Depth */}
                  <div className="relative flex h-16 w-16 items-center justify-center rounded-lg border-2 border-zinc-500 bg-zinc-900/90 shadow-[0_4px_12px_rgba(0,0,0,0.5)]">
                    <div className="h-10 w-10 rounded-sm border border-zinc-600 bg-zinc-950 flex items-center justify-center">
                      <div className="h-6 w-6 rounded-xs bg-zinc-200 shadow-[0_0_8px_rgba(255,255,255,0.4)]" />
                    </div>
                  </div>

                  {/* Optical Timing Line */}
                  <div className="mx-3 flex-1 border-b border-dashed border-emerald-500/40" />

                  {/* Top-Right Finder Pattern */}
                  <div className="relative flex h-16 w-16 items-center justify-center rounded-lg border-2 border-zinc-500 bg-zinc-900/90 shadow-[0_4px_12px_rgba(0,0,0,0.5)]">
                    <div className="h-10 w-10 rounded-sm border border-zinc-600 bg-zinc-950 flex items-center justify-center">
                      <div className="h-6 w-6 rounded-xs bg-zinc-200 shadow-[0_0_8px_rgba(255,255,255,0.4)]" />
                    </div>
                  </div>
                </div>

                {/* Center 3D Micro-Module Array */}
                <div className="my-5 flex items-center justify-center">
                  <div className="grid grid-cols-6 gap-2 p-2 rounded-lg bg-zinc-950/60 border border-white/[0.04]">
                    <div className="h-2.5 w-2.5 rounded-xs bg-zinc-600" />
                    <div className="h-2.5 w-2.5 rounded-xs bg-zinc-800" />
                    <div className="h-2.5 w-2.5 rounded-xs bg-emerald-400 shadow-[0_0_8px_rgba(52,211,153,0.6)]" />
                    <div className="h-2.5 w-2.5 rounded-xs bg-zinc-700" />
                    <div className="h-2.5 w-2.5 rounded-xs bg-zinc-800" />
                    <div className="h-2.5 w-2.5 rounded-xs bg-zinc-500" />

                    <div className="h-2.5 w-2.5 rounded-xs bg-zinc-800" />
                    <div className="h-2.5 w-2.5 rounded-xs bg-zinc-500" />
                    <div className="h-2.5 w-2.5 rounded-xs bg-zinc-800" />
                    <div className="h-2.5 w-2.5 rounded-xs bg-emerald-500/80" />
                    <div className="h-2.5 w-2.5 rounded-xs bg-zinc-700" />
                    <div className="h-2.5 w-2.5 rounded-xs bg-zinc-800" />

                    <div className="h-2.5 w-2.5 rounded-xs bg-emerald-400/90" />
                    <div className="h-2.5 w-2.5 rounded-xs bg-zinc-700" />
                    <div className="h-2.5 w-2.5 rounded-xs bg-zinc-800" />
                    <div className="h-2.5 w-2.5 rounded-xs bg-zinc-600" />
                    <div className="h-2.5 w-2.5 rounded-xs bg-zinc-800" />
                    <div className="h-2.5 w-2.5 rounded-xs bg-zinc-400" />
                  </div>
                </div>

                {/* Bottom Row: Third Finder Pattern & Alignment Target */}
                <div className="flex items-center justify-between">
                  {/* Bottom-Left Finder Pattern */}
                  <div className="relative flex h-16 w-16 items-center justify-center rounded-lg border-2 border-zinc-500 bg-zinc-900/90 shadow-[0_4px_12px_rgba(0,0,0,0.5)]">
                    <div className="h-10 w-10 rounded-sm border border-zinc-600 bg-zinc-950 flex items-center justify-center">
                      <div className="h-6 w-6 rounded-xs bg-zinc-200 shadow-[0_0_8px_rgba(255,255,255,0.4)]" />
                    </div>
                  </div>

                  <div className="mx-3 flex-1 border-b border-dashed border-emerald-500/40" />

                  {/* Optical Alignment Marker */}
                  <div className="relative flex h-10 w-10 items-center justify-center rounded-md border border-zinc-600 bg-zinc-900/80">
                    <div className="h-4 w-4 rounded-xs bg-zinc-400" />
                  </div>
                </div>
              </div>

              {/* Layer 4: 3D Corner Registration Framing (translateZ: 78px) */}
              <div
                style={{ transform: 'translateZ(78px)' }}
                className="pointer-events-none absolute inset-0 p-3"
              >
                {/* 3D Corner Registration Brackets */}
                <div className="absolute top-2 left-2 h-3.5 w-3.5 border-t-2 border-l-2 border-emerald-400/80 shadow-[0_0_8px_rgba(52,211,153,0.5)]" />
                <div className="absolute top-2 right-2 h-3.5 w-3.5 border-t-2 border-r-2 border-emerald-400/80 shadow-[0_0_8px_rgba(52,211,153,0.5)]" />
                <div className="absolute bottom-2 left-2 h-3.5 w-3.5 border-b-2 border-l-2 border-emerald-400/80 shadow-[0_0_8px_rgba(52,211,153,0.5)]" />
                <div className="absolute bottom-2 right-2 h-3.5 w-3.5 border-b-2 border-r-2 border-emerald-400/80 shadow-[0_0_8px_rgba(52,211,153,0.5)]" />
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
