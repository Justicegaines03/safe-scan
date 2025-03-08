import { StyleSheet, Text, View, TouchableOpacity, Platform } from 'react-native';
import React, { useState, useEffect } from 'react';
import { CameraView, CameraType, BarCodeScanningResult, useCameraPermissions } from 'expo-camera';
import { WebView } from 'react-native-webview';

const Index = () => {
  const [facing, setFacing] = useState<CameraType>('back');
  const [scannedData, setScannedData] = useState<string | null>(null);
  const [permission, requestPermission] = useCameraPermissions();

  if (!permission) {
    // Camera permissions are still loading
    return (
      <View style={styles.container}>
        <Text style={styles.text}>Loading camera permissions...</Text>
      </View>
    );
  }

  if (!permission.granted) {
    // Camera permissions are not granted yet
    return (
      <View style={styles.container}>
        <Text style={styles.text}>We need your permission to show the camera</Text>
        <TouchableOpacity 
          style={styles.button}
          onPress={requestPermission}
        >
          <Text style={styles.buttonText}>Grant Permission</Text>
        </TouchableOpacity>
      </View>
    );
  }

  const handleBarCodeScanned = ({ type, data }: BarCodeScanningResult) => {
    setScannedData(data);
  };

  if (Platform.OS === 'web') {
    return (
      <View style={styles.container}>
        <WebView
          source={{ uri: 'https://qrcodescan.in/' }}
          style={{ flex: 1, width: '100%' }}
          onMessage={(event) => setScannedData(event.nativeEvent.data)}
        />
        {scannedData && (
          <View style={styles.resultContainer}>
            <Text style={styles.text}>Scanned Data: {scannedData}</Text>
            <TouchableOpacity
              style={styles.button}
              onPress={() => setScannedData(null)}
            >
              <Text style={styles.buttonText}>Scan Again</Text>
            </TouchableOpacity>
          </View>
        )}
      </View>
    );
  }

  return (
    <View style={styles.container}>
      {scannedData ? (
        <View style={styles.resultContainer}>
          <Text style={styles.text}>Scanned Data: {scannedData}</Text>
          <TouchableOpacity
            style={styles.button}
            onPress={() => setScannedData(null)}
          >
            <Text style={styles.buttonText}>Scan Again</Text>
          </TouchableOpacity>
        </View>
      ) : (
        <CameraView
          style={styles.camera}
          facing={facing}
          barcodeScannerSettings={{
            barcodeTypes: ["qr"]
          }}
          onBarcodeScanned={handleBarCodeScanned}
        >
          <View style={styles.overlay}>
            <TouchableOpacity
              style={styles.flipButton}
              onPress={() => setFacing(current => (current === 'back' ? 'front' : 'back'))}
            >
              <Text style={styles.flipText}>Flip Camera</Text>
            </TouchableOpacity>
            <Text style={styles.scanText}>Position QR code in frame to scan</Text>
          </View>
        </CameraView>
      )}
    </View>
  );
};

export default Index;

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#000',
  },
  camera: {
    flex: 1,
  },
  text: {
    fontSize: 16,
    color: '#fff',
    textAlign: 'center',
    marginVertical: 10,
  },
  button: {
    backgroundColor: '#2196F3',
    padding: 15,
    borderRadius: 5,
    marginTop: 10,
  },
  buttonText: {
    color: '#fff',
    fontSize: 16,
    textAlign: 'center',
  },
  resultContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  overlay: {
    flex: 1,
    backgroundColor: 'transparent',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 40,
  },
  scanText: {
    fontSize: 18,
    color: '#fff',
    textAlign: 'center',
    backgroundColor: 'rgba(0,0,0,0.7)',
    padding: 10,
    borderRadius: 5,
  },
  flipButton: {
    padding: 10,
    backgroundColor: 'rgba(0,0,0,0.7)',
    borderRadius: 5,
  },
  flipText: {
    fontSize: 16,
    color: '#fff',
  },
});
