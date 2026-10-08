import React, { useState, useRef, useEffect } from 'react';
import {
  StyleSheet,
  Text,
  View,
  TouchableOpacity,
  ActivityIndicator,
  SafeAreaView,
  TextInput,
} from 'react-native';
import { CameraView, useCameraPermissions } from 'expo-camera';
import { validateSession } from '../services/api';

/**
 * PairingScreen for DeepQR Shield Companion.
 *
 * Scans the optical pairing QR code displayed on the desktop browser.
 * Strictly verifies the internal "deepqr-companion-v1" protocol.
 * NEVER opens or navigates to scanned QR contents.
 */
export default function PairingScreen({ onPaired }) {
  const [permission, requestPermission] = useCameraPermissions();
  const [isProcessing, setIsProcessing] = useState(false);
  const [statusMessage, setStatusMessage] = useState('Align camera with pairing QR on desktop screen');
  const [isError, setIsError] = useState(false);
  const scannedLockRef = useRef(false);

  // Auto-request permission on mount if undetermined
  useEffect(() => {
    if (permission && !permission.granted && permission.canAskAgain) {
      requestPermission();
    }
  }, [permission]);

  const handleBarcodeScanned = async ({ data }) => {
    if (scannedLockRef.current || isProcessing) return;

    try {
      let parsed;
      try {
        parsed = JSON.parse(data);
      } catch {
        setStatusMessage('Not a DeepQR pairing code. Please scan the desktop pairing QR.');
        setIsError(true);
        return;
      }

      if (
        parsed.protocol !== 'deepqr-companion-v1' ||
        !parsed.endpoint ||
        !parsed.sessionId ||
        !parsed.token
      ) {
        setStatusMessage('Unrecognized QR format. Scan the pairing QR shown on desktop.');
        setIsError(true);
        return;
      }

      if (parsed.expires && parsed.expires < Date.now() / 1000) {
        setStatusMessage('Pairing QR has expired. Please refresh pairing on desktop.');
        setIsError(true);
        return;
      }

      scannedLockRef.current = true;
      setIsProcessing(true);
      setIsError(false);
      setStatusMessage('Pairing with desktop session...');

      const result = await validateSession(parsed.endpoint, parsed.token);

      if (result.success) {
        setStatusMessage('Paired successfully!');
        setTimeout(() => {
          onPaired({
            endpoint: result.workingEndpoint || parsed.endpoint,
            sessionId: parsed.sessionId,
            token: parsed.token,
            expires: parsed.expires,
          });
        }, 400);
      } else {
        scannedLockRef.current = false;
        setIsProcessing(false);
        setIsError(true);
        setStatusMessage(result.error || 'Pairing failed. Ensure phone and PC are connected.');
      }
    } catch (err) {
      scannedLockRef.current = false;
      setIsProcessing(false);
      setIsError(true);
      setStatusMessage('Error verifying pairing QR.');
    }
  };

  // Fast-track auto-pairing for connected USB session
  const handleAutoPairUSB = async () => {
    if (isProcessing) return;
    setIsProcessing(true);
    setIsError(false);
    setStatusMessage('Connecting to desktop session via USB...');

    try {
      // Check localhost:8000 for active session
      const res = await fetch('http://localhost:8000/api/session/latest');
      if (!res.ok) {
        throw new Error('No active pairing session found. Click "Scan with Mobile" on your desktop first.');
      }
      const data = await res.json();
      const result = await validateSession(`http://localhost:8000/api/session/${data.session_id}`, data.token);

      if (result.success) {
        setStatusMessage('Paired via USB successfully!');
        setTimeout(() => {
          onPaired({
            endpoint: `http://localhost:8000/api/session/${data.session_id}`,
            sessionId: data.session_id,
            token: data.token,
            expires: Date.now() / 1000 + 300,
          });
        }, 400);
      } else {
        throw new Error(result.error || 'Pairing validation failed.');
      }
    } catch (err) {
      setIsProcessing(false);
      setIsError(true);
      setStatusMessage(err.message || 'Auto-pair failed.');
    }
  };

  if (!permission) {
    return (
      <SafeAreaView style={styles.container}>
        <ActivityIndicator size="large" color="#10b981" />
        <Text style={styles.text}>Requesting camera permissions...</Text>
      </SafeAreaView>
    );
  }

  if (!permission.granted) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.permissionCard}>
          <Text style={styles.permissionTitle}>Camera Access Required</Text>
          <Text style={styles.permissionDesc}>
            DeepQR Shield Companion needs camera access to pair with your desktop screen and capture physical QR codes.
          </Text>
          <TouchableOpacity style={styles.primaryButton} onPress={requestPermission}>
            <Text style={styles.primaryButtonText}>Grant Camera Permission</Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      {/* Top Header */}
      <View style={styles.header}>
        <Text style={styles.title}>DeepQR Shield</Text>
        <Text style={styles.subtitle}>Step 1: Scan Desktop Pairing QR</Text>
      </View>

      {/* Viewfinder Viewport - Flex 1 with key to mount after permission */}
      <View style={styles.cameraContainer}>
        <CameraView
          key={permission.granted ? 'camera-active' : 'camera-inactive'}
          style={styles.cameraView}
          facing="back"
          barcodeScannerSettings={{
            barcodeTypes: ['qr'],
          }}
          onBarcodeScanned={isProcessing ? undefined : handleBarcodeScanned}
        />

        {/* Reticle Overlay */}
        <View style={styles.overlay} pointerEvents="none">
          <View style={[styles.targetBox, isError ? styles.targetBoxError : null]}>
            <View style={[styles.corner, styles.cornerTL]} />
            <View style={[styles.corner, styles.cornerTR]} />
            <View style={[styles.corner, styles.cornerBL]} />
            <View style={[styles.corner, styles.cornerBR]} />
            {isProcessing && (
              <View style={styles.processingCover}>
                <ActivityIndicator size="large" color="#10b981" />
                <Text style={styles.processingText}>Connecting to desktop...</Text>
              </View>
            )}
          </View>
        </View>
      </View>

      {/* Status Bar / Feedback / USB Fast-Pair */}
      <View style={styles.footer}>
        <View style={[styles.statusBadge, isError ? styles.statusBadgeError : null]}>
          <Text style={[styles.statusText, isError ? styles.statusTextError : null]}>
            {statusMessage}
          </Text>
        </View>

        {/* USB Instant Connect Shortcut Button */}
        <TouchableOpacity
          style={styles.usbPairButton}
          onPress={handleAutoPairUSB}
          disabled={isProcessing}
        >
          <Text style={styles.usbPairButtonText}>⚡ Instant Pair via USB</Text>
        </TouchableOpacity>

        <Text style={styles.hintText}>
          Point at desktop pairing QR or tap Instant Pair via USB
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
  overlay: {
    ...StyleSheet.absoluteFillObject,
    justifyContent: 'center',
    alignItems: 'center',
  },
  targetBox: {
    width: 260,
    height: 260,
    position: 'relative',
    justifyContent: 'center',
    alignItems: 'center',
  },
  targetBoxError: {
    borderColor: '#ef4444',
  },
  corner: {
    position: 'absolute',
    width: 28,
    height: 28,
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
  processingCover: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(9, 9, 11, 0.85)',
    justifyContent: 'center',
    alignItems: 'center',
    borderRadius: 8,
  },
  processingText: {
    color: '#e4e4e7',
    fontSize: 13,
    fontWeight: '500',
    marginTop: 10,
  },
  footer: {
    padding: 16,
    backgroundColor: '#09090b',
    borderTopWidth: 1,
    borderTopColor: '#27272a',
    alignItems: 'center',
  },
  statusBadge: {
    backgroundColor: '#18181b',
    paddingVertical: 8,
    paddingHorizontal: 14,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#3f3f46',
    width: '100%',
    alignItems: 'center',
  },
  statusBadgeError: {
    backgroundColor: 'rgba(239, 68, 68, 0.1)',
    borderColor: '#ef4444',
  },
  statusText: {
    color: '#e4e4e7',
    fontSize: 12,
    fontWeight: '500',
    textAlign: 'center',
  },
  statusTextError: {
    color: '#f87171',
  },
  usbPairButton: {
    marginTop: 10,
    backgroundColor: '#10b981',
    paddingVertical: 10,
    paddingHorizontal: 20,
    borderRadius: 8,
    width: '100%',
    alignItems: 'center',
  },
  usbPairButtonText: {
    color: '#09090b',
    fontSize: 13,
    fontWeight: '700',
  },
  hintText: {
    color: '#71717a',
    fontSize: 11,
    marginTop: 8,
    textAlign: 'center',
  },
  permissionCard: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 30,
  },
  permissionTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: '#ffffff',
    marginBottom: 10,
  },
  permissionDesc: {
    fontSize: 14,
    color: '#a1a1aa',
    textAlign: 'center',
    lineHeight: 20,
    marginBottom: 24,
  },
  primaryButton: {
    backgroundColor: '#10b981',
    paddingVertical: 14,
    paddingHorizontal: 24,
    borderRadius: 10,
  },
  primaryButtonText: {
    color: '#09090b',
    fontSize: 14,
    fontWeight: '700',
  },
  text: {
    color: '#a1a1aa',
    marginTop: 12,
  },
});
