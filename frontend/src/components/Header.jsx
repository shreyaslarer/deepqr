import React, { useState, useEffect } from 'react';
import { QrCode, List, X } from '@phosphor-icons/react';

/**
 * Header component for DeepQR Shield.
 *
 * Implements a restrained, defensive-security research product navigation:
 * - Brand wordmark: DeepQR Shield with authentic typographic hierarchy (no monospace, no stock hacker icons).
 * - Tagline integration: "Check before you scan."
 * - Dedicated navigation: Analyze, How It Works, Research (no generic SaaS bloat).
 * - Single-accent color discipline (emerald tone, <80% saturation, no neon glow, no AI purple).
 * - Full accessibility: keyboard focus rings, aria attributes, reduced-motion compliance.
 * - Mobile navigation with clean toggle and minimum 44px touch targets.
 */
export default function Header({ activeSection = 'analyze', onNavigate }) {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  const navItems = [
    { id: 'analyze', label: 'Analyze' },
    { id: 'how-it-works', label: 'How It Works' },
    { id: 'research', label: 'Research' },
  ];

  const handleNavClick = (id) => {
    if (onNavigate) {
      onNavigate(id);
    }
    setMobileMenuOpen(false);
  };

  // Close mobile menu on Escape key
  useEffect(() => {
    const handleKeyDown = (e) => {
      if (e.key === 'Escape' && mobileMenuOpen) {
        setMobileMenuOpen(false);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [mobileMenuOpen]);

  return (
    <header className="sticky top-0 z-40 w-full border-b border-zinc-800/80 bg-zinc-950/95 backdrop-blur-sm">
      <div className="mx-auto flex h-16 max-w-7xl items-center justify-between px-4 sm:px-6 lg:px-8">
        {/* Brand Treatment */}
        <div className="flex items-center gap-3">
          <a
            href="#analyze"
            onClick={(e) => {
              e.preventDefault();
              handleNavClick('analyze');
            }}
            className="group flex items-center gap-2.5 rounded-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500/60 focus-visible:ring-offset-2 focus-visible:ring-offset-zinc-950"
            aria-label="DeepQR Shield home"
          >
            <div className="flex h-8 w-8 items-center justify-center rounded-md border border-zinc-800 bg-zinc-900/80 text-zinc-300 transition-colors duration-150 ease-[cubic-bezier(0.16,1,0.3,1)] group-hover:border-zinc-700 group-hover:text-zinc-100 motion-reduce:transition-none">
              <QrCode size={18} weight="regular" />
            </div>
            <div className="flex items-baseline gap-1.5">
              <span className="text-base font-semibold tracking-tight text-zinc-100">
                DeepQR
              </span>
              <span className="text-base font-normal tracking-tight text-zinc-400">
                Shield
              </span>
            </div>
          </a>

          {/* Tagline divider & context */}
          <div className="hidden h-4 w-px bg-zinc-800 sm:block" aria-hidden="true" />
          <span className="hidden text-xs font-normal text-zinc-400 select-none sm:inline-block">
            Check before you scan.
          </span>
        </div>

        {/* Desktop Navigation */}
        <nav
          className="hidden items-center gap-1 md:flex"
          aria-label="Primary navigation"
        >
          {navItems.map((item) => {
            const isActive = activeSection === item.id;
            return (
              <a
                key={item.id}
                href={`#${item.id}`}
                onClick={(e) => {
                  e.preventDefault();
                  handleNavClick(item.id);
                }}
                className={`relative rounded-md px-3 py-1.5 text-sm font-medium transition-colors duration-150 ease-[cubic-bezier(0.16,1,0.3,1)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500/60 focus-visible:ring-offset-2 focus-visible:ring-offset-zinc-950 active:scale-[0.98] motion-reduce:transition-none motion-reduce:transform-none ${
                  isActive
                    ? 'border border-zinc-800/80 bg-zinc-900/90 text-zinc-100 shadow-xs'
                    : 'text-zinc-400 hover:bg-zinc-900/40 hover:text-zinc-200'
                }`}
                aria-current={isActive ? 'page' : undefined}
              >
                {item.label}
              </a>
            );
          })}
        </nav>

        {/* Mobile Navigation Toggle */}
        <div className="flex items-center md:hidden">
          <button
            type="button"
            onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
            className="flex h-11 w-11 items-center justify-center rounded-md border border-zinc-800 bg-zinc-900/60 text-zinc-400 transition-colors duration-150 ease-[cubic-bezier(0.16,1,0.3,1)] hover:border-zinc-700 hover:text-zinc-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500/60 focus-visible:ring-offset-2 focus-visible:ring-offset-zinc-950 active:scale-[0.98] motion-reduce:transition-none motion-reduce:transform-none"
            aria-label={mobileMenuOpen ? 'Close navigation menu' : 'Open navigation menu'}
            aria-expanded={mobileMenuOpen}
          >
            {mobileMenuOpen ? (
              <X size={20} weight="regular" />
            ) : (
              <List size={20} weight="regular" />
            )}
          </button>
        </div>
      </div>

      {/* Mobile Navigation Drawer/Menu */}
      {mobileMenuOpen && (
        <div className="border-t border-zinc-800/80 bg-zinc-950/98 px-4 py-3 md:hidden">
          <nav className="flex flex-col gap-1" aria-label="Mobile navigation">
            {navItems.map((item) => {
              const isActive = activeSection === item.id;
              return (
                <a
                  key={item.id}
                  href={`#${item.id}`}
                  onClick={(e) => {
                    e.preventDefault();
                    handleNavClick(item.id);
                  }}
                  className={`flex h-11 items-center rounded-md px-3 text-sm font-medium transition-colors duration-150 ease-[cubic-bezier(0.16,1,0.3,1)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500/60 focus-visible:ring-offset-2 focus-visible:ring-offset-zinc-950 active:scale-[0.98] motion-reduce:transition-none motion-reduce:transform-none ${
                    isActive
                      ? 'border border-zinc-800/80 bg-zinc-900/90 text-zinc-100'
                      : 'text-zinc-400 hover:bg-zinc-900/40 hover:text-zinc-200'
                  }`}
                  aria-current={isActive ? 'page' : undefined}
                >
                  {item.label}
                </a>
              );
            })}
          </nav>
        </div>
      )}
    </header>
  );
}
