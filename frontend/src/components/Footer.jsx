import React from 'react';
import { QrCode } from '@phosphor-icons/react';

/**
 * Footer component for DeepQR Shield.
 *
 * Implements a quiet, restrained footer terminating the research interface:
 * - Direct brand reinforcement: DeepQR Shield + "Check before you scan."
 * - Grounded research prototype positioning.
 * - Navigation restricted strictly to existing page anchors (#analyze, #how-it-works, #research).
 * - Zero multi-column SaaS bloat, zero newsletter forms, and zero fabricated social links.
 * - Full accessibility, keyboard focus states, and reduced-motion compliance.
 * - Zero em-dashes and en-dashes throughout.
 */
export default function Footer({ onNavigate }) {
  const navItems = [
    { id: 'analyze', label: 'Analyze' },
    { id: 'results', label: 'Report' },
  ];

  const handleNavClick = (e, id) => {
    e.preventDefault();
    if (onNavigate) {
      onNavigate(id);
    } else {
      const element = document.getElementById(id);
      if (element) {
        element.scrollIntoView({ behavior: 'smooth' });
      }
    }
  };

  return (
    <footer className="w-full border-t border-white/[0.06] bg-zinc-950 py-12 text-zinc-400">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <div className="flex flex-col gap-8 md:flex-row md:items-start md:justify-between">
          {/* Brand Identity & Research Context */}
          <div className="max-w-md">
            <div className="flex items-center gap-2.5">
              <div className="flex h-7 w-7 items-center justify-center rounded-md border border-white/[0.08] bg-zinc-900/80 text-zinc-300">
                <QrCode size={16} weight="regular" />
              </div>
              <div className="flex items-baseline gap-1.5">
                <span className="text-sm font-semibold tracking-tight text-zinc-100">
                  DeepQR
                </span>
                <span className="text-sm font-normal tracking-tight text-zinc-400">
                  Shield
                </span>
              </div>
            </div>

            <p className="mt-3 text-xs font-normal text-zinc-400">
              Check before you scan.
            </p>

            <p className="mt-2 text-xs text-zinc-500 leading-relaxed">
              Defensive security tool for QR threat analysis. Inspects visual patterns and destination routing before destination links are opened.
            </p>
          </div>

          {/* Navigation to Existing Sections Only */}
          <nav aria-label="Footer navigation" className="flex flex-wrap items-center gap-6 text-xs">
            {navItems.map((item) => (
              <a
                key={item.id}
                href={`#${item.id}`}
                onClick={(e) => handleNavClick(e, item.id)}
                className="rounded-md px-1 py-0.5 font-medium text-zinc-400 transition-colors duration-150 ease-[cubic-bezier(0.16,1,0.3,1)] hover:text-zinc-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500/60 focus-visible:ring-offset-2 focus-visible:ring-offset-zinc-950 motion-reduce:transition-none"
              >
                {item.label}
              </a>
            ))}
          </nav>
        </div>

        {/* Security & Prototype Notice */}
        <div className="mt-10 border-t border-zinc-900 pt-6 flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between text-[11px] text-zinc-600">
          <p>
            Defensive security inspection prototype. Automated indicators provide risk guidance and should be verified before opening sensitive links.
          </p>
          <p>
            DeepQR Shield Security Architecture.
          </p>
        </div>
      </div>
    </footer>
  );
}
