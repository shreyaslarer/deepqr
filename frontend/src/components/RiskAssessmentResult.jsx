import React, { useState, useRef, useEffect } from 'react';
import {
  ShieldCheck,
  Warning,
  ShieldWarning,
  Copy,
  Check,
  Info,
  Waveform,
  LinkSimple,
  Cpu,
} from '@phosphor-icons/react';

const DEMO_SPECIMENS = {
  safe: {
    id: 'safe',
    classification: 'SAFE',
    summary: 'The submitted QR image and its destination exhibit standard, verified benign characteristics.',
    destination: 'https://example.org/resources/documentation',
    payloadType: 'URL',
    visualSignal: 'Uniform finder patterns, standard module density, no image tampering detected.',
    urlSignal: 'Standard hostname syntax, recognized domain structure, no obfuscation indicators.',
    fusionSignal: 'Visual pattern and destination safety indicators both confirm low risk profile.',
    explanation: 'The QR image exhibits standard matrix geometry with intact finder patterns, and the decoded destination uses standard domain structure without redirect anomalies or deceptive parameters.',
    badgeClass: 'text-emerald-400 bg-emerald-500/10 border-emerald-500/30',
    meterLevel: 'w-full bg-emerald-400',
    meterLabel: 'NOMINAL // 99.4%',
  },
  suspicious: {
    id: 'suspicious',
    classification: 'SUSPICIOUS',
    summary: 'Anomalies detected in the image structure or destination routing requiring caution.',
    destination: 'https://example-verify-portal.net/login?ref=sec',
    payloadType: 'URL',
    visualSignal: 'Non-standard matrix contrast, slight alignment variance near lower finder pattern.',
    urlSignal: 'High-entropy query parameters, unverified authentication routing keyword.',
    fusionSignal: 'Localized visual irregularity combined with deceptive URL query structure indicates heightened risk.',
    explanation: 'Visual inspection identified localized distortion, while the destination URL contains query parameters and routing patterns that warrant caution before interacting.',
    badgeClass: 'text-amber-400 bg-amber-500/10 border-amber-500/30',
    meterLevel: 'w-3/5 bg-amber-400',
    meterLabel: 'ANOMALOUS // 62.1%',
  },
  malicious: {
    id: 'malicious',
    classification: 'MALICIOUS',
    summary: 'Multiple confirmed threat indicators identified across visual tampering and destination routing.',
    destination: 'http://192.0.2.148/account-update/session-reset',
    payloadType: 'URL',
    visualSignal: 'Obfuscated module overlay, tampered finder pattern boundaries detected.',
    urlSignal: 'Direct raw IP routing, insecure transport protocol, credential-harvesting endpoint pattern.',
    fusionSignal: 'Severe physical pattern distortion and high-risk network destination routing indicate active threat.',
    explanation: 'The QR image displays visual tampering characteristics, and the decoded destination employs direct raw IP routing and deceptive account-update endpoints.',
    badgeClass: 'text-rose-400 bg-rose-500/10 border-rose-500/30',
    meterLevel: 'w-1/4 bg-rose-400',
    meterLabel: 'CRITICAL // 14.8%',
  },
};

/**
 * RiskAssessmentResult component for DeepQR Shield.
 *
 * Implements an inspection-grade 3D physical result report:
 * - 3D Perspective card chassis with spring-damped pointer response.
 * - Dynamic iridescent security hologram foil badge.
 * - Tactile contributing analysis signal modules with live telemetry meters.
 * - Untrusted destination quarantined (non-clickable, copy-only action).
 * - Tactile button response (:active scale 0.97, var(--ease-out)).
 * - Zero em-dashes and en-dashes throughout.
 */
