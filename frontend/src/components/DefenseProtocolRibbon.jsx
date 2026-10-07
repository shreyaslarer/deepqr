import React from 'react';
import { Shield, Eye, LockKey, Cpu } from '@phosphor-icons/react';

/**
 * DefenseProtocolRibbon component for DeepQR Shield.
 *
 * Implements a modern enterprise-grade security telemetry strip:
 * - Direct defensive specifications without marketing hyperbole.
 * - Restrained glass substrate with subtle divider ticks.
 * - Pulsing status LEDs indicating active defense protocols.
 * - Zero em-dashes and en-dashes throughout.
 */
export default function DefenseProtocolRibbon() {
  const protocols = [
    {
      icon: Eye,
      title: 'Visual Tamper Detection',
      desc: 'Inspects matrix regularity, finder boundaries, and physical overlays.',
      tag: 'ACTIVE // 24/7',
    },
    {
      icon: LockKey,
      title: 'Zero-Execution Quarantine',
      desc: 'Payloads decoded in isolated memory. Destination links never open.',
      tag: 'ISOLATED // SAFE',
    },
    {
      icon: Cpu,
      title: 'Synthesized Risk Signals',
      desc: 'Dual-modality assessment combining matrix geometry and link syntax.',
      tag: 'DUAL // SYNAPSE',
    },
    {
      icon: Shield,
      title: 'Real-Time Edge Evaluation',
      desc: 'Low-latency analytical verification before device interaction occurs.',
      tag: 'LATENCY // <15ms',
    },
  ];

  return (
    <section
      aria-label="Defensive Security Specifications"
      className="relative z-20 w-full border-b border-white/[0.08] bg-zinc-950/70 backdrop-blur-md"
    >
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 py-6">
        <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-4">
          {protocols.map((p, i) => {
            const Icon = p.icon;
            return (
              <div
                key={i}
                className="group relative flex flex-col justify-between rounded-xl border border-white/[0.06] bg-zinc-900/30 p-4 transition-all duration-200 ease-[cubic-bezier(0.23,1,0.32,1)] hover:border-zinc-700/80 hover:bg-zinc-900/50"
              >
                <div>
                  <div className="flex items-center justify-between mb-2.5">
                    <div className="flex h-7 w-7 items-center justify-center rounded-md border border-white/[0.08] bg-zinc-950/80 text-zinc-300 transition-colors group-hover:border-emerald-500/40 group-hover:text-emerald-400">
                      <Icon size={16} weight="regular" />
                    </div>
                    <span className="text-[10px] font-mono tracking-wider text-emerald-400/90 bg-emerald-950/40 px-2 py-0.5 rounded border border-emerald-500/20">
                      {p.tag}
                    </span>
                  </div>
                  <h3 className="text-xs font-semibold uppercase tracking-wider text-zinc-200">
                    {p.title}
                  </h3>
                  <p className="mt-1 text-xs text-zinc-400 leading-relaxed">
                    {p.desc}
                  </p>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </section>
  );
}
