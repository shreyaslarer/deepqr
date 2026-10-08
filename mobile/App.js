import React, { useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { StatusBar } from 'expo-status-bar';
import PairingScreen from './src/screens/PairingScreen';
import CaptureScreen from './src/screens/CaptureScreen';

/**
 * DeepQR Shield - Mobile Companion Root Application
 *
 * State Coordinator:
 * - PAIRING: Optical handshake with desktop web application via pairing QR.
 * - CAPTURE: High-resolution physical QR capture and direct staging transfer.
 */
export default function App() {
  const [session, setSession] = useState(null);

  const handlePaired = (pairingData) => {
    setSession(pairingData);
  };

  const handleResetPairing = () => {
    setSession(null);
  };

  return (
    <View style={styles.container}>
      <StatusBar style="light" />
      {!session ? (
        <PairingScreen onPaired={handlePaired} />
      ) : (
        <CaptureScreen session={session} onResetPairing={handleResetPairing} />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#09090b',
  },
});
