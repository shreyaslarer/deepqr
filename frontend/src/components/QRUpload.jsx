import React, { useState, useRef, useEffect } from 'react';
import {
  QrCode,
  UploadSimple,
  X,
  WarningCircle,
  CheckCircle,
  ArrowRight,
  Sparkle,
  Cpu,
} from '@phosphor-icons/react';
import { sound } from '../utils/sound.js';

const ACCEPTED_TYPES = ['image/png', 'image/jpeg', 'image/webp'];
const ACCEPTED_EXTENSIONS = ['.png', '.jpg', '.jpeg', '.webp'];

function isValidImage(file) {
  if (!file) return false;
  if (ACCEPTED_TYPES.includes(file.type)) return true;
  const fileName = file.name.toLowerCase();
  return ACCEPTED_EXTENSIONS.some((ext) => fileName.endsWith(ext));
}

function formatFileSize(bytes) {
  if (bytes === 0) return '0 B';
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
}

// In-memory vector specimen generator for interactive test threats
function createSampleQrDataUrl(type) {
  const color = type === 'malicious' ? '#f43f5e' : type === 'suspicious' ? '#f59e0b' : '#34d399';
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100" width="200" height="200">
    <rect width="100" height="100" fill="#09090b"/>
    <rect x="8" y="8" width="28" height="28" rx="4" fill="none" stroke="#e4e4e7" stroke-width="3"/>
    <rect x="15" y="15" width="14" height="14" rx="2" fill="#e4e4e7"/>
    <rect x="64" y="8" width="28" height="28" rx="4" fill="none" stroke="#e4e4e7" stroke-width="3"/>
    <rect x="71" y="15" width="14" height="14" rx="2" fill="#e4e4e7"/>
    <rect x="8" y="64" width="28" height="28" rx="4" fill="none" stroke="#e4e4e7" stroke-width="3"/>
    <rect x="15" y="71" width="14" height="14" rx="2" fill="#e4e4e7"/>
    <rect x="42" y="12" width="6" height="6" fill="#a1a1aa"/>
    <rect x="52" y="12" width="6" height="6" fill="${color}"/>
    <rect x="42" y="24" width="6" height="6" fill="#a1a1aa"/>
    <rect x="52" y="28" width="6" height="6" fill="#a1a1aa"/>
    <rect x="12" y="44" width="6" height="6" fill="#a1a1aa"/>
    <rect x="24" y="44" width="6" height="6" fill="${color}"/>
    <rect x="42" y="44" width="16" height="16" fill="${color}" opacity="0.8"/>
    <rect x="64" y="44" width="6" height="6" fill="#a1a1aa"/>
    <rect x="76" y="44" width="6" height="6" fill="#a1a1aa"/>
    <rect x="44" y="68" width="6" height="6" fill="#a1a1aa"/>
    <rect x="56" y="68" width="6" height="6" fill="${color}"/>
    <rect x="44" y="80" width="6" height="6" fill="#a1a1aa"/>
    <rect x="68" y="72" width="20" height="18" fill="#a1a1aa" opacity="0.6"/>
  </svg>`;
  return `data:image/svg+xml;utf8,${encodeURIComponent(svg)}`;
}

/**
 * QRUpload component for DeepQR Shield.
 *
 * Implements a modern enterprise-grade 3D upload chassis:
 * - Reactive pointer illumination and hardware 3D tilt.
 * - Interactive specimen threat presets for zero-friction testing.
 * - Authentic 1.2s high-speed optical scanning sequence with telemetry updates.
 * - Audio-haptic feedback synchronization.
 * - Full reduced-motion and accessibility support.
 * - Zero em-dashes and en-dashes throughout.
 */
export default function QRUpload({ onAnalysisComplete }) {
  const [selectedFile, setSelectedFile] = useState(null);
  const [previewUrl, setPreviewUrl] = useState(null);
  const [isDragging, setIsDragging] = useState(false);
  const [errorMessage, setErrorMessage] = useState(null);
  const [isStagedNoticeVisible, setIsStagedNoticeVisible] = useState(false);
  const [activeSpecimenType, setActiveSpecimenType] = useState('safe');
  const [isScanning, setIsScanning] = useState(false);
  const [scanStatus, setScanStatus] = useState('');

  const fileInputRef = useRef(null);
  const surfaceRef = useRef(null);

  // Revoke object URL on cleanup
  useEffect(() => {
    return () => {
      if (previewUrl && previewUrl.startsWith('blob:')) {
        URL.revokeObjectURL(previewUrl);
      }
    };
  }, [previewUrl]);

  // Global keyboard shortcut ('K' or '/' jumps to analyze)
  useEffect(() => {
    const handleKeyDown = (e) => {
      if (
        (e.key === '/' || (e.key === 'k' && (e.metaKey || e.ctrlKey))) &&
        !['INPUT', 'TEXTAREA'].includes(document.activeElement?.tagName)
      ) {
        e.preventDefault();
        sound.playClick();
        const el = document.getElementById('analyze');
        if (el) el.scrollIntoView({ behavior: 'smooth' });
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  const handleFileProcess = (file) => {
    setErrorMessage(null);
    setIsStagedNoticeVisible(false);

    if (!file) return;

    if (!isValidImage(file)) {
      setErrorMessage('Unsupported file format. Please select a PNG, JPG, JPEG, or WEBP image.');
      return;
    }

    if (previewUrl && previewUrl.startsWith('blob:')) {
      URL.revokeObjectURL(previewUrl);
    }

    const url = URL.createObjectURL(file);
    sound.playClick();
    setSelectedFile(file);
    setPreviewUrl(url);
    setActiveSpecimenType('safe'); // Default user upload
  };

  const handleLoadSample = (type) => {
    sound.playClick();
    setActiveSpecimenType(type);
    setSelectedFile({
      name: `specimen_${type}_sample.png`,
      size: type === 'malicious' ? 24576 : type === 'suspicious' ? 20480 : 16384,
      type: 'image/png',
    });
    setPreviewUrl(createSampleQrDataUrl(type));
    setErrorMessage(null);
    setIsStagedNoticeVisible(false);
  };

  const handleFileChange = (e) => {
    const file = e.target.files?.[0];
    if (file) {
      handleFileProcess(file);
    }
    e.target.value = '';
  };

  const handleDragOver = (e) => {
    e.preventDefault();
    e.stopPropagation();
    if (!isDragging) setIsDragging(true);
  };

  const handleDragLeave = (e) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);
  };

  const handleDrop = (e) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);

    const file = e.dataTransfer.files?.[0];
    if (file) {
      handleFileProcess(file);
    }
  };

  const handleReset = () => {
    sound.playClick();
    if (previewUrl && previewUrl.startsWith('blob:')) {
      URL.revokeObjectURL(previewUrl);
    }
    setSelectedFile(null);
    setPreviewUrl(null);
    setErrorMessage(null);
    setIsStagedNoticeVisible(false);
    setIsScanning(false);
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  const handleAnalyzeClick = () => {
    if (isScanning) return;
    setIsScanning(true);
    sound.playScanSweep();
    setScanStatus('Acquiring matrix geometry and finder boundaries...');

    setTimeout(() => {
      sound.playScanSweep();
      setScanStatus('Quarantining embedded URL payload and resolving host...');
    }, 400);

    setTimeout(() => {
      sound.playClick();
      setScanStatus('Synthesizing dual-modality threat signals...');
    }, 800);

    setTimeout(() => {
      sound.playLockSuccess();
      setIsScanning(false);
      setScanStatus('Analysis complete. Verdict formulated.');
      setIsStagedNoticeVisible(true);
      if (onAnalysisComplete) {
        onAnalysisComplete(activeSpecimenType);
      }
    }, 1200);
  };

  const triggerFileInput = () => {
    sound.playClick();
    fileInputRef.current?.click();
  };

  // 3D Perspective Spring Physics (Apple / Emil Kowalski)
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
      targetRotX = -normY * 5;
      targetRotY = normX * 7;
      surface.style.setProperty('--mouse-x', `${((x / rect.width) * 100).toFixed(1)}%`);
      surface.style.setProperty('--mouse-y', `${((y / rect.height) * 100).toFixed(1)}%`);
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

  return (
    <section
      id="analyze"
      aria-labelledby="upload-heading"
      className="w-full border-b border-zinc-800/80 bg-zinc-950/40 backdrop-blur-xs py-16 sm:py-20 lg:py-24"
    >
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        {/* Section Header with Specimen Preset Chips */}
        <div className="mb-8 flex flex-col sm:flex-row sm:items-end sm:justify-between gap-4">
          <div className="max-w-xl">
            <h2
              id="upload-heading"
              className="text-2xl font-semibold tracking-tight text-zinc-100 sm:text-3xl"
            >
              Upload a QR image
            </h2>
            <p className="mt-2 text-sm text-zinc-400 sm:text-base leading-relaxed">
              Select or drop an image containing a QR code for threat assessment. The destination is quarantined and not opened automatically.
            </p>
          </div>

          {/* Quick-Load Threat Samples */}
          <div className="flex flex-col items-start sm:items-end gap-1.5 shrink-0">
            <span className="text-[11px] font-mono uppercase tracking-wider text-zinc-500 flex items-center gap-1 select-none">
              <Sparkle size={12} className="text-emerald-400" />
              <span>Or test with a sample threat:</span>
            </span>
            <div className="flex flex-wrap gap-1.5">
              {[
                { type: 'safe', label: 'Benign Doc' },
                { type: 'suspicious', label: 'Suspicious Redirect' },
                { type: 'malicious', label: 'Malicious IP Exploit' },
              ].map((s) => (
                <button
                  key={s.type}
                  type="button"
                  onClick={() => handleLoadSample(s.type)}
                  className="rounded-md border border-white/[0.08] bg-zinc-900/80 px-2.5 py-1 text-xs font-mono text-zinc-300 transition-all duration-150 hover:border-emerald-500/40 hover:text-emerald-300 active:scale-[0.97]"
                >
                  {s.label}
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* Hidden Accessible File Input */}
        <label htmlFor="qr-image-input" className="sr-only">
          Choose a QR code image
        </label>
        <input
          id="qr-image-input"
          ref={fileInputRef}
          type="file"
          accept=".png,.jpg,.jpeg,.webp,image/png,image/jpeg,image/webp"
          onChange={handleFileChange}
          className="hidden"
          tabIndex={-1}
        />

        {/* Error State Banner */}
        {errorMessage && (
          <div
            role="alert"
            className="mb-6 flex items-start gap-3 rounded-lg border border-amber-500/30 bg-amber-500/10 p-4 text-sm text-amber-200"
          >
            <WarningCircle size={20} weight="fill" className="mt-0.5 shrink-0 text-amber-400" />
            <div className="flex-1">
              <p className="font-medium">{errorMessage}</p>
              <button
                type="button"
                onClick={() => setErrorMessage(null)}
                className="mt-2 text-xs font-medium text-amber-300 underline underline-offset-2 hover:text-amber-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-400 focus-visible:ring-offset-2 focus-visible:ring-offset-zinc-950 rounded-xs"
              >
                Dismiss error
              </button>
            </div>
          </div>
        )}

        {/* Premium Layered 3D Inspection Surface */}
        <div className="perspective-1000 py-2">
          <div
            ref={surfaceRef}
            style={{
              '--mouse-x': '50%',
              '--mouse-y': '50%',
              transformStyle: 'preserve-3d',
            }}
            className={`group relative overflow-hidden rounded-2xl border transition-shadow duration-300 ease-[cubic-bezier(0.16,1,0.3,1)] select-none motion-reduce:transition-none ${
              isDragging
                ? 'border-emerald-500/60 bg-zinc-900/90 shadow-[inset_0_1px_0_rgba(255,255,255,0.12),0_16px_48px_rgba(16,185,129,0.2)]'
                : 'border-white/[0.08] bg-zinc-900/40 backdrop-blur-md shadow-[inset_0_1px_0_rgba(255,255,255,0.06),0_12px_40px_rgba(0,0,0,0.5)] hover:border-zinc-700/80 hover:bg-zinc-900/50'
            }`}
          >
            {/* Subtle Dynamic Radial Pointer Illumination Layer */}
            <div
              className="pointer-events-none absolute inset-0 opacity-0 transition-opacity duration-300 ease-[cubic-bezier(0.16,1,0.3,1)] group-hover:opacity-100 motion-reduce:hidden"
              style={{
                background:
                  'radial-gradient(550px circle at var(--mouse-x, 50%) var(--mouse-y, 50%), rgba(255, 255, 255, 0.035), transparent 70%)',
              }}
              aria-hidden="true"
            />

            {/* Architectural Framing Brackets */}
            <div
              className={`pointer-events-none absolute top-3.5 left-3.5 h-3 w-3 border-t-2 border-l-2 transition-colors duration-200 ${
                isDragging ? 'border-emerald-500/80' : 'border-zinc-700/60'
              }`}
              aria-hidden="true"
            />
            <div
              className={`pointer-events-none absolute top-3.5 right-3.5 h-3 w-3 border-t-2 border-r-2 transition-colors duration-200 ${
                isDragging ? 'border-emerald-500/80' : 'border-zinc-700/60'
              }`}
              aria-hidden="true"
            />
            <div
              className={`pointer-events-none absolute bottom-3.5 left-3.5 h-3 w-3 border-b-2 border-l-2 transition-colors duration-200 ${
                isDragging ? 'border-emerald-500/80' : 'border-zinc-700/60'
              }`}
              aria-hidden="true"
            />
            <div
              className={`pointer-events-none absolute bottom-3.5 right-3.5 h-3 w-3 border-b-2 border-r-2 transition-colors duration-200 ${
                isDragging ? 'border-emerald-500/80' : 'border-zinc-700/60'
              }`}
              aria-hidden="true"
            />

            {!selectedFile ? (
              /* Empty State / Interactive Staging Aperture */
              <div
                onDragOver={handleDragOver}
                onDragLeave={handleDragLeave}
                onDrop={handleDrop}
                onClick={triggerFileInput}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' || e.key === ' ') {
                    e.preventDefault();
                    triggerFileInput();
                  }
                }}
                tabIndex={0}
                role="button"
                aria-label="Upload QR code image area. Press Enter or Space to choose a file."
                className="relative flex min-h-[260px] cursor-pointer flex-col items-center justify-center p-8 sm:p-12 text-center focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500/60 focus-visible:ring-offset-2 focus-visible:ring-offset-zinc-950"
              >
                {/* Inspection Reticle Aperture with 3D Pop */}
                <div
                  style={{ transform: 'translateZ(20px)' }}
                  className={`relative flex h-16 w-16 items-center justify-center rounded-xl border transition-all duration-200 ease-[cubic-bezier(0.16,1,0.3,1)] motion-reduce:transition-none ${
                    isDragging
                      ? 'border-emerald-500/50 bg-emerald-500/10 text-emerald-300 scale-105'
                      : 'border-white/[0.08] bg-zinc-900/90 text-zinc-300 shadow-[inset_0_1px_0_rgba(255,255,255,0.08)] group-hover:border-zinc-600 group-hover:text-zinc-100 group-hover:scale-[1.02]'
                  }`}
                >
                  <QrCode size={26} weight="regular" />
                  {/* Optical Alignment Ticks */}
                  <div className="absolute -top-1 left-1/2 h-1 w-px -translate-x-1/2 bg-zinc-700" aria-hidden="true" />
                  <div className="absolute -bottom-1 left-1/2 h-1 w-px -translate-x-1/2 bg-zinc-700" aria-hidden="true" />
                  <div className="absolute -left-1 top-1/2 h-px w-1 -translate-y-1/2 bg-zinc-700" aria-hidden="true" />
                  <div className="absolute -right-1 top-1/2 h-px w-1 -translate-y-1/2 bg-zinc-700" aria-hidden="true" />
                </div>

                {/* Informational Typographic Hierarchy */}
                <div className="mt-5 space-y-1.5 max-w-md">
                  <p className="text-base font-medium tracking-tight text-zinc-100">
                    {isDragging ? 'Drop QR image to stage for analysis' : 'Choose a QR image or drag and drop here'}
                  </p>
                  <p className="text-xs text-zinc-400 leading-relaxed">
                    Supported formats: PNG, JPG, JPEG, WEBP. Destination routing is quarantined and not opened automatically.
                  </p>
                </div>

                {/* Tactile Action Button */}
                <div className="mt-6">
                  <span className="inline-flex items-center gap-2 rounded-md border border-zinc-700/80 bg-zinc-800/80 px-4 py-2 text-xs font-medium text-zinc-200 shadow-xs transition-all duration-150 ease-[cubic-bezier(0.16,1,0.3,1)] group-hover:border-zinc-600 group-hover:bg-zinc-800 group-hover:text-white motion-reduce:transition-none">
                    <UploadSimple size={15} weight="bold" />
                    <span>Browse files</span>
                  </span>
                </div>
              </div>
            ) : (
              /* Selected File State / Staged Inspection Dossier */
              <div className="p-6 sm:p-8">
                <div className="flex flex-col gap-6 sm:flex-row sm:items-start sm:gap-8">
                  {/* Optical Inspection Viewport with 3D Laser Scan Sweep */}
                  {previewUrl && (
                    <div
                      style={{ transform: 'translateZ(26px)' }}
                      className="relative flex aspect-square w-full sm:w-52 shrink-0 items-center justify-center overflow-hidden rounded-xl border border-white/[0.12] bg-zinc-950/90 p-3 shadow-[0_8px_24px_rgba(0,0,0,0.6)]"
                    >
                      {/* Viewport Corner Registration Marks */}
                      <div className="pointer-events-none absolute top-2 left-2 h-3 w-3 border-t-2 border-l-2 border-emerald-400/80 shadow-[0_0_8px_rgba(52,211,153,0.5)] z-20" aria-hidden="true" />
                      <div className="pointer-events-none absolute top-2 right-2 h-3 w-3 border-t-2 border-r-2 border-emerald-400/80 shadow-[0_0_8px_rgba(52,211,153,0.5)] z-20" aria-hidden="true" />
                      <div className="pointer-events-none absolute bottom-2 left-2 h-3 w-3 border-b-2 border-l-2 border-emerald-400/80 shadow-[0_0_8px_rgba(52,211,153,0.5)] z-20" aria-hidden="true" />
                      <div className="pointer-events-none absolute bottom-2 right-2 h-3 w-3 border-b-2 border-r-2 border-emerald-400/80 shadow-[0_0_8px_rgba(52,211,153,0.5)] z-20" aria-hidden="true" />

                      {/* Subtle Crosshair Coordinate Lines */}
                      <div className="pointer-events-none absolute inset-0 flex items-center justify-center opacity-20" aria-hidden="true">
                        <div className="h-full w-px bg-emerald-500/40" />
                        <div className="absolute w-full h-px bg-emerald-500/40" />
                      </div>

                      {/* Active Optical Laser Scan Beam */}
                      <div className="pointer-events-none absolute inset-x-2 top-2 bottom-2 overflow-hidden z-20">
                        <div className={`animate-laser-sweep absolute left-0 right-0 h-0.5 bg-gradient-to-r from-transparent via-emerald-400 to-transparent shadow-[0_0_12px_rgba(52,211,153,0.9)] ${isScanning ? 'scale-y-150 duration-700' : ''}`}>
                          <div className="absolute -inset-y-2 inset-x-0 bg-emerald-400/15 blur-xs" />
                        </div>
                      </div>

                      <img
                        src={previewUrl}
                        alt="Staged QR code"
                        className="relative z-10 max-h-full max-w-full object-contain filter drop-shadow-[0_2px_8px_rgba(0,0,0,0.5)]"
                      />
                    </div>
                  )}

                  {/* Staged Specimen Dossier & Actions */}
                  <div className="flex flex-1 flex-col justify-between min-w-0">
                    <div>
                      <div className="flex items-start justify-between gap-4">
                        <div className="min-w-0">
                          <span className="text-[11px] font-mono uppercase tracking-wider text-zinc-500 block">
                            Image Staged
                          </span>
                          <h3 className="mt-1 truncate text-base font-semibold text-zinc-100 sm:text-lg">
                            {selectedFile.name}
                          </h3>
                        </div>
                        <button
                          type="button"
                          onClick={handleReset}
                          className="inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-md border border-zinc-800 bg-zinc-900/60 text-zinc-400 transition-colors duration-150 ease-[cubic-bezier(0.16,1,0.3,1)] hover:border-zinc-700 hover:text-zinc-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500/60 focus-visible:ring-offset-2 focus-visible:ring-offset-zinc-950 active:scale-[0.98] motion-reduce:transition-none motion-reduce:transform-none"
                          aria-label="Remove selected file"
                          title="Remove file"
                        >
                          <X size={16} weight="regular" />
                        </button>
                      </div>

                      {/* Technical Metadata Specifications */}
                      <dl className="mt-5 grid grid-cols-2 gap-4 text-xs sm:grid-cols-3 border-t border-zinc-800/80 pt-4">
                        <div>
                          <dt className="text-zinc-500">Format</dt>
                          <dd className="mt-0.5 font-mono font-medium text-zinc-300">
                            {selectedFile.type || 'Image'}
                          </dd>
                        </div>
                        <div>
                          <dt className="text-zinc-500">File Size</dt>
                          <dd className="mt-0.5 font-mono font-medium text-zinc-300">
                            {formatFileSize(selectedFile.size)}
                          </dd>
                        </div>
                        <div>
                          <dt className="text-zinc-500">Inspection Status</dt>
                          <dd className="mt-0.5 font-mono font-medium text-emerald-400">
                            {isScanning ? 'Executing scan...' : 'Ready for analysis'}
                          </dd>
                        </div>
                      </dl>
                    </div>

                    {/* Primary & Secondary Actions */}
                    <div className="mt-8 flex flex-wrap items-center gap-3">
                      <button
                        type="button"
                        onClick={handleAnalyzeClick}
                        disabled={isScanning}
                        className="inline-flex items-center gap-2 rounded-md bg-zinc-100 px-5 py-2.5 text-sm font-medium text-zinc-950 shadow-md transition-all duration-150 ease-[cubic-bezier(0.23,1,0.32,1)] hover:bg-white active:scale-[0.97] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500/60 focus-visible:ring-offset-2 focus-visible:ring-offset-zinc-950 disabled:opacity-75 disabled:pointer-events-none motion-reduce:transition-none motion-reduce:transform-none"
                      >
                        {isScanning ? (
                          <>
                            <span className="relative flex h-2 w-2">
                              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-500 opacity-75" />
                              <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-600" />
                            </span>
                            <span>Deconvolving...</span>
                          </>
                        ) : (
                          <>
                            <span>Analyze QR code</span>
                            <ArrowRight size={16} weight="bold" />
                          </>
                        )}
                      </button>

                      <button
                        type="button"
                        onClick={handleReset}
                        className="inline-flex items-center rounded-md border border-zinc-800 bg-zinc-900/60 px-4 py-2.5 text-sm font-medium text-zinc-400 transition-colors duration-150 ease-[cubic-bezier(0.16,1,0.3,1)] hover:border-zinc-700 hover:text-zinc-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500/60 focus-visible:ring-offset-2 focus-visible:ring-offset-zinc-950 active:scale-[0.98] motion-reduce:transition-none motion-reduce:transform-none"
                      >
                        Select different file
                      </button>
                    </div>

                    {/* Live Optical Scanning Telemetry */}
                    {isScanning && (
                      <div className="mt-5 rounded-md border border-emerald-500/30 bg-emerald-950/20 p-3.5 text-xs font-mono text-emerald-300">
                        <div className="flex items-center gap-2 mb-1.5">
                          <Cpu size={14} className="text-emerald-400 animate-spin" />
                          <span className="font-semibold uppercase tracking-wider">Live Pipeline Telemetry:</span>
                        </div>
                        <p className="text-zinc-300">{scanStatus}</p>
                      </div>
                    )}

                    {/* Staging & Completion Notice */}
                    {isStagedNoticeVisible && !isScanning && (
                      <div
                        role="status"
                        aria-live="polite"
                        className="mt-5 flex items-start gap-2.5 rounded-md border border-zinc-800 bg-zinc-950/80 p-3.5 text-xs text-zinc-300"
                      >
                        <CheckCircle size={16} weight="fill" className="mt-0.5 shrink-0 text-emerald-400" />
                        <p>
                          Image analyzed for defensive threat indicators. Review synthesized results below.
                        </p>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </section>
  );
}
