import React, { useState, useEffect } from 'react';
import { QrCode, List, X, SpeakerHigh, SpeakerSimpleSlash } from '@phosphor-icons/react';
import { sound } from '../utils/sound.js';

export default function Header({ activeSection = 'analyze', onNavigate }) {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [soundEnabled, setSoundEnabled] = useState(sound.isEnabled());

  const navItems = [
    { id: 'analyze', label: 'Analyze' },
    { id: 'results', label: 'Report' },
  ];

  const toggleSound = () => {
    const next = !soundEnabled;
    sound.setEnabled(next);
    setSoundEnabled(next);
    if (next) {
      sound.playClick();
    }
  };

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
    <header className="sticky top-0 z-40 w-full border-b border-white/[0.08] bg-zinc-950/75 backdrop-blur-xl shadow-[inset_0_-1px_0_rgba(255,255,255,0.04)]">
      <div className="mx-auto flex h-16 max-w-7xl items-center justify-between px-4 sm:px-6 lg:px-8">
        {/* Brand Treatment */}
        <div className="flex items-center gap-3">
          <a
            href="#analyze"
            onClick={(e) => {
              e.preventDefault();
              handleNavClick('analyze');
            }}
            className="group flex items-center gap-2.5 rounded-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500/60 focus-visible:ring-offset-2 focus-visible:ring-offset-zinc-950 active:scale-[0.97]"
            aria-label="DeepQR Shield home"
          >
            <div className="flex h-8 w-8 items-center justify-center rounded-md border border-white/[0.1] bg-zinc-900/90 text-zinc-300 shadow-[inset_0_1px_0_rgba(255,255,255,0.08)] transition-all duration-150 ease-[cubic-bezier(0.23,1,0.32,1)] group-hover:border-zinc-700 group-hover:text-emerald-400 motion-reduce:transition-none">
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

        {/* Desktop Navigation & Controls */}
        <div className="hidden items-center gap-2 md:flex">
          <nav
            className="flex items-center gap-1"
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
                    sound.playClick();
                    handleNavClick(item.id);
                  }}
                  className={`relative rounded-md px-3.5 py-1.5 text-sm font-medium transition-all duration-150 ease-[cubic-bezier(0.23,1,0.32,1)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500/60 focus-visible:ring-offset-2 focus-visible:ring-offset-zinc-950 active:scale-[0.97] motion-reduce:transition-none motion-reduce:transform-none ${
                    isActive
                      ? 'border border-white/[0.1] bg-zinc-900/90 text-zinc-100 shadow-[inset_0_1px_0_rgba(255,255,255,0.08),0_2px_8px_rgba(0,0,0,0.4)]'
                      : 'text-zinc-400 hover:bg-zinc-900/50 hover:text-zinc-200'
                  }`}
                  aria-current={isActive ? 'page' : undefined}
                >
                  {item.label}
                </a>
              );
            })}
          </nav>

          <div className="h-4 w-px bg-zinc-800 mx-1" aria-hidden="true" />

          {/* Synthesized Audio Feedback Toggle */}
          <button
            type="button"
            onClick={toggleSound}
            className="inline-flex items-center gap-1.5 rounded-md border border-white/[0.08] bg-zinc-900/60 px-2.5 py-1.5 text-xs font-mono transition-all duration-150 ease-[cubic-bezier(0.23,1,0.32,1)] hover:border-zinc-700 hover:bg-zinc-900/90 active:scale-[0.97] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500/60 focus-visible:ring-offset-2 focus-visible:ring-offset-zinc-950"
            aria-label={soundEnabled ? 'Disable interface audio' : 'Enable interface audio'}
            title={soundEnabled ? 'Mute audio feedback' : 'Enable tactile audio clicks'}
          >
            {soundEnabled ? (
              <>
                <SpeakerHigh size={14} weight="bold" className="text-emerald-400" />
                <span className="text-[11px] text-emerald-400 font-medium">AUDIO ON</span>
              </>
            ) : (
              <>
                <SpeakerSimpleSlash size={14} weight="regular" className="text-zinc-500" />
                <span className="text-[11px] text-zinc-500">AUDIO OFF</span>
              </>
            )}
          </button>
        </div>

        {/* Mobile Navigation Toggle (44x44px target) */}
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
        <div className="border-t border-white/[0.06] bg-zinc-950/98 backdrop-blur-md px-4 py-3 md:hidden">
          <nav className="flex flex-col gap-1" aria-label="Mobile navigation">
            {navItems.map((item) => {
              const isActive = activeSection === item.id;
              return (
                <a
                  key={item.id}
                  href={`#${item.id}`}
                  onClick={(e) => {
                    e.preventDefault();
                    sound.playClick();
                    handleNavClick(item.id);
                  }}
                  className={`flex h-11 items-center rounded-md px-3 text-sm font-medium transition-colors duration-150 ease-[cubic-bezier(0.16,1,0.3,1)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500/60 focus-visible:ring-offset-2 focus-visible:ring-offset-zinc-950 active:scale-[0.98] motion-reduce:transition-none motion-reduce:transform-none ${
                    isActive
                      ? 'border border-white/[0.08] bg-zinc-900/90 text-zinc-100'
                      : 'text-zinc-400 hover:bg-zinc-900/40 hover:text-zinc-200'
                  }`}
                  aria-current={isActive ? 'page' : undefined}
                >
                  {item.label}
                </a>
              );
            })}
            <div className="mt-2 pt-2 border-t border-zinc-800/80 flex items-center justify-between px-3">
              <span className="text-xs text-zinc-400">Tactile Audio</span>
              <button
                type="button"
                onClick={toggleSound}
                className="inline-flex items-center gap-1.5 rounded-md border border-white/[0.08] bg-zinc-900/60 px-2.5 py-1 text-xs font-mono text-zinc-300"
              >
                {soundEnabled ? 'AUDIO ON' : 'AUDIO OFF'}
              </button>
            </div>
          </nav>
        </div>
      )}
    </header>
  );
}