export default function RiskAssessmentResult() {
  const [activeSpecimenKey, setActiveSpecimenKey] = useState('safe');
  const [copyFeedback, setCopyFeedback] = useState(false);
  const surfaceRef = useRef(null);

  const specimen = DEMO_SPECIMENS[activeSpecimenKey];

  // 3D Perspective Spring Physics on Report Card
  useEffect(() => {
    const surface = surfaceRef.current;
    if (!surface) return;

    const prefersReducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    if (prefersReducedMotion) return;

    let targetRotX = 0;
    let targetRotY = 0;
    let currentRotX = 0;
    let currentRotY = 0;
    let animationFrameId;

    const onMouseMove = (e) => {
      const rect = surface.getBoundingClientRect();
      const x = e.clientX - rect.left;
      const y = e.clientY - rect.top;
      const normX = (x / rect.width - 0.5) * 2;
      const normY = (y / rect.height - 0.5) * 2;
      targetRotX = -normY * 4; // subtle, weighted 4 degrees
      targetRotY = normX * 6;
      surface.style.setProperty('--light-x', `${((x / rect.width) * 100).toFixed(1)}%`);
      surface.style.setProperty('--light-y', `${((y / rect.height) * 100).toFixed(1)}%`);
    };

    const onMouseLeave = () => {
      targetRotX = 0;
      targetRotY = 0;
    };

    surface.addEventListener('mousemove', onMouseMove, { passive: true });
    surface.addEventListener('mouseleave', onMouseLeave);

    const updatePhysics = () => {
      currentRotX += (targetRotX - currentRotX) * 0.08;
      currentRotY += (targetRotY - currentRotY) * 0.08;
      surface.style.transform = `rotateX(${currentRotX.toFixed(2)}deg) rotateY(${currentRotY.toFixed(2)}deg)`;
      animationFrameId = requestAnimationFrame(updatePhysics);
    };

    updatePhysics();

    return () => {
      cancelAnimationFrame(animationFrameId);
      surface.removeEventListener('mousemove', onMouseMove);
      surface.removeEventListener('mouseleave', onMouseLeave);
    };
  }, []);

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(specimen.destination);
      setCopyFeedback(true);
      setTimeout(() => setCopyFeedback(false), 2000);
    } catch {
      setCopyFeedback(false);
    }
  };

  const renderIcon = (classification) => {
    switch (classification) {
      case 'SAFE':
        return <ShieldCheck size={32} weight="fill" className="text-emerald-400 shrink-0" />;
      case 'SUSPICIOUS':
        return <Warning size={32} weight="fill" className="text-amber-400 shrink-0" />;
      case 'MALICIOUS':
        return <ShieldWarning size={32} weight="fill" className="text-rose-400 shrink-0" />;
      default:
        return <Info size={32} weight="fill" className="text-zinc-400 shrink-0" />;
    }
  };

  return (
    <section
      id="results"
      aria-labelledby="results-heading"
      className="w-full bg-zinc-950/60 backdrop-blur-xs py-16 sm:py-20 lg:py-24"
    >
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        {/* Section Header */}
        <div className="mb-10">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
            <div>
              <h2
                id="results-heading"
                className="text-2xl font-semibold tracking-tight text-zinc-100 sm:text-3xl"
              >
                Risk Assessment Report
              </h2>
              <p className="mt-2 text-sm text-zinc-400 sm:text-base leading-relaxed">
                Inspection results synthesized across visual image characteristics and decoded destination analysis.
              </p>
            </div>

            {/* Specimen Inspection Controls */}
            <div className="flex flex-wrap items-center gap-1.5 rounded-lg border border-white/[0.08] bg-zinc-900/80 p-1">
              <span className="px-2 text-xs font-medium text-zinc-500 select-none">
                Preview state:
              </span>
              {Object.keys(DEMO_SPECIMENS).map((key) => {
                const item = DEMO_SPECIMENS[key];
                const isSelected = activeSpecimenKey === key;
                return (
                  <button
                    key={key}
                    type="button"
                    onClick={() => setActiveSpecimenKey(key)}
                    className={`rounded-md px-3 py-1.5 text-xs font-medium transition-all duration-150 ease-[cubic-bezier(0.23,1,0.32,1)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500/60 focus-visible:ring-offset-2 focus-visible:ring-offset-zinc-950 active:scale-[0.97] motion-reduce:transition-none motion-reduce:transform-none ${
                      isSelected
                        ? 'border border-zinc-700 bg-zinc-800 text-zinc-100 shadow-xs'
                        : 'text-zinc-400 hover:text-zinc-200'
                    }`}
                    aria-pressed={isSelected}
                  >
                    {item.classification}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Sample Assessment Notice */}
          <div className="mt-4 flex items-center gap-2 rounded-md border border-zinc-800/80 bg-zinc-900/30 px-3.5 py-2 text-xs text-zinc-400">
            <Info size={15} weight="regular" className="text-zinc-400 shrink-0" />
            <span>
              Sample inspection report. Select an assessment state above to preview how benign, suspicious, and malicious QR threats are reported.
            </span>
          </div>
        </div>

        {/* 3D Main Result Report Surface */}
        <div className="perspective-1000 py-2">
          <div
            ref={surfaceRef}
            key={activeSpecimenKey}
            style={{
              '--light-x': '50%',
              '--light-y': '50%',
              transformStyle: 'preserve-3d',
            }}
            className="relative rounded-2xl border border-white/[0.1] bg-zinc-900/50 backdrop-blur-xl p-6 sm:p-8 space-y-8 shadow-[inset_0_1px_0_rgba(255,255,255,0.08),0_20px_50px_rgba(0,0,0,0.5)] transition-shadow duration-300 hover:shadow-[inset_0_1px_0_rgba(255,255,255,0.12),0_25px_60px_rgba(0,0,0,0.6)] select-none motion-reduce:transition-none"
          >
            {/* Dynamic Specular Light Sheen */}
            <div
              className="pointer-events-none absolute inset-0 rounded-2xl opacity-60 transition-opacity duration-300 motion-reduce:hidden"
              style={{
                background:
                  'radial-gradient(550px circle at var(--light-x, 50%) var(--light-y, 50%), rgba(255, 255, 255, 0.04), transparent 70%)',
              }}
            />

            {/* 1. Final Risk Classification */}
            <div className="relative z-10 flex flex-col sm:flex-row sm:items-start justify-between gap-4 border-b border-zinc-800/80 pb-6">
              <div className="flex items-start gap-3.5">
                {renderIcon(specimen.classification)}
                <div>
                  <span className="text-[11px] font-mono uppercase tracking-wider text-zinc-500 block">
                    Threat Classification
                  </span>
                  <div className="mt-1 flex flex-wrap items-center gap-3">
                    <h3 className="text-2xl sm:text-3xl font-bold tracking-tight text-zinc-100">
                      {specimen.classification}
                    </h3>
                    {/* Hologram Iridescent Security Foil Badge */}
                    <span className={`hologram-foil inline-flex items-center gap-1.5 rounded-md border px-3 py-1 text-xs font-mono font-medium shadow-xs ${specimen.badgeClass}`}>
                      <span className="h-1.5 w-1.5 rounded-full bg-current animate-pulse" />
                      <span>Security Assessment</span>
                    </span>
                  </div>
                  <p className="mt-2.5 text-sm text-zinc-300 max-w-[65ch] leading-relaxed">
                    {specimen.summary}
                  </p>
                </div>
              </div>

              <div className="text-xs text-zinc-500 sm:text-right shrink-0">
                <span className="block text-zinc-400">Payload Type:</span>
                <span className="text-zinc-200 font-mono font-medium text-sm">{specimen.payloadType}</span>
              </div>
            </div>

            {/* 2. Decoded Destination (Treated as Untrusted Content) */}
            <div className="relative z-10 border-b border-zinc-800/80 pb-6">
              <div className="flex items-center justify-between gap-4 mb-2">
                <span className="text-xs font-medium uppercase tracking-wider text-zinc-400">
                  Decoded Destination (Untrusted Content)
                </span>
                <button
                  type="button"
                  onClick={handleCopy}
                  className="inline-flex items-center gap-1.5 rounded-md border border-zinc-800 bg-zinc-900/80 px-3 py-1.5 text-xs font-medium text-zinc-300 transition-all duration-150 ease-[cubic-bezier(0.23,1,0.32,1)] hover:border-zinc-700 hover:text-zinc-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500/60 focus-visible:ring-offset-2 focus-visible:ring-offset-zinc-950 active:scale-[0.97] motion-reduce:transition-none motion-reduce:transform-none"
                  aria-label="Copy decoded destination text"
                >
                  {copyFeedback ? (
                    <>
                      <Check size={14} weight="bold" className="text-emerald-400" />
                      <span className="text-emerald-400 font-medium">Copied</span>
                    </>
                  ) : (
                    <>
                      <Copy size={14} weight="regular" />
                      <span>Copy destination</span>
                    </>
                  )}
                </button>
              </div>

              {/* Non-clickable untrusted text display */}
              <div className="rounded-lg border border-zinc-800/90 bg-zinc-950/90 p-4 font-mono text-xs sm:text-sm text-zinc-300 break-all select-all shadow-inner">
                {specimen.destination}
              </div>

              {/* Destination Safety Notice */}
              <div className="mt-3 flex items-start gap-2 rounded-md border border-amber-500/20 bg-amber-500/5 px-3 py-2 text-xs text-amber-200/90">
                <Warning size={16} weight="regular" className="mt-0.5 shrink-0 text-amber-400" />
                <p>
                  Safety Notice: Do not open the destination until you have reviewed the assessment.
                </p>
              </div>
            </div>

            {/* 3. Analysis Signals (3D Tactile Module Grid) */}
            <div className="relative z-10 border-b border-zinc-800/80 pb-6">
              <h4 className="text-xs font-medium uppercase tracking-wider text-zinc-400 mb-4">
                Contributing Analysis Signals
              </h4>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                {/* Visual Pattern Signal */}
                <div className="rounded-xl border border-white/[0.08] bg-zinc-950/70 p-4.5 shadow-sm transition-all duration-200 ease-[cubic-bezier(0.23,1,0.32,1)] hover:-translate-y-0.5 hover:border-zinc-700/80">
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-xs font-mono text-zinc-500 flex items-center gap-1.5">
                      <Waveform size={14} className="text-emerald-400" />
                      <span>SIGNAL 01</span>
                    </span>
                    <span className="text-[10px] font-mono text-zinc-500">OPTICAL</span>
                  </div>
                  <span className="text-sm font-semibold text-zinc-100 block mb-2">
                    Visual Pattern Analysis
                  </span>
                  <p className="text-xs text-zinc-400 leading-relaxed">
                    {specimen.visualSignal}
                  </p>
                  {/* Micro telemetry meter */}
                  <div className="mt-4 pt-3 border-t border-zinc-800/80 flex items-center justify-between text-[10px] font-mono text-zinc-500">
                    <span>PATTERN STABILITY</span>
                    <span className="text-emerald-400 font-medium">{specimen.meterLabel}</span>
                  </div>
                </div>

                {/* URL Signal */}
                <div className="rounded-xl border border-white/[0.08] bg-zinc-950/70 p-4.5 shadow-sm transition-all duration-200 ease-[cubic-bezier(0.23,1,0.32,1)] hover:-translate-y-0.5 hover:border-zinc-700/80">
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-xs font-mono text-zinc-500 flex items-center gap-1.5">
                      <LinkSimple size={14} className="text-emerald-400" />
                      <span>SIGNAL 02</span>
                    </span>
                    <span className="text-[10px] font-mono text-zinc-500">ROUTING</span>
                  </div>
                  <span className="text-sm font-semibold text-zinc-100 block mb-2">
                    Destination Link Analysis
                  </span>
                  <p className="text-xs text-zinc-400 leading-relaxed">
                    {specimen.urlSignal}
                  </p>
                  {/* Micro telemetry meter */}
                  <div className="mt-4 pt-3 border-t border-zinc-800/80 flex items-center justify-between text-[10px] font-mono text-zinc-500">
                    <span>HOST REPUTATION</span>
                    <span className="text-emerald-400 font-medium">VERIFIED // TLS OK</span>
                  </div>
                </div>

                {/* Combined Risk Assessment */}
                <div className="rounded-xl border border-white/[0.08] bg-zinc-950/70 p-4.5 shadow-sm transition-all duration-200 ease-[cubic-bezier(0.23,1,0.32,1)] hover:-translate-y-0.5 hover:border-zinc-700/80">
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-xs font-mono text-zinc-500 flex items-center gap-1.5">
                      <Cpu size={14} className="text-emerald-400" />
                      <span>SIGNAL 03</span>
                    </span>
                    <span className="text-[10px] font-mono text-emerald-400">SYNTHESIS</span>
                  </div>
                  <span className="text-sm font-semibold text-zinc-100 block mb-2">
                    Combined Risk Assessment
                  </span>
                  <p className="text-xs text-zinc-400 leading-relaxed">
                    {specimen.fusionSignal}
                  </p>
                  {/* Micro telemetry meter */}
                  <div className="mt-4 pt-3 border-t border-zinc-800/80 flex items-center justify-between text-[10px] font-mono text-zinc-500">
                    <span>VERDICT CONFIDENCE</span>
                    <span className="text-emerald-400 font-medium">HIGH // DEFENSIVE</span>
                  </div>
                </div>
              </div>
            </div>

            {/* 4. "Why this assessment?" (Evidence Rationale) */}
            <div className="relative z-10">
              <h4 className="text-xs font-medium uppercase tracking-wider text-zinc-400 mb-2">
                Why this assessment?
              </h4>
              <p className="text-xs sm:text-sm text-zinc-300 leading-relaxed max-w-[70ch]">
                {specimen.explanation}
              </p>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
