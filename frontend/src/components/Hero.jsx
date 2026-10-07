import React, { useRef } from 'react';
import { ArrowRight } from '@phosphor-icons/react';

/**
 * Hero component for DeepQR Shield.
 *
 * Implements an operate-first, research-grade entry point:
 * - Direct headline carrying the core thesis: "Check before you scan."
 * - Precise supporting copy explaining dual-modality (image analysis + URL assessment).
 * - Single dominant action: "Analyze a QR code".
 * - Restrained geometric QR structural element with physical framing and subtle pointer light.
 * - Strict typography and spatial rhythm.
 */
export default function Hero({ onAnalyzeClick }) {
  const qrFrameRef = useRef(null);

  const handleAction = (e) => {
    e.preventDefault();
    if (onAnalyzeClick) {
      onAnalyzeClick();
    } else {
      const target = document.getElementById('analyze');
      if (target) {
        target.scrollIntoView({ behavior: 'smooth' });
      }
    }
  };

  const handleMouseMove = (e) => {
    if (!qrFrameRef.current) return;
    const rect = qrFrameRef.current.getBoundingClientRect();
    const x = ((e.clientX - rect.left) / rect.width) * 100;
    const y = ((e.clientY - rect.top) / rect.height) * 100;
    qrFrameRef.current.style.setProperty('--mouse-x', `${x.toFixed(1)}%`);
    qrFrameRef.current.style.setProperty('--mouse-y', `${y.toFixed(1)}%`);
  };

  return (
    <section
      aria-labelledby="hero-heading"
      className="relative w-full border-b border-zinc-800/80 bg-zinc-950 pt-12 pb-16 sm:pt-16 sm:pb-20 lg:pt-20 lg:pb-24"
    >
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <div className="grid grid-cols-1 items-center gap-12 lg:grid-cols-12 lg:gap-8">
          {/* Editorial & Operational Content */}
          <div className="lg:col-span-7">
            <h1
              id="hero-heading"
              className="text-4xl font-semibold tracking-[-0.03em] text-zinc-100 sm:text-5xl lg:text-6xl leading-[1.06]"
            >
              Check before you scan.
            </h1>

            <p className="mt-5 max-w-[52ch] text-base leading-relaxed text-zinc-400 sm:text-lg">
              DeepQR Shield analyzes both the physical QR code image and its decoded URL destination to identify tampering, obfuscation, and malicious redirects before your device opens the link.
            </p>

            {/* Single Dominant Primary Action */}
            <div className="mt-8 flex items-center">
              <a
                href="#analyze"
                onClick={handleAction}
                className="inline-flex items-center gap-2 rounded-md bg-zinc-100 px-5 py-2.5 text-sm font-medium text-zinc-950 shadow-xs transition-all duration-150 ease-[cubic-bezier(0.16,1,0.3,1)] hover:bg-white active:scale-[0.98] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500/60 focus-visible:ring-offset-2 focus-visible:ring-offset-zinc-950 motion-reduce:transition-none motion-reduce:transform-none"
              >
                <span>Analyze a QR code</span>
                <ArrowRight size={16} weight="bold" />
              </a>
            </div>
          </div>

          {/* Restrained Technical QR Geometry */}
          <div className="flex items-center justify-center lg:col-span-5" aria-hidden="true">
            <div
              ref={qrFrameRef}
              onMouseMove={handleMouseMove}
              style={{ '--mouse-x': '50%', '--mouse-y': '50%' }}
              className="group relative flex aspect-square w-full max-w-[320px] flex-col justify-between overflow-hidden rounded-2xl border border-white/[0.08] bg-zinc-900/40 p-8 sm:max-w-[360px] shadow-[inset_0_1px_0_rgba(255,255,255,0.06),0_8px_32px_rgba(0,0,0,0.36)] backdrop-blur-md transition-all duration-200 hover:border-zinc-700/80 hover:bg-zinc-900/50"
            >
              {/* Subtle Dynamic Radial Pointer Illumination Layer */}
              <div
                className="pointer-events-none absolute inset-0 opacity-0 transition-opacity duration-300 ease-[cubic-bezier(0.16,1,0.3,1)] group-hover:opacity-100 motion-reduce:hidden"
                style={{
                  background: 'radial-gradient(350px circle at var(--mouse-x, 50%) var(--mouse-y, 50%), rgba(255, 255, 255, 0.035), transparent 70%)',
                }}
              />

              {/* Corner Framing Brackets */}
              <div className="absolute top-2.5 left-2.5 h-3 w-3 border-t-2 border-l-2 border-zinc-700/60 transition-colors group-hover:border-zinc-600" />
              <div className="absolute top-2.5 right-2.5 h-3 w-3 border-t-2 border-r-2 border-zinc-700/60 transition-colors group-hover:border-zinc-600" />
              <div className="absolute bottom-2.5 left-2.5 h-3 w-3 border-b-2 border-l-2 border-zinc-700/60 transition-colors group-hover:border-zinc-600" />
              <div className="absolute bottom-2.5 right-2.5 h-3 w-3 border-b-2 border-r-2 border-zinc-700/60 transition-colors group-hover:border-zinc-600" />

              {/* Top Row: Dual Finder Patterns */}
              <div className="relative z-10 flex items-center justify-between">
                <svg width="64" height="64" viewBox="0 0 64 64" fill="none" className="text-zinc-600 transition-colors group-hover:text-zinc-500">
                  <rect x="1" y="1" width="62" height="62" rx="4" stroke="currentColor" strokeWidth="2" />
                  <rect x="8" y="8" width="48" height="48" fill="#18181b" stroke="#3f3f46" strokeWidth="1" />
                  <rect x="18" y="18" width="28" height="28" rx="2" fill="#d4d4d8" />
                </svg>

                {/* Subtle structural timing coordinate line */}
                <div className="mx-3 flex-1 border-b border-dashed border-zinc-800" />

                <svg width="64" height="64" viewBox="0 0 64 64" fill="none" className="text-zinc-600 transition-colors group-hover:text-zinc-500">
                  <rect x="1" y="1" width="62" height="62" rx="4" stroke="currentColor" strokeWidth="2" />
                  <rect x="8" y="8" width="48" height="48" fill="#18181b" stroke="#3f3f46" strokeWidth="1" />
                  <rect x="18" y="18" width="28" height="28" rx="2" fill="#d4d4d8" />
                </svg>
              </div>

              {/* Center Inspection Grid Vector */}
              <div className="relative z-10 my-6 flex items-center justify-center">
                <div className="grid grid-cols-5 gap-2">
                  <div className="h-2 w-2 rounded-xs bg-zinc-700" />
                  <div className="h-2 w-2 rounded-xs bg-zinc-800" />
                  <div className="h-2 w-2 rounded-xs bg-zinc-600" />
                  <div className="h-2 w-2 rounded-xs bg-zinc-800" />
                  <div className="h-2 w-2 rounded-xs bg-zinc-700" />
                  <div className="h-2 w-2 rounded-xs bg-zinc-800" />
                  <div className="h-2 w-2 rounded-xs bg-zinc-500" />
                  <div className="h-2 w-2 rounded-xs bg-zinc-800" />
                  <div className="h-2 w-2 rounded-xs bg-zinc-500" />
                  <div className="h-2 w-2 rounded-xs bg-zinc-800" />
                  <div className="h-2 w-2 rounded-xs bg-zinc-600" />
                  <div className="h-2 w-2 rounded-xs bg-zinc-800" />
                  <div className="h-2 w-2 rounded-xs bg-emerald-500/80" />
                  <div className="h-2 w-2 rounded-xs bg-zinc-800" />
                  <div className="h-2 w-2 rounded-xs bg-zinc-600" />
                </div>
              </div>

              {/* Bottom Row: Third Finder Pattern and Dual-Path Signal Node */}
              <div className="relative z-10 flex items-center justify-between">
                <svg width="64" height="64" viewBox="0 0 64 64" fill="none" className="text-zinc-600 transition-colors group-hover:text-zinc-500">
                  <rect x="1" y="1" width="62" height="62" rx="4" stroke="currentColor" strokeWidth="2" />
                  <rect x="8" y="8" width="48" height="48" fill="#18181b" stroke="#3f3f46" strokeWidth="1" />
                  <rect x="18" y="18" width="28" height="28" rx="2" fill="#d4d4d8" />
                </svg>

                {/* Subtle structural timing coordinate line */}
                <div className="mx-3 flex-1 border-b border-dashed border-zinc-800" />

                {/* Restrained Alignment Guide Marker */}
                <svg width="40" height="40" viewBox="0 0 40 40" fill="none" className="text-zinc-700">
                  <rect x="1" y="1" width="38" height="38" rx="3" stroke="currentColor" strokeWidth="1.5" />
                  <rect x="14" y="14" width="12" height="12" rx="1" fill="#71717a" />
                </svg>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
