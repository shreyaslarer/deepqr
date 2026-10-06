import React, { useState } from 'react';
import {
  ShieldCheck,
  Warning,
  ShieldWarning,
  Copy,
  Check,
  Info,
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
    fusionSignal: 'Visual and destination signals both align with standard benign behavior.',
    explanation: 'The QR image exhibits standard matrix geometry with intact finder patterns, and the decoded destination uses standard domain structure without redirect anomalies or deceptive parameters.',
    badgeClass: 'text-emerald-400 bg-emerald-500/10 border-emerald-500/25',
    iconColor: 'text-emerald-400',
  },
  suspicious: {
    id: 'suspicious',
    classification: 'SUSPICIOUS',
    summary: 'Anomalies detected in the image structure or destination routing requiring caution.',
    destination: 'https://example-verify-portal.net/login?ref=sec',
    payloadType: 'URL',
    visualSignal: 'Non-standard matrix contrast, slight alignment variance near lower finder pattern.',
    urlSignal: 'High-entropy query parameters, unverified authentication routing keyword.',
    fusionSignal: 'Discrepancy detected between visual matrix anomalies and destination structure.',
    explanation: 'Visual inspection identified localized distortion, while the destination URL contains query parameters and routing patterns that warrant caution before interacting.',
    badgeClass: 'text-amber-400 bg-amber-500/10 border-amber-500/25',
    iconColor: 'text-amber-400',
  },
  malicious: {
    id: 'malicious',
    classification: 'MALICIOUS',
    summary: 'Multiple confirmed threat indicators identified across visual tampering and destination routing.',
    destination: 'http://192.0.2.148/account-update/session-reset',
    payloadType: 'URL',
    visualSignal: 'Obfuscated module overlay, tampered finder pattern boundaries detected.',
    urlSignal: 'Direct raw IP routing, insecure transport protocol, credential-harvesting endpoint pattern.',
    fusionSignal: 'Critical threat indicators confirmed across both visual matrix and URL routing.',
    explanation: 'The QR image displays visual tampering characteristics, and the decoded destination employs direct raw IP routing and deceptive account-update endpoints.',
    badgeClass: 'text-rose-400 bg-rose-500/10 border-rose-500/25',
    iconColor: 'text-rose-400',
  },
};

/**
 * RiskAssessmentResult component for DeepQR Shield.
 *
 * Implements a serious, inspection-grade result presentation layer:
 * - Visually supports all 3 final risk classifications: SAFE, SUSPICIOUS, MALICIOUS.
 * - Non-color-dependent communication (explicit text, distinct icons, semantic badges).
 * - Treats decoded destination strictly as UNTRUSTED content (non-clickable, no automatic navigation).
 * - Features raw destination copy action with clipboard feedback.
 * - Displays dual-modality analytical signals (Visual Analysis, URL Analysis, Fusion).
 * - Provides an evidence-based "Why this assessment?" section without marketing hype.
 * - Includes prominent destination safety notice.
 * - Uses controlled demonstration specimens to establish the visual design without faking live ML output.
 */
