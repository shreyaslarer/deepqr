import React, { useState, useEffect, useRef } from 'react';
import {
  X,
  DeviceMobile,
  QrCode,
  ArrowsClockwise,
  WarningCircle,
  CheckCircle,
  Copy,
  Check,
  CircleNotch,
  ShieldCheck,
} from '@phosphor-icons/react';
import { sound } from '../utils/sound.js';

/**
 * MobilePairingModal component for DeepQR Shield.
 *
 * Implements ephemeral optical pairing between the desktop web app
 * and the React Native companion scanner:
 * - Creates temporary 5-minute pairing session via POST /api/session/create.
 * - Displays server-generated high-contrast pairing QR code.
 * - Displays manual LAN connection parameters and live countdown.
 * - Polls GET /api/session/<session_id> every 1500 ms for mobile handshake & upload.
 * - On upload, retrieves image via GET /api/session/<session_id>/image (consuming memory).
 * - Converts image blob into a standard File object and stages it on desktop.
 * - Strictly does NOT run inference automatically; user must click "Analyze QR code".
 */
export default function MobilePairingModal({ isOpen, onClose, onImageStaged }) {
  const [session, setSession] = useState(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState(null);
  const [status, setStatus] = useState('IDLE'); // IDLE, WAITING, PAIRED, UPLOADED, EXPIRED, CONSUMED
  const [timeLeft, setTimeLeft] = useState(300);
  const [copiedField, setCopiedField] = useState(null);

  const pollTimerRef = useRef(null);
  const countdownTimerRef = useRef(null);
  const isMountedRef = useRef(true);

  // Initialize or re-create pairing session
  const createSession = async () => {
    setIsLoading(true);
    setError(null);
    setStatus('WAITING');

    // Clear any running timers
    if (pollTimerRef.current) clearInterval(pollTimerRef.current);
    if (countdownTimerRef.current) clearInterval(countdownTimerRef.current);

    try {
      const res = await fetch('/api/session/create', { method: 'POST' });
      if (!res.ok) {
        throw new Error(`Failed to create session (HTTP ${res.status})`);
      }
      const data = await res.json();
      if (!isMountedRef.current) return;

      setSession(data);
      setTimeLeft(data.expires_in || 300);
      setIsLoading(false);
      sound.playClick();
    } catch (err) {
      if (!isMountedRef.current) return;
      setIsLoading(false);
      setError(err.message || 'Unable to connect to backend for mobile pairing.');
      setStatus('ERROR');
    }
  };

  // Open modal triggers session creation
  useEffect(() => {
    isMountedRef.current = true;
    if (isOpen) {
      createSession();
    } else {
      // Cleanup when closed
      if (pollTimerRef.current) clearInterval(pollTimerRef.current);
      if (countdownTimerRef.current) clearInterval(countdownTimerRef.current);
      setSession(null);
      setStatus('IDLE');
      setError(null);
    }

    return () => {
      isMountedRef.current = false;
      if (pollTimerRef.current) clearInterval(pollTimerRef.current);
      if (countdownTimerRef.current) clearInterval(countdownTimerRef.current);
    };
  }, [isOpen]);

  // Countdown timer
  useEffect(() => {
    if (!session || status === 'EXPIRED' || status === 'UPLOADED') return;

    countdownTimerRef.current = setInterval(() => {
      setTimeLeft((prev) => {
        if (prev <= 1) {
          clearInterval(countdownTimerRef.current);
          if (pollTimerRef.current) clearInterval(pollTimerRef.current);
          setStatus('EXPIRED');
          return 0;
        }
        return prev - 1;
      });
    }, 1000);

    return () => {
      if (countdownTimerRef.current) clearInterval(countdownTimerRef.current);
    };
  }, [session, status]);

  // Polling loop for session status
  useEffect(() => {
    if (!session?.session_id || status === 'EXPIRED' || status === 'CONSUMED') return;

    const pollSession = async () => {
      try {
        const res = await fetch(`/api/session/${session.session_id}`);
        if (res.status === 410) {
          setStatus('EXPIRED');
          if (pollTimerRef.current) clearInterval(pollTimerRef.current);
          return;
        }
        if (!res.ok) return;

        const data = await res.json();
        if (!isMountedRef.current) return;

        if (data.status === 'PAIRED' && status === 'WAITING') {
          setStatus('PAIRED');
          sound.playClick();
        }

        if (data.status === 'UPLOADED' || data.has_image) {
          setStatus('UPLOADED');
          if (pollTimerRef.current) clearInterval(pollTimerRef.current);

          // Fetch the staged image
          await retrieveAndStageImage(session.session_id);
        }
      } catch (err) {
        // Suppress transient network polling glitches
      }
    };

    pollTimerRef.current = setInterval(pollSession, 1500);

    return () => {
      if (pollTimerRef.current) clearInterval(pollTimerRef.current);
    };
  }, [session, status]);

  // Fetch the uploaded image blob and convert to File object
  const retrieveAndStageImage = async (sessionId) => {
    try {
      const res = await fetch(`/api/session/${sessionId}/image`);
      if (!res.ok) {
        throw new Error(`Failed to retrieve staged image (HTTP ${res.status})`);
      }

      const blob = await res.blob();
      const ext = blob.type === 'image/jpeg' ? 'jpg' : 'png';
      const file = new File([blob], `mobile_scan_${Date.now()}.${ext}`, {
        type: blob.type || 'image/png',
      });

      setStatus('CONSUMED');
      sound.playLockSuccess();

      // Pass file to parent QRUpload component
      if (onImageStaged) {
        onImageStaged(file);
      }

      // Close modal gracefully after staging
      setTimeout(() => {
        if (isMountedRef.current) {
          onClose();
        }
      }, 600);
    } catch (err) {
      if (!isMountedRef.current) return;
      setError('Mobile image was uploaded, but retrieval failed: ' + err.message);
      setStatus('ERROR');
    }
  };

  const copyToClipboard = (text, fieldName) => {
    if (navigator?.clipboard) {
      navigator.clipboard.writeText(text);
      setCopiedField(fieldName);
      setTimeout(() => setCopiedField(null), 2000);
    }
  };

  if (!isOpen) return null;

  const minutes = Math.floor(timeLeft / 60);
  const seconds = timeLeft % 60;
  const formattedTime = `${minutes}:${seconds < 10 ? '0' : ''}${seconds}`;

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="pairing-modal-title"
      className="fixed inset-0 z-50 flex items-center justify-center p-4 sm:p-6"
    >
      {/* Backdrop */}
      <div
        onClick={onClose}
        className="fixed inset-0 bg-black/80 backdrop-blur-sm transition-opacity"
        aria-hidden="true"
      />

      {/* Modal Surface */}
      <div className="relative w-full max-w-lg rounded-2xl border border-zinc-800 bg-zinc-950 p-6 shadow-2xl sm:p-8 text-zinc-100 z-10 overflow-hidden">
        {/* Header */}
        <div className="flex items-start justify-between border-b border-zinc-800/80 pb-4">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl border border-emerald-500/30 bg-emerald-500/10 text-emerald-400">
              <DeviceMobile size={22} weight="bold" />
            </div>
            <div>
              <h3 id="pairing-modal-title" className="text-lg font-semibold tracking-tight text-white">
                Scan with Mobile Companion
              </h3>
              <p className="text-xs text-zinc-400">
                Point your phone camera to capture physical QR codes safely
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg p-1.5 text-zinc-400 hover:bg-zinc-800 hover:text-white transition-colors"
            aria-label="Close modal"
          >
            <X size={18} weight="bold" />
          </button>
        </div>

        {/* Body Content */}
        <div className="mt-6">
          {isLoading && (
            <div className="flex flex-col items-center justify-center py-12 text-center">
              <CircleNotch size={36} className="animate-spin text-emerald-400" />
              <p className="mt-4 text-sm font-medium text-zinc-300">
                Initializing temporary pairing session...
              </p>
            </div>
          )}

          {error && (
            <div className="rounded-xl border border-red-500/30 bg-red-500/10 p-4 text-sm text-red-200">
              <div className="flex items-start gap-3">
                <WarningCircle size={20} className="shrink-0 text-red-400 mt-0.5" />
                <div className="flex-1">
                  <p className="font-medium">{error}</p>
                  <button
                    type="button"
                    onClick={createSession}
                    className="mt-3 inline-flex items-center gap-1.5 rounded-md bg-zinc-800 px-3 py-1.5 text-xs font-medium text-zinc-200 hover:bg-zinc-700"
                  >
                    <ArrowsClockwise size={14} />
                    <span>Try again</span>
                  </button>
                </div>
              </div>
            </div>
          )}

          {session && !isLoading && !error && (
            <div className="space-y-6">
              {/* Pairing QR Code Card */}
              <div className="flex flex-col items-center justify-center rounded-xl border border-zinc-800/80 bg-zinc-900/60 p-6">
                {session.qr_data_url ? (
                  <div className="relative rounded-lg bg-white p-3 shadow-lg">
                    <img
                      src={session.qr_data_url}
                      alt="DeepQR Mobile Pairing QR Code"
                      className="h-56 w-56 object-contain"
                    />
                    {status === 'UPLOADED' && (
                      <div className="absolute inset-0 flex flex-col items-center justify-center bg-zinc-950/90 rounded-lg">
                        <CheckCircle size={48} weight="fill" className="text-emerald-400 animate-bounce" />
                        <p className="mt-2 text-xs font-mono font-medium text-emerald-300">
                          Image Staged!
                        </p>
                      </div>
                    )}
                  </div>
                ) : (
                  <div className="flex h-56 w-56 items-center justify-center bg-zinc-800 text-zinc-500 rounded-lg">
                    <QrCode size={48} />
                  </div>
                )}

                {/* Status Indicator Pill */}
                <div className="mt-4 flex items-center gap-2">
                  {status === 'WAITING' && (
                    <div className="flex items-center gap-2 rounded-full border border-amber-500/30 bg-amber-500/10 px-3 py-1 text-xs font-mono text-amber-300">
                      <span className="relative flex h-2 w-2">
                        <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-amber-400 opacity-75" />
                        <span className="relative inline-flex rounded-full h-2 w-2 bg-amber-500" />
                      </span>
                      <span>Waiting for mobile scan...</span>
                    </div>
                  )}

                  {status === 'PAIRED' && (
                    <div className="flex items-center gap-2 rounded-full border border-cyan-500/30 bg-cyan-500/10 px-3 py-1 text-xs font-mono text-cyan-300">
                      <span className="h-2 w-2 rounded-full bg-cyan-400" />
                      <span>Phone paired! Capture QR target now</span>
                    </div>
                  )}

                  {status === 'UPLOADED' && (
                    <div className="flex items-center gap-2 rounded-full border border-emerald-500/30 bg-emerald-500/10 px-3 py-1 text-xs font-mono text-emerald-300">
                      <CheckCircle size={14} weight="fill" />
                      <span>Photo received. Transferring to desktop...</span>
                    </div>
                  )}

                  {status === 'EXPIRED' && (
                    <div className="flex items-center gap-2 rounded-full border border-red-500/30 bg-red-500/10 px-3 py-1 text-xs font-mono text-red-300">
                      <WarningCircle size={14} weight="fill" />
                      <span>Session expired</span>
                    </div>
                  )}
                </div>

                {/* Expiry Countdown */}
                <p className="mt-2 text-xs text-zinc-400 font-mono">
                  {status === 'EXPIRED' ? (
                    <button
                      type="button"
                      onClick={createSession}
                      className="text-emerald-400 underline hover:text-emerald-300 font-sans text-xs"
                    >
                      Generate New Pairing Session
                    </button>
                  ) : (
                    <span>Expires in: {formattedTime}</span>
                  )}
                </p>
              </div>

              {/* Instructions */}
              <div className="rounded-xl border border-zinc-800 bg-zinc-900/40 p-4 text-xs text-zinc-300 space-y-2">
                <p className="font-semibold text-zinc-200">How to pair:</p>
                <ol className="list-decimal list-inside space-y-1 text-zinc-400">
                  <li>Open the <span className="text-zinc-200">DeepQR Companion</span> app on your phone.</li>
                  <li>Scan the pairing QR code above with the companion app.</li>
                  <li>Photograph the physical QR code target on your desk or screen.</li>
                  <li>The image will automatically stage into DeepQR Shield below.</li>
                </ol>
              </div>

              {/* Manual Session Details (Collapsible/Accessible) */}
              <div className="rounded-xl border border-zinc-800 bg-zinc-900/30 p-3 text-xs">
                <div className="flex items-center justify-between text-zinc-400 mb-2">
                  <span className="font-medium text-zinc-300">Direct LAN Endpoint:</span>
                  <button
                    type="button"
                    onClick={() => copyToClipboard(session.endpoint, 'endpoint')}
                    className="inline-flex items-center gap-1 text-[11px] text-zinc-400 hover:text-zinc-200"
                  >
                    {copiedField === 'endpoint' ? (
                      <>
                        <Check size={12} className="text-emerald-400" />
                        <span className="text-emerald-400">Copied</span>
                      </>
                    ) : (
                      <>
                        <Copy size={12} />
                        <span>Copy</span>
                      </>
                    )}
                  </button>
                </div>
                <p className="font-mono text-zinc-400 break-all select-all bg-zinc-950/60 p-2 rounded border border-zinc-800/80">
                  {session.endpoint}
                </p>
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="mt-6 flex items-center justify-between border-t border-zinc-800/80 pt-4">
          <div className="flex items-center gap-1.5 text-[11px] text-zinc-400">
            <ShieldCheck size={14} className="text-emerald-400" />
            <span>Ephemeral in-memory transfer. Zero permanent storage.</span>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg border border-zinc-700 bg-zinc-800 px-4 py-2 text-xs font-medium text-zinc-200 hover:bg-zinc-700 transition-colors"
          >
            Cancel
          </button>
        </div>
      </div>
    </div>
  );
}
