import React from 'react';
import { BookOpen, WarningCircle, CheckCircle } from '@phosphor-icons/react';

/**
 * ResearchContext component for DeepQR Shield.
 *
 * Implements an editorial, grounded academic and scientific context section:
 * - Explains the research motivation behind QR phishing (quishing) defense.
 * - Highlights the multimodal hypothesis (combining image-level and destination-level evidence).
 * - Cites the foundational De Guzman et al. (2025) framework from project dataset materials.
 * - Adheres strictly to neutral model terminology (Visual Analysis, URL Analysis, Multimodal Fusion).
 * - Avoids unsupported benchmark numbers, fake charts, or exaggerated commercial claims.
 * - Features a responsible scientific limitations disclosure.
 * - Anchored cleanly at id="research" for direct header navigation.
 */
export default function ResearchContext() {
  return (
    <section
      id="research"
      aria-labelledby="research-heading"
      className="w-full bg-zinc-950 py-16 sm:py-20 lg:py-24"
    >
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        {/* Section Header */}
        <div className="mb-12 max-w-3xl">
          <span className="text-xs font-mono uppercase tracking-wider text-zinc-500">
            Academic Context
          </span>
          <h2
            id="research-heading"
            className="mt-2 text-2xl font-semibold tracking-tight text-zinc-100 sm:text-3xl"
          >
            Research and Methodology
          </h2>
          <p className="mt-3 text-sm text-zinc-400 sm:text-base leading-relaxed">
            DeepQR Shield is developed as a defensive academic research prototype studying multimodal detection of malicious QR codes and quishing attacks. Rather than relying solely on reactive browser filters, the prototype evaluates complementary visual and destination signals before the target link is opened.
          </p>
        </div>

        {/* Asymmetric Content Grid */}
        <div className="grid grid-cols-1 gap-12 lg:grid-cols-12 lg:gap-8">
          {/* Main Column: Core Methodology & Rationale */}
          <div className="space-y-8 lg:col-span-7">
            {/* 1. The Quishing Problem */}
            <div>
              <h3 className="text-base font-semibold text-zinc-200">
                The QR Phishing Vector
              </h3>
              <p className="mt-2 text-sm text-zinc-400 leading-relaxed">
                Quick Response codes inherently obscure their encoded payload from human inspection. Adversaries exploit this physical-to-digital gap by overlaying tampered codes in public environments or embedding obfuscated redirects within communications. Because destination URLs are rendered only after physical scanning, traditional perimeter defenses are frequently bypassed until the user has already navigated to the target.
              </p>
            </div>

            {/* 2. Multimodal Defensive Hypothesis */}
            <div>
              <h3 className="text-base font-semibold text-zinc-200">
                Multimodal Evidence Synthesis
              </h3>
              <p className="mt-2 text-sm text-zinc-400 leading-relaxed">
                A core premise of the research is that single-channel detection is susceptible to evasion. DeepQR Shield investigates combining two independent evidence sources before opening any destination:
              </p>

              <div className="mt-4 space-y-3">
                <div className="flex items-start gap-3.5 rounded-xl border border-white/[0.06] bg-zinc-900/30 p-4 transition-colors hover:border-zinc-700/80">
                  <CheckCircle size={18} weight="regular" className="mt-0.5 shrink-0 text-emerald-400" />
                  <div>
                    <span className="text-sm font-medium text-zinc-200 block">
                      Visual Analysis
                    </span>
                    <span className="text-xs text-zinc-400 mt-0.5 block leading-relaxed">
                      Evaluates physical image characteristics, identifying module irregularities, finder pattern distortion, and tampering patterns introduced during code alteration.
                    </span>
                  </div>
                </div>

                <div className="flex items-start gap-3.5 rounded-xl border border-white/[0.06] bg-zinc-900/30 p-4 transition-colors hover:border-zinc-700/80">
                  <CheckCircle size={18} weight="regular" className="mt-0.5 shrink-0 text-emerald-400" />
                  <div>
                    <span className="text-sm font-medium text-zinc-200 block">
                      URL Analysis
                    </span>
                    <span className="text-xs text-zinc-400 mt-0.5 block leading-relaxed">
                      Assesses the decoded payload for lexical anomalies, hostname structure, high-entropy query parameters, and deceptive routing indicators.
                    </span>
                  </div>
                </div>

                <div className="flex items-start gap-3.5 rounded-xl border border-white/[0.06] bg-zinc-900/30 p-4 transition-colors hover:border-zinc-700/80">
                  <CheckCircle size={18} weight="regular" className="mt-0.5 shrink-0 text-emerald-400" />
                  <div>
                    <span className="text-sm font-medium text-zinc-200 block">
                      Multimodal Fusion
                    </span>
                    <span className="text-xs text-zinc-400 mt-0.5 block leading-relaxed">
                      Fuses feature representations from both analytical streams into a combined decision layer to improve classification robustness against sophisticated evasion.
                    </span>
                  </div>
                </div>
              </div>
            </div>

            {/* 3. Evaluation Principles */}
            <div>
              <h3 className="text-base font-semibold text-zinc-200">
                Evaluation Methodology
              </h3>
              <p className="mt-2 text-sm text-zinc-400 leading-relaxed">
                The research methodology prioritizes leakage-aware data partitioning across distinct visual classes (benign, malicious, and tampered) alongside balanced destination datasets. Robustness testing focuses on real-world degradation, image noise, and adversarial variations to support reproducible academic validation.
              </p>
            </div>
          </div>

          {/* Sidebar Column: Reference Attribution & Responsible Limitations */}
          <div className="space-y-6 lg:col-span-5">
            {/* Academic Reference Card */}
            <div className="rounded-2xl border border-white/[0.08] bg-zinc-900/40 backdrop-blur-md p-6 shadow-[inset_0_1px_0_rgba(255,255,255,0.06),0_8px_32px_rgba(0,0,0,0.36)]">
              <div className="flex items-center gap-2 text-zinc-300">
                <BookOpen size={18} weight="regular" className="text-emerald-400" />
                <h3 className="text-xs font-semibold uppercase tracking-wider text-zinc-200">
                  Academic Reference
                </h3>
              </div>

              <div className="mt-4 border-l-2 border-zinc-700 pl-3.5 text-xs">
                <p className="font-semibold text-zinc-200 leading-snug">
                  A Machine Learning-based Framework for Detecting Suspicious QR Codes through Combined Image Analysis and URL Threat Assessment
                </p>
                <p className="mt-1 text-zinc-400">
                  G. A. De Guzman, J. J. Gatmin, J. E. Lumata, K. V. Pino (2025).
                </p>
              </div>

              <p className="mt-4 text-xs text-zinc-400 leading-relaxed">
                Foundational study investigating the combination of QR image processing and URL threat assessment for mobile cybersecurity safety systems.
              </p>
            </div>

            {/* Responsible Scientific Limitations Card */}
            <div className="rounded-2xl border border-white/[0.08] bg-zinc-900/40 backdrop-blur-md p-6 shadow-[inset_0_1px_0_rgba(255,255,255,0.06),0_8px_32px_rgba(0,0,0,0.36)]">
              <div className="flex items-center gap-2 text-zinc-300">
                <WarningCircle size={18} weight="regular" className="text-amber-400" />
                <h3 className="text-xs font-semibold uppercase tracking-wider text-zinc-200">
                  Research Limitations
                </h3>
              </div>

              <p className="mt-3 text-xs text-zinc-400 leading-relaxed">
                DeepQR Shield is an experimental research prototype. Statistical model predictions cannot guarantee that every analyzed QR code is safe or that all emerging evasion techniques will be caught. Risk assessments should be treated as informative defensive signals rather than absolute security guarantees.
              </p>

              <div className="mt-4 pt-3 border-t border-zinc-800/80 text-[11px] text-zinc-500 font-mono">
                Prototype Status: Academic Reference Implementation
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
