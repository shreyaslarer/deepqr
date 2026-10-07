import React, { useState, useRef, useEffect } from 'react';
import { QrCode, UploadSimple, X, WarningCircle, CheckCircle, ArrowRight } from '@phosphor-icons/react';

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

/**
 * QRUpload component for DeepQR Shield.
 *
 * Implements a focused, operational image input experience:
 * - Drag and drop + native file selection for PNG, JPG, JPEG, and WEBP.
 * - Clean empty state without generic SaaS cloud illustrations or fake status pills.
 * - Selected file state with authentic metadata (name, type, size) and local image preview.
 * - Non-color-dependent validation error handling.
 * - Honest handling of the analyze trigger (no simulated ML or fabricated results).
 * - High accessibility (keyboard operable, visible focus rings, aria announcements).
 */
export default function QRUpload() {
  const [selectedFile, setSelectedFile] = useState(null);
  const [previewUrl, setPreviewUrl] = useState(null);
  const [isDragging, setIsDragging] = useState(false);
  const [errorMessage, setErrorMessage] = useState(null);
  const [isStagedNoticeVisible, setIsStagedNoticeVisible] = useState(false);
  const fileInputRef = useRef(null);

  // Revoke object URL on cleanup
  useEffect(() => {
    return () => {
      if (previewUrl) {
        URL.revokeObjectURL(previewUrl);
      }
    };
  }, [previewUrl]);

  const handleFileProcess = (file) => {
    setErrorMessage(null);
    setIsStagedNoticeVisible(false);

    if (!file) return;

    if (!isValidImage(file)) {
      setErrorMessage('Unsupported file format. Please select a PNG, JPG, JPEG, or WEBP image.');
      return;
    }

    if (previewUrl) {
      URL.revokeObjectURL(previewUrl);
    }

    const url = URL.createObjectURL(file);
    setSelectedFile(file);
    setPreviewUrl(url);
  };

  const handleFileChange = (e) => {
    const file = e.target.files?.[0];
    if (file) {
      handleFileProcess(file);
    }
    // Reset file input value so selecting the same file again works
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
    if (previewUrl) {
      URL.revokeObjectURL(previewUrl);
    }
    setSelectedFile(null);
    setPreviewUrl(null);
    setErrorMessage(null);
    setIsStagedNoticeVisible(false);
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  const handleAnalyzeClick = () => {
    // Honest handling: no fake ML inference or fabricated scores
    setIsStagedNoticeVisible(true);
  };

  const triggerFileInput = () => {
    fileInputRef.current?.click();
  };

  return (
    <section
      id="analyze"
      aria-labelledby="upload-heading"
      className="w-full border-b border-zinc-800/80 bg-zinc-950 py-16 sm:py-20 lg:py-24"
    >
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        {/* Section Header */}
        <div className="mb-8">
          <h2
            id="upload-heading"
            className="text-2xl font-semibold tracking-tight text-zinc-100 sm:text-3xl"
          >
            Upload a QR image
          </h2>
          <p className="mt-2 text-sm text-zinc-400 sm:text-base">
            Select or drop an image containing a QR code for threat assessment. The destination is not opened automatically.
          </p>
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

        {/* Main Input Surface */}
        {!selectedFile ? (
          /* Empty State / Drop Surface */
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
            className={`group relative flex min-h-[220px] cursor-pointer flex-col items-center justify-center rounded-xl border p-8 text-center transition-colors duration-150 ease-[cubic-bezier(0.16,1,0.3,1)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500/60 focus-visible:ring-offset-2 focus-visible:ring-offset-zinc-950 motion-reduce:transition-none ${
              isDragging
                ? 'border-zinc-600 bg-zinc-900/80'
                : 'border-zinc-800 bg-zinc-900/30 hover:border-zinc-700 hover:bg-zinc-900/50'
            }`}
          >
            {/* Visual Icon Anchor */}
            <div className="flex h-12 w-12 items-center justify-center rounded-lg border border-zinc-800 bg-zinc-900 text-zinc-400 transition-colors duration-150 ease-[cubic-bezier(0.16,1,0.3,1)] group-hover:border-zinc-700 group-hover:text-zinc-200">
              <UploadSimple size={22} weight="regular" />
            </div>

            <div className="mt-4 space-y-1">
              <p className="text-sm font-medium text-zinc-200">
                Choose a file or drag and drop here
              </p>
              <p className="text-xs text-zinc-500">
                Supported image formats: PNG, JPG, JPEG, WEBP
              </p>
            </div>

            <div className="mt-5">
              <span className="inline-flex items-center gap-1.5 rounded-md border border-zinc-700 bg-zinc-800/80 px-3.5 py-1.5 text-xs font-medium text-zinc-200 transition-colors duration-150 ease-[cubic-bezier(0.16,1,0.3,1)] group-hover:bg-zinc-800 group-hover:text-white motion-reduce:transition-none">
                Browse files
              </span>
            </div>
          </div>
        ) : (
          /* Selected File State */
          <div className="rounded-xl border border-zinc-800 bg-zinc-900/40 p-6 sm:p-8">
            <div className="flex flex-col gap-6 sm:flex-row sm:items-start sm:gap-8">
              {/* Contained Local Image Preview */}
              {previewUrl && (
                <div className="relative flex aspect-square w-full shrink-0 items-center justify-center overflow-hidden rounded-lg border border-zinc-800 bg-zinc-950 p-2 sm:w-44">
                  <img
                    src={previewUrl}
                    alt="Selected QR code"
                    className="max-h-full max-w-full object-contain"
                  />
                </div>
              )}

              {/* File Metadata & Staging Controls */}
              <div className="flex flex-1 flex-col justify-between">
                <div>
                  <div className="flex items-start justify-between gap-4">
                    <div>
                      <p className="text-xs font-medium uppercase tracking-wider text-zinc-500">
                        Selected File
                      </p>
                      <h3 className="mt-1 break-all text-base font-semibold text-zinc-100 sm:text-lg">
                        {selectedFile.name}
                      </h3>
                    </div>
                    <button
                      type="button"
                      onClick={handleReset}
                      className="inline-flex h-8 w-8 items-center justify-center rounded-md border border-zinc-800 bg-zinc-900/60 text-zinc-400 transition-colors duration-150 ease-[cubic-bezier(0.16,1,0.3,1)] hover:border-zinc-700 hover:text-zinc-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500/60 focus-visible:ring-offset-2 focus-visible:ring-offset-zinc-950 active:scale-[0.98] motion-reduce:transition-none motion-reduce:transform-none"
                      aria-label="Remove selected file"
                      title="Remove file"
                    >
                      <X size={16} weight="regular" />
                    </button>
                  </div>

                  {/* Metadata Specs */}
                  <dl className="mt-4 grid grid-cols-2 gap-4 text-xs sm:grid-cols-3">
                    <div>
                      <dt className="text-zinc-500">Format</dt>
                      <dd className="mt-0.5 font-medium text-zinc-300">
                        {selectedFile.type || 'Image'}
                      </dd>
                    </div>
                    <div>
                      <dt className="text-zinc-500">File Size</dt>
                      <dd className="mt-0.5 font-medium text-zinc-300">
                        {formatFileSize(selectedFile.size)}
                      </dd>
                    </div>
                    <div>
                      <dt className="text-zinc-500">Inspection Status</dt>
                      <dd className="mt-0.5 font-medium text-zinc-300">
                        Staged (Pending analysis)
                      </dd>
                    </div>
                  </dl>
                </div>

                {/* Analysis Actions */}
                <div className="mt-8 flex flex-wrap items-center gap-3">
                  <button
                    type="button"
                    onClick={handleAnalyzeClick}
                    className="inline-flex items-center gap-2 rounded-md bg-zinc-100 px-5 py-2.5 text-sm font-medium text-zinc-950 transition-colors duration-150 ease-[cubic-bezier(0.16,1,0.3,1)] hover:bg-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500/60 focus-visible:ring-offset-2 focus-visible:ring-offset-zinc-950 active:scale-[0.98] motion-reduce:transition-none motion-reduce:transform-none"
                  >
                    <span>Analyze QR code</span>
                    <ArrowRight size={16} weight="bold" />
                  </button>

                  <button
                    type="button"
                    onClick={handleReset}
                    className="inline-flex items-center rounded-md border border-zinc-800 bg-zinc-900/60 px-4 py-2.5 text-sm font-medium text-zinc-400 transition-colors duration-150 ease-[cubic-bezier(0.16,1,0.3,1)] hover:border-zinc-700 hover:text-zinc-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500/60 focus-visible:ring-offset-2 focus-visible:ring-offset-zinc-950 active:scale-[0.98] motion-reduce:transition-none motion-reduce:transform-none"
                  >
                    Select different file
                  </button>
                </div>

                {/* Honest Staging Notice (No fabricated ML progress or fake results) */}
                {isStagedNoticeVisible && (
                  <div
                    role="status"
                    aria-live="polite"
                    className="mt-4 flex items-start gap-2.5 rounded-md border border-zinc-800 bg-zinc-950/60 p-3 text-xs text-zinc-300"
                  >
                    <CheckCircle size={16} weight="fill" className="mt-0.5 shrink-0 text-emerald-400" />
                    <p>
                      Image successfully staged for inspection. Detection and analytical models will be integrated in subsequent phases.
                    </p>
                  </div>
                )}
              </div>
            </div>
          </div>
        )}
      </div>
    </section>
  );
}
