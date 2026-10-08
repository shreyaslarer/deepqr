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
  Scan,
} from '@phosphor-icons/react';
import { sound } from '../utils/sound.js';

/**
 * RiskAssessmentResult component for DeepQR Shield.
 *
 * Implements an inspection-grade 3D physical result report populated
 * strictly from live backend inference results:
 * - 3D Perspective card chassis with spring-damped pointer response.
 * - Dynamic security badge matching real classification (SAFE, SUSPICIOUS, MALICIOUS).
 * - Real neural signal breakdowns (Visual CNN, QR Decoder, URL CNN, Decision Fusion).
 * - Untrusted destination strictly quarantined (non-clickable plain text, copy-only).
 * - Decode failure handled with explicit "Visual Fallback Engaged" message.
 * - Non-URL payload handled with explicit "URL model not applicable" message.
 */
export default function RiskAssessmentResult({ result }) {
  const [copyFeedback, setCopyFeedback] = useState(false);
  const surfaceRef = useRef(null);

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
      targetRotX = -normY * 4;
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
  }, [result]);

  const handleCopy = async (text) => {
    if (!text) return;
    sound.playClick();
    try {
      await navigator.clipboard.writeText(text);
      setCopyFeedback(true);
      setTimeout(() => setCopyFeedback(false), 2000);
    } catch {
      setCopyFeedback(false);
    }
  };

  const renderIcon = (classification) => {
    switch (classification) {
      case 'SAFE':
        return <ShieldCheck size={36} weight="fill" className="text-emerald-400 shrink-0" />;
      case 'SUSPICIOUS':
        return <Warning size={36} weight="fill" className="text-amber-400 shrink-0" />;
      case 'MALICIOUS':
        return <ShieldWarning size={36} weight="fill" className="text-rose-400 shrink-0" />;
      default:
        return <Info size={36} weight="fill" className="text-zinc-400 shrink-0" />;
    }
  };

  const getClassificationTheme = (classification) => {
    switch (classification) {
      case 'SAFE':
        return {
          badgeClass: 'text-emerald-400 bg-emerald-500/10 border-emerald-500/30',
          meterClass: 'bg-emerald-400',
          textColor: 'text-emerald-400',
          summaryText: 'Verified benign characteristics identified across visual matrix inspection and destination analysis.',
        };
      case 'SUSPICIOUS':
        return {
          badgeClass: 'text-amber-400 bg-amber-500/10 border-amber-500/30',
          meterClass: 'bg-amber-400',
          textColor: 'text-amber-400',
          summaryText: 'Anomalies identified in physical image structure or destination routing requiring caution.',
        };
      case 'MALICIOUS':
        return {
          badgeClass: 'text-rose-400 bg-rose-500/10 border-rose-500/30',
          meterClass: 'bg-rose-400',
          textColor: 'text-rose-400',
          summaryText: 'Confirmed threat indicators identified across physical tampering or destination link patterns.',
        };
      default:
        return {
          badgeClass: 'text-zinc-400 bg-zinc-500/10 border-zinc-500/30',
          meterClass: 'bg-zinc-400',
          textColor: 'text-zinc-400',
          summaryText: 'Analysis pending.',
        };
    }
  };

  const buildExplanation = (r) => {
    if (!r) return '';
    const vClass = r.visual_class || 'unknown';
    const vScore = ((r.visual_malicious_score ?? 0) * 100).toFixed(1);

    if (r.url_model_used) {
      const uPred = r.url_prediction || 'unknown';
      const uScore = ((r.url_malicious_score ?? 0) * 100).toFixed(1);
      const fScore = (r.final_malicious_score ?? 0).toFixed(4);
      return `The visual CNN classified the QR pattern as '${vClass}' (threat score: ${vScore}%), while the character-level URL CNN classified the decoded link as '${uPred}' (threat score: ${uScore}%). Applying the baseline decision-level fusion rule (0.5 visual + 0.5 URL) yielded a combined malicious score of ${fScore}, producing a final security classification of ${r.final_class}.`;
    }

    if (r.qr_decoded && r.payload_type !== 'url') {
      return `The visual CNN classified the QR code as '${vClass}' (threat score: ${vScore}%). The payload was decoded successfully but represents non-URL data (${r.payload_type}). As designed, lexical URL classification was bypassed, and visual fallback rules determined the final security verdict of ${r.final_class}.`;
    }

    return `The OpenCV barcode detector was unable to decode an embedded payload from the image pixels. In accordance with the offline quishing defense protocol, visual decision fallback was engaged based on the ResNet18 visual prediction ('${vClass}'), yielding a final verdict of ${r.final_class}.`;
  };

  const theme = result ? getClassificationTheme(result.final_class) : null;

  return (
    <section
      id="results"
      aria-labelledby="results-heading"
      className="w-full bg-zinc-950/30 py-16 sm:py-20 lg:py-24"
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
              <p className="mt-2 text-sm text-zinc-300 sm:text-base leading-relaxed">
                Synthesis of physical QR image characteristics, offline OpenCV decoding, and character-level URL classification.
              </p>
            </div>

            {result && (
              <div className="flex items-center gap-2 rounded-lg border border-zinc-800 bg-zinc-900/80 px-3.5 py-1.5 font-mono text-xs text-zinc-300 self-start sm:self-end">
                <span className="text-zinc-500">Target:</span>
                <span className="text-zinc-200 truncate max-w-[200px]">
                  {result.image_path || 'QR Specimen'}
                </span>
              </div>
            )}
          </div>
        </div>

        {!result ? (
          /* Empty / Idle State */
          <div className="rounded-2xl border border-white/[0.08] bg-zinc-900/40 backdrop-blur-md p-12 text-center">
            <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-xl border border-zinc-800 bg-zinc-950 text-zinc-500">
              <Scan size={28} weight="regular" />
            </div>
            <h3 className="mt-4 text-base font-semibold text-zinc-200">
              Awaiting QR Code Upload
            </h3>
            <p className="mt-2 text-xs sm:text-sm text-zinc-400 max-w-md mx-auto leading-relaxed">
              Upload a QR code image above and click "Analyze QR code" to run dual-channel visual and lexical threat detection.
            </p>
          </div>
        ) : (
          /* Live Result Surface */
          <div className="perspective-1000 py-2">
            <div
              ref={surfaceRef}
              key={result.image_path || result.final_class}
              style={{
                '--light-x': '50%',
                '--light-y': '50%',
                transformStyle: 'preserve-3d',
              }}
              className="relative rounded-2xl border border-white/[0.12] bg-zinc-900/90 backdrop-blur-sm p-6 sm:p-8 space-y-8 shadow-[inset_0_1px_0_rgba(255,255,255,0.1),0_24px_64px_rgba(0,0,0,0.7)] transition-shadow duration-300 hover:shadow-[inset_0_1px_0_rgba(255,255,255,0.15),0_28px_70px_rgba(0,0,0,0.8)] select-none motion-reduce:transition-none"
            >
              {/* Dynamic Specular Sheen */}
              <div
                className="pointer-events-none absolute inset-0 rounded-2xl opacity-60 transition-opacity duration-300 motion-reduce:hidden"
                style={{
                  background:
                    'radial-gradient(550px circle at var(--light-x, 50%) var(--light-y, 50%), rgba(255, 255, 255, 0.04), transparent 70%)',
                }}
              />

              {/* 1. Final Risk Classification */}
              <div className="relative z-10 flex flex-col sm:flex-row sm:items-start justify-between gap-6 border-b border-zinc-800/80 pb-6">
                <div className="flex items-start gap-4">
                  {renderIcon(result.final_class)}
                  <div>
                    <span className="text-[11px] font-mono uppercase tracking-wider text-zinc-400 block">
                      Threat Classification
                    </span>
                    <div className="mt-1 flex flex-wrap items-center gap-3">
                      <h3 className="text-2xl sm:text-3xl font-bold tracking-tight text-zinc-100">
                        {result.final_class}
                      </h3>
                      <span
                        className={`hologram-foil inline-flex items-center gap-1.5 rounded-md border px-3 py-1 text-xs font-mono font-medium shadow-xs ${theme.badgeClass}`}
                      >
                        <span className="h-1.5 w-1.5 rounded-full bg-current animate-pulse" />
                        <span>Security Verdict</span>
                      </span>
                    </div>
                    <p className="mt-2.5 text-sm text-zinc-200 max-w-[65ch] leading-relaxed">
                      {theme.summaryText}
                    </p>
                  </div>
                </div>

                {/* Risk Score Telemetry Display */}
                <div className="rounded-xl border border-white/[0.08] bg-zinc-950/80 p-4 shrink-0 sm:text-right min-w-[170px]">
                  <span className="text-[10px] font-mono uppercase tracking-wider text-zinc-400 block">
                    Composite Risk Score
                  </span>
                  <div className="mt-1 flex items-baseline sm:justify-end gap-1.5">
                    <span className={`text-3xl font-mono font-bold ${theme.textColor}`}>
                      {result.risk_score}
                    </span>
                    <span className="text-xs font-mono text-zinc-500">/ 100</span>
                  </div>
                  <div className="mt-2 w-full bg-zinc-800 h-1.5 rounded-full overflow-hidden">
                    <div
                      className={`h-full ${theme.meterClass} transition-all duration-500`}
                      style={{ width: `${Math.min(100, Math.max(0, result.risk_score))}%` }}
                    />
                  </div>
                </div>
              </div>

              {/* 2. Decoded Destination (Quarantined String) */}
              <div className="relative z-10 border-b border-zinc-800/80 pb-6">
                <div className="flex items-center justify-between gap-4 mb-2">
                  <span className="text-xs font-medium uppercase tracking-wider text-zinc-300 flex items-center gap-2">
                    <span>Decoded Payload</span>
                    <span className="text-[10px] font-mono px-2 py-0.5 rounded border border-zinc-700 bg-zinc-800/80 text-zinc-300">
                      TYPE: {result.payload_type.toUpperCase()}
                    </span>
                  </span>

                  {result.qr_decoded && result.decoded_payload && (
                    <button
                      type="button"
                      onClick={() => handleCopy(result.decoded_payload)}
                      className="inline-flex items-center gap-1.5 rounded-md border border-zinc-700 bg-zinc-800 px-3 py-1.5 text-xs font-medium text-zinc-200 transition-all duration-150 ease-[cubic-bezier(0.23,1,0.32,1)] hover:border-zinc-600 hover:bg-zinc-700 hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500/60 focus-visible:ring-offset-2 focus-visible:ring-offset-zinc-950 active:scale-[0.97]"
                      aria-label="Copy decoded payload text"
                    >
                      {copyFeedback ? (
                        <>
                          <Check size={14} weight="bold" className="text-emerald-400" />
                          <span className="text-emerald-400 font-medium">Copied</span>
                        </>
                      ) : (
                        <>
                          <Copy size={14} weight="regular" />
                          <span>Copy payload</span>
                        </>
                      )}
                    </button>
                  )}
                </div>

                {/* Quarantined Non-Clickable Display */}
                {!result.qr_decoded ? (
                  <div className="rounded-lg border border-amber-500/30 bg-amber-500/10 p-4 text-xs sm:text-sm text-amber-200 space-y-1">
                    <p className="font-semibold text-amber-300">
                      QR Payload Could Not Be Decoded — Visual Fallback Engaged
                    </p>
                    <p className="text-amber-200/90 text-xs">
                      The barcode decoder found no readable data matrix. Decision is derived entirely from image pixel features. No external URL exists or was inferred.
                    </p>
                  </div>
                ) : (
                  <div className="rounded-lg border border-zinc-800 bg-zinc-950 p-4 font-mono text-xs sm:text-sm text-zinc-100 break-all select-all shadow-inner">
                    {/* Rendered as plain text string only */}
                    {result.decoded_payload}
                  </div>
                )}

                {/* Safety Quarantine Banner */}
                {result.qr_decoded && (
                  <div className="mt-3 flex items-start gap-2 rounded-md border border-amber-500/25 bg-amber-500/10 px-3 py-2 text-xs text-amber-200">
                    <Warning size={16} weight="regular" className="mt-0.5 shrink-0 text-amber-400" />
                    <p>
                      Safety Notice: Quarantined payload. Destination links are isolated and never opened or visited automatically.
                    </p>
                  </div>
                )}
              </div>

              {/* 3. Neural Analysis Signals (3D Tactile Module Grid) */}
              <div className="relative z-10 border-b border-zinc-800/80 pb-6">
                <h4 className="text-xs font-medium uppercase tracking-wider text-zinc-300 mb-4">
                  Contributing Analysis Signals
                </h4>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  {/* Signal 01: Visual CNN (ResNet18) */}
                  <div className="rounded-xl border border-white/[0.1] bg-zinc-950/90 p-5 shadow-md transition-all duration-200 hover:-translate-y-0.5 hover:border-zinc-700">
                    <div className="flex items-center justify-between mb-2">
                      <span className="text-xs font-mono text-zinc-400 flex items-center gap-1.5">
                        <Waveform size={14} className="text-emerald-400" />
                        <span>SIGNAL 01</span>
                      </span>
                      <span className="text-[10px] font-mono px-2 py-0.5 rounded border border-zinc-800 bg-zinc-900 text-zinc-300 uppercase">
                        {result.visual_class}
                      </span>
                    </div>
                    <span className="text-sm font-semibold text-zinc-100 block mb-1">
                      Visual Analysis (ResNet18)
                    </span>
                    <div className="mt-3 space-y-1.5 text-xs font-mono text-zinc-300">
                      <div className="flex justify-between">
                        <span className="text-zinc-500">Benign:</span>
                        <span>{((result.visual_probabilities?.benign ?? 0) * 100).toFixed(1)}%</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-zinc-500">Malicious:</span>
                        <span>{((result.visual_probabilities?.malicious ?? 0) * 100).toFixed(1)}%</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-zinc-500">Tampered:</span>
                        <span>{((result.visual_probabilities?.tampered ?? 0) * 100).toFixed(1)}%</span>
                      </div>
                    </div>
                    <div className="mt-4 pt-3 border-t border-zinc-800/80 flex items-center justify-between text-[10px] font-mono text-zinc-400">
                      <span>VISUAL THREAT</span>
                      <span className="text-emerald-400 font-medium">
                        {((result.visual_malicious_score ?? 0) * 100).toFixed(1)}%
                      </span>
                    </div>
                  </div>

                  {/* Signal 02: URL CNN (Character-Level 1D CNN) */}
                  <div className="rounded-xl border border-white/[0.1] bg-zinc-950/90 p-5 shadow-md transition-all duration-200 hover:-translate-y-0.5 hover:border-zinc-700">
                    <div className="flex items-center justify-between mb-2">
                      <span className="text-xs font-mono text-zinc-400 flex items-center gap-1.5">
                        <LinkSimple size={14} className="text-emerald-400" />
                        <span>SIGNAL 02</span>
                      </span>
                      <span className="text-[10px] font-mono px-2 py-0.5 rounded border border-zinc-800 bg-zinc-900 text-zinc-300 uppercase">
                        {result.url_model_used ? result.url_prediction : 'BYPASSED'}
                      </span>
                    </div>
                    <span className="text-sm font-semibold text-zinc-100 block mb-1">
                      URL Analysis (Char-CNN)
                    </span>
                    {result.url_model_used ? (
                      <div className="mt-3 space-y-1.5 text-xs font-mono text-zinc-300">
                        <div className="flex justify-between">
                          <span className="text-zinc-500">Benign:</span>
                          <span>{((result.url_probabilities?.benign ?? 0) * 100).toFixed(1)}%</span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-zinc-500">Malicious:</span>
                          <span>{((result.url_probabilities?.malicious ?? 0) * 100).toFixed(1)}%</span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-zinc-500">Prediction:</span>
                          <span className="uppercase text-emerald-400">{result.url_prediction}</span>
                        </div>
                      </div>
                    ) : (
                      <p className="mt-3 text-xs text-zinc-400 leading-relaxed">
                        {result.qr_decoded
                          ? 'Decoded content is non-URL text. URL neural classifier was not executed.'
                          : 'No QR payload decoded. URL model bypassed.'}
                      </p>
                    )}
                    <div className="mt-4 pt-3 border-t border-zinc-800/80 flex items-center justify-between text-[10px] font-mono text-zinc-400">
                      <span>URL THREAT</span>
                      <span className="text-emerald-400 font-medium">
                        {result.url_model_used
                          ? `${((result.url_malicious_score ?? 0) * 100).toFixed(1)}%`
                          : 'N/A (INACTIVE)'}
                      </span>
                    </div>
                  </div>

                  {/* Signal 03: Decision-Level Multimodal Fusion */}
                  <div className="rounded-xl border border-white/[0.1] bg-zinc-950/90 p-5 shadow-md transition-all duration-200 hover:-translate-y-0.5 hover:border-zinc-700">
                    <div className="flex items-center justify-between mb-2">
                      <span className="text-xs font-mono text-zinc-400 flex items-center gap-1.5">
                        <Cpu size={14} className="text-emerald-400" />
                        <span>SIGNAL 03</span>
                      </span>
                      <span className="text-[10px] font-mono px-2 py-0.5 rounded border border-zinc-800 bg-zinc-900 text-zinc-300 uppercase">
                        FUSION RULE
                      </span>
                    </div>
                    <span className="text-sm font-semibold text-zinc-100 block mb-1">
                      Combined Risk Assessment
                    </span>
                    <div className="mt-3 space-y-1.5 text-xs font-mono text-zinc-300">
                      <div className="flex justify-between">
                        <span className="text-zinc-500">Mode:</span>
                        <span>{result.url_model_used ? '0.5 Vis + 0.5 URL' : 'Visual Fallback'}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-zinc-500">Fused Score:</span>
                        <span>{(result.final_malicious_score ?? 0).toFixed(4)}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-zinc-500">Verdict:</span>
                        <span className={`font-bold ${theme.textColor}`}>{result.final_class}</span>
                      </div>
                    </div>
                    <div className="mt-4 pt-3 border-t border-zinc-800/80 flex items-center justify-between text-[10px] font-mono text-zinc-400">
                      <span>VERDICT CONFIDENCE</span>
                      <span className="text-emerald-400 font-medium">
                        SCORE: {result.risk_score} / 100
                      </span>
                    </div>
                  </div>
                </div>
              </div>

              {/* 4. "Why this assessment?" (Dynamic Evidence Rationale) */}
              <div className="relative z-10">
                <h4 className="text-xs font-medium uppercase tracking-wider text-zinc-300 mb-2">
                  Why this assessment?
                </h4>
                <p className="text-xs sm:text-sm text-zinc-200 leading-relaxed max-w-[75ch]">
                  {buildExplanation(result)}
                </p>
              </div>
            </div>
          </div>
        )}
      </div>
    </section>
  );
}
