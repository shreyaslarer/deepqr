import React, { useState, useRef, useEffect } from 'react';
import {
  QrCode,
  UploadSimple,
  X,
  WarningCircle,
  CheckCircle,
  ArrowRight,
  ShieldCheck,
  DeviceMobile,
} from '@phosphor-icons/react';
import { sound } from '../utils/sound.js';
import MobilePairingModal from './MobilePairingModal.jsx';

const ACCEPTED_TYPES = ['image/png', 'image/jpeg', 'image/webp'];
const ACCEPTED_EXTENSIONS = ['.png', '.jpg', '.jpeg', '.webp'];
const MAX_FILE_SIZE_BYTES = 10 * 1024 * 1024; // 10 MB limit

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

/**
 * QRUpload component for DeepQR Shield.
 *
 * Implements a modern enterprise-grade 3D upload chassis:
 * - Real multipart upload targeting /api/analyze.
 * - Reactive pointer illumination and hardware 3D tilt.
 * - Live neural analysis state indicator.
 * - Audio-haptic feedback synchronization.
 * - Full reduced-motion and accessibility support.
 */
export default function QRUpload({ onAnalysisComplete, onReset }) {
  const [selectedFile, setSelectedFile] = useState(null);
  const [previewUrl, setPreviewUrl] = useState(null);
  const [isDragging, setIsDragging] = useState(false);
  const [errorMessage, setErrorMessage] = useState(null);
  const [isStagedNoticeVisible, setIsStagedNoticeVisible] = useState(false);
  const [isScanning, setIsScanning] = useState(false);
  const [isPairingModalOpen, setIsPairingModalOpen] = useState(false);

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

    if (file.size > MAX_FILE_SIZE_BYTES) {
      setErrorMessage('File is too large. Maximum allowed size is 10 MB.');
      return;
    }

    if (previewUrl && previewUrl.startsWith('blob:')) {
      URL.revokeObjectURL(previewUrl);
    }

    const url = URL.createObjectURL(file);
    sound.playClick();
    setSelectedFile(file);
    setPreviewUrl(url);
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
    if (onReset) {
      onReset();
    }
  };

  const handleAnalyzeClick = async () => {
    if (isScanning) return;
    if (!selectedFile || !(selectedFile instanceof File)) {
      setErrorMessage('Please select a QR code image to analyze.');
      return;
    }

    if (selectedFile.size > MAX_FILE_SIZE_BYTES) {
      setErrorMessage('File is too large. Maximum allowed size is 10 MB.');
      return;
    }

    setIsScanning(true);
    setErrorMessage(null);
    setIsStagedNoticeVisible(false);
    sound.playScanSweep();

    const formData = new FormData();
    formData.append('file', selectedFile);

    try {
      const response = await fetch('/api/analyze', {
        method: 'POST',
        body: formData,
      });

      if (response.status === 413) {
        throw new Error('File is too large. Maximum allowed size is 10 MB.');
      }

      let data = null;
      try {
        data = await response.json();
      } catch {
        if (!response.ok) {
          throw new Error(`Server returned error ${response.status}`);
        }
      }

      if (!response.ok) {
        if (response.status >= 500 && !data?.error) {
          throw new Error('Unable to connect to the backend server. Please verify the Python backend is running.');
        }
        throw new Error(data?.error || `Analysis failed with HTTP status ${response.status}`);
      }

      sound.playLockSuccess();
      setIsScanning(false);
      setIsStagedNoticeVisible(true);
      if (onAnalysisComplete) {
        onAnalysisComplete(data);
      }
    } catch (err) {
      setIsScanning(false);
      sound.playClick();
      const isNetworkError =
        err.name === 'TypeError' ||
        err.message?.includes('Failed to fetch') ||
        err.message?.includes('NetworkError');

      if (isNetworkError) {
        setErrorMessage(
          'Unable to connect to the backend server. Please verify the Python backend is running.'
        );
      } else {
        setErrorMessage(err.message || 'An error occurred during analysis.');
      }
    }
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
      className="w-full border-b border-zinc-800/80 bg-zinc-950/20 py-16 sm:py-20 lg:py-24"
    >
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        {/* Section Header */}
        <div className="mb-8 flex flex-col sm:flex-row sm:items-end sm:justify-between gap-4">
          <div className="max-w-xl">
            <h2
              id="upload-heading"
              className="text-2xl font-semibold tracking-tight text-zinc-100 sm:text-3xl"
            >
              Upload a QR image
            </h2>
            <p className="mt-2 text-sm text-zinc-300 sm:text-base leading-relaxed">
              Select or drop an image containing a QR code for threat assessment. The destination is quarantined and not opened automatically.
            </p>
          </div>

          <div className="flex items-center gap-2 rounded-full border border-emerald-500/25 bg-emerald-500/5 px-3 py-1.5 text-xs font-mono text-emerald-400 self-start sm:self-end">
            <ShieldCheck size={14} weight="bold" />
            <span>Dual-Channel ML Verification</span>
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
                className="mt-2 text-xs font-medium text-amber-300 underline underline-offset-2 hover:text-amber-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-400 focus-visible:ring-offset-2 focus-visible:ring-offset-zinc-950 rounded-[2px]"
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
                ? 'border-emerald-500/60 bg-zinc-900/95 shadow-[inset_0_1px_0_rgba(255,255,255,0.12),0_20px_50px_rgba(16,185,129,0.25)]'
                : 'border-white/[0.12] bg-zinc-900/85 backdrop-blur-sm shadow-[inset_0_1px_0_rgba(255,255,255,0.1),0_20px_50px_rgba(0,0,0,0.65)] hover:border-zinc-700 hover:bg-zinc-900/95'
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
                  <p className="text-base font-semibold tracking-tight text-zinc-100">
                    {isDragging ? 'Drop QR image to stage for analysis' : 'Choose a QR image or drag and drop here'}
                  </p>
                  <p className="text-xs text-zinc-300 leading-relaxed">
                    Supported formats: PNG, JPG, JPEG, WEBP (up to 10 MB). Destination routing is quarantined and not opened automatically.
                  </p>
                </div>

                {/* Tactile Action Buttons */}
                <div className="mt-6 flex flex-wrap items-center justify-center gap-3">
                  <span className="inline-flex items-center gap-2 rounded-md border border-zinc-700 bg-zinc-800 px-4 py-2 text-xs font-medium text-zinc-100 shadow-xs transition-all duration-150 ease-[cubic-bezier(0.16,1,0.3,1)] group-hover:border-zinc-600 group-hover:bg-zinc-700 group-hover:text-white motion-reduce:transition-none">
                    <UploadSimple size={15} weight="bold" />
                    <span>Browse files</span>
                  </span>

                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      sound.playClick();
                      setIsPairingModalOpen(true);
                    }}
                    className="inline-flex items-center gap-1.5 rounded-md border border-emerald-500/30 bg-emerald-500/10 px-4 py-2 text-xs font-medium text-emerald-300 shadow-xs transition-all duration-150 hover:border-emerald-500/50 hover:bg-emerald-500/20 hover:text-emerald-200"
                  >
                    <DeviceMobile size={15} weight="bold" />
                    <span>Scan with Mobile</span>
                  </button>
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
                      className="relative flex aspect-square w-full sm:w-52 shrink-0 items-center justify-center overflow-hidden rounded-xl border border-white/[0.14] bg-zinc-950 p-3 shadow-[0_8px_24px_rgba(0,0,0,0.6)]"
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
                          <span className="text-[11px] font-mono uppercase tracking-wider text-zinc-400 block">
                            Image Staged
                          </span>
                          <h3 className="mt-1 truncate text-base font-semibold text-zinc-100 sm:text-lg">
                            {selectedFile.name}
                          </h3>
                        </div>
                        <button
                          type="button"
                          onClick={handleReset}
                          disabled={isScanning}
                          className="inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-md border border-zinc-700 bg-zinc-800 text-zinc-300 transition-colors duration-150 ease-[cubic-bezier(0.16,1,0.3,1)] hover:border-zinc-600 hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500/60 focus-visible:ring-offset-2 focus-visible:ring-offset-zinc-950 active:scale-[0.98] disabled:opacity-50"
                          aria-label="Remove selected file"
                          title="Remove file"
                        >
                          <X size={16} weight="regular" />
                        </button>
                      </div>

                      {/* Technical Metadata Specifications */}
                      <dl className="mt-5 grid grid-cols-2 gap-4 text-xs sm:grid-cols-3 border-t border-zinc-800 pt-4">
                        <div>
                          <dt className="text-zinc-400 font-medium">Format</dt>
                          <dd className="mt-0.5 font-mono font-medium text-zinc-100">
                            {selectedFile.type || 'Image'}
                          </dd>
                        </div>
                        <div>
                          <dt className="text-zinc-400 font-medium">File Size</dt>
                          <dd className="mt-0.5 font-mono font-medium text-zinc-100">
                            {formatFileSize(selectedFile.size)}
                          </dd>
                        </div>
                        <div>
                          <dt className="text-zinc-400 font-medium">Inference Status</dt>
                          <dd className={`mt-0.5 font-mono font-medium ${isScanning ? 'text-amber-400 animate-pulse' : 'text-emerald-400'}`}>
                            {isScanning ? 'Executing neural models...' : 'Ready for analysis'}
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
                            <span>Running inference...</span>
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
                        disabled={isScanning}
                        className="inline-flex items-center rounded-md border border-zinc-700 bg-zinc-800/80 px-4 py-2.5 text-sm font-medium text-zinc-300 transition-colors duration-150 ease-[cubic-bezier(0.16,1,0.3,1)] hover:border-zinc-600 hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500/60 focus-visible:ring-offset-2 focus-visible:ring-offset-zinc-950 active:scale-[0.98] disabled:opacity-50"
                      >
                        Select different file
                      </button>

                      <button
                        type="button"
                        onClick={() => {
                          sound.playClick();
                          setIsPairingModalOpen(true);
                        }}
                        disabled={isScanning}
                        className="inline-flex items-center gap-1.5 rounded-md border border-emerald-500/30 bg-emerald-500/10 px-4 py-2.5 text-sm font-medium text-emerald-300 transition-colors duration-150 hover:border-emerald-500/50 hover:bg-emerald-500/20 hover:text-emerald-200 disabled:opacity-50"
                      >
                        <DeviceMobile size={16} weight="bold" />
                        <span>Scan with Mobile</span>
                      </button>
                    </div>

                    {/* Staging & Completion Notice */}
                    {isStagedNoticeVisible && !isScanning && (
                      <div
                        role="status"
                        aria-live="polite"
                        className="mt-5 flex items-start gap-2.5 rounded-md border border-zinc-800 bg-zinc-950/95 p-3.5 text-xs text-zinc-200"
                      >
                        <CheckCircle size={16} weight="fill" className="mt-0.5 shrink-0 text-emerald-400" />
                        <p>
                          Analysis complete. Multimodal threat assessment synthesized below.
                        </p>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Mobile Companion Pairing Modal */}
        <MobilePairingModal
          isOpen={isPairingModalOpen}
          onClose={() => setIsPairingModalOpen(false)}
          onImageStaged={handleFileProcess}
        />
      </div>
    </section>
  );
}
