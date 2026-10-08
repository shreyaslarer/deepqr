import React, { useState, useRef } from 'react';
import {
  StyleSheet,
  Text,
  View,
  TouchableOpacity,
  ActivityIndicator,
  SafeAreaView,
} from 'react-native';
import { CameraView } from 'expo-camera';
import { uploadQRImage } from '../services/api';

/**
 * CaptureScreen for DeepQR Shield Companion.
 *
 * Captures an authentic photographic still of a physical QR code
 * and uploads it directly to the active desktop session buffer.
 *
 * CRITICAL SAFETY RULES:
 * - Does NOT merely decode and transmit the string.
 * - Transmits the full photographic still required by the ResNet-18 visual threat branch.
 * - NEVER executes, opens, or navigates to the scanned QR destination.
 * - Ephemeral transmission: image is discarded immediately after upload.
 */
export default function CaptureScreen({ session, onResetPairing }) {
  const cameraRef = useRef(null);
  const [state, setState] = useState('READY'); // READY, CAPTURING, UPLOADING, SUCCESS, ERROR
  const [statusMessage, setStatusMessage] = useState('Point camera at physical QR code and tap Capture');
  const [errorMessage, setErrorMessage] = useState(null);

  const handleCaptureAndUpload = async () => {
    if (!cameraRef.current || state === 'CAPTURING' || state === 'UPLOADING') return;

    try {
      setState('CAPTURING');
      setStatusMessage('Capturing high-resolution still...');
      setErrorMessage(null);

      // 1. Capture photographic still image (not just decoded text)
      const photo = await cameraRef.current.takePictureAsync({
        quality: 0.85,
        skipProcessing: true,
      });

      if (!photo?.uri) {
        throw new Error('Camera failed to produce an image still.');
      }

      // 2. Upload photo still to desktop session
      setState('UPLOADING');
      setStatusMessage('Sending photographic image to DeepQR Shield...');

      const result = await uploadQRImage(session.endpoint, photo.uri, session.token);

      if (result.success) {
        setState('SUCCESS');
        setStatusMessage('QR image sent to DeepQR Shield.');
      } else {
        setState('ERROR');
        setErrorMessage(result.error || 'Upload failed.');
        setStatusMessage('Failed to transfer image to desktop.');
      }
    } catch (err) {
      setState('ERROR');
      setErrorMessage(err.message || 'Error capturing photo.');
      setStatusMessage('Capture failure.');
    }
  };

  const handleResetForNextScan = () => {
    setState('READY');
    setStatusMessage('Point camera at physical QR code and tap Capture');
    setErrorMessage(null);
  };

  return (
    <SafeAreaView style={styles.container}>
      {/* Top Header with Session Badge */}
      <View style={styles.header}>
        <View>
          <Text style={styles.title}>DeepQR Shield</Text>
          <Text style={styles.subtitle}>Target QR Capture Mode</Text>
        </View>
        <TouchableOpacity style={styles.resetButton} onPress={onResetPairing}>
          <Text style={styles.resetButtonText}>Re-Pair</Text>
        </TouchableOpacity>
      </View>

      {/* Camera Viewfinder */}
      <View style={styles.cameraContainer}>
        {state !== 'SUCCESS' ? (
          <CameraView
            ref={cameraRef}
            style={styles.cameraView}
            facing="back"
          />
        ) : (
          <View style={styles.successBackdrop} />
        )}

        {/* Viewfinder Reticle Overlay */}
        <View style={styles.overlay} pointerEvents="none">
          {state !== 'SUCCESS' ? (
            <View style={styles.reticleBox}>
              <View style={[styles.corner, styles.cornerTL]} />
              <View style={[styles.corner, styles.cornerTR]} />
              <View style={[styles.corner, styles.cornerBL]} />
              <View style={[styles.corner, styles.cornerBR]} />

              {/* Crosshair Center */}
              <View style={styles.crosshairH} />
              <View style={styles.crosshairV} />

              {(state === 'CAPTURING' || state === 'UPLOADING') && (
                <View style={styles.loadingCover}>
                  <ActivityIndicator size="large" color="#10b981" />
                  <Text style={styles.loadingText}>
                    {state === 'CAPTURING' ? 'Capturing...' : 'Uploading to desktop...'}
                  </Text>
                </View>
              )}
            </View>
          ) : (
            <View style={styles.successCard}>
              <View style={styles.successIconBadge}>
                <Text style={styles.checkmarkIcon}>✓</Text>
              </View>
              <Text style={styles.successTitle}>Transferred to Desktop!</Text>
              <Text style={styles.successDesc}>
                The photographic QR image has been staged on your desktop web application.
              </Text>
              <Text style={styles.successNote}>
                Click "Analyze QR code" on your desktop to run the multimodal threat assessment.
              </Text>

              <TouchableOpacity style={styles.newScanButton} onPress={handleResetForNextScan}>
                <Text style={styles.newScanButtonText}>Capture Another QR</Text>
              </TouchableOpacity>
            </View>
          )}
        </View>
      </View>

      {/* Controls & Feedback Footer */}
      <View style={styles.footer}>
        <View style={[styles.statusBadge, state === 'ERROR' ? styles.statusBadgeError : null]}>
          <Text style={[styles.statusText, state === 'ERROR' ? styles.statusTextError : null]}>
            {errorMessage || statusMessage}
          </Text>
        </View>

        {state !== 'SUCCESS' && (
          <View style={styles.controlsRow}>
            <TouchableOpacity
              style={[
                styles.shutterButton,
                (state === 'CAPTURING' || state === 'UPLOADING') ? styles.shutterDisabled : null,
              ]}
              onPress={handleCaptureAndUpload}
              disabled={state === 'CAPTURING' || state === 'UPLOADING'}
            >
              <View style={styles.shutterInner} />
            </TouchableOpacity>
          </View>
        )}

        <Text style={styles.securityNotice}>
          🔒 Air-gapped sensor mode: Scanned destination URLs are quarantined and never executed on this device.
        </Text>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#09090b',
  },
  header: {
    paddingHorizontal: 20,
    paddingTop: 16,
    paddingBottom: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#27272a',
    backgroundColor: '#09090b',
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  title: {
    fontSize: 20,
    fontWeight: '700',
    color: '#ffffff',
    letterSpacing: -0.5,
  },
  subtitle: {
    fontSize: 13,
    color: '#10b981',
    fontWeight: '600',
    marginTop: 2,
  },
  resetButton: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 6,
    backgroundColor: '#18181b',
    borderWidth: 1,
    borderColor: '#3f3f46',
  },
  resetButtonText: {
    color: '#a1a1aa',
    fontSize: 12,
    fontWeight: '600',
  },
  cameraContainer: {
    flex: 1,
    position: 'relative',
    backgroundColor: '#000000',
  },
  cameraView: {
    flex: 1,
    width: '100%',
    height: '100%',
  },
  successBackdrop: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: '#09090b',
  },
  overlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0, 0, 0, 0.4)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  reticleBox: {
    width: 270,
    height: 270,
    position: 'relative',
    justifyContent: 'center',
    alignItems: 'center',
  },
  corner: {
    position: 'absolute',
    width: 32,
    height: 32,
    borderColor: '#10b981',
  },
  cornerTL: {
    top: 0,
    left: 0,
    borderTopWidth: 3,
    borderLeftWidth: 3,
  },
  cornerTR: {
    top: 0,
    right: 0,
    borderTopWidth: 3,
    borderRightWidth: 3,
  },
  cornerBL: {
    bottom: 0,
    left: 0,
    borderBottomWidth: 3,
    borderLeftWidth: 3,
  },
  cornerBR: {
    bottom: 0,
    right: 0,
    borderBottomWidth: 3,
    borderRightWidth: 3,
  },
  crosshairH: {
    position: 'absolute',
    width: 20,
    height: 1,
    backgroundColor: 'rgba(16, 185, 129, 0.5)',
  },
  crosshairV: {
    position: 'absolute',
    height: 20,
    width: 1,
    backgroundColor: 'rgba(16, 185, 129, 0.5)',
  },
  loadingCover: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(9, 9, 11, 0.85)',
    justifyContent: 'center',
    alignItems: 'center',
    borderRadius: 8,
  },
  loadingText: {
    color: '#e4e4e7',
    fontSize: 13,
    fontWeight: '500',
    marginTop: 10,
  },
  footer: {
    padding: 20,
    backgroundColor: '#09090b',
    borderTopWidth: 1,
    borderTopColor: '#27272a',
    alignItems: 'center',
  },
  statusBadge: {
    backgroundColor: '#18181b',
    paddingVertical: 10,
    paddingHorizontal: 16,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#3f3f46',
    width: '100%',
    alignItems: 'center',
    marginBottom: 16,
  },
  statusBadgeError: {
    backgroundColor: 'rgba(239, 68, 68, 0.1)',
    borderColor: '#ef4444',
  },
  statusText: {
    color: '#e4e4e7',
    fontSize: 13,
    fontWeight: '500',
    textAlign: 'center',
  },
  statusTextError: {
    color: '#f87171',
  },
  controlsRow: {
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 12,
  },
  shutterButton: {
    width: 76,
    height: 76,
    borderRadius: 38,
    borderWidth: 4,
    borderColor: '#10b981',
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: 'transparent',
  },
  shutterDisabled: {
    opacity: 0.5,
  },
  shutterInner: {
    width: 60,
    height: 60,
    borderRadius: 30,
    backgroundColor: '#ffffff',
  },
  securityNotice: {
    color: '#71717a',
    fontSize: 11,
    textAlign: 'center',
    lineHeight: 15,
  },
  successCard: {
    width: '85%',
    backgroundColor: '#18181b',
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#27272a',
    padding: 24,
    alignItems: 'center',
  },
  successIconBadge: {
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: 'rgba(16, 185, 129, 0.15)',
    borderWidth: 1,
    borderColor: '#10b981',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 16,
  },
  checkmarkIcon: {
    color: '#10b981',
    fontSize: 28,
    fontWeight: 'bold',
  },
  successTitle: {
    color: '#ffffff',
    fontSize: 18,
    fontWeight: '700',
    marginBottom: 8,
    textAlign: 'center',
  },
  successDesc: {
    color: '#a1a1aa',
    fontSize: 13,
    textAlign: 'center',
    lineHeight: 18,
    marginBottom: 8,
  },
  successNote: {
    color: '#10b981',
    fontSize: 12,
    fontWeight: '600',
    textAlign: 'center',
    lineHeight: 16,
    marginBottom: 20,
  },
  newScanButton: {
    backgroundColor: '#10b981',
    paddingVertical: 12,
    paddingHorizontal: 20,
    borderRadius: 8,
    width: '100%',
    alignItems: 'center',
  },
  newScanButtonText: {
    color: '#09090b',
    fontSize: 13,
    fontWeight: '700',
  },
});