export default function RiskAssessmentResult() {
  const [activeSpecimenKey, setActiveSpecimenKey] = useState('safe');
  const [copyFeedback, setCopyFeedback] = useState(false);

  const specimen = DEMO_SPECIMENS[activeSpecimenKey];

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(specimen.destination);
      setCopyFeedback(true);
      setTimeout(() => setCopyFeedback(false), 2000);
    } catch {
      // Fallback if clipboard API is restricted
      setCopyFeedback(false);
    }
  };

  const renderIcon = (classification) => {
    switch (classification) {
      case 'SAFE':
        return <ShieldCheck size={28} weight="fill" className="text-emerald-400 shrink-0" />;
      case 'SUSPICIOUS':
        return <Warning size={28} weight="fill" className="text-amber-400 shrink-0" />;
      case 'MALICIOUS':
        return <ShieldWarning size={28} weight="fill" className="text-rose-400 shrink-0" />;
      default:
        return <Info size={28} weight="fill" className="text-zinc-400 shrink-0" />;
    }
  };

  return (
    <section
      id="results"
      aria-labelledby="results-heading"
      className="w-full border-b border-zinc-800/80 bg-zinc-950 py-16 sm:py-20 lg:py-24"
    >
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        {/* Section Header */}
        <div className="mb-8">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
            <div>
              <h2
                id="results-heading"
                className="text-2xl font-semibold tracking-tight text-zinc-100 sm:text-3xl"
              >
                Risk Assessment Report
              </h2>
              <p className="mt-2 text-sm text-zinc-400 sm:text-base">
                Inspection results synthesized across visual image characteristics and decoded destination analysis.
              </p>
            </div>

            {/* Specimen Inspection Controls (Clearly labeled for visual design verification) */}
            <div className="flex flex-wrap items-center gap-1.5 rounded-lg border border-zinc-800 bg-zinc-900/60 p-1">
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
                    className={`rounded-md px-2.5 py-1 text-xs font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500/60 ${
                      isSelected
                        ? 'border border-zinc-700 bg-zinc-800 text-zinc-100'
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

          {/* Honest Demonstration Notice */}
          <div className="mt-4 flex items-center gap-2 rounded-md border border-zinc-800/80 bg-zinc-900/30 px-3.5 py-2 text-xs text-zinc-400">
            <Info size={15} weight="regular" className="text-zinc-400 shrink-0" />
            <span>
              Demonstration specimen. This presentation layer displays static reference data. Live inference models will be integrated in subsequent phases.
            </span>
          </div>
        </div>

        {/* Main Result Report Surface */}
        <div className="rounded-xl border border-zinc-800 bg-zinc-900/40 p-6 sm:p-8 space-y-8">
          {/* 1. Final Risk Classification */}
          <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-4 border-b border-zinc-800/80 pb-6">
            <div className="flex items-start gap-3.5">
              {renderIcon(specimen.classification)}
              <div>
                <span className="text-xs font-medium uppercase tracking-wider text-zinc-500 block">
                  Threat Classification
                </span>
                <div className="mt-0.5 flex items-center gap-3">
                  <h3 className="text-2xl sm:text-3xl font-bold tracking-tight text-zinc-100">
                    {specimen.classification}
                  </h3>
                  <span className={`inline-flex items-center rounded-md border px-2.5 py-0.5 text-xs font-medium ${specimen.badgeClass}`}>
                    Verified Taxonomy State
                  </span>
                </div>
                <p className="mt-2 text-sm text-zinc-300 max-w-[65ch] leading-relaxed">
                  {specimen.summary}
                </p>
              </div>
            </div>

            <div className="text-xs text-zinc-500 font-mono sm:text-right shrink-0">
              <span className="block text-zinc-400 font-sans">Payload Type:</span>
              <span className="text-zinc-300 font-sans font-medium">{specimen.payloadType}</span>
            </div>
          </div>

          {/* 2. Decoded Destination (Treated as Untrusted Content) */}
          <div className="border-b border-zinc-800/80 pb-6">
            <div className="flex items-center justify-between gap-4 mb-2">
              <span className="text-xs font-medium uppercase tracking-wider text-zinc-400">
                Decoded Destination (Untrusted Content)
              </span>
              <button
                type="button"
                onClick={handleCopy}
                className="inline-flex items-center gap-1.5 rounded-md border border-zinc-800 bg-zinc-900/80 px-2.5 py-1 text-xs font-medium text-zinc-300 transition-colors hover:border-zinc-700 hover:text-zinc-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500/60"
                aria-label="Copy decoded destination text"
              >
                {copyFeedback ? (
                  <>
                    <Check size={14} weight="bold" className="text-emerald-400" />
                    <span className="text-emerald-400">Copied</span>
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
            <div className="rounded-md border border-zinc-800 bg-zinc-950 p-3.5 font-mono text-xs sm:text-sm text-zinc-300 break-all select-all">
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

          {/* 3. Analysis Signals (Multimodal Evidence) */}
          <div className="border-b border-zinc-800/80 pb-6">
            <h4 className="text-xs font-medium uppercase tracking-wider text-zinc-400 mb-4">
              Contributing Analysis Signals
            </h4>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              {/* Visual Signal */}
              <div className="rounded-lg border border-zinc-800 bg-zinc-950/60 p-4">
                <span className="text-xs font-mono text-zinc-500 block mb-1">SIGNAL 01</span>
                <span className="text-sm font-semibold text-zinc-200 block mb-1.5">Visual Analysis</span>
                <p className="text-xs text-zinc-400 leading-relaxed">
                  {specimen.visualSignal}
                </p>
              </div>

              {/* URL Signal */}
              <div className="rounded-lg border border-zinc-800 bg-zinc-950/60 p-4">
                <span className="text-xs font-mono text-zinc-500 block mb-1">SIGNAL 02</span>
                <span className="text-sm font-semibold text-zinc-200 block mb-1.5">URL Analysis</span>
                <p className="text-xs text-zinc-400 leading-relaxed">
                  {specimen.urlSignal}
                </p>
              </div>

              {/* Fusion Signal */}
              <div className="rounded-lg border border-zinc-800 bg-zinc-950/60 p-4">
                <span className="text-xs font-mono text-emerald-500/80 block mb-1">SYNTHESIS</span>
                <span className="text-sm font-semibold text-zinc-200 block mb-1.5">Multimodal Fusion</span>
                <p className="text-xs text-zinc-400 leading-relaxed">
                  {specimen.fusionSignal}
                </p>
              </div>
            </div>
          </div>

          {/* 4. "Why this assessment?" (Evidence Rationale) */}
          <div>
            <h4 className="text-xs font-medium uppercase tracking-wider text-zinc-400 mb-2">
              Why this assessment?
            </h4>
            <p className="text-xs sm:text-sm text-zinc-300 leading-relaxed max-w-[70ch]">
              {specimen.explanation}
            </p>
          </div>
        </div>
      </div>
    </section>
  );
}
