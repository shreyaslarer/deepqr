import React from 'react';
import {
  QrCode,
  Scan,
  FileImage,
  LinkSimple,
  GitMerge,
  ShieldCheck,
  Warning,
  ShieldWarning,
  ArrowDown,
} from '@phosphor-icons/react';

/**
 * PipelineVisualization component for DeepQR Shield.
 *
 * Implements a conceptual, static architectural explanation of the defensive inspection pipeline:
 * - Stage 01: QR Image Input
 * - Stage 02: Detection and Decoding
 * - Stage 03: Parallel Dual-Branch Analysis (Visual Analysis & URL Analysis)
 * - Stage 04: Multimodal Fusion
 * - Stage 05: Risk Assessment (Taxonomy: SAFE, SUSPICIOUS, MALICIOUS)
 *
 * Important constraints:
 * - Neutral terminology: Uses "Visual Analysis" and "URL Analysis" without picking unconfirmed model types.
 * - Static technical connectors: Pure vector lines showing branching and reconvergence.
 * - Zero fabricated ML results or simulated runtime telemetry.
 * - Zero em-dashes or en-dashes throughout.
 */
export default function PipelineVisualization() {
  return (
    <section
      id="how-it-works"
      aria-labelledby="pipeline-heading"
      className="w-full border-b border-zinc-800/80 bg-zinc-950 py-16 sm:py-20 lg:py-24"
    >
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        {/* Section Header */}
        <div className="mx-auto max-w-2xl text-center mb-12 sm:mb-16">
          <h2
            id="pipeline-heading"
            className="text-2xl font-semibold tracking-tight text-zinc-100 sm:text-3xl"
          >
            Analysis Pipeline
          </h2>
          <p className="mt-3 text-sm text-zinc-400 sm:text-base leading-relaxed">
            Conceptual inspection workflow. Submitted QR codes are evaluated through independent visual and destination analysis paths before combined risk classification.
          </p>
        </div>

        {/* Pipeline Graph Container */}
        <div className="mx-auto max-w-2xl">
          {/* Stage 01: QR Image */}
          <div className="rounded-lg border border-zinc-800 bg-zinc-900/40 p-4 sm:p-5 transition-colors hover:border-zinc-700">
            <div className="flex items-center justify-between gap-3">
              <div className="flex items-center gap-3">
                <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-md border border-zinc-800 bg-zinc-900 text-zinc-300">
                  <QrCode size={18} weight="regular" />
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <span className="font-mono text-xs font-medium text-zinc-500">01</span>
                    <h3 className="text-sm sm:text-base font-semibold text-zinc-100">
                      QR Image Input
                    </h3>
                  </div>
                  <p className="mt-0.5 text-xs sm:text-sm text-zinc-400">
                    Input image containing the QR code for inspection.
                  </p>
                </div>
              </div>
            </div>
          </div>

          {/* Connector: 01 -> 02 */}
          <div className="flex justify-center py-2 sm:py-3" aria-hidden="true">
            <div className="flex flex-col items-center">
              <div className="h-6 w-px bg-zinc-800" />
              <ArrowDown size={14} weight="regular" className="text-zinc-600 -mt-1" />
            </div>
          </div>

          {/* Stage 02: Detection and Decoding */}
          <div className="rounded-lg border border-zinc-800 bg-zinc-900/40 p-4 sm:p-5 transition-colors hover:border-zinc-700">
            <div className="flex items-center justify-between gap-3">
              <div className="flex items-center gap-3">
                <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-md border border-zinc-800 bg-zinc-900 text-zinc-300">
                  <Scan size={18} weight="regular" />
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <span className="font-mono text-xs font-medium text-zinc-500">02</span>
                    <h3 className="text-sm sm:text-base font-semibold text-zinc-100">
                      Detection and Decoding
                    </h3>
                  </div>
                  <p className="mt-0.5 text-xs sm:text-sm text-zinc-400">
                    Locate the QR code matrix and decode its encoded payload destination.
                  </p>
                </div>
              </div>
            </div>
          </div>

          {/* Connector: 02 -> Dual Branches (Fork) */}
          {/* Desktop/Tablet Fork Connector */}
          <div className="hidden sm:flex justify-center py-2" aria-hidden="true">
            <svg width="100%" height="32" viewBox="0 0 400 32" fill="none" className="max-w-xl text-zinc-700">
              <line x1="200" y1="0" x2="200" y2="10" stroke="currentColor" strokeWidth="1.5" />
              <line x1="100" y1="10" x2="300" y2="10" stroke="currentColor" strokeWidth="1.5" />
              <line x1="100" y1="10" x2="100" y2="24" stroke="currentColor" strokeWidth="1.5" />
              <polygon points="96,24 104,24 100,30" fill="currentColor" />
              <line x1="300" y1="10" x2="300" y2="24" stroke="currentColor" strokeWidth="1.5" />
              <polygon points="296,24 304,24 300,30" fill="currentColor" />
            </svg>
          </div>
          {/* Mobile Linear Connector */}
          <div className="sm:hidden flex justify-center py-2" aria-hidden="true">
            <div className="flex flex-col items-center">
              <div className="h-5 w-px bg-zinc-800" />
              <ArrowDown size={14} weight="regular" className="text-zinc-600 -mt-1" />
            </div>
          </div>

          {/* Stage 03: Parallel Dual-Branch Analysis */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 sm:gap-6">
            {/* Branch 03A: Visual Analysis */}
            <div className="rounded-lg border border-zinc-800 bg-zinc-900/40 p-4 sm:p-5 transition-colors hover:border-zinc-700">
              <div className="flex items-start gap-3">
                <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-md border border-zinc-800 bg-zinc-900 text-zinc-300">
                  <FileImage size={18} weight="regular" />
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <span className="font-mono text-xs font-medium text-zinc-500">03A</span>
                    <h3 className="text-sm font-semibold text-zinc-100">
                      Visual Analysis
                    </h3>
                  </div>
                  <p className="mt-1 text-xs text-zinc-400 leading-relaxed">
                    Inspect visual patterns, grid alignment, and potential image tampering.
                  </p>
                </div>
              </div>
            </div>

            {/* Branch 03B: URL Analysis */}
            <div className="rounded-lg border border-zinc-800 bg-zinc-900/40 p-4 sm:p-5 transition-colors hover:border-zinc-700">
              <div className="flex items-start gap-3">
                <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-md border border-zinc-800 bg-zinc-900 text-zinc-300">
                  <LinkSimple size={18} weight="regular" />
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <span className="font-mono text-xs font-medium text-zinc-500">03B</span>
                    <h3 className="text-sm font-semibold text-zinc-100">
                      URL Analysis
                    </h3>
                  </div>
                  <p className="mt-1 text-xs text-zinc-400 leading-relaxed">
                    Assess the decoded destination for suspicious lexical and routing characteristics.
                  </p>
                </div>
              </div>
            </div>
          </div>

          {/* Connector: Dual Branches -> 04 (Merge) */}
          {/* Desktop/Tablet Merge Connector */}
          <div className="hidden sm:flex justify-center py-2" aria-hidden="true">
            <svg width="100%" height="32" viewBox="0 0 400 32" fill="none" className="max-w-xl text-zinc-700">
              <line x1="100" y1="0" x2="100" y2="14" stroke="currentColor" strokeWidth="1.5" />
              <line x1="300" y1="0" x2="300" y2="14" stroke="currentColor" strokeWidth="1.5" />
              <line x1="100" y1="14" x2="300" y2="14" stroke="currentColor" strokeWidth="1.5" />
              <line x1="200" y1="14" x2="200" y2="24" stroke="currentColor" strokeWidth="1.5" />
              <polygon points="196,24 204,24 200,30" fill="currentColor" />
            </svg>
          </div>
          {/* Mobile Linear Connector */}
          <div className="sm:hidden flex justify-center py-2" aria-hidden="true">
            <div className="flex flex-col items-center">
              <div className="h-5 w-px bg-zinc-800" />
              <ArrowDown size={14} weight="regular" className="text-zinc-600 -mt-1" />
            </div>
          </div>

          {/* Stage 04: Multimodal Fusion */}
          <div className="rounded-lg border border-zinc-800 bg-zinc-900/40 p-4 sm:p-5 transition-colors hover:border-zinc-700">
            <div className="flex items-center justify-between gap-3">
              <div className="flex items-center gap-3">
                <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-md border border-zinc-800 bg-zinc-900 text-emerald-400">
                  <GitMerge size={18} weight="regular" />
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <span className="font-mono text-xs font-medium text-zinc-500">04</span>
                    <h3 className="text-sm sm:text-base font-semibold text-zinc-100">
                      Multimodal Fusion
                    </h3>
                  </div>
                  <p className="mt-0.5 text-xs sm:text-sm text-zinc-400">
                    Combine independent signals from both visual and destination analyses.
                  </p>
                </div>
              </div>
            </div>
          </div>

          {/* Connector: 04 -> 05 */}
          <div className="flex justify-center py-2 sm:py-3" aria-hidden="true">
            <div className="flex flex-col items-center">
              <div className="h-6 w-px bg-zinc-800" />
              <ArrowDown size={14} weight="regular" className="text-zinc-600 -mt-1" />
            </div>
          </div>

          {/* Stage 05: Risk Assessment & Output Taxonomy */}
          <div className="rounded-lg border border-zinc-800 bg-zinc-900/40 p-5 sm:p-6 transition-colors hover:border-zinc-700">
            <div className="flex items-center gap-3">
              <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-md border border-zinc-800 bg-zinc-900 text-zinc-300">
                <ShieldCheck size={18} weight="regular" />
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <span className="font-mono text-xs font-medium text-zinc-500">05</span>
                  <h3 className="text-sm sm:text-base font-semibold text-zinc-100">
                    Risk Assessment
                  </h3>
                </div>
                <p className="mt-0.5 text-xs sm:text-sm text-zinc-400">
                  Produce a final risk classification into one of three defined output states.
                </p>
              </div>
            </div>

            {/* Output Risk Taxonomy Reference */}
            <div className="mt-5 border-t border-zinc-800/80 pt-4">
              <p className="text-xs font-medium text-zinc-400 mb-3">
                Classification Taxonomy:
              </p>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
                {/* State: SAFE */}
                <div className="flex items-center gap-2 rounded-md border border-emerald-500/20 bg-emerald-500/5 px-3 py-2 text-xs">
                  <ShieldCheck size={15} weight="fill" className="text-emerald-400 shrink-0" />
                  <div>
                    <span className="font-semibold text-emerald-400">SAFE</span>
                    <span className="text-zinc-400 text-[11px] block">Verified benign signals</span>
                  </div>
                </div>

                {/* State: SUSPICIOUS */}
                <div className="flex items-center gap-2 rounded-md border border-amber-500/20 bg-amber-500/5 px-3 py-2 text-xs">
                  <Warning size={15} weight="fill" className="text-amber-400 shrink-0" />
                  <div>
                    <span className="font-semibold text-amber-400">SUSPICIOUS</span>
                    <span className="text-zinc-400 text-[11px] block">Anomalies detected</span>
                  </div>
                </div>

                {/* State: MALICIOUS */}
                <div className="flex items-center gap-2 rounded-md border border-rose-500/20 bg-rose-500/5 px-3 py-2 text-xs">
                  <ShieldWarning size={15} weight="fill" className="text-rose-400 shrink-0" />
                  <div>
                    <span className="font-semibold text-rose-400">MALICIOUS</span>
                    <span className="text-zinc-400 text-[11px] block">Threat patterns confirmed</span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
